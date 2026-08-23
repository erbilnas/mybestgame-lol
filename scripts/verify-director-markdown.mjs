/**
 * ponytail: asserts markdown visible-length ignores markers; links ok, images stripped.
 * Run: node --experimental-strip-types scripts/verify-director-markdown.mjs
 */
import assert from 'node:assert/strict'
import {
  DIRECTOR_DESC_VISIBLE_MAX,
  markdownVisibleLength,
  renderDirectorMarkdown
} from '../shared/utils/director-markdown.ts'

assert.equal(markdownVisibleLength('**hi**'), 2)
assert.equal(markdownVisibleLength('Hello **world**'), 11)
assert.equal(markdownVisibleLength('a'.repeat(DIRECTOR_DESC_VISIBLE_MAX)), DIRECTOR_DESC_VISIBLE_MAX)

const withLink = renderDirectorMarkdown('Go [here](https://example.com/path) and **bold**')
assert.ok(withLink.includes('href="https://example.com/path"'), 'http(s) links must render')
assert.ok(withLink.includes('rel="noopener noreferrer nofollow"'), 'links must be hardened')
assert.ok(withLink.includes('<strong>bold</strong>'), 'bold must render')
assert.ok(withLink.includes('>here</a>'), 'link label text must remain')

const noJs = renderDirectorMarkdown('[x](javascript:alert(1))')
assert.ok(!noJs.includes('javascript:'), 'javascript: urls must be stripped')

const noImg = renderDirectorMarkdown('Hi ![alt](https://evil.example/x.png)')
assert.ok(!noImg.includes('<img'), 'images must not render')
assert.ok(!noImg.includes('evil.example'), 'image urls must not appear')

console.log('verify-director-markdown: ok')
