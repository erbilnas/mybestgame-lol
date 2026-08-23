<script setup lang="ts">
withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false
})

const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const { openRules, openHowToPlay } = useSiteHelp()

const localeMenuOpen = ref(false)

const buttonClass = 'min-h-[44px] px-2 text-muted transition-colors hover:text-[var(--play-ink)]'

const localePopover = {
  align: 'end' as const,
  side: 'bottom' as const,
  sideOffset: 6,
  positionStrategy: 'fixed' as const,
  updatePositionStrategy: 'always' as const
}
</script>

<template>
  <div
    class="flex shrink-0 items-center"
    :class="compact ? 'justify-center gap-0' : 'justify-end gap-0.5 sm:gap-2'"
  >
    <UButton
      variant="ghost"
      color="neutral"
      :class="buttonClass"
      :aria-label="t('nav.rules')"
      @click="openRules()"
    >
      <span :class="compact ? 'hidden text-xs font-medium sm:inline sm:text-sm' : 'hidden sm:inline'">{{ t('nav.rules') }}</span>
      <UIcon
        v-if="compact"
        name="i-lucide-scroll-text"
        class="size-4 sm:hidden"
      />
    </UButton>
    <UButton
      variant="ghost"
      color="neutral"
      :class="buttonClass"
      :aria-label="t('nav.howToPlay')"
      @click="openHowToPlay()"
    >
      <span :class="compact ? 'hidden text-xs font-medium md:inline md:text-sm' : 'hidden md:inline'">{{ t('nav.howToPlay') }}</span>
      <UIcon
        v-if="compact"
        name="i-lucide-circle-question-mark"
        class="size-4 md:hidden"
      />
    </UButton>

    <UPopover
      v-model:open="localeMenuOpen"
      :content="localePopover"
      :ui="{
        content: 'locale-picker z-[200] w-[11.5rem] rounded-2xl border-2 border-[var(--play-rim)] bg-[var(--play-panel)] p-1.5 shadow-[0_8px_24px_color-mix(in_oklab,var(--play-ink)_12%,transparent)] ring-0'
      }"
    >
      <UButton
        variant="ghost"
        color="neutral"
        :class="[buttonClass, localeMenuOpen ? 'text-[var(--play-ink)]' : '']"
        :aria-label="t('nav.language')"
        :aria-expanded="localeMenuOpen"
        aria-haspopup="listbox"
      >
        <span :class="compact ? 'text-xs font-semibold sm:text-sm' : 'font-semibold'">{{ t(`locale.${locale}`) }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-3.5 text-muted transition-transform sm:size-4"
          :class="{ 'rotate-180': localeMenuOpen }"
        />
      </UButton>

      <template #content>
        <ul
          role="listbox"
          :aria-label="t('nav.language')"
          class="flex flex-col gap-0.5"
        >
          <li
            v-for="entry in locales"
            :key="entry.code"
          >
            <NuxtLink
              :to="switchLocalePath(entry.code)"
              role="option"
              :aria-selected="locale === entry.code"
              class="locale-picker__option"
              :class="{ 'locale-picker__option--active': locale === entry.code }"
              @click="localeMenuOpen = false"
            >
              <span class="locale-picker__code">{{ t(`locale.${entry.code}`) }}</span>
              <span class="locale-picker__name">{{ entry.name }}</span>
              <UIcon
                v-if="locale === entry.code"
                name="i-lucide-check"
                class="locale-picker__check"
              />
            </NuxtLink>
          </li>
        </ul>
      </template>
    </UPopover>
  </div>
</template>

<style scoped>
.locale-picker__option {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr) 1rem;
  align-items: center;
  gap: 0.25rem;
  min-height: 2.75rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.75rem;
  color: var(--play-ink);
  transition: background-color 150ms ease, color 150ms ease;
}

.locale-picker__option:hover {
  background: color-mix(in oklab, var(--play-soft) 85%, transparent);
}

.locale-picker__option--active {
  background: var(--play-soft);
  font-weight: 600;
}

.locale-picker__code {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.locale-picker__name {
  font-size: 0.8125rem;
  color: var(--ui-text-muted);
}

.locale-picker__option--active .locale-picker__name {
  color: color-mix(in oklab, var(--play-ink) 72%, transparent);
}

.locale-picker__check {
  width: 1rem;
  height: 1rem;
  color: var(--color-primary-500);
}
</style>
