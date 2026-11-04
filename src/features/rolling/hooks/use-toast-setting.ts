import { useCallback } from 'react'
import { TOAST_CHOICES, TOASTS_KEY } from '@/features/rolling/utils/roll-toasts'
import { useStoredChoice } from '@/hooks/use-stored'

/**
 * Whether the player's rolls pop up as toasts on this device, for every character, rather than
 * staying in a banner at the bottom of the sheet: toasts until they choose the banner, in the
 * sheet's settings. One or the other, never both.
 */
export function useToastSetting(): [boolean, (on: boolean) => void] {
  const [choice, choose] = useStoredChoice(TOASTS_KEY, TOAST_CHOICES, 'on')
  const turn = useCallback((on: boolean) => choose(on ? 'on' : 'off'), [choose])
  return [choice === 'on', turn]
}
