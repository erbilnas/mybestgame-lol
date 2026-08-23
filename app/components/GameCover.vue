<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  src?: string | null
  alt?: string
  width?: number
  height?: number
}>()

const attrs = useAttrs()
const failed = ref(false)

watch(() => props.src, () => {
  failed.value = false
})

const showImage = computed(() => Boolean(props.src) && !failed.value)
</script>

<template>
  <NuxtImg
    v-if="showImage"
    v-bind="attrs"
    :src="src!"
    :alt="alt ?? ''"
    :width="width"
    :height="height"
    loading="lazy"
    decoding="async"
    class="block h-full w-full object-cover"
    @error="failed = true"
  />
  <div
    v-else
    v-bind="attrs"
    class="flex items-center justify-center bg-[var(--play-soft)] text-muted"
    :aria-label="alt || 'Image unavailable'"
    role="img"
  >
    <UIcon
      name="i-lucide-image-off"
      class="size-[38%] min-h-4 min-w-4 opacity-45"
    />
  </div>
</template>
