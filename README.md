# mybestgame.lol

Pay-to-rank leaderboard for video games. Users search IGDB games, place stacking support bids via Polar.sh, and optionally attach a Game Director Message (shown on the card when they are the top contributor).

## Stack

- Nuxt 4 + Nuxt UI
- SQLite + Drizzle ORM
- IGDB API (Twitch OAuth)
- Polar.sh (checkout + webhooks)
- Cloudflare Turnstile

## Setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Fill in credentials:

| Variable | Source |
|----------|--------|
| `NUXT_TWITCH_CLIENT_ID` / `NUXT_TWITCH_CLIENT_SECRET` | [Twitch Developer Console](https://dev.twitch.tv/console) |
| `NUXT_POLAR_ACCESS_TOKEN` / `NUXT_POLAR_PRODUCT_ID` / `NUXT_POLAR_WEBHOOK_SECRET` | [Polar Dashboard](https://polar.sh) |
| `NUXT_TURNSTILE_SECRET_KEY` / `NUXT_PUBLIC_TURNSTILE_SITE_KEY` | [Cloudflare Turnstile](https://dash.cloudflare.com/) |

3. Install and run:

```bash
npm install
npm run dev
```

## Polar setup

1. Create a product in Polar (sandbox for dev).
2. Register webhook: `https://your-domain/api/webhooks/polar`
3. Subscribe to `order.paid`.
4. Set `POLAR_PRODUCT_ID` to your product ID.

Checkouts use ad-hoc fixed prices per bid increment.

### Product description (for Polar onboarding)

Paste this into your Polar **organization** and **product** descriptions. Avoid the words advertising, sponsorship, rank boost, and paid placement:

> mybestgame.lol is consumer entertainment software: a live video-game board where fans buy one-time digital participation credits.
>
> Each purchase is fulfilled instantly on our site (API webhook): the credit is added to that game’s public board listing. Credits stack. The board is an interactive entertainment product, not a third-party ad network.
>
> Buyers may optionally attach a short on-site text note (title + message only). Notes have no outbound links, images, or click tracking. A note only appears on the card when that buyer is the top contributor for the game.
>
> This is not advertising, lead generation, sponsorship inventory, or marketing services. All sales are final digital goods.

Checkout metadata uses `productLabel: Board participation credit`, matching the above.

### Checkout localization

Enable the **Checkout Localization** feature flag in your Polar organization dashboard to get Turkish checkout UI. The `locale` field is sent from the frontend based on the active site language. Receipt/confirmation emails from Polar may remain in English.

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/games/search?q=` | GET | IGDB game search |
| `/api/leaderboard` | GET | Ranked games with totals |
| `/api/bids/quote?gameId=&amount=` | GET | Bid preview |
| `/api/bids/create-checkout` | POST | Create Polar checkout |
| `/api/bids/status?bid_id=` | GET | Poll bid payment status |
| `/api/webhooks/polar` | POST | Polar payment webhook |
| `/api/games/by-slug/:slug` | GET | Game + board by slug |
| `/api/og/crown` | GET | Daily crown PNG (current #1) |
| `/api/og/game/:slug` | GET | Share PNG for a game's live rank |
| `/rss/takeovers.xml` | GET | Rank / director takeover RSS |
| `/is/:slug` | GET | “Is this the best game right now?” SEO page |

## Discord + daily crown

Optional: set `NUXT_DISCORD_WEBHOOK_URL` to an incoming webhook.

- Live notify when a game takes #1
- Nitro scheduled task `crown-daily` at 15:00 UTC posts a crown PNG

Launch copy for Product Hunt, itch.io, and manual Reddit/X posts: see [`docs/launch/`](docs/launch/).

## Bidding rules

- Bids stack on the same game (30-day expiry per paid bid).
- Minimum increment: $1.
- Rank = sum of active paid bids; ties broken by earlier bid.
- Leaderboard updates only after verified `order.paid` webhook.

## Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm run preview    # Preview production build
npm run db:push    # Push Drizzle schema to SQLite
```
