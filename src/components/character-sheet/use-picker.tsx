'use client'

import { useId, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  Check,
  Crosshair,
  Package,
  ShieldCheck,
  Skull,
  Sparkles,
} from 'lucide-react'
import { actionTitle, verbOf } from './action-entry'
import { chargesOf } from './action-info'
import { EntryIcon } from './sheet-entry'
import { Modal } from '@/components/modal'
import { SearchField } from '@/components/search-field'
import { MAX_USE_TARGETS } from '@/constants/sending-stone'
import { useTableRole } from '@/hooks/use-table-api'
import {
  defaultPool,
  ordinal,
  poolName,
  slotPools,
  type SlotPool,
} from '@/utils/action-groups'
import { castAtLevel, castOf, type CastIndex } from '@/utils/casts'
import {
  enchantOf,
  offeredProfiles,
  type Belonging,
} from '@/utils/enchantments'
import { matchesSearch, searchKey } from '@/utils/search'
import { seatWords } from '@/utils/seat-words'
import {
  friendly,
  mostTargets,
  offersSelf,
  picksTargets,
  selfDefault,
} from '@/utils/uses'
import type { SheetRoll } from '@/hooks/use-sheet-roller'
import type { EnchantChoice } from '@/types/roll'
import type {
  SheetAction,
  SheetCastLevel,
  SheetEnchant,
  SheetEnchantProfile,
  SheetSpellSection,
} from '@/types/sending-stone'
import type { TableCombat, TableCombatant } from '@/types/table'
import type { DamageModifiers } from '@/utils/damage-modifiers'

/*
 * What an attack or the use of a spell or feature is made with, chosen as it's made: whom at, and
 * with which spell slot, ammunition or attack mode, or at which level a spell an item casts is
 * cast, where there's a choice; and for one that enchants, how, and which item.
 */

/** No spell an item casts, as for a sheet that lists none. */
const NO_CASTS: CastIndex = new Map()

/** Nothing of the character's to enchant, as for a sheet that lists nothing. */
const NO_BELONGINGS: ReadonlyMap<string, Belonging> = new Map()

/**
 * The most ways to enchant shown as chips, side by side; more are listed one under another, as a
 * phone has room for only so many long names.
 */
const MOST_PROFILE_CHIPS = 4

/** An attack, or a use, whose choices are being made. */
export type Picking =
  | { kind: 'attack'; action: SheetAction; request: SheetRoll }
  | {
      kind: 'use'
      action: SheetAction
      /** How the player chose to change the damage that follows it. */
      modifiers?: DamageModifiers
    }

/** What the player chose. */
export type Picked = {
  targets: TableCombatant[]
  /**
   * At its user too, as the game makes a use at its user where it isn't among the combatants, from
   * module 0.22.0.
   */
  self?: true
  /**
   * The spell slot chosen, such as "spell3", where there's a choice; or for a spell an item casts,
   * the level, as "spell" and the level.
   */
  slot?: string
  ammunition?: string
  attackMode?: string
  /** For a use of an enchant activity, how it enchants, and which item, if one. */
  enchant?: EnchantChoice
}

/**
 * How many combatants a list of them may have before they can be searched by name: more than
 * this, the player's own row and the defeated among them, but not "No target".
 */
const SEARCH_ABOVE = 5

/**
 * Whose side a combatant is on, as a pill beside their name: the player's own row, an ally, or a
 * creature the game has as neutral. Never an enemy, as a hostile token may be only the game's
 * default.
 */
const PILLS = {
  you: { label: 'You', look: 'bg-primary/10 text-primary-text' },
  ally: { label: 'Ally', look: 'bg-party/15 text-party' },
  neutral: {
    label: 'Neutral',
    look: 'bg-text-secondary/10 text-text-secondary',
  },
} as const

function pillOf(combatant: TableCombatant): keyof typeof PILLS | undefined {
  if (combatant.side === 'me') return 'you'
  if (allied(combatant)) return 'ally'
  return combatant.stance === 'neutral' ? 'neutral' : undefined
}

/**
 * Whether a combatant is on the player's side: they themselves, one of the party, or one the game
 * has as an ally, as a hireling the Gamemaster marked Friendly, from module 0.29.0.
 */
function allied(combatant: TableCombatant): boolean {
  return combatant.side !== 'other' || combatant.stance === 'ally'
}

/** Combatants to pick from under a heading: the player and their allies, or everyone else. */
type Section = {
  key: 'allies' | 'others'
  label: 'Allies' | 'Others'
  rows: TableCombatant[]
}

/**
 * Combatants to pick from in two sections, the player and their allies and then everyone else,
 * each in turn order: for an attack, or a use that harms, everyone else first, with the player's
 * own row last of their allies; for a use that helps, or one made at its user by default, as a
 * potion, the player first, then their allies, then everyone else.
 * @param combat - Whose turn order it is.
 * @param first - Who goes first in their section, such as the last attacked.
 */
function sectionsOf(
  targets: TableCombatant[],
  combat: TableCombat | undefined,
  { helpful, first }: { helpful: boolean; first?: string },
): Section[] {
  const turn = new Map(combat?.combatants.map(({ id }, index) => [id, index]))
  const inTurn = (one: TableCombatant, other: TableCombatant) =>
    (turn.get(one.id) ?? 0) - (turn.get(other.id) ?? 0)
  const self = targets.filter(({ side }) => side === 'me')
  const rest = targets.filter(({ side }) => side !== 'me').toSorted(inTurn)
  const lead = (rows: TableCombatant[]) => [
    ...rows.filter(({ id }) => id === first),
    ...rows.filter(({ id }) => id !== first),
  ]
  const friends = rest.filter(combatant => allied(combatant))
  const allies: Section = {
    key: 'allies',
    label: 'Allies',
    rows: lead(helpful ? [...self, ...friends] : [...friends, ...self]),
  }
  const others: Section = {
    key: 'others',
    label: 'Others',
    rows: lead(rest.filter(combatant => !allied(combatant))),
  }
  return helpful ? [allies, others] : [others, allies]
}

/**
 * What of a combatant's row a search matches: the name it shows, and on the player's own, shown as
 * Self, their own name too. Nothing else, such as a pill, nor anything the row doesn't show, so a
 * search hints at no one hidden.
 */
function shownOf(combatant: TableCombatant): string[] {
  return combatant.side === 'me' ? ['Self', combatant.name] : [combatant.name]
}

/**
 * The player's user as a target of a use, where they aren't among the combatants: the game makes it
 * at them as asked (`Picked.self`).
 */
export const SELF: TableCombatant = {
  id: '@self',
  name: 'Self',
  // eslint-disable-next-line unicorn/no-null -- the tracker's for no initiative
  initiative: null,
  defeated: false,
  side: 'me',
}

/** The combatants an attack can be made at: everyone in the combat but the attacker. */
export function targetsOf(combat?: TableCombat): TableCombatant[] {
  return combat?.combatants.filter(combatant => combatant.side !== 'me') ?? []
}

/**
 * Where a use offered at its user, as Self, is made at them: their own combatant, in the combat;
 * or else, where the game makes a use at its user as asked, from module 0.22.0, at `SELF`. None for
 * a use not offered so, or one used on its user alone, which has none to pick, or where neither
 * holds.
 * @param selfTargets - Whether the game makes a use at its user as asked.
 */
export function selfTarget(
  action: SheetAction,
  combat?: TableCombat,
  selfTargets = false,
): TableCombatant | undefined {
  if (!offersSelf(action) || action.activity?.targets.self) return undefined
  const me = combat?.combatants.find(({ side }) => side === 'me')
  if (me) return me
  return selfTargets ? SELF : undefined
}

/**
 * The combatants a use can be made at, in a combat, in turn order: for one that helps, its user
 * first, as Self, and their allies, then everyone else; for one that harms, everyone but its user,
 * then its user, where it may be made at them; and first, where it's made at them by default, as a
 * potion. None for a use with no targets to pick, or out of a combat.
 * @param selfTargets - Whether the game makes a use at its user as asked.
 */
export function useTargetsOf(
  action: SheetAction,
  combat?: TableCombat,
  selfTargets = false,
): TableCombatant[] {
  const use = action.activity
  if (!use || !picksTargets(use) || !combat) return []
  const all = combat.combatants
  const self = selfTarget(action, combat, selfTargets)
  const first = self && (friendly(use) || selfDefault(action))
  const others = friendly(use)
    ? [
        ...all.filter(({ side }) => side === 'party'),
        ...all.filter(({ side }) => side === 'other'),
      ]
    : all.filter(({ side }) => side !== 'me')
  if (!self) return others
  return first ? [self, ...others] : [...others, self]
}

/**
 * How a use made at its user by default is made there where there's no one to pick, as out of a
 * combat: at no one, for one used on its user alone, which the game makes at them; at their own
 * combatant, in the combat; or at `self`, where the game makes it so, from module 0.22.0. None
 * where none holds, or for any other use, which is made at no one.
 */
export function selfPick(
  action: SheetAction,
  combat?: TableCombat,
  selfTargets = false,
): Pick<Picked, 'targets' | 'self'> | undefined {
  if (!selfDefault(action)) return undefined
  if (action.activity?.targets.self) return { targets: [] }
  const me = combat?.combatants.find(({ side }) => side === 'me')
  if (me) return { targets: [me] }
  return selfTargets ? { targets: [], self: true } : undefined
}

/** The combatants picked, as the game is asked: its user as `self` where they're `SELF`. */
function picked(targets: TableCombatant[]): Pick<Picked, 'targets' | 'self'> {
  const self = targets.includes(SELF)
  return {
    targets: targets.filter(target => target !== SELF),
    ...(self && { self: true as const }),
  }
}

/**
 * The choices an attack or a use offers beyond its targets: slots, or the levels a spell an item
 * casts may be cast at, from module 0.20.0, which has no slots; ammunition and modes.
 */
function choicesOf(
  picking: Picking,
  spellbook: SheetSpellSection[],
  casts: CastIndex,
) {
  const { action } = picking
  const levels = castOf(action, casts)?.levels ?? []
  const pools = levels.length > 0 ? [] : (slotPools(action, spellbook) ?? [])
  const attack = picking.kind === 'attack'
  return {
    pools: pools.length > 1 ? pools : [],
    levels,
    ammunition:
      attack && (action.ammunition?.length ?? 0) > 1 ? action.ammunition! : [],
    modes:
      attack && (action.attackModes?.length ?? 0) > 1
        ? action.attackModes!
        : [],
  }
}

/**
 * Does an attack or a use ask anything before it's made: whom at, in a combat with anyone to pick,
 * or with which slot, ammunition or mode, where there's more than one, or at which level a spell an
 * item casts is cast, where it may be cast higher? One that enchants another item always asks
 * which, or to leave it on its card; one that enchants its own, how, where it may more ways than
 * one.
 * @param casts - How each spell an item casts is cast, by its copy's id.
 * @param selfTargets - Whether the game makes a use at its user as asked, from module 0.22.0.
 */
export function asks(
  picking: Picking,
  combat: TableCombat | undefined,
  spellbook: SheetSpellSection[],
  casts: CastIndex = NO_CASTS,
  selfTargets = false,
): boolean {
  const { pools, levels, ammunition, modes } = choicesOf(
    picking,
    spellbook,
    casts,
  )
  const enchant =
    picking.kind === 'use' ? enchantOf(picking.action.activity) : undefined
  if (enchant) {
    const { slot } = enchantPicks(picking.action, spellbook, casts)
    const level = castAtLevel(picking.action, spellbook, slot, casts)
    return (
      !enchant.self ||
      pools.length > 0 ||
      levels.length > 0 ||
      offeredProfiles(enchant, level).length > 1
    )
  }
  const targets =
    picking.kind === 'attack'
      ? targetsOf(combat)
      : useTargetsOf(picking.action, combat, selfTargets)
  return (
    targets.length > 0 ||
    pools.length > 0 ||
    levels.length > 0 ||
    ammunition.length > 0 ||
    modes.length > 0
  )
}

/**
 * How an enchant activity is used where nothing is asked, as dnd5e would use it: at the level a
 * spell is cast at by default, with its slot, or for one an item casts, the level, so that the game
 * casts it there; in the first way it may enchant there. Nothing for anything else, or for one with
 * no way to enchant left, which the game then refuses.
 */
export function enchantPicks(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  casts: CastIndex = NO_CASTS,
): Pick<Picked, 'slot' | 'enchant'> {
  const enchant = enchantOf(action.activity)
  if (!enchant) return {}
  const cast = castOf(action, casts)
  const slot =
    cast?.levels && cast.levels.length > 0
      ? `spell${cast.level}`
      : defaultPool(action, spellbook)?.id
  const level = castAtLevel(action, spellbook, slot, casts)
  const [profile] = offeredProfiles(enchant, level)
  return {
    ...(slot && { slot }),
    ...(profile && { enchant: { profile: profile.id } }),
  }
}

/**
 * What an attack, or a spell or feature used, is made with, chosen as it's made: the spell slot,
 * or the level a spell an item casts is cast at, with the item's charges it spends there,
 * ammunition and attack mode, where there's more than one, each preset as the game would have it;
 * and whom at. An attack, or a use at one target, is made at the one tapped, or at no one; a use at
 * more, or at an area, at those ticked, as many as it takes at the level it's cast at, as is an
 * area attack where the game makes it so; one with no one to pick, at once. A use may be made at
 * its user, as Self, where it's offered: first, and marked the default, or ticked already, for one
 * made there by default, as a potion. One that enchants is used at no one: with the way it
 * enchants, of those it offers at the level chosen, and for one that enchants another item, the
 * item tapped, or none, to leave on its card.
 */
export function UsePicker({
  picking,
  combat,
  spellbook,
  casts = NO_CASTS,
  belongings = NO_BELONGINGS,
  last,
  areas = false,
  selfTargets = false,
  onPick,
  onClose,
}: Readonly<{
  picking?: Picking
  combat?: TableCombat
  spellbook: SheetSpellSection[]
  /** How each spell an item casts is cast, by its copy's id. */
  casts?: CastIndex
  /** What the character has that an enchantment may be put on, by id. */
  belongings?: ReadonlyMap<string, Belonging>
  /** The combatant last attacked, if any. */
  last?: string
  /** Whether the game makes an area attack at the combatants picked. */
  areas?: boolean
  /** Whether the game makes a use at its user as asked, from module 0.22.0. */
  selfTargets?: boolean
  onPick: (picked: Picked) => void
  onClose: () => void
}>) {
  let title = ''
  if (picking) {
    title =
      picking.kind === 'attack'
        ? picking.request.label
        : actionTitle(picking.action)
  }
  return (
    <Modal open={picking !== undefined} onClose={onClose} title={title}>
      {picking && (
        <Choices
          picking={picking}
          combat={combat}
          spellbook={spellbook}
          casts={casts}
          belongings={belongings}
          last={last}
          areas={areas}
          selfTargets={selfTargets}
          onPick={onPick}
        />
      )}
    </Modal>
  )
}

function Choices({
  picking,
  combat,
  spellbook,
  casts,
  belongings,
  last,
  areas,
  selfTargets,
  onPick,
}: Readonly<{
  picking: Picking
  combat?: TableCombat
  spellbook: SheetSpellSection[]
  casts: CastIndex
  belongings: ReadonlyMap<string, Belonging>
  last?: string
  areas: boolean
  selfTargets: boolean
  onPick: (picked: Picked) => void
}>) {
  const { action } = picking
  const { pools, levels, ammunition, modes } = choicesOf(
    picking,
    spellbook,
    casts,
  )
  // A spell an item casts is cast at the level it's cast at by default, unless chosen otherwise.
  const cast = castOf(action, casts)
  const [slot, setSlot] = useState(
    cast && levels.length > 0
      ? `spell${cast.level}`
      : defaultPool(action, spellbook)?.id,
  )
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
  const options = {
    ...((pools.length > 0 || levels.length > 0 || !!enchant) &&
      slot && { slot }),
    ...(ammunition.length > 0 && ammo && { ammunition: ammo }),
    ...(modes.length > 0 && mode && { attackMode: mode }),
  }
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
  const tickList = (
    targets: TableCombatant[],
    {
      area,
      most: takes,
      verb,
      helps,
    }: { area: boolean; most: number; verb: string; helps: boolean },
  ) => {
    const most = Math.min(takes, MAX_USE_TARGETS)
    // Only those still in the combat count, so one gone from it while picking frees a place.
    const present = new Set(targets.map(({ id }) => id))
    const chosen = ticked.filter(id => present.has(id)).slice(0, most)
    return (
      <TickList
        lead={leadFor(area, takes)}
        sections={sectionsOf(targets, combat, { helpful: helps })}
        {...search}
        ticked={chosen}
        full={chosen.length >= most}
        onToggle={id =>
          setTicked(
            chosen.includes(id)
              ? chosen.filter(other => other !== id)
              : [...chosen, id],
          )
        }
        go={
          chosen.length > 0
            ? `${verb} ${chosen.length} ${chosen.length === 1 ? 'target' : 'targets'}`
            : verb.replace(/ at$/, '')
        }
        onGo={() => pick(targets.filter(({ id }) => chosen.includes(id)))}
      />
    )
  }

  // Whom at.
  let whom
  const area =
    areas && picking.kind === 'attack' ? action.attackArea : undefined
  if (area) {
    const targets = targetsOf(combat)
    whom =
      targets.length > 0 ? (
        tickList(targets, {
          area: true,
          most: mostTargets(area, base, castAt),
          verb: 'Attack',
          helps: false,
        })
      ) : (
        <Go label='Attack' onGo={() => pick([])} />
      )
  } else if (enchant) {
    whom = (
      <EnchantWhat
        enchant={enchant}
        verb={verbOf(action)}
        belongings={belongings}
        ready={!!profile}
        onGo={item =>
          profile &&
          onPick({
            targets: [],
            ...options,
            enchant: { profile: profile.id, ...(item && { item }) },
          })
        }
      />
    )
  } else if (picking.kind === 'attack') {
    const targets = targetsOf(combat)
    whom =
      targets.length > 0 ? (
        <TargetList
          lead='Choose who to attack.'
          sections={sectionsOf(targets, combat, {
            helpful: false,
            first: last,
          })}
          {...search}
          last={last}
          onTap={combatant => pick([combatant])}
          onNone={() => pick([])}
        />
      ) : (
        <Go label='Attack' onGo={() => pick([])} />
      )
  } else {
    const use = action.activity!
    const targets = useTargetsOf(action, combat, selfTargets)
    const most = mostTargets(use.targets, base, castAt)
    const verb = verbOf(action)
    if (targets.length === 0) {
      // One made at its user by default goes there, as it says, where it may.
      const at = selfPick(action, combat, selfTargets)
      whom = (
        <>
          {at && <p className='text-sm text-text-secondary'>At: Self</p>}
          <Go
            label={verb}
            onGo={() => onPick({ ...(at ?? { targets: [] }), ...options })}
          />
        </>
      )
    } else if (most === 1) {
      whom = (
        <TargetList
          lead={`Choose who to ${verb.toLowerCase()} it at.`}
          sections={sectionsOf(targets, combat, { helpful })}
          {...search}
          preset={preset?.id}
          onTap={combatant => pick([combatant])}
          onNone={() => pick([])}
        />
      )
    } else {
      whom = tickList(targets, {
        area: use.targets.area,
        most,
        verb: `${verb} at`,
        helps: helpful,
      })
    }
  }

  return (
    <div className='flex flex-col gap-4'>
      {pools.length > 0 && (
        <ChipRow label={spends ? 'Cast at' : 'At level'}>
          {pools.map(pool => (
            <Chip
              key={pool.id}
              selected={pool.id === slot}
              disabled={(spends && pool.value === 0) || !enchantsAt(pool.level)}
              onSelect={() => setSlot(pool.id)}
              label={spends ? poolLabel(pool) : pool.label}
            >
              {poolName(pool)}
              {spends && (
                <span className='font-normal text-text-secondary'>
                  {' '}
                  · {pool.value} left
                </span>
              )}
            </Chip>
          ))}
        </ChipRow>
      )}
      {levels.length > 0 && (
        <ChipRow label={spends ? 'Cast at' : 'At level'}>
          {levels.map(level => (
            <Chip
              key={level.level}
              selected={`spell${level.level}` === slot}
              disabled={(spends && level.short) || !enchantsAt(level.level)}
              onSelect={() => setSlot(`spell${level.level}`)}
              label={levelLabel(level, spends)}
            >
              {ordinal(level.level)}
              {spends && level.charges !== null && (
                <span className='font-normal text-text-secondary'>
                  {' '}
                  · {chargesOf(level.charges)}
                </span>
              )}
            </Chip>
          ))}
        </ChipRow>
      )}
      {ammunition.length > 0 && (
        <ChipRow label='Ammunition'>
          {ammunition.map(({ id, name, quantity }) => (
            <Chip
              key={id}
              selected={id === ammo}
              disabled={quantity <= 0}
              onSelect={() => setAmmo(id)}
              label={`${name}, ${quantity} left`}
            >
              {name}{' '}
              <span className='font-normal text-text-secondary'>
                · {quantity}
              </span>
            </Chip>
          ))}
        </ChipRow>
      )}
      {enchant && (enchant.profiles.length > 1 || offered.length === 0) && (
        <ProfileChoice
          profiles={offered}
          chosen={profile?.id}
          onChoose={setChosen}
        />
      )}
      {modes.length > 0 && (
        <ChipRow label='Mode'>
          {modes.map(({ value, label }) => (
            <Chip
              key={value}
              selected={value === mode}
              onSelect={() => setMode(value)}
              label={label}
            >
              {label}
            </Chip>
          ))}
        </ChipRow>
      )}
      {whom}
    </div>
  )
}

/** What to tick, and how many. */
function leadFor(area: boolean, most: number): string {
  const limit = Number.isFinite(most) ? ` Up to ${most}.` : ''
  return area
    ? `Tick who is caught in the area.${limit}`
    : `Tick who to target.${limit}`
}

/** A pool of slots, as a screen reader is told: such as "3rd Level, 2 slots left". */
function poolLabel(pool: SlotPool): string {
  return `${pool.label}, ${pool.value} ${pool.value === 1 ? 'slot' : 'slots'} left`
}

/**
 * A level a spell an item casts may be cast at, as a screen reader is told: such as "2nd Level,
 * 2 charges", for one that spends them; or "2nd Level".
 */
function levelLabel(level: SheetCastLevel, spends: boolean): string {
  const name = `${ordinal(level.level)} Level`
  return spends && level.charges !== null
    ? `${name}, ${chargesOf(level.charges)}`
    : name
}

/**
 * A row of choices, of which one is made: as narrow as the picker, so a chip that cuts its name
 * short does, a fieldset being otherwise as wide as what's in it.
 */
function ChipRow({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <fieldset className='min-w-0'>
      <legend className='mb-1.5 text-xs font-semibold text-text-secondary'>
        {label}
      </legend>
      <div className='flex flex-wrap gap-1.5'>{children}</div>
    </fieldset>
  )
}

function Chip({
  selected,
  disabled = false,
  onSelect,
  label,
  children,
}: Readonly<{
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  label: string
  children: React.ReactNode
}>) {
  return (
    <button
      type='button'
      role='radio'
      aria-checked={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        'max-w-full rounded-lg border px-2.5 py-1 text-sm font-semibold tabular-nums transition-colors disabled:opacity-40',
        selected
          ? 'border-primary bg-primary/10 text-primary-text'
          : 'border-border hover:bg-primary/5',
      )}
    >
      {children}
    </button>
  )
}

/**
 * The ways an enchant activity may enchant at the level chosen, one of which is chosen: as chips,
 * each name cut short where it's long, the whole of it said; or, for more than a row's worth,
 * listed one under another. That none is offered at that level is said, where none is.
 */
function ProfileChoice({
  profiles,
  chosen,
  onChoose,
}: Readonly<{
  profiles: SheetEnchantProfile[]
  chosen?: string
  onChoose: (id: string) => void
}>) {
  const legend = useId()
  if (profiles.length === 0) {
    return (
      <p className='text-sm text-text-secondary'>
        It can’t enchant anything at this level.
      </p>
    )
  }
  if (profiles.length <= MOST_PROFILE_CHIPS) {
    return (
      <ChipRow label='Enchantment'>
        {profiles.map(({ id, name }) => (
          <Chip
            key={id}
            selected={id === chosen}
            onSelect={() => onChoose(id)}
            label={name}
          >
            <span className='block truncate'>{name}</span>
          </Chip>
        ))}
      </ChipRow>
    )
  }
  return (
    <div>
      <p
        id={legend}
        className='mb-1.5 text-xs font-semibold text-text-secondary'
      >
        Enchantment
      </p>
      <div
        role='radiogroup'
        aria-labelledby={legend}
        className='flex flex-col gap-1.5'
      >
        {profiles.map(({ id, name }) => (
          <button
            key={id}
            type='button'
            role='radio'
            aria-checked={id === chosen}
            aria-label={name}
            onClick={() => onChoose(id)}
            className={clsx(
              'flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-1.5 text-left text-sm font-semibold transition-colors',
              id === chosen
                ? 'border-primary bg-primary/10 text-primary-text'
                : 'border-border hover:bg-primary/5',
            )}
          >
            <span
              aria-hidden
              className={clsx(
                'size-3.5 shrink-0 rounded-full border',
                id === chosen ? 'border-4 border-primary' : 'border-border',
              )}
            />
            <span className='min-w-0 flex-1 truncate'>{name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * What an enchant activity enchants: its own item, at a tap; or one of the character's items its
 * rules allow, each with its icon and name, marked where it's enchanted by it already, as using it
 * again replaces that; or none, to leave it on its card in the game, where the Gamemaster may put
 * it on whoever's it's for, such as an ally's weapon.
 */
function EnchantWhat({
  enchant,
  verb,
  belongings,
  ready,
  onGo,
}: Readonly<{
  enchant: SheetEnchant
  verb: string
  belongings: ReadonlyMap<string, Belonging>
  /** Whether there's a way to enchant chosen. */
  ready: boolean
  onGo: (item?: string) => void
}>) {
  const { putsOn } = seatWords(useTableRole())
  if (enchant.self) {
    return <Go label={verb} disabled={!ready} onGo={() => onGo()} />
  }
  const enchanted = new Set(enchant.applied.map(({ item }) => item))
  // Only those the sheet names, as the player can tell them apart.
  const items = enchant.items.flatMap(id => {
    const belonging = belongings.get(id)
    return belonging ? [{ id, ...belonging }] : []
  })
  return (
    <div>
      <p className='mb-3 text-sm text-text-secondary'>
        {items.length > 0
          ? 'Choose what to enchant.'
          : 'None of your items can take it.'}
      </p>
      <ul className='flex flex-col gap-1.5'>
        {items.map(({ id, name, img }) => (
          <li key={id}>
            <button
              type='button'
              disabled={!ready}
              onClick={() => onGo(id)}
              className='flex min-h-11 w-full items-center gap-3 rounded-xl border border-border px-3 py-1.5 text-left transition-colors hover:bg-primary/5 disabled:opacity-40'
            >
              <EntryIcon src={img} fallback={Package} />
              <span className='min-w-0 flex-1 truncate font-semibold'>
                {name}
              </span>
              {enchanted.has(id) && (
                <span
                  title='Enchanted by it already'
                  className='flex shrink-0 items-center text-primary'
                >
                  <Sparkles aria-hidden className='size-4' />
                  <span className='sr-only'>, enchanted by it already</span>
                </span>
              )}
            </button>
          </li>
        ))}
        <li>
          <button
            type='button'
            disabled={!ready}
            onClick={() => onGo()}
            className='min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/5 hover:text-text-primary disabled:opacity-40'
          >
            Leave it on the card
            <span className='block text-xs font-normal'>
              For someone else’s: {putsOn}.
            </span>
          </button>
        </li>
      </ul>
    </div>
  )
}

/**
 * A combatant's name, with whose side they're on and whether they're down; the player's own, as a
 * use's target, Self, marked where it's the default. Each mark is said apart from the name, as
 * "Vex, Ally".
 */
function Who({
  combatant,
  last,
  preset,
}: Readonly<{ combatant: TableCombatant; last?: string; preset?: string }>) {
  const pill = pillOf(combatant)
  return (
    <>
      <span
        className={clsx(
          'min-w-0 flex-1 truncate font-semibold',
          combatant.defeated && 'text-text-secondary line-through',
        )}
      >
        {combatant.side === 'me' ? 'Self' : combatant.name}
      </span>
      {pill && (
        <span
          className={clsx(
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            PILLS[pill].look,
          )}
        >
          <span className='sr-only'>, </span>
          {PILLS[pill].label}
        </span>
      )}
      {combatant.defeated && (
        <span className='flex shrink-0 items-center gap-1 text-xs text-text-secondary'>
          <Skull aria-hidden className='size-3.5' />
          Defeated
        </span>
      )}
      {combatant.id === last && (
        <span className='shrink-0 text-xs font-semibold text-primary'>
          Last target
        </span>
      )}
      {combatant.id === preset && (
        <span className='shrink-0 text-xs font-semibold text-primary'>
          Default
        </span>
      )}
    </>
  )
}

/** Those shown whatever is typed in a search, where none are. */
const NONE: readonly string[] = []

/**
 * Combatants to pick from, in their sections, each a list under its heading where there's more
 * than one to show; searched by what each row shows, once there are more than a few, the search
 * kept while anything's typed in it, so it can't be left filtering with no box to clear it. A
 * screen reader hears how many a search found.
 * @param kept - Those shown whatever is typed, such as those ticked, so that all the picks made
 *   can be seen, and unticked.
 * @param row - A combatant's row, given whether it's among the allies.
 */
function Sections({
  sections,
  query,
  onQuery,
  kept = NONE,
  row,
}: Readonly<{
  sections: Section[]
  query: string
  onQuery: (query: string) => void
  kept?: readonly string[]
  row: (combatant: TableCombatant, ally: boolean) => ReactNode
}>) {
  const id = useId()
  const count = sections.reduce((total, { rows }) => total + rows.length, 0)
  const searchable = count > SEARCH_ABOVE || query !== ''
  const searching = searchable && searchKey(query) !== ''
  const matches = (combatant: TableCombatant) =>
    !searching || matchesSearch(shownOf(combatant), query)
  const found = sections.reduce(
    (total, { rows }) =>
      total + rows.filter(combatant => matches(combatant)).length,
    0,
  )
  const shown = sections
    .map(section => ({
      ...section,
      rows: section.rows.filter(
        combatant => kept.includes(combatant.id) || matches(combatant),
      ),
    }))
    .filter(({ rows }) => rows.length > 0)
  const headed = shown.length > 1
  return (
    <>
      {searchable && (
        <div className='mb-3'>
          <SearchField
            value={query}
            onChange={onQuery}
            label='Search targets by name'
            placeholder='Search'
          />
        </div>
      )}
      <p aria-live='polite' className='sr-only'>
        {searching &&
          (found === 1 ? '1 target found' : `${found} targets found`)}
      </p>
      <div className='flex flex-col gap-4'>
        {shown.map(({ key, label, rows }) => (
          <div key={key}>
            {headed && (
              <h3
                id={`${id}-${key}`}
                className='mb-1.5 px-0.5 text-xs font-semibold tracking-wider text-text-secondary uppercase'
              >
                {label}
              </h3>
            )}
            <ul
              aria-labelledby={headed ? `${id}-${key}` : undefined}
              className='flex flex-col gap-1.5'
            >
              {rows.map(combatant => (
                <li key={combatant.id}>{row(combatant, key === 'allies')}</li>
              ))}
            </ul>
          </div>
        ))}
        {searching && found === 0 && (
          <p className='text-sm text-text-secondary'>No one matches</p>
        )}
      </div>
    </>
  )
}

/**
 * Combatants to tap, one of which is the target; or no one, whatever is searched. The last
 * attacked, or the default, is marked, still a tap away; an ally is marked by a shield, not the
 * crosshair.
 */
function TargetList({
  lead,
  sections,
  query,
  onQuery,
  last,
  preset,
  onTap,
  onNone,
}: Readonly<{
  lead: string
  sections: Section[]
  query: string
  onQuery: (query: string) => void
  last?: string
  /** The default target, such as Self for a potion. */
  preset?: string
  onTap: (combatant: TableCombatant) => void
  onNone: () => void
}>) {
  return (
    <div>
      <p className='mb-3 text-sm text-text-secondary'>{lead}</p>
      <Sections
        sections={sections}
        query={query}
        onQuery={onQuery}
        row={(combatant, ally) => (
          <button
            type='button'
            onClick={() => onTap(combatant)}
            className={clsx(
              'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-primary/5',
              combatant.id === last || combatant.id === preset
                ? 'border-primary'
                : 'border-border',
              ally && 'border-l-4 border-l-party',
            )}
          >
            {ally ? (
              <ShieldCheck aria-hidden className='size-4 shrink-0 text-party' />
            ) : (
              <Crosshair aria-hidden className='size-4 shrink-0 text-attack' />
            )}
            <Who combatant={combatant} last={last} preset={preset} />
          </button>
        )}
      />
      <button
        type='button'
        onClick={onNone}
        className='mt-1.5 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/5 hover:text-text-primary'
      >
        No target
      </button>
    </div>
  )
}

/**
 * Combatants to tick, as many as a use takes, then made at those ticked. Those ticked stay in the
 * list whatever is searched.
 */
function TickList({
  lead,
  sections,
  query,
  onQuery,
  ticked,
  full,
  onToggle,
  go,
  onGo,
}: Readonly<{
  lead: string
  sections: Section[]
  query: string
  onQuery: (query: string) => void
  ticked: string[]
  /** Whether as many are ticked as it takes. */
  full: boolean
  onToggle: (id: string) => void
  go: string
  onGo: () => void
}>) {
  return (
    <div>
      <p className='mb-3 text-sm text-text-secondary'>{lead}</p>
      <Sections
        sections={sections}
        query={query}
        onQuery={onQuery}
        kept={ticked}
        row={(combatant, ally) => {
          const on = ticked.includes(combatant.id)
          return (
            <button
              type='button'
              role='checkbox'
              aria-checked={on}
              disabled={!on && full}
              onClick={() => onToggle(combatant.id)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-primary/5 disabled:opacity-40',
                on ? 'border-primary bg-primary/5' : 'border-border',
                ally && 'border-l-4 border-l-party',
              )}
            >
              <span
                aria-hidden
                className={clsx(
                  'flex size-4 shrink-0 items-center justify-center rounded border',
                  on
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border',
                )}
              >
                {on && <Check className='size-3' />}
              </span>
              <Who combatant={combatant} />
            </button>
          )
        }}
      />
      <Go label={go} onGo={onGo} />
    </div>
  )
}

/** The button that makes it, with no one to pick, or once they're picked. */
function Go({
  label,
  disabled = false,
  onGo,
}: Readonly<{ label: string; disabled?: boolean; onGo: () => void }>) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onGo}
      className='mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-40'
    >
      <Sparkles aria-hidden className='size-4' />
      {label}
    </button>
  )
}
