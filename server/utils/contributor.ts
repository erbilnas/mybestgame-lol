export interface AggregatedContributor {
  label: string
  amountCents: number
  at: string
  bidCount: number
}

export function maskContributor(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return 'Anonymous'

  if (!trimmed.includes('@')) {
    return trimmed.slice(0, 48)
  }

  const [local, domain] = trimmed.split('@')
  if (!local || !domain) return trimmed.slice(0, 48)

  const visible = local.length <= 2
    ? local
    : `${local.slice(0, 2)}•••`

  return `${visible}@${domain}`
}

export function aggregateContributors(
  bids: Array<{ displayName: string, amount: number, createdAt: Date }>
): AggregatedContributor[] {
  const byName = new Map<string, {
    displayName: string
    amountCents: number
    at: Date
    bidCount: number
  }>()

  for (const bid of bids) {
    const key = bid.displayName.trim().toLowerCase()
    const existing = byName.get(key)

    if (!existing) {
      byName.set(key, {
        displayName: bid.displayName,
        amountCents: bid.amount,
        at: bid.createdAt,
        bidCount: 1
      })
      continue
    }

    existing.amountCents += bid.amount
    existing.bidCount += 1
    if (bid.createdAt > existing.at) existing.at = bid.createdAt
  }

  return [...byName.values()]
    .sort((a, b) => {
      if (b.amountCents !== a.amountCents) return b.amountCents - a.amountCents
      return b.at.getTime() - a.at.getTime()
    })
    .map(row => ({
      label: maskContributor(row.displayName),
      amountCents: row.amountCents,
      at: row.at.toISOString(),
      bidCount: row.bidCount
    }))
}
