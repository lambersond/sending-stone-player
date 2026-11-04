'use client'

import { Package, Sparkles } from 'lucide-react'
import { Go } from './go'
import { EntryIcon } from '@/components/entry-icon/entry-icon'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords } from '@/utils/seat-words'
import type { Belonging } from '@/features/sheet/types'
import type { SheetEnchant } from '@/types/sending-stone'

/**
 * What an enchant activity enchants: its own item, at a tap; or one of the character's items its
 * rules allow, each with its icon and name, marked where it's enchanted by it already, as using it
 * again replaces that; or none, to leave it on its card in the game, where the Gamemaster may put
 * it on whoever's it's for, such as an ally's weapon.
 */
export function EnchantWhat({
  enchant,
  verb,
  belongings,
  ready,
  onGo,
}: Readonly<{
  enchant: SheetEnchant
  verb: string
  belongings: ReadonlyMap<string, Belonging>
  /** Whether there's a way to enchant chosen. */
  ready: boolean
  onGo: (item?: string) => void
}>) {
  const { putsOn } = seatWords(useTableRole())
  if (enchant.self) {
    return <Go label={verb} disabled={!ready} onGo={() => onGo()} />
  }
  const enchanted = new Set(enchant.applied.map(({ item }) => item))
  // Only those the sheet names, as the player can tell them apart.
  const items = enchant.items.flatMap(id => {
    const belonging = belongings.get(id)
    return belonging ? [{ id, ...belonging }] : []
  })
  return (
    <div>
      <p className='mb-3 text-sm text-text-secondary'>
        {items.length > 0
          ? 'Choose what to enchant.'
          : 'None of your items can take it.'}
      </p>
      <ul className='flex flex-col gap-1.5'>
        {items.map(({ id, name, img }) => (
          <li key={id}>
            <button
              type='button'
              disabled={!ready}
              onClick={() => onGo(id)}
              className='flex min-h-11 w-full items-center gap-3 rounded-xl border border-border px-3 py-1.5 text-left transition-colors hover:bg-primary/5 disabled:opacity-40'
            >
              <EntryIcon src={img} fallback={Package} />
              <span className='min-w-0 flex-1 truncate font-semibold'>
                {name}
              </span>
              {enchanted.has(id) && (
                <span
                  title='Enchanted by it already'
                  className='flex shrink-0 items-center text-primary'
                >
                  <Sparkles aria-hidden className='size-4' />
                  <span className='sr-only'>, enchanted by it already</span>
                </span>
              )}
            </button>
          </li>
        ))}
        <li>
          <button
            type='button'
            disabled={!ready}
            onClick={() => onGo()}
            className='min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/5 hover:text-text-primary disabled:opacity-40'
          >
            Leave it on the card
            <span className='block text-xs font-normal'>
              For someone else’s: {putsOn}.
            </span>
          </button>
        </li>
      </ul>
    </div>
  )
}
