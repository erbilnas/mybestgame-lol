export function useFreeEligibility() {
  const eligible = useState('free-support-eligible', () => import.meta.dev)
  const loaded = useState('free-support-eligible-loaded', () => import.meta.dev)

  async function refresh() {
    if (import.meta.dev) {
      eligible.value = true
      loaded.value = true
      return
    }

    loaded.value = false
    try {
      const result = await $fetch<{ eligible: boolean }>('/api/bids/free-eligibility')
      eligible.value = result.eligible
    } catch {
      eligible.value = false
    } finally {
      loaded.value = true
    }
  }

  return { eligible, loaded, refresh }
}
