<script setup lang="ts">
defineProps<{
  title: string
  lastUpdated: string
  sections: Array<{ heading: string, body: string }>
}>()

const { t, rt } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <div class="playfield mx-auto max-w-3xl px-3 py-10 sm:px-6 sm:py-16">
    <div class="mb-8 space-y-2">
      <h1 class="font-display text-3xl font-bold text-[var(--play-ink)] sm:text-4xl">
        {{ title }}
      </h1>
      <p class="text-sm text-muted">
        {{ lastUpdated }}
      </p>
    </div>

    <div class="space-y-6">
      <section
        v-for="(section, index) in sections"
        :key="index"
        class="arcade-shell rounded-[1.35rem] p-5 sm:p-6"
      >
        <h2 class="font-display text-lg font-bold text-[var(--play-ink)]">
          {{ rt(section.heading) }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-muted text-pretty">
          {{ rt(section.body) }}
        </p>
      </section>
    </div>

    <div class="mt-8">
      <UButton
        :to="localePath('/')"
        variant="ghost"
        color="neutral"
      >
        {{ t('success.backToBoard') }}
      </UButton>
    </div>
  </div>
</template>
