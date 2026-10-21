import sanitizeHtml from 'sanitize-html'
import { enrichNoteHtml, renderNoteMarkdown } from '@/lib/note-markdown'
import { gameUrl, SHEET_TAGS } from '@/lib/sheet-html'

// A journal note as the page draws it (round 0.34.0 §8.4): rendered from its Markdown here, or as
// Foundry's own editor wrote it, and made safe on the server before it's stored. The page draws it
// with no links the game acts on, under the entry's own h4, so a note's own headings sit two levels
// down: an H1 or H2 typed in Foundry never reads as a chapter or a note here.

/** Where a note's headings go: under the entry's h4, keeping their order. */
const DEMOTED: Record<string, string> = {
  h1: 'h5',
  h2: 'h5',
  h3: 'h5',
  h4: 'h6',
  h5: 'h6',
  h6: 'h6',
}

/**
 * A note's HTML made safe to show: sheet texts' tags and attributes (lib/sheet-html), with its
 * headings moved under the entry's h4 (h1-h3 drawn as h5, h4-h6 as h6), every class dropped but
 * section.secret, which is kept in a personal journal's note and removed with what it holds in a
 * party's. Links and images point at the game, as a description's do.
 */
export function sanitizeNoteHtml(
  html: string,
  origin: string,
  { secrets }: { secrets: boolean },
): string {
  return sanitizeHtml(withoutHidden(html, secrets), {
    allowedTags: SHEET_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      section: ['class'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope'],
    },
    allowedClasses: { section: secrets ? ['secret'] : [] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      ...Object.fromEntries(
        Object.entries(DEMOTED).map(([from, to]) => [
          from,
          (_: string, attribs: sanitizeHtml.Attributes) => ({
            tagName: to,
            attribs,
          }),
        ]),
      ),
      a: (_, attribs) => noteLink(attribs, origin),
      img: (_, attribs) => ({
        tagName: 'img',
        attribs: {
          ...pick(attribs, ['alt', 'width', 'height']),
          src: gameUrl(attribs.src, origin) ?? '',
        },
      }),
    },
    // An image with nowhere to load from, as a description's.
    exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src,
  })
}

/**
 * A note's HTML without what goes with all it holds: a party's secrets, and Font Awesome's icons,
 * which Foundry puts in its own links. Read first, apart, while every class is still there to say
 * which they are; what else it keeps, the pass after it checks.
 */
function withoutHidden(html: string, secrets: boolean): string {
  return sanitizeHtml(html, {
    allowedTags: SHEET_TAGS,
    allowedAttributes: false,
    exclusiveFilter: frame =>
      (!secrets &&
        frame.tag === 'section' &&
        classesOf(frame.attribs.class).includes('secret')) ||
      (frame.tag === 'i' && /\bfa-/.test(frame.attribs.class ?? '')),
  })
}

/** A note's Markdown, or Foundry's HTML, as drawn here. */
export function noteHtml(
  source: { format: 1 | 2; body: string },
  origin: string,
  secrets: boolean,
): string {
  const html =
    source.format === 2
      ? renderNoteMarkdown(source.body)
      : enrichNoteHtml(source.body)
  return sanitizeNoteHtml(html, origin, { secrets })
}

/**
 * A link in a note: one that opens the game's page or another site in a new tab, or its text alone
 * where it's one of Foundry's own, which only work inside Foundry, or leads nowhere.
 */
function noteLink(
  attribs: sanitizeHtml.Attributes,
  origin: string,
): sanitizeHtml.Tag {
  const classes = classesOf(attribs.class)
  const foundry = [
    'content-link',
    'inline-roll',
    'roll-link',
    'roll-action',
  ].some(name => classes.includes(name))
  const href = foundry ? undefined : gameUrl(attribs.href, origin)
  if (!href) return { tagName: 'span', attribs: {} }
  return {
    tagName: 'a',
    attribs: { href, target: '_blank', rel: 'noopener noreferrer nofollow' },
  }
}

/** The classes in a class attribute. */
function classesOf(className: string | undefined): string[] {
  return (className ?? '').split(/\s+/).filter(Boolean)
}

function pick(attribs: sanitizeHtml.Attributes, names: string[]) {
  return Object.fromEntries(
    names.flatMap(name => (name in attribs ? [[name, attribs[name]]] : [])),
  )
}
