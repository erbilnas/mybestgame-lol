<script setup lang="ts">
import { renderDirectorMarkdown } from '#shared/utils/director-markdown'

const props = defineProps<{
  source: string
  /** Extra classes on the markdown root (e.g. line-clamp). */
  class?: string
}>()

const html = computed(() => renderDirectorMarkdown(props.source))
</script>

<template>
  <div
    class="director-md"
    :class="props.class"
    v-html="html"
  />
</template>
