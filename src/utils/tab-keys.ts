/*
 * The keys a row of tabs moves by, as WAI-ARIA's tabs pattern has them: the creature switcher's
 * above the sheet and the Combat tab's encounters (item 36) step the same way.
 */

/**
 * Where a key moves the chosen tab in a row of them: Right to the next and Left to the one before,
 * wrapping, Home to the first and End to the last; nowhere for any other key.
 * @param key - The key pressed, as `KeyboardEvent.key` names it.
 * @param at - The chosen tab's place in the row.
 * @param count - How many tabs the row has.
 * @returns The place of the tab to choose, or undefined where the key moves nothing.
 */
export function tabStep(
  key: string,
  at: number,
  count: number,
): number | undefined {
  switch (key) {
    case 'ArrowRight': {
      return (at + 1) % count
    }
    case 'ArrowLeft': {
      return (at - 1 + count) % count
    }
    case 'Home': {
      return 0
    }
    case 'End': {
      return count - 1
    }
    default: {
      return undefined
    }
  }
}
