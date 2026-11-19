import { COMMANDS_QUIET_WAIT } from '@/constants/sending-stone'

// The rules of the module's quiet fetches while nobody is in the app, from module 0.50.0, beside
// the one route that answers them. A file here other than route.ts is never a route.

/**
 * Is a fetch a quiet look that may be answered at once, after the campaign's lookup alone: one
 * the module says is a look, while nobody is in the app?
 * @param quiet - The fetch's `quiet`: true for a look, false for a full fetch, none from a module
 * before 0.50.0.
 * @param present - Is someone in the app, a page of the campaign's having asked for a table, a
 * party sheet, a companion or a player's notes lately?
 * @returns Whether to answer it as a look.
 */
export function isQuietLook(
  quiet: boolean | undefined,
  present: boolean,
): boolean {
  return quiet === true && !present
}

/**
 * How long the module may wait before its next fetch, a quiet look, in answer to a fetch while
 * nobody is in the app: only to a module that says `quiet`, and only where nothing was handed
 * over, as whoever sent it may send more.
 * @param quiet - The fetch's `quiet`, none from a module before 0.50.0.
 * @param handed - How many commands the answer hands over.
 * @returns The quiet wait in milliseconds, or none.
 */
export function quietWaitFor(
  quiet: boolean | undefined,
  handed: number,
): number | undefined {
  return quiet !== undefined && handed === 0 ? COMMANDS_QUIET_WAIT : undefined
}
