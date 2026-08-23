import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const TARGET_COUNT = 100
const SEED_ID_BASE = 900001

const dbPath = resolve(process.cwd(), process.env.NUXT_DATABASE_URL ?? './data/mybestgame.db')
mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('foreign_keys = ON')

const gameColumns = sqlite.prepare('PRAGMA table_info(games)').all()
if (!gameColumns.some(column => column.name === 'summary')) {
  sqlite.exec('ALTER TABLE games ADD COLUMN summary TEXT')
}

const bidColumns = sqlite.prepare('PRAGMA table_info(bids)').all()
if (!bidColumns.some(column => column.name === 'click_count')) {
  sqlite.exec('ALTER TABLE bids ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0')
}
if (!bidColumns.some(column => column.name === 'bid_type')) {
  sqlite.exec(`ALTER TABLE bids ADD COLUMN bid_type TEXT NOT NULL DEFAULT 'sponsor'`)
}
if (!bidColumns.some(column => column.name === 'ad_description')) {
  sqlite.exec('ALTER TABLE bids ADD COLUMN ad_description TEXT')
}
if (!bidColumns.some(column => column.name === 'display_name')) {
  if (bidColumns.some(column => column.name === 'email')) {
    sqlite.exec('ALTER TABLE bids RENAME COLUMN email TO display_name')
  }
}

const cover = imageId => `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`

/** Curated podium-friendly entries (kept as the richest mock data). */
const curatedGames = [
  {
    id: 900001,
    title: 'Elden Ring',
    slug: 'elden-ring',
    coverUrl: cover('co4jni'),
    summary: 'A fantasy action-RPG adventure set within a world created by Hidetaka Miyazaki and George R. R. Martin.',
    bids: [
      { type: 'sponsor', displayName: 'maria', amount: 85000, adTitle: 'Official Strategy Guides', adLink: 'https://example.com/elden-guides', adImage: cover('co4jni'), adDescription: 'Patch notes, builds, and boss cheese.', clicks: 2841, hoursAgo: 2 },
      { type: 'game', displayName: 'tarnished', amount: 45000, hoursAgo: 5 },
      { type: 'game', displayName: 'grace', amount: 20000, hoursAgo: 18 }
    ]
  },
  {
    id: 900002,
    title: 'The Legend of Zelda: Breath of the Wild',
    slug: 'the-legend-of-zelda-breath-of-the-wild',
    coverUrl: cover('ar1n7'),
    summary: 'Step into a world of discovery, exploration, and adventure in Breath of the Wild.',
    bids: [
      { type: 'sponsor', displayName: 'hyrule', amount: 62000, adTitle: 'Hyrule Tourism Board', adLink: 'https://example.com/hyrule', adImage: null, adDescription: 'Visit the stables. Pet the horses.', clicks: 1922, hoursAgo: 4 },
      { type: 'game', displayName: 'link', amount: 38000, hoursAgo: 9 },
      { type: 'game', displayName: 'zelda', amount: 15000, hoursAgo: 26 }
    ]
  },
  {
    id: 900003,
    title: 'Red Dead Redemption 2',
    slug: 'red-dead-redemption-2',
    coverUrl: cover('co1q1f'),
    summary: 'America, 1899. Arthur Morgan and the Van der Linde gang are outlaws on the run.',
    bids: [
      { type: 'sponsor', displayName: 'outlaw', amount: 51000, adTitle: 'Saloon Supplies Co.', adLink: 'https://example.com/saloon', adImage: cover('co1q1f'), adDescription: 'Whiskey, beans, and questionable morals.', clicks: 967, hoursAgo: 6 },
      { type: 'game', displayName: 'dutch', amount: 29000, hoursAgo: 12 },
      { type: 'game', displayName: 'arthur', amount: 12000, hoursAgo: 30 }
    ]
  },
  {
    id: 900004,
    title: 'Hades',
    slug: 'hades',
    coverUrl: cover('co2dfe'),
    summary: 'Defy the god of the dead as you hack and slash out of the Underworld.',
    bids: [
      { type: 'sponsor', displayName: 'zag', amount: 18000, adTitle: 'Underworld Express', adLink: 'https://example.com/hades-run', adImage: null, adDescription: 'One more escape attempt.', clicks: 412, hoursAgo: 8 },
      { type: 'game', displayName: 'nyx', amount: 14000, hoursAgo: 15 }
    ]
  },
  {
    id: 900005,
    title: 'Celeste',
    slug: 'celeste',
    coverUrl: cover('co1rba'),
    summary: 'Help Madeline survive her inner demons on her journey to the top of Celeste Mountain.',
    bids: [
      { type: 'game', displayName: 'madeline', amount: 22000, hoursAgo: 10 },
      { type: 'sponsor', displayName: 'berry', amount: 8000, adTitle: 'Strawberry Collectors Club', adLink: 'https://example.com/berries', adImage: null, adDescription: 'Collect them all. Panic later.', clicks: 188, hoursAgo: 20 }
    ]
  },
  {
    id: 900006,
    title: 'Portal 2',
    slug: 'portal-2',
    coverUrl: cover('co1rs7'),
    summary: 'A hilariously mind-bending adventure that challenges you to use portal gun mechanics.',
    bids: [
      { type: 'sponsor', displayName: 'aperture', amount: 12000, adTitle: 'Aperture Science', adLink: 'https://example.com/aperture', adImage: cover('co1rs7'), adDescription: 'We do what we must because we can.', clicks: 903, hoursAgo: 14 },
      { type: 'game', displayName: 'chell', amount: 9000, hoursAgo: 22 }
    ]
  },
  {
    id: 900007,
    title: 'Disco Elysium',
    slug: 'disco-elysium',
    coverUrl: cover('co2veu'),
    summary: 'A groundbreaking RPG. You are a detective with a unique skill system.',
    bids: [
      { type: 'game', displayName: 'harry', amount: 16000, hoursAgo: 16 },
      { type: 'game', displayName: 'kim', amount: 4000, hoursAgo: 28 }
    ]
  },
  {
    id: 900008,
    title: 'Hollow Knight',
    slug: 'hollow-knight',
    coverUrl: cover('co93cr'),
    summary: 'An epic action adventure through a vast ruined kingdom of insects and heroes.',
    bids: [
      { type: 'sponsor', displayName: 'silksong', amount: 7000, adTitle: 'Silksong Watch', adLink: 'https://example.com/silksong', adImage: null, adDescription: 'Still waiting. Still sponsoring.', clicks: 1240, hoursAgo: 11 },
      { type: 'game', displayName: 'knight', amount: 8000, hoursAgo: 19 }
    ]
  },
  {
    id: 900009,
    title: 'God of War',
    slug: 'god-of-war--1',
    coverUrl: cover('co1tmu'),
    summary: 'Kratos now lives as a man in the realm of Norse Gods and monsters.',
    bids: [
      { type: 'game', displayName: 'kratos', amount: 11000, hoursAgo: 24 },
      { type: 'game', displayName: 'atreus', amount: 3000, hoursAgo: 36 }
    ]
  },
  {
    id: 900010,
    title: 'Stardew Valley',
    slug: 'stardew-valley',
    coverUrl: cover('co3nbc'),
    summary: 'You inherited your grandfather\'s old farm plot. Begin your new life.',
    bids: [
      { type: 'sponsor', displayName: 'pierre', amount: 5000, adTitle: 'Pierre\'s General Store', adLink: 'https://example.com/pierre', adImage: null, adDescription: 'Seeds, saplings, and small-town drama.', clicks: 356, hoursAgo: 7 },
      { type: 'game', displayName: 'farmer', amount: 4000, hoursAgo: 32 }
    ]
  }
]

const coverPool = [
  'co4jni', 'ar1n7', 'co1q1f', 'co2dfe', 'co1rba', 'co1rs7', 'co2veu', 'co93cr', 'co1tmu', 'co3nbc',
  'co2l7z', 'co1wyy', 'co2cto', 'co1r7f', 'co1iqw', 'co1x7d', 'co2enc', 'co1r6d', 'co1t26', 'co1rb7'
]

const titleParts = {
  prefixes: [
    'Neon', 'Iron', 'Crystal', 'Shadow', 'Solar', 'Velvet', 'Pixel', 'Cosmic', 'Rusty', 'Frozen',
    'Golden', 'Silent', 'Wild', 'Broken', 'Hyper', 'Lunar', 'Storm', 'Echo', 'Quantum', 'Arcade'
  ],
  middles: [
    'Circuit', 'Kingdom', 'Drift', 'Blade', 'Harbor', 'Canyon', 'Signal', 'Forge', 'Garden', 'Vault',
    'Rift', 'Chronicle', 'Protocol', 'Frontier', 'Mirage', 'Outpost', 'Cascade', 'Orbit', 'Legacy', 'Pulse'
  ],
  suffixes: [
    'Online', 'Rising', 'Zero', 'Reborn', 'Chronicles', 'Tactics', 'Arena', 'Escape', 'Quest', 'Wars',
    'Simulator', 'Deluxe', 'Remastered', 'Origins', 'Aftermath', 'Unlocked', 'Infinite', 'Strike', 'Saga', 'Edition'
  ]
}

const handles = [
  'pixelpete', 'lootfox', 'rankrider', 'bidbunny', 'arcaderat', 'stacksnake', 'covercat', 'sponsorowl',
  'boardbear', 'clickcrow', 'plaqueplat', 'decaydog', 'takeovertiger', 'igdbibis', 'podiumpanda'
]

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function mockTitle(index) {
  const p = titleParts.prefixes[index % titleParts.prefixes.length]
  const m = titleParts.middles[Math.floor(index / titleParts.prefixes.length) % titleParts.middles.length]
  const s = titleParts.suffixes[Math.floor(index / (titleParts.prefixes.length * titleParts.middles.length)) % titleParts.suffixes.length]
  return `${p} ${m} ${s}`
}

function buildGeneratedGames(count, startId) {
  const games = []
  for (let i = 0; i < count; i++) {
    const id = startId + i
    const title = mockTitle(i)
    const slug = `${slugify(title)}-${id}`
    const coverUrl = cover(coverPool[i % coverPool.length])
    // Decreasing totals so ranks stay stable and searchable by name.
    const gameAmount = Math.max(100, 9500 - i * 85)
    const hasSponsor = i % 3 === 0
    const sponsorAmount = hasSponsor ? Math.max(100, 2200 - (i % 40) * 40) : 0
    const handle = handles[i % handles.length]
    const hoursAgo = 1 + (i % 48)

    const bids = [
      { type: 'game', displayName: handle, amount: gameAmount, hoursAgo }
    ]

    if (hasSponsor) {
      bids.unshift({
        type: 'sponsor',
        displayName: `${handle}-sponsor`,
        amount: sponsorAmount,
        adTitle: `${title.split(' ')[0]} Merch Drop`,
        adLink: `https://example.com/mock/${slug}`,
        adImage: i % 2 === 0 ? coverUrl : null,
        adDescription: `Mock sponsor spot for ${title}. Not a real deal.`,
        clicks: (i * 17) % 900,
        hoursAgo: Math.max(1, hoursAgo - 1)
      })
    }

    games.push({
      id,
      title,
      slug,
      coverUrl,
      summary: `Mock seed entry #${i + 1}: ${title}. Generated for leaderboard search and ranking tests.`,
      bids
    })
  }
  return games
}

const generatedNeeded = Math.max(0, TARGET_COUNT - curatedGames.length)
const seedGames = [
  ...curatedGames,
  ...buildGeneratedGames(generatedNeeded, SEED_ID_BASE + curatedGames.length)
].slice(0, TARGET_COUNT)

const seedIds = seedGames.map(game => game.id)
const now = Date.now()
const expiresAt = now + 30 * 24 * 60 * 60 * 1000

const deleteBids = sqlite.prepare('DELETE FROM bids WHERE game_id = ?')
const deleteGame = sqlite.prepare('DELETE FROM games WHERE id = ?')
const insertGame = sqlite.prepare(`
  INSERT INTO games (id, title, cover_url, slug, summary, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)
const insertBid = sqlite.prepare(`
  INSERT INTO bids (
    id, game_id, bid_type, display_name, amount, ad_title, ad_link, ad_image, ad_description,
    click_count, status, polar_order_id, expires_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)
`)

sqlite.exec('BEGIN')
try {
  // Clear previous mock seed range so re-runs stay idempotent.
  sqlite.prepare(`
    DELETE FROM board_events
    WHERE game_id >= ? AND game_id < ?
  `).run(SEED_ID_BASE, SEED_ID_BASE + 1000)
  sqlite.prepare(`
    DELETE FROM bids
    WHERE game_id >= ? AND game_id < ?
  `).run(SEED_ID_BASE, SEED_ID_BASE + 1000)
  sqlite.prepare(`
    DELETE FROM games
    WHERE id >= ? AND id < ?
  `).run(SEED_ID_BASE, SEED_ID_BASE + 1000)

  for (const id of seedIds) {
    sqlite.prepare('DELETE FROM board_events WHERE game_id = ?').run(id)
    deleteBids.run(id)
    deleteGame.run(id)
  }

  for (const game of seedGames) {
    insertGame.run(
      game.id,
      game.title,
      game.coverUrl,
      game.slug,
      game.summary,
      now - 7 * 24 * 60 * 60 * 1000
    )

    for (const bid of game.bids) {
      const isSponsor = bid.type === 'sponsor'
      const bidId = randomUUID()
      insertBid.run(
        bidId,
        game.id,
        bid.type,
        bid.displayName,
        bid.amount,
        isSponsor ? bid.adTitle : '',
        isSponsor ? bid.adLink : '',
        isSponsor ? (bid.adImage ?? null) : null,
        isSponsor ? (bid.adDescription ?? null) : null,
        isSponsor ? (bid.clicks ?? 0) : 0,
        // Unique per bid: stacking game bids share type and must not collide on polar_order_id.
        `seed_order_${game.id}_${bid.type}_${bidId}`,
        expiresAt,
        now - bid.hoursAgo * 60 * 60 * 1000
      )
    }
  }

  sqlite.exec('COMMIT')
} catch (error) {
  sqlite.exec('ROLLBACK')
  throw error
}

const leaderboard = sqlite.prepare(`
  SELECT g.title, coalesce(sum(b.amount), 0) AS total_cents
  FROM games g
  LEFT JOIN bids b ON b.game_id = g.id AND b.status = 'paid'
  WHERE g.id IN (${seedIds.join(',')})
  GROUP BY g.id
  ORDER BY total_cents DESC, g.id ASC
`).all()

console.log(`Seeded ${seedGames.length} mock games (${curatedGames.length} curated + ${generatedNeeded} generated).`)
console.log('Top 5:')
for (const [index, row] of leaderboard.slice(0, 5).entries()) {
  console.log(`  #${index + 1} ${row.title} — $${(row.total_cents / 100).toFixed(0)}`)
}
console.log(`  … and ${Math.max(0, leaderboard.length - 5)} more`)
console.log(`Run: npm run seed:leaderboard`)
