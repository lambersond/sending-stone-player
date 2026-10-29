'use client'

import { useState, type ReactNode, type SyntheticEvent } from 'react'
import clsx from 'clsx'
import { useCharging, type ChargeActions } from './uses-button'
import { ConfirmModal } from '@/components/modal'
import { SPELL_SLOT, type SpellSlotOp } from '@/constants/sending-stone'
import { ordinal } from '@/utils/action-groups'
import { slotWords, type SpellSlotPool } from '@/utils/slot-words'

/** Counts shown as pips up to this many; past it, as a number alone. */
const MAX_PIPS = 9

/**
 * Whether a pool's dots spend and restore its slots, from module 0.42.1: where the pane offers it
 * (the game takes it from here, and the character isn't transformed), of a pool the app knows by
 * its id, such as "spell1" or "pact", with a dot for each of its slots, one to nine.
 */
export function slotsLive(
  pool: SpellSlotPool | undefined,
  max: number,
  charging: ChargeActions,
): boolean {
  return (
    !!pool &&
    !!charging.slot &&
    SPELL_SLOT.test(pool.id) &&
    max > 0 &&
    max <= MAX_PIPS
  )
}

/**
 * Spell slots, such as a spell level's: a pip for each, filled for each left, and how many are
 * left of how many. From module 0.42.1, where the game takes it, each a button that asks before
 * spending one, or restoring one: a filled one spends, a hollow one restores.
 * @param pool - Which pool they are, for its dots to spend and restore it; none where they're only
 *   to look at, as on the Actions tab.
 */
export function SpellSlots({
  value,
  max,
  pool,
}: Readonly<{ value: number; max: number; pool?: SpellSlotPool }>) {
  const charging = useCharging()
  if (pool && slotsLive(pool, max, charging)) {
    return <LiveSlots value={value} max={max} pool={pool} charging={charging} />
  }
  return (
    <Counted value={value} max={max}>
      <Pips value={value} max={max} />
    </Counted>
  )
}

/** The dots, then how many are left of how many, in figures and in words. */
function Counted({
  value,
  max,
  children,
}: Readonly<{ value: number; max: number; children: ReactNode }>) {
  return (
    <span className='flex shrink-0 items-center gap-2'>
      {children}
      <span
        aria-hidden
        className='text-xs font-semibold text-text-secondary tabular-nums'
      >
        {value}/{max}
      </span>
      <span className='sr-only'>
        {value} of {max} spell slots left
      </span>
    </span>
  )
}

/** What a dot's confirm was opened to do, as the dots showed the pool when it was tapped. */
type Asked = { pool: SpellSlotPool; op: SpellSlotOp; from: number; max: number }

/** Stops an event at the confirm, so that it never reaches a row's menu around the dots. */
const stop = (event: SyntheticEvent) => event.stopPropagation()

/**
 * A pool's dots as buttons, from module 0.42.1, each asking first: its confirm sits beside them,
 * not among them, in a wrapper that takes no room, which keeps a press on its words from opening
 * the menu of a row the dots are in, as a favorite's.
 */
function LiveSlots({
  value,
  max,
  pool,
  charging,
}: Readonly<{
  value: number
  max: number
  pool: SpellSlotPool
  charging: ChargeActions
}>) {
  const [open, setOpen] = useState(false)
  // What the confirm asks and does, frozen as the dot is tapped: a slot the game spends meanwhile,
  // as a cast in Foundry does, never turns it into another, and the count it names is the one the
  // player saw, which the game makes it only from.
  const [asked, setAsked] = useState<Asked>(() => ({
    pool,
    op: 'spend',
    from: value,
    max,
  }))
  const waiting = charging.slotWaiting?.(pool.id) ?? false
  const ask = (op: SpellSlotOp) => {
    if (waiting) return
    setAsked({ pool, op, from: value, max })
    setOpen(true)
  }
  const spend = asked.op === 'spend'
  const verb = spend ? 'Spend' : 'Restore'
  const after = spend ? asked.from - 1 : asked.from + 1
  return (
    <>
      <Counted value={value} max={max}>
        <SlotDots
          value={value}
          max={max}
          pool={pool}
          waiting={waiting}
          onTap={ask}
        />
      </Counted>
      <div
        className='contents'
        onPointerDown={stop}
        onContextMenu={stop}
        onClick={stop}
      >
        <ConfirmModal
          open={open}
          onClose={() => setOpen(false)}
          title={`${verb} ${slotWords(asked.pool)}?`}
          confirmLabel={verb}
          focusCancel
          onConfirm={async () => {
            charging.slot?.(asked.pool, asked.op, asked.from)
          }}
        >
          <p>
            {asked.from} of {asked.max} left, {after} once it’s{' '}
            {spend ? 'spent' : 'restored'}. Foundry’s chat will say so.
          </p>
        </ConfirmModal>
      </div>
    </>
  )
}

/**
 * The dots, from module 0.42.1, in a group named as the pool's heading names it: a button for each
 * slot, filled for each left, which spends one, hollow for each used, which restores one; with
 * more left than the pool's maximum, as dnd5e's temporary slots, each filled. Each a finger's
 * height on a phone, smaller from `sm`. Dimmed while what was sent waits for the game, when a tap
 * does nothing. Where there isn't room for them all, as nine beneath a favorite's name on a narrow
 * phone, they wrap onto another line, the count beside them, rather than running past the card.
 */
function SlotDots({
  value,
  max,
  pool,
  waiting,
  onTap,
}: Readonly<{
  value: number
  max: number
  pool: SpellSlotPool
  waiting: boolean
  onTap: (op: SpellSlotOp) => void
}>) {
  return (
    <span
      role='group'
      aria-label={slotsName(pool)}
      aria-busy={waiting || undefined}
      className='flex flex-wrap gap-0'
    >
      {Array.from({ length: max }, (_, index) => {
        const filled = index < value
        const name = `${filled ? 'Spend' : 'Restore'} ${slotWords(pool)}, ${value} of ${max} left`
        return (
          <button
            // By its place, so that the dot tapped keeps focus as the count changes.
            key={index}
            type='button'
            aria-label={name}
            title={name}
            aria-disabled={waiting || undefined}
            onClick={() => onTap(filled ? 'spend' : 'restore')}
            className={clsx(
              'inline-flex h-11 w-7 items-center justify-center rounded-md transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary sm:size-6',
              waiting && 'opacity-60',
            )}
          >
            <span
              className={clsx(
                'size-2.5 rounded-full border-2 border-primary',
                filled && 'bg-primary',
              )}
            />
          </button>
        )
      })}
    </span>
  )
}

/**
 * A pool's slots, as its heading names the pool: "1st-level spell slots", or "Pact Magic slots
 * (3rd level)".
 */
function slotsName({ id, level }: SpellSlotPool): string {
  if (id === 'pact') {
    return level === null
      ? 'Pact Magic slots'
      : `Pact Magic slots (${ordinal(level)} level)`
  }
  return level === null ? 'Spell slots' : `${ordinal(level)}-level spell slots`
}

/**
 * A pip for each of a count, such as spell slots or hit dice, filled for each left; none past
 * nine, where the number beside them says it alone. Only to look at, as the words beside them say
 * the same.
 */
export function Pips({ value, max }: Readonly<{ value: number; max: number }>) {
  if (max > MAX_PIPS) return
  return (
    <span aria-hidden className='flex gap-1'>
      {Array.from({ length: max }, (_, index) => (
        <span
          key={index}
          className={clsx(
            'size-2.5 rounded-full border-2 border-primary',
            index < value && 'bg-primary',
          )}
        />
      ))}
    </span>
  )
}
