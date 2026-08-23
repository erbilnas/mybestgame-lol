# mybestgame.lol

Pay-to-rank leaderboard for video games. Users search IGDB games, place stacking bids via Polar.sh, and optionally add premium card customization to their featured supporter slot.

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

Use this wording in your Polar organization and product settings — not "advertising" or "sponsorship placements":

> mybestgame.lol is consumer entertainment software: a pay-to-rank video game leaderboard. Customers purchase one-time digital products on our site:
>
> - **Leaderboard rank boost** — increases a game's score and rank on our board (instant fulfillment).
> - **Premium card customization** — optional featured supporter slot on a game card (title, link, image shown only on our platform). Not third-party advertising, lead gen, or marketing services.
>
> Fulfillment is automatic after payment via webhook. All sales are final digital goods.

Checkout metadata includes `productLabel`, `productDescription`, and `productCategory` for each bid.

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
