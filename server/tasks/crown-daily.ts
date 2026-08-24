import { expireStaleBids } from '../utils/bidding'
import { getCachedLeaderboardEntries, invalidateBoardCache } from '../utils/board-cache'
import { renderCrownCardPng } from '../utils/crown-card'
import { postDiscordCrownPng } from '../utils/discord'

export default defineTask({
  meta: {
    name: 'crown-daily',
    description: 'Post the current #1 crown PNG to Discord'
  },
  async run() {
    await expireStaleBids()
    invalidateBoardCache()

    const entries = await getCachedLeaderboardEntries()
    const crown = entries[0]

    if (!crown) {
      return { result: 'empty-board' }
    }

    const dateLabel = new Date().toISOString().slice(0, 10)
    const png = renderCrownCardPng({
      title: crown.title,
      totalCents: crown.totalCents,
      dateLabel
    })

    const config = useRuntimeConfig()
    const siteUrl = String(config.public.siteUrl).replace(/\/$/, '')
    const gameUrl = crown.slug
      ? `${siteUrl}/is/${encodeURIComponent(crown.slug)}`
      : siteUrl
    const dollars = `$${Math.round(crown.totalCents / 100)}`
    const caption = [
      `Daily crown · ${dateLabel}`,
      `**${crown.title}** holds #1 with ${dollars} stacked.`,
      gameUrl
    ].join('\n')

    const posted = await postDiscordCrownPng({
      filename: `crown-${dateLabel}.png`,
      png,
      caption
    })

    return {
      result: posted ? 'posted' : 'skipped-or-failed',
      gameId: crown.gameId,
      title: crown.title
    }
  }
})
