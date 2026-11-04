import { createElement, Fragment, type ReactNode } from 'react'
import { linkClassOf, linkOf } from '@/utils/description-links'
import type { DrawLink, Place, TagDraw, Walk } from './types'

/*
 * A description as the page draws it: built as React elements from the HTML the server kept, never
 * set as HTML. Only the tags and attributes the server keeps are drawn (see `lib/sheet-html`), each
 * checked again, so that what the server let through by mistake is drawn as text, or not at all.
 * The links the game acts on are drawn as the caller says, from what they mean and their text
 * alone, never what's inside them, so that no button is ever inside another, or inside a link.
 */

/**
 * A description as React elements, as `drawDescription` draws it: its formatting, tables, images
 * and links, and the links the game acts on, drawn by `drawLink`. Each of those is the first in the
 * description with its number, outside any other link; any other is only its text.
 * @param body - The description, as `readDescription` read it.
 * @param drawLink - Draws a link the game acts on; with none, each is only its text.
 */
export function DescriptionHtml({
  body,
  drawLink,
}: Readonly<{ body: HTMLElement; drawLink?: DrawLink }>) {
  return childrenOf(
    body,
    { key: 'd', inLink: false, secret: false },
    { numbers: new Set<number>(), drawLink },
  )
}

/** An element's children, drawn: a table's parts' elements alone, never the text between them. */
function childrenOf(element: Element, place: Place, walk: Walk): ReactNode[] {
  const nodes = [...element.childNodes]
  const kept = NO_TEXT.has(element.localName)
    ? nodes.filter(node => node.nodeType === Node.ELEMENT_NODE)
    : nodes
  return kept.map((node, index) =>
    draw(node, { ...place, key: `${place.key}.${index}` }, walk),
  )
}

/**
 * A node of a description, drawn: text as it is; a tag the page draws as `TAG_DRAWS` says, or as
 * itself; a link the game acts on as `drawLinkSpan` has it; any other tag as what's inside it, but
 * those whose content isn't text to read, left out with it.
 */
function draw(node: ChildNode, place: Place, walk: Walk): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const element = node as Element
  const tag = element.localName
  const { key } = place
  if (LEFT_OUT.has(tag)) return
  if (!TAGS.has(tag)) {
    return <Fragment key={key}>{childrenOf(element, place, walk)}</Fragment>
  }
  const classes = new Set(
    (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean),
  )
  if (tag === 'span' && linkClassOf(element.getAttribute('class') ?? '')) {
    return drawLinkSpan(element, place, classes, walk)
  }
  const how = TAG_DRAWS[tag]
  const drawn = how ? how(element, place, classes) : { props: {} }
  // A tag drawn by nothing it can show, such as an image with no address it can load.
  if (!drawn) return
  const props = { key, ...drawn.props }
  if (VOID.has(tag)) return createElement(tag, props)
  return createElement(
    drawn.tag ?? tag,
    props,
    ...childrenOf(element, drawn.inside ?? place, walk),
  )
}

/**
 * A link the game acts on, drawn by `drawLink` where it's the first with its number, outside any
 * other link; else only its text, a reference as bold as any other.
 */
function drawLinkSpan(
  element: Element,
  place: Place,
  classes: Set<string>,
  { numbers, drawLink }: Walk,
): ReactNode {
  const { key } = place
  const link = place.inLink ? undefined : linkOf(attributesOf(element))
  const first = link && (link.kind === 'condition' || !numbers.has(link.n))
  if (link && first && drawLink) {
    if (link.kind !== 'condition') numbers.add(link.n)
    return (
      <Fragment key={key}>
        {drawLink({
          link,
          label: element.textContent ?? '',
          secret: place.secret,
          key,
        })}
      </Fragment>
    )
  }
  // A link that does nothing here is its text, a reference as bold as any other.
  return createElement(
    'span',
    { key, ...(classes.has('ref') && { className: 'ref' }) },
    ...childrenOf(element, { ...place, inLink: true }, { numbers, drawLink }),
  )
}

/**
 * How the tags drawn with attributes of their own are drawn: a link by an address it can open, in
 * a new tab, or else as only its text; an image by an address it can load, with its size, or not
 * at all; a reference, bold; a secret, as one; and a table's cell with the rows or columns it
 * spans, and a heading cell with what it heads.
 */
const TAG_DRAWS: Partial<
  Record<
    string,
    (element: Element, place: Place, classes: Set<string>) => TagDraw
  >
> = {
  a: (element, place) => {
    const href = checked(element.getAttribute('href'), [
      'http:',
      'https:',
      'mailto:',
    ])
    const inside = { ...place, inLink: true }
    // Without an address it can open, it's only its text, as the server makes it.
    if (!href) return { tag: 'span', props: {}, inside }
    return {
      props: { href, target: '_blank', rel: 'noopener noreferrer nofollow' },
      inside,
    }
  },
  img: element => {
    const src = checked(element.getAttribute('src'), ['http:', 'https:'])
    if (!src) return
    const props: Record<string, unknown> = {
      src,
      alt: element.getAttribute('alt') ?? '',
    }
    for (const side of ['width', 'height']) {
      const size = element.getAttribute(side)
      if (size && /^\d{1,5}$/.test(size)) props[side] = Number(size)
    }
    return { props }
  },
  // A reference stays bold; a roll the page can't act on is only its text.
  span: (_element, _place, classes) => ({
    props: classes.has('ref') ? { className: 'ref' } : {},
  }),
  section: (_element, place, classes) =>
    classes.has('secret')
      ? { props: { className: 'secret' }, inside: { ...place, secret: true } }
      : { props: {} },
  td: element => ({ props: cellProps(element, false) }),
  th: element => ({ props: cellProps(element, true) }),
}

/**
 * A table's cell's props: the rows or columns it spans, up to the most; and a heading cell's
 * scope, one of the ways it may head its cells.
 */
function cellProps(
  element: Element,
  heading: boolean,
): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [attribute, prop] of [
    ['colspan', 'colSpan'],
    ['rowspan', 'rowSpan'],
  ] as const) {
    const span = Number(element.getAttribute(attribute))
    if (Number.isInteger(span) && span > 1 && span <= MOST_SPANNED) {
      props[prop] = span
    }
  }
  const scope = element.getAttribute('scope')
  if (heading && scope && SCOPES.has(scope)) props.scope = scope
  return props
}

/** The tags drawn, as the server keeps them. */
const TAGS = new Set([
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
])

/** Tags that have no content, which React won't give children. */
const VOID = new Set(['br', 'hr', 'img'])

/** A table's parts, which hold rows and cells, never text; not even the spaces between them. */
const NO_TEXT = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr'])

/**
 * Tags whose content isn't text to read, which are left out with it, as the server leaves them out.
 * Any other tag not drawn is left out, but not its content.
 */
const LEFT_OUT = new Set([
  'script',
  'style',
  'template',
  'textarea',
  'option',
  'select',
  'noscript',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'title',
])

/** The ways a table's heading cell may head its cells. */
const SCOPES = new Set(['row', 'col', 'rowgroup', 'colgroup'])

/** The most rows or columns a table's cell may span. */
const MOST_SPANNED = 1000

/** An element's attributes, by name. */
function attributesOf(element: Element): Record<string, string> {
  return Object.fromEntries(
    [...element.attributes].map(({ name, value }) => [name, value]),
  )
}

/** An address, if it's a whole one by one of these protocols, as the server made it. */
function checked(
  value: string | null,
  protocols: string[],
): string | undefined {
  if (!value) return
  try {
    const url = new URL(value)
    if (protocols.includes(url.protocol)) return url.href
  } catch {
    // Not a whole address.
  }
}
