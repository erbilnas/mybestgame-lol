<script setup lang="ts">
export interface GameOption {
  id: number
  title: string
  slug: string
  coverUrl: string | null
}

const props = defineProps<{
  modelValue: GameOption | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: GameOption | null]
}>()

const { t } = useI18n()
const rootRef = ref<HTMLElement | null>(null)
const searchTerm = ref('')
const items = ref<GameOption[]>([])
const loading = ref(false)
const open = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
let blurCloseTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0
let skipNextSearch = false

watch(searchTerm, (value) => {
  clearTimeout(debounceTimer)
  clearTimeout(blurCloseTimer)

  if (skipNextSearch) {
    skipNextSearch = false
    return
  }

  const query = value.trim()
  if (!query) {
    items.value = []
    open.value = false
    loading.value = false
    return
  }

  // Already selected this exact title — don't reopen the list.
  if (props.modelValue && query === props.modelValue.title) {
    items.value = []
    open.value = false
    loading.value = false
    return
  }

  debounceTimer = setTimeout(async () => {
    const seq = ++searchSeq
    loading.value = true
    clearTimeout(blurCloseTimer)
    try {
      const { games } = await $fetch<{ games: GameOption[] }>('/api/games/search', {
        query: { q: query, limit: 10 }
      })
      if (seq !== searchSeq) return
      clearTimeout(blurCloseTimer)
      items.value = games
      open.value = games.length > 0
    } catch {
      if (seq !== searchSeq) return
      clearTimeout(blurCloseTimer)
      items.value = []
      open.value = false
    } finally {
      if (seq === searchSeq) {
        loading.value = false
      }
    }
  }, 300)
})

function onSelect(game: GameOption) {
  clearTimeout(debounceTimer)
  clearTimeout(blurCloseTimer)
  searchSeq += 1
  skipNextSearch = true
  emit('update:modelValue', game)
  searchTerm.value = game.title
  items.value = []
  open.value = false
  loading.value = false
}

function onFocusIn() {
  clearTimeout(blurCloseTimer)
  if (items.value.length > 0 && searchTerm.value.trim()) {
    open.value = true
  }
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && rootRef.value?.contains(next)) {
    return
  }

  clearTimeout(blurCloseTimer)
  blurCloseTimer = setTimeout(() => {
    // UInput remounts on loading toggles and can steal focus mid-search.
    if (loading.value || rootRef.value?.contains(document.activeElement)) {
      return
    }
    open.value = false
  }, 120)
}

onUnmounted(() => {
  clearTimeout(debounceTimer)
  clearTimeout(blurCloseTimer)
  searchSeq += 1
})

const selectedLabel = computed(() => props.modelValue?.title ?? '')
</script>

<template>
  <div
    ref="rootRef"
    class="space-y-2"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <div class="relative">
      <UInput
        v-model="searchTerm"
        :placeholder="selectedLabel || t('search.placeholder')"
        icon="i-lucide-search"
        autocomplete="off"
        class="w-full"
      />
      <span
        v-if="loading"
        class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted"
        aria-hidden="true"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-4 animate-spin"
        />
      </span>
    </div>

    <ul
      v-show="open && items.length > 0"
      class="max-h-64 overflow-y-auto rounded-lg border border-default bg-elevated divide-y divide-default"
      role="listbox"
    >
      <li
        v-for="game in items"
        :key="game.id"
        role="option"
      >
        <button
          type="button"
          tabindex="-1"
          class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50"
          @mousedown.prevent="onSelect(game)"
        >
          <img
            v-if="game.coverUrl"
            :src="game.coverUrl"
            :alt="game.title"
            class="h-12 w-9 shrink-0 rounded object-cover"
          >
          <div
            v-else
            class="h-12 w-9 shrink-0 rounded bg-muted"
          />
          <span class="text-sm font-medium">{{ game.title }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
