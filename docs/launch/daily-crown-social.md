# Daily crown — Reddit / X / community Discord

Automated Discord (when `NUXT_DISCORD_WEBHOOK_URL` is set) already posts:

1. Live ping when a game takes **#1**
2. Daily crown PNG at **15:00 UTC** via Nitro task `crown-daily`

Reddit and X stay **manual**. Use this checklist.

## Prep

1. Open https://mybestgame.lol/api/og/crown (PNG of current #1) or grab the image from the Discord daily post
2. Confirm the crown game on the home podium
3. Optional deep link: `https://mybestgame.lol/is/{slug}`

## Caption templates (EN)

**Short (X)**

Daily crown on mybestgame.lol: {Title} holds #1 with {Total} stacked.
{link}

**Reddit / Discord community**

Today’s crown: **{Title}** is #1 on mybestgame.lol ({Total} stacked).

Is it the best game right now? Live board + takeovers RSS:
- Board: https://mybestgame.lol
- Page: https://mybestgame.lol/is/{slug}
- Feed: https://mybestgame.lol/rss/takeovers.xml

## Caption templates (TR)

Günün taçlısı: **{Title}** mybestgame.lol’da #1 ({Total}).
Canlı tahta: https://mybestgame.lol

## Cadence

- Post once per day after the Discord cron (or after 15:00 UTC)
- Skip days when the board is empty
- Prefer communities that allow entertainment / gaming tools; follow each subreddit’s rules
- Do not frame posts as ads or paid placement

## Manual Discord (no webhook)

If the webhook is unset, download `/api/og/crown` and paste into your own server with the caption above.
