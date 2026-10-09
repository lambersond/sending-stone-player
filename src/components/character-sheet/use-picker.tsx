'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Check, Crosshair, Skull, Sparkles } from 'lucide-react'
import { actionTitle, verbOf } from './action-entry'
import { Modal } from '@/components/modal'
import {
  defaultPool,
  poolName,
  slotPools,
  type SlotPool,
} from '@/utils/action-groups'
import { friendly, mostTargets, picksTargets } from '@/utils/uses'
import type { SheetRoll } from '@/hooks/use-sheet-roller'
import type { SheetAction, SheetSpellSection } from '@/types/sending-stone'
import type { TableCombat, TableCombatant } from '@/types/table'
import type { DamageModifiers } from '@/utils/damage-modifiers'

/*
 * What an attack or the use of a spell or feature is made with, chosen as it's made: whom at, and
 * with which spell slot, ammunition or attack mode, where there's a choice.
 */

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
  /** The spell slot chosen, such as "spell3", where there's a choice. */
  slot?: string
  ammunition?: string
  attackMode?: string
}

/** Who a combatant is, beside its name, as the combat tracker has it. */
const SIDES: Partial<Record<TableCombatant['side'], string>> = {
  me: 'You',
  party: 'Ally',
}

/** The combatants an attack can be made at: everyone in the combat but the attacker. */
export function targetsOf(combat?: TableCombat): TableCombatant[] {
  return combat?.combatants.filter(combatant => combatant.side !== 'me') ?? []
}

/**
 * The combatants a use can be made at, in turn order: for one that helps, the player and their
 * allies first, then everyone else; for one that harms, everyone but the player. None for a use
 * with no targets to pick.
 */
export function useTargetsOf(
  action: SheetAction,
  combat?: TableCombat,
): TableCombatant[] {
  const use = action.activity
  if (!use || !picksTargets(use)) return []
  const all = combat?.combatants ?? []
  if (!friendly(use)) return all.filter(({ side }) => side !== 'me')
  return [
    ...all.filter(({ side }) => side === 'me'),
    ...all.filter(({ side }) => side === 'party'),
    ...all.filter(({ side }) => side === 'other'),
  ]
}

/** The choices an attack or a use offers beyond its targets: slots, ammunition and modes. */
function choicesOf(picking: Picking, spellbook: SheetSpellSection[]) {
  const { action } = picking
  const pools = slotPools(action, spellbook) ?? []
  const attack = picking.kind === 'attack'
  return {
    pools: pools.length > 1 ? pools : [],
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
 * or with which slot, ammunition or mode, where there's more than one?
 */
export function asks(
  picking: Picking,
  combat: TableCombat | undefined,
  spellbook: SheetSpellSection[],
): boolean {
  const { pools, ammunition, modes } = choicesOf(picking, spellbook)
  const targets =
    picking.kind === 'attack'
      ? targetsOf(combat)
      : useTargetsOf(picking.action, combat)
  return (
    targets.length > 0 ||
    pools.length > 0 ||
    ammunition.length > 0 ||
    modes.length > 0
  )
}

/**
 * What an attack, or a spell or feature used, is made with, chosen as it's made: the spell slot,
 * ammunition and attack mode, where there's more than one, each preset as the game would have it;
 * and whom at. An attack, or a use at one target, is made at the one tapped, or at no one; a use at
 * more, or at an area, at those ticked, as many as it takes at the level it's cast at, as is an
 * area attack where the game makes it so; one with no one to pick, at once.
 */
export function UsePicker({
  picking,
  combat,
  spellbook,
  last,
  areas = false,
  onPick,
  onClose,
}: Readonly<{
  picking?: Picking
  combat?: TableCombat
  spellbook: SheetSpellSection[]
  /** The combatant last attacked, if any. */
  last?: string
  /** Whether the game makes an area attack at the combatants picked. */
  areas?: boolean
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
          last={last}
          areas={areas}
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
  last,
  areas,
  onPick,
}: Readonly<{
  picking: Picking
  combat?: TableCombat
  spellbook: SheetSpellSection[]
  last?: string
  areas: boolean
  onPick: (picked: Picked) => void
}>) {
  const { action } = picking
  const { pools, ammunition, modes } = choicesOf(picking, spellbook)
  const [slot, setSlot] = useState(defaultPool(action, spellbook)?.id)
  const [ammo, setAmmo] = useState(
    ammunition.find(({ quantity }) => quantity > 0)?.id,
  )
  const [mode, setMode] = useState(modes[0]?.value)
  const [ticked, setTicked] = useState<string[]>([])
  const options = {
    ...(pools.length > 0 && slot && { slot }),
    ...(ammunition.length > 0 && ammo && { ammunition: ammo }),
    ...(modes.length > 0 && mode && { attackMode: mode }),
  }
  const pick = (targets: TableCombatant[]) => onPick({ targets, ...options })
  // An activity used without spending a slot, such as Spirit Guardians' save each turn, is used at
  // the level chosen, whether any slot is left or not.
  const spends = action.consumesSlot !== false

  // Those ticked, as many as a use or an area attack takes at the slot chosen.
  const castAt = pools.find(({ id }) => id === slot)?.level ?? action.level
  const tickList = (
    targets: TableCombatant[],
    { area, most, verb }: { area: boolean; most: number; verb: string },
  ) => {
    const chosen = ticked.slice(0, most)
    return (
      <TickList
        lead={leadFor(area, most)}
        targets={targets}
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
          most: mostTargets(area, action.level, castAt),
          verb: 'Attack',
        })
      ) : (
        <Go label='Attack' onGo={() => pick([])} />
      )
  } else if (picking.kind === 'attack') {
    const targets = targetsOf(combat)
    whom =
      targets.length > 0 ? (
        <TargetList
          lead='Choose who to attack.'
          targets={[
            ...targets.filter(({ id }) => id === last),
            ...targets.filter(({ id }) => id !== last),
          ]}
          last={last}
          onTap={combatant => pick([combatant])}
          onNone={() => pick([])}
        />
      ) : (
        <Go label='Attack' onGo={() => pick([])} />
      )
  } else {
    const use = action.activity!
    const targets = useTargetsOf(action, combat)
    const most = mostTargets(use.targets, action.level, castAt)
    const verb = verbOf(action)
    if (targets.length === 0) {
      whom = <Go label={verb} onGo={() => pick([])} />
    } else if (most === 1) {
      whom = (
        <TargetList
          lead={`Choose who to ${verb.toLowerCase()} it at.`}
          targets={targets}
          onTap={combatant => pick([combatant])}
          onNone={() => pick([])}
        />
      )
    } else {
      whom = tickList(targets, {
        area: use.targets.area,
        most,
        verb: `${verb} at`,
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
              disabled={spends && pool.value === 0}
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

/** A row of choices, of which one is made. */
function ChipRow({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <fieldset>
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
        'rounded-lg border px-2.5 py-1 text-sm font-semibold tabular-nums transition-colors disabled:opacity-40',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border hover:bg-primary/5',
      )}
    >
      {children}
    </button>
  )
}

/** A combatant's name, with whose side they're on and whether they're down. */
function Who({
  combatant,
  last,
}: Readonly<{ combatant: TableCombatant; last?: string }>) {
  return (
    <>
      <span
        className={clsx(
          'min-w-0 flex-1 truncate font-semibold',
          combatant.defeated && 'text-text-secondary line-through',
        )}
      >
        {combatant.name}
      </span>
      {SIDES[combatant.side] && (
        <span className='shrink-0 text-xs text-text-secondary'>
          {SIDES[combatant.side]}
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
    </>
  )
}

/** Combatants to tap, one of which is the target; or no one. */
function TargetList({
  lead,
  targets,
  last,
  onTap,
  onNone,
}: Readonly<{
  lead: string
  targets: TableCombatant[]
  last?: string
  onTap: (combatant: TableCombatant) => void
  onNone: () => void
}>) {
  return (
    <div>
      <p className='mb-3 text-sm text-text-secondary'>{lead}</p>
      <ul className='flex flex-col gap-1.5'>
        {targets.map(combatant => (
          <li key={combatant.id}>
            <button
              type='button'
              onClick={() => onTap(combatant)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-primary/5',
                combatant.id === last ? 'border-primary' : 'border-border',
              )}
            >
              <Crosshair aria-hidden className='size-4 shrink-0 text-attack' />
              <Who combatant={combatant} last={last} />
            </button>
          </li>
        ))}
        <li>
          <button
            type='button'
            onClick={onNone}
            className='w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/5 hover:text-text-primary'
          >
            No target
          </button>
        </li>
      </ul>
    </div>
  )
}

/** Combatants to tick, as many as a use takes, then made at those ticked. */
function TickList({
  lead,
  targets,
  ticked,
  full,
  onToggle,
  go,
  onGo,
}: Readonly<{
  lead: string
  targets: TableCombatant[]
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
      <ul className='flex flex-col gap-1.5'>
        {targets.map(combatant => {
          const on = ticked.includes(combatant.id)
          return (
            <li key={combatant.id}>
              <button
                type='button'
                role='checkbox'
                aria-checked={on}
                disabled={!on && full}
                onClick={() => onToggle(combatant.id)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-primary/5 disabled:opacity-40',
                  on ? 'border-primary bg-primary/5' : 'border-border',
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
            </li>
          )
        })}
      </ul>
      <Go label={go} onGo={onGo} />
    </div>
  )
}

/** The button that makes it, with no one to pick, or once they're picked. */
function Go({ label, onGo }: Readonly<{ label: string; onGo: () => void }>) {
  return (
    <button
      type='button'
      onClick={onGo}
      className='mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-on-primary transition-colors hover:bg-primary/90'
    >
      <Sparkles aria-hidden className='size-4' />
      {label}
    </button>
  )
}
