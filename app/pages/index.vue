<script setup lang="ts">
import type { BidModalPreset } from '~/components/BidModal.vue'
import type { LeaderboardEntry } from '~/components/Leaderboard.vue'
import type { SiteStatsData } from '~/components/SiteStats.vue'
import type { ActivityItem } from '~/components/ActivityFeed.vue'

const PAGE_SIZE = 50

interface LeaderboardPage {
  entries: LeaderboardEntry[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
  topDirectors?: LeaderboardEntry[]
}

interface HomePayload {
  stats: SiteStatsData | null
  activity: ActivityItem[]
  leaderboard: LeaderboardPage
}

const defaultLeaderboard = (): LeaderboardPage => ({
  entries: [],
  total: 0,
  offset: 0,
  limit: PAGE_SIZE,
  hasMore: false
})

const { t } = useI18n()
const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const openBidModal = inject<(preset?: BidModalPreset) => void>('openBidModal', () => {})
const gameDetailOpen = ref(false)
const selectedGameId = ref<number | null>(null)
const heroBiddingRef = ref<HTMLElement | null>(null)
const heroBiddingVisible = useState('hero-bidding-visible', () => true)
const takeoverBanner = ref<string | null>(null)

const accumulated = ref<LeaderboardEntry[]>([])
const hasMore = ref(false)
const loadingMore = ref(false)
const searchQuery = ref('')
const topDirectors = ref<LeaderboardEntry[]>([])
/** Top 3 stay visible while searching ranks 4+. */
const pinnedPodium = ref<LeaderboardEntry[]>([])

const { data: homeData, pending: homePending, refresh: refreshHome } = await useFetch<HomePayload>(
  '/api/home',
  {
    query: { limit: PAGE_SIZE },
    default: () => ({
      stats: null,
      activity: [],
      leaderboard: defaultLeaderboard()
    })
  }
)

const statsData = computed(() => ({
  stats: homeData.value?.stats ?? null,
  activity: homeData.value?.activity ?? []
}))

const leaderboardData = computed(() => homeData.value?.leaderboard ?? defaultLeaderboard())

function syncPodium(entries: LeaderboardEntry[]) {
  pinnedPodium.value = entries.filter(entry => entry.rank <= 3)
}

watch(
  leaderboardData,
  (page) => {
    if (!page) return
    if (!searchQuery.value) {
      accumulated.value = page.entries
      syncPodium(page.entries)
      hasMore.value = page.hasMore
    }
    if (page.topDirectors) topDirectors.value = page.topDirectors
  },
  { immediate: true }
)

const AUTO_REFRESH_SECONDS = 60
const secondsUntilRefresh = ref(AUTO_REFRESH_SECONDS)
const statsPending = computed(() => homePending.value && !homeData.value?.stats)
const leaderboardPending = homePending
const leaderboardLoading = computed(
  () => homePending.value && accumulated.value.length === 0 && !searchQuery.value
)

const siteUrl = computed(() => String(config.public.siteUrl).replace(/\/$/, ''))

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: () => JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': `${siteUrl.value}/#website`,
            url: siteUrl.value,
            name: 'mybestgame.lol',
            description: t('seo.description'),
            inLanguage: ['en-US', 'tr-TR'],
            potentialAction: {
              '@type': 'SearchAction',
              target: `${siteUrl.value}${localePath('/')}?q={search_term_string}`,
              'query-input': 'required name=search_term_string'
            }
          },
          {
            '@type': 'Organization',
            '@id': `${siteUrl.value}/#organization`,
            name: 'mybestgame.lol',
            url: siteUrl.value,
            logo: `${siteUrl.value}/icon-512.png`
          }
        ]
      })
    }
  ]
})

function maybeShowTakeover(activity: ActivityItem[]) {
  const latest = activity[0]
  if (!latest || latest.type !== 'rank_takeover') return
  const toRank = latest.detail?.toRank ?? latest.rank
  if (toRank !== 1) return
  const ageMs = Date.now() - new Date(latest.at).getTime()
  if (ageMs > 2 * 60_000) return
  takeoverBanner.value = t('home.tookFirst', { game: latest.gameTitle })
}

async function refreshAll() {
  if (document.hidden || homePending.value || loadingMore.value) return
  searchQuery.value = ''
  await refreshHome()
  secondsUntilRefresh.value = AUTO_REFRESH_SECONDS
}

watch(
  () => statsData.value.activity,
  (activity) => {
    if (activity?.length) maybeShowTakeover(activity)
  },
  { immediate: true }
)

function openGameDetail(gameId: number) {
  selectedGameId.value = gameId
  gameDetailOpen.value = true
}

function openSupportGame(entry: LeaderboardEntry) {
  openBidModal({
    gameId: entry.gameId,
    title: entry.title,
    slug: entry.slug,
    coverUrl: entry.coverUrl
  })
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value || leaderboardPending.value) return
  loadingMore.value = true
  try {
    const offset = searchQuery.value
      ? Math.max(0, accumulated.value.length - pinnedPodium.value.length)
      : accumulated.value.length
    const page = await $fetch<LeaderboardPage>('/api/leaderboard', {
      query: {
        limit: PAGE_SIZE,
        offset,
        ...(searchQuery.value ? { q: searchQuery.value } : {})
      }
    })
    const seen = new Set(accumulated.value.map(entry => entry.gameId))
    for (const entry of page.entries) {
      if (!seen.has(entry.gameId)) accumulated.value.push(entry)
    }
    hasMore.value = page.hasMore
  } finally {
    loadingMore.value = false
  }
}

async function onSearch(query: string) {
  searchQuery.value = query
  loadingMore.value = true
  try {
    const page = await $fetch<LeaderboardPage>('/api/leaderboard', {
      query: {
        limit: PAGE_SIZE,
        offset: 0,
        ...(query ? { q: query } : {})
      }
    })
    if (query) {
      // API returns only rank 4+ matches; keep podium pinned.
      accumulated.value = [...pinnedPodium.value, ...page.entries]
    } else {
      accumulated.value = page.entries
      syncPodium(page.entries)
      if (page.topDirectors) topDirectors.value = page.topDirectors
    }
    hasMore.value = page.hasMore
  } finally {
    loadingMore.value = false
  }
}

let refreshTicker: ReturnType<typeof setInterval> | undefined
let heroObserver: IntersectionObserver | undefined

function onVisibilityChange() {
  if (!document.hidden && secondsUntilRefresh.value <= 0) {
    refreshAll()
  }
}

onMounted(() => {
  refreshTicker = setInterval(() => {
    if (document.hidden || homePending.value || loadingMore.value) return
    secondsUntilRefresh.value -= 1
    if (secondsUntilRefresh.value <= 0) refreshAll()
  }, 1000)

  document.addEventListener('visibilitychange', onVisibilityChange)

  const cancelledBidId = route.query.checkout === 'cancelled'
    ? String(route.query.bid_id ?? '')
    : ''
  if (cancelledBidId) {
    void $fetch('/api/bids/cancel', { query: { bid_id: cancelledBidId } }).finally(() => {
      const nextQuery = { ...route.query }
      delete nextQuery.checkout
      delete nextQuery.bid_id
      router.replace({ query: nextQuery })
    })
  }

  if (heroBiddingRef.value) {
    const hero = heroBiddingRef.value
    const syncHeroVisibility = () => {
      const rect = hero.getBoundingClientRect()
      heroBiddingVisible.value = rect.bottom > 0 && rect.top < window.innerHeight
    }

    syncHeroVisibility()

    heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroBiddingVisible.value = entry?.isIntersecting ?? false
      },
      { threshold: 0 }
    )
    heroObserver.observe(hero)
  }
})

onUnmounted(() => {
  if (refreshTicker) clearInterval(refreshTicker)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  heroObserver?.disconnect()
})
</script>

<template>
  <div class="playfield mx-auto max-w-6xl px-3 pb-12 pt-5 sm:px-6 sm:pt-8">
    <div
      v-if="takeoverBanner"
      class="mb-4 flex items-start justify-between gap-3 rounded-[1.25rem] border-2 border-[var(--play-rim)] bg-[var(--color-play-sun)]/35 px-3 py-3 sm:items-center sm:px-4"
      role="status"
    >
      <p class="min-w-0 font-display text-sm font-bold text-[var(--play-ink)] text-pretty sm:text-base">
        {{ takeoverBanner }}
      </p>
      <button
        type="button"
        class="min-h-[44px] min-w-[44px] shrink-0 text-xs font-semibold text-muted transition-colors hover:text-[var(--play-ink)]"
        @click="takeoverBanner = null"
      >
        {{ t('home.dismiss') }}
      </button>
    </div>

    <section
      ref="heroBiddingRef"
      class="relative mb-5 overflow-visible rounded-[1.5rem] border-2 border-[var(--play-rim)] bg-[var(--play-panel)] px-3 py-4 sm:mb-6 sm:px-6 sm:py-5"
    >
      <div class="relative z-[1] flex flex-col gap-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div class="min-w-0">
            <div class="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-1">
              <h1 class="font-display text-[1.75rem] font-bold leading-none text-[var(--play-ink)] sm:text-4xl">
                mybest<span class="text-primary">game</span>
              </h1>
              <p class="text-sm text-muted text-pretty">
                {{ t('home.tagline') }}
              </p>
            </div>
          </div>

          <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <SiteNavActions
              compact
              class="hidden sm:flex sm:!justify-end"
            />
            <UButton
              size="lg"
              class="arcade-cta w-full shrink-0 px-5 sm:w-auto sm:self-center"
              @click="openBidModal()"
            >
              {{ t('home.startBidding') }}
            </UButton>
          </div>
        </div>

        <SiteStats
          class="-mx-3 overflow-hidden sm:-mx-6"
          :stats="statsData?.stats ?? null"
          :loading="statsPending && !statsData?.stats"
        />

        <SiteNavActions
          compact
          class="w-full sm:hidden"
        />
      </div>
    </section>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start">
      <section class="min-w-0 space-y-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div class="min-w-0">
            <h2 class="font-display text-2xl font-bold text-[var(--play-ink)] sm:text-3xl">
              {{ t('home.leaderboard') }}
            </h2>
            <p class="mt-1 text-sm text-muted text-pretty">
              {{ t('home.leaderboardDesc') }}
            </p>
          </div>

          <UButton
            variant="outline"
            color="neutral"
            icon="i-lucide-refresh-cw"
            :loading="leaderboardLoading"
            :aria-label="`${t('home.refresh')} ${secondsUntilRefresh}s`"
            class="w-full rounded-2xl border-2 sm:w-auto"
            @click="refreshAll()"
          >
            {{ t('home.refresh') }}
            <span class="tabular-nums font-normal text-muted">{{ secondsUntilRefresh }}s</span>
          </UButton>
        </div>

        <Leaderboard
          :entries="accumulated"
          :loading="leaderboardLoading"
          :loading-more="loadingMore"
          :has-more="hasMore"
          remote-search
          @open-game="openGameDetail"
          @support-game="openSupportGame"
          @load-more="loadMore"
          @search="onSearch"
        />
      </section>

      <div class="min-w-0 space-y-6 lg:sticky lg:top-[5.75rem]">
        <TopDirectors :entries="topDirectors" />
        <ActivityFeed :items="statsData?.activity ?? []" />
      </div>
    </div>

    <GameDetailModal
      v-model:open="gameDetailOpen"
      v-model:game-id="selectedGameId"
    />
  </div>
</template>
