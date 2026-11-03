/**
 * What a command's result says first, after its id, where the game made it: done, for no reason,
 * with no error.
 */
export const DONE_HEAD = {
  status: 'done',
  reason: null,
  error: null,
} as const
