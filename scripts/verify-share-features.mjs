import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function renderGameEmbedSvg({ title, rank, totalCents }) {
  const safeTitle = escapeXml(title.slice(0, 28))
  const rankLabel = rank ? `#${rank}` : '—'
  const total = `$${Math.round(totalCents / 100)}`
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="72" viewBox="0 0 320 72">
  <text>${rankLabel}</text><text>${safeTitle}</text><text>${total}</text>
</svg>`
}

const dbPath = resolve(process.cwd(), process.env.NUXT_DATABASE_URL ?? './data/mybestgame.db')
mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('foreign_keys = ON')

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS board_events (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    game_id INTEGER NOT NULL,
    bid_id TEXT,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`)

const gameId = 999002
const bidId = randomUUID()
const now = Date.now()

sqlite.prepare(`
  INSERT INTO games (id, title, cover_url, slug, created_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET title = excluded.title
`).run(gameId, 'Share Test Game', null, 'share-test-game', now)

sqlite.prepare(`DELETE FROM board_events WHERE game_id = ?`).run(gameId)
sqlite.prepare(`DELETE FROM bids WHERE game_id = ?`).run(gameId)

sqlite.prepare(`
  INSERT INTO bids (
    id, game_id, bid_type, display_name, amount, ad_title, ad_link, ad_image, ad_description,
    click_count, status, expires_at, created_at
  ) VALUES (?, ?, 'game', ?, ?, '', '', null, null, 0, 'paid', ?, ?)
`).run(bidId, gameId, 'verify@example.com', 700, now + 30 * 24 * 60 * 60 * 1000, now)

const eventId = randomUUID()
sqlite.prepare(`
  INSERT INTO board_events (id, type, game_id, bid_id, payload, created_at)
  VALUES (?, 'bid_paid', ?, ?, ?, ?)
`).run(
  eventId,
  gameId,
  bidId,
  JSON.stringify({ gameTitle: 'Share Test Game', contributor: 'ver***', amountCents: 700, rank: 1 }),
  now
)

const eventRow = sqlite.prepare(`SELECT type FROM board_events WHERE id = ?`).get(eventId)
if (!eventRow || eventRow.type !== 'bid_paid') {
  console.error('FAIL: board_events insert missing')
  process.exit(1)
}

const svg = renderGameEmbedSvg({ title: 'Share Test Game', rank: 1, totalCents: 700 })
if (!svg.includes('<svg') || !svg.includes('#1') || !svg.includes('$7')) {
  console.error('FAIL: embed svg missing content')
  process.exit(1)
}

console.log('OK: events and svg helpers', {
  bidId,
  eventType: eventRow.type
})
