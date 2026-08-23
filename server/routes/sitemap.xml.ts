const STATIC_PATHS = [
  '/',
  '/privacy',
  '/terms',
  '/gdpr',
  '/cookies',
  '/refunds'
] as const

const LOCALE_CODES = ['en', 'tr'] as const

function localizedPath(locale: string, path: string) {
  if (locale === 'en') return path
  return path === '/' ? '/tr' : `/tr${path}`
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl).replace(/\/$/, '')
  const lastmod = new Date().toISOString().slice(0, 10)

  const urls = LOCALE_CODES.flatMap((locale) =>
    STATIC_PATHS.map((path) => {
      const loc = `${siteUrl}${localizedPath(locale, path)}`
      const priority = path === '/' ? '1.0' : '0.5'
      const changefreq = path === '/' ? 'hourly' : 'monthly'
      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        '  </url>'
      ].join('\n')
    })
  )

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>'
  ].join('\n')
})
