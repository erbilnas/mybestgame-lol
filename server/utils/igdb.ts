interface TwitchTokenCache {
  token: string
  expiresAt: number
}

interface IgdbNamed {
  name?: string
}

interface IgdbInvolvedCompany {
  developer?: boolean
  publisher?: boolean
  company?: { name?: string }
}

interface IgdbImage {
  image_id?: string
}

interface IgdbGameResult {
  id: number
  name: string
  slug: string
  summary?: string
  storyline?: string
  cover?: IgdbImage
  screenshots?: IgdbImage[]
  artworks?: IgdbImage[]
  first_release_date?: number
  genres?: IgdbNamed[]
  platforms?: IgdbNamed[]
  game_modes?: IgdbNamed[]
  involved_companies?: IgdbInvolvedCompany[]
  aggregated_rating?: number
  aggregated_rating_count?: number
  total_rating?: number
  total_rating_count?: number
  url?: string
}

export interface GameSearchResult {
  id: number
  title: string
  slug: string
  coverUrl: string | null
}

interface QueryCacheEntry {
  results: GameSearchResult[]
  expiresAt: number
}

interface GameDetailsCacheEntry {
  details: GameDetails
  expiresAt: number
}

const tokenCache: TwitchTokenCache = { token: '', expiresAt: 0 }
const queryCache = new Map<string, QueryCacheEntry>()
const gameDetailsByIdCache = new Map<number, GameDetailsCacheEntry>()
const gameDetailsBySlugCache = new Map<string, GameDetailsCacheEntry>()
const QUERY_CACHE_TTL_MS = 5 * 60 * 1000
const GAME_DETAILS_CACHE_TTL_MS = 60 * 60 * 1000

function igdbImageUrl(imageId: string | undefined, size: 'cover' | 'screenshot' | 'artwork'): string | null {
  if (!imageId) return null

  const sizeToken = size === 'cover'
    ? 't_cover_big'
    : size === 'screenshot'
      ? 't_screenshot_big'
      : 't_1080p'

  return `https://images.igdb.com/igdb/image/upload/${sizeToken}/${imageId}.jpg`
}

function coverUrl(imageId?: string): string | null {
  return igdbImageUrl(imageId, 'cover')
}

function imageUrls(
  items: IgdbImage[] | undefined,
  size: 'screenshot' | 'artwork',
  max = 8
): string[] {
  return (items ?? [])
    .map(item => igdbImageUrl(item.image_id, size))
    .filter((url): url is string => Boolean(url))
    .slice(0, max)
}

function namedList(items?: IgdbNamed[]): string[] {
  return (items ?? [])
    .map(item => item.name?.trim())
    .filter((name): name is string => Boolean(name))
}

function companiesByRole(
  companies: IgdbInvolvedCompany[] | undefined,
  role: 'developer' | 'publisher'
): string[] {
  return (companies ?? [])
    .filter(entry => role === 'developer' ? entry.developer : entry.publisher)
    .map(entry => entry.company?.name?.trim())
    .filter((name): name is string => Boolean(name))
}

async function getTwitchToken(): Promise<string> {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }

  const config = useRuntimeConfig()
  const clientId = config.twitchClientId
  const clientSecret = config.twitchClientSecret

  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 503, statusMessage: 'IGDB credentials not configured' })
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  })

  const response = await $fetch<{ access_token: string, expires_in: number }>(
    `https://id.twitch.tv/oauth2/token?${params.toString()}`,
    { method: 'POST' }
  )

  tokenCache.token = response.access_token
  tokenCache.expiresAt = Date.now() + response.expires_in * 1000
  return tokenCache.token
}

export async function searchGames(query: string, limit = 10): Promise<GameSearchResult[]> {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const cached = queryCache.get(normalized)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.results.slice(0, limit)
  }

  const config = useRuntimeConfig()
  const token = await getTwitchToken()
  const sanitized = query.trim().replace(/"/g, '\\"')
  const body = `search "${sanitized}"; fields name, slug, cover.image_id; limit ${limit};`

  const results = await $fetch<IgdbGameResult[]>('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': config.twitchClientId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/plain'
    },
    body
  })

  const mapped = results.map(game => ({
    id: game.id,
    title: game.name,
    slug: game.slug,
    coverUrl: coverUrl(game.cover?.image_id)
  }))

  queryCache.set(normalized, {
    results: mapped,
    expiresAt: Date.now() + QUERY_CACHE_TTL_MS
  })

  return mapped
}

export interface GameDetails {
  id: number
  title: string
  slug: string
  coverUrl: string | null
  summary: string | null
  storyline: string | null
  screenshots: string[]
  artworks: string[]
  releaseDate: string | null
  genres: string[]
  platforms: string[]
  gameModes: string[]
  developers: string[]
  publishers: string[]
  rating: number | null
  ratingCount: number
  igdbUrl: string | null
}

export async function fetchGameById(gameId: number): Promise<GameDetails | null> {
  const cached = gameDetailsByIdCache.get(gameId)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.details
  }

  const details = await fetchGameFromIgdb(`where id = ${gameId}`)
  if (details) {
    cacheGameDetails(details)
  }
  return details
}

export async function fetchGameBySlug(slug: string): Promise<GameDetails | null> {
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return null

  const cached = gameDetailsBySlugCache.get(normalized)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.details
  }

  const escaped = slug.trim().replace(/"/g, '\\"')
  const details = await fetchGameFromIgdb(`where slug = "${escaped}"`)
  if (details) {
    cacheGameDetails(details)
  }
  return details
}

function cacheGameDetails(details: GameDetails): void {
  const expiresAt = Date.now() + GAME_DETAILS_CACHE_TTL_MS
  gameDetailsByIdCache.set(details.id, { details, expiresAt })
  gameDetailsBySlugCache.set(details.slug.toLowerCase(), { details, expiresAt })
}

export async function fetchGameDetails(
  gameId: number,
  slug?: string | null
): Promise<GameDetails | null> {
  const byId = await fetchGameById(gameId)
  if (byId) return byId
  if (slug) return fetchGameBySlug(slug)
  return null
}

async function fetchGameFromIgdb(whereClause: string): Promise<GameDetails | null> {
  const config = useRuntimeConfig()
  const token = await getTwitchToken()

  const results = await $fetch<IgdbGameResult[]>('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': config.twitchClientId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/plain'
    },
    body: [
      'fields name, slug, summary, storyline, cover.image_id, screenshots.image_id, artworks.image_id,',
      'first_release_date, genres.name, platforms.name, game_modes.name,',
      'involved_companies.company.name, involved_companies.developer, involved_companies.publisher,',
      'aggregated_rating, aggregated_rating_count, total_rating, total_rating_count, url;',
      `${whereClause};`,
      'limit 1;'
    ].join(' ')
  })

  const game = results[0]
  if (!game) return null

  const rating = game.aggregated_rating ?? game.total_rating ?? null
  const ratingCount = game.aggregated_rating_count ?? game.total_rating_count ?? 0

  return {
    id: game.id,
    title: game.name,
    slug: game.slug,
    coverUrl: coverUrl(game.cover?.image_id),
    summary: game.summary?.trim() || null,
    storyline: game.storyline?.trim() || null,
    screenshots: imageUrls(game.screenshots, 'screenshot'),
    artworks: imageUrls(game.artworks, 'artwork'),
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
      : null,
    genres: namedList(game.genres),
    platforms: namedList(game.platforms),
    gameModes: namedList(game.game_modes),
    developers: companiesByRole(game.involved_companies, 'developer'),
    publishers: companiesByRole(game.involved_companies, 'publisher'),
    rating: rating == null ? null : Math.round(rating),
    ratingCount,
    igdbUrl: game.url?.trim() || `https://www.igdb.com/games/${game.slug}`
  }
}
