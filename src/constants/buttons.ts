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

/**
 * The character page's own header buttons, such as Full screen and Help: 32 px square on a phone,
 * from the glyph and its padding, and 44 from `sm`.
 */
export const TABLE_HEADER_BUTTON = `${ICON_TARGET} rounded-lg p-2 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary`

/**
 * A chip in a side panel's row of places to go to, such as the Conditions reference's conditions
 * and Help's sections: its shape. Its colours are the caller's, `GO_TO_CHIP_PLAIN` where nothing
 * marks it out.
 */
export const GO_TO_CHIP =
  'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors'

export const GO_TO_CHIP_PLAIN =
  'border-border hover:border-primary hover:bg-primary/5'

/**
 * A stepper's − or + beside its count, such as Modify damage's dice or a transfer's amount: 40 px
 * square on a phone, 44 from `sm`. Dimmed when it can't step, by `disabled` or `aria-disabled`.
 */
export const STEP_BUTTON =
  'flex size-10 shrink-0 items-center justify-center rounded-xl border border-border transition-colors hover:border-primary/50 hover:bg-primary/5 sm:size-11 disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:bg-transparent'
