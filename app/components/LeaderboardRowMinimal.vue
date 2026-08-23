<script setup lang="ts">
import type { LeaderboardEntry } from './Leaderboard.vue'

defineProps<{
  entry: LeaderboardEntry
  formatDollars: (cents: number) => string
}>()

const emit = defineEmits<{
  'open-game': [gameId: number]
  'support-game': []
}>()

const { t } = useI18n()

function truncate(text: string | null | undefined, max = 120) {
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
  <article class="lb-row arcade-shell rounded-2xl p-3 sm:p-3.5">
    <div class="flex items-start gap-2.5 sm:items-center sm:gap-4">
      <span class="font-display mt-1 w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted sm:mt-0">
        #{{ entry.rank }}
      </span>

      <img
        v-if="entry.coverUrl"
        :src="entry.coverUrl"
        :alt="entry.title"
        loading="lazy"
        decoding="async"
        class="h-11 w-8 shrink-0 rounded-lg object-cover"
      >
      <div
        v-else
        class="h-11 w-8 shrink-0 rounded-lg bg-muted"
      />

      <div class="min-w-0 flex-1">
        <h3 class="truncate font-display text-sm font-bold text-[var(--play-ink)] sm:text-base">
          {{ entry.title }}
        </h3>

        <p
          v-if="entry.director"
          class="mt-0.5 min-w-0 text-xs"
        >
          <span class="font-medium text-muted">{{ t('card.directorMessage') }}</span>
          <span class="text-muted"> · </span>
          <span class="font-semibold text-[var(--play-ink)]">{{ entry.director.title }}</span>
        </p>

        <p
          v-else
          class="mt-0.5 text-xs text-muted"
        >
          {{ t('card.noDirector') }}
        </p>
      </div>

      <div class="hidden shrink-0 text-right sm:block">
        <p class="text-[10px] font-medium text-muted">
          {{ t('card.total') }}
        </p>
        <p class="font-display text-sm font-bold tabular-nums text-primary">
          {{ formatDollars(entry.totalCents) }}
        </p>
      </div>

      <div
        class="hidden shrink-0 items-center gap-1.5 sm:flex"
      >
        <UButton
          size="xs"
          class="arcade-cta whitespace-nowrap px-2.5 sm:px-3"
          @click="emit('support-game')"
        >
          {{ t('card.support') }}
        </UButton>
      </div>
    </div>

    <div class="mt-2 space-y-1.5 border-t border-[var(--play-rim)]/70 pt-2">
      <p
        v-if="truncate(entry.summary)"
        class="text-xs leading-relaxed text-muted line-clamp-2 sm:text-sm"
      >
        {{ truncate(entry.summary) }}
      </p>

      <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <button
          type="button"
          class="min-h-[44px] text-xs font-semibold text-primary transition-colors hover:text-primary/80 sm:min-h-0"
          @click="emit('open-game', entry.gameId)"
        >
          {{ t('card.moreAbout') }}
        </button>

        <template v-if="entry.topContributor">
          <span class="text-muted/50">·</span>
          <span class="text-[11px] text-muted sm:text-xs">
            {{ t('card.top') }}
            <span class="font-medium text-[var(--play-ink)]">{{ entry.topContributor.label }}</span>
            {{ formatDollars(entry.topContributor.amountCents) }}
          </span>
        </template>

        <template v-if="entry.lastContributor">
          <span class="text-muted/50">·</span>
          <span class="text-[11px] text-muted sm:text-xs">
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

    <div class="mt-2 space-y-2 border-t border-[var(--play-rim)]/70 pt-2 sm:hidden">
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="text-[10px] font-medium text-muted">
            {{ t('card.rankTotal') }}
          </p>
          <p class="font-display text-sm font-bold tabular-nums text-primary">
            {{ formatDollars(entry.totalCents) }}
          </p>
        </div>
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
  </article>
</template>
