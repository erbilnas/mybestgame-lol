<script setup lang="ts">
import type { BidModalPreset } from '~/components/BidModal.vue'
import { overlayCloseButton, overlayCloseUi, overlayHeaderUi } from '~/utils/overlay-close'

export interface GameDetail {
  id: number
  title: string
  slug: string
  coverUrl: string | null
  summary: string | null
  screenshots: string[]
  releaseDate: string | null
  genres: string[]
  platforms: string[]
  gameModes: string[]
  developers: string[]
  publishers: string[]
  rating: number | null
  ratingCount: number
  igdbUrl: string | null
  board: {
    rank: number | null
    totalCents: number
    directorCents: number
    directorTitle: string | null
  }
}

const open = defineModel<boolean>('open', { default: false })
const gameId = defineModel<number | null>('gameId', { default: null })

const openBidModal = inject<(preset?: BidModalPreset) => void>('openBidModal', () => {})
const config = useRuntimeConfig()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const embedCopied = ref(false)
const isMobile = ref(false)

onMounted(() => {
  const mq = window.matchMedia('(max-width: 639px)')
  const sync = () => {
    isMobile.value = mq.matches
  }
  sync()
  mq.addEventListener('change', sync)
  onUnmounted(() => mq.removeEventListener('change', sync))
})

const modalUi = computed(() => ({
  overlay: 'bg-[var(--play-ink)]/40',
  content: isMobile.value
    ? 'w-full max-w-none max-h-none h-dvh overflow-y-auto rounded-none border-0 shadow-none ring-0 divide-y-0'
    : 'w-full max-w-2xl max-h-[min(92dvh,52rem)] overflow-y-auto rounded-[1.75rem] border-2 border-[var(--play-rim)] shadow-none ring-0 divide-y-0',
  header: `sticky top-0 z-10 border-b-2 border-[var(--play-rim)] bg-[var(--play-soft)]/95 backdrop-blur-sm ${overlayHeaderUi.header}`,
  body: 'bg-[var(--play-panel)]',
  footer: 'sticky bottom-0 border-t-2 border-[var(--play-rim)] bg-[var(--play-soft)]/95 backdrop-blur-sm',
  title: 'font-display text-xl font-bold text-[var(--play-ink)] sm:text-2xl',
  description: 'mt-1 text-sm text-muted text-pretty',
  wrapper: overlayHeaderUi.wrapper,
  close: overlayCloseUi
}))

const detail = ref<GameDetail | null>(null)
const pending = ref(false)
const loadError = ref('')

const embedSnippet = computed(() => {
  if (!detail.value) return ''
  const siteUrl = String(config.public.siteUrl).replace(/\/$/, '')
  return `<img src="${siteUrl}/embed/${detail.value.id}.svg" alt="${detail.value.title} on mybestgame.lol" />`
})

async function copyEmbed() {
  if (!embedSnippet.value) return
  try {
    await navigator.clipboard.writeText(embedSnippet.value)
    embedCopied.value = true
    setTimeout(() => { embedCopied.value = false }, 2000)
  } catch {
    embedCopied.value = false
  }
}

watch([open, gameId], async ([isOpen, id]) => {
  if (!isOpen || !id) {
    detail.value = null
    loadError.value = ''
    return
  }

  pending.value = true
  loadError.value = ''

  try {
    detail.value = await $fetch<GameDetail>(`/api/games/${id}`)
  } catch {
    loadError.value = 'Could not load game details.'
    detail.value = null
  } finally {
    pending.value = false
  }
}, { immediate: true })

function formatDollars(cents: number) {
  return new Intl.NumberFormat(locale.value === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(cents / 100)
}

function formatReleaseDate(isoDate: string | null) {
  if (!isoDate) return null
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat(locale.value === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

function joinList(items: string[], max = 4) {
  if (items.length === 0) return null
  if (items.length <= max) return items.join(', ')
  return `${items.slice(0, max).join(', ')} +${items.length - max}`
}

function startSupport() {
  if (!detail.value) return
  open.value = false
  openBidModal({
    gameId: detail.value.id,
    title: detail.value.title,
    slug: detail.value.slug,
    coverUrl: detail.value.coverUrl
  })
}

const metaRows = computed(() => {
  if (!detail.value) return []

  const rows: { label: string, value: string }[] = []
  const released = formatReleaseDate(detail.value.releaseDate)
  if (released) rows.push({ label: t('gameDetail.released'), value: released })

  const developers = joinList(detail.value.developers)
  if (developers) rows.push({ label: t('gameDetail.developers'), value: developers })

  const publishers = joinList(detail.value.publishers)
  if (publishers) rows.push({ label: t('gameDetail.publishers'), value: publishers })

  const genres = joinList(detail.value.genres)
  if (genres) rows.push({ label: t('gameDetail.genres'), value: genres })

  const platforms = joinList(detail.value.platforms, 5)
  if (platforms) rows.push({ label: t('gameDetail.platforms'), value: platforms })

  const modes = joinList(detail.value.gameModes)
  if (modes) rows.push({ label: t('gameDetail.modes'), value: modes })

  return rows
})
</script>

<template>
  <UModal
    v-model:open="open"
    :fullscreen="isMobile"
    :title="detail?.title ?? t('gameDetail.title')"
    :description="t('gameDetail.subtitle')"
    :close="overlayCloseButton"
    :ui="modalUi"
  >

    <template #body>
      <div
        v-if="pending"
        class="py-10 text-center text-sm text-muted"
      >
        {{ t('gameDetail.loading') }}
      </div>

      <UAlert
        v-else-if="loadError"
        color="error"
        variant="subtle"
        :title="loadError"
      />

      <div
        v-else-if="detail"
        class="space-y-4"
      >
        <div class="flex flex-col gap-4 sm:flex-row">
          <GameCover
            :src="detail.coverUrl"
            :alt="detail.title"
            class="aspect-[3/4] w-28 shrink-0 self-start rounded-2xl border-2 border-[var(--play-rim)] object-cover sm:w-28"
          />

          <div class="min-w-0 flex-1 space-y-3">
            <div class="flex flex-wrap gap-2">
              <div
                v-if="detail.board.rank"
                class="rounded-xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)] px-2.5 py-1.5"
              >
                <p class="text-[0.65rem] font-medium text-muted">
                  {{ t('gameDetail.boardRank') }}
                </p>
                <p class="font-display text-lg font-bold leading-none text-primary">
                  #{{ detail.board.rank }}
                </p>
              </div>

              <div class="rounded-xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)] px-2.5 py-1.5">
                <p class="text-[0.65rem] font-medium text-muted">
                  {{ t('card.rankTotal') }}
                </p>
                <p class="font-display text-lg font-bold leading-none tabular-nums text-[var(--play-ink)]">
                  {{ formatDollars(detail.board.totalCents) }}
                </p>
              </div>

              <div
                v-if="detail.rating != null"
                class="rounded-xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)] px-2.5 py-1.5"
              >
                <p class="text-[0.65rem] font-medium text-muted">
                  {{ t('gameDetail.igdbScore') }}
                </p>
                <p class="font-display text-lg font-bold leading-none tabular-nums text-[var(--play-ink)]">
                  {{ detail.rating }}
                  <span
                    v-if="detail.ratingCount > 0"
                    class="text-xs font-medium text-muted"
                  >/ {{ detail.ratingCount.toLocaleString() }}</span>
                </p>
              </div>
            </div>

            <p
              v-if="detail.board.directorTitle"
              class="text-sm text-muted text-pretty"
            >
              {{ t('gameDetail.directorLabel') }}:
              <span class="font-semibold text-[var(--play-ink)]">{{ detail.board.directorTitle }}</span>
              · {{ formatDollars(detail.board.directorCents) }}
            </p>
            <p
              v-else
              class="text-sm text-muted"
            >
              {{ t('gameDetail.noDirectorYet') }}
            </p>

            <a
              v-if="detail.igdbUrl"
              :href="detail.igdbUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              {{ t('gameDetail.viewOnIgdb') }}
              <UIcon
                name="i-lucide-arrow-up-right"
                class="size-3.5"
              />
            </a>

            <NuxtLink
              v-if="detail.slug"
              :to="localePath(`/is/${detail.slug}`)"
              class="block text-sm font-semibold text-[var(--play-ink)]/70 underline decoration-[var(--play-rim)] underline-offset-2 transition-colors hover:text-primary"
              @click="open = false"
            >
              {{ t('gameDetail.isBestLink') }}
            </NuxtLink>
          </div>
        </div>

        <div class="rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)]/50 px-3.5 py-3">
          <p
            v-if="detail.summary"
            class="text-sm leading-relaxed text-[var(--play-ink)] text-pretty"
          >
            {{ detail.summary }}
          </p>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ t('gameDetail.noSummary') }}
          </p>
        </div>

        <section
          v-if="detail.screenshots.length > 0"
          class="space-y-2"
        >
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="font-display text-sm font-bold text-[var(--play-ink)]">
              {{ t('gameDetail.screenshots') }}
            </h3>
            <span class="text-xs text-muted">{{ detail.screenshots.length }}</span>
          </div>

          <div class="game-gallery">
            <a
              v-for="(url, index) in detail.screenshots"
              :key="`shot-${index}`"
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              class="game-gallery__item game-gallery__item--shot relative block"
            >
              <img
                :src="url"
                :alt="`${detail.title} screenshot ${index + 1}`"
                class="absolute inset-0 block size-full object-cover"
                loading="lazy"
                decoding="async"
              >
            </a>
          </div>
        </section>

        <dl
          v-if="metaRows.length > 0"
          class="grid gap-2 sm:grid-cols-2"
        >
          <div
            v-for="row in metaRows"
            :key="row.label"
            class="rounded-xl border-2 border-[var(--play-rim)] bg-[var(--play-panel)] px-3 py-2.5"
          >
            <dt class="text-xs font-medium text-muted">
              {{ row.label }}
            </dt>
            <dd class="mt-0.5 text-sm font-semibold text-[var(--play-ink)] text-pretty">
              {{ row.value }}
            </dd>
          </div>
        </dl>

        <details class="rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)]/40 px-3.5 py-3">
          <summary class="cursor-pointer font-display text-sm font-bold text-[var(--play-ink)]">
            {{ t('gameDetail.embedBadge') }}
          </summary>
          <pre class="mt-2 overflow-x-auto text-xs text-[var(--play-ink)]">{{ embedSnippet }}</pre>
          <UButton
            size="sm"
            variant="soft"
            color="neutral"
            class="mt-2 rounded-xl border-2"
            @click="copyEmbed"
          >
            {{ embedCopied ? t('common.copied') : t('gameDetail.copyEmbed') }}
          </UButton>
        </details>
      </div>
    </template>

    <template
      v-if="detail && !pending && !loadError"
      #footer
    >
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
        <UButton
          class="arcade-cta w-full sm:w-auto"
          @click="startSupport"
        >
          {{ t('gameDetail.supportGame') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
