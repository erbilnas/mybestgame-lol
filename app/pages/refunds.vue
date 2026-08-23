<script setup lang="ts">
const { t, tm } = useI18n()

useSeoMeta({
  title: () => `${t('legal.refunds.title')} · mybestgame.lol`,
  description: () => t('seo.legalDescription'),
  robots: 'index, follow'
})
</script>

<template>
  <LegalDocument
    :title="t('legal.refunds.title')"
    :last-updated="t('legal.refunds.lastUpdated')"
    :sections="(tm('legal.refunds.sections') as Array<{ heading: string, body: string }>)"
  />
</template>
