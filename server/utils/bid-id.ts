const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isBidId(value: string): boolean {
  return UUID_RE.test(value)
}

export function parseBidId(value: unknown, fieldName = 'bid_id'): string {
  const id = String(value ?? '').trim()
  if (!isBidId(id)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${fieldName}` })
  }
  return id
}
