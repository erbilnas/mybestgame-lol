<script setup lang="ts">
export interface SiteStatsData {
  totalRevenueCents: number
  totalPaidBids: number
  gamesOnBoard: number
  launchedAt: string | null
  liveDirectors: number
  allTimeDirectors: number
  livePlayers: number
  allTimePlayers: number
  directorRevenueCents: number
}

const props = defineProps<{
  stats: SiteStatsData | null
  loading?: boolean
}>()

const { t, locale } = useI18n()

function formatDollars(cents: number) {
  return new Intl.NumberFormat(locale.value === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(cents / 100)
}

function formatCount(value: number) {
  return new Intl.NumberFormat(locale.value === 'tr' ? 'tr-TR' : 'en-US').format(value)
}

const items = computed(() => {
  const stats = props.stats
  const loading = props.loading

  return [
    {
      label: t('stats.raised'),
      value: loading ? '—' : formatDollars(stats?.totalRevenueCents ?? 0)
    },
    {
      label: t('stats.games'),
      value: loading ? '—' : formatCount(stats?.gamesOnBoard ?? 0)
    },
    {
      label: t('stats.paidBids'),
      value: loading ? '—' : formatCount(stats?.totalPaidBids ?? 0)
    },
    {
      label: t('stats.liveDirectors'),
      value: loading ? '—' : formatCount(stats?.liveDirectors ?? 0)
    },
    {
      label: t('stats.allTimeDirectors'),
      value: loading ? '—' : formatCount(stats?.allTimeDirectors ?? 0)
    },
    {
      label: t('stats.livePlayers'),
      value: loading ? '—' : formatCount(stats?.livePlayers ?? 0),
      note: t('stats.livePlayersNote')
    },
    {
      label: t('stats.allTimePlayers'),
      value: loading ? '—' : formatCount(stats?.allTimePlayers ?? 0)
    },
    {
      label: t('stats.directorRaised'),
      value: loading ? '—' : formatDollars(stats?.directorRevenueCents ?? 0)
    }
  ]
})
</script>

<template>
  <div
    class="stats-marquee"
    :aria-label="t('stats.raised')"
  >
    <div class="stats-marquee__track">
      <dl
        v-for="copy in 2"
        :key="copy"
        class="stats-marquee__group"
        :aria-hidden="copy === 2"
      >
        <div
          v-for="item in items"
          :key="`${copy}-${item.label}`"
          class="stats-marquee__item"
        >
          <dt class="stats-marquee__label">
            {{ item.label }}<template v-if="item.note"> · {{ item.note }}</template>
          </dt>
          <dd class="stats-marquee__value">
            {{ item.value }}
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>
