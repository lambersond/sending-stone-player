/*
 * A wait the game sets counted down, by this page's clock: what Midi-QOL asks in the prompt
 * banner, and the dice the game asks for in the dice ask banner and the dice dialog.
 */

/** The whole seconds from one moment until another, none once it's come. */
export function secondsLeft(at: number, now: number): number {
  return Math.max(0, Math.ceil((at - now) / 1000))
}

/** Such as "0:42". */
export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
