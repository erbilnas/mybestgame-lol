import type { Order } from '@polar-sh/sdk/models/components/order.js'
import { isCheckoutAbandoned } from './polar-checkout'
import { usePolar } from './polar'

const LOCAL_ORDER_PREFIXES = ['free:', 'checkout:'] as const

export function isPolarManagedOrderId(
  orderId: string | null | undefined
): orderId is string {
  if (!orderId) return false
  return !LOCAL_ORDER_PREFIXES.some(prefix => orderId.startsWith(prefix))
}

async function listOrdersForCheckout(checkoutId: string): Promise<Order[]> {
  const polar = usePolar()
  const iterator = await polar.orders.list({ checkoutId, limit: 10 })

  for await (const page of iterator) {
    return page.result.items
  }

  return []
}

async function refundPaidOrder(order: Order): Promise<{ refunded: boolean, reason: string }> {
  if (order.status !== 'paid' && order.status !== 'partially_refunded') {
    return { refunded: false, reason: `order status: ${order.status}` }
  }

  if (order.refundableAmount <= 0) {
    return { refunded: false, reason: 'nothing refundable' }
  }

  const polar = usePolar()
  await polar.refunds.create({
    orderId: order.id,
    amount: order.refundableAmount,
    reason: 'other',
    comment: 'Bid payment failed or was rejected by mybestgame.lol'
  })

  return { refunded: true, reason: 'refunded' }
}

/**
 * Best-effort Polar cleanup when a bid fails locally.
 * Refunds paid orders; open/expired checkouts need no API action.
 */
export async function cancelPolarPaymentForBid(options: {
  polarCheckoutId?: string | null
  polarOrderId?: string | null
}): Promise<{ cancelled: boolean, reason: string }> {
  try {
    const polar = usePolar()
    const orderIds = new Set<string>()

    if (isPolarManagedOrderId(options.polarOrderId)) {
      orderIds.add(options.polarOrderId)
    }

    if (options.polarCheckoutId) {
      try {
        const checkout = await polar.checkouts.get({ id: options.polarCheckoutId })
        if (isCheckoutAbandoned(checkout.status)) {
          // Checkout already terminal on Polar.
        }
      } catch {
        // Checkout may already be gone.
      }

      for (const order of await listOrdersForCheckout(options.polarCheckoutId)) {
        orderIds.add(order.id)
      }
    }

    if (orderIds.size === 0) {
      return { cancelled: false, reason: 'no polar order' }
    }

    let refundedAny = false
    for (const orderId of orderIds) {
      const order = await polar.orders.get({ id: orderId })
      const result = await refundPaidOrder(order)
      if (result.refunded) {
        refundedAny = true
      }
    }

    return refundedAny
      ? { cancelled: true, reason: 'refunded' }
      : { cancelled: false, reason: 'no refundable order' }
  } catch (error) {
    console.error('[polar-cancel]', error)
    return { cancelled: false, reason: 'polar error' }
  }
}
