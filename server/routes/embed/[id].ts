import { eq } from 'drizzle-orm'
import { games } from '../../database/schema'
import { useDb } from '../../database/index'
import { getCachedLeaderboardEntries, getGameBoardPosition } from '../../utils/board-cache'
import { getGameTotalCents } from '../../utils/bidding'
import { renderGameEmbedSvg } from '../../utils/embed-badge'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')?.replace(/\.svg$/i, '') ?? ''
  const gameId = Number(rawId)

  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game id' })
  }

  const db = useDb()
  const [game] = await db
    .select({ id: games.id, title: games.title })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  const entries = await getCachedLeaderboardEntries()
  const entry = entries.find(item => item.gameId === gameId)
  const board = entry ? { rank: entry.rank, totalCents: entry.totalCents } : await getGameBoardPosition(gameId)
  const title = game?.title ?? entry?.title ?? `Game ${gameId}`
  const totalCents = entry?.totalCents ?? (game ? await getGameTotalCents(gameId) : board.totalCents)
  const rank = entry?.rank ?? board.rank

  setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=60')

  return renderGameEmbedSvg({ title, rank, totalCents })
})
