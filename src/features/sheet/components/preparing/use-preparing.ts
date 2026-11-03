import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { PREPARE_SETTLE } from '@/constants/sending-stone'
import type { PrepareChoice } from './types'
import type { Preparations } from './use-prepare-choice'
import type { TableRollState } from '@/types/roll'
import type {
  PrepareOp,
  SheetSpellSection,
  SheetSpell,
} from '@/types/sending-stone'

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
