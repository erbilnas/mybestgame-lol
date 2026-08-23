<script setup lang="ts">
import type { CommandPaletteGroup } from '@nuxt/ui'
import type { LeaderboardContributor } from './Leaderboard.vue'

const props = defineProps<{
  contributors: LeaderboardContributor[]
  formatDollars: (cents: number) => string
}>()

const { t } = useI18n()
const open = ref(false)
const searchTerm = ref('')

watch(open, (isOpen) => {
  if (!isOpen) searchTerm.value = ''
})

function timeAgo(isoDate: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000))
  if (minutes < 60) return t('common.mAgo', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return t('common.hAgo', { n: hours })
  return t('common.dAgo', { n: Math.floor(hours / 24) })
}

function keepOpen(event: Event) {
  event.preventDefault()
}

const countLabel = computed(() => {
  const count = props.contributors.length
  return t('contributors.count', { count })
})

const groups = computed<CommandPaletteGroup[]>(() => [{
  id: 'contributors',
  items: props.contributors.map((contributor, index) => {
    const bids = contributor.bidCount ?? 1
    const when = timeAgo(contributor.at)

    return {
      id: String(index),
      label: contributor.label,
      suffix: props.formatDollars(contributor.amountCents),
      description: bids > 1 ? `${t('contributors.bids', { count: bids })} · ${when}` : when,
      onSelect: keepOpen
    }
  })
}])
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
    :ui="{
      content: 'arcade-shell w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0 ring-0 shadow-none'
    }"
  >
    <button
      type="button"
      class="text-xs font-medium text-[var(--play-ink)] transition-colors hover:text-primary"
    >
      {{ countLabel }}
    </button>

    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
        :placeholder="t('contributors.searchPlaceholder')"
        :fuse="{
          resultLimit: 500,
          matchAllWhenSearchEmpty: true,
          fuseOptions: {
            ignoreLocation: true,
            threshold: 0.2,
            keys: ['label', 'suffix', 'description']
          }
        }"
        class="max-h-80"
      >
        <template #empty="{ searchTerm: term }">
          <p class="px-3 py-6 text-center text-sm text-muted">
            {{ term ? t('contributors.noMatch') : t('contributors.none') }}
          </p>
        </template>
      </UCommandPalette>
    </template>
  </UPopover>
</template>
