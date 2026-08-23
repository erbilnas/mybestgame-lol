import type { BidType } from '../database/schema'

/** Category string for payment processor onboarding and checkout metadata. */
export const PROCESSOR_PRODUCT_CATEGORY = 'consumer_software_games'

export function checkoutProductLabel(bidType: BidType): string {
  switch (bidType) {
    case 'game':
      return 'Leaderboard rank boost'
    case 'sponsor':
      return 'Premium card customization'
    default: {
      const _exhaustive: never = bidType
      return _exhaustive
    }
  }
}

export function checkoutProductDescription(bidType: BidType, gameTitle: string): string {
  switch (bidType) {
    case 'game':
      return `Digital leaderboard rank boost for "${gameTitle}" on mybestgame.lol. Instant on-site fulfillment.`
    case 'sponsor':
      return `Featured supporter slot with premium card customization for "${gameTitle}" on mybestgame.lol. Displayed only on our platform. Instant on-site fulfillment. Not third-party advertising.`
    default: {
      const _exhaustive: never = bidType
      return _exhaustive
    }
  }
}

export function checkoutMetadata(bidType: BidType, gameTitle: string, extras: Record<string, string>): Record<string, string> {
  return {
    ...extras,
    productCategory: PROCESSOR_PRODUCT_CATEGORY,
    productLabel: checkoutProductLabel(bidType),
    productDescription: checkoutProductDescription(bidType, gameTitle),
    fulfillment: 'instant_on_site'
  }
}
