'use client'

import { use, useState } from 'react'
import { BeastCard } from './beast-card'
import { PLAIN } from './constants'
import { WildShapeContext } from './context'
import { Spinner } from './spinner'
import { arrows, beastsFailedWords } from './utils'
import { SearchField } from '@/components/search-field/search-field'
import { matchesSearch } from '@/utils/search'
import { beastCountWords } from '@/utils/wild-shape-words'

/**
 * The Beasts to learn (round 0.40.0 §5.8), as the game lists them now, from the campaign's
 * compendiums: "Finding Beasts…" while it does, why not and Try again where it couldn't; then a
 * search, their count, and each as a radio, those known already not offered.
 */
export function BeastList() {
  const ws = use(WildShapeContext)
  const [query, setQuery] = useState('')
  const { beasts } = ws
  if (!beasts || beasts.status === 'loading') {
    return (
      <p
        role='status'
        className='flex items-center gap-2 text-sm text-text-secondary'
      >
        <Spinner />
        Finding Beasts…
      </p>
    )
  }
  if (beasts.status === 'failed') {
    return (
      <div className='flex flex-col items-start gap-3'>
        <p role='alert' className='text-sm text-warning'>
          {beastsFailedWords(ws.role, beasts.reason)}
        </p>
        <button type='button' onClick={ws.loadBeasts} className={PLAIN}>
          Try again
        </button>
      </div>
    )
  }
  const shown = beasts.forms.filter(each => matchesSearch([each.name], query))
  const ids = shown.filter(each => !each.known).map(({ uuid }) => uuid)
  const chosen = ids.includes(ws.beast ?? '') ? ws.beast : undefined
  // The first offered takes the group's tab stop while none is chosen.
  const stop = chosen ?? ids[0]
  return (
    <>
      <SearchField
        value={query}
        onChange={setQuery}
        label='Search Beasts'
        placeholder='Search Beasts'
      />
      {/* Read where it stands, never announced (round 0.40.0 §9.5): this view's live words are
          its "Finding Beasts…" and its refusals alone. */}
      <p className='text-sm text-text-secondary'>
        {beastCountWords(shown.length, beasts.forms.length, beasts.more)}
      </p>
      <div
        role='radiogroup'
        aria-label='Beasts'
        onKeyDown={event =>
          arrows(event, ids, chosen, ws.pickBeast, 'data-ws-beast')
        }
        className='grid gap-2 md:grid-cols-2'
      >
        {shown.map(each => (
          <BeastCard
            key={each.uuid}
            each={each}
            checked={each.uuid === chosen}
            stop={each.uuid === stop}
            onPick={ws.pickBeast}
          />
        ))}
      </div>
    </>
  )
}
