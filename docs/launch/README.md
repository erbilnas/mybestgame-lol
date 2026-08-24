# Launch kit

Ship these listings when the board feels busy: several games on the board, recent takeovers in the activity feed, and the free $1 promo is clearly working.

## Env for Discord (optional)

```bash
NUXT_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

When set:

- Crown `#1` takeovers ping Discord live
- Nitro task `crown-daily` posts a PNG at **15:00 UTC** every day

When empty, fulfillments and the cron still succeed; Discord is a no-op.

## Files

| File | Use |
|------|-----|
| [product-hunt.md](./product-hunt.md) | Product Hunt listing copy |
| [itch-io.md](./itch-io.md) | itch.io Tools page copy + embed |
| [daily-crown-social.md](./daily-crown-social.md) | Manual Reddit / X / community Discord checklist |

## Language rules (Polar AUP)

Use **board participation**, **entertainment software**, **stack support**, **climb the board**.

Never say advertising, sponsorship, paid placement, or “rank boost” in public listings or Polar-facing copy.
