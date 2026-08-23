<script setup lang="ts">
import type { LeaderboardEntry } from './Leaderboard.vue'

const props = defineProps<{
  entries: LeaderboardEntry[]
}>()

const { t, locale } = useI18n()

const sponsors = computed(() =>
  props.entries
    .flatMap((entry) => {
      if (!entry.ad) return []
      return [{
        bidId: entry.ad.bidId,
        title: entry.ad.title,
        description: entry.ad.description,
        gameTitle: entry.title,
        amountCents: entry.sponsorCents
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

function sponsorClickUrl(bidId: string) {
  return `/api/ads/click?bidId=${encodeURIComponent(bidId)}`
}

function rowClass(rank: number) {
  if (rank === 1) return 'sponsor-row sponsor-row--gold'
  if (rank === 2) return 'sponsor-row sponsor-row--silver'
  if (rank === 3) return 'sponsor-row sponsor-row--bronze'
  return 'sponsor-row'
}

function rankClass(rank: number) {
  if (rank === 1) return 'sponsor-rank sponsor-rank--gold'
  if (rank === 2) return 'sponsor-rank sponsor-rank--silver'
  if (rank === 3) return 'sponsor-rank sponsor-rank--bronze'
  return 'sponsor-rank'
}
</script>

<template>
  <aside
    v-if="sponsors.length"
    class="arcade-shell overflow-visible rounded-[1.35rem] p-4"
  >
    <h2 class="font-display text-base font-bold text-[var(--play-ink)]">
      {{ t('sponsors.title') }}
    </h2>

    <ol class="mt-3 list-none space-y-2">
      <li
        v-for="(sponsor, index) in sponsors"
        :key="sponsor.bidId"
        tabindex="0"
        class="group relative flex items-start gap-2.5 px-2 py-2 text-sm outline-none"
        :class="rowClass(index + 1)"
        :aria-label="sponsor.description ? `${sponsor.title}. ${sponsor.description}` : sponsor.title"
      >
        <span
          class="mt-0.5"
          :class="rankClass(index + 1)"
          aria-hidden="true"
        >
          {{ index + 1 }}
        </span>

        <div class="min-w-0 flex-1">
          <a
            :href="sponsorClickUrl(sponsor.bidId)"
            rel="sponsored nofollow"
            target="_blank"
            class="block truncate font-semibold text-[var(--play-ink)] transition-colors hover:text-primary"
          >
            {{ sponsor.title }}
          </a>
          <p class="truncate text-xs text-muted">
            {{ t('sponsors.on', { game: sponsor.gameTitle }) }}
          </p>
        </div>

        <span class="mt-0.5 shrink-0 text-xs text-muted tabular-nums">
          {{ formatDollars(sponsor.amountCents) }}
        </span>

        <p
          v-if="sponsor.description"
          class="sponsor-tip line-clamp-3"
          role="tooltip"
        >
          {{ sponsor.description }}
        </p>
      </li>
    </ol>
  </aside>
</template>
