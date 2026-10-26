import { seatWords, type SeatRole } from '@/utils/seat-words'
import type { EffectOp } from '@/constants/sending-stone'

// How one of the character's own effects turned off, on or deleted (module 0.39.0) is told, in
// English: on its controls, in the tray and its toasts, and why it wasn't made, where that differs
// from a roll's.

/** What each change is called: its button, its line on its way, done, not made, and in short. */
export const EFFECT_WORDS: Record<
  EffectOp,
  { button: string; named: string; doing: string; done: string; short: string }
> = {
  disable: {
    button: 'Turn off',
    named: 'Turn off',
    doing: 'Turning it off',
    done: 'Turned off',
    short: 'turned off',
  },
  enable: {
    button: 'Turn on',
    named: 'Turn on',
    doing: 'Turning it on',
    done: 'Turned on',
    short: 'turned on',
  },
  delete: {
    button: 'Delete…',
    named: 'Delete',
    doing: 'Deleting it',
    done: 'Deleted',
    short: 'deleted',
  },
}

/** A control's name, with the effect it changes: "Turn off Bless", "Delete Bless". */
export function effectControlName(op: EffectOp, effect: string): string {
  return `${EFFECT_WORDS[op].named} ${effect}`
}

/**
 * Why one of the character's own effects wasn't turned off, on or deleted, as the seat reads it,
 * where it differs from a roll's (module 0.39.0).
 */
export function effectReasons(role: SeatRole): Record<string, string> {
  const { game } = seatWords(role)
  return {
    off: `${game} isn’t taking changes to effects now`,
    unavailable: `${game} isn’t taking changes to effects now`,
    effect: 'that effect can’t be changed from here',
    moving: 'it’s on its way already',
  }
}
