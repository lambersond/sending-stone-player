import { useMemo, useCallback } from 'react'
import { PREPARE_SETTLE } from '@/constants/sending-stone'
import { useSettle } from '@/features/sheet/hooks/use-settle'
import type { PrepareChoice, Preparations, SentSpell } from './types'
import type { TableRollState } from '@/types/roll'
import type {
  PrepareOp,
  SheetSpellSection,
  SheetSpell,
} from '@/types/sending-stone'

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
  const { sent, last, waitingOf } = useSettle<SentSpell>({
    states,
    settleMs: PREPARE_SETTLE,
    missing: 'idle',
    agrees: useCallback(
      ({ spell, op }) =>
        byId.get(spell)?.prepared === (op === 'prepare' ? 1 : 0),
      [byId],
    ),
  })

  const choiceFor = useCallback(
    (id: string): PrepareChoice | undefined => {
      if (!on) return undefined
      const spell = byId.get(id)
      if (spell?.prepared !== 0 && spell?.prepared !== 1) return undefined
      const op = spell.prepared === 1 ? 'unprepare' : 'prepare'
      return {
        op,
        waiting: waitingOf(last(id)),
        choose: () => {
          sent(id, { id: send(spell, op), op, spell: id })
        },
      }
    },
    [on, byId, last, waitingOf, sent, send],
  )
  return useMemo(() => ({ choiceFor }), [choiceFor])
}
