'use client'

import { createContext, use, type ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { joinParts } from './sheet-entry'
import { ConfirmDialog } from '@/components/modal'
import { useTableRole } from '@/hooks/use-table-api'
import { enchantmentParts, type Belonging } from '@/utils/enchantments'
import { seatWords } from '@/utils/seat-words'
import type { AttackSource, TableRollState } from '@/hooks/use-table-rolls'
import type { SheetEnchantment } from '@/types/sending-stone'

/*
 * Enchantments on the character's items, as dnd5e's enchant activities apply them, from module
 * 0.21.0: marked where the sheet lists the items, each said in full once one is open, and ended
 * from there, as dnd5e's chat card lets its caster end one.
 */

/** An enchantment ended: on which of the character's items, its effect's id, and its name. */
export type EndEnchantment = (
  item: string,
  enchantment: Pick<SheetEnchantment, 'id' | 'name'>,
  /** The enchant activity's switch or chip it's ended from, if any, which then follows it. */
  source?: AttackSource,
) => void

/**
 * What the sheet does with enchantments: end one, while the Gamemaster's game takes it; follow the
 * latest use of an enchant activity at the table, or the end of what it applied; and name the item
 * one is on as the sheet lists it.
 */
export type EnchantActions = {
  end?: EndEnchantment
  latestFor?: (source: AttackSource) => TableRollState | undefined
  /** What the character has, by id, with its name as the sheet lists it. */
  belongings?: ReadonlyMap<string, Belonging>
}

/** Nothing, until it's given, as where the game takes nothing. */
const Actions = createContext<EnchantActions>({})

/** Has enchantments ended, and enchant activities followed, wherever the sheet lists them. */
export function Enchanting({
  actions,
  children,
}: Readonly<{ actions: EnchantActions; children: ReactNode }>) {
  return <Actions value={actions}>{children}</Actions>
}

/** What the sheet does with enchantments, as it's given. */
export function useEnchanting(): EnchantActions {
  return use(Actions)
}

/** The sparkle by an enchanted item's name, which a screen reader says as "Enchanted". */
export function EnchantedMark() {
  return (
    <Sparkles
      role='img'
      aria-label='Enchanted'
      className='size-3 shrink-0 text-primary'
    />
  )
}

/**
 * What a row the sheet lists as an entry shows of the enchantments on it: the mark that it's
 * enchanted, by its name, and once it's open, each of them. Nothing for one with none.
 */
export function enchantedEntry(
  entry: Readonly<{
    id: string
    name: string
    enchantments?: SheetEnchantment[]
  }>,
): { badge?: ReactNode; lead?: ReactNode } {
  if (!entry.enchantments?.length) return {}
  return {
    badge: <EnchantedMark />,
    lead: (
      <EnchantmentList
        item={entry.id}
        itemName={entry.name}
        enchantments={entry.enchantments}
      />
    ),
  }
}

/**
 * The enchantments on an item, once it's open: each one's name, whether it lasts while its caster
 * concentrates, the time it has left, or that it has run out, and what put it there; and for one
 * the player may end, while the game takes it, a button that ends it, once they say so.
 */
export function EnchantmentList({
  item,
  itemName,
  enchantments,
}: Readonly<{
  /** The item's id. */
  item: string
  itemName: string
  enchantments?: SheetEnchantment[]
}>) {
  if (!enchantments?.length) return
  return (
    <ul aria-label='Enchantments' className='flex flex-col gap-1.5'>
      {enchantments.map(enchantment => {
        const rest = joinParts(...enchantmentParts(enchantment))
        return (
          <li
            key={enchantment.id}
            className='flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs'
          >
            <Sparkles aria-hidden className='size-3.5 shrink-0 text-primary' />
            <span className='min-w-0 flex-1'>
              <span className='font-semibold'>{enchantment.name}</span>
              {rest && <span className='text-text-secondary'> · {rest}</span>}
            </span>
            {enchantment.endable && (
              <EndButton
                item={item}
                itemName={itemName}
                enchantment={enchantment}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * A button that ends an enchantment on one of the character's items, once the player says so, as
 * dnd5e's chat card ends it: the enchantment alone, with what it added to the item, such as an
 * attack, its caster's concentration going on. Nothing while the game doesn't take it.
 */
export function EndButton({
  item,
  itemName,
  enchantment,
  source,
  className = 'shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold transition-colors hover:bg-primary/5',
}: Readonly<{
  item: string
  itemName: string
  enchantment: Pick<SheetEnchantment, 'id' | 'name'>
  /** The enchant activity it's ended from, if any. */
  source?: AttackSource
  className?: string
}>) {
  const { end } = useEnchanting()
  const { game } = seatWords(useTableRole())
  if (!end) return
  return (
    <ConfirmDialog
      trigger='End'
      triggerLabel={`End ${enchantment.name} on ${itemName}`}
      triggerClassName={className}
      title={`End ${enchantment.name}?`}
      confirmLabel='End'
      cancelLabel='Keep'
      onConfirm={async () => {
        end(item, enchantment, source)
      }}
    >
      <p>
        On {itemName}. Only the enchantment ends, as from its card in {game};
        what it added to the item, such as an attack, goes with it. Any
        concentration on it goes on.
      </p>
    </ConfirmDialog>
  )
}
