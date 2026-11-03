import {
  BRIDGE_POLLED_WITHIN,
  ROLL_KINDS,
  ROLL_FEATURES,
} from '@/constants/sending-stone'
import type { RollKind, RollFeature } from '@/types/roll'

/**
 * The rolls a campaign's players can have made in its game now: none unless its Gamemaster lets
 * them, and the Gamemaster's module is fetching them.
 */
export function availableRollKinds(
  campaign: {
    rollsEnabled: boolean
    rollKinds: string[]
    bridgePolledAt: Date | null
  },
  now = Date.now(),
): RollKind[] {
  const polled = campaign.bridgePolledAt?.getTime()
  if (!campaign.rollsEnabled || !polled || now - polled >= BRIDGE_POLLED_WITHIN)
    return []
  return ROLL_KINDS.filter(kind => campaign.rollKinds.includes(kind))
}

/**
 * What else a campaign's game does with its players' rolls now, such as take damage they changed:
 * nothing while it takes none.
 */
export function availableRollFeatures(
  campaign: Parameters<typeof availableRollKinds>[0] & {
    rollFeatures: string[]
  },
  now = Date.now(),
): RollFeature[] {
  if (availableRollKinds(campaign, now).length === 0) return []
  return ROLL_FEATURES.filter(feature =>
    campaign.rollFeatures.includes(feature),
  )
}

/**
 * What says which rolls a game takes, and what else it does with them, as a viewer last saw it:
 * such as "skill,save,damage;modifiers".
 */
export function rollsKey(
  kinds: readonly string[] = [],
  features: readonly string[] = [],
): string {
  return features.length > 0
    ? `${kinds.join(',')};${features.join(',')}`
    : kinds.join(',')
}
