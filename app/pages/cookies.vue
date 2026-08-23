<script setup lang="ts">
const { t, tm } = useI18n()

useSeoMeta({
  title: () => `${t('legal.cookies.title')} · mybestgame.lol`,
  description: () => t('seo.legalDescription'),
  robots: 'index, follow'
})
</script>

<template>
  <LegalDocument
    :title="t('legal.cookies.title')"
    :last-updated="t('legal.cookies.lastUpdated')"
    :sections="(tm('legal.cookies.sections') as Array<{ heading: string, body: string }>)"
  />
</template>
