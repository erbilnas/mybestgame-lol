## Learned User Preferences

- Use stacking bids (like outbid.lol): multiple paid **game** bids on the same game add up; users pay only the increment when raising rank.
- **Game Director Message** is optional on every support (including free $1): **title + markdown text** (links allowed; no images or click tracking). Only the top contributor's message shows on the card. User-facing copy says "Game Director Message" and uses contribution/destek, not bid/teklif. Polar-facing copy uses "board participation credit" / entertainment software — never advertising, sponsorship, or "rank boost".
- One free ($1) **game** bid per device forever; enforce with device cookie plus IP so clearing cookies, private mode, or another browser cannot reclaim it. In development (`import.meta.dev`), the free promo stays reusable and always visible.
- Do not edit the attached implementation plan file when executing the plan.
- Leaderboard entries must appear only after verified payment; unpaid or abandoned Polar checkouts must not show on the board.
- Bidder identity is optional freeform text (handle/name); do not require or store email.
- Top 3 ranks use rich podium cards and stay visible; search and infinite scroll apply only to ranks 4+ (minimal cards, batches of 50).
- Visual direction: Nintendo-inspired playful arcade look without using Nintendo IP or trademarks; light theme only (no theme toggle or dark mode). Hero and marketing copy should emphasize boosting games.
- Support English and Turkish; Turkish static copy should feel natural and lightly funny; localize Polar checkout UI for Turkish; mobile responsiveness is required. Do not name IGDB or Polar in user-facing how-to/rules overlays.
- Ship detailed privacy, terms, GDPR, and related legal pages in both languages (bid display data only, non-refundable, liability-limiting). Rules and how-to-play as side overlays. Plaque/share pages show bid date (not decay), a single copy-link action, and no director info.
- No weekly archive, dark mode, or auto-submit to Product Hunt/directories. Growth is Discord takeover webhooks plus a daily crown PNG cron; Reddit/X stay manual; SEO `/is/[slug]` pages and a listing kit only. Brand wordmark/logo should not include `.lol`. Footer credit: built by Erbil Nas with love, with a link to erbilnas.com.

## Learned Workspace Facts

- Greenfield Nuxt 4 + Nuxt UI app `mybestgame.lol`: pay-to-rank IGDB games leaderboard with optional Game Director Message per bid.
- Stack: SQLite + Drizzle ORM, Polar.sh checkout/webhooks, IGDB via Twitch OAuth, Cloudflare Turnstile, in-memory rate limiting. Stay on Polar when possible; Polar has rejected advertising framing under AUP.
- Nuxt runtime config env vars use the `NUXT_` prefix (e.g. `NUXT_TWITCH_CLIENT_ID`, `NUXT_POLAR_ACCESS_TOKEN`, `NUXT_PUBLIC_SITE_URL`, `NUXT_TRUST_PROXY`).
- Nuxt 4 layout: `app/` for pages/components; `server/` at repo root for API routes and utilities.
- Deploy on Node (not Cloudflare Workers) because `better-sqlite3` requires native bindings; target Coolify on Hetzner with the repo Dockerfile and persist SQLite under `/app/data`. Production Docker must use production Polar (`NUXT_PUBLIC_POLAR_SERVER=production` / `.env.production`), not sandbox.
- Polar product should be private; fulfill bids only on `order.paid` webhook or checkout status `succeeded` — never on `confirmed`. Polar webhook route `/api/webhooks/polar` needs Nitro `bodyParser: false` for raw-body signature verification.
- Free-support eligibility uses HMAC device cookie `mbg_device` plus client IP; set `NUXT_TRUST_PROXY=true` only behind Cloudflare/Coolify (or similar) so `X-Forwarded-For` is trusted.
- `h3-rate-limit` npm package does not exist; rate limiting lives in `server/utils/rate-limit.ts`.
- `@nuxt/eslint` was removed from `nuxt.config.ts` modules due to install issues.
- Vite `server.allowedHosts` in `nuxt.config.ts` must include `.loca.lt` (and similar tunnel domains) for local webhook testing.
- Leaderboard rank is computed from aggregated `paid` bids (`bid_type` `game` only; legacy auction rows migrated to game); there is no separate leaderboard table. APIs default to limit 50 with infinite scroll; search finds lower ranks. Game Director Message on a card comes from the top contributor by stacked `displayName` (their newest paid bid with a message).
- Product also includes plaques/share cards, bid decay and takeover moments, embed badges, en/tr localization, legal pages, rules/how-to-play overlays, free-support claims, `/is/[slug]` SEO pages, sitemap, takeover RSS, optional Discord webhooks (`NUXT_DISCORD_WEBHOOK_URL`), and a daily crown PNG Nitro cron (`@resvg/resvg-js`); weekly archive was removed. Launch kit is docs-only. A brief Stripe checkout rename was reverted; SQLite may migrate leftover `stripe_*` bid columns back to `polar_*`.
