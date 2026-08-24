<script setup lang="ts">
import type { LeaderboardEntry } from './Leaderboard.vue'

const props = defineProps<{
  entry: LeaderboardEntry
  formatDollars: (cents: number) => string
}>()

const emit = defineEmits<{
  'open-game': [gameId: number]
  'support-game': []
}>()

const { t } = useI18n()
const { mounted, remainingMs } = useExpiryCountdown(() => props.entry.nextExpiresAt)

const holdTime = computed(() => {
  if (remainingMs.value === null) return null
  if (remainingMs.value <= 0) return t('card.expired')
  if (!mounted.value) {
    const days = Math.ceil(remainingMs.value / (24 * 60 * 60 * 1000))
    return t('card.daysShort', { n: Math.max(0, days) })
  }
  return formatExpiryClock(remainingMs.value, {
    day: t('card.clockDay'),
    hour: t('card.clockHour'),
    minute: t('card.clockMinute')
  })
})

function podiumCardClass(rank: number) {
  if (rank === 1) return 'podium-card podium-card--gold'
  if (rank === 2) return 'podium-card podium-card--silver'
  if (rank === 3) return 'podium-card podium-card--bronze'
  return 'border-default bg-default'
}

function podiumTotalClass(rank: number) {
  if (rank === 1) return 'podium-total--gold'
  if (rank === 2) return 'podium-total--silver'
  if (rank === 3) return 'podium-total--bronze'
  return 'text-primary'
}

function truncate(text: string | null | undefined, max = 140) {
  if (!text) return null
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

function timeAgo(isoDate: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000))
  if (minutes < 60) return t('common.mAgo', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return t('common.hAgo', { n: hours })
  return t('common.dAgo', { n: Math.floor(hours / 24) })
}
</script>

<template>
  <article
    class="lb-row lb-row--podium overflow-hidden border"
    :class="podiumCardClass(entry.rank)"
  >
    <div class="space-y-3 p-4 sm:space-y-3.5 sm:p-5">
      <div class="flex items-start gap-3 sm:gap-4">
        <div
          class="podium-rail flex size-10 shrink-0 items-center justify-center rounded-xl border-2 sm:size-11"
        >
          <span class="font-display text-xl font-bold tabular-nums leading-none sm:text-2xl">
            {{ entry.rank }}
          </span>
        </div>

        <div class="shrink-0 overflow-hidden rounded-xl border-2 podium-surface">
          <img
            v-if="entry.coverUrl"
            :src="entry.coverUrl"
            :alt="entry.title"
            loading="lazy"
            decoding="async"
            class="aspect-[3/4] w-12 object-cover sm:w-14"
          >
          <div
            v-else
            class="aspect-[3/4] w-12 bg-muted sm:w-14"
          />
        </div>

        <div class="min-w-0 flex-1 pt-0.5">
          <h3 class="font-display text-lg font-bold leading-snug text-[var(--play-ink)] sm:text-xl">
            {{ entry.title }}
          </h3>
          <p class="mt-0.5 text-xs text-muted sm:text-sm">
            {{ t('card.stackedBids', { count: entry.bidCount }) }}
          </p>
          <p
            v-if="holdTime"
            class="mt-1 font-display text-sm font-bold tabular-nums tracking-wide text-[var(--play-ink)] sm:text-base"
          >
            {{ t('card.holdsFor', { time: holdTime }) }}
          </p>
        </div>

        <div class="hidden shrink-0 flex-col items-end gap-2 sm:flex">
          <div class="text-right">
            <p class="text-[0.65rem] font-medium uppercase tracking-wide text-muted">
              {{ t('card.rankTotal') }}
            </p>
            <p
              class="font-display text-2xl font-bold tabular-nums leading-none"
              :class="podiumTotalClass(entry.rank)"
            >
              {{ formatDollars(entry.totalCents) }}
            </p>
          </div>

          <UButton
            size="sm"
            class="arcade-cta"
            @click="emit('support-game')"
          >
            {{ t('card.support') }}
          </UButton>
        </div>
      </div>

      <div class="space-y-2">
        <p
          v-if="truncate(entry.summary)"
          class="text-sm leading-relaxed text-muted line-clamp-2"
        >
          {{ truncate(entry.summary) }}
        </p>
        <p
          v-else
          class="text-sm text-muted"
        >
          {{ t('card.openSummary') }}
        </p>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            class="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            @click="emit('open-game', entry.gameId)"
          >
            {{ t('card.moreAbout') }}
          </button>

          <template v-if="entry.topContributor">
            <span class="text-muted/50">·</span>
            <span class="text-xs text-muted">
              {{ t('card.top') }}
              <span class="font-medium text-[var(--play-ink)]">{{ entry.topContributor.label }}</span>
              {{ formatDollars(entry.topContributor.amountCents) }}
            </span>
          </template>

          <template v-if="entry.lastContributor">
            <span class="text-muted/50">·</span>
            <span class="text-xs text-muted">
              {{ t('card.latest') }}
              <span class="font-medium text-[var(--play-ink)]">{{ entry.lastContributor.label }}</span>
              {{ timeAgo(entry.lastContributor.at) }}
            </span>
          </template>

          <template v-if="entry.contributors.length">
            <span class="text-muted/50">·</span>
            <ContributorsPopover
              :contributors="entry.contributors"
              :format-dollars="formatDollars"
            />
          </template>
        </div>
      </div>

      <div
        v-if="entry.director"
        class="rounded-xl border-2 podium-surface px-3 py-2.5 sm:px-4 sm:py-3"
      >
        <p class="text-[0.65rem] font-medium uppercase tracking-wide text-muted">
          {{ t('card.directorMessage') }}
        </p>
        <p class="mt-0.5 font-display text-sm font-bold text-[var(--play-ink)] sm:text-base">
          {{ entry.director.title }}
        </p>
        <div
          v-if="entry.director.description"
          class="mt-0.5 text-xs text-muted text-pretty sm:text-sm"
        >
          <DirectorMarkdown :source="entry.director.description" />
        </div>
      </div>

      <div
        v-else
        class="flex flex-col gap-2 rounded-xl border-2 border-dashed podium-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
      >
        <div class="min-w-0">
          <p class="text-sm font-semibold text-[var(--play-ink)]">
            {{ t('card.noDirector') }}
          </p>
          <p class="text-xs text-muted">
            {{ t('card.supportToDirect') }}
          </p>
        </div>
        <UButton
          size="sm"
          class="arcade-cta shrink-0 self-start sm:self-center"
          @click="emit('support-game')"
        >
          {{ t('card.support') }}
        </UButton>
      </div>

      <div class="flex flex-col gap-2 border-t-2 border-[var(--play-rim)]/50 pt-3 sm:hidden">
        <div class="flex items-baseline justify-between">
          <p class="text-xs text-muted">
            {{ t('card.rankTotal') }}
          </p>
          <p
            class="font-display text-xl font-bold tabular-nums"
            :class="podiumTotalClass(entry.rank)"
          >
            {{ formatDollars(entry.totalCents) }}
          </p>
        </div>

        <UButton
          block
          size="sm"
          class="arcade-cta"
          @click="emit('support-game')"
        >
          {{ t('card.support') }}
        </UButton>
      </div>
    </div>
  </article>
</template>
