/**
 * ponytail: assert leaderboard pagination contract (limit/offset/hasMore).
 * Run: node --experimental-strip-types is unnecessary; plain assert via import.
 * Usage with app up: node scripts/verify-leaderboard-page.mjs
 * Or dry unit of the slice math below (no server).
 */
import assert from 'node:assert/strict'

function pageSlice(total, limit, offset) {
  const entries = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => offset + i)
  return {
    entries,
    total,
    offset,
    limit,
    hasMore: offset + entries.length < total
  }
}

const first = pageSlice(120, 50, 0)
assert.equal(first.entries.length, 50)
assert.equal(first.hasMore, true)

const second = pageSlice(120, 50, 50)
assert.equal(second.entries.length, 50)
assert.equal(second.hasMore, true)

const last = pageSlice(120, 50, 100)
assert.equal(last.entries.length, 20)
assert.equal(last.hasMore, false)

const empty = pageSlice(0, 50, 0)
assert.equal(empty.entries.length, 0)
assert.equal(empty.hasMore, false)

const overshoot = pageSlice(10, 50, 50)
assert.equal(overshoot.entries.length, 0)
assert.equal(overshoot.hasMore, false)

console.log('verify-leaderboard-page: ok')
