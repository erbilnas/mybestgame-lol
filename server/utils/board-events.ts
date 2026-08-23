import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { boardEvents, games, type BoardEventType } from '../database/schema'
import { useDb } from '../database/index'
import type { ActivityItem } from './bidding'

export interface BoardEventPayload {
  gameTitle: string
  contributor?: string
  amountCents?: number
  rank?: number
  fromRank?: number | null
  toRank?: number | null
  previousTitle?: string | null
  previousDirectorTitle?: string | null
  directorTitle?: string | null
  leftBoard?: boolean
}

export async function insertBoardEvent(options: {
  type: BoardEventType
  gameId: number
  bidId?: string | null
  payload: BoardEventPayload
}) {
  const db = useDb()
  await db.insert(boardEvents).values({
    id: randomUUID(),
    type: options.type,
    gameId: options.gameId,
    bidId: options.bidId ?? null,
    payload: JSON.stringify(options.payload)
  })
}

export async function getRecentBoardEvents(limit = 8): Promise<ActivityItem[]> {
  const db = useDb()

  const rows = await db
    .select({
      id: boardEvents.id,
      type: boardEvents.type,
      gameId: boardEvents.gameId,
      payload: boardEvents.payload,
      createdAt: boardEvents.createdAt,
      gameTitle: games.title
    })
    .from(boardEvents)
    .innerJoin(games, eq(boardEvents.gameId, games.id))
    .orderBy(desc(boardEvents.createdAt))
    .limit(limit)

  return rows.map((row) => {
    let payload: BoardEventPayload = { gameTitle: row.gameTitle }
    try {
      payload = { ...payload, ...JSON.parse(row.payload) as BoardEventPayload }
    } catch {
      // ponytail: bad payload rows stay readable with game title only
    }

    // Legacy event rows may still carry old payload keys until re-emitted.
    const previousDirectorTitle = payload.previousDirectorTitle
      ?? (payload as { previousSponsorTitle?: string | null }).previousSponsorTitle
      ?? null
    const directorTitle = payload.directorTitle
      ?? (payload as { sponsorTitle?: string | null }).sponsorTitle
      ?? null

    return {
      type: row.type as ActivityItem['type'],
      gameId: row.gameId,
      gameTitle: payload.gameTitle || row.gameTitle,
      rank: payload.rank ?? payload.toRank ?? 0,
      amountCents: payload.amountCents ?? 0,
      contributor: payload.contributor ?? '',
      at: row.createdAt.toISOString(),
      detail: {
        fromRank: payload.fromRank ?? null,
        toRank: payload.toRank ?? null,
        previousTitle: payload.previousTitle ?? null,
        previousDirectorTitle,
        directorTitle,
        leftBoard: payload.leftBoard ?? false
      }
    }
  })
}
