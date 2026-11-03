import { aloneRollOf } from '../../utils/damage-alone'
import {
  aloneKindMenu,
  damageMenuChoices,
  pickedPlan,
  pickedTarget,
} from './utils'
import { useDamageMenu } from '@/features/rolling/components/damage-menu/use-damage-menu'
import { choicesOf } from '@/features/rolling/utils/damage-due'
import { changes, damageChanges } from '@/utils/damage-modifiers'
import type { DamageActions, DamageTarget, TableDamage } from './types'
import type { AloneChoice } from '../../utils/types'
import type { LinkMenus } from '../description-link/types'
import type { RollChoice } from '@/features/rolling/types'
import type { AloneRow, SheetDamageRoll } from '@/types/roll'
import type { SheetSpellSection } from '@/types/sending-stone'
import type { ReactNode } from 'react'

/**
 * Rolling an action's damage or healing from the sheet. A tap rolls it; a right-click or
 * long-press offers other ways: as a critical hit's, for damage rolled here; at its highest, unless
 * it takes a die away; or with its dice changed first, more of them or another size, where it has a
 * first die to change. For damage the Gamemaster's game is waiting for, the game decides a critical
 * hit, and the rest is offered where it takes them. A spell or feature the game uses offers to use
 * it so, its damage to follow. From module 0.36.0, damage this device sends on its own, where no
 * attack of its own waits for it, is rolled from the dice the game said it throws, asking first
 * which kind where it offers a choice, and offers a critical hit's only where the game makes one
 * of it. A menu that would offer nothing isn't opened. The menu and its dialog are in `dialogs`,
 * to be put on the page. From module 0.41.0, where the game takes damage on its own's choices and
 * sends a row's, its choices are asked first, after the menu's where it was long-pressed, and it's
 * rolled from the plan they pick, its kind asked from that plan.
 * @param menus - Where a choice of its kind is asked, from the chip.
 * @param spellbook - The slots a spell's damage on its own may be rolled at.
 */
export function useDamageRolls(
  onRollDamage: (roll: SheetDamageRoll) => void,
  table: TableDamage | undefined,
  menus: LinkMenus,
  spellbook: SheetSpellSection[] = [],
): {
  actions: DamageActions
  dialogs: ReactNode
} {
  const { open, dialogs } = useDamageMenu()
  // Damage due on an attack made at the table goes on that attack, whatever the switch.
  const dueOf = (target: DamageTarget) =>
    target.source && table?.dueFor(target.source)
  const goesAlone = (target: DamageTarget) =>
    !!target.alone?.plan && !!table?.sendsAlone && !dueOf(target)
  const roll = (
    target: DamageTarget,
    choice: AloneChoice & { picked?: true },
    anchor: HTMLElement,
    // The slots damage on its own may be rolled at: once its choices are picked, as the picker
    // showed them.
    spells: SheetSpellSection[] = spellbook,
  ): void => {
    const { critical = false, modifiers } = choice
    const request: SheetDamageRoll = {
      label: target.label,
      parts: target.parts,
      healing: target.healing,
      critical,
      ...(target.source && { source: target.source }),
      ...(modifiers && changes(modifiers) && { modifiers }),
    }
    const { alone } = target
    // Due damage first, which the pane rolls on its attack whatever the switch; then damage on
    // its own; else as ever, rolled here, or using its spell or feature.
    if (dueOf(target) || !alone?.plan || !table?.sendsAlone) {
      onRollDamage(request)
      return
    }
    // As the action's name, which the roll's label adds "damage" or "healing" to again.
    const name = target.label.replace(/ (damage|healing)$/, '')
    // Its choices, from module 0.41.0, where the game takes them and sends the row's: asked first,
    // once, where there's anything to ask; then its plan is the one they pick (round 0.41.0
    // §2.3.7-§2.3.9).
    const row: AloneRow | undefined =
      table.pickAlone && target.action && alone.plan.choices
        ? { action: target.action, spells }
        : undefined
    if (row && table.pickAlone && !choice.picked) {
      table.pickAlone({
        action: row.action,
        healing: target.healing === true,
        choice,
        anchor,
        // Rolled from the row the picker showed as they picked, and its plans: the page's next
        // poll may have changed both since the chip was tapped, as a slot the Gamemaster gives
        // does, and the dice must be those of the level picked from the chips shown.
        onPicked: (picks, shown) =>
          roll(
            pickedTarget(target, shown.action),
            { ...choice, ...picks, picked: true },
            anchor,
            shown.spells,
          ),
      })
      return
    }
    const plan = pickedPlan(alone.plan, row, choice)
    // Its kinds, and the dice the menu names, are the plan's picked.
    const formula = row
      ? plan.normal.rolls.map(each => each.formula).join(' + ')
      : target.formula
    const kinds = choicesOf(plan.normal)
    if (kinds.length > 0 && !choice.type) {
      menus.open({
        anchor,
        ...aloneKindMenu(`${name} ${formula}`, kinds, {
          critical,
          maximum: modifiers?.maximize === true,
          healing: target.healing,
        }),
        onChoose: type => roll(target, { ...choice, type }, anchor, spells),
      })
      return
    }
    onRollDamage(aloneRollOf(name, alone, choice, row) ?? request)
  }
  const onMenu: DamageActions['onMenu'] = (anchor, target, point, use) => {
    const subject = {
      label: target.label,
      formula: target.formula,
      healing: target.healing === true,
    }
    if (use) {
      const changed: RollChoice[] = damageChanges(target.parts)
      if (!table?.modifies || changed.length === 0) return
      open(
        anchor,
        {
          ...subject,
          parts: target.parts,
          choices: changed,
          verb: use.verb,
          onChoose: ({ modifiers }) => use.onUse(modifiers),
        },
        point,
      )
      return
    }
    const menu = damageMenuChoices(target, {
      modifies: table?.modifies === true,
      due: dueOf(target) || undefined,
      alone: goesAlone(target),
    })
    if (!menu) return
    open(
      anchor,
      { ...subject, ...menu, onChoose: choice => roll(target, choice, anchor) },
      point,
    )
  }
  return {
    actions: {
      onRoll: (target, anchor) => roll(target, {}, anchor),
      onMenu,
      goesAlone,
    },
    dialogs,
  }
}
