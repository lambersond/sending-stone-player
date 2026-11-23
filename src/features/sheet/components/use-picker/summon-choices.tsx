'use client'

import { Chip } from './chip'
import { ChipRow } from './chip-row'
import { ProfileChoice } from './profile-choice'
import type { useSummonChoices } from './use-summon-choices'

/**
 * A summoning's choices, from module 0.54.0: the creature, among those it offers at the level
 * chosen, where it offers more than one, or says it can't summon anything there; and the creature
 * type and size, each a row of chips, where it offers a choice of them, as dnd5e's dialog asks.
 */
export function SummonChoices({
  summoning: { summon, options, choice, setCreature, setType, setSize },
}: Readonly<{ summoning: ReturnType<typeof useSummonChoices> }>) {
  if (!summon) return null
  const rows = [
    { label: 'Type', options: summon.types, chosen: choice?.type, on: setType },
    { label: 'Size', options: summon.sizes, chosen: choice?.size, on: setSize },
  ].filter(row => row.options.length > 0)
  return (
    <>
      {(summon.profiles.length > 1 || options.length === 0) && (
        <ProfileChoice
          label='Creature'
          empty='It can’t summon anything at this level.'
          profiles={options}
          chosen={choice?.profile}
          onChoose={setCreature}
        />
      )}
      {rows.map(row => (
        <ChipRow key={row.label} label={row.label}>
          {row.options.map(({ key, label }) => (
            <Chip
              key={key}
              selected={key === row.chosen}
              onSelect={() => row.on(key)}
              label={label}
            >
              {label}
            </Chip>
          ))}
        </ChipRow>
      ))}
    </>
  )
}
