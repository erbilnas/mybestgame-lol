import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks'
import { failBid, fulfillBid, parseMetadataBidId, resolveBidId } from '../../utils/fulfill-bid'
import { isCheckoutAbandoned, paidAmountCentsFromPolar } from '../../utils/polar-checkout'

interface PolarWebhookPayload {
  type: string
  data: {
    id: string
    status?: string
    amount?: number
    netAmount?: number
    totalAmount?: number
    metadata?: Record<string, string | number | boolean>
    checkoutId?: string | null
    checkout_id?: string | null
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const rawBody = await readRawBody(event, 'utf8')

  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: 'Missing body' })
  }

  if (!config.polarWebhookSecret) {
    throw createError({ statusCode: 503, statusMessage: 'Webhook secret not configured' })
  }

  let payload: PolarWebhookPayload

  try {
    payload = validateEvent(
      rawBody,
      Object.fromEntries(Object.entries(getHeaders(event)).map(([k, v]) => [k, String(v)])),
      config.polarWebhookSecret
    ) as PolarWebhookPayload
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      throw createError({ statusCode: 403, statusMessage: 'Invalid webhook signature' })
    }
    throw error
  }

  if (payload.type === 'order.paid') {
    const bidId = await resolveBidId({
      bidId: parseMetadataBidId(payload.data.metadata),
      checkoutId: payload.data.checkoutId ?? payload.data.checkout_id ?? null
    })

    if (!bidId) {
      setResponseStatus(event, 202)
      return { received: true, skipped: 'no matching bid', type: payload.type }
    }

    const paidAmountCents = paidAmountCentsFromPolar(payload.data)
    if (paidAmountCents === null) {
      setResponseStatus(event, 202)
      return { received: true, skipped: 'missing order amount', type: payload.type, bidId }
    }

    const result = await fulfillBid(bidId, {
      polarOrderId: payload.data.id,
      paidAmountCents
    })
    setResponseStatus(event, 202)
    return { received: true, type: payload.type, bidId, ...result }
  }

  if (payload.type === 'checkout.updated' && payload.data.status && isCheckoutAbandoned(payload.data.status)) {
    const bidId = await resolveBidId({
      bidId: parseMetadataBidId(payload.data.metadata),
      checkoutId: payload.data.id
    })

    if (!bidId) {
      setResponseStatus(event, 202)
      return { received: true, skipped: 'no matching bid', type: payload.type }
    }

    const result = await failBid(bidId, { polarCheckoutId: payload.data.id })
    setResponseStatus(event, 202)
    return { received: true, type: payload.type, bidId, ...result }
  }

  if (payload.type === 'order.updated') {
    const orderStatus = payload.data.status
    const bidId = await resolveBidId({
      bidId: parseMetadataBidId(payload.data.metadata),
      checkoutId: payload.data.checkoutId ?? payload.data.checkout_id ?? null
    })

    if (bidId && (orderStatus === 'void' || orderStatus === 'refunded')) {
      const result = await failBid(bidId, {
        polarOrderId: payload.data.id,
        polarCheckoutId: payload.data.checkoutId ?? payload.data.checkout_id ?? null
      })
      setResponseStatus(event, 202)
      return { received: true, type: payload.type, bidId, ...result }
    }
  }

  setResponseStatus(event, 202)
  return { received: true, type: payload.type }
})
