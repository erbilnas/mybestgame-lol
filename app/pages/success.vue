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
  rank?: number | null
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
        <div class="space-y-2">
          <UIcon
            name="i-lucide-circle-check"
            class="mx-auto size-10 text-[var(--color-play-leaf)]"
          />
          <h1 class="font-display text-2xl font-bold text-[var(--play-ink)]">
            {{ t('success.confirmed') }}
          </h1>
          <p class="text-muted text-pretty">
            {{ t('success.bidLive', { amount: formatDollars(data.amount) }) }}
          </p>
        </div>

        <div
          v-if="data.gameTitle"
          class="mx-auto flex max-w-sm items-center gap-3 rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)]/50 p-3 text-left"
        >
          <img
            v-if="data.coverUrl"
            :src="data.coverUrl"
            :alt="data.gameTitle"
            class="aspect-[3/4] w-12 rounded-xl border-2 border-[var(--play-rim)] object-cover"
          >
          <div class="min-w-0">
            <p class="font-display text-lg font-bold text-[var(--play-ink)]">
              <span
                v-if="data.rank"
                class="text-primary"
              >#{{ data.rank }}</span>
              {{ data.gameTitle }}
            </p>
            <p
              v-if="data.totalCents != null"
              class="text-xs text-muted"
            >
              {{ t('success.stack', { amount: formatDollars(data.totalCents) }) }}
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <UButton
            :to="localePath(`/p/${bidId}`)"
            class="arcade-cta"
          >
            {{ t('success.viewPlaque') }}
          </UButton>
          <UButton
            :to="localePath('/')"
            variant="soft"
            color="neutral"
            class="rounded-2xl border-2"
          >
            {{ t('success.leaderboard') }}
          </UButton>
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
