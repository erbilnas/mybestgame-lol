import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as schema from './schema'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

let sqliteClient: Database.Database | null = null

export function useDb() {
  if (db) {
    return db
  }

  const config = useRuntimeConfig()
  const dbPath = resolve(process.cwd(), config.databaseUrl)
  mkdirSync(dirname(dbPath), { recursive: true })

  sqliteClient = new Database(dbPath)
  sqliteClient.pragma('journal_mode = WAL')
  sqliteClient.pragma('foreign_keys = ON')

  db = drizzle(sqliteClient, { schema })
  return db
}

export function useSqlite() {
  useDb()
  if (!sqliteClient) {
    throw new Error('SQLite client not initialized')
  }
  return sqliteClient
}

export function initDb() {
  const sqlite = useSqlite()

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      cover_url TEXT,
      slug TEXT NOT NULL,
      summary TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id),
      bid_type TEXT NOT NULL DEFAULT 'game',
      display_name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      ad_title TEXT NOT NULL,
      ad_link TEXT NOT NULL,
      ad_image TEXT,
      ad_description TEXT,
      click_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      polar_checkout_id TEXT,
      polar_order_id TEXT,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS bids_game_id_idx ON bids(game_id);
    CREATE INDEX IF NOT EXISTS bids_status_idx ON bids(status);
    CREATE INDEX IF NOT EXISTS bids_status_game_id_idx ON bids(status, game_id);
    CREATE INDEX IF NOT EXISTS bids_status_type_game_idx ON bids(status, bid_type, game_id);
    CREATE INDEX IF NOT EXISTS bids_status_created_idx ON bids(status, created_at);
    -- bids_polar_checkout_id_idx created after column migrations (existing DBs may lack the column)

    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      key TEXT PRIMARY KEY NOT NULL,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS board_events (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      game_id INTEGER NOT NULL REFERENCES games(id),
      bid_id TEXT,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS board_events_created_at_idx ON board_events(created_at);
    CREATE INDEX IF NOT EXISTS board_events_game_id_idx ON board_events(game_id);

    CREATE TABLE IF NOT EXISTS device_free_claims (
      device_id TEXT PRIMARY KEY NOT NULL,
      ip TEXT NOT NULL,
      bid_id TEXT NOT NULL,
      claimed_at INTEGER NOT NULL
    );
  `)

  const gameColumns = sqlite.prepare('PRAGMA table_info(games)').all() as { name: string }[]
  if (!gameColumns.some(column => column.name === 'summary')) {
    sqlite.exec('ALTER TABLE games ADD COLUMN summary TEXT')
  }

  let bidColumns = sqlite.prepare('PRAGMA table_info(bids)').all() as { name: string }[]
  if (!bidColumns.some(column => column.name === 'click_count')) {
    sqlite.exec('ALTER TABLE bids ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0')
  }
  if (!bidColumns.some(column => column.name === 'bid_type')) {
    sqlite.exec(`ALTER TABLE bids ADD COLUMN bid_type TEXT NOT NULL DEFAULT 'sponsor'`)
  }
  if (!bidColumns.some(column => column.name === 'ad_description')) {
    sqlite.exec('ALTER TABLE bids ADD COLUMN ad_description TEXT')
  }

  if (bidColumns.some(column => column.name === 'email') && !bidColumns.some(column => column.name === 'display_name')) {
    sqlite.exec('ALTER TABLE bids RENAME COLUMN email TO display_name')
  }

  // Local DBs from a reverted Stripe rename may still have stripe_* columns.
  bidColumns = sqlite.prepare('PRAGMA table_info(bids)').all() as { name: string }[]
  const hasPolarCheckout = bidColumns.some(column => column.name === 'polar_checkout_id')
  const hasPolarOrder = bidColumns.some(column => column.name === 'polar_order_id')
  const hasStripeCheckout = bidColumns.some(column => column.name === 'stripe_checkout_id')
  const hasStripePayment = bidColumns.some(column => column.name === 'stripe_payment_id')

  if (hasStripeCheckout && !hasPolarCheckout) {
    sqlite.exec('DROP INDEX IF EXISTS bids_stripe_checkout_id_idx')
    sqlite.exec('ALTER TABLE bids RENAME COLUMN stripe_checkout_id TO polar_checkout_id')
  } else if (!hasPolarCheckout) {
    sqlite.exec('ALTER TABLE bids ADD COLUMN polar_checkout_id TEXT')
  }

  if (hasStripePayment && !hasPolarOrder) {
    sqlite.exec('DROP INDEX IF EXISTS bids_stripe_payment_id_uidx')
    sqlite.exec('ALTER TABLE bids RENAME COLUMN stripe_payment_id TO polar_order_id')
  } else if (!hasPolarOrder) {
    sqlite.exec('ALTER TABLE bids ADD COLUMN polar_order_id TEXT')
  }

  sqlite.exec('CREATE INDEX IF NOT EXISTS bids_polar_checkout_id_idx ON bids(polar_checkout_id)')

  const freeClaimColumns = sqlite.prepare('PRAGMA table_info(device_free_claims)').all() as { name: string }[]
  if (freeClaimColumns.length > 0 && !freeClaimColumns.some(column => column.name === 'ip')) {
    sqlite.exec(`ALTER TABLE device_free_claims ADD COLUMN ip TEXT NOT NULL DEFAULT ''`)
    sqlite.exec(`
      UPDATE device_free_claims
      SET ip = 'legacy:' || device_id
      WHERE ip = '' OR ip IS NULL
    `)
  }

  // Index only after ip exists (CREATE TABLE IF NOT EXISTS won't add columns to old tables).
  const freeClaimColumnsAfter = sqlite.prepare('PRAGMA table_info(device_free_claims)').all() as { name: string }[]
  if (freeClaimColumnsAfter.some(column => column.name === 'ip')) {
    sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS device_free_claims_ip_uidx ON device_free_claims(ip)')
  }

  sqlite.exec(`
    UPDATE bids
    SET polar_order_id = 'free:' || id
    WHERE polar_order_id = 'free'
  `)

  // Deduplicate before unique index (legacy seed used seed_order_<game>_<type> for every stack bid).
  sqlite.exec(`
    UPDATE bids
    SET polar_order_id = polar_order_id || ':' || id
    WHERE polar_order_id IS NOT NULL
      AND polar_order_id IN (
        SELECT polar_order_id
        FROM bids
        WHERE polar_order_id IS NOT NULL
        GROUP BY polar_order_id
        HAVING COUNT(*) > 1
      )
  `)

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS bids_polar_order_id_uidx ON bids(polar_order_id)
      WHERE polar_order_id IS NOT NULL
  `)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      key TEXT PRIMARY KEY NOT NULL,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    )
  `)

  sqlite.exec('DROP TABLE IF EXISTS weekly_snapshots')

  // Merge legacy sponsor auction into support + Game Director Message.
  sqlite.exec(`UPDATE bids SET bid_type = 'game' WHERE bid_type = 'sponsor'`)
  sqlite.exec(`UPDATE board_events SET type = 'director_takeover' WHERE type = 'sponsor_takeover'`)
}
