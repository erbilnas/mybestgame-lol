export function formatExpiryClock(
  remainingMs: number,
  units: { day: string, hour: string, minute: string }
): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000))
  const days = Math.floor(totalSec / 86_400)
  const hours = Math.floor((totalSec % 86_400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  if (days > 0) {
    return `${days}${units.day} ${pad(hours)}${units.hour} ${pad(minutes)}${units.minute}`
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function useExpiryCountdown(iso: MaybeRefOrGetter<string | null | undefined>) {
  const now = ref(Date.now())
  const mounted = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    mounted.value = true
    now.value = Date.now()
    timer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  const remainingMs = computed(() => {
    const raw = toValue(iso)
    if (!raw) return null
    return Math.max(0, new Date(raw).getTime() - now.value)
  })

  return {
    mounted,
    remainingMs
  }
}
