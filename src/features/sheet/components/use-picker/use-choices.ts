import { useState } from 'react'
import {
  choicesOf,
  defaultSlot,
  optionsOf,
  picked,
  selfTarget,
  whomOf,
} from './utils'
import { enchantOf, offeredProfiles } from '@/features/sheet/utils/enchantments'
import { castAtLevel, castOf } from '@/utils/casts'
import { friendly, selfDefault } from '@/utils/uses'
import type { Picked, Picking, Targeting } from './types'
import type { CastIndex, SheetSpellSection } from '@/types/sending-stone'
import type { TableCombat, TableCombatant } from '@/types/table'

/**
 * An attack's or a use's choices as they're made: the slot, or the level, the ammunition and the
 * attack mode, each preset as the game would have it; for one that enchants, the way it enchants,
 * of those offered at the level chosen; and whom at, as `whomOf` has it, picked by its `targeting`:
 * those ticked, a use made at its user by default with them ticked already, as Self, and what the
 * targets are searched by.
 */
export function useChoices({
  picking,
  combat,
  spellbook,
  casts,
  last,
  areas,
  selfTargets,
  onPick,
}: {
  picking: Exclude<Picking, { kind: 'alone' }>
  combat?: TableCombat
  spellbook: SheetSpellSection[]
  casts: CastIndex
  last?: string
  areas: boolean
  selfTargets: boolean
  onPick: (picked: Picked) => void
}) {
  const { action } = picking
  const { pools, levels, ammunition, modes } = choicesOf(
    picking,
    spellbook,
    casts,
  )
  // A spell an item casts is cast at the level it's cast at by default, unless chosen otherwise.
  const cast = castOf(action, casts)
  const [slot, setSlot] = useState(defaultSlot(action, spellbook, casts))
  const [ammo, setAmmo] = useState(
    ammunition.find(({ quantity }) => quantity > 0)?.id,
  )
  const [mode, setMode] = useState(modes[0]?.value)
  // A use made at its user by default has them ticked already, as Self.
  const usable = picking.kind === 'use'
  const self = usable ? selfTarget(action, combat, selfTargets) : undefined
  const preset = self && selfDefault(action) ? self : undefined
  const [ticked, setTicked] = useState<string[]>(() =>
    preset ? [preset.id] : [],
  )
  // What the targets are searched by: kept here, as are those ticked, as a slot chosen may turn a
  // list to tap into one to tick.
  const [query, setQuery] = useState('')
  const search = { query, onQuery: setQuery }
  // A use that helps, or one made at its user by default, lists the player and their allies first.
  const helpful =
    usable &&
    !!action.activity &&
    (friendly(action.activity) || selfDefault(action))
  // One that enchants is cast with the slot it's cast with, or at the level, even where there's no
  // choice of it, as the ways it may enchant may hang on it.
  const enchant =
    picking.kind === 'use' ? enchantOf(action.activity) : undefined
  const options = optionsOf(
    { pools, levels, ammunition, modes },
    { slot, ammo, mode, enchanting: !!enchant },
  )
  const pick = (targets: TableCombatant[]) =>
    onPick({ ...picked(targets), ...options })
  // An activity used without spending a slot, such as Spirit Guardians' save each turn, is used at
  // the level chosen, whether any slot is left or not.
  const spends = action.consumesSlot !== false

  // Those ticked, as many as a use or an area attack takes at the slot chosen, or the level, as
  // the game takes them: no more than it's sent. A spell an item casts takes more for each level
  // above the one it's cast at by default.
  const castAt = castAtLevel(action, spellbook, slot, casts)
  const base = cast?.level ?? action.level
  // The ways it may enchant at the level chosen; and a level it may enchant no way at isn't one.
  const offered = enchant ? offeredProfiles(enchant, castAt) : []
  const [chosen, setChosen] = useState<string>()
  const profile = offered.find(({ id }) => id === chosen) ?? offered[0]
  const enchantsAt = (level: number | null) =>
    !enchant || offeredProfiles(enchant, level).length > 0
  // Whom at.
  const whom = whomOf({
    picking,
    combat,
    last,
    areas,
    enchant,
    selfTargets,
    preset,
    helpful,
    base,
    castAt,
  })
  const targeting: Targeting = { search, ticked, setTicked, pick }
  return {
    pools,
    levels,
    ammunition,
    modes,
    slot,
    setSlot,
    ammo,
    setAmmo,
    mode,
    setMode,
    enchant,
    options,
    spends,
    offered,
    profile,
    setChosen,
    enchantsAt,
    whom,
    targeting,
  }
}
