import { and, ne, sql } from 'drizzle-orm'
import { useDb } from '../database/index'
import { games } from '../database/schema'

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

function urlEntry(options: {
  loc: string
  lastmod: string
  changefreq: string
  priority: string
}) {
  return [
    '  <url>',
    `    <loc>${escapeXml(options.loc)}</loc>`,
    `    <lastmod>${options.lastmod}</lastmod>`,
    `    <changefreq>${options.changefreq}</changefreq>`,
    `    <priority>${options.priority}</priority>`,
    '  </url>'
  ].join('\n')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl).replace(/\/$/, '')
  const lastmod = new Date().toISOString().slice(0, 10)

  const staticUrls = LOCALE_CODES.flatMap((locale) =>
    STATIC_PATHS.map((path) =>
      urlEntry({
        loc: `${siteUrl}${localizedPath(locale, path)}`,
        lastmod,
        changefreq: path === '/' ? 'hourly' : 'monthly',
        priority: path === '/' ? '1.0' : '0.5'
      })
    )
  )

  const db = useDb()
  const gameRows = await db
    .select({ slug: games.slug })
    .from(games)
    .where(and(ne(games.slug, ''), sql`length(trim(${games.slug})) > 0`))
    .limit(5000)

  const seoUrls = LOCALE_CODES.flatMap((locale) =>
    gameRows.map((row) =>
      urlEntry({
        loc: `${siteUrl}${localizedPath(locale, `/is/${encodeURIComponent(row.slug)}`)}`,
        lastmod,
        changefreq: 'daily',
        priority: '0.7'
      })
    )
  )

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticUrls,
    ...seoUrls,
    '</urlset>'
  ].join('\n')
})
