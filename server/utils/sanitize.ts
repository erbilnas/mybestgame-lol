import {
  DIRECTOR_DESC_RAW_MAX,
  DIRECTOR_DESC_VISIBLE_MAX,
  markdownVisibleLength
} from '../../shared/utils/director-markdown'

const HTML_TAG_RE = /<[^>]*>/g

export function sanitizeAdTitle(title: string): string {
  return title.replace(HTML_TAG_RE, '').trim().slice(0, 120)
}

export function sanitizeAdDescription(description: string | undefined): string | null {
  if (!description?.trim()) return null
  const cleaned = description.replace(HTML_TAG_RE, '').trim()
  if (cleaned.length > DIRECTOR_DESC_RAW_MAX) {
    throw createError({
      statusCode: 400,
      statusMessage: `Game Director Message is too long (max ${DIRECTOR_DESC_RAW_MAX} characters including markdown).`
    })
  }
  if (markdownVisibleLength(cleaned) > DIRECTOR_DESC_VISIBLE_MAX) {
    throw createError({
      statusCode: 400,
      statusMessage: `Game Director Message text exceeds ${DIRECTOR_DESC_VISIBLE_MAX} characters (markdown markers do not count).`
    })
  }
  return cleaned
}

export function sanitizeDisplayName(name: string | undefined): string {
  const cleaned = (name ?? '').replace(HTML_TAG_RE, '').trim().slice(0, 64)
  return cleaned || 'Anonymous'
}

export function sanitizeAdLink(link: string): string {
  const trimmed = link.trim()
  let parsed: URL

  try {
    parsed = new URL(trimmed)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid ad link URL' })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Ad link must use http or https' })
  }

  return parsed.toString()
}

export function sanitizeAdImage(image: string | undefined): string | null {
  if (!image?.trim()) return null
  return sanitizeAdLink(image)
}

export function sanitizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email address' })
  }
  return normalized
}
