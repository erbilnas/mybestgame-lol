<script setup lang="ts">
export type ActivityType = 'bid_paid' | 'rank_takeover' | 'director_takeover' | 'decay'

export interface ActivityItem {
  type?: ActivityType
  gameId: number
  gameTitle: string
  rank: number
  amountCents: number
  contributor: string
  at: string
  detail?: {
    fromRank?: number | null
    toRank?: number | null
    previousTitle?: string | null
    previousDirectorTitle?: string | null
    directorTitle?: string | null
    leftBoard?: boolean
  }
}

defineProps<{
  items: ActivityItem[]
}>()

const { t, locale } = useI18n()

function formatDollars(cents: number) {
  return new Intl.NumberFormat(locale.value === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(cents / 100)
}

function timeAgo(isoDate: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000))
  if (minutes < 60) return t('common.mAgo', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return t('common.hAgo', { n: hours })
  const days = Math.floor(hours / 24)
  return t('common.dAgo', { n: days })
}

function headline(item: ActivityItem) {
  const type = item.type ?? 'bid_paid'
  switch (type) {
    case 'rank_takeover': {
      const to = item.detail?.toRank ?? item.rank
      if (to === 1) return t('activity.tookFirst', { game: item.gameTitle })
      if (item.detail?.fromRank) return t('activity.climbedTo', { game: item.gameTitle, rank: to })
      return t('activity.hitRank', { game: item.gameTitle, rank: to })
    }
    case 'director_takeover':
      return t('activity.directorFlipped', { game: item.gameTitle })
    case 'decay': {
      if (item.detail?.leftBoard) return t('activity.leftBoard', { game: item.gameTitle })
      if (item.detail?.previousDirectorTitle) return t('activity.directorDecayed', { game: item.gameTitle })
      if (item.detail?.fromRank && item.detail?.toRank) {
        return t('activity.slippedTo', { game: item.gameTitle, rank: item.detail.toRank })
      }
      return t('activity.isDecaying', { game: item.gameTitle })
    }
    case 'bid_paid':
      return t('activity.atRank', { game: item.gameTitle, rank: item.rank })
    default: {
      const _exhaustive: never = type
      return t('activity.atRank', { game: item.gameTitle, rank: item.rank })
    }
  }
}

function subline(item: ActivityItem) {
  const type = item.type ?? 'bid_paid'
  switch (type) {
    case 'director_takeover':
      return [
        item.contributor,
        item.detail?.directorTitle,
        item.amountCents ? formatDollars(item.amountCents) : null
      ].filter(Boolean).join(' · ')
    case 'decay':
      if (item.detail?.fromRank && item.detail.toRank) {
        return `#${item.detail.fromRank} → #${item.detail.toRank}`
      }
      if (item.detail?.previousDirectorTitle) {
        return t('activity.was', { title: item.detail.previousDirectorTitle })
      }
      return t('activity.bidsExpired')
    case 'rank_takeover':
    case 'bid_paid':
      return [
        item.contributor,
        item.amountCents ? formatDollars(item.amountCents) : null
      ].filter(Boolean).join(' · ')
    default: {
      const _exhaustive: never = type
      return item.contributor
    }
  }
}
</script>

<template>
  <aside
    v-if="items.length"
    class="arcade-shell rounded-[1.35rem] p-4"
  >
    <h2 class="font-display text-base font-bold text-[var(--play-ink)]">
      {{ t('activity.title') }}
    </h2>

    <ul class="mt-3 space-y-3">
      <li
        v-for="item in items"
        :key="`${item.type ?? 'bid'}-${item.gameId}-${item.at}`"
        class="flex items-start justify-between gap-3 text-sm"
      >
        <div class="min-w-0">
          <p class="truncate text-[var(--play-ink)]">
            <span class="font-semibold">{{ headline(item) }}</span>
          </p>
          <p class="text-xs text-muted">
            {{ subline(item) }}
          </p>
        </div>
        <time
          class="shrink-0 text-xs text-muted tabular-nums"
          :datetime="item.at"
        >
          {{ timeAgo(item.at) }}
        </time>
      </li>
    </ul>
  </aside>
</template>
