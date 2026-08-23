import { FREE_SUPPORT_CENTS } from '../../utils/bidding'
import { ensureDeviceId, getClientIp, hasClaimedFreeSupport } from '../../utils/device'
import { rateLimitByIp } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  rateLimitByIp(event, { limit: 30, windowMs: 60_000 })

  const deviceId = ensureDeviceId(event)
  const ip = getClientIp(event)

  if (!ip) {
    return {
      eligible: false,
      amountCents: FREE_SUPPORT_CENTS
    }
  }

  const claimed = await hasClaimedFreeSupport(deviceId, ip)

  return {
    eligible: !claimed,
    amountCents: FREE_SUPPORT_CENTS
  }
})
