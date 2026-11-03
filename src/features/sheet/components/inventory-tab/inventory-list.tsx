'use client'

import { SheetHeading } from '../sheet-heading/sheet-heading'
import { ItemEntry } from './item-entry'
import type { ActionRows } from '../action-entry/types'
import type { SheetInventory } from '@/types/sending-stone'

/**
 * Items by type, then containers, each opening to what it holds; or that there are none. Given the
 * rows actions are in, what an item rolls is beside it; without them, as a party's stash is shown
 * (module 0.30.0), nothing in it rolls or is used.
 */
export function InventoryList({
  characterId,
  inventory,
  rows,
  idPrefix = 'inventory',
}: Readonly<{
  characterId: string
  inventory: SheetInventory
  rows?: ActionRows
  /**
   * What its sections' headings' ids start with, unique on the page: a party's stash, in its
   * panel over the character's Inventory, has its own.
   */
  idPrefix?: string
}>) {
  const empty =
    inventory.sections.length === 0 && inventory.containers.length === 0
  return (
    <>
      {inventory.sections.map(section => (
        <section
          key={section.id}
          aria-labelledby={`${idPrefix}-${section.id}`}
          className='flex flex-col gap-2'
        >
          <SheetHeading id={`${idPrefix}-${section.id}`}>
            {section.label}
          </SheetHeading>
          {/* A container, so that each row fits the list it's in. */}
          <ul className='@container rounded-2xl border border-border bg-card p-1.5'>
            {section.items.map(item => (
              <ItemEntry
                key={item.id}
                characterId={characterId}
                item={item}
                rows={rows}
              />
            ))}
          </ul>
        </section>
      ))}

      {inventory.containers.length > 0 && (
        <section
          aria-labelledby={`${idPrefix}-containers`}
          className='flex flex-col gap-2'
        >
          <SheetHeading id={`${idPrefix}-containers`}>Containers</SheetHeading>
          <ul className='@container rounded-2xl border border-border bg-card p-1.5'>
            {inventory.containers.map(container => (
              <ItemEntry
                key={container.id}
                characterId={characterId}
                item={container}
                rows={rows}
              />
            ))}
          </ul>
        </section>
      )}

      {empty && (
        <p className='text-sm text-text-secondary'>No items to show yet.</p>
      )}
    </>
  )
}
