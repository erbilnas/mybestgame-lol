import Database from 'better-sqlite3'
import { resolve } from 'node:path'

const dbPath = resolve(process.cwd(), process.env.NUXT_DATABASE_URL ?? './data/mybestgame.db')
const sqlite = new Database(dbPath)

const result = sqlite.prepare(`
  UPDATE bids
  SET status = 'failed', expires_at = NULL
  WHERE status = 'paid' AND polar_order_id IS NULL
`).run()

console.log(`Reset ${result.changes} unpaid bid(s) that were incorrectly marked paid.`)
