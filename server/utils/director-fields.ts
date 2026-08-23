import { sanitizeAdDescription, sanitizeAdTitle } from './sanitize'

export interface DirectorFieldInput {
  adTitle?: string
  adDescription?: string
  /** Ignored — links are not accepted (Polar-safe text-only message). */
  adLink?: string
  /** Ignored — images are not accepted. */
  adImage?: string
}

export interface DirectorFields {
  adTitle: string
  adLink: string
  adImage: string | null
  adDescription: string | null
}

/** Empty when blank; otherwise title + description required. Link/image always empty. */
export function parseOptionalDirectorFields(input: DirectorFieldInput): DirectorFields {
  const rawTitle = (input.adTitle ?? '').trim()
  const rawDesc = (input.adDescription ?? '').trim()
  const anyFilled = Boolean(rawTitle || rawDesc)

  if (!anyFilled) {
    return {
      adTitle: '',
      adLink: '',
      adImage: null,
      adDescription: null
    }
  }

  const adTitle = sanitizeAdTitle(rawTitle)
  const adDescription = sanitizeAdDescription(rawDesc)

  if (!adTitle) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Game Director Message title is required'
    })
  }
  if (!adDescription) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Game Director Message description is required'
    })
  }

  return {
    adTitle,
    adLink: '',
    adImage: null,
    adDescription
  }
}

export function hasDirectorMessage(adTitle: string | null | undefined): boolean {
  return Boolean(adTitle?.trim())
}
