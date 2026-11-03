import { createElement, type ReactNode } from 'react'
import { DescriptionHtml } from './description-html'
import type { DrawLink } from './types'

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
): ReactNode {
  return createElement(DescriptionHtml, { body, drawLink })
}
