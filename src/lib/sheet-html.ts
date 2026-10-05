import sanitizeHtml from 'sanitize-html'

/**
 * A description from Foundry, made safe to show on a sheet. Foundry enriches it before sending:
 * links to its documents and rolls arrive as its own markup, which only works inside Foundry. They
 * become plain spans here: `ref` for a link to a document, and `roll` for a roll, keeping its
 * formula. Everything else is formatting, tables, images and links, with images and links pointing
 * at the game, as Foundry's relative paths do.
 * @param html - The description as the module sent it. Untrusted.
 * @param origin - The game's address, which relative paths are relative to.
 * @returns Safe HTML.
 */
export function sanitizeSheetHtml(html: string, origin: string): string {
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
      span: ['class', 'data-formula'],
      section: ['class'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope'],
    },
    allowedClasses: { span: ['ref', 'roll'], section: ['secret'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_, attribs) => linkOrSpan(attribs, origin),
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
