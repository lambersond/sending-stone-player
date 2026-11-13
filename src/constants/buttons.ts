/**
 * An icon-only control (v0.44): its glyph centred, a 44 px square from `sm`, as a finger is wide on
 * a tablet; below `sm`, the caller's padding or size makes it. The glyph keeps its size: the box
 * grows, and the hover, pressed and open tints fill it.
 */
export const ICON_TARGET =
  'inline-flex shrink-0 items-center justify-center sm:size-11'

/**
 * The room one of `HEADER_ICON_BUTTON`'s takes, with its 20 px glyph: 32 px square on a phone, 44
 * from `sm`. Its skeleton's too while the page is read (v0.48.0).
 */
export const HEADER_ICON_BOX = `${ICON_TARGET} p-1.5`

/**
 * The icon buttons in a header beside its title, such as a modal's or a side panel's Close, and a
 * party page's way back. A caller adds to it where it sits: a `-ml-1.5` or `-mr-1.5`, paired with
 * a `sm:-ml-3` or `sm:-mr-3`, so that its glyph stays on the header's padding line as it grows.
 */
export const HEADER_ICON_BUTTON = `${HEADER_ICON_BOX} rounded-lg text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary`

/**
 * An icon button 44 pixels square, its glyph centred: the journal's own controls, and a Reorder
 * row's arrows, the notes' and the favorites'. A caller adds to it what its button needs more, such
 * as how it looks while disabled.
 */
export const SQUARE_ICON_BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'

/**
 * The room one of the character page's own header buttons takes, with its 16 px glyph: 32 px
 * square on a phone, from the glyph and its padding, and 44 from `sm`. Its skeleton's too while the
 * page is read (v0.48.0).
 */
export const TABLE_HEADER_BOX = `${ICON_TARGET} p-2`

/** The character page's own header buttons, such as Full screen and Help (`TABLE_HEADER_BOX`). */
export const TABLE_HEADER_BUTTON = `${TABLE_HEADER_BOX} rounded-lg text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary`

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
