/**
 * The stone's carved rune, as the app icon's design draws it in its 512 by 512 square: a dot, and
 * two arcs around it like a signal's bars. Drawn over the icon at any size, it lies on the rune.
 */
export const RUNE = {
  viewBox: '0 0 512 512',
  dot: { cx: 228.2, cy: 277.2, r: 12 },
  inner: 'M221.38 228.68 A49 49 0 0 1 276.93 282.32',
  outer: 'M219.00 189.68 A88 88 0 0 1 314.86 292.48',
  arcWidth: 14,
} as const
