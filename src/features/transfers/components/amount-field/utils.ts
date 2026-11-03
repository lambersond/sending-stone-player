/** The number typed, if it's one, of digits alone; whatever its size. */
export function typedCount(text: string): number | undefined {
  return DIGITS.test(text) ? Number(text) : undefined
}

/** How many are to move, as typed, if it's a whole number from 1 to as many as there are. */
export function amountOf(text: string, max: number): number | undefined {
  const count = typedCount(text)
  return count !== undefined && count >= 1 && count <= max ? count : undefined
}

/** A count as typed: digits, and nothing else. */
const DIGITS = /^[0-9]+$/
