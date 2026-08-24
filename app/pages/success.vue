<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()

interface BidStatus {
  id: string
  status: string
  amount: number
  gameId: number
  bidType?: string
  gameTitle?: string
  coverUrl?: string | null
  slug?: string | null
  rank?: number | null
  previousRank?: number | null
  totalCents?: number
  expiresAt?: string | null
  contributor?: string
}

const route = useRoute()
const bidId = computed(() => String(route.query.bid_id ?? ''))

useSeoMeta({
  title: () => `${t('success.confirming')} · mybestgame.lol`,
  description: () => t('seo.description'),
  robots: 'noindex, nofollow'
})

const { data, refresh } = await useFetch<BidStatus>(() => `/api/bids/status?bid_id=${bidId.value}`, {
  immediate: !!bidId.value,
  watch: [bidId]
})

const polling = ref(false)

onMounted(() => {
  if (!bidId.value) return

  polling.value = true

  const checkStatus = async () => {
    await $fetch('/api/bids/confirm', { query: { bid_id: bidId.value } }).catch(() => null)
    await refresh()
  }

  void checkStatus()

  const interval = setInterval(async () => {
    await checkStatus()
    if (data.value?.status === 'paid' || data.value?.status === 'failed') {
      clearInterval(interval)
      polling.value = false
    }
  }, 2000)

  setTimeout(() => {
    clearInterval(interval)
    polling.value = false
  }, 60_000)

  onUnmounted(() => clearInterval(interval))
})

function formatDollars(cents: number) {
  return new Intl.NumberFormat(locale.value === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(cents / 100)
}

type RankDelta = 'entered' | 'climbed' | 'held'

const rankDelta = computed((): RankDelta | null => {
  const paid = data.value
  if (!paid || paid.status !== 'paid' || !paid.rank) return null
  if (!paid.previousRank) return 'entered'
  if (paid.previousRank > paid.rank) return 'climbed'
  return 'held'
})

const climbPlaces = computed(() => {
  const paid = data.value
  if (!paid?.rank || !paid.previousRank) return 0
  return Math.max(0, paid.previousRank - paid.rank)
})

function rankLineFor(delta: RankDelta, rank: number): string {
  switch (delta) {
    case 'entered':
      return t('success.enteredAt', { rank })
    case 'climbed':
      return t('success.climbed', { n: climbPlaces.value, rank })
    case 'held':
      return t('success.held', { rank })
    default: {
      const _never: never = delta
      return _never
    }
  }
}

const rankLine = computed(() => {
  const paid = data.value
  const delta = rankDelta.value
  if (!paid?.rank || !delta) return t('success.onTheBoard')
  return rankLineFor(delta, paid.rank)
})
</script>

<template>
  <div class="playfield mx-auto max-w-lg px-3 py-12 sm:px-4 sm:py-16">
    <div class="arcade-shell space-y-6 rounded-[1.75rem] px-4 py-8 text-center sm:px-8 sm:py-10">
      <template v-if="!bidId">
        <h1 class="font-display text-2xl font-bold text-[var(--play-ink)]">
          {{ t('success.missingRef') }}
        </h1>
        <UButton
          :to="localePath('/')"
          class="arcade-cta"
        >
          {{ t('success.backToBoard') }}
        </UButton>
      </template>

      <template v-else-if="data?.status === 'paid'">
        <p class="font-display text-sm font-semibold text-muted">
          {{ t('success.confirmed') }}
        </p>

        <div
          v-if="data.rank"
          class="flex justify-center"
        >
          <p class="font-display text-6xl font-bold tabular-nums leading-none text-primary sm:text-7xl">
            #{{ data.rank }}
          </p>
        </div>

        <h1 class="font-display text-2xl font-bold text-[var(--play-ink)] text-pretty sm:text-3xl">
          {{ rankLine }}
        </h1>
        <p class="text-muted text-pretty">
          {{ t('success.bidLive', { amount: formatDollars(data.amount) }) }}
        </p>

        <div
          v-if="data.gameTitle"
          class="mx-auto flex max-w-sm items-center gap-4 rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)]/50 p-3 text-left"
        >
          <img
            v-if="data.coverUrl"
            :src="data.coverUrl"
            :alt="data.gameTitle"
            class="aspect-[3/4] w-20 rounded-xl border-2 border-[var(--play-rim)] object-cover sm:w-24"
          >
          <div
            v-else
            class="aspect-[3/4] w-20 rounded-xl border-2 border-[var(--play-rim)] bg-muted sm:w-24"
          />
          <div class="min-w-0">
            <p class="font-display text-lg font-bold text-[var(--play-ink)] text-pretty">
              {{ data.gameTitle }}
            </p>
            <p
              v-if="data.previousRank && data.rank && data.previousRank !== data.rank"
              class="mt-1 text-sm text-muted"
            >
              {{ t('success.wasRank', { rank: data.previousRank }) }}
            </p>
            <p
              v-if="data.totalCents != null"
              class="mt-1 text-sm tabular-nums text-[var(--play-ink)]"
            >
              {{ t('success.stack', { amount: formatDollars(data.totalCents) }) }}
            </p>
          </div>
        </div>

        <div class="flex flex-col items-center gap-3">
          <UButton
            :to="localePath(`/p/${bidId}`)"
            class="arcade-cta"
          >
            {{ t('success.viewPlaque') }}
          </UButton>
          <NuxtLink
            :to="localePath('/')"
            class="text-sm font-semibold text-[var(--play-ink)] underline decoration-[var(--play-rim)] underline-offset-4"
          >
            {{ t('success.leaderboard') }}
          </NuxtLink>
        </div>
      </template>

      <template v-else-if="data?.status === 'failed'">
        <h1 class="font-display text-2xl font-bold text-[var(--play-ink)]">
          {{ t('success.notCompleted') }}
        </h1>
        <p class="text-muted text-pretty">
          {{ t('success.notCompletedDesc') }}
        </p>
        <UButton
          :to="localePath('/')"
          class="arcade-cta"
        >
          {{ t('success.backToBoard') }}
        </UButton>
      </template>

      <template v-else>
        <h1 class="font-display text-2xl font-bold text-[var(--play-ink)]">
          {{ t('success.confirming') }}
        </h1>
        <p class="text-muted text-pretty">
          {{ t('success.confirmingDesc') }}
        </p>
        <UButton
          v-if="polling"
          loading
          disabled
          class="arcade-cta"
        >
          {{ t('success.checkingStatus') }}
        </UButton>
      </template>
    </div>
  </div>
</template>
