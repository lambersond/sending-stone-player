import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { actionTitle, verbOf } from '../action-entry/utils'
import { asks, enchantPicks } from '../use-picker/utils'
import { alonePicked, pickedAttack } from './utils'
import { isItemCast } from '@/utils/casts'
import { sheetActions } from '@/utils/sheet-actions'
import type { PaneRoller, PaneTable } from './types'
import type { AlonePick } from '../action-entry/types'
import type { Picked, Picking } from '../use-picker/types'
import type { DamageModifiers } from '@/types/roll'
import type {
  CastIndex,
  FavoriteEntry,
  SheetAction,
} from '@/types/sending-stone'
import type { TableCombat, TableSheet } from '@/types/table'

/**
 * An attack or a use made at the table, while its player picks whom at, and with what (`picking`,
 * which the picker shows). One open as the pane's rolls lock, as a companion's that has gone,
 * closes: nothing it picks is made.
 */
export function usePicking({
  locked,
  lockedNow,
  table,
  roller: { roll, logUse },
  sheet,
  entries,
  itemCasts,
  combat,
}: Readonly<{
  locked: boolean
  lockedNow: RefObject<boolean>
  table: PaneTable
  roller: Pick<PaneRoller, 'roll' | 'logUse'>
  sheet: TableSheet
  entries: FavoriteEntry[]
  itemCasts: CastIndex
  combat?: TableCombat
}>) {
  const [picking, setPicking] = useState<Picking>()
  if (locked && picking) setPicking(undefined)
  // Damage on its own whose choices are being picked, from module 0.41.0: how it goes on once
  // they are, and the chip it was rolled from, which has focus back once the picker closes
  // without a pick, as it does once the picker's dialog has closed.
  const aloneGoing = useRef<AlonePick>(undefined)
  const returnTo = useRef<HTMLElement>(undefined)
  useEffect(() => {
    if (picking || !returnTo.current) return
    if (returnTo.current.isConnected) returnTo.current.focus()
    returnTo.current = undefined
  }, [picking])
  const [lastTarget, setLastTarget] = useState<string>()
  // An attack or a use opens the picker where there's anything to pick, saying whether it did.
  const ask = (asking: Picking) => {
    if (!asks(asking, combat, sheet.spells, itemCasts, table.selfTargets)) {
      return false
    }
    setPicking(asking)
    return true
  }
  const makeUse = (
    action: SheetAction,
    chose: Picked,
    modifiers?: DamageModifiers,
  ) => {
    if (!action.activity) return
    // An enchant activity used without asking is used as dnd5e would use it, in the first way it
    // may enchant.
    const picked =
      action.activity.type === 'enchant' && !chose.enchant
        ? { ...chose, ...enchantPicks(action, sheet.spells, itemCasts) }
        : chose
    const used = logUse(
      actionTitle(action),
      verbOf(action) === 'Cast',
      isItemCast(action),
    )
    // A combat that ended while they picked leaves no one to target; its user, as Self, is still
    // its user, where the game makes a use at them as asked.
    const self =
      picked.self === true ||
      (!combat &&
        table.selfTargets &&
        picked.targets.some(({ side }) => side === 'me'))
    table.sendUse(
      used,
      {
        kind: 'use',
        item: action.id,
        activity: action.activity.id,
        targets: combat
          ? picked.targets.map(({ id }) => ({
              combatId: combat.id,
              combatantId: id,
            }))
          : [],
        ...(self && { self: true as const }),
        slot: picked.slot,
        ...(picked.enchant && { enchant: picked.enchant }),
      },
      modifiers,
    )
  }
  // Damage on its own's choices, from module 0.41.0, where the game takes them: picked first where
  // there's anything to ask, as an attack's or a use's are, else it goes on at once.
  const pickAlone = (pick: AlonePick) => {
    if (lockedNow.current) return
    const asking: Picking = {
      kind: 'alone',
      action: pick.action,
      healing: pick.healing,
      choice: pick.choice,
    }
    if (!asks(asking, combat, sheet.spells)) {
      pick.onPicked({}, { action: pick.action, spells: sheet.spells })
      return
    }
    aloneGoing.current = pick
    setPicking(asking)
  }
  // Damage on its own's row as the sheet has it now, from module 0.41.0: the page's next poll may
  // change it while its player picks, as a slot the Gamemaster gives brings the plan of that level,
  // so the picker draws its chips from the row as it is now, and what's picked is rolled from that
  // row. Where the sheet lists it more than once, the listing it was tapped on, by its name; as it
  // was, where the sheet no longer plans it.
  const aloneRow = useMemo(() => {
    if (picking?.kind !== 'alone') return
    const { action } = picking
    const activity = action.attackId ?? action.activity?.id
    const listed = sheetActions(sheet, entries).filter(
      each =>
        each.id === action.id &&
        (each.attackId ?? each.activity?.id) === activity &&
        !!each.tableDamage,
    )
    return (
      listed.find(
        each =>
          each.name === action.name &&
          each.activityName === action.activityName,
      ) ??
      listed[0] ??
      action
    )
  }, [picking, sheet, entries])
  const shownPicking: Picking | undefined =
    picking?.kind === 'alone' && aloneRow
      ? { ...picking, action: aloneRow }
      : picking
  const closePicker = () => {
    returnTo.current = aloneGoing.current?.anchor
    aloneGoing.current = undefined
    setPicking(undefined)
  }
  const pick = (picked: Picked) => {
    const asked = shownPicking
    const going = aloneGoing.current
    aloneGoing.current = undefined
    setPicking(undefined)
    // Nothing picked at a pane whose rolls have locked since is made (module 0.36.0).
    if (lockedNow.current) return
    if (asked?.kind === 'alone') {
      going?.onPicked(alonePicked(picked), {
        action: asked.action,
        spells: sheet.spells,
      })
      return
    }
    if (asked?.kind === 'use') {
      makeUse(asked.action, picked, asked.modifiers)
      return
    }
    const source = asked?.request.source
    if (!asked || source?.kind !== 'attack') return
    const area = !!table.areas && !!asked.action.attackArea
    const [combatant] = picked.targets
    if (!area && combatant) setLastTarget(combatant.id)
    void roll(pickedAttack(asked, source, picked, combat, area))
  }
  return {
    picking: shownPicking,
    ask,
    makeUse,
    pickAlone,
    closePicker,
    pick,
    lastTarget,
  }
}
