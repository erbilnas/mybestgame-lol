<script setup lang="ts">
const { t, tm } = useI18n()

useSeoMeta({
  title: () => `${t('legal.privacy.title')} · mybestgame.lol`,
  description: () => t('seo.legalDescription'),
  robots: 'index, follow'
})
</script>

<template>
  <LegalDocument
    :title="t('legal.privacy.title')"
    :last-updated="t('legal.privacy.lastUpdated')"
    :sections="(tm('legal.privacy.sections') as Array<{ heading: string, body: string }>)"
  />
</template>
