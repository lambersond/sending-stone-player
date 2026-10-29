'use client'

import { useId, useRef } from 'react'
import clsx from 'clsx'
import {
  BookOpen,
  ChevronDown,
  CircleGauge,
  Dices,
  ListChecks,
  Package,
  Star,
} from 'lucide-react'
import {
  ActionEntry,
  FALLBACKS,
  useActionRows,
  type ActionRows,
  type TableDamage,
} from './action-entry'
import { ModeChip, modeText, PROFICIENCY } from './character-sheet'
import { EffectEntry } from './effects-tab'
import { FavoriteMarks, NO_MARKS } from './favorite-mark'
import { FeatureEntry } from './features-tab'
import {
  hitDiceText,
  hitDieSpending,
  HitDieUse,
  type HitDieSpending,
} from './hit-dice'
import { HitDieIcon } from './hit-die-icon'
import { ItemEntry } from './inventory-tab'
import { RollButton } from './roll-button'
import { joinParts, SheetEntry } from './sheet-entry'
import { slotsLive, SpellSlots } from './spell-slots'
import { SpellEntry } from './spells-tab'
import { useCharging, UsesButton } from './uses-button'
import { Scroller } from '@/components/scroller'
import { useStoredChoice } from '@/hooks/use-stored'
import { useWidth } from '@/hooks/use-width'
import { rechargeWords } from '@/utils/creature-words'
import { resourceNote, type FavoriteEntry } from '@/utils/favorites'
import { formatModifier } from '@/utils/format-modifier'
import { spendable } from '@/utils/formulas'
import type { RollActions } from './d20-rolls'
import type {
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/hooks/use-sheet-roller'
import type { FavoriteTarget, RollSource } from '@/types/roll'
import type {
  SheetAbility,
  SheetAction,
  SheetClass,
  SheetSkill,
  SheetSlotsFavorite,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { DamageModifiers } from '@/utils/damage-modifiers'

type Props = {
  characterId: string
  sheet: TableSheet
  /** The character's favorites, each with what it refers to. */
  entries: FavoriteEntry[]
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Spends hit dice, or rolls an activity's own formula, such as a light's radius. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Uses a spell or feature in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  /** What the game does with damage, while it takes it. */
  tableDamage?: TableDamage
}

/** Where this browser keeps whether the favorites are shown, after which the character's id. */
const SHOWN_KEY = 'sending-stone:favorites-shown'
const SHOWN = ['open', 'closed'] as const

/** What a kind of item is, for an item the sheet lists nowhere else. */
const ITEM_TYPES: Record<string, string> = {
  background: 'Background',
  class: 'Class',
  facility: 'Facility',
  race: 'Species',
  subclass: 'Subclass',
}

/**
 * The character's favorites at the top of a tab, as on a phone or tablet: under a heading that
 * hides them, or shows them again, which this browser remembers for the character.
 */
export function FavoritesStrip(props: Readonly<Props>) {
  const { characterId, entries } = props
  const [shown, show] = useStoredChoice(
    `${SHOWN_KEY}:${characterId}`,
    SHOWN,
    'open',
  )
  const open = shown === 'open'
  const id = useId()
  const count = entries.length
  return (
    <section aria-labelledby={`${id}-heading`} className='flex flex-col gap-2'>
      <h2>
        <button
          type='button'
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onClick={() => show(open ? 'closed' : 'open')}
          className='-mx-1.5 flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-primary/5'
        >
          <ChevronDown
            aria-hidden
            className={clsx(
              'size-3.5 shrink-0 text-text-secondary transition-transform',
              !open && '-rotate-90',
            )}
          />
          <Star aria-hidden className='size-3.5 shrink-0 fill-gold text-gold' />
          <span
            id={`${id}-heading`}
            className='text-xs font-semibold tracking-wider text-text-secondary uppercase'
          >
            Favorites
          </span>
          <span className='text-xs text-text-secondary tabular-nums opacity-70'>
            <span aria-hidden>{count}</span>
            <span className='sr-only'>, {count}</span>
          </span>
        </button>
      </h2>
      {/* Hidden, its favorites are kept, each as open as it was. */}
      <div id={`${id}-list`} hidden={!open}>
        <FavoritesList {...props} />
      </div>
    </section>
  )
}

/**
 * The character's favorites in a column beside the sheet, as Tidy 5e has them in its sidebar,
 * where the sheet is wide enough for both. It scrolls on its own, so that they stay at hand.
 */
export function FavoritesColumn(props: Readonly<Props>) {
  const id = useId()
  return (
    <aside
      aria-labelledby={id}
      className='flex w-90 shrink-0 flex-col border-r border-border'
    >
      <Scroller>
        <div className='flex flex-col gap-2 px-3 py-4 md:py-6'>
          <h2
            id={id}
            className='flex items-center gap-1.5 px-1.5 text-xs font-semibold tracking-wider text-text-secondary uppercase'
          >
            <Star
              aria-hidden
              className='size-3.5 shrink-0 fill-gold text-gold'
            />
            Favorites
          </h2>
          <FavoritesList {...props} />
        </div>
      </Scroller>
    </aside>
  )
}

/**
 * How wide the favorites' card must be, in pixels, for them to be in two lists side by side, each
 * about as wide as a phone's.
 */
const SPLIT_FROM = 592

/**
 * The favorites, in the player's order, each shown as the sheet shows it elsewhere: an action
 * rolls its attack and damage, as on the Actions tab; a skill or tool rolls a check, as on the
 * Character tab; and each opens to its description. Inside them, nothing is marked a favorite, as
 * every one is. Where they're wide enough, they're in two lists side by side.
 */
function FavoritesList({
  characterId,
  sheet,
  entries,
  onRoll,
  onRollDamage,
  onRollFormula,
  onUse,
  tableDamage,
}: Readonly<Props>) {
  const { rows, dialogs } = useActionRows({
    characterId,
    sheet,
    onRoll,
    onRollDamage,
    onRollFormula,
    onUse,
    tableDamage,
  })
  const spending = hitDieSpending(sheet, onRollFormula)
  const card = useRef<HTMLDivElement>(null)
  const width = useWidth(card)
  // Side by side, the first half is in the first list and the rest in the second, so that each
  // stays in its list as favorites open and close.
  const half = Math.ceil(entries.length / 2)
  const lists =
    width >= SPLIT_FROM && entries.length > 1
      ? [entries.slice(0, half), entries.slice(half)]
      : [entries]
  return (
    <FavoriteMarks keys={NO_MARKS}>
      <div
        ref={card}
        className={clsx(
          'rounded-2xl border border-border bg-card p-1.5',
          lists.length > 1 && 'grid grid-cols-2 gap-x-3',
        )}
      >
        {lists.map((list, index) => (
          // A container, so that each row fits the list it's in.
          <ul key={index} className='@container min-w-0'>
            {list.map(entry => (
              <FavoriteRow
                key={entry.key}
                entry={entry}
                rows={rows}
                abilities={sheet.abilities}
                spending={spending}
              />
            ))}
          </ul>
        ))}
      </div>
      {dialogs}
    </FavoriteMarks>
  )
}

/**
 * A favorite, as the sheet shows it elsewhere. From module 0.37.0, its row's favorites entry is its
 * own, never the star's: Remove from favorites, as it's one; an activity's, the activity's, never
 * its item's; and none for a resource, the feature a resource stands for, a skill, a tool or spell
 * slots.
 */
function FavoriteRow({
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
 * where they spend and restore its slots, beneath its name on a phone, with room for nine.
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
        label={`${check.label} check, ${formatModifier(check.total)}${details.length > 0 ? ` (${details.join(', ')})` : ''}${modeText(check.mode)}`}
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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
