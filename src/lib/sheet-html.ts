import sanitizeHtml from 'sanitize-html'
import {
  LINK_ATTRIBUTES,
  LINK_CLASSES,
  linkAttributes,
  linkClassOf,
  linkOf,
  type FoundLink,
} from '@/utils/description-links'

/** Every data attribute a link the game acts on may keep. */
const LINK_ATTRIBUTE_NAMES = [
  ...new Set(
    Object.values(LINK_ATTRIBUTES).flatMap(attributes =>
      Object.keys(attributes),
    ),
  ),
]

/**
 * A description from Foundry, made safe to show on a sheet. Foundry enriches it before sending:
 * links to its documents and rolls arrive as its own markup, which only works inside Foundry. They
 * become plain spans here: `ref` for a link to a document, and `roll` for a roll, keeping its
 * formula. The links the module marks for the app to act on, from 0.17.0, keep what they mean, as
 * far as it holds up (see `utils/description-links`): one that doesn't, or that sits inside another
 * link, or repeats another's number, is only its text, with its `roll` or `ref` look. Everything
 * else is formatting, tables, images and links, with images and links pointing at the game, as
 * Foundry's relative paths do.
 * @param html - The description as the module sent it. Untrusted.
 * @param origin - The game's address, which relative paths are relative to.
 * @returns Safe HTML.
 */
export function sanitizeSheetHtml(html: string, origin: string): string {
  const walk = linkWalk()
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'hr',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'sub',
      'sup',
      'small',
      'blockquote',
      'ul',
      'ol',
      'li',
      'dl',
      'dt',
      'dd',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'table',
      'caption',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'a',
      'img',
      'span',
      'div',
      'section',
      'figure',
      'figcaption',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      span: ['class', 'data-formula', ...LINK_ATTRIBUTE_NAMES],
      section: ['class'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope'],
    },
    allowedClasses: {
      span: ['ref', 'roll', ...LINK_CLASSES],
      section: ['secret'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    // Seen before any tag is changed, so a link's place is known from what the source says.
    onOpenTag: walk.open,
    onCloseTag: walk.close,
    transformTags: {
      a: (_, attribs) => linkOrSpan(attribs, origin),
      span: (_, attribs) => ({ tagName: 'span', attribs: walk.span(attribs) }),
      img: (_, attribs) => ({
        tagName: 'img',
        attribs: {
          ...pick(attribs, ['alt', 'width', 'height']),
          src: gameUrl(attribs.src, origin) ?? '',
        },
      }),
    },
    exclusiveFilter: frame =>
      // Font Awesome icons, which Foundry puts in its links and rolls, and images with nowhere
      // to load from.
      (frame.tag === 'i' && /\bfa-/.test(frame.attribs.class ?? '')) ||
      (frame.tag === 'img' && !frame.attribs.src),
  })
}

/**
 * The links the game acts on in a description held for a sheet, by their numbers, each with
 * whether it's in a secret; read as it was kept, as the page reads it. The server has no
 * `DOMParser`, so the same parser that keeps them reads them.
 * @param html - A description as `sanitizeSheetHtml` kept it.
 */
export function sheetLinks(html: string): Map<number, FoundLink> {
  const walk = linkWalk()
  const found = new Map<number, FoundLink>()
  sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    onOpenTag: (name, attribs) => {
      walk.open(name, attribs)
      if (name !== 'span') return
      const link = walk.link(attribs)
      if (link && link.kind !== 'condition') {
        found.set(link.n, { link, secret: walk.secret() })
      }
    },
    onCloseTag: walk.close,
  })
  return found
}

/** Where the parser is in a description, for its links: in another link, or in a secret. */
type Place = { inLink: boolean; secret: boolean }

/**
 * Follow the parser through a description, to tell which of its spans are links the game acts on:
 * one marked as one, holding up, not inside another link or a Foundry link, where a tap couldn't
 * tell them apart, and not numbered as one before it, so each number names one link.
 */
function linkWalk() {
  const places: Place[] = []
  const numbers = new Set<number>()
  /** The link the span just opened is, if it is one, numbering it. */
  const link = (attribs: sanitizeHtml.Attributes) => {
    if (places.at(-2)?.inLink) return
    const found = linkOf(attribs)
    if (!found || found.kind === 'condition') return found
    if (numbers.has(found.n)) return
    numbers.add(found.n)
    return found
  }
  return {
    open: (name: string, attribs: sanitizeHtml.Attributes) => {
      const parent = places.at(-1)
      const marked = name === 'span' && !!linkClassOf(attribs.class)
      places.push({
        inLink: (parent?.inLink ?? false) || name === 'a' || marked,
        secret:
          (parent?.secret ?? false) ||
          (name === 'section' && classesOf(attribs.class).includes('secret')),
      })
    },
    close: () => {
      places.pop()
    },
    /** Whether the element just opened is in a secret. */
    secret: () => places.at(-1)?.secret ?? false,
    link,
    /**
     * A span's attributes as they're kept: a link's own, checked; and for any other span, or a
     * link that doesn't hold up, its class and formula as before, and never another's data.
     */
    span: (attribs: sanitizeHtml.Attributes): sanitizeHtml.Attributes => {
      const name = linkClassOf(attribs.class)
      if (!name) return pick(attribs, ['class', 'data-formula'])
      const look = classesOf(attribs.class).filter(
        each => each === 'roll' || each === 'ref',
      )
      const kept = link(attribs) && linkAttributes(name, attribs)
      if (kept) return { class: [name, ...look].join(' '), ...kept }
      return look.length > 0 ? { class: look.join(' ') } : {}
    },
  }
}

/** The classes in a class attribute. */
function classesOf(className: string | undefined): string[] {
  return (className ?? '').split(/\s+/).filter(Boolean)
}

/**
 * What a Foundry link becomes: a span for a link to one of its documents or a roll, which only
 * work inside Foundry, and otherwise a link that opens in a new tab.
 */
function linkOrSpan(
  attribs: sanitizeHtml.Attributes,
  origin: string,
): sanitizeHtml.Tag {
  const classes = new Set((attribs.class ?? '').split(/\s+/))
  if (classes.has('content-link')) {
    return { tagName: 'span', attribs: { class: 'ref' } }
  }
  if (['inline-roll', 'roll-link', 'roll-action'].some(c => classes.has(c))) {
    return {
      tagName: 'span',
      attribs: {
        class: 'roll',
        ...(attribs['data-formula'] && {
          'data-formula': attribs['data-formula'],
        }),
      },
    }
  }
  const href = gameUrl(attribs.href, origin)
  if (!href) return { tagName: 'span', attribs: {} }
  return {
    tagName: 'a',
    attribs: { href, target: '_blank', rel: 'noopener noreferrer nofollow' },
  }
}

/**
 * A path or address from the game, made absolute: Foundry stores its own files, such as
 * worlds/erebor/map.webp, relative to the game's address. Only web addresses and email links are
 * kept.
 */
function gameUrl(
  value: string | undefined,
  origin: string,
): string | undefined {
  if (!value) return
  try {
    const url = new URL(value, `${origin}/`)
    if (['http:', 'https:', 'mailto:'].includes(url.protocol)) return url.href
  } catch {
    // Not an address at all.
  }
}

function pick(attribs: sanitizeHtml.Attributes, names: string[]) {
  return Object.fromEntries(
    names.flatMap(name => (name in attribs ? [[name, attribs[name]]] : [])),
  )
}
