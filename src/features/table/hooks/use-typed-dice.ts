import { useEffect, useState } from 'react'
import { POLL_INTERVAL } from '@/constants/polling'
import type { DiceSwitch } from '@/features/table/types'
import type { TableView } from '@/types/table'

/**
 * Whether the player types in their own dice, as they chose on any device (module 0.32.0): the
 * player's change, until a view agrees with it; one that disagrees, coming a poll after the
 * save settled, is another device's later choice.
 * @param setManualDice - Remembers the choice on every device. A player's page only.
 * @returns The switch for it, where the game lets the player type in their own dice: never on the
 *   Gamemaster's page, which has nowhere to remember it. Their companions' are the same.
 */
export function useTypedDice(
  view: TableView,
  setManualDice?: (on: boolean) => Promise<void>,
): DiceSwitch | undefined {
  const [diceChoice, setDiceChoice] = useState<{
    on: boolean
    settled?: number
  }>()
  const stored = view.manualDice?.on === true
  const typing = diceChoice?.on ?? stored
  useEffect(() => {
    const told = view.manualDice?.on === true
    // Told apart by the time since the save settled, read after the commit, as it always was:
    // in render it would read the clock there.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the clock after commit
    setDiceChoice(held => {
      if (!held || held.on === told) return
      // A view polled before the save settled may still say what was stored before it.
      const later =
        held.settled !== undefined && Date.now() - held.settled > POLL_INTERVAL
      return later ? undefined : held
    })
  }, [view])
  const onManualDice = (next: boolean) => {
    if (!setManualDice) return
    const made = { on: next }
    setDiceChoice(made)
    setManualDice(next).then(
      () =>
        setDiceChoice(held =>
          held === made ? { ...made, settled: Date.now() } : held,
        ),
      // Not saved: the switch shows what's stored again.
      () => setDiceChoice(held => (held === made ? undefined : held)),
    )
  }
  return view.connected && view.manualDice?.offered && setManualDice
    ? { on: typing, onChange: onManualDice }
    : undefined
}
