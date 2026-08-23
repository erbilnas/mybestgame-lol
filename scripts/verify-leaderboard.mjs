import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const dbPath = resolve(process.cwd(), process.env.NUXT_DATABASE_URL ?? './data/mybestgame.db')
mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('foreign_keys = ON')

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    cover_url TEXT,
    slug TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id),
    display_name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    ad_title TEXT NOT NULL,
    ad_link TEXT NOT NULL,
    ad_image TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    polar_checkout_id TEXT,
    polar_order_id TEXT,
    expires_at INTEGER,
    created_at INTEGER NOT NULL
  );
`)

const gameId = 999001
const bidId = randomUUID()
const now = Date.now()
const expiresAt = now + 30 * 24 * 60 * 60 * 1000

sqlite.prepare(`
  INSERT INTO games (id, title, cover_url, slug, created_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET title = excluded.title
`).run(gameId, 'Test Game', null, 'test-game', now)

sqlite.prepare(`
  DELETE FROM bids WHERE game_id = ?
`).run(gameId)

sqlite.prepare(`
  INSERT INTO bids (id, game_id, display_name, amount, ad_title, ad_link, ad_image, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
`).run(bidId, gameId, 'test@example.com', 500, 'Test Ad', 'https://example.com', null, now)

sqlite.prepare(`
  UPDATE bids
  SET status = 'paid', expires_at = ?, polar_order_id = 'order_test'
  WHERE id = ? AND status = 'pending'
`).run(expiresAt, bidId)

const leaderboard = sqlite.prepare(`
  SELECT game_id, coalesce(sum(amount), 0) AS total_cents
  FROM bids
  WHERE status = 'paid' AND (expires_at IS NULL OR expires_at > ?)
  GROUP BY game_id
  ORDER BY total_cents DESC
`).all(now)

const row = leaderboard.find(entry => entry.game_id === gameId)

if (!row || row.total_cents !== 500) {
  console.error('FAIL: paid bid did not appear on leaderboard', { row, leaderboard })
  process.exit(1)
}

console.log('OK: paid bid appears on leaderboard', { bidId, totalCents: row.total_cents })
