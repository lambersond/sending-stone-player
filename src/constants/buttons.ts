/**
 * An icon-only control (v0.44): its glyph centred, a 44 px square from `sm`, as a finger is wide on
 * a tablet; below `sm`, the caller's padding or size makes it. The glyph keeps its size: the box
 * grows, and the hover, pressed and open tints fill it.
 */
export const ICON_TARGET =
  'inline-flex shrink-0 items-center justify-center sm:size-11'

/**
 * The icon buttons in a header beside its title, such as a modal's or a side panel's Close, and a
 * party page's way back. A caller adds to it where it sits: a `-ml-1.5` or `-mr-1.5`, paired with
 * a `sm:-ml-3` or `sm:-mr-3`, so that its glyph stays on the header's padding line as it grows.
 */
export const HEADER_ICON_BUTTON = `${ICON_TARGET} rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary`
