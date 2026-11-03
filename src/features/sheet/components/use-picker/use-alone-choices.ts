import { useState } from 'react'
import { SPEND_CHOICES } from './constants'
import { aloneChoicesOf, alonePicksOf, movedOff, spendLabel } from './utils'
import { useStoredChoice } from '@/hooks/use-stored'
import type { Picking } from './types'
import type { AloneSelection } from '@/types/roll'
import type { SheetSpellSection } from '@/types/sending-stone'

/**
 * Damage on its own's choices as they're made, from module 0.41.0: the picks, kept here; the Spend
 * switch, kept on this device for the character (`spendKey`), on the first time; and what the
 * switch spends, said again where a pick changes it. Turned on, a pick of a slot or an ammunition
 * with none left moves off it (`movedOff`).
 */
export function useAloneChoices({
  picking,
  spellbook,
  spendKey,
}: {
  picking: Extract<Picking, { kind: 'alone' }>
  spellbook: SheetSpellSection[]
  spendKey: string
}) {
  const { action, choice } = picking
  const spends = action.tableDamage?.spends ?? []
  const { pools, ammunition, modes } = aloneChoicesOf(action, spellbook)
  const [picks, setPicks] = useState(() =>
    alonePicksOf(action, spellbook, choice),
  )
  const [stored, store] = useStoredChoice(spendKey, SPEND_CHOICES, 'on')
  const on = stored === 'on'
  const label = spendLabel(action, spellbook, picks)
  // What the switch spends, said again where a pick changes it.
  const [said, say] = useState('')
  const choose = (next: AloneSelection) => {
    const picked = { ...picks, ...next }
    const now = spendLabel(action, spellbook, picked)
    if (now && now !== label) say(now)
    setPicks(picked)
  }
  // While it spends them, a slot or an ammunition with none left can't be chosen: turned on, the
  // pick moves off one to the one dnd5e would choose with some left, where there is one.
  const slotSpent = on && spends.includes('slot')
  const ammoSpent = on && spends.includes('ammunition')
  const turn = (next: boolean) => {
    store(next ? 'on' : 'off')
    if (!next) return
    choose(movedOff(action, spellbook, picks, spends))
  }
  return {
    pools,
    ammunition,
    modes,
    picks,
    choose,
    on,
    label,
    said,
    slotSpent,
    ammoSpent,
    turn,
  }
}
