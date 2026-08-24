<script setup lang="ts">
import {
  DIRECTOR_DESC_RAW_MAX,
  DIRECTOR_DESC_VISIBLE_MAX,
  MARKDOWN_GUIDE_URL,
  markdownVisibleLength
} from '#shared/utils/director-markdown'
import { overlayCloseButton, overlayCloseUi, overlayHeaderUi } from '~/utils/overlay-close'

export interface BidModalPreset {
  gameId?: number
  title?: string
  slug?: string
  coverUrl?: string | null
  amountDollars?: number
}

const open = defineModel<boolean>('open', { default: false })
const preset = defineModel<BidModalPreset>('preset', { default: () => ({}) })

const { t, locale } = useI18n()
const config = useRuntimeConfig()
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
const selectedGame = ref<{ id: number, title: string, slug: string, coverUrl: string | null } | null>(null)
const amount = ref(5)
const displayName = ref('')
const adTitle = ref('')
const adDescription = ref('')
const submitting = ref(false)
const error = ref('')
const turnstileToken = ref('')
const turnstileWidgetId = ref<string | null>(null)
const turnstileError = ref('')
const directorDetailsOpen = ref(false)
const useFreeSupport = ref(false)
const { eligible: freeEligible, loaded: freeEligibilityLoaded, refresh: refreshFreeEligibilityState } = useFreeEligibility()

const MAX_BID_DOLLARS = 999_999

const localePath = useLocalePath()

const modalUi = computed(() => ({
  overlay: 'bg-[var(--play-ink)]/40',
  content: isMobile.value
    ? 'w-full max-w-none max-h-none h-dvh overflow-y-auto rounded-none border-0 shadow-none ring-0 divide-y-0'
    : 'w-full max-w-lg max-h-[min(92dvh,44rem)] overflow-y-auto rounded-[1.75rem] border-2 border-[var(--play-rim)] shadow-none ring-0 divide-y-0 sm:max-h-[min(90dvh,48rem)]',
  header: `sticky top-0 z-10 border-b-2 border-[var(--play-rim)] bg-[var(--play-soft)]/95 backdrop-blur-sm ${overlayHeaderUi.header}`,
  body: 'bg-[var(--play-panel)]',
  footer: 'border-t-2 border-[var(--play-rim)] bg-[var(--play-soft)]/30',
  title: 'font-display text-xl font-bold text-[var(--play-ink)] sm:text-2xl',
  description: 'mt-1 text-sm text-muted text-pretty',
  wrapper: overlayHeaderUi.wrapper,
  close: overlayCloseUi
}))

const gameQuote = ref<{
  incrementCents: number
  currentTotalCents: number
  projectedTotalCents: number
  projectedRank: number
} | null>(null)

let quoteTimer: ReturnType<typeof setTimeout> | undefined

function applyPreset(next: BidModalPreset) {
  amount.value = useFreeSupport.value ? 1 : (next.amountDollars ?? 5)

  if (next.gameId && next.title && next.slug) {
    selectedGame.value = {
      id: next.gameId,
      title: next.title,
      slug: next.slug,
      coverUrl: next.coverUrl ?? null
    }
    return
  }

  selectedGame.value = null
}

watch(preset, applyPreset, { deep: true })

async function refreshFreeEligibility() {
  await refreshFreeEligibilityState()
  useFreeSupport.value = freeEligible.value
}

watch(useFreeSupport, (enabled) => {
  if (enabled) {
    amount.value = 1
  }
})

watch([selectedGame, amount], () => {
  clearTimeout(quoteTimer)
  gameQuote.value = null

  if (!selectedGame.value || amount.value < 1) return

  quoteTimer = setTimeout(async () => {
    try {
      const result = await $fetch<{
        incrementCents: number
        currentTotalCents: number
        projectedTotalCents: number
        projectedRank: number
      }>('/api/bids/quote', {
        query: {
          gameId: selectedGame.value!.id,
          amount: amount.value
        }
      })

      gameQuote.value = {
        incrementCents: result.incrementCents ?? 0,
        currentTotalCents: result.currentTotalCents ?? 0,
        projectedTotalCents: result.projectedTotalCents ?? 0,
        projectedRank: result.projectedRank ?? 1
      }
    } catch {
      gameQuote.value = null
    }
  }, 250)
})

const amountHint = computed(() => {
  if (useFreeSupport.value) {
    return t('bid.freeHint')
  }
  return t('bid.amountHintGame')
})

const amountError = computed(() => {
  if (useFreeSupport.value) return undefined
  if (amount.value > MAX_BID_DOLLARS) {
    return t('bid.errorAmountMax')
  }
  return undefined
})

function directorFieldsFilled(): boolean {
  return Boolean(adTitle.value.trim() || adDescription.value.trim())
}

const directorDescVisibleLen = computed(() => markdownVisibleLength(adDescription.value))

const directorDescOverLimit = computed(() =>
  directorDescVisibleLen.value > DIRECTOR_DESC_VISIBLE_MAX
    || adDescription.value.length > DIRECTOR_DESC_RAW_MAX
)

const directorDescCounter = computed(() =>
  t('bid.directorDescCounter', {
    used: directorDescVisibleLen.value,
    max: DIRECTOR_DESC_VISIBLE_MAX
  })
)

function resetTurnstile() {
  turnstileToken.value = ''
  if (!import.meta.client) return

  const turnstile = (window as unknown as { turnstile?: { reset: (id: string) => void } }).turnstile
  if (turnstile && turnstileWidgetId.value) {
    turnstile.reset(turnstileWidgetId.value)
  }
}

function setTurnstileError(message: string) {
  turnstileToken.value = ''
  turnstileError.value = message
}

function loadTurnstile() {
  if (!import.meta.client || !config.public.turnstileSiteKey) return

  const render = () => {
    const turnstile = (window as unknown as { turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id: string) => void
    } }).turnstile

    if (!turnstile) {
      setTurnstileError(t('bid.errorTurnstileLoad'))
      return
    }

    const el = document.getElementById('turnstile-widget')
    if (!el || turnstileWidgetId.value) return

    turnstileWidgetId.value = turnstile.render(el, {
      sitekey: config.public.turnstileSiteKey,
      callback: (token: string) => {
        turnstileToken.value = token
        turnstileError.value = ''
      },
      'expired-callback': () => {
        setTurnstileError(t('bid.errorTurnstileExpired'))
      },
      'error-callback': () => {
        setTurnstileError(t('bid.errorTurnstileFailed'))
      },
      'timeout-callback': () => {
        setTurnstileError(t('bid.errorTurnstileExpired'))
      }
    })
  }

  if ((window as unknown as { turnstile?: unknown }).turnstile) {
    render()
    return
  }

  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.defer = true
  script.onload = render
  script.onerror = () => {
    setTurnstileError(t('bid.errorTurnstileLoad'))
  }
  document.head.appendChild(script)
}

watch(open, (isOpen) => {
  if (isOpen) {
    applyPreset(preset.value)
    refreshFreeEligibility()
    nextTick(() => loadTurnstile())
    return
  }

  error.value = ''
  submitting.value = false
  turnstileToken.value = ''
  turnstileError.value = ''
  turnstileWidgetId.value = null
  directorDetailsOpen.value = false
  useFreeSupport.value = false
  adTitle.value = ''
  adDescription.value = ''
  preset.value = {}
})

async function submit() {
  error.value = ''

  if (!selectedGame.value) {
    error.value = t('bid.errorPickGame')
    return
  }

  if (directorFieldsFilled()) {
    if (!adTitle.value.trim()) {
      directorDetailsOpen.value = true
      error.value = t('bid.errorDirectorRequired')
      return
    }
    if (!adDescription.value.trim()) {
      directorDetailsOpen.value = true
      error.value = t('bid.errorDirectorDescRequired')
      return
    }
    if (directorDescOverLimit.value) {
      directorDetailsOpen.value = true
      error.value = t('bid.errorDirectorDescMax')
      return
    }
  }

  if (!Number.isInteger(amount.value) || amount.value < 1) {
    error.value = t('bid.amountHintGame')
    return
  }

  if (amount.value > MAX_BID_DOLLARS) {
    error.value = t('bid.errorAmountMax')
    return
  }

  if (config.public.turnstileSiteKey && !turnstileToken.value) {
    if (!turnstileError.value) {
      turnstileError.value = t('bid.errorTurnstile')
    }
    error.value = turnstileError.value
    return
  }

  submitting.value = true

  const directorBody = directorFieldsFilled()
    ? {
        adTitle: adTitle.value,
        adDescription: adDescription.value
      }
    : {}

  try {
    if (useFreeSupport.value) {
      const result = await $fetch<{ bidId: string }>('/api/bids/claim-free', {
        method: 'POST',
        body: {
          gameId: selectedGame.value.id,
          title: selectedGame.value.title,
          slug: selectedGame.value.slug,
          coverUrl: selectedGame.value.coverUrl,
          displayName: displayName.value,
          ...directorBody,
          turnstileToken: turnstileToken.value
        }
      })

      freeEligible.value = import.meta.dev
      useFreeSupport.value = import.meta.dev
      window.location.href = `${localePath('/success')}?bid_id=${encodeURIComponent(result.bidId)}`
      return
    }

    const result = await $fetch<{ checkoutUrl: string }>('/api/bids/create-checkout', {
      method: 'POST',
      body: {
        gameId: selectedGame.value.id,
        title: selectedGame.value.title,
        slug: selectedGame.value.slug,
        coverUrl: selectedGame.value.coverUrl,
        amount: amount.value,
        displayName: displayName.value,
        ...directorBody,
        turnstileToken: turnstileToken.value,
        locale: locale.value as 'en' | 'tr'
      }
    })

    window.location.href = result.checkoutUrl
  } catch (err: unknown) {
    const fetchError = err as { data?: { statusMessage?: string }, statusMessage?: string }
    const statusMessage = fetchError.data?.statusMessage ?? fetchError.statusMessage ?? ''

    if (statusMessage.includes('Turnstile')) {
      const message = t('bid.errorTurnstileFailed')
      turnstileError.value = message
      error.value = message
    } else {
      error.value = statusMessage
        || (useFreeSupport.value ? t('bid.errorFreeFallback') : t('bid.errorFallback'))
    }

    submitting.value = false
    resetTurnstile()
    if (useFreeSupport.value) {
      await refreshFreeEligibility()
    }
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :fullscreen="isMobile"
    :title="t('bid.title')"
    :description="t('bid.subtitle')"
    :close="overlayCloseButton"
    :ui="modalUi"
  >
    <template #body>
      <form
        class="space-y-5"
        @submit.prevent="submit"
      >
        <div class="rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)]/70 px-3.5 py-3">
          <p class="text-sm text-muted text-pretty">
            {{ freeEligible ? t('bid.gameHelpFree') : t('bid.gameHelpStack') }}
          </p>
        </div>

        <UFormField
          :label="t('bid.gameLabel')"
          :description="t('bid.gameDesc')"
        >
          <GameSearch v-model="selectedGame" />
        </UFormField>

        <div
          v-if="freeEligibilityLoaded && freeEligible"
          class="rounded-2xl border-2 border-[var(--color-play-sun)]/55 bg-[color-mix(in_oklab,var(--color-play-sun)_16%,white)] px-3.5 py-3"
        >
          <label class="flex cursor-pointer items-start gap-3">
            <input
              v-model="useFreeSupport"
              type="checkbox"
              class="mt-1 size-4 shrink-0 accent-[var(--play-ink)]"
            >
            <span class="min-w-0 space-y-1">
              <span class="block font-display text-sm font-bold text-[var(--play-ink)]">
                {{ t('bid.freeToggle') }}
              </span>
              <span class="block text-xs text-muted text-pretty">
                {{ t('bid.freeHint') }}
              </span>
            </span>
          </label>
        </div>

        <p
          v-else-if="freeEligibilityLoaded && !freeEligible"
          class="text-xs text-muted text-pretty"
        >
          {{ t('bid.freeUsed') }}
        </p>

        <UFormField
          :label="t('bid.supportAmount')"
          :description="amountHint"
          :error="amountError"
        >
          <UInput
            v-model.number="amount"
            type="number"
            :min="1"
            :max="MAX_BID_DOLLARS"
            step="1"
            :disabled="useFreeSupport"
            class="w-full font-display text-lg font-bold tabular-nums"
          />
        </UFormField>

        <div
          v-if="gameQuote"
          class="rounded-2xl border-2 border-[var(--color-play-sun)]/50 bg-[color-mix(in_oklab,var(--color-play-sun)_12%,white)] px-3.5 py-3 text-sm text-[var(--play-ink)] text-pretty"
        >
          {{ useFreeSupport
            ? t('bid.quoteGameFree', { total: (gameQuote.projectedTotalCents / 100).toFixed(0), rank: gameQuote.projectedRank })
            : t('bid.quoteGame', { amount, total: (gameQuote.projectedTotalCents / 100).toFixed(0), rank: gameQuote.projectedRank }) }}
        </div>

        <UFormField
          :label="t('bid.nameLabel')"
          :description="t('bid.nameDesc')"
        >
          <UInput
            v-model="displayName"
            type="text"
            maxlength="64"
            :placeholder="t('bid.namePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <div class="rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)]/40">
          <button
            type="button"
            class="flex w-full items-start justify-between gap-3 p-3.5 text-left sm:p-4"
            :aria-expanded="directorDetailsOpen"
            @click="directorDetailsOpen = !directorDetailsOpen"
          >
            <div class="space-y-1">
              <p class="font-display text-sm font-bold text-[var(--play-ink)]">
                {{ t('bid.directorDetails') }}
              </p>
              <p class="text-xs text-muted text-pretty">
                {{ t('bid.directorDetailsDesc') }}
              </p>
            </div>
            <UIcon
              :name="directorDetailsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="mt-0.5 size-4 shrink-0 text-muted"
            />
          </button>

          <div
            v-show="directorDetailsOpen"
            class="space-y-4 border-t-2 border-[var(--play-rim)] px-3.5 pt-4 pb-3.5 sm:px-4 sm:pb-4"
          >
            <UFormField
              :label="t('bid.directorTitleLabel')"
              :description="t('bid.directorTitleDesc')"
            >
              <UInput
                v-model="adTitle"
                :placeholder="t('bid.directorTitlePlaceholder')"
                class="w-full"
              />
            </UFormField>

            <UFormField
              :label="t('bid.directorDescLabel')"
              :description="t('bid.directorDescDesc')"
              :error="directorDescOverLimit ? t('bid.errorDirectorDescMax') : undefined"
            >
              <UTextarea
                v-model="adDescription"
                :rows="3"
                :maxlength="DIRECTOR_DESC_RAW_MAX"
                :placeholder="t('bid.directorDescPlaceholder')"
                class="w-full"
              />
              <p
                class="mt-1.5 text-xs tabular-nums"
                :class="directorDescOverLimit ? 'text-error' : 'text-muted'"
              >
                {{ directorDescCounter }}
              </p>
              <p class="mt-1 text-xs text-muted text-pretty">
                <a
                  :href="MARKDOWN_GUIDE_URL"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-[var(--play-ink)] underline decoration-[var(--play-rim)] underline-offset-2 hover:decoration-[var(--play-ink)]"
                >
                  {{ t('bid.directorMarkdownGuide') }}
                </a>
              </p>
            </UFormField>
          </div>
        </div>

        <div
          v-if="config.public.turnstileSiteKey"
          class="space-y-2"
        >
          <div
            id="turnstile-widget"
            class="min-h-[65px]"
          />
          <p
            v-if="turnstileError"
            class="text-sm text-error text-pretty"
            role="alert"
          >
            {{ turnstileError }}
          </p>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />

        <UButton
          type="submit"
          block
          size="lg"
          class="arcade-cta"
          :loading="submitting"
          :disabled="submitting || !!amountError || (!!config.public.turnstileSiteKey && !turnstileToken)"
        >
          {{ useFreeSupport ? t('bid.submitFree') : t('bid.submitSupport') }}
        </UButton>
      </form>
    </template>
  </UModal>
</template>
