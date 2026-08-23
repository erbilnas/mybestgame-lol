<script setup lang="ts">
import { overlayCloseButton, overlayHeaderUi } from '~/utils/overlay-close'

const { t, tm, rt } = useI18n()
const { rulesOpen } = useSiteHelp()

/** One icon per rules.items entry — keep in sync with locale item order. */
const RULE_ICONS = [
  'i-lucide-circle-dollar-sign',
  'i-lucide-layers',
  'i-lucide-megaphone',
  'i-lucide-arrow-up-right',
  'i-lucide-timer',
  'i-lucide-badge-check',
  'i-lucide-ban',
  'i-lucide-user-round',
  'i-lucide-refresh-cw'
] as const
</script>

<template>
  <USlideover
    v-model:open="rulesOpen"
    :title="t('rules.title')"
    :close="overlayCloseButton"
    :ui="{
      content: 'rounded-l-[1.75rem] border-l-2 border-[var(--play-rim)] shadow-none ring-0',
      title: 'font-display text-xl font-bold text-[var(--play-ink)] pr-2',
      ...overlayHeaderUi
    }"
  >
    <template #body>
      <ol class="space-y-3">
        <li
          v-for="(rule, index) in (tm('rules.items') as string[])"
          :key="index"
          class="flex gap-3 text-sm leading-relaxed text-[var(--play-ink)]"
        >
          <span
            class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)] text-primary"
            aria-hidden="true"
          >
            <UIcon
              :name="RULE_ICONS[index] ?? 'i-lucide-circle'"
              class="size-4"
            />
          </span>
          <span class="pt-1 text-pretty">
            <span class="sr-only">{{ index + 1 }}. </span>
            {{ rt(rule) }}
          </span>
        </li>
      </ol>
    </template>
  </USlideover>
</template>
