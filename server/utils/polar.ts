import { Polar } from '@polar-sh/sdk'

let polar: Polar | null = null

export function usePolar(): Polar {
  if (polar) {
    return polar
  }

  const config = useRuntimeConfig()
  if (!config.polarAccessToken) {
    throw createError({ statusCode: 503, statusMessage: 'Polar not configured' })
  }

  polar = new Polar({
    accessToken: config.polarAccessToken,
    server: config.public.polarServer === 'production' ? 'production' : 'sandbox'
  })

  return polar
}
