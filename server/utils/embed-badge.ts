function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function formatBadgeDollars(cents: number): string {
  return `$${Math.round(cents / 100)}`
}

export function renderGameEmbedSvg(options: {
  title: string
  rank: number | null
  totalCents: number
}): string {
  const title = escapeXml(options.title.slice(0, 28) + (options.title.length > 28 ? '…' : ''))
  const rankLabel = options.rank ? `#${options.rank}` : '—'
  const total = escapeXml(formatBadgeDollars(options.totalCents))

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="72" viewBox="0 0 320 72" role="img" aria-label="${title} on mybestgame.lol">
  <rect width="320" height="72" rx="12" fill="#f4efe6" stroke="#1a1814" stroke-width="2"/>
  <rect x="10" y="10" width="52" height="52" rx="10" fill="#e8a598" stroke="#1a1814" stroke-width="2"/>
  <text x="36" y="44" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="700" fill="#1a1814">${rankLabel}</text>
  <text x="76" y="32" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="700" fill="#1a1814">${title}</text>
  <text x="76" y="52" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" fill="#5c564c">${total} stacked · mybestgame.lol</text>
</svg>`
}

export function renderBidPlaqueSvg(options: {
  title: string
  rank: number | null
  amountCents: number
  contributor: string
}): string {
  const titleRaw = options.title.length > 22 ? `${options.title.slice(0, 22).trimEnd()}…` : options.title
  const title = escapeXml(titleRaw)
  const rankNum = options.rank && options.rank > 0 ? String(options.rank) : '—'
  const rankLabel = options.rank && options.rank > 0 ? `#${options.rank}` : '—'
  const amount = escapeXml(formatBadgeDollars(options.amountCents))
  const contributor = escapeXml(options.contributor.slice(0, 22))
  const isCrown = options.rank === 1
  const accent = isCrown ? '#f5b800' : '#e11d2e'
  const accentDeep = isCrown ? '#c49200' : '#c41222'
  const railFill = isCrown ? '#fff8e0' : '#fff1f1'
  const aria = escapeXml(`${rankLabel} ${options.title} · ${formatBadgeDollars(options.amountCents)} on mybestgame.lol`)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240" role="img" aria-label="${aria}">
  <defs>
    <linearGradient id="plaquePaper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#f7f8fc"/>
      <stop offset="100%" stop-color="#e8eef8"/>
    </linearGradient>
    <linearGradient id="plaqueGlow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <pattern id="plaqueDots" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="1.2" cy="1.2" r="1.1" fill="#1a1f2c" fill-opacity="0.08"/>
    </pattern>
    <clipPath id="plaqueClip">
      <path d="M28 12 H452 Q468 12 468 28 V100 Q456 112 456 120 Q456 128 468 140 V212 Q468 228 452 228 H28 Q12 228 12 212 V140 Q24 128 24 120 Q24 112 12 100 V28 Q12 12 28 12 Z"/>
    </clipPath>
  </defs>

  <!-- Ticket silhouette -->
  <path d="M28 12 H452 Q468 12 468 28 V100 Q456 112 456 120 Q456 128 468 140 V212 Q468 228 452 228 H28 Q12 228 12 212 V140 Q24 128 24 120 Q24 112 12 100 V28 Q12 12 28 12 Z" fill="url(#plaquePaper)" stroke="#1a1f2c" stroke-width="2.5"/>

  <g clip-path="url(#plaqueClip)">
    <rect width="480" height="240" fill="url(#plaqueDots)" opacity="0.9"/>
    <rect x="0" y="0" width="480" height="90" fill="url(#plaqueGlow)"/>

    <!-- Rank rail -->
    <path d="M12 28 V100 Q24 112 24 120 Q24 128 12 140 V212 Q12 228 28 228 H118 V28 Q118 12 102 12 H28 Q12 12 12 28 Z" fill="${railFill}"/>
    <rect x="118" y="12" width="3" height="216" fill="${accent}"/>

    <text x="65" y="78" text-anchor="middle" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="13" font-weight="700" letter-spacing="0.12em" fill="${accentDeep}">RANK</text>
    <text x="65" y="148" text-anchor="middle" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="64" font-weight="800" fill="#1a1f2c">${escapeXml(rankNum)}</text>
    ${isCrown ? `<text x="65" y="178" text-anchor="middle" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="11" font-weight="700" letter-spacing="0.18em" fill="${accentDeep}">CROWN</text>` : ''}

    <!-- Wordmark -->
    <text x="146" y="48" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="15" font-weight="700" fill="#1a1f2c">mybest<tspan fill="#e11d2e">game</tspan></text>
    <text x="146" y="68" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" letter-spacing="0.16em" fill="#5c6578">BID PLAQUE</text>

    <!-- Title -->
    <text x="146" y="128" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="28" font-weight="800" fill="#1a1f2c">${title}</text>

    <!-- Amount chip -->
    <rect x="146" y="152" width="150" height="40" rx="12" fill="${accent}" stroke="#1a1f2c" stroke-width="2"/>
    <text x="221" y="178" text-anchor="middle" font-family="ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif" font-size="22" font-weight="800" fill="#ffffff">${amount}</text>

    <text x="310" y="178" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" fill="#5c6578">by <tspan font-weight="700" fill="#1a1f2c">${contributor}</tspan></text>

    <!-- Stub perforations -->
    <g fill="#1a1f2c" fill-opacity="0.18">
      <circle cx="12" cy="108" r="2.2"/><circle cx="12" cy="120" r="2.2"/><circle cx="12" cy="132" r="2.2"/>
      <circle cx="468" cy="108" r="2.2"/><circle cx="468" cy="120" r="2.2"/><circle cx="468" cy="132" r="2.2"/>
    </g>
  </g>
</svg>`
}
