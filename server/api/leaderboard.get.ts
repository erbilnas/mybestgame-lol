import {
  buildTopDirectors,
  getCachedLeaderboardEntries,
  slimLeaderboardEntry
} from '../utils/board-cache'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(
    Math.max(Number(query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)
  const q = String(query.q ?? '').trim().toLowerCase()

  const all = await getCachedLeaderboardEntries()
  // Search only ranks 4+ so the podium (1–3) stays pinned on the client.
  const pool = q ? all.filter(entry => entry.rank > 3) : all
  const filtered = q
    ? pool.filter(entry =>
        entry.title.toLowerCase().includes(q) || entry.slug.toLowerCase().includes(q)
      )
    : pool

  const entries = filtered
    .slice(offset, offset + limit)
    .map(slimLeaderboardEntry)
  const total = filtered.length

  const payload: {
    entries: typeof entries
    total: number
    offset: number
    limit: number
    hasMore: boolean
    topDirectors?: typeof entries
  } = {
    entries,
    total,
    offset,
    limit,
    hasMore: offset + entries.length < total
  }

  if (offset === 0 && !q) {
    payload.topDirectors = buildTopDirectors(all).map(slimLeaderboardEntry)
  }

  setResponseHeader(event, 'Cache-Control', 'public, max-age=15, stale-while-revalidate=30')

  return payload
})
