<script setup lang="ts">
import type { BidModalPreset } from '~/components/BidModal.vue'

export interface LeaderboardContributor {
  label: string
  amountCents: number
  at: string
  bidCount?: number
}

export interface LeaderboardDirector {
  bidId: string
  title: string
  description: string | null
  priceCents: number
}

export interface LeaderboardEntry {
  rank: number
  gameId: number
  title: string
  slug: string
  coverUrl: string | null
  summary: string | null
  totalCents: number
  bidCount: number
  director: LeaderboardDirector | null
  topContributor: LeaderboardContributor | null
  lastContributor: LeaderboardContributor | null
  contributors: LeaderboardContributor[]
  nextExpiresAt?: string | null
}

const props = defineProps<{
  entries: LeaderboardEntry[]
  loading?: boolean
  loadingMore?: boolean
  hasMore?: boolean
  /** When true, parent owns paging; search emits instead of filtering locally. */
  remoteSearch?: boolean
}>()

const emit = defineEmits<{
  'open-game': [gameId: number]
  'support-game': [entry: LeaderboardEntry]
  'load-more': []
  search: [query: string]
}>()

const { t, locale } = useI18n()
const openBidModal = inject<(preset?: BidModalPreset) => void>('openBidModal', () => {})

const searchQuery = ref('')
const loadMoreEl = ref<HTMLElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let loadObserver: IntersectionObserver | undefined

const podiumEntries = computed(() => props.entries.filter(item => item.rank <= 3))
const belowEntries = computed(() => props.entries.filter(item => item.rank > 3))

/** Client-side browse mode: reveal 50 more when parent does not page. */
const CLIENT_PAGE = 50
const clientVisible = ref(CLIENT_PAGE)

const filteredBelow = computed(() => {
  if (props.remoteSearch) return belowEntries.value

  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return belowEntries.value.slice(0, clientVisible.value)
  return belowEntries.value.filter(entry =>
    entry.title.toLowerCase().includes(q) || entry.slug.toLowerCase().includes(q)
  )
})

const clientHasMore = computed(() => {
  if (props.remoteSearch) return false
  if (searchQuery.value.trim()) return false
  return belowEntries.value.length > clientVisible.value
})

const canLoadMore = computed(() => {
  if (props.remoteSearch) return Boolean(props.hasMore)
  return clientHasMore.value
})

watch(
  () => props.entries.length,
  () => {
    if (!props.remoteSearch) clientVisible.value = CLIENT_PAGE
  }
)

watch(searchQuery, (value) => {
  clearTimeout(searchTimer)
  if (!props.remoteSearch) {
    clientVisible.value = CLIENT_PAGE
    return
  }

  searchTimer = setTimeout(() => {
    emit('search', value.trim())
  }, 280)
})

function onLoadMore() {
  if (props.loading || props.loadingMore || !canLoadMore.value) return

  if (props.remoteSearch) {
    emit('load-more')
    return
  }

  clientVisible.value += CLIENT_PAGE
}

/** Keep chaining pages while the sentinel stays on screen after a fetch. */
watch(
  () => [props.loadingMore, clientVisible.value, props.entries.length, canLoadMore.value] as const,
  async ([loading]) => {
    if (loading || !canLoadMore.value || !loadMoreEl.value) return
    await nextTick()
    const el = loadMoreEl.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.top < (window.innerHeight || 0) + 400) onLoadMore()
  }
)

function formatDollars(cents: number) {
  return new Intl.NumberFormat(locale.value === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(cents / 100)
}

onMounted(() => {
  if (!import.meta.client) return

  loadObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some(entry => entry.isIntersecting)) onLoadMore()
    },
    { root: null, rootMargin: '400px 0px', threshold: 0 }
  )

  watch(
    loadMoreEl,
    (el, _prev, onCleanup) => {
      if (!el || !loadObserver) return
      loadObserver.observe(el)
      onCleanup(() => loadObserver?.unobserve(el))
    },
    { immediate: true }
  )
})

onUnmounted(() => {
  clearTimeout(searchTimer)
  loadObserver?.disconnect()
})
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="loading"
      class="py-16 text-center text-muted"
    >
      {{ t('leaderboard.loading') }}
    </div>

    <div
      v-else-if="entries.length === 0 && !searchQuery.trim()"
      class="arcade-shell rounded-[1.5rem] border-dashed py-16 text-center"
    >
      <p class="font-display text-xl font-bold text-[var(--play-ink)]">
        {{ t('leaderboard.empty') }}
      </p>
      <p class="mt-2 text-sm text-muted">
        {{ t('leaderboard.emptyHint') }}
      </p>
      <UButton
        class="arcade-cta mt-4"
        @click="openBidModal({})"
      >
        {{ t('leaderboard.supportFirst') }}
      </UButton>
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <LeaderboardRow
        v-for="entry in podiumEntries"
        :key="entry.gameId"
        :entry="entry"
        :format-dollars="formatDollars"
        @open-game="emit('open-game', $event)"
        @support-game="emit('support-game', entry)"
      />

      <div
        v-if="belowEntries.length > 0 || remoteSearch"
        class="space-y-2"
      >
        <p class="font-display text-sm font-semibold text-muted">
          {{ t('leaderboard.ranksBelow') }}
        </p>

        <label class="arcade-search group">
          <span class="arcade-search__icon" aria-hidden="true">
            <UIcon
              name="i-lucide-search"
              class="size-5"
            />
          </span>
          <input
            v-model="searchQuery"
            type="search"
            enterkeyhint="search"
            autocomplete="off"
            spellcheck="false"
            class="arcade-search__input"
            :placeholder="t('leaderboard.searchPlaceholder')"
            :aria-label="t('leaderboard.searchPlaceholder')"
          >
          <button
            v-if="searchQuery.trim()"
            type="button"
            class="arcade-search__clear"
            :aria-label="t('common.clear')"
            @click="searchQuery = ''"
          >
            <UIcon
              name="i-lucide-x"
              class="size-3.5"
            />
          </button>
        </label>

        <div
          v-if="filteredBelow.length === 0 && searchQuery.trim()"
          class="py-6 text-center text-sm text-muted"
        >
          {{ t('leaderboard.noResults') }}
        </div>

        <div
          v-else
          class="space-y-2"
        >
          <LeaderboardRowMinimal
            v-for="entry in filteredBelow"
            :key="entry.gameId"
            :entry="entry"
            :format-dollars="formatDollars"
            @open-game="emit('open-game', $event)"
            @support-game="emit('support-game', entry)"
          />
        </div>

        <div
          v-if="canLoadMore || loadingMore"
          ref="loadMoreEl"
          class="flex min-h-12 items-center justify-center py-3"
          aria-live="polite"
        >
          <p
            v-if="loadingMore"
            class="text-sm text-muted"
          >
            {{ t('leaderboard.loadingMore') }}
          </p>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ t('leaderboard.scrollMore') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
