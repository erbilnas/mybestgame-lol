import {
  buildLeaderboardEntries,
  getLeaderboardTotalsWithoutExpire,
  maybeExpireStaleBids,
  type LeaderboardEntryPayload,
  type LeaderboardTotal
} from './bidding'

const ENTRIES_TTL_MS = 15_000
const SLIM_CONTRIBUTOR_CAP = 5

let entriesCache: { data: LeaderboardEntryPayload[], expiresAt: number } | null = null
let totalsCache: { data: LeaderboardTotal[], expiresAt: number } | null = null

export function invalidateBoardCache(): void {
  entriesCache = null
  totalsCache = null
}

export async function getCachedLeaderboardTotals(options?: { bypassCache?: boolean }): Promise<LeaderboardTotal[]> {
  if (await maybeExpireStaleBids()) {
    invalidateBoardCache()
  }

  if (!options?.bypassCache && totalsCache && Date.now() < totalsCache.expiresAt) {
    return totalsCache.data
  }

  const data = await getLeaderboardTotalsWithoutExpire()
  totalsCache = { data, expiresAt: Date.now() + ENTRIES_TTL_MS }
  return data
}

export async function getCachedLeaderboardEntries(): Promise<LeaderboardEntryPayload[]> {
  if (await maybeExpireStaleBids()) {
    invalidateBoardCache()
  }

  if (entriesCache && Date.now() < entriesCache.expiresAt) {
    return entriesCache.data
  }

  const totals = await getLeaderboardTotalsWithoutExpire()
  const data = await buildLeaderboardEntries(totals)
  entriesCache = { data, expiresAt: Date.now() + ENTRIES_TTL_MS }
  totalsCache = { data: totals, expiresAt: Date.now() + ENTRIES_TTL_MS }
  return data
}

export function slimLeaderboardEntry(entry: LeaderboardEntryPayload): LeaderboardEntryPayload {
  if (entry.rank <= 3) {
    return entry
  }

  return {
    ...entry,
    contributors: entry.contributors.slice(0, SLIM_CONTRIBUTOR_CAP),
    nextExpiresAt: null
  }
}

export async function getGameBoardPosition(gameId: number): Promise<{ rank: number | null, totalCents: number }> {
  const totals = await getCachedLeaderboardTotals()
  const index = totals.findIndex(entry => entry.gameId === gameId)
  if (index < 0) {
    return { rank: null, totalCents: 0 }
  }
  return { rank: index + 1, totalCents: totals[index]!.totalCents }
}

export function buildTopDirectors(entries: LeaderboardEntryPayload[], limit = 10): LeaderboardEntryPayload[] {
  return entries
    .filter(entry => entry.director)
    .sort((a, b) => (b.director?.priceCents ?? 0) - (a.director?.priceCents ?? 0))
    .slice(0, limit)
}
