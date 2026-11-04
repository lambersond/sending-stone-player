import { useEffect, useRef, type RefObject } from 'react'
import { choicesOf, damageRollOf } from '@/features/rolling/utils/damage-due'
import type { PaneRoller, PaneTable, UnlessLocked } from './types'
import type { DueDamage, RollDue } from '@/features/rolling/types'
import type { DamageModifiers, SheetDamageRoll } from '@/types/roll'

/**
 * An attack's or a use's damage, while the game waits for it, rolled for the game, as the game
 * said, as the kind of damage chosen, if any, and changed as the player chose, if they did
 * (`rollDue`); and a damage roll as a row asks for it (`onRollDamage`). A use's damage or healing
 * is rolled as soon as the game says it's due, once; unless its kind is to be chosen first, in the
 * tray; or, while the player types in their own dice, offered there for them to roll it, rather
 * than asking for their dice by itself; and so too while the pane isn't the one shown (module
 * 0.36.0), whose dice would land over another's, or while its rolls are locked, as a gone
 * companion's are, whose use made before it went may still come back with its damage. Either way
 * only once, so that turning typing off after, or showing the pane, never rolls it by itself.
 */
export function useDueDamage({
  table,
  rollDamage,
  unlessLocked,
  lockedNow,
  typing,
  paneShown,
}: Readonly<{
  table: PaneTable
  rollDamage: PaneRoller['rollDamage']
  unlessLocked: UnlessLocked
  lockedNow: RefObject<boolean>
  typing: boolean
  paneShown: boolean
}>) {
  const rollDue: RollDue = unlessLocked(
    (
      name: string,
      due: DueDamage,
      type?: string,
      modifiers?: DamageModifiers,
    ) => {
      void rollDamage(damageRollOf(name, due, type, modifiers ?? due.modifiers))
    },
  )
  const rolledFor = useRef(new Set<string>())
  const { offerDamage } = table
  useEffect(() => {
    for (const [id, state] of table.states) {
      const { name, requestId, damage } = state
      if (!name || state.status !== 'done' || !requestId || !damage) continue
      if (state.damaged || rolledFor.current.has(requestId)) continue
      if (choicesOf(damage).length > 0) continue
      rolledFor.current.add(requestId)
      if (typing || !paneShown || lockedNow.current) {
        offerDamage(id)
        continue
      }
      const { modifiers } = state
      void rollDamage(damageRollOf(name, { use: requestId, damage, modifiers }))
    }
  }, [table.states, rollDamage, typing, paneShown, offerDamage, lockedNow])
  const onRollDamage = unlessLocked((request: SheetDamageRoll) => {
    const due = request.source && table.dueFor(request.source)
    if (due) {
      rollDue(
        request.label.replace(/ (damage|healing)$/, ''),
        due,
        undefined,
        request.modifiers,
      )
      return
    }
    // Damage on its own, from module 0.36.0, is rolled as its row gave it: its dice the game's
    // plan, a critical hit's where chosen, as the kind chosen; sent as such, unless the switch went
    // off since, when it's the player's alone. Any other is rolled here, as ever.
    void rollDamage(request)
  })
  return { rollDue, onRollDamage }
}
