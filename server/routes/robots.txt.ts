export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl).replace(/\/$/, '')

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /success',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`
  ].join('\n')
})
