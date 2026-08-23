<script setup lang="ts">
const { t, tm } = useI18n()

useSeoMeta({
  title: () => `${t('legal.terms.title')} · mybestgame.lol`,
  description: () => t('seo.legalDescription'),
  robots: 'index, follow'
})
</script>

<template>
  <LegalDocument
    :title="t('legal.terms.title')"
    :last-updated="t('legal.terms.lastUpdated')"
    :sections="(tm('legal.terms.sections') as Array<{ heading: string, body: string }>)"
  />
</template>
