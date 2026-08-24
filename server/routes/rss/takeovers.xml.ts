import { getTakeoverFeedEvents } from '../../utils/board-events'

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDollars(cents: number): string {
  return `$${Math.round(cents / 100)}`
}

function itemTitle(event: Awaited<ReturnType<typeof getTakeoverFeedEvents>>[number]): string {
  if (event.type === 'director_takeover') {
    const director = event.payload.directorTitle || 'Game Director Message'
    return `${event.gameTitle}: new Game Director — ${director}`
  }

  const from = event.payload.fromRank && event.payload.fromRank > 0
    ? `#${event.payload.fromRank}`
    : 'off the board'
  const to = event.payload.toRank ?? event.payload.rank ?? '?'
  return `${event.gameTitle}: ${from} → #${to}`
}

function itemDescription(event: Awaited<ReturnType<typeof getTakeoverFeedEvents>>[number]): string {
  const parts: string[] = []
  if (event.payload.contributor) {
    parts.push(`Contributor: ${event.payload.contributor}`)
  }
  if (event.payload.amountCents) {
    parts.push(formatDollars(event.payload.amountCents))
  }
  if (event.type === 'director_takeover' && event.payload.directorTitle) {
    parts.push(`Message: ${event.payload.directorTitle}`)
  }
  return parts.join(' · ') || event.gameTitle
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl).replace(/\/$/, '')
  const events = await getTakeoverFeedEvents(50)

  const items = events.map((entry) => {
    const link = entry.gameSlug
      ? `${siteUrl}/is/${encodeURIComponent(entry.gameSlug)}`
      : siteUrl
    const pubDate = entry.createdAt.toUTCString()

    return [
      '    <item>',
      `      <title>${escapeXml(itemTitle(entry))}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="false">${escapeXml(entry.id)}</guid>`,
      `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
      `      <description>${escapeXml(itemDescription(entry))}</description>`,
      '    </item>'
    ].join('\n')
  })

  setHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=60')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>mybestgame.lol takeovers</title>',
    `    <link>${escapeXml(siteUrl)}</link>`,
    '    <description>Live rank and Game Director takeovers on mybestgame.lol</description>',
    `    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`,
    ...items,
    '  </channel>',
    '</rss>'
  ].join('\n')
})
