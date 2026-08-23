import { eq } from 'drizzle-orm'
import { useDb } from '../../database/index'
import { games } from '../../database/schema'
import { fetchGameDetails } from '../../utils/igdb'
import { getGameBoardPosition } from '../../utils/board-cache'
import { getGameDirectorMessage } from '../../utils/bidding'

export default defineEventHandler(async (event) => {
  const gameId = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game id' })
  }

  const db = useDb()
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  if (!game) {
    throw createError({ statusCode: 404, statusMessage: 'Game not found' })
  }

  const [igdbGame, board, director] = await Promise.all([
    fetchGameDetails(gameId, game.slug).catch(() => null),
    getGameBoardPosition(gameId),
    getGameDirectorMessage(gameId)
  ])

  if (igdbGame?.summary && igdbGame.summary !== game.summary) {
    await db
      .update(games)
      .set({
        summary: igdbGame.summary,
        title: igdbGame.title,
        slug: igdbGame.slug,
        coverUrl: igdbGame.coverUrl ?? game.coverUrl
      })
      .where(eq(games.id, gameId))
  }

  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=600')

  return {
    id: game.id,
    title: igdbGame?.title ?? game.title,
    slug: igdbGame?.slug ?? game.slug,
    coverUrl: igdbGame?.coverUrl ?? game.coverUrl,
    summary: igdbGame?.summary ?? game.summary,
    storyline: igdbGame?.storyline ?? null,
    screenshots: igdbGame?.screenshots ?? [],
    artworks: igdbGame?.artworks ?? [],
    releaseDate: igdbGame?.releaseDate ?? null,
    genres: igdbGame?.genres ?? [],
    platforms: igdbGame?.platforms ?? [],
    gameModes: igdbGame?.gameModes ?? [],
    developers: igdbGame?.developers ?? [],
    publishers: igdbGame?.publishers ?? [],
    rating: igdbGame?.rating ?? null,
    ratingCount: igdbGame?.ratingCount ?? 0,
    igdbUrl: igdbGame?.igdbUrl ?? null,
    board: {
      rank: board.rank,
      totalCents: board.totalCents,
      directorCents: director?.amount ?? 0,
      directorTitle: director?.adTitle ?? null
    }
  }
})
