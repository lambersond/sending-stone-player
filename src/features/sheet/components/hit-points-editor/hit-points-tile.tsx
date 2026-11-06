'use client'

import { useId, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useCharging } from '../charging/use-charging'
import { HitPoints } from '../sheet-tiles/hit-points'
import { Spinner } from '../wild-shape/spinner'
import { HitPointsMenu } from './hit-points-menu'
import { tileName } from './utils'
import type { HitPointsNow } from '@/types/sending-stone'

/** What the tile says while a change sent waits for the game to show it. */
const WAITING = 'Waiting for the game'

/**
 * The Hit points tile's number, over its bar (module 0.44.0): where the game takes hit points set
 * from here, a button that opens the editor below it, a pencil at its corner, named for the
 * numbers and what it does; once a change is sent, until the sheet shows it, a spinner in the
 * pencil's place and "Waiting for the game", which the button is described by, and does nothing
 * meanwhile. Where the game doesn't take them, the number alone, as before. The editor closes for
 * good should the game stop taking them while it's open.
 */
export function HitPointsTile({ hp }: Readonly<{ hp: HitPointsNow }>) {
  const { hitPoints: save, hitPointsWaiting: waiting = false } = useCharging()
  const [anchor, setAnchor] = useState<HTMLElement>()
  const waitingId = useId()
  if (!save && anchor) setAnchor(undefined)
  if (!save) return <HitPoints hp={hp} />
  return (
    <>
      <button
        type='button'
        aria-label={tileName(hp)}
        aria-haspopup='dialog'
        aria-expanded={anchor !== undefined}
        aria-disabled={waiting || undefined}
        aria-describedby={waiting ? waitingId : undefined}
        onClick={event => {
          if (waiting) return
          setAnchor(anchor ? undefined : event.currentTarget)
        }}
        className='relative -mx-1.5 flex h-full min-h-11 w-[calc(100%+0.75rem)] flex-col gap-0.5 rounded-lg px-1.5 py-1 pr-6 text-left transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 active:bg-primary/10 aria-expanded:bg-primary/10 aria-disabled:cursor-progress'
      >
        <span className='flex min-h-0 flex-1 flex-col'>
          <HitPoints hp={hp} />
        </span>
        {waiting && (
          <span
            id={waitingId}
            className='text-xs font-normal text-text-secondary'
          >
            {WAITING}
          </span>
        )}
        <span className='absolute top-1 right-1 text-text-secondary'>
          {waiting ? <Spinner /> : <Pencil aria-hidden className='size-3.5' />}
        </span>
      </button>
      {anchor && (
        <HitPointsMenu
          anchor={anchor}
          hp={hp}
          onSave={change => {
            setAnchor(undefined)
            save(change)
          }}
          onClose={() => setAnchor(undefined)}
        />
      )}
    </>
  )
}
