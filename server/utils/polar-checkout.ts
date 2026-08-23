export const PAID_CHECKOUT_STATUS = 'succeeded' as const

export function isCheckoutPaid(status: string): boolean {
  return status === PAID_CHECKOUT_STATUS
}

export function isCheckoutAbandoned(status: string): boolean {
  return status === 'failed' || status === 'expired'
}

/** Customer-paid total in cents. Prefer totalAmount over netAmount (fees are not the bid). */
export function paidAmountCentsFromPolar(data: {
  totalAmount?: number
  amount?: number
  netAmount?: number
}): number | null {
  if (typeof data.totalAmount === 'number') return data.totalAmount
  if (typeof data.amount === 'number') return data.amount
  if (typeof data.netAmount === 'number') return data.netAmount
  return null
}
