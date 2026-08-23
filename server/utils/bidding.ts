import { and, desc, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import { bids, games, type BidType } from '../database/schema'
import { useDb } from '../database/index'
import { aggregateContributors, maskContributor, type AggregatedContributor } from './contributor'
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

export interface LeaderboardAd {
  bidId: string
  title: string
  description: string | null
  link: string
  image: string | null
  clickCount: number
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
  sponsorCents: number
  sponsorClaimCents: number
  ad: LeaderboardAd | null
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
  liveSponsors: number
  allTimeSponsors: number
  livePlayers: number
  allTimePlayers: number
  sponsorClicks: number
  sponsorRevenueCents: number
}

export type ActivityType = 'bid_paid' | 'rank_takeover' | 'sponsor_takeover' | 'decay'

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
    previousSponsorTitle?: string | null
    sponsorTitle?: string | null
    leftBoard?: boolean
  }
}

export interface GameBoardSnapshot {
  gameId: number
  rank: number
  totalCents: number
  title: string
  sponsorBidId: string | null
  sponsorTitle: string | null
}

export interface ExpiredBidRow {
  id: string
  gameId: number
  bidType: BidType
  amount: number
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

  const sponsor = await getWinningSponsorBidWithoutExpire(gameId)

  return {
    gameId,
    rank: rankByGame.get(gameId) ?? 0,
    totalCents: totalByGame.get(gameId) ?? 0,
    title: game?.title ?? `Game ${gameId}`,
    sponsorBidId: sponsor?.id ?? null,
    sponsorTitle: sponsor?.adTitle ?? null
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

async function getWinningSponsorBidWithoutExpire(gameId: number): Promise<SponsorBidRow | null> {
  const db = useDb()

  const sponsorBids = await db
    .select({
      id: bids.id,
      amount: bids.amount,
      adTitle: bids.adTitle,
      adDescription: bids.adDescription,
      adLink: bids.adLink,
      adImage: bids.adImage,
      clickCount: bids.clickCount,
      createdAt: bids.createdAt
    })
    .from(bids)
    .where(and(
      eq(bids.gameId, gameId),
      eq(bids.status, 'paid'),
      eq(bids.bidType, 'sponsor')
    ))

  return pickWinningSponsorBid(sponsorBids)
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
    const sponsorLost = Boolean(before.sponsorBidId && before.sponsorBidId !== after.sponsorBidId)

    if (!leftBoard && !rankDropped && !sponsorLost) continue

    await insertBoardEvent({
      type: 'decay',
      gameId,
      payload: {
        gameTitle: after.title || before.title,
        fromRank: before.rank || null,
        toRank: leftBoard ? null : after.rank,
        rank: after.rank,
        previousSponsorTitle: sponsorLost ? before.sponsorTitle : null,
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
      statusMessage: `Minimum game bid is $${MIN_BID_CENTS / 100}`
    })
  }
  if (incrementCents > MAX_BID_CENTS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Maximum bid is $${(MAX_BID_CENTS / 100).toLocaleString('en-US')}`
    })
  }
}

export function parseBidType(value: unknown): BidType {
  if (value === 'game' || value === 'sponsor') {
    return value
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid bid type' })
}

interface SponsorBidRow {
  id: string
  amount: number
  adTitle: string
  adDescription: string | null
  adLink: string
  adImage: string | null
  clickCount: number
  createdAt: Date
}

export function pickWinningSponsorBid<T extends { amount: number, createdAt: Date }>(sponsorBids: T[]): T | null {
  return sponsorBids.reduce<T | null>((best, bid) => {
    if (!best) return bid
    if (bid.amount > best.amount) return bid
    if (bid.amount === best.amount && bid.createdAt > best.createdAt) return bid
    return best
  }, null)
}

export async function getWinningSponsorBid(gameId: number): Promise<SponsorBidRow | null> {
  await maybeExpireStaleBids()
  return getWinningSponsorBidWithoutExpire(gameId)
}

export async function getMinSponsorBidCents(gameId: number): Promise<number> {
  const winningSponsor = await getWinningSponsorBid(gameId)
  if (!winningSponsor) return MIN_BID_CENTS
  return winningSponsor.amount + MIN_BID_CENTS
}

export function validateSponsorBidCents(amountCents: number, minSponsorBidCents: number) {
  if (!Number.isInteger(amountCents) || amountCents < minSponsorBidCents) {
    throw createError({
      statusCode: 400,
      statusMessage: `Minimum sponsor bid is $${minSponsorBidCents / 100}`
    })
  }
  if (amountCents > MAX_BID_CENTS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Maximum bid is $${(MAX_BID_CENTS / 100).toLocaleString('en-US')}`
    })
  }
}

export function projectRank(
  totals: LeaderboardTotal[],
  gameId: number,
  incrementCents: number
): { projectedRank: number, projectedTotalCents: number, currentTotalCents: number } {
  const currentTotalCents = totals.find(entry => entry.gameId === gameId)?.totalCents ?? 0
  const projectedTotalCents = currentTotalCents + incrementCents

  const simulated = totals
    .filter(entry => entry.gameId !== gameId)
    .concat([{
      gameId,
      totalCents: projectedTotalCents,
      firstBidAt: totals.find(entry => entry.gameId === gameId)?.firstBidAt ?? new Date()
    }])
    .sort((a, b) => {
      if (b.totalCents !== a.totalCents) return b.totalCents - a.totalCents
      return a.firstBidAt.getTime() - b.firstBidAt.getTime()
    })

  const projectedRank = simulated.findIndex(entry => entry.gameId === gameId) + 1
  return { projectedRank, projectedTotalCents, currentTotalCents }
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

  const [sponsorPaidStats] = await db
    .select({
      liveSponsors: sql<number>`count(distinct ${bids.gameId})`.mapWith(Number),
      allTimeSponsors: sql<number>`count(distinct ${bids.displayName})`.mapWith(Number),
      sponsorClicks: sql<number>`coalesce(sum(${bids.clickCount}), 0)`.mapWith(Number),
      sponsorRevenueCents: sql<number>`coalesce(sum(${bids.amount}), 0)`.mapWith(Number)
    })
    .from(bids)
    .where(and(eq(bids.status, 'paid'), eq(bids.bidType, 'sponsor')))

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
    liveSponsors: sponsorPaidStats?.liveSponsors ?? 0,
    allTimeSponsors: sponsorPaidStats?.allTimeSponsors ?? 0,
    livePlayers: livePlayerStats?.livePlayers ?? 0,
    allTimePlayers: paidStats?.allTimePlayers ?? 0,
    sponsorClicks: sponsorPaidStats?.sponsorClicks ?? 0,
    sponsorRevenueCents: sponsorPaidStats?.sponsorRevenueCents ?? 0
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
      adLink: bids.adLink,
      adImage: bids.adImage,
      clickCount: bids.clickCount,
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
    const sponsorBids = gameBids.filter(bid => bid.bidType === 'sponsor')
    const winningSponsor = pickWinningSponsorBid(sponsorBids)
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

    const sponsorCents = winningSponsor?.amount ?? 0
    const sponsorClaimCents = sponsorCents > 0
      ? sponsorCents + MIN_BID_CENTS
      : MIN_BID_CENTS

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
      sponsorCents,
      sponsorClaimCents,
      ad: winningSponsor
        ? {
            bidId: winningSponsor.id,
            title: winningSponsor.adTitle,
            description: winningSponsor.adDescription,
            link: winningSponsor.adLink,
            image: winningSponsor.adImage,
            clickCount: winningSponsor.clickCount,
            priceCents: winningSponsor.amount
          }
        : null,
      topContributor: toContributor(topBid ?? undefined),
      lastContributor: toContributor(latestBid),
      contributors: aggregateContributors(gameBids),
      nextExpiresAt: nextExpiry ? nextExpiry.toISOString() : null
    }
  }).filter((entry): entry is LeaderboardEntryPayload => entry !== null)
}

export async function incrementAdClick(bidId: string): Promise<string | null> {
  const db = useDb()

  const [bid] = await db
    .select({
      id: bids.id,
      adLink: bids.adLink,
      bidType: bids.bidType,
      status: bids.status
    })
    .from(bids)
    .where(eq(bids.id, bidId))
    .limit(1)

  if (!bid || bid.status !== 'paid' || bid.bidType !== 'sponsor' || !bid.adLink) {
    return null
  }

  await db
    .update(bids)
    .set({ clickCount: sql`${bids.clickCount} + 1` })
    .where(eq(bids.id, bidId))

  return bid.adLink
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
    totalCents,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    contributor: maskContributor(row.displayName),
    sponsorAdTitle: row.bidType === 'sponsor' ? row.adTitle : null
  }
}
