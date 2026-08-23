<script setup lang="ts">
const { t, tm } = useI18n()

useSeoMeta({
  title: () => `${t('legal.gdpr.title')} · mybestgame.lol`,
  description: () => t('seo.legalDescription'),
  robots: 'index, follow'
})
</script>

<template>
  <LegalDocument
    :title="t('legal.gdpr.title')"
    :last-updated="t('legal.gdpr.lastUpdated')"
    :sections="(tm('legal.gdpr.sections') as Array<{ heading: string, body: string }>)"
  />
</template>
