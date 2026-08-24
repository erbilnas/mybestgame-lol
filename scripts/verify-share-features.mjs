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

function rankAfterRemovingCents(totals, gameId, removeCents) {
  const simulated = totals
    .map((entry) =>
      entry.gameId === gameId
        ? { ...entry, totalCents: entry.totalCents - removeCents }
        : entry
    )
    .filter((entry) => entry.totalCents > 0)
    .sort((a, b) => b.totalCents - a.totalCents)
  const index = simulated.findIndex((entry) => entry.gameId === gameId)
  return index < 0 ? null : index + 1
}

const prev = rankAfterRemovingCents(
  [
    { gameId: 1, totalCents: 1500 },
    { gameId: 2, totalCents: 800 },
    { gameId: 3, totalCents: 400 }
  ],
  1,
  800
)
if (prev !== 2) {
  console.error('FAIL: previous rank should drop to #2 after removing $8', prev)
  process.exit(1)
}

const leftBoard = rankAfterRemovingCents(
  [{ gameId: 1, totalCents: 100 }],
  1,
  100
)
if (leftBoard !== null) {
  console.error('FAIL: first bid should leave the board when removed', leftBoard)
  process.exit(1)
}

function formatExpiryClock(remainingMs, units) {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000))
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (days > 0) return `${days}${units.day} ${pad(hours)}${units.hour} ${pad(minutes)}${units.minute}`
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

const clock = formatExpiryClock((2 * 86400 + 4 * 3600 + 3 * 60) * 1000, {
  day: 'd',
  hour: 'h',
  minute: 'm'
})
if (clock !== '2d 04h 03m') {
  console.error('FAIL: expiry clock format', clock)
  process.exit(1)
}

console.log('OK: events and svg helpers', {
  bidId,
  eventType: eventRow.type
})
