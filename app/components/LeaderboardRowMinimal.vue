<script setup lang="ts">
import type { LeaderboardEntry } from './Leaderboard.vue'

defineProps<{
  entry: LeaderboardEntry
  formatDollars: (cents: number) => string
}>()

const emit = defineEmits<{
  'open-game': [gameId: number]
  'support-game': []
  'claim-sponsor': []
}>()

const { t } = useI18n()

function adClickUrl(bidId: string) {
  return `/api/ads/click?bidId=${encodeURIComponent(bidId)}`
}

function sponsorThumb(ad: { image: string | null, link: string }) {
  return adVisualUrl(ad.image, ad.link, 64)
}

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
          v-if="entry.ad"
          class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs"
        >
          <a
            :href="adClickUrl(entry.ad.bidId)"
            rel="sponsored nofollow"
            target="_blank"
            class="relative block size-5 shrink-0 overflow-hidden rounded border border-[var(--play-rim)] bg-[var(--play-panel)]"
          >
            <img
              v-if="entry.ad.image"
              :src="entry.ad.image"
              :alt="entry.ad.title"
              loading="lazy"
              decoding="async"
              class="size-full object-cover"
            >
            <img
              v-else-if="sponsorThumb(entry.ad)"
              :src="sponsorThumb(entry.ad)!"
              :alt="entry.ad.title"
              loading="lazy"
              decoding="async"
              class="size-full object-contain p-0.5"
            >
            <img
              v-else-if="entry.coverUrl"
              :src="entry.coverUrl"
              :alt="''"
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              class="size-full object-cover opacity-40"
            >
          </a>
          <span class="shrink-0 font-medium text-muted">{{ t('card.sponsor') }}</span>
          <a
            :href="adClickUrl(entry.ad.bidId)"
            rel="sponsored nofollow"
            target="_blank"
            class="truncate font-semibold text-[var(--play-ink)] transition-colors hover:text-primary"
          >
            {{ entry.ad.title }}
          </a>
          <span class="hidden shrink-0 text-muted sm:inline">
            · {{ formatDollars(entry.ad.priceCents) }}
          </span>
        </p>

        <p
          v-else
          class="mt-0.5 text-xs text-muted"
        >
          {{ t('card.noSponsor') }}
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
          color="neutral"
          variant="soft"
          class="rounded-xl border"
          @click="emit('support-game')"
        >
          {{ t('card.support') }}
        </UButton>
        <UButton
          size="xs"
          class="arcade-cta whitespace-nowrap px-2.5 sm:px-3"
          @click="emit('claim-sponsor')"
        >
          {{ entry.ad ? t('card.outbid') : t('card.claim') }}
          <span class="tabular-nums">{{ formatDollars(entry.sponsorClaimCents) }}</span>
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
        <p
          v-if="entry.ad"
          class="max-w-[55%] truncate text-right text-[11px] text-muted"
        >
          {{ t('card.clicks', { count: entry.ad.clickCount }) }}
        </p>
      </div>

      <div
        class="grid grid-cols-2 gap-2"
      >
        <UButton
          block
          size="sm"
          color="neutral"
          variant="soft"
          class="rounded-xl border"
          @click="emit('support-game')"
        >
          {{ t('card.support') }}
        </UButton>
        <UButton
          block
          size="sm"
          class="arcade-cta"
          @click="emit('claim-sponsor')"
        >
          {{ entry.ad ? t('card.outbid') : t('card.claim') }}
          <span class="tabular-nums">{{ formatDollars(entry.sponsorClaimCents) }}</span>
        </UButton>
      </div>
    </div>
  </article>
</template>
