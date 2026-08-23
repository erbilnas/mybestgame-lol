import { eq } from 'drizzle-orm'
import { games } from '../../database/schema'
import { useDb } from '../../database/index'
import { getCachedLeaderboardEntries, getGameBoardPosition } from '../../utils/board-cache'
import { getGameTotalCents } from '../../utils/bidding'

export default defineEventHandler(async (event) => {
  const gameId = Number(getRouterParam(event, 'id'))
  const config = useRuntimeConfig()

  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game id' })
  }

  const db = useDb()
  const [game] = await db
    .select({ id: games.id, title: games.title, slug: games.slug })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  const entries = await getCachedLeaderboardEntries()
  const entry = entries.find(item => item.gameId === gameId)
  const board = entry ? { rank: entry.rank, totalCents: entry.totalCents } : await getGameBoardPosition(gameId)

  return {
    gameId,
    title: game?.title ?? entry?.title ?? null,
    slug: game?.slug ?? entry?.slug ?? null,
    rank: entry?.rank ?? board.rank,
    totalCents: entry?.totalCents ?? (game ? await getGameTotalCents(gameId) : board.totalCents),
    siteUrl: String(config.public.siteUrl).replace(/\/$/, ''),
    svgPath: `/embed/${gameId}.svg`
  }
})
