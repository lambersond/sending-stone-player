import { seatWords, type SeatRole } from '@/utils/seat-words'

// How a favorite added or removed (module 0.37.0) is told, in English, where it differs from a
// roll: why it wasn't made. Where it stands on its way, and that it was, the tray says itself.

/**
 * Why a favorite wasn't added or removed, as the seat reads it, where it differs from a roll's
 * (module 0.37.0).
 */
export function favoriteReasons(role: SeatRole): Record<string, string> {
  const { game } = seatWords(role)
  return {
    off: `${game} isn’t taking favorites now`,
    unavailable: `${game} isn’t taking favorites now`,
    moving: 'it’s on its way already',
  }
}
