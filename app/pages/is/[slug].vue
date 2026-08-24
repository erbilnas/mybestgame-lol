<script setup lang="ts">
import type { BidModalPreset } from '~/components/BidModal.vue'
import type { GameDetail } from '~/components/GameDetailModal.vue'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const openBidModal = inject<(preset?: BidModalPreset) => void>('openBidModal', () => {})

const slug = computed(() => String(route.params.slug ?? '').trim().toLowerCase())

const { data, error } = await useFetch<GameDetail>(
  () => `/api/games/by-slug/${encodeURIComponent(slug.value)}`,
  {
    key: computed(() => `is-game-${slug.value}`),
    watch: [slug]
  }
)

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.statusMessage || 'Game not found'
  })
}

const isBest = computed(() => data.value?.board.rank === 1)

const pageTitle = computed(() => {
  if (!data.value) return t('seo.title')
  return t('isBest.seoTitle', { title: data.value.title })
})

const pageDescription = computed(() => {
  if (!data.value) return t('seo.description')
  if (isBest.value) {
    return t('isBest.seoDescYes', {
      title: data.value.title,
      total: formatDollars(data.value.board.totalCents)
    })
  }
  if (data.value.board.rank) {
    return t('isBest.seoDescRanked', {
      title: data.value.title,
      rank: data.value.board.rank,
      total: formatDollars(data.value.board.totalCents)
    })
  }
  return t('isBest.seoDescUnranked', { title: data.value.title })
})

const answerText = computed(() => {
  if (!data.value) return ''
  if (isBest.value) return t('isBest.answerYes')
  if (data.value.board.rank) {
    return t('isBest.answerRanked', { rank: data.value.board.rank })
  }
  return t('isBest.answerUnranked')
})

useSiteSeo({
  title: pageTitle,
  description: pageDescription,
  ogImage: () => data.value?.coverUrl || undefined,
  ogType: 'article',
  jsonLd: () => {
    if (!data.value) return undefined
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [{
        '@type': 'Question',
        name: t('isBest.h1', { title: data.value.title }),
        acceptedAnswer: {
          '@type': 'Answer',
          text: answerText.value
        }
      }]
    }
  }
})

function formatDollars(cents: number) {
  return new Intl.NumberFormat(locale.value === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(cents / 100)
}

function startSupport() {
  if (!data.value) return
  openBidModal({
    gameId: data.value.id,
    title: data.value.title,
    slug: data.value.slug,
    coverUrl: data.value.coverUrl
  })
}
</script>

<template>
  <div class="playfield mx-auto max-w-3xl px-3 pb-12 pt-5 sm:px-6 sm:pt-8">
    <div
      v-if="!data"
      class="rounded-[1.5rem] border-2 border-[var(--play-rim)] bg-[var(--play-panel)] px-5 py-10 text-center text-sm text-muted"
    >
      {{ t('isBest.loading') }}
    </div>

    <article
      v-else-if="data"
      class="overflow-hidden rounded-[1.5rem] border-2 border-[var(--play-rim)] bg-[var(--play-panel)]"
    >
      <div class="border-b-2 border-[var(--play-rim)] bg-[var(--play-soft)]/80 px-5 py-5 sm:px-7 sm:py-6">
        <p class="text-sm font-semibold text-muted">
          mybestgame.lol
        </p>
        <h1 class="mt-2 font-display text-2xl font-bold text-[var(--play-ink)] text-pretty sm:text-3xl">
          {{ t('isBest.h1', { title: data.title }) }}
        </h1>
        <p class="mt-3 text-base text-[var(--play-ink)] text-pretty sm:text-lg">
          {{ answerText }}
        </p>
      </div>

      <div class="flex flex-col gap-5 p-5 sm:flex-row sm:gap-6 sm:p-7">
        <GameCover
          :src="data.coverUrl"
          :alt="data.title"
          class="aspect-[3/4] w-28 shrink-0 self-start rounded-2xl border-2 border-[var(--play-rim)] object-cover sm:w-36"
        />

        <div class="min-w-0 flex-1 space-y-4">
          <div class="flex flex-wrap gap-2">
            <div
              v-if="data.board.rank"
              class="rounded-xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)] px-2.5 py-1.5"
            >
              <p class="text-[0.65rem] font-medium text-muted">
                {{ t('gameDetail.boardRank') }}
              </p>
              <p class="font-display text-lg font-bold leading-none text-primary">
                #{{ data.board.rank }}
              </p>
            </div>
            <div class="rounded-xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)] px-2.5 py-1.5">
              <p class="text-[0.65rem] font-medium text-muted">
                {{ t('card.rankTotal') }}
              </p>
              <p class="font-display text-lg font-bold leading-none tabular-nums text-[var(--play-ink)]">
                {{ formatDollars(data.board.totalCents) }}
              </p>
            </div>
          </div>

          <p
            v-if="data.summary"
            class="text-sm leading-relaxed text-[var(--play-ink)] text-pretty"
          >
            {{ data.summary }}
          </p>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ t('gameDetail.noSummary') }}
          </p>

          <div class="flex flex-wrap gap-3 pt-1">
            <UButton
              color="primary"
              size="lg"
              class="font-display font-bold"
              @click="startSupport"
            >
              {{ t('isBest.cta') }}
            </UButton>
            <UButton
              :to="localePath('/')"
              color="neutral"
              variant="outline"
              size="lg"
            >
              {{ t('isBest.backBoard') }}
            </UButton>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>
