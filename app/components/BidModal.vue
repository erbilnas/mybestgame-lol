<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { overlayCloseButton, overlayCloseUi, overlayHeaderUi } from '~/utils/overlay-close'

export interface BidModalPreset {
  type?: 'game' | 'sponsor'
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
const isMobile = useMediaQuery('(max-width: 639px)')
const bidType = ref<'game' | 'sponsor'>('game')
const selectedGame = ref<{ id: number, title: string, slug: string, coverUrl: string | null } | null>(null)
const amount = ref(5)
const displayName = ref('')
const adTitle = ref('')
const adDescription = ref('')
const adLink = ref('')
const adImage = ref('')
const submitting = ref(false)
const error = ref('')
const turnstileToken = ref('')
const turnstileWidgetId = ref<string | null>(null)
const turnstileError = ref('')
const sponsorDetailsOpen = ref(false)
const useFreeSupport = ref(false)
const freeEligible = ref(false)
const freeEligibilityLoaded = ref(false)

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

const linkFavicon = computed(() => {
  if (adImage.value.trim()) return null
  return faviconFromUrl(adLink.value, 64)
})

const gameQuote = ref<{
  incrementCents: number
  currentTotalCents: number
  projectedTotalCents: number
  projectedRank: number
} | null>(null)

const sponsorQuote = ref<{
  incrementCents: number
  currentSponsorCents: number
  minSponsorBidCents: number
} | null>(null)

let quoteTimer: ReturnType<typeof setTimeout> | undefined

function applyPreset(next: BidModalPreset) {
  bidType.value = next.type ?? 'game'
  amount.value = next.amountDollars ?? (bidType.value === 'sponsor' ? 1 : 5)

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
  freeEligibilityLoaded.value = false
  try {
    const result = await $fetch<{ eligible: boolean }>('/api/bids/free-eligibility')
    freeEligible.value = result.eligible
    if (!result.eligible) {
      useFreeSupport.value = false
    }
  } catch {
    freeEligible.value = false
    useFreeSupport.value = false
  } finally {
    freeEligibilityLoaded.value = true
  }
}

watch(useFreeSupport, (enabled) => {
  if (enabled) {
    amount.value = 1
  }
})

watch([selectedGame, amount, bidType], () => {
  clearTimeout(quoteTimer)
  gameQuote.value = null
  sponsorQuote.value = null

  if (!selectedGame.value || amount.value < 1) return

  quoteTimer = setTimeout(async () => {
    try {
      const result = await $fetch<Record<string, number> & { bidType: string }>('/api/bids/quote', {
        query: {
          type: bidType.value,
          gameId: selectedGame.value!.id,
          amount: amount.value
        }
      })

      if (result.bidType === 'sponsor') {
        sponsorQuote.value = {
          incrementCents: result.incrementCents ?? 0,
          currentSponsorCents: result.currentSponsorCents ?? 0,
          minSponsorBidCents: result.minSponsorBidCents ?? 100
        }
        gameQuote.value = null
        return
      }

      gameQuote.value = {
        incrementCents: result.incrementCents ?? 0,
        currentTotalCents: result.currentTotalCents ?? 0,
        projectedTotalCents: result.projectedTotalCents ?? 0,
        projectedRank: result.projectedRank ?? 1
      }
      sponsorQuote.value = null
    } catch {
      gameQuote.value = null
      sponsorQuote.value = null
    }
  }, 250)
})

watch(bidType, (type) => {
  if (type === 'sponsor') {
    useFreeSupport.value = false
    sponsorDetailsOpen.value = false
    if (sponsorQuote.value) {
      amount.value = Math.ceil(sponsorQuote.value.minSponsorBidCents / 100)
    }
  }
})

watch(sponsorQuote, (quote) => {
  if (bidType.value === 'sponsor' && quote && amount.value * 100 < quote.minSponsorBidCents) {
    amount.value = Math.ceil(quote.minSponsorBidCents / 100)
  }
})

const bidTypeHelp = computed(() => {
  if (bidType.value === 'game') {
    return t('bid.gameHelpStack')
  }

  if (sponsorQuote.value && sponsorQuote.value.currentSponsorCents > 0) {
    const current = Math.ceil(sponsorQuote.value.currentSponsorCents / 100)
    const min = Math.ceil(sponsorQuote.value.minSponsorBidCents / 100)
    return t('bid.sponsorHeldAt', { current, min })
  }

  return t('bid.sponsorNoClaim')
})

const amountHint = computed(() => {
  if (useFreeSupport.value && bidType.value === 'game') {
    return t('bid.freeHint')
  }

  if (bidType.value === 'game') {
    return t('bid.amountHintGame')
  }

  if (sponsorQuote.value) {
    const min = Math.ceil(sponsorQuote.value.minSponsorBidCents / 100)
    if (sponsorQuote.value.currentSponsorCents > 0) {
      return t('bid.amountHintSponsorBeat', { min })
    }
    return t('bid.amountHintSponsorFirst')
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
  sponsorDetailsOpen.value = false
  useFreeSupport.value = false
  preset.value = {}
})

async function submit() {
  error.value = ''

  if (!selectedGame.value) {
    error.value = t('bid.errorPickGame')
    return
  }

  if (bidType.value === 'sponsor' && (!adTitle.value.trim() || !adLink.value.trim())) {
    sponsorDetailsOpen.value = true
    error.value = t('bid.errorSponsorRequired')
    return
  }

  if (bidType.value === 'sponsor' && !adDescription.value.trim()) {
    sponsorDetailsOpen.value = true
    error.value = t('bid.errorSponsorDescRequired')
    return
  }

  if (bidType.value === 'sponsor' && sponsorQuote.value && amount.value * 100 < sponsorQuote.value.minSponsorBidCents) {
    error.value = t('bid.errorSponsorMin', { min: Math.ceil(sponsorQuote.value.minSponsorBidCents / 100) })
    return
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

  try {
    if (bidType.value === 'game' && useFreeSupport.value) {
      const result = await $fetch<{ bidId: string }>('/api/bids/claim-free', {
        method: 'POST',
        body: {
          gameId: selectedGame.value.id,
          title: selectedGame.value.title,
          slug: selectedGame.value.slug,
          coverUrl: selectedGame.value.coverUrl,
          displayName: displayName.value,
          turnstileToken: turnstileToken.value
        }
      })

      freeEligible.value = false
      useFreeSupport.value = false
      window.location.href = `${localePath('/success')}?bid_id=${encodeURIComponent(result.bidId)}`
      return
    }

    const result = await $fetch<{ checkoutUrl: string }>('/api/bids/create-checkout', {
      method: 'POST',
      body: {
        bidType: bidType.value,
        gameId: selectedGame.value.id,
        title: selectedGame.value.title,
        slug: selectedGame.value.slug,
        coverUrl: selectedGame.value.coverUrl,
        amount: amount.value,
        displayName: displayName.value,
        adTitle: bidType.value === 'sponsor' ? adTitle.value : undefined,
        adDescription: bidType.value === 'sponsor' ? adDescription.value : undefined,
        adLink: bidType.value === 'sponsor' ? adLink.value : undefined,
        adImage: bidType.value === 'sponsor' ? adImage.value || undefined : undefined,
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
        <div
          class="grid grid-cols-2 gap-1.5 rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)] p-1.5"
          role="tablist"
          :aria-label="t('bid.title')"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="bidType === 'game'"
            class="min-w-0 truncate rounded-xl px-3 py-2.5 text-sm font-bold transition-colors"
            :class="bidType === 'game'
              ? 'bg-[var(--play-panel)] text-[var(--play-ink)] border-2 border-[var(--play-rim)]'
              : 'border-2 border-transparent text-muted hover:text-[var(--play-ink)]'"
            @click="bidType = 'game'"
          >
            {{ t('bid.supportGame') }}
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="bidType === 'sponsor'"
            class="min-w-0 truncate rounded-xl px-3 py-2.5 text-sm font-bold transition-colors"
            :class="bidType === 'sponsor'
              ? 'bg-[var(--play-panel)] text-[var(--play-ink)] border-2 border-[var(--play-rim)]'
              : 'border-2 border-transparent text-muted hover:text-[var(--play-ink)]'"
            @click="bidType = 'sponsor'"
          >
            {{ t('bid.claimSponsor') }}
          </button>
        </div>

        <div class="rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)]/70 px-3.5 py-3">
          <p class="text-sm text-muted text-pretty">
            {{ bidTypeHelp }}
          </p>
        </div>

        <UFormField
          :label="t('bid.gameLabel')"
          :description="t('bid.gameDesc')"
        >
          <GameSearch v-model="selectedGame" />
        </UFormField>

        <UFormField
          :label="bidType === 'game' ? t('bid.supportAmount') : t('bid.sponsorBid')"
          :description="amountHint"
          :error="amountError"
        >
          <UInput
            v-model.number="amount"
            type="number"
            :min="bidType === 'sponsor' && sponsorQuote ? Math.ceil(sponsorQuote.minSponsorBidCents / 100) : 1"
            :max="MAX_BID_DOLLARS"
            step="1"
            :disabled="useFreeSupport"
            class="w-full font-display text-lg font-bold tabular-nums"
          />
        </UFormField>

        <div
          v-if="bidType === 'game' && freeEligibilityLoaded && freeEligible"
          class="rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)]/70 px-3.5 py-3"
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
          v-else-if="bidType === 'game' && freeEligibilityLoaded && !freeEligible"
          class="text-xs text-muted text-pretty"
        >
          {{ t('bid.freeUsed') }}
        </p>

        <div
          v-if="bidType === 'game' && gameQuote"
          class="rounded-2xl border-2 border-[var(--color-play-sun)]/50 bg-[color-mix(in_oklab,var(--color-play-sun)_12%,white)] px-3.5 py-3 text-sm text-[var(--play-ink)] text-pretty"
        >
          {{ useFreeSupport
            ? t('bid.quoteGameFree', { total: (gameQuote.projectedTotalCents / 100).toFixed(0), rank: gameQuote.projectedRank })
            : t('bid.quoteGame', { amount, total: (gameQuote.projectedTotalCents / 100).toFixed(0), rank: gameQuote.projectedRank }) }}
        </div>

        <div
          v-else-if="bidType === 'sponsor' && sponsorQuote"
          class="rounded-2xl border-2 border-[var(--color-play-sky)]/45 bg-[color-mix(in_oklab,var(--color-play-sky)_10%,white)] px-3.5 py-3 text-sm text-[var(--play-ink)] text-pretty"
        >
          <template v-if="sponsorQuote.currentSponsorCents > 0">
            {{ t('bid.quoteSponsorHeld', { current: Math.ceil(sponsorQuote.currentSponsorCents / 100), amount, min: Math.ceil(sponsorQuote.minSponsorBidCents / 100) }) }}
          </template>
          <template v-else>
            {{ t('bid.quoteSponsorFirst', { amount }) }}
          </template>
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

        <template v-if="bidType === 'sponsor'">
          <div class="rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)]/40">
            <button
              type="button"
              class="flex w-full items-start justify-between gap-3 p-3.5 text-left sm:p-4"
              :aria-expanded="sponsorDetailsOpen"
              @click="sponsorDetailsOpen = !sponsorDetailsOpen"
            >
              <div class="space-y-1">
                <p class="font-display text-sm font-bold text-[var(--play-ink)]">
                  {{ t('bid.sponsorDetails') }}
                </p>
                <p class="text-xs text-muted text-pretty">
                  {{ t('bid.sponsorDetailsDesc') }}
                </p>
              </div>
              <UIcon
                :name="sponsorDetailsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="mt-0.5 size-4 shrink-0 text-muted"
              />
            </button>

            <div
              v-show="sponsorDetailsOpen"
              class="space-y-4 border-t-2 border-[var(--play-rim)] px-3.5 pt-4 pb-3.5 sm:px-4 sm:pb-4"
            >
              <UFormField
                :label="t('bid.adTitleLabel')"
                :description="t('bid.adTitleDesc')"
              >
                <UInput
                  v-model="adTitle"
                  :placeholder="t('bid.adTitlePlaceholder')"
                  required
                  class="w-full"
                />
              </UFormField>

              <UFormField
                :label="t('bid.adDescLabel')"
                :description="t('bid.adDescDesc')"
              >
                <UTextarea
                  v-model="adDescription"
                  :rows="3"
                  maxlength="280"
                  :placeholder="t('bid.adDescPlaceholder')"
                  required
                  class="w-full"
                />
              </UFormField>

              <UFormField
                :label="t('bid.adLinkLabel')"
                :description="t('bid.adLinkDesc')"
              >
                <div class="flex items-center gap-2.5">
                  <div
                    v-if="linkFavicon"
                    class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--play-rim)] bg-[var(--play-panel)]"
                  >
                    <img
                      :src="linkFavicon"
                      alt=""
                      class="size-6 object-contain"
                    >
                  </div>
                  <UInput
                    v-model="adLink"
                    type="url"
                    :placeholder="t('bid.adLinkPlaceholder')"
                    required
                    class="w-full min-w-0 flex-1"
                  />
                </div>
              </UFormField>

              <UFormField
                :label="t('bid.adImageLabel')"
                :description="linkFavicon ? t('bid.adImageDescFavicon') : t('bid.adImageDescUrl')"
              >
                <UInput
                  v-model="adImage"
                  type="url"
                  :placeholder="t('bid.adImagePlaceholder')"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
        </template>

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
          {{ bidType === 'sponsor'
            ? t('bid.submitSponsor')
            : useFreeSupport
              ? t('bid.submitFree')
              : t('bid.submitSupport') }}
        </UButton>
      </form>
    </template>
  </UModal>
</template>
