import clsx from 'clsx'
import { HeartPulse, Swords } from 'lucide-react'
import { useDamageMenu } from '../damage-menu/use-damage-menu'
import { RollButton } from '../roll-button/roll-button'
import { choicesOf, damageRollOf } from '@/features/rolling/utils/damage-due'
import { useRollsLocked } from '@/hooks/use-rolls-locked'
import {
  damageChanges,
  diceTakenAway,
  unmaximizable,
} from '@/utils/damage-modifiers'
import type { RollDue, DueDamage } from '../../types'
import type { DamageModifiers, TableRollState } from '@/types/roll'

/**
 * The colours of the buttons that roll damage or healing: tinted, on the tray's card; or, on a
 * toast's tint, the card's own colour, outlined in theirs, for their words to read as clearly.
 */
const DAMAGE_BUTTONS = {
  damage: 'bg-damage/15 text-damage hover:bg-damage/25',
  healing: 'bg-primary/10 text-primary-text hover:bg-primary/20',
  damageOnTint: 'bg-card text-damage ring-1 ring-damage/40 hover:ring-damage',
  healingOnTint:
    'bg-card text-primary ring-1 ring-primary/40 hover:ring-primary',
}

/**
 * Roll the damage or healing of an attack or use the game made, while the game waits for it: as
 * one of the kinds of damage it offers, a button each, where it offers a choice. Where the game
 * takes damage the player changed, a right-click or long-press offers to roll it at its highest,
 * unless it takes a die away, or with its dice changed first, where it has a first die the game
 * changes; nothing where it offers neither.
 */
export function DamageButton({
  name,
  state,
  onRollDamage,
  modifies = false,
  onTint,
}: Readonly<{
  name: string
  state: TableRollState
  onRollDamage: RollDue
  modifies?: boolean
  onTint: boolean
}>) {
  const { open, dialogs } = useDamageMenu()
  // A gone companion's pane rolls nothing, its due damage among it (module 0.36.0).
  const locked = useRollsLocked()
  const { damage, requestId } = state
  // Whether it's due is `damageDue`'s to say; these are only what rolling it takes.
  if (!damage || !requestId) return
  const due: DueDamage = {
    use: requestId,
    damage,
    ...(state.modifiers && { modifiers: state.modifiers }),
  }
  const Icon = damage.healing ? HeartPulse : Swords
  const kind = damage.healing ? 'healing' : 'damage'
  const button = clsx(
    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
    DAMAGE_BUTTONS[`${kind}${onTint ? 'OnTint' : ''}`],
  )
  // Its dice as the game will throw them, for its menu to change them. Damage the game rolls itself
  // has no dice here to change, but can be its highest, unless its formula takes a die away, or
  // explodes one.
  const game = damageRollOf(name, due)
  const ways = damageChanges(
    game.parts,
    game.fixed,
    diceTakenAway(damage) || unmaximizable(damage),
  )
  const formula = damage.rolls.map(roll => roll.formula).join(' + ')
  const roll = (type?: string, modifiers?: DamageModifiers) => {
    if (modifiers) onRollDamage(name, due, type, modifiers)
    else if (type) onRollDamage(name, due, type)
    else onRollDamage(name, due)
  }
  // A button that rolls it, which a right-click or long-press offers to change first.
  const rollButton = (
    text: string,
    label: string,
    type: string | undefined,
    className: string,
  ) =>
    modifies ? (
      <RollButton
        target={type}
        onRoll={() => roll(type)}
        onMenu={(anchor, _, point) => {
          if (ways.length === 0) return
          open(
            anchor,
            {
              label: game.label,
              formula,
              parts: game.parts,
              healing: damage.healing === true,
              perDie: game.perDie,
              choices: ways,
              onChoose: ({ modifiers }) => roll(type, modifiers),
            },
            point,
          )
        }}
        label={label}
        className={className}
      >
        <Icon aria-hidden className='size-4' />
        {text}
      </RollButton>
    ) : (
      <button
        type='button'
        aria-label={label}
        disabled={locked}
        onClick={() => roll(type)}
        className={clsx(
          className,
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <Icon aria-hidden className='size-4' />
        {text}
      </button>
    )
  const choices = choicesOf(damage)
  if (choices.length > 0) {
    return (
      <div className='mt-2'>
        <p className='text-xs text-text-secondary'>
          Choose its kind of {kind}:
        </p>
        <div className='mt-1 flex flex-wrap gap-1.5'>
          {choices.map(({ key, label }) => (
            <span key={key} className='contents'>
              {rollButton(
                label,
                // A kind of healing names itself, such as Temporary Hit Points.
                damage.healing ? `Roll ${label}` : `Roll ${label} ${kind}`,
                key,
                button,
              )}
            </span>
          ))}
        </div>
        {dialogs}
      </div>
    )
  }
  const text = damage.critical ? `Roll critical ${kind}` : `Roll ${kind}`
  return (
    <>
      {rollButton(text, text, undefined, clsx(button, 'mt-2'))}
      {dialogs}
    </>
  )
}
