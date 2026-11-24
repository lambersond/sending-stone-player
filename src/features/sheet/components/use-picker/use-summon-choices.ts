import { useState } from 'react'
import { summonChoiceOf } from './utils'
import {
  labelAt,
  offeredSummons,
  summonAria,
  summonLabels,
} from '@/features/sheet/utils/summons'
import type { ProfileOption } from './types'
import type { SheetSummon } from '@/types/sending-stone'

/**
 * A summoning's choices as they're made, from module 0.54.0: the creatures it offers at the level
 * chosen, as chips labelled as dnd5e's dialog labels them there, each told a screen reader without
 * the "×"; the creature chosen, the first offered by default, as dnd5e presets it; and the type and
 * size, where it offers a choice, the first by default. What's chosen goes to the game as `choice`,
 * none where it offers no creature at that level.
 */
export function useSummonChoices(
  summon: SheetSummon | undefined,
  level: number | null,
) {
  const offered = summon ? offeredSummons(summon, level) : []
  const labels = summonLabels(offered, level)
  const options: ProfileOption[] = offered.map((profile, index) => ({
    id: profile.id,
    name: labels[index],
    label: summonAria(labelAt(profile, level)),
  }))
  const [chosen, setCreature] = useState<string>()
  const [type, setType] = useState<string>()
  const [size, setSize] = useState<string>()
  const creature = offered.find(({ id }) => id === chosen) ?? offered[0]
  const choice =
    summon && creature
      ? summonChoiceOf(summon, creature.id, { type, size })
      : undefined
  return {
    summon,
    options,
    choice,
    setCreature,
    setType,
    setSize,
  }
}
