import { BRIDGE_POLLED_WITHIN } from '@/constants/sending-stone'
import type { RollKindInfo } from '@/types/roll'

/**
 * Whether a campaign takes what one of its own switches gates now, apart from the rolls: its module
 * says the campaign lets them, and is fetching. A move (module 0.31.0), a removal (0.33.0), a
 * favorite (0.37.0), an effect changed (0.39.0) and Wild Shape (0.40.0) each have one.
 * @param field - The switch, as the campaign keeps it, such as `effectsEnabled`.
 */
export function switchOn(
  campaign: Partial<Record<NonNullable<RollKindInfo['own']>, boolean>> & {
    bridgePolledAt: Date | null
  },
  field: NonNullable<RollKindInfo['own']>,
  now = Date.now(),
): boolean {
  const polled = campaign.bridgePolledAt?.getTime()
  return (
    campaign[field] === true && !!polled && now - polled < BRIDGE_POLLED_WITHIN
  )
}
