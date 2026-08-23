import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const games = sqliteTable('games', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  coverUrl: text('cover_url'),
  slug: text('slug').notNull(),
  summary: text('summary'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

export const bidTypes = ['game'] as const
export type BidType = typeof bidTypes[number]

export const bids = sqliteTable('bids', {
  id: text('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id),
  bidType: text('bid_type', { enum: bidTypes }).notNull().default('game'),
  displayName: text('display_name').notNull(),
  amount: integer('amount').notNull(),
  adTitle: text('ad_title').notNull(),
  adLink: text('ad_link').notNull(),
  adImage: text('ad_image'),
  adDescription: text('ad_description'),
  clickCount: integer('click_count').notNull().default(0),
  status: text('status', { enum: ['pending', 'paid', 'expired', 'failed'] }).notNull().default('pending'),
  polarCheckoutId: text('polar_checkout_id'),
  polarOrderId: text('polar_order_id'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}, table => [
  index('bids_game_id_idx').on(table.gameId),
  index('bids_status_idx').on(table.status),
  index('bids_polar_checkout_id_idx').on(table.polarCheckoutId),
  uniqueIndex('bids_polar_order_id_uidx').on(table.polarOrderId),
  index('bids_status_game_id_idx').on(table.status, table.gameId),
  index('bids_status_type_game_idx').on(table.status, table.bidType, table.gameId),
  index('bids_status_created_idx').on(table.status, table.createdAt)
])

export const boardEventTypes = ['bid_paid', 'rank_takeover', 'director_takeover', 'decay'] as const
export type BoardEventType = typeof boardEventTypes[number]

export const boardEvents = sqliteTable('board_events', {
  id: text('id').primaryKey(),
  type: text('type', { enum: boardEventTypes }).notNull(),
  gameId: integer('game_id').notNull().references(() => games.id),
  bidId: text('bid_id'),
  payload: text('payload').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}, table => [
  index('board_events_created_at_idx').on(table.createdAt),
  index('board_events_game_id_idx').on(table.gameId)
])

/** One free $1 game support per device cookie AND per IP, forever. */
export const deviceFreeClaims = sqliteTable('device_free_claims', {
  deviceId: text('device_id').primaryKey(),
  ip: text('ip').notNull(),
  bidId: text('bid_id').notNull(),
  claimedAt: integer('claimed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}, table => [
  uniqueIndex('device_free_claims_ip_uidx').on(table.ip)
])

export type Game = typeof games.$inferSelect
export type Bid = typeof bids.$inferSelect
export type NewBid = typeof bids.$inferInsert
export type BoardEvent = typeof boardEvents.$inferSelect
export type DeviceFreeClaim = typeof deviceFreeClaims.$inferSelect
