/**
 * How long to wait before asking again: every `every` milliseconds, twice as long for each attempt
 * in a row that failed, but never longer than `most`.
 */
export function retryDelay(every: number, failures: number, most: number) {
  return failures ? Math.min(every * 2 ** failures, most) : every
}
