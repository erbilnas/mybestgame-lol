<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const config = useRuntimeConfig()
const bidId = computed(() => String(route.params.id ?? ''))

const { data, pending } = await useFetch(() => `/api/bids/status?bid_id=${bidId.value}`, {
  immediate: !!bidId.value,
  watch: [bidId]
})

const siteUrl = computed(() => String(config.public.siteUrl).replace(/\/$/, ''))
const plaqueUrl = computed(() => `${siteUrl.value}/p/${bidId.value}`)
const embedSnippet = computed(() => {
  if (!data.value?.gameId) return ''
  return `<img src="${siteUrl.value}/embed/${data.value.gameId}.svg" alt="${data.value.gameTitle} on mybestgame.lol" />`
})

const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
const canShare = computed(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function')

const isPaid = computed(() => data.value?.status === 'paid')

const seoTitle = computed(() => {
  if (!isPaid.value || !data.value) return `${t('plaque.bidPlaque')} · mybestgame.lol`
  const rank = data.value.rank ? `#${data.value.rank}` : t('plaque.unranked')
  const dollars = Math.round(data.value.amount / 100)
  return `${rank} ${data.value.gameTitle} · $${dollars} on mybestgame.lol`
})

const seoDescription = computed(() => {
  if (!isPaid.value || !data.value) return t('seo.description')
  const parts = [`${data.value.contributor} stacked $${Math.round(data.value.amount / 100)}`]
  if (data.value.createdAt) {
    parts.push(`bid ${formatBidDate(data.value.createdAt)}`)
  }
  return parts.join(' · ')
})

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogType: 'article',
  ogImage: () => {
    const cover = data.value?.coverUrl
    if (cover && /^https?:\/\//i.test(cover)) return cover
    return undefined
  },
  twitterImage: () => {
    const cover = data.value?.coverUrl
    if (cover && /^https?:\/\//i.test(cover)) return cover
    return undefined
  }
})

useHead(() => {
  if (!isPaid.value || !data.value) return {}
  return {
    script: [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: seoTitle.value,
        description: seoDescription.value,
        url: plaqueUrl.value,
        image: data.value.coverUrl || `${siteUrl.value}/og-default.png`,
        datePublished: data.value.createdAt || undefined,
        author: {
          '@type': 'Person',
          name: data.value.contributor || 'Anonymous'
        }
      })
    }]
  }
})

function formatDollars(cents: number) {
  return new Intl.NumberFormat(locale.value === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(cents / 100)
}

function formatBidDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale.value === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copyState.value = 'copied'
    setTimeout(() => { copyState.value = 'idle' }, 2000)
  } catch {
    copyState.value = 'failed'
    setTimeout(() => { copyState.value = 'idle' }, 2000)
  }
}

async function sharePlaque() {
  if (!data.value || !canShare.value) {
    await copyText(plaqueUrl.value)
    return
  }
  try {
    await navigator.share({
      title: seoTitle.value,
      text: seoDescription.value,
      url: plaqueUrl.value
    })
  } catch {
    // user cancelled
  }
}
</script>

<template>
  <div class="playfield mx-auto max-w-lg px-4 py-12 sm:py-16">
    <div
      v-if="pending"
      class="arcade-shell rounded-[1.75rem] px-6 py-10 text-center text-muted"
    >
      {{ t('plaque.loading') }}
    </div>

    <div
      v-else-if="!isPaid || !data"
      class="arcade-shell space-y-4 rounded-[1.75rem] px-6 py-10 text-center"
    >
      <h1 class="font-display text-2xl font-bold text-[var(--play-ink)]">
        {{ t('plaque.notFound') }}
      </h1>
      <p class="text-sm text-muted text-pretty">
        {{ t('plaque.notFoundDesc') }}
      </p>
      <UButton
        :to="localePath('/')"
        class="arcade-cta"
      >
        {{ t('plaque.backToBoard') }}
      </UButton>
    </div>

    <div
      v-else
      class="space-y-6"
    >
      <article class="arcade-shell overflow-hidden rounded-[1.75rem]">
        <div class="flex gap-4 border-b-2 border-[var(--play-rim)] bg-[var(--play-soft)]/40 p-5 sm:p-6">
          <img
            v-if="data.coverUrl"
            :src="data.coverUrl"
            :alt="data.gameTitle"
            class="aspect-[3/4] w-20 shrink-0 rounded-2xl border-2 border-[var(--play-rim)] object-cover sm:w-24"
          >
          <div
            v-else
            class="aspect-[3/4] w-20 shrink-0 rounded-2xl border-2 border-[var(--play-rim)] bg-muted sm:w-24"
          />
          <div class="min-w-0 flex-1 space-y-2">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              {{ t('plaque.bidPlaque') }}
            </p>
            <h1 class="font-display text-2xl font-bold leading-tight text-[var(--play-ink)] sm:text-3xl">
              <span class="text-primary">{{ data.rank ? `#${data.rank}` : t('plaque.unranked') }}</span>
              {{ data.gameTitle }}
            </h1>
            <p class="text-sm text-muted">
              {{ data.contributor }} · {{ data.bidType === 'sponsor' ? t('plaque.sponsorBid') : t('plaque.gameBid') }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 p-5 sm:p-6">
          <div class="rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-panel)] px-3 py-3">
            <p class="text-xs text-muted">
              {{ t('plaque.thisBid') }}
            </p>
            <p class="font-display text-2xl font-bold tabular-nums text-[var(--play-ink)]">
              {{ formatDollars(data.amount) }}
            </p>
          </div>
          <div class="rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-panel)] px-3 py-3">
            <p class="text-xs text-muted">
              {{ t('plaque.stackTotal') }}
            </p>
            <p class="font-display text-2xl font-bold tabular-nums text-primary">
              {{ formatDollars(data.totalCents) }}
            </p>
          </div>
          <div
            v-if="data.createdAt"
            class="col-span-2 rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-panel)] px-3 py-3"
          >
            <p class="text-xs text-muted">
              {{ t('plaque.bidDate') }}
            </p>
            <p class="font-display text-lg font-bold text-[var(--play-ink)]">
              {{ formatBidDate(data.createdAt) }}
            </p>
          </div>
        </div>
      </article>

      <img
        :src="`/api/og/bid/${bidId}?v=2`"
        :alt="seoTitle"
        class="w-full rounded-[1.25rem] border-2 border-[var(--play-rim)] bg-[var(--play-soft)]"
      >

      <div class="flex flex-wrap gap-2">
        <UButton
          class="arcade-cta"
          @click="sharePlaque"
        >
          {{ copyState === 'copied' ? t('plaque.copied') : (canShare ? t('plaque.sharePlaque') : t('plaque.copyLink')) }}
        </UButton>
        <UButton
          :to="localePath('/')"
          variant="ghost"
          color="neutral"
        >
          {{ t('success.leaderboard') }}
        </UButton>
      </div>

      <details class="arcade-shell rounded-[1.35rem] p-4">
        <summary class="cursor-pointer font-display text-sm font-bold text-[var(--play-ink)]">
          {{ t('plaque.embedTitle') }}
        </summary>
        <p class="mt-2 text-xs text-muted text-pretty">
          {{ t('plaque.embedDesc') }}
        </p>
        <pre class="mt-3 overflow-x-auto rounded-xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)]/50 p-3 text-xs text-[var(--play-ink)]">{{ embedSnippet }}</pre>
        <UButton
          size="sm"
          variant="soft"
          color="neutral"
          class="mt-2 rounded-xl border-2"
          @click="copyText(embedSnippet)"
        >
          {{ t('plaque.copyEmbed') }}
        </UButton>
      </details>
    </div>
  </div>
</template>
