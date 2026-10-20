import { PanelRightOpen, Users } from 'lucide-react'
import { EntryIcon } from './sheet-entry'
import { SheetHeading } from './sheet-heading'
import type { TableGroup } from '@/types/party'

/** The party sheets a seat at the character's sheet may open, and how one is opened. */
export type PartySheets = {
  groups: TableGroup[]
  /** Opens a group's sheet in its side panel, by its id. */
  onOpen: (group: string) => void
}

/**
 * The party sheets the seat may open (module 0.30.0), on the Inventory tab, beside what's moved to
 * them: a row each, the primary party first, that opens its sheet in its side panel over the
 * character's. Nothing without any.
 */
export function PartySheetList({ groups, onOpen }: Readonly<PartySheets>) {
  if (groups.length === 0) return
  const sorted = groups.toSorted(
    (a, b) => Number(b.primary) - Number(a.primary),
  )
  return (
    <section
      aria-labelledby='inventory-parties'
      className='flex flex-col gap-2'
    >
      <SheetHeading id='inventory-parties'>
        {groups.length === 1 ? 'Party' : 'Parties'}
      </SheetHeading>
      <ul className='rounded-2xl border border-border bg-card p-1.5'>
        {sorted.map(group => (
          <li key={group.id}>
            <button
              type='button'
              aria-label={`Party: ${group.name}`}
              onClick={() => onOpen(group.id)}
              className='flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-primary/5'
            >
              <EntryIcon src={group.portrait} fallback={Users} />
              <span className='min-w-0 flex-1'>
                <span className='block truncate font-medium'>{group.name}</span>
                <span className='block truncate text-xs text-text-secondary'>
                  {group.primary ? 'Primary party' : 'Party sheet'}
                </span>
              </span>
              <PanelRightOpen
                aria-hidden
                className='size-4 shrink-0 text-text-secondary'
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
