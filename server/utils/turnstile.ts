export async function verifyTurnstile(token: string, ip?: string): Promise<void> {
  const config = useRuntimeConfig()

  if (!config.turnstileSecretKey) {
    if (process.env.NODE_ENV === 'development') {
      return
    }
    throw createError({ statusCode: 503, statusMessage: 'Turnstile not configured' })
  }

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Turnstile verification required' })
  }

  const body = new URLSearchParams({
    secret: config.turnstileSecretKey,
    response: token
  })

  if (ip) {
    body.set('remoteip', ip)
  }

  const result = await $fetch<{ success: boolean, 'error-codes'?: string[] }>(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    }
  )

  if (!result.success) {
    const codes = result['error-codes']?.join(', ') ?? 'unknown'
    const detail = process.env.NODE_ENV === 'development'
      ? `Turnstile verification failed (${codes})`
      : 'Turnstile verification failed'
    throw createError({ statusCode: 403, statusMessage: detail })
  }
}
