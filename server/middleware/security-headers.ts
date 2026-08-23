const EMBED_PATH_RE = /^\/(embed|api\/embed|api\/og)\b/

export default defineEventHandler((event) => {
  const path = event.path ?? ''
  const isEmbed = EMBED_PATH_RE.test(path)

  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  if (process.env.NODE_ENV === 'production') {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  // Embed badges / OG images must be frameable; everything else is locked down.
  if (!isEmbed) {
    setHeader(event, 'X-Frame-Options', 'DENY')
  }

  const frameAncestors = isEmbed ? '*' : "'none'"
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://cdn.fontshare.com https://api.fontshare.com",
    "connect-src 'self' https://challenges.cloudflare.com https://api.polar.sh https://sandbox-api.polar.sh",
    "frame-src https://challenges.cloudflare.com https://polar.sh https://sandbox.polar.sh",
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self' https://polar.sh https://sandbox.polar.sh"
  ].join('; ')

  setHeader(event, 'Content-Security-Policy', csp)
})
