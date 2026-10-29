import { seatWords, type SeatRole } from '@/utils/seat-words'
import type { PrepareOp } from '@/constants/sending-stone'

// How a spell prepared or unprepared (module 0.42.1) is told, in English: its menu entry, its line
// on its way, made, refused, and in short, and why it wasn't made where that differs from a roll's.

/**
 * What each is called: its menu entry, as dnd5e's own sheet names it, its line on its way, made,
 * not made, and in short. Not made is "Couldn’t prepare it", never "Not prepared", which the row
 * already says of the spell itself.
 */
export const PREPARE_WORDS: Record<
  PrepareOp,
  { menu: string; doing: string; done: string; not: string; short: string }
> = {
  prepare: {
    menu: 'Prepare',
    doing: 'Preparing it',
    done: 'Prepared',
    not: 'Couldn’t prepare it',
    short: 'prepared',
  },
  unprepare: {
    menu: 'Unprepare',
    doing: 'Unpreparing it',
    done: 'Unprepared',
    not: 'Couldn’t unprepare it',
    short: 'unprepared',
  },
}

/**
 * Why a spell wasn't prepared or unprepared, as the seat reads it, where it differs from a roll's
 * (module 0.42.1): the game doesn't take it, as where its Gamemaster doesn't let players attack and
 * cast from here, or the spell isn't one the character prepares, such as one always prepared.
 */
export function prepareReasons(role: SeatRole): Record<string, string> {
  const { game } = seatWords(role)
  const off = `${game} isn’t taking changes to prepared spells now`
  return {
    off,
    unavailable: off,
    'attacks-off': off,
    prepare: 'that spell can’t be prepared or unprepared from here',
  }
}
