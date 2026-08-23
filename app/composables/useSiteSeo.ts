type SiteLocale = 'en' | 'tr'
type OgType = 'website' | 'article'

interface SiteSeoOptions {
  title?: MaybeRefOrGetter<string>
  description?: MaybeRefOrGetter<string>
  keywords?: MaybeRefOrGetter<string | undefined>
  ogImage?: MaybeRefOrGetter<string | undefined>
  ogType?: MaybeRefOrGetter<OgType>
  robots?: MaybeRefOrGetter<string>
  jsonLd?: MaybeRefOrGetter<Record<string, unknown> | Record<string, unknown>[] | undefined>
}

const SITE_NAME = 'mybestgame.lol'

export function useSiteSeo(options: SiteSeoOptions = {}) {
  const config = useRuntimeConfig()
  const route = useRoute()
  const { locale, locales } = useI18n()
  const switchLocalePath = useSwitchLocalePath()

  const siteUrl = computed(() => String(config.public.siteUrl).replace(/\/$/, ''))

  const canonicalPath = computed(() => route.path.replace(/\/+$/, '') || '/')
  const canonicalUrl = computed(() => `${siteUrl.value}${canonicalPath.value}`)
  const defaultOgImage = computed(() => `${siteUrl.value}/og-default.png`)

  const resolvedOgImage = computed(() => {
    const image = toValue(options.ogImage)
    if (!image) return defaultOgImage.value
    if (/^https?:\/\//i.test(image)) return image
    return `${siteUrl.value}${image.startsWith('/') ? image : `/${image}`}`
  })

  const hreflangLinks = computed(() => {
    const available = locales.value as Array<{ code: SiteLocale, language?: string }>
    const links = available.map((entry) => ({
      rel: 'alternate' as const,
      hreflang: entry.language ?? entry.code,
      href: `${siteUrl.value}${switchLocalePath(entry.code)}`
    }))

    links.push({
      rel: 'alternate' as const,
      hreflang: 'x-default',
      href: `${siteUrl.value}${switchLocalePath('en')}`
    })
    return links
  })

  useHead({
    htmlAttrs: {
      lang: () => locale.value
    },
    link: () => [
      { rel: 'canonical', href: canonicalUrl.value },
      ...hreflangLinks.value,
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' }
    ],
    meta: [
      { name: 'theme-color', content: '#e11d2e' },
      { name: 'application-name', content: SITE_NAME },
      { name: 'apple-mobile-web-app-title', content: 'mybestgame' }
    ]
  })

  useSeoMeta({
    title: options.title,
    description: options.description,
    ogTitle: options.title,
    ogDescription: options.description,
    ogType: options.ogType ?? 'website',
    ogSiteName: SITE_NAME,
    ogUrl: () => canonicalUrl.value,
    ogLocale: () => (locale.value === 'tr' ? 'tr_TR' : 'en_US'),
    ogLocaleAlternate: () => (locale.value === 'tr' ? ['en_US'] : ['tr_TR']),
    ogImage: () => resolvedOgImage.value,
    ogImageAlt: () => `${SITE_NAME} — pay-to-rank video game leaderboard`,
    twitterCard: 'summary_large_image',
    twitterTitle: options.title,
    twitterDescription: options.description,
    twitterImage: () => resolvedOgImage.value,
    robots: options.robots ?? 'index, follow, max-image-preview:large'
  })

  useHead(() => {
    const keywords = toValue(options.keywords)
    if (!keywords) return {}
    return {
      meta: [{ name: 'keywords', content: keywords }]
    }
  })

  useHead(() => {
    const jsonLd = toValue(options.jsonLd)
    if (!jsonLd) return {}
    const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd]
    return {
      script: items.map(item => ({
        type: 'application/ld+json',
        innerHTML: JSON.stringify(item)
      }))
    }
  })

  return {
    siteUrl,
    canonicalUrl,
    defaultOgImage
  }
}
