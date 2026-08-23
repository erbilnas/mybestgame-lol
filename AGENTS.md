## Learned User Preferences

- Use stacking bids (like outbid.lol): multiple paid **game** bids on the same game add up; users pay only the increment when raising rank.
- **Sponsor bids** are separate: they buy the ad spot on a game card and must beat the current sponsor by at least $1; highest sponsor bid holds the spot. User-facing copy should say "sponsor" (not "ad").
- One free ($0) **game** bid per device forever (not for sponsor); enforce with device cookie plus IP so clearing cookies, private mode, or another browser cannot reclaim it.
- `ad_image` is URL-only in v1; no file upload or object storage.
- Do not edit the attached implementation plan file when executing the plan.
- Leaderboard entries must appear only after verified payment; unpaid or abandoned Polar checkouts must not show on the board.
- Bidder identity is optional freeform text (handle/name); do not require or store email.
- Top 3 ranks use rich podium cards; ranks 4+ use a minimal card layout with a search bar; board loads in batches of 50 via infinite scroll; search to find others.
- Visual direction: Nintendo-inspired playful arcade look without using Nintendo IP or trademarks; light theme only (no theme toggle or dark mode).
- Support English and Turkish; Turkish static copy should feel natural and lightly funny; localize Polar checkout UI for Turkish; mobile responsiveness is required.
- Ship detailed privacy, terms, GDPR, and related legal pages in both languages (bid display data only, non-refundable, liability-limiting). Rules and how-to-play as side overlays. Plaque/share pages show bid date (not decay), a single copy-link action, and no sponsor info.
- No weekly archive feature; brand wordmark/logo should not include `.lol`.

## Learned Workspace Facts

- Greenfield Nuxt 4 + Nuxt UI app `mybestgame.lol`: pay-to-rank IGDB games leaderboard with custom ad content per bid.
- Stack: SQLite + Drizzle ORM, Polar.sh checkout/webhooks, IGDB via Twitch OAuth, Cloudflare Turnstile, in-memory rate limiting.
- Nuxt runtime config env vars use the `NUXT_` prefix (e.g. `NUXT_TWITCH_CLIENT_ID`, `NUXT_POLAR_ACCESS_TOKEN`, `NUXT_PUBLIC_SITE_URL`, `NUXT_TRUST_PROXY`).
- Nuxt 4 layout: `app/` for pages/components; `server/` at repo root for API routes and utilities.
- Deploy on Node (not Cloudflare Workers) because `better-sqlite3` requires native bindings; target Coolify on Hetzner with the repo Dockerfile.
- Polar product should be private; fulfill bids only on `order.paid` webhook or checkout status `succeeded` — never on `confirmed`. Polar webhook route `/api/webhooks/polar` needs Nitro `bodyParser: false` for raw-body signature verification.
- Free-support eligibility uses HMAC device cookie `mbg_device` plus client IP; set `NUXT_TRUST_PROXY=true` only behind Cloudflare/Coolify (or similar) so `X-Forwarded-For` is trusted.
- `h3-rate-limit` npm package does not exist; rate limiting lives in `server/utils/rate-limit.ts`.
- `@nuxt/eslint` was removed from `nuxt.config.ts` modules due to install issues.
- Vite `server.allowedHosts` in `nuxt.config.ts` must include `.loca.lt` (and similar tunnel domains) for local webhook testing.
- Leaderboard rank is computed from aggregated `paid` bids (both game and sponsor types); there is no separate leaderboard table. APIs default to limit 50 with infinite scroll; search finds lower ranks. Sponsor ad on a card comes from the highest paid `sponsor` bid; bids use `bid_type` `game` or `sponsor`.
- Product also includes plaques/share cards, bid decay and takeover moments, embed badges, en/tr localization, legal pages, rules/how-to-play overlays, and free-support claims; weekly archive was removed.
