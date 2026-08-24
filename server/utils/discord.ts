export interface DiscordTakeoverNotice {
  gameTitle: string
  gameSlug?: string | null
  fromRank: number | null
  toRank: number
  contributor: string
  amountCents: number
}

function formatDollars(cents: number): string {
  return `$${Math.round(cents / 100)}`
}

function siteBaseUrl(): string {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl).replace(/\/$/, '')
}

function webhookUrl(): string | null {
  const config = useRuntimeConfig()
  const url = String(config.discordWebhookUrl || '').trim()
  return url || null
}

/** Fire-and-forget Discord notify. Never throws to callers. */
export function notifyDiscordTakeover(notice: DiscordTakeoverNotice): void {
  const url = webhookUrl()
  if (!url) return

  const site = siteBaseUrl()
  const gameUrl = notice.gameSlug
    ? `${site}/is/${encodeURIComponent(notice.gameSlug)}`
    : site
  const fromLabel = notice.fromRank && notice.fromRank > 0 ? `#${notice.fromRank}` : 'off the board'
  const amount = formatDollars(notice.amountCents)

  const body = {
    content: null as string | null,
    embeds: [
      {
        title: `New #1: ${notice.gameTitle}`,
        description: [
          `**${notice.gameTitle}** took the crown (${fromLabel} → #${notice.toRank}).`,
          `Contributor: ${notice.contributor || 'anonymous'} · ${amount}`,
          `[View on mybestgame.lol](${gameUrl})`
        ].join('\n'),
        url: gameUrl,
        color: 0xf5b800
      }
    ]
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => {
    // ponytail: Discord outages must never break bid fulfillment
  })
}

/** Post daily crown PNG (multipart). Returns false if skipped or failed. */
export async function postDiscordCrownPng(options: {
  filename: string
  png: Buffer
  caption: string
}): Promise<boolean> {
  const url = webhookUrl()
  if (!url) return false

  try {
    const form = new FormData()
    form.append('payload_json', JSON.stringify({ content: options.caption }))
    form.append(
      'files[0]',
      new Blob([new Uint8Array(options.png)], { type: 'image/png' }),
      options.filename
    )

    const res = await fetch(url, { method: 'POST', body: form })
    return res.ok
  } catch {
    return false
  }
}
