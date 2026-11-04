'use client'

import { BookOpen, CircleGauge, Dices, ListChecks, Package } from 'lucide-react'
import { joinParts } from '../../utils/join-parts'
import { ActionEntry } from '../action-entry/action-entry'
import { FALLBACKS } from '../action-entry/constants'
import { useCharging } from '../charging/use-charging'
import { EffectEntry } from '../effects-tab/effect-entry'
import { FeatureEntry } from '../features-tab/feature-entry'
import { HitDieIcon } from '../hit-dice/hit-die-icon'
import { HitDieUse } from '../hit-dice/hit-die-use'
import { hitDiceText } from '../hit-dice/utils'
import { ItemEntry } from '../inventory-tab/item-entry'
import { ModeChip } from '../mode-chip/mode-chip'
import { SheetEntry } from '../sheet-entry/sheet-entry'
import { SpellSlots } from '../spell-slots/spell-slots'
import { slotsLive } from '../spell-slots/utils'
import { SpellEntry } from '../spells-tab/spell-entry'
import { UsesButton } from '../uses-button/uses-button'
import { capitalize } from './utils'
import { RollButton } from '@/features/rolling/components/roll-button/roll-button'
import { PROFICIENCY } from '@/features/sheet/constants'
import { checkLabel, detailWords } from '@/features/sheet/utils/roll-labels'
import { rechargeWords } from '@/utils/creature-words'
import { resourceNote } from '@/utils/favorites'
import { formatModifier } from '@/utils/format-modifier'
import { spendable } from '@/utils/formulas'
import type { ActionRows } from '../action-entry/types'
import type { HitDieSpending } from '../hit-dice/types'
import type { RollActions } from '@/features/rolling/types'
import type { FavoriteTarget, RollSource } from '@/types/roll'
import type {
  SheetAbility,
  SheetClass,
  SheetSkill,
  SheetSlotsFavorite,
  FavoriteEntry,
} from '@/types/sending-stone'

/** What a kind of item is, for an item the sheet lists nowhere else. */
const ITEM_TYPES: Record<string, string> = {
  background: 'Background',
  class: 'Class',
  facility: 'Facility',
  race: 'Species',
  subclass: 'Subclass',
}

/**
 * A favorite, as the sheet shows it elsewhere. From module 0.37.0, its row's favorites entry is its
 * own, never the star's: Remove from favorites, as it's one; an activity's, the activity's, never
 * its item's; and none for a resource, the feature a resource stands for, a skill, a tool or spell
 * slots.
 */
export function FavoriteRow({
  entry,
  rows,
  abilities,
  spending,
}: Readonly<{
  entry: FavoriteEntry
  rows: ActionRows
  abilities: SheetAbility[]
  spending?: HitDieSpending
}>) {
  const { characterId } = rows
  const { target } = entry
  switch (entry.kind) {
    case 'action': {
      const { action, resource } = entry
      // One that stands for a resource shows the resource's uses, and its name where it's another.
      return (
        <ActionEntry
          action={action}
          rows={rows}
          note={joinParts(resourceNote(resource, action.name), entry.note)}
          look={resource && { uses: resource.uses }}
          favorite={target}
        />
      )
    }
    case 'spell': {
      return (
        <SpellEntry
          characterId={characterId}
          spell={entry.spell}
          rows={rows}
          favorite={target}
        />
      )
    }
    case 'item': {
      return (
        <ItemEntry
          characterId={characterId}
          item={entry.item}
          rows={rows}
          favorite={target}
        />
      )
    }
    case 'feature': {
      const { feature, resource } = entry
      return (
        <FeatureEntry
          characterId={characterId}
          feature={feature}
          rows={rows}
          favorite={target}
          {...(resource && {
            uses: resource.uses,
            note: resourceNote(resource, feature.name),
          })}
        />
      )
    }
    case 'class': {
      return (
        <ClassEntry
          characterId={characterId}
          entry={entry.entry}
          spending={spending}
          favorite={target}
        />
      )
    }
    case 'effect': {
      return (
        <EffectEntry
          characterId={characterId}
          effect={entry.effect}
          suppressed={entry.suppressed}
          favorite={target}
        />
      )
    }
    case 'check': {
      return (
        <CheckEntry
          check={entry.check}
          source={entry.source}
          ability={abilities.find(({ id }) => id === entry.check.ability)}
          d20={rows.d20}
        />
      )
    }
    case 'slots': {
      return (
        <SlotsEntry
          characterId={characterId}
          slots={entry.slots}
          favorite={target}
        />
      )
    }
    case 'resource': {
      const { resource } = entry
      return (
        <SheetEntry
          characterId={characterId}
          name={resource.name}
          fallback={CircleGauge}
          detail={
            // As dnd5e's stat block says a recharge, from module 0.36.0.
            (resource.uses?.recharge
              ? rechargeWords(resource.uses.recharge)
              : resource.uses?.recovery) ?? undefined
          }
          aside={
            resource.uses && (
              <UsesButton uses={resource.uses} name={resource.name} />
            )
          }
        />
      )
    }
    case 'other': {
      const { item } = entry
      return (
        <SheetEntry
          characterId={characterId}
          name={item.name}
          img={item.img}
          fallback={FALLBACKS[item.itemType] ?? Package}
          detail={ITEM_TYPES[item.itemType]}
          favorite={target}
        />
      )
    }
  }
}

/**
 * A pool of spell slots made a favorite, its dots as the Spells tab's are: from module 0.42.1,
 * where they spend and restore its slots, beneath its name in a narrow list, as on a phone or in
 * the desk's column, with room for nine.
 */
function SlotsEntry({
  characterId,
  slots,
  favorite,
}: Readonly<{
  characterId: string
  slots: SheetSlotsFavorite
  favorite: FavoriteEntry['target']
}>) {
  const charging = useCharging()
  const pool = { id: slots.id, level: slots.level }
  return (
    <SheetEntry
      characterId={characterId}
      name={slots.name}
      fallback={BookOpen}
      detail='Spell slots'
      favorite={favorite}
      aside={<SpellSlots value={slots.value} max={slots.max} pool={pool} />}
      asideBelow={slotsLive(pool, slots.max, charging)}
    />
  )
}

/**
 * A class made a favorite: its levels, its hit dice and subclass, and a button with its die that
 * spends those hit dice, a tap a die, or more at once from its popover, as the Character tab's do,
 * where something rolls them and the game has their size. The button goes by the class's own, as
 * its row does; its popover, by every class's of each size, which dnd5e chooses among as it spends
 * them.
 */
function ClassEntry({
  characterId,
  entry,
  spending,
  favorite,
}: Readonly<{
  characterId: string
  entry: SheetClass
  spending?: HitDieSpending
  /** What its row's favorites entry adds or removes, from module 0.37.0; none unless said. */
  favorite?: FavoriteTarget | null
}>) {
  const { hitDice } = entry
  return (
    <SheetEntry
      characterId={characterId}
      name={
        entry.levels === null ? entry.name : `${entry.name} ${entry.levels}`
      }
      fallback={ListChecks}
      favorite={favorite}
      // The hit dice first, as a row this narrow cuts its end short.
      detail={joinParts(hitDice && hitDiceText(hitDice), entry.subclass)}
      aside={
        hitDice &&
        spending &&
        spendable(hitDice) && (
          <HitDieUse pool={hitDice} spending={spending}>
            <HitDieIcon die={hitDice.die} className='size-4 text-primary' />
          </HitDieUse>
        )
      }
    />
  )
}

/**
 * A skill or tool made a favorite, which rolls a check when tapped, and offers advantage and the
 * like when held, as a skill does on the Character tab.
 */
function CheckEntry({
  check,
  source,
  ability,
  d20,
}: Readonly<{
  check: SheetSkill
  source: RollSource
  ability: SheetAbility | undefined
  d20: RollActions
}>) {
  const proficiency = PROFICIENCY[String(check.proficiency)]
  const details = [
    proficiency,
    check.passive === null ? undefined : `passive ${check.passive}`,
  ].filter(Boolean)
  return (
    <li>
      <RollButton
        target={{
          label: `${check.label} check`,
          modifier: check.total,
          mode: check.mode,
          source,
        }}
        {...d20}
        label={checkLabel({
          label: `${check.label} check`,
          total: check.total,
          mode: check.mode,
          details: detailWords(details),
        })}
        className='flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-primary/5 focus-visible:bg-primary/5'
      >
        <span
          aria-hidden
          className='flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-[11px] font-semibold tracking-wider text-primary-text uppercase'
        >
          {ability?.abbreviation ?? <Dices className='size-4' />}
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate font-medium'>{check.label}</span>
          <span className='block truncate text-xs text-text-secondary'>
            {joinParts(
              ability?.label,
              proficiency && capitalize(proficiency),
              check.passive !== null && `Passive ${check.passive}`,
            ) ?? 'Check'}
          </span>
        </span>
        <ModeChip mode={check.mode} />
        <span className='shrink-0 font-semibold tabular-nums'>
          {formatModifier(check.total)}
        </span>
      </RollButton>
    </li>
  )
}
