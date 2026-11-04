'use client'

import clsx from 'clsx'
import { actionTitle } from '../action-entry/utils'
import { useEnchanting } from '../enchantments/use-enchanting'
import { useHeld } from './use-held'
import { profileName } from './utils'
import { onItsWay } from '@/utils/lifecycle'
import type { DamageModifiers } from '@/types/roll'
import type { SheetAction, SheetEnchant } from '@/types/sending-stone'

/**
 * An enchant activity that enchants its own item and spends nothing, such as Engulf in Flames, as
 * a switch: on while the item is enchanted by it, as the sheet says, or as the game said it left
 * it once it used it or ended it, until the sheet says otherwise than it did then; turned on, it's
 * used in the game, in the way chosen, where there's more than one; turned off, what it applied is
 * ended, with nothing to say so, as it costs nothing. While it's on its way, it can't be turned.
 */
export function EnchantSwitch({
  action,
  enchant,
  onUse,
}: Readonly<{
  action: SheetAction
  enchant: SheetEnchant
  onUse: (modifiers?: DamageModifiers) => void
}>) {
  const { end, latestFor } = useEnchanting()
  const source = { item: action.id, activity: action.activity?.id ?? '' }
  const latest = latestFor?.(source)
  const pending = onItsWay(latest)
  // What the game left it as: on where it applied it, off where it ended it.
  const outcome = latest?.status === 'done' ? latest.enchantment : undefined
  const told = outcome?.enchanted ?? undefined
  let said: boolean | undefined
  if (told) said = true
  else if (outcome?.ended) said = false
  const sheetOn = enchant.applied.length > 0
  const on = useHeld(
    said === undefined ? undefined : `${latest?.requestId}:${said}`,
    said,
    sheetOn,
    JSON.stringify(enchant.applied),
  )
  const [applied] = enchant.applied
  const effect = told?.effect ?? applied?.effect
  const turn = () => {
    if (!on) {
      onUse()
      return
    }
    if (!effect) return
    end?.(
      action.id,
      {
        id: effect,
        name:
          told?.name ?? profileName(enchant, applied?.profile ?? '', action),
      },
      source,
    )
  }
  return (
    <button
      type='button'
      role='switch'
      aria-checked={on}
      aria-label={actionTitle(action)}
      title={on ? 'On: tap to end it' : 'Off: tap to use it'}
      disabled={pending || (on && (!end || !effect))}
      onClick={turn}
      className='flex shrink-0 items-center rounded-lg p-1.5 transition-colors hover:bg-primary/5 disabled:opacity-40'
    >
      <span
        aria-hidden
        className={clsx(
          'relative h-5 w-9 rounded-full transition-colors',
          on ? 'bg-primary' : 'bg-border',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 size-4 rounded-full bg-card shadow-sm transition-[left]',
            on ? 'left-[1.125rem]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}
