/** Category string for payment processor onboarding and checkout metadata. */
export const PROCESSOR_PRODUCT_CATEGORY = 'consumer_software_games'

/** Polar-facing label: avoid "rank boost" / advertising / sponsorship wording. */
export function checkoutProductLabel(): string {
  return 'Board participation credit'
}

export function checkoutProductDescription(gameTitle: string): string {
  return `One-time digital board participation credit for "${gameTitle}" on mybestgame.lol (consumer entertainment software). Instant on-site fulfillment updates the live game board listing. Optional on-site text note (title + message only, no outbound links) may display if the buyer is the top contributor for that game. Not advertising, lead generation, sponsorship inventory, or marketing services.`
}

export function checkoutMetadata(gameTitle: string, extras: Record<string, string>): Record<string, string> {
  return {
    ...extras,
    productCategory: PROCESSOR_PRODUCT_CATEGORY,
    productLabel: checkoutProductLabel(),
    productDescription: checkoutProductDescription(gameTitle),
    fulfillment: 'instant_on_site'
  }
}
