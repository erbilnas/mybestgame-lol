/** Resolve a site favicon URL from an http(s) page link. */
export function faviconFromUrl(link: string | null | undefined, size = 128): string | null {
  if (!link?.trim()) return null

  try {
    const parsed = new URL(link.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!parsed.hostname) return null

    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=${size}`
  } catch {
    return null
  }
}

/** Prefer explicit ad image; otherwise fall back to the link favicon. */
export function adVisualUrl(
  image: string | null | undefined,
  link: string | null | undefined,
  size = 128
): string | null {
  const trimmed = image?.trim()
  if (trimmed) return trimmed
  return faviconFromUrl(link, size)
}
