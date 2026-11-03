'use client'

import { CookingPot, UserRound } from 'lucide-react'
import { EmptyState } from '@/components/empty-state/empty-state'
import { Scroller } from '@/components/scroller/scroller'
import { CONFIGURE_COOKBOOK } from '@/features/cookbook/constants'
import { JournalCard } from '@/features/notes/components/journal-card/journal-card'
import { PartySheetList } from '@/features/sheet/components/party-sheets/party-sheet-list'
import { tooLargeLine } from '@/features/table/utils/header'
import type { NotesPlace } from '@/features/notes/types'
import type { CookbookPlace } from '@/types/cookbook'
import type { TableGroup } from '@/types/party'
import type { SeatWords } from '@/types/seats'
import type { TableView } from '@/types/table'
import type { ReactNode } from 'react'

/**
 * The character's pane while it has no sheet: why, and what needs none, the party sheets it may
 * open, its journal and the Magical Recipe Book.
 * @param parties - The party sheets it may open, where there are any.
 * @param playing - Whether the character plays one of its campaign's characters, with a journal.
 * @param cookbook - Where the Magical Recipe Book is offered: the player's own seat alone.
 * @param entry - The Magical Recipe Book's button and dialog, as `useCookbookEntry` has them.
 */
export function NoSheet({
  name,
  withheld,
  words,
  parties,
  onOpenParty,
  playing,
  notes,
  cookbook,
  entry,
}: Readonly<{
  name: string
  withheld?: TableView['sheetWithheld']
  words: SeatWords
  parties?: TableGroup[]
  onOpenParty: (id: string) => void
  playing: boolean
  notes: NotesPlace
  cookbook?: CookbookPlace
  entry: { shown: boolean; open: () => void; modal: ReactNode }
}>) {
  return (
    <Scroller>
      <WhyNoSheet
        name={name}
        withheld={withheld}
        told={words.told}
        coming={words.noSheet}
      />
      {parties && (
        <div className='mx-auto w-full max-w-md px-4 pb-8'>
          <PartySheetList groups={parties} onOpen={onOpenParty} />
        </div>
      )}
      {/* The journal, which needs no sheet, nor Foundry. */}
      {playing && (
        <div className='mx-auto w-full max-w-2xl px-4 pb-8'>
          <JournalCard kind='personal' look='sheet' {...notes} />
        </div>
      )}
      {/* The Magical Recipe Book, which needs no sheet either: offered as the cog offers it
          (round 0.39.0). */}
      {cookbook && entry.shown && (
        <div className='mx-auto w-full max-w-2xl px-4 pb-8'>
          <button
            type='button'
            aria-haspopup='dialog'
            onClick={entry.open}
            className='inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
          >
            <CookingPot aria-hidden className='size-4 shrink-0' />
            {CONFIGURE_COOKBOOK}
          </button>
        </div>
      )}
      {entry.modal}
    </Scroller>
  )
}

/**
 * For a character whose sheet hasn't arrived, as under a system other than dnd5e; or from module
 * 0.22.0, one the module held back for being larger than this app takes, which its Gamemaster has
 * been told.
 */
function WhyNoSheet({
  name,
  withheld,
  told,
  coming,
}: Readonly<{
  name: string
  withheld?: TableView['sheetWithheld']
  /** Who was told it was held back. */
  told: string
  /** How a sheet comes. */
  coming: string
}>) {
  if (withheld?.reason === 'tooLarge') {
    return (
      <EmptyState
        icon={UserRound}
        title={`${name}'s sheet is too large to send`}
      >
        {tooLargeLine(withheld)}
        {told}
      </EmptyState>
    )
  }
  return (
    <EmptyState icon={UserRound} title={`${name}'s sheet hasn't arrived`}>
      {coming}
    </EmptyState>
  )
}
