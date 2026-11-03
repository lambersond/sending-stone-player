import { createElement, Fragment, type ReactNode } from 'react'
import {
  linkClassOf,
  linkOf,
  type DescriptionLink,
} from '@/utils/description-links'

/*
 * A description as the page draws it: built as React elements from the HTML the server kept, never
 * set as HTML. Only the tags and attributes the server keeps are drawn (see `lib/sheet-html`), each
 * checked again, so that what the server let through by mistake is drawn as text, or not at all.
 * The links the game acts on are drawn as the caller says, from what they mean and their text
 * alone, never what's inside them, so that no button is ever inside another, or inside a link.
 */

/** A link in a description the page acts on, as it's found there. */
export type LinkPart = {
  link: DescriptionLink
  /** What it says, as text alone. */
  label: string
  /**
   * Whether it's in one of the description's secrets, which only the Gamemaster and the
   * character's owners read.
   */
  secret: boolean
  /** Its key among the description's elements. */
  key: string
}

/** Draws a link the page acts on; plain text where it does nothing here. */
export type DrawLink = (part: LinkPart) => ReactNode

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

/** Where in a description the walk is. */
type Place = {
  key: string
  /** Inside a link, or a link the game acts on, whose own links are only text. */
  inLink: boolean
  /** Inside one of its secrets. */
  secret: boolean
}

/**
 * A description's HTML, read as the browser reads it, without running or loading anything: none
 * where there's no browser to read it, as when the page is drawn on the server.
 * @param html - A description, as the server kept it.
 * @returns Its body.
 */
export function readDescription(html: string): HTMLElement | undefined {
  if (typeof DOMParser === 'undefined') return undefined
  return new DOMParser().parseFromString(html, 'text/html').body
}

/**
 * A description as React elements: its formatting, tables, images and links, and the links the
 * game acts on, drawn by `drawLink`. Each of those is the first in the description with its
 * number, outside any other link; any other is only its text.
 * @param body - The description, as `readDescription` read it.
 * @param drawLink - Draws a link the game acts on; with none, each is only its text.
 */
export function drawDescription(
  body: HTMLElement,
  drawLink?: DrawLink,
): ReactNode[] {
  const numbers = new Set<number>()

  const children = (element: Element, place: Place): ReactNode[] => {
    const nodes = [...element.childNodes]
    const kept = NO_TEXT.has(element.localName)
      ? nodes.filter(node => node.nodeType === Node.ELEMENT_NODE)
      : nodes
    return kept.map((node, index) =>
      draw(node, { ...place, key: `${place.key}.${index}` }),
    )
  }

  const draw = (node: ChildNode, place: Place): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as Element
    const tag = element.localName
    const { key } = place
    if (LEFT_OUT.has(tag)) return
    if (!TAGS.has(tag)) {
      return <Fragment key={key}>{children(element, place)}</Fragment>
    }
    const classes = new Set(
      (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean),
    )
    if (tag === 'span' && linkClassOf(element.getAttribute('class') ?? '')) {
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
        ...children(element, { ...place, inLink: true }),
      )
    }
    const props: Record<string, unknown> = { key }
    let inside = place
    switch (tag) {
      case 'a': {
        const href = checked(element.getAttribute('href'), [
          'http:',
          'https:',
          'mailto:',
        ])
        inside = { ...place, inLink: true }
        // Without an address it can open, it's only its text, as the server makes it.
        if (!href)
          return createElement('span', props, ...children(element, inside))
        Object.assign(props, {
          href,
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        })
        break
      }
      case 'img': {
        const src = checked(element.getAttribute('src'), ['http:', 'https:'])
        if (!src) return
        props.src = src
        props.alt = element.getAttribute('alt') ?? ''
        for (const side of ['width', 'height']) {
          const size = element.getAttribute(side)
          if (size && /^\d{1,5}$/.test(size)) props[side] = Number(size)
        }
        break
      }
      case 'span': {
        // A reference stays bold; a roll the page can't act on is only its text.
        if (classes.has('ref')) props.className = 'ref'
        break
      }
      case 'section': {
        if (classes.has('secret')) {
          props.className = 'secret'
          inside = { ...place, secret: true }
        }
        break
      }
      case 'td':
      case 'th': {
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
        if (tag === 'th' && scope && SCOPES.has(scope)) props.scope = scope
        break
      }
    }
    if (VOID.has(tag)) return createElement(tag, props)
    return createElement(tag, props, ...children(element, inside))
  }

  return children(body, { key: 'd', inLink: false, secret: false })
}

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
