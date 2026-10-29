'use client'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { PREPARE_SETTLE, type PrepareOp } from '@/constants/sending-stone'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { SheetSpell, SheetSpellSection } from '@/types/sending-stone'

// What a pane offers of its character's spells, from module 0.42.1: on every row of a spell the
// character prepares, Prepare or Unprepare, as the sheet says it is now, as dnd5e's own sheet's
// menu offers them. Found by the spell's id, so that each of its rows offers it whatever draws it,
// a spell's row or an action's, and all of them wait together once it's sent.

/** A spell row's Prepare or Unprepare: which, and whether it waits, as while it's on its way. */
export type PrepareChoice = {
  op: PrepareOp
  waiting: boolean
  choose: () => void
}

/** What a pane offers of its character's spells: none where they can't be changed here. */
type Preparations = {
  choiceFor: (id: string) => PrepareChoice | undefined
}

/**
 * None, as wherever a sheet's spells can't be prepared from here: a party's sheet, a companion's
 * pane, the Gamemaster's page, a game that doesn't take it, and any row drawn outside a pane.
 */
export const NO_PREPARING: Preparations = {
  // eslint-disable-next-line unicorn/no-useless-undefined -- none, for every row
  choiceFor: () => undefined,
}

const PreparingContext = createContext<Preparations>(NO_PREPARING)

/** What the rows inside offer of the character's spells. */
export function Preparing({
  value,
  children,
}: Readonly<{ value: Preparations; children: ReactNode }>) {
  return <PreparingContext value={value}>{children}</PreparingContext>
}

/**
 * A spell row's Prepare or Unprepare, where it has one: none for a row that names no spell, or
 * outside a pane that offers them. Called whatever the row is, as a hook is called each render.
 * @param id - The spell's id on the sheet, as an action of it names it too.
 */
export function usePrepareChoice(id?: string): PrepareChoice | undefined {
  const { choiceFor } = use(PreparingContext)
  return id ? choiceFor(id) : undefined
}

/** The last sent of a spell from here: its line's local id, the state it asked for, and when. */
type Sent = { local: string; op: PrepareOp; at: number }

/**
 * What a pane offers of its character's spells. A spell's entry is Unprepare where the sheet has
 * it prepared, Prepare where it has it not; none for one always prepared, or one that isn't
 * prepared at all, such as a cantrip or one an item casts, nor where the pane doesn't offer them.
 * One sent waits while it's on its way, however long that takes, and once made until the sheet has
 * it as asked, for up to `PREPARE_SETTLE` from the send; never once it failed or was refused, so
 * that it can be tried again.
 * @param on - Whether the pane offers them: its seat's player may, at their own character's pane.
 * @param spells - The sheet's spellbook, by section, which each spell is found in by its id.
 * @param send - Sends one, and logs it among the rolls, returning its line's local id.
 */
export function usePreparing({
  on,
  spells,
  states,
  send,
}: Readonly<{
  on: boolean
  spells: SheetSpellSection[]
  states: ReadonlyMap<string, TableRollState>
  send: (spell: SheetSpell, op: PrepareOp) => string
}>): Preparations {
  const [sent, setSent] = useState<ReadonlyMap<string, Sent>>(() => new Map())
  // The local ids of those sent long enough ago that the sheet should have come.
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const running = timers.current
    return () => {
      for (const timer of running) clearTimeout(timer)
    }
  }, [])
  // Each spell by its id, once for each sheet.
  const byId = useMemo(() => {
    const found = new Map<string, SheetSpell>()
    for (const section of spells) {
      for (const spell of section.spells) {
        if (!found.has(spell.id)) found.set(spell.id, spell)
      }
    }
    return found
  }, [spells])

  const choiceFor = useCallback(
    (id: string): PrepareChoice | undefined => {
      if (!on) return undefined
      const spell = byId.get(id)
      if (spell?.prepared !== 0 && spell?.prepared !== 1) return undefined
      const op = spell.prepared === 1 ? 'unprepare' : 'prepare'
      const last = sent.get(id)
      const state = last && states.get(last.local)
      const wanted = last?.op === 'prepare' ? 1 : 0
      const waiting =
        !!last &&
        !!state &&
        (state.status === 'sending' ||
          state.status === 'rolling' ||
          (state.status === 'done' &&
            spell.prepared !== wanted &&
            !settled.has(last.local)))
      return {
        op,
        waiting,
        choose: () => {
          const local = send(spell, op)
          setSent(held => new Map(held).set(id, { local, op, at: Date.now() }))
          const timer = setTimeout(() => {
            timers.current.delete(timer)
            setSettled(held => new Set(held).add(local))
          }, PREPARE_SETTLE)
          timers.current.add(timer)
        },
      }
    },
    [on, byId, sent, states, settled, send],
  )
  return useMemo(() => ({ choiceFor }), [choiceFor])
}
