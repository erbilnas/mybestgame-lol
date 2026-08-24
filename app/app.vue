<script setup lang="ts">
import type { BidModalPreset } from '~/components/BidModal.vue'

const BidModal = defineAsyncComponent(() => import('~/components/BidModal.vue'))
const RulesSlideover = defineAsyncComponent(() => import('~/components/RulesSlideover.vue'))
const HowToPlaySlideover = defineAsyncComponent(() => import('~/components/HowToPlaySlideover.vue'))

const { t } = useI18n()
const localePath = useLocalePath()
const { eligible: freeEligible, refresh: refreshFreeEligibility } = useFreeEligibility()

onMounted(() => {
  refreshFreeEligibility()
})

const bidModalOpen = ref(false)
const bidModalPreset = ref<BidModalPreset>({})

function openBidModal(preset: BidModalPreset = {}) {
  bidModalPreset.value = preset
  bidModalOpen.value = true
}

provide('openBidModal', openBidModal)

const route = useRoute()
const heroBiddingVisible = useState('hero-bidding-visible', () => true)
const isHomePage = computed(() => isHomeRoute(route.path))
const showHeader = computed(() => !isHomePage.value || !heroBiddingVisible.value)

watch(() => route.path, (path, previous) => {
  if (previous && isHomeRoute(previous) && !isHomeRoute(path)) {
    heroBiddingVisible.value = true
  }
})

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    class: 'light'
  }
})

useSiteSeo({
  title: () => t('seo.title'),
  description: () => t('seo.description'),
  keywords: () => t('seo.keywords')
})

const footerYear = new Date().getFullYear()

const footerLegalLinks = computed(() => [
  { to: localePath('/privacy'), label: t('footer.privacy') },
  { to: localePath('/terms'), label: t('footer.terms') },
  { to: localePath('/gdpr'), label: t('footer.gdpr') },
  { to: localePath('/cookies'), label: t('footer.cookies') },
  { to: localePath('/refunds'), label: t('footer.refunds') }
])
</script>

<template>
  <UApp>
    <header
      v-show="showHeader"
      class="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4"
    >
      <div
        class="arcade-shell mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 overflow-visible rounded-[1.5rem] bg-[var(--play-panel)] px-3 sm:h-16 sm:gap-4 sm:px-6"
      >
        <NuxtLink
          :to="localePath('/')"
          class="group flex min-w-0 items-center gap-3"
        >
          <span
            class="font-display truncate text-lg font-bold tracking-tight text-[var(--play-ink)] sm:text-2xl"
            aria-label="mybestgame"
          >
            mybest<span class="text-primary">game</span>
          </span>
        </NuxtLink>

        <div class="flex shrink-0 items-center justify-end gap-0.5 sm:gap-2">
          <SiteNavActions />
          <UButton
            class="arcade-cta hidden sm:inline-flex"
            @click="openBidModal()"
          >
            {{ freeEligible ? t('nav.placeBidFree') : t('nav.placeBid') }}
          </UButton>
          <UButton
            class="arcade-cta sm:hidden"
            icon="i-lucide-plus"
            :aria-label="freeEligible ? t('nav.placeBidFree') : t('nav.placeBid')"
            @click="openBidModal()"
          />
        </div>
      </div>
    </header>

    <UMain class="min-h-[calc(100dvh-8rem)]">
      <NuxtPage />
    </UMain>

    <footer class="relative mt-10 px-3 pb-6 sm:px-6 sm:pb-8">
      <div class="arcade-shell relative mx-auto max-w-6xl overflow-hidden rounded-[1.5rem]">
        <p
          class="pointer-events-none absolute inset-x-3 bottom-0 translate-y-[22%] select-none font-display text-[clamp(3.25rem,16vw,5.75rem)] font-bold leading-none text-[color-mix(in_oklab,var(--play-ink)_7%,transparent)] sm:inset-x-5"
          aria-hidden="true"
        >
          mybestgame
        </p>

        <div class="relative z-[1] grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-10 sm:p-6">
          <div class="space-y-2">
            <NuxtLink
              :to="localePath('/')"
              class="inline-flex min-h-[44px] items-center font-display text-xl font-bold tracking-tight text-[var(--play-ink)] transition-colors hover:text-primary sm:text-2xl"
            >
              mybest<span class="text-primary">game</span>
            </NuxtLink>
            <p class="max-w-sm font-display text-base font-bold text-[var(--play-ink)] text-pretty sm:text-lg">
              {{ t('footer.tagline') }}
            </p>
            <p class="max-w-sm text-sm text-muted text-pretty">
              {{ t('footer.desc') }}
            </p>
          </div>

          <nav
            class="min-w-[9.5rem] sm:pt-1"
            :aria-label="t('footer.legalNav')"
          >
            <p class="mb-2 text-sm font-semibold text-[var(--play-ink)]">
              {{ t('footer.legalNav') }}
            </p>
            <ul class="grid grid-cols-2 gap-x-4 sm:grid-cols-1">
              <li
                v-for="link in footerLegalLinks"
                :key="link.to"
              >
                <NuxtLink
                  :to="link.to"
                  class="inline-flex min-h-[44px] items-center text-sm text-muted transition-colors hover:text-[var(--play-ink)]"
                >
                  {{ link.label }}
                </NuxtLink>
              </li>
              <li>
                <a
                  href="/rss/takeovers.xml"
                  class="inline-flex min-h-[44px] items-center text-sm text-muted transition-colors hover:text-[var(--play-ink)]"
                >
                  {{ t('footer.rssTakeovers') }}
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div class="relative z-[1] border-t border-[var(--play-rim)]/60 px-5 py-3 sm:px-6">
          <p class="text-xs text-muted">
            {{ t('footer.copyrightBefore', { year: footerYear }) }}<a
              href="https://erbilnas.com"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-[var(--play-ink)]/70 underline decoration-[var(--play-rim)] underline-offset-2 transition-colors hover:text-primary"
            >Erbil Nas</a>{{ t('footer.copyrightAfter') }}
          </p>
        </div>
      </div>
    </footer>

    <BidModal
      v-model:open="bidModalOpen"
      v-model:preset="bidModalPreset"
    />
    <RulesSlideover />
    <HowToPlaySlideover />
  </UApp>
</template>
