'use client'

import { use } from 'react'
import clsx from 'clsx'
import { PLAIN } from './constants'
import { WildShapeContext } from './context'
import { FormFace } from './form-face'
import { managerLineWords, swapWords } from '@/utils/wild-shape-words'

/**
 * The Known forms manager (round 0.40.0 §5.8): what the druid knows of how many, each known form
 * with Replace… where a replacement is free, each empty place with Learn a form…, and when a
 * replacement comes.
 */
export function KnownForms() {
  const ws = use(WildShapeContext)
  const { block, form, name } = ws
  if (!block) return
  const empty = Math.max(0, block.limits.count - block.known.length)
  const swap = swapWords(block, name)
  return (
    <>
      <p className='text-sm'>{managerLineWords(block, name)}</p>
      <ul className='grid gap-2 md:grid-cols-2'>
        {block.known.map(known => {
          const now = known.id === form?.profile
          return (
            <li
              key={known.id}
              className='flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3'
            >
              <FormFace
                known={known}
                acFloor={block.acFloor}
                now={now}
                nameFocus
              />
              {block.swap && !now && (
                <button
                  type='button'
                  aria-label={`Replace ${known.name}`}
                  data-ws-focus={`replace:${known.id}`}
                  onClick={() => ws.showLearn(`replace:${known.id}`, known)}
                  className={clsx(PLAIN, 'self-start')}
                >
                  Replace…
                </button>
              )}
            </li>
          )
        })}
        {Array.from({ length: empty }, (_, index) => (
          <li
            key={`empty-${index}`}
            className='flex flex-col gap-2 rounded-xl border border-dashed border-border p-3'
          >
            <span className='text-sm text-text-secondary'>An empty place</span>
            <button
              type='button'
              data-ws-focus={`learn:${index}`}
              onClick={() => ws.showLearn(`learn:${index}`)}
              className={clsx(PLAIN, 'self-start')}
            >
              Learn a form…
            </button>
          </li>
        ))}
      </ul>
      {swap && <p className='text-sm text-text-secondary'>{swap}</p>}
    </>
  )
}
