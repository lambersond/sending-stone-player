/**
 * From how wide the index shows a campaign beside its list, in CSS pixels: the width of the index
 * itself, as its CSS's `@min-[900px]/index` reads it, so the script and the CSS agree.
 */
export const INDEX_WIDE = 900

// The index's boxes, which its skeleton draws too while the campaigns are read (v0.48.0), so that
// the skeleton's head, list and campaign sit where the index's will.

/** The index: its head, then its list and a campaign, 20 px apart, a container for its widths. */
export const INDEX_ROOT = '@container/index flex min-w-0 flex-col gap-5'

/** The list and a campaign: one above the other, side by side from 900 px of the index. */
export const INDEX_GRID =
  'grid min-w-0 gap-4 @min-[900px]/index:grid-cols-[340px_minmax(0,1fr)] @min-[900px]/index:items-start'

/** The list: its campaigns' rows, 8 px apart. Its display is its own, as it's shown or not. */
export const INDEX_LIST = 'min-w-0 flex-col gap-2'

/** A campaign's page, under All campaigns on a phone. Its display is its own too. */
export const INDEX_CAMPAIGN = 'min-w-0 flex-col gap-4'

/** Shown only beside the other, from 900 px of the index: the list or a campaign's page. */
export const INDEX_BESIDE = 'hidden @min-[900px]/index:flex'
