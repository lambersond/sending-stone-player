import {
  GM_SEND_KEY,
  SEND_CHOICES,
  SEND_KEY,
} from '@/features/rolling/constants'
import { useStoredChoice } from '@/hooks/use-stored'

/**
 * Send to the table, as this device keeps it: on until turned off, the Gamemaster's apart from
 * the player's. As every hook on the page reads it, so that turning it off stops them all.
 * @returns The choice, and a way to make another.
 */
export function useSendChoice(gm: boolean) {
  return useStoredChoice(gm ? GM_SEND_KEY : SEND_KEY, SEND_CHOICES, 'on')
}
