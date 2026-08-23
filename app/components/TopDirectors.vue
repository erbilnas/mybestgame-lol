<script setup lang="ts">
import type { LeaderboardEntry } from './Leaderboard.vue'
import { markdownPlainText } from '../../shared/utils/director-markdown'

const props = defineProps<{
  entries: LeaderboardEntry[]
}>()

const { t, locale } = useI18n()

const directors = computed(() =>
  props.entries
    .flatMap((entry) => {
      if (!entry.director) return []
      return [{
        bidId: entry.director.bidId,
        title: entry.director.title,
        description: entry.director.description,
        gameTitle: entry.title,
        amountCents: entry.director.priceCents
      }]
    })
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 10)
)

function formatDollars(cents: number) {
  return new Intl.NumberFormat(locale.value === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(cents / 100)
}

function rowClass(rank: number) {
  if (rank === 1) return 'director-row director-row--gold'
  if (rank === 2) return 'director-row director-row--silver'
  if (rank === 3) return 'director-row director-row--bronze'
  return 'director-row'
}

function rankClass(rank: number) {
  if (rank === 1) return 'director-rank director-rank--gold'
  if (rank === 2) return 'director-rank director-rank--silver'
  if (rank === 3) return 'director-rank director-rank--bronze'
  return 'director-rank'
}

function directorAria(director: { title: string, description: string | null }) {
  if (!director.description) return director.title
  return `${director.title}. ${markdownPlainText(director.description)}`
}
</script>

<template>
  <aside
    v-if="directors.length"
    class="arcade-shell overflow-visible rounded-[1.35rem] p-4"
  >
    <h2 class="font-display text-base font-bold text-[var(--play-ink)]">
      {{ t('directors.title') }}
    </h2>

    <ol class="mt-3 list-none space-y-2">
      <li
        v-for="(director, index) in directors"
        :key="director.bidId"
        tabindex="0"
        class="group relative flex items-start gap-2.5 px-2 py-2 text-sm outline-none"
        :class="rowClass(index + 1)"
        :aria-label="directorAria(director)"
      >
        <span
          class="mt-0.5"
          :class="rankClass(index + 1)"
          aria-hidden="true"
        >
          {{ index + 1 }}
        </span>

        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-[var(--play-ink)]">
            {{ director.title }}
          </p>
          <p class="truncate text-xs text-muted">
            {{ t('directors.on', { game: director.gameTitle }) }}
          </p>
        </div>

        <span class="mt-0.5 shrink-0 text-xs text-muted tabular-nums">
          {{ formatDollars(director.amountCents) }}
        </span>

        <DirectorMarkdown
          v-if="director.description"
          class="director-tip line-clamp-3"
          role="tooltip"
          :source="director.description"
        />
      </li>
    </ol>
  </aside>
</template>
