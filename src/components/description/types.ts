import type { DescriptionLink } from '@/types/sending-stone'
import type { ReactNode } from 'react'

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

/** Where in a description the walk is. */
export type Place = {
  key: string
  /** Inside a link, or a link the game acts on, whose own links are only text. */
  inLink: boolean
  /** Inside one of its secrets. */
  secret: boolean
}

/** What a walk through a description keeps: the links drawn so far, by number, and how to draw. */
export type Walk = {
  numbers: Set<number>
  drawLink?: DrawLink
}

/**
 * How a tag the page draws is drawn: the element, if not its own tag, its props from its own
 * attributes, and where in the description what's inside it is. None for one left out.
 */
export type TagDraw =
  { tag?: string; props: Record<string, unknown>; inside?: Place } | undefined
