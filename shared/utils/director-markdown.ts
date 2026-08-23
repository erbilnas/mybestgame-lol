import DOMPurify from 'isomorphic-dompurify'
import { marked, Renderer } from 'marked'

/** Visible text limit — markdown markers do not count. */
export const DIRECTOR_DESC_VISIBLE_MAX = 280

/** Hard cap on stored source size (markers included) to limit abuse. */
export const DIRECTOR_DESC_RAW_MAX = 2_000

export const MARKDOWN_GUIDE_URL = 'https://www.markdownguide.org/'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'del',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'a'
] as const

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function safeHttpUrl(href: string): string | null {
  try {
    const parsed = new URL(href)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function directorRenderer(): Renderer {
  const renderer = new Renderer()
  renderer.link = function link({ href, title, tokens }) {
    const label = this.parser.parseInline(tokens)
    const safeHref = safeHttpUrl(href)
    if (!safeHref) return label
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
    return `<a href="${escapeAttr(safeHref)}"${titleAttr} target="_blank" rel="noopener noreferrer nofollow">${label}</a>`
  }
  // Images stay stripped (no outbound image loads / Polar-safe creatives).
  renderer.image = () => ''
  return renderer
}

function toHtml(source: string): string {
  return marked.parse(source, {
    async: false,
    breaks: true,
    gfm: true,
    renderer: directorRenderer()
  }) as string
}

/** Plain visible text (markdown syntax stripped). */
export function markdownPlainText(source: string): string {
  if (!source.trim()) return ''
  const html = toHtml(source)
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim()
}

export function markdownVisibleLength(source: string): number {
  return markdownPlainText(source).length
}

let purifyHooksReady = false

function ensurePurifyHooks() {
  if (purifyHooksReady) return
  purifyHooksReady = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (!node || typeof node !== 'object' || !('tagName' in node) || node.tagName !== 'A') return
    const el = node as {
      getAttribute: (name: string) => string | null
      setAttribute: (name: string, value: string) => void
      removeAttribute: (name: string) => void
    }
    const href = el.getAttribute('href')
    if (!href || !/^https?:/i.test(href)) {
      el.removeAttribute('href')
      return
    }
    el.setAttribute('target', '_blank')
    el.setAttribute('rel', 'noopener noreferrer nofollow')
  })
}

/** Sanitize markdown to safe HTML for Game Director cards. */
export function renderDirectorMarkdown(source: string): string {
  if (!source.trim()) return ''
  ensurePurifyHooks()
  const dirty = toHtml(source)
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ADD_ATTR: ['target', 'rel']
  })
}
