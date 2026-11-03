import { type ReactNode } from 'react'
import type { DescriptionLink } from '@/types/sending-stone'

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
