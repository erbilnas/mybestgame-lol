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

function sponsorClickUrl(bidId: string) {
  return `/api/ads/click?bidId=${encodeURIComponent(bidId)}`
}

function openTrackedSponsor(bidId: string) {
  window.open(sponsorClickUrl(bidId), '_blank', 'noopener,noreferrer')
}

function sponsorThumb(ad: { image: string | null, link: string }) {
  return adVisualUrl(ad.image, ad.link, 128)
}

function daysUntil(iso: string | null | undefined) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

function decayingSoon(iso: string | null | undefined) {
  const days = daysUntil(iso)
  return days !== null && days <= 7
}
</script>

<template>
  <article
    class="lb-row overflow-hidden border"
    :class="podiumCardClass(entry.rank)"
  >
    <div class="space-y-3 p-4 sm:space-y-3.5 sm:p-5">
      <!-- Identity + totals + desktop actions -->
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
            <template v-if="entry.sponsorCents > 0">
              · {{ t('card.sponsor') }} {{ formatDollars(entry.sponsorCents) }}
            </template>
            <template v-if="decayingSoon(entry.nextExpiresAt)">
              · {{ t('card.decayingIn', { days: daysUntil(entry.nextExpiresAt) }) }}
            </template>
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

          <div
            class="flex gap-2"
          >
            <UButton
              size="sm"
              variant="soft"
              color="neutral"
              class="rounded-xl border-2"
              @click="emit('support-game')"
            >
              {{ t('card.support') }}
            </UButton>
            <UButton
              size="sm"
              class="arcade-cta"
              @click="emit('claim-sponsor')"
            >
              {{ t('card.outbid') }} · {{ formatDollars(entry.sponsorClaimCents) }}
            </UButton>
          </div>
        </div>
      </div>

      <!-- Summary + contributors -->
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

      <!-- Sponsor strip -->
      <div
        v-if="entry.ad"
        class="overflow-hidden rounded-xl border-2 podium-surface"
      >
        <div class="flex items-stretch">
          <a
            :href="sponsorClickUrl(entry.ad.bidId)"
            rel="sponsored nofollow"
            target="_blank"
            class="group relative block w-16 shrink-0 bg-muted/40 sm:w-20"
          >
            <img
              v-if="entry.ad.image"
              :src="entry.ad.image"
              :alt="entry.ad.title"
              class="size-full min-h-[4.5rem] object-cover transition-[filter] group-hover:brightness-[1.03] sm:min-h-[5rem]"
            >
            <div
              v-else-if="sponsorThumb(entry.ad)"
              class="flex size-full min-h-[4.5rem] items-center justify-center bg-[var(--play-panel)] sm:min-h-[5rem]"
            >
              <img
                :src="sponsorThumb(entry.ad)!"
                :alt="entry.ad.title"
                class="size-8 object-contain sm:size-10"
              >
            </div>
            <div
              v-else-if="entry.coverUrl"
              class="relative size-full min-h-[4.5rem] overflow-hidden sm:min-h-[5rem]"
            >
              <img
                :src="entry.coverUrl"
                :alt="''"
                aria-hidden="true"
                class="size-full scale-110 object-cover opacity-35 blur-[1px] saturate-50"
              >
              <div class="absolute inset-0 flex items-center justify-center bg-default/20">
                <span class="text-[0.65rem] font-medium text-muted">Sponsor</span>
              </div>
            </div>
            <div
              v-else
              class="flex size-full min-h-[4.5rem] items-center justify-center sm:min-h-[5rem]"
            >
              <span class="text-[0.65rem] font-medium text-muted">Sponsor</span>
            </div>
          </a>

          <div class="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3">
            <div class="min-w-0 flex-1">
              <a
                :href="sponsorClickUrl(entry.ad.bidId)"
                rel="sponsored nofollow"
                target="_blank"
                class="block truncate font-display text-sm font-bold text-[var(--play-ink)] transition-colors hover:text-primary sm:text-base"
              >
                {{ entry.ad.title }}
              </a>
              <p
                v-if="entry.ad.description"
                class="truncate text-xs text-muted sm:text-sm"
              >
                {{ entry.ad.description }}
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-3 text-xs text-muted">
              <span>{{ formatDollars(entry.ad.priceCents) }}</span>
              <span>{{ t('card.clicks', { count: entry.ad.clickCount }) }}</span>
              <button
                type="button"
                class="inline-flex items-center gap-1 font-medium text-[var(--play-ink)] transition-colors hover:text-primary"
                @click="openTrackedSponsor(entry.ad.bidId)"
              >
                {{ t('card.visit') }}
                <UIcon
                  name="i-lucide-arrow-up-right"
                  class="size-3.5"
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="flex flex-col gap-2 rounded-xl border-2 border-dashed podium-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
      >
        <div class="min-w-0">
          <p class="text-sm font-semibold text-[var(--play-ink)]">
            {{ t('card.noSponsor') }}
          </p>
          <p class="text-xs text-muted">
            {{ t('card.claimFrom', { price: formatDollars(entry.sponsorClaimCents) }) }}
          </p>
        </div>
        <UButton
          size="sm"
          class="arcade-cta shrink-0 self-start sm:self-center"
          @click="emit('claim-sponsor')"
        >
          {{ t('card.claim') }} · {{ formatDollars(entry.sponsorClaimCents) }}
        </UButton>
      </div>

      <!-- Mobile actions + total -->
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

        <div
          class="grid grid-cols-2 gap-2"
        >
          <UButton
            block
            size="sm"
            variant="soft"
            color="neutral"
            class="rounded-xl border-2"
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
            {{ t('card.outbid') }} · {{ formatDollars(entry.sponsorClaimCents) }}
          </UButton>
        </div>
      </div>
    </div>
  </article>
</template>
