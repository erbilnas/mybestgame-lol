<script setup lang="ts">
import { overlayCloseButton, overlayHeaderUi } from '~/utils/overlay-close'

const { t, tm, rt } = useI18n()
const { howToPlayOpen } = useSiteHelp()

/** One icon per howToPlay.steps entry — keep in sync with locale step order. */
const STEP_ICONS = [
  'i-lucide-search',
  'i-lucide-gamepad-2',
  'i-lucide-circle-dollar-sign',
  'i-lucide-shield-check',
  'i-lucide-trophy'
] as const
</script>

<template>
  <USlideover
    v-model:open="howToPlayOpen"
    :title="t('howToPlay.title')"
    :close="overlayCloseButton"
    :ui="{
      content: 'rounded-l-[1.75rem] border-l-2 border-[var(--play-rim)] shadow-none ring-0',
      title: 'font-display text-xl font-bold text-[var(--play-ink)] pr-2',
      ...overlayHeaderUi
    }"
  >
    <template #body>
      <ol class="space-y-4">
        <li
          v-for="(step, index) in (tm('howToPlay.steps') as Array<{ title: string, desc: string }>)"
          :key="index"
          class="flex gap-3"
        >
          <span
            class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--play-rim)] bg-[var(--play-soft)] text-primary"
            aria-hidden="true"
          >
            <UIcon
              :name="STEP_ICONS[index] ?? 'i-lucide-circle'"
              class="size-4"
            />
          </span>
          <div class="min-w-0 pt-0.5">
            <p class="font-display text-sm font-bold text-[var(--play-ink)]">
              <span class="sr-only">{{ index + 1 }}. </span>
              {{ rt(step.title) }}
            </p>
            <p class="mt-0.5 text-sm text-muted text-pretty">
              {{ rt(step.desc) }}
            </p>
          </div>
        </li>
      </ol>
    </template>
  </USlideover>
</template>
