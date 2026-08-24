import { Resvg } from '@resvg/resvg-js'
import { formatBadgeDollars } from './embed-badge'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function rankLabel(rank: number | null): string {
  return rank && rank > 0 ? `#${rank}` : '—'
}

function rankFontSize(rank: number | null): number {
  const label = rankLabel(rank)
  if (label.length <= 2) return 48
  if (label.length === 3) return 40
  return 32
}

export function renderBoardShareSvg(options: {
  title: string
  totalCents: number
  rank: number | null
  kicker: string
  dateLabel?: string
}): string {
  const titleRaw = options.title.length > 28
    ? `${options.title.slice(0, 28).trimEnd()}…`
    : options.title
  const title = escapeXml(titleRaw)
  const total = escapeXml(formatBadgeDollars(options.totalCents))
  const dateLabel = escapeXml(options.dateLabel ?? new Date().toISOString().slice(0, 10))
  const kicker = escapeXml(options.kicker)
  const rankText = escapeXml(rankLabel(options.rank))
  const isCrown = options.rank === 1
  const badgeFill = isCrown ? '#f5b800' : '#e11d2e'
  const stacked = options.rank && options.rank > 0
    ? `${total} stacked`
    : 'not on the board yet'
  const aria = escapeXml(
    `${options.kicker}: ${options.title} · ${rankLabel(options.rank)} · ${formatBadgeDollars(options.totalCents)} on mybestgame.lol`
  )

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="${aria}">
  <defs>
    <linearGradient id="crownSky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff8e0"/>
      <stop offset="45%" stop-color="#f4efe6"/>
      <stop offset="100%" stop-color="#e8a598"/>
    </linearGradient>
    <pattern id="crownDots" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="1.4" cy="1.4" r="1.2" fill="#1a1814" fill-opacity="0.07"/>
    </pattern>
  </defs>

  <rect width="960" height="540" fill="url(#crownSky)"/>
  <rect width="960" height="540" fill="url(#crownDots)"/>

  <rect x="48" y="48" width="864" height="444" rx="36" fill="#fffdf8" stroke="#1a1814" stroke-width="4"/>

  <text x="480" y="120" text-anchor="middle" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="22" font-weight="700" letter-spacing="0.2em" fill="#c49200">${kicker}</text>
  <text x="480" y="158" text-anchor="middle" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="18" fill="#5c564c">${dateLabel}</text>

  <circle cx="480" cy="250" r="54" fill="${badgeFill}" stroke="#1a1814" stroke-width="4"/>
  <text x="480" y="250" text-anchor="middle" dominant-baseline="central" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="${rankFontSize(options.rank)}" font-weight="800" fill="${isCrown ? '#1a1814' : '#fffdf8'}">${rankText}</text>

  <text x="480" y="360" text-anchor="middle" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="44" font-weight="800" fill="#1a1814">${title}</text>
  <text x="480" y="410" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="24" font-weight="700" fill="#5c564c">${escapeXml(stacked)}</text>
  <text x="480" y="450" text-anchor="middle" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="20" font-weight="700" fill="#1a1814">mybest<tspan fill="#e11d2e">game</tspan>.lol</text>
</svg>`
}

export function renderBoardSharePng(options: {
  title: string
  totalCents: number
  rank: number | null
  kicker: string
  dateLabel?: string
}): Buffer {
  const svg = renderBoardShareSvg(options)
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 960 }
  })
  return Buffer.from(resvg.render().asPng())
}

export function renderCrownCardSvg(options: {
  title: string
  totalCents: number
  dateLabel?: string
}): string {
  return renderBoardShareSvg({
    ...options,
    rank: 1,
    kicker: 'DAILY CROWN'
  })
}

export function renderCrownCardPng(options: {
  title: string
  totalCents: number
  dateLabel?: string
}): Buffer {
  return renderBoardSharePng({
    ...options,
    rank: 1,
    kicker: 'DAILY CROWN'
  })
}
