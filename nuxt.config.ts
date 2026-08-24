// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxt/image'
  ],

  i18n: {
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'tr', language: 'tr-TR', name: 'Türkçe', file: 'tr.json' }
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    langDir: 'locales'
  },

  colorMode: {
    preference: 'light',
    fallback: 'light'
  },

  devtools: {
    enabled: process.env.NODE_ENV === 'development'
  },

  css: ['~/assets/css/main.css'],

  fonts: {
    families: [
      { name: 'Pally', provider: 'fontshare', weights: [400, 700] },
      { name: 'Switzer', provider: 'fontshare', weights: [400, 500, 600, 700] }
    ]
  },

  icon: {
    clientBundle: {
      scan: true,
      sizeLimitKb: 512
    }
  },

  image: {
    domains: ['images.igdb.com']
  },

  runtimeConfig: {
    twitchClientId: '',
    twitchClientSecret: '',
    polarAccessToken: '',
    polarWebhookSecret: '',
    polarProductId: '',
    turnstileSecretKey: '',
    deviceCookieSecret: '',
    /** Set "true" only behind Cloudflare / a reverse proxy that strips client X-Forwarded-For. */
    trustProxy: '',
    databaseUrl: './data/mybestgame.db',
    /** Optional Discord incoming webhook for crown takeovers + daily crown post. */
    discordWebhookUrl: '',
    public: {
      siteUrl: 'http://localhost:3000',
      turnstileSiteKey: '',
      polarServer: 'sandbox'
    }
  },

  nitro: {
    experimental: {
      tasks: true
    },
    scheduledTasks: {
      '0 15 * * *': ['crown-daily']
    },
    routeRules: {
      '/api/webhooks/polar': {
        // @ts-expect-error Nitro supports bodyParser at runtime for raw-body webhook verification
        bodyParser: false
      },
      '/api/home': {
        headers: {
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=30'
        }
      },
      '/api/leaderboard': {
        headers: {
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=30'
        }
      },
      '/api/stats': {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
        }
      },
      '/api/games/**': {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
        }
      },
      '/embed/**': {
        headers: {
          'Cache-Control': 'public, max-age=60'
        }
      }
    }
  },

  vite: {
    server: {
      allowedHosts: [
        'localhost',
        '.loca.lt',
        '.ngrok-free.app',
        '.ngrok.io',
        '.trycloudflare.com'
      ]
    }
  },

  compatibilityDate: '2026-06-30'
})
