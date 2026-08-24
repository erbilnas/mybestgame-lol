import { and, desc, eq, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm'
import { bids, games, type BidType } from '../database/schema'
import { useDb } from '../database/index'
import { aggregateContributors, maskContributor, type AggregatedContributor } from './contributor'
import { hasDirectorMessage } from './director-fields'
import { getRecentBoardEvents, insertBoardEvent } from './board-events'

const EXPIRE_THROTTLE_MS = 60_000
let lastExpireAt = 0

/** Throttled expiry for read paths. Returns true when bids were expired. */
export async function maybeExpireStaleBids(): Promise<boolean> {
  if (Date.now() - lastExpireAt < EXPIRE_THROTTLE_MS) {
    return false
  }
  lastExpireAt = Date.now()
  const stale = await expireStaleBids()
  return stale.length > 0
}

export type { BidType }
export const MIN_BID_CENTS = 100
/** Polar checkout max is $999,999.99 */
export const MAX_BID_CENTS = 99_999_999
/** Board credit for the once-per-device free game support ($0 checkout). */
export const FREE_SUPPORT_CENTS = 100
export const BID_EXPIRY_DAYS = 30

export interface LeaderboardTotal {
  gameId: number
  totalCents: number
  firstBidAt: Date
}

export interface ContributorInfo {
  label: string
  amountCents: number
  at: string
}

export interface LeaderboardDirector {
  bidId: string
  title: string
  description: string | null
  priceCents: number
}

export interface LeaderboardEntryPayload {
  rank: number
  gameId: number
  title: string
  slug: string
  coverUrl: string | null
  summary: string | null
  totalCents: number
  bidCount: number
  director: LeaderboardDirector | null
  topContributor: ContributorInfo | null
  lastContributor: ContributorInfo | null
  contributors: AggregatedContributor[]
  nextExpiresAt: string | null
}

export interface SiteStats {
  totalRevenueCents: number
  totalPaidBids: number
  gamesOnBoard: number
  launchedAt: string | null
  liveDirectors: number
  allTimeDirectors: number
  livePlayers: number
  allTimePlayers: number
  directorRevenueCents: number
}

export type ActivityType = 'bid_paid' | 'rank_takeover' | 'director_takeover' | 'decay'

export interface ActivityItem {
  type: ActivityType
  gameId: number
  gameTitle: string
  rank: number
  amountCents: number
  contributor: string
  at: string
  detail?: {
    fromRank?: number | null
    toRank?: number | null
    previousTitle?: string | null
    previousDirectorTitle?: string | null
    directorTitle?: string | null
    leftBoard?: boolean
  }
}

export interface GameBoardSnapshot {
  gameId: number
  rank: number
  totalCents: number
  title: string
  directorBidId: string | null
  directorTitle: string | null
}

export interface ExpiredBidRow {
  id: string
  gameId: number
  bidType: BidType
  amount: number
}

interface DirectorBidRow {
  id: string
  displayName: string
  amount: number
  adTitle: string
  adDescription: string | null
  createdAt: Date
}

/**
 * Game Director Message for the top contributor (by stacked displayName).
 * Uses that person's newest paid bid with a non-empty title.
 */
export function pickGameDirectorMessage<T extends {
  displayName: string
  amount: number
  createdAt: Date
  adTitle: string
}>(gameBids: T[]): T | null {
  if (gameBids.length === 0) return null

  const byName = new Map<string, { amountCents: number, at: Date }>()
  for (const bid of gameBids) {
    const key = bid.displayName.trim().toLowerCase()
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, { amountCents: bid.amount, at: bid.createdAt })
      continue
    }
    existing.amountCents += bid.amount
    if (bid.createdAt > existing.at) existing.at = bid.createdAt
  }

  const topKey = [...byName.entries()]
    .sort((a, b) => {
      if (b[1].amountCents !== a[1].amountCents) return b[1].amountCents - a[1].amountCents
      return b[1].at.getTime() - a[1].at.getTime()
    })[0]?.[0]

  if (!topKey) return null

  const topBids = gameBids
    .filter(bid => bid.displayName.trim().toLowerCase() === topKey)
    .filter(bid => hasDirectorMessage(bid.adTitle))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return topBids[0] ?? null
}

function toDirectorPayload(bid: DirectorBidRow): LeaderboardDirector {
  return {
    bidId: bid.id,
    title: bid.adTitle,
    description: bid.adDescription,
    priceCents: bid.amount
  }
}

/** Snapshot without running expiry (caller controls expire timing). */
export async function snapshotGameBoard(gameId: number): Promise<GameBoardSnapshot> {
  const db = useDb()
  const totals = await getLeaderboardTotalsWithoutExpire()
  const rankByGame = new Map(totals.map((entry, index) => [entry.gameId, index + 1]))
  const totalByGame = new Map(totals.map(entry => [entry.gameId, entry.totalCents]))

  const [game] = await db
    .select({ title: games.title })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  const director = await getGameDirectorMessageWithoutExpire(gameId)

  return {
    gameId,
    rank: rankByGame.get(gameId) ?? 0,
    totalCents: totalByGame.get(gameId) ?? 0,
    title: game?.title ?? `Game ${gameId}`,
    directorBidId: director?.id ?? null,
    directorTitle: director?.adTitle ?? null
  }
}

export async function getLeaderboardTotalsWithoutExpire(): Promise<LeaderboardTotal[]> {
  const db = useDb()

  const rows = await db
    .select({
      gameId: bids.gameId,
      totalCents: sql<number>`coalesce(sum(${bids.amount}), 0)`.mapWith(Number),
      firstBidAt: sql<number>`min(${bids.createdAt})`.mapWith((v: number) => new Date(v))
    })
    .from(bids)
    .where(eq(bids.status, 'paid'))
    .groupBy(bids.gameId)
    .orderBy(
      sql`coalesce(sum(${bids.amount}), 0) desc`,
      sql`min(${bids.createdAt}) asc`
    )

  return rows.map(row => ({
    gameId: row.gameId,
    totalCents: row.totalCents,
    firstBidAt: row.firstBidAt
  }))
}

async function getGameDirectorMessageWithoutExpire(gameId: number): Promise<DirectorBidRow | null> {
  const db = useDb()

  const gameBids = await db
    .select({
      id: bids.id,
      displayName: bids.displayName,
      amount: bids.amount,
      adTitle: bids.adTitle,
      adDescription: bids.adDescription,
      createdAt: bids.createdAt
    })
    .from(bids)
    .where(and(
      eq(bids.gameId, gameId),
      eq(bids.status, 'paid')
    ))

  return pickGameDirectorMessage(gameBids)
}

export async function expireStaleBids(): Promise<ExpiredBidRow[]> {
  const db = useDb()
  const now = new Date()

  const stale = await db
    .select({
      id: bids.id,
      gameId: bids.gameId,
      bidType: bids.bidType,
      amount: bids.amount
    })
    .from(bids)
    .where(and(
      eq(bids.status, 'paid'),
      isNotNull(bids.expiresAt),
      lte(bids.expiresAt, now)
    ))

  if (stale.length === 0) {
    return []
  }

  const affectedGameIds = [...new Set(stale.map(row => row.gameId))]
  const beforeByGame = new Map<number, GameBoardSnapshot>()
  for (const gameId of affectedGameIds) {
    beforeByGame.set(gameId, await snapshotGameBoard(gameId))
  }

  await db
    .update(bids)
    .set({ status: 'expired' })
    .where(and(
      eq(bids.status, 'paid'),
      isNotNull(bids.expiresAt),
      lte(bids.expiresAt, now)
    ))

  for (const gameId of affectedGameIds) {
    const before = beforeByGame.get(gameId)
    if (!before) continue
    const after = await snapshotGameBoard(gameId)
    const leftBoard = after.rank === 0
    const rankDropped = after.rank > 0 && before.rank > 0 && after.rank > before.rank
    const directorLost = Boolean(before.directorBidId && before.directorBidId !== after.directorBidId)

    if (!leftBoard && !rankDropped && !directorLost) continue

    await insertBoardEvent({
      type: 'decay',
      gameId,
      payload: {
        gameTitle: after.title || before.title,
        fromRank: before.rank || null,
        toRank: leftBoard ? null : after.rank,
        rank: after.rank,
        previousDirectorTitle: directorLost ? before.directorTitle : null,
        leftBoard
      }
    })
  }

  return stale
}

export async function getLeaderboardTotals(): Promise<LeaderboardTotal[]> {
  const { getCachedLeaderboardTotals } = await import('./board-cache')
  return getCachedLeaderboardTotals()
}

export async function getFreshLeaderboardTotals(): Promise<LeaderboardTotal[]> {
  const { getCachedLeaderboardTotals } = await import('./board-cache')
  return getCachedLeaderboardTotals({ bypassCache: true })
}

export async function getGameTotalCents(gameId: number): Promise<number> {
  await maybeExpireStaleBids()
  const db = useDb()

  const [row] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${bids.amount}), 0)`.mapWith(Number)
    })
    .from(bids)
    .where(and(eq(bids.gameId, gameId), eq(bids.status, 'paid')))

  return row?.totalCents ?? 0
}

export function validateIncrementCents(incrementCents: number) {
  if (!Number.isInteger(incrementCents) || incrementCents < MIN_BID_CENTS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Minimum game contribution is $${MIN_BID_CENTS / 100}`
    })
  }
  if (incrementCents > MAX_BID_CENTS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Maximum contribution is $${(MAX_BID_CENTS / 100).toLocaleString('en-US')}`
    })
  }
}

export async function getGameDirectorMessage(gameId: number): Promise<DirectorBidRow | null> {
  await maybeExpireStaleBids()
  return getGameDirectorMessageWithoutExpire(gameId)
}

function sortTotals(totals: LeaderboardTotal[]): LeaderboardTotal[] {
  return [...totals].sort((a, b) => {
    if (b.totalCents !== a.totalCents) return b.totalCents - a.totalCents
    return a.firstBidAt.getTime() - b.firstBidAt.getTime()
  })
}

export function projectRank(
  totals: LeaderboardTotal[],
  gameId: number,
  incrementCents: number
): { projectedRank: number, projectedTotalCents: number, currentTotalCents: number } {
  const current = totals.find(entry => entry.gameId === gameId)
  const currentTotalCents = current?.totalCents ?? 0
  const projectedTotalCents = currentTotalCents + incrementCents

  const simulated = sortTotals(
    totals
      .filter(entry => entry.gameId !== gameId)
      .concat([{
        gameId,
        totalCents: projectedTotalCents,
        firstBidAt: current?.firstBidAt ?? new Date()
      }])
  )

  const projectedRank = simulated.findIndex(entry => entry.gameId === gameId) + 1
  return { projectedRank, projectedTotalCents, currentTotalCents }
}

/** Rank the game would hold if `removeCents` were not in its stack. Null if it would leave the board. */
export function rankAfterRemovingCents(
  totals: LeaderboardTotal[],
  gameId: number,
  removeCents: number
): number | null {
  if (removeCents <= 0) {
    const index = sortTotals(totals).findIndex(entry => entry.gameId === gameId)
    return index < 0 ? null : index + 1
  }

  const simulated = sortTotals(
    totals
      .map(entry =>
        entry.gameId === gameId
          ? { ...entry, totalCents: entry.totalCents - removeCents }
          : entry
      )
      .filter(entry => entry.totalCents > 0)
  )

  const index = simulated.findIndex(entry => entry.gameId === gameId)
  return index < 0 ? null : index + 1
}

export function bidExpiresAt(): Date {
  const expires = new Date()
  expires.setDate(expires.getDate() + BID_EXPIRY_DAYS)
  return expires
}

export async function getSiteStats(): Promise<SiteStats> {
  await maybeExpireStaleBids()
  const db = useDb()
  const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000

  const [paidStats] = await db
    .select({
      totalRevenueCents: sql<number>`coalesce(sum(${bids.amount}), 0)`.mapWith(Number),
      totalPaidBids: sql<number>`count(*)`.mapWith(Number),
      launchedAt: sql<number | null>`min(${bids.createdAt})`.mapWith((value: number | null) => value),
      allTimePlayers: sql<number>`count(distinct ${bids.displayName})`.mapWith(Number)
    })
    .from(bids)
    .where(eq(bids.status, 'paid'))

  const [directorPaidStats] = await db
    .select({
      liveDirectors: sql<number>`count(distinct ${bids.gameId})`.mapWith(Number),
      allTimeDirectors: sql<number>`count(distinct ${bids.displayName})`.mapWith(Number),
      directorRevenueCents: sql<number>`coalesce(sum(${bids.amount}), 0)`.mapWith(Number)
    })
    .from(bids)
    .where(and(
      eq(bids.status, 'paid'),
      ne(bids.adTitle, '')
    ))

  const [livePlayerStats] = await db
    .select({
      livePlayers: sql<number>`count(distinct ${bids.displayName})`.mapWith(Number)
    })
    .from(bids)
    .where(and(eq(bids.status, 'paid'), sql`${bids.createdAt} >= ${dayAgoMs}`))

  const totals = await getLeaderboardTotalsWithoutExpire()

  return {
    totalRevenueCents: paidStats?.totalRevenueCents ?? 0,
    totalPaidBids: paidStats?.totalPaidBids ?? 0,
    gamesOnBoard: totals.length,
    launchedAt: paidStats?.launchedAt ? new Date(paidStats.launchedAt).toISOString() : null,
    liveDirectors: directorPaidStats?.liveDirectors ?? 0,
    allTimeDirectors: directorPaidStats?.allTimeDirectors ?? 0,
    livePlayers: livePlayerStats?.livePlayers ?? 0,
    allTimePlayers: paidStats?.allTimePlayers ?? 0,
    directorRevenueCents: directorPaidStats?.directorRevenueCents ?? 0
  }
}

export async function getRecentActivity(limit = 8): Promise<ActivityItem[]> {
  await maybeExpireStaleBids()

  const events = await getRecentBoardEvents(limit)
  if (events.length > 0) {
    return events
  }

  // Fallback for empty board_events (pre-migrate data)
  const db = useDb()
  const totals = await getLeaderboardTotalsWithoutExpire()
  const rankByGame = new Map(totals.map((entry, index) => [entry.gameId, index + 1]))

  const recentBids = await db
    .select({
      gameId: bids.gameId,
      amount: bids.amount,
      displayName: bids.displayName,
      createdAt: bids.createdAt,
      gameTitle: games.title
    })
    .from(bids)
    .innerJoin(games, eq(bids.gameId, games.id))
    .where(eq(bids.status, 'paid'))
    .orderBy(desc(bids.createdAt))
    .limit(limit)

  return recentBids.map(bid => ({
    type: 'bid_paid' as const,
    gameId: bid.gameId,
    gameTitle: bid.gameTitle,
    rank: rankByGame.get(bid.gameId) ?? 0,
    amountCents: bid.amount,
    contributor: maskContributor(bid.displayName),
    at: bid.createdAt.toISOString()
  }))
}

export async function buildLeaderboardEntries(
  preloadedTotals?: LeaderboardTotal[]
): Promise<LeaderboardEntryPayload[]> {
  const db = useDb()
  const totals = preloadedTotals ?? await getLeaderboardTotalsWithoutExpire()

  if (totals.length === 0) {
    return []
  }

  const gameIds = totals.map(entry => entry.gameId)
  const gameRows = await db
    .select()
    .from(games)
    .where(inArray(games.id, gameIds))

  const paidBids = await db
    .select({
      id: bids.id,
      bidType: bids.bidType,
      gameId: bids.gameId,
      displayName: bids.displayName,
      amount: bids.amount,
      adTitle: bids.adTitle,
      adDescription: bids.adDescription,
      createdAt: bids.createdAt,
      expiresAt: bids.expiresAt
    })
    .from(bids)
    .where(and(inArray(bids.gameId, gameIds), eq(bids.status, 'paid')))
    .orderBy(desc(bids.createdAt))

  const gameMap = new Map(gameRows.map(game => [game.id, game]))
  const bidsByGame = new Map<number, typeof paidBids>()

  for (const bid of paidBids) {
    const existing = bidsByGame.get(bid.gameId) ?? []
    existing.push(bid)
    bidsByGame.set(bid.gameId, existing)
  }

  return totals.map((total, index) => {
    const game = gameMap.get(total.gameId)
    if (!game) return null

    const gameBids = bidsByGame.get(total.gameId) ?? []
    const latestBid = gameBids[0]
    const directorBid = pickGameDirectorMessage(gameBids)
    const topBid = gameBids.reduce<(typeof gameBids)[number] | null>((best, bid) => {
      if (!best) return bid
      if (bid.amount > best.amount) return bid
      if (bid.amount === best.amount && bid.createdAt < best.createdAt) return bid
      return best
    }, null)

    const toContributor = (bid: (typeof gameBids)[number] | undefined) => {
      if (!bid) return null
      return {
        label: maskContributor(bid.displayName),
        amountCents: bid.amount,
        at: bid.createdAt.toISOString()
      }
    }

    const nextExpiry = gameBids
      .map(bid => bid.expiresAt)
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null

    return {
      rank: index + 1,
      gameId: game.id,
      title: game.title,
      slug: game.slug,
      coverUrl: game.coverUrl,
      summary: game.summary,
      totalCents: total.totalCents,
      bidCount: gameBids.length,
      director: directorBid ? toDirectorPayload(directorBid) : null,
      topContributor: toContributor(topBid ?? undefined),
      lastContributor: toContributor(latestBid),
      contributors: aggregateContributors(gameBids),
      nextExpiresAt: nextExpiry ? nextExpiry.toISOString() : null
    }
  }).filter((entry): entry is LeaderboardEntryPayload => entry !== null)
}

export async function getPaidBidPlaque(bidId: string) {
  await maybeExpireStaleBids()
  const db = useDb()

  const [row] = await db
    .select({
      id: bids.id,
      status: bids.status,
      bidType: bids.bidType,
      amount: bids.amount,
      displayName: bids.displayName,
      gameId: bids.gameId,
      expiresAt: bids.expiresAt,
      createdAt: bids.createdAt,
      adTitle: bids.adTitle,
      gameTitle: games.title,
      slug: games.slug,
      coverUrl: games.coverUrl
    })
    .from(bids)
    .innerJoin(games, eq(bids.gameId, games.id))
    .where(eq(bids.id, bidId))
    .limit(1)

  if (!row) return null

  const totals = await getLeaderboardTotalsWithoutExpire()
  const rank = totals.findIndex(entry => entry.gameId === row.gameId) + 1
  const totalCents = totals.find(entry => entry.gameId === row.gameId)?.totalCents ?? 0
  const previousRank = row.status === 'paid'
    ? rankAfterRemovingCents(totals, row.gameId, row.amount)
    : null

  return {
    id: row.id,
    status: row.status,
    bidType: row.bidType,
    amount: row.amount,
    gameId: row.gameId,
    gameTitle: row.gameTitle,
    slug: row.slug,
    coverUrl: row.coverUrl,
    rank: rank > 0 ? rank : null,
    previousRank,
    totalCents,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    contributor: maskContributor(row.displayName),
    hasDirectorMessage: hasDirectorMessage(row.adTitle),
    directorTitle: hasDirectorMessage(row.adTitle) ? row.adTitle : null
  }
}
