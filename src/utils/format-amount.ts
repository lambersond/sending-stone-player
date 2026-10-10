/** The sizes an amount is shortened to, largest first, each with the letter that follows it. */
const SCALES: [size: number, suffix: string][] = [
  [1_000_000, 'M'],
  [1000, 'k'],
]

/**
 * A large amount, such as a character's coin, shortened to fit where it's shown: thousands as
 * "12.8k" and millions as "1.2M", to one decimal place, dropping a decimal of zero, as in "1k".
 * It's rounded down, towards zero, so that it never says there's more than there is: 1,999 is
 * "1.9k", never "2k". An amount under 1,000 needs no shortening, and has none: undefined.
 * @param value - The amount in full, such as 12877.
 */
export function compactAmount(value: number): string | undefined {
  if (!Number.isFinite(value)) return undefined
  const size = Math.abs(value)
  const scale = SCALES.find(([at]) => size >= at)
  if (!scale) return undefined
  const [at, suffix] = scale
  // In tenths of the scale, cut short, as 12,877 is 128 hundreds, or 12.8 thousand.
  const tenths = Math.trunc(value / (at / 10))
  return `${(tenths / 10).toLocaleString()}${suffix}`
}
