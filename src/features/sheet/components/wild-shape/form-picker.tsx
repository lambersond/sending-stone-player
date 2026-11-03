'use client'

import { use, type RefObject } from 'react'
import clsx from 'clsx'
import { PLAIN } from './constants'
import { WildShapeContext } from './context'
import { FormFace } from './form-face'
import { arrows, cardName } from './utils'
import {
  chipWords,
  knownCountWords,
  noFormsWords,
} from '@/utils/wild-shape-words'

/**
 * The form picker (round 0.40.0 §5.3): what a change gives, the known forms as radios, those not
 * offered skipped by the arrows, and the count with Known forms…; or, where the druid knows none,
 * Choose forms….
 */
export function FormPicker({
  first,
}: Readonly<{ first: RefObject<HTMLElement | null> }>) {
  const ws = use(WildShapeContext)
  const { block, form, name } = ws
  if (!block) return
  const ids = ws.offered.map(({ id }) => id)
  if (block.known.length === 0) {
    return (
      <div className='flex flex-col items-start gap-3'>
        <p className='text-sm'>{noFormsWords(name)}</p>
        <button
          ref={first as RefObject<HTMLButtonElement | null>}
          type='button'
          data-ws-focus='choose'
          onClick={() => ws.showKnown('choose')}
          className={PLAIN}
        >
          Choose forms…
        </button>
      </div>
    )
  }
  return (
    <>
      <ul aria-label='What happens' className='flex flex-wrap gap-1.5'>
        {chipWords(block).map(chip => (
          <li
            key={chip}
            className='rounded-full bg-page px-2.5 py-1 text-xs text-text-secondary'
          >
            {chip}
          </li>
        ))}
      </ul>
      <div
        role='radiogroup'
        aria-label='Known forms'
        onKeyDown={event =>
          arrows(event, ids, ws.checked, ws.pick, 'data-ws-card')
        }
        className='grid gap-2 md:grid-cols-2'
      >
        {block.known.map(known => {
          const now = known.id === form?.profile
          const offered = ids.includes(known.id)
          const checked = offered && known.id === ws.checked
          return (
            <button
              key={known.id}
              ref={
                checked
                  ? (first as RefObject<HTMLButtonElement | null>)
                  : undefined
              }
              type='button'
              role='radio'
              aria-checked={checked}
              aria-disabled={!offered || undefined}
              aria-label={cardName(known, block.acFloor, now)}
              tabIndex={checked ? 0 : -1}
              data-ws-card={known.id}
              onClick={() => ws.pick(known.id)}
              className={clsx(
                'flex min-h-11 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors',
                checked
                  ? 'border-wild bg-wild-bg/60 ring-1 ring-wild'
                  : 'border-border bg-card',
                offered ? 'hover:border-wild/50' : 'cursor-not-allowed',
              )}
            >
              <FormFace known={known} acFloor={block.acFloor} now={now} />
            </button>
          )
        })}
      </div>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-text-secondary'>
          {knownCountWords(block.known.length, block.limits.count)}
        </p>
        <button
          type='button'
          data-ws-focus='known'
          onClick={() => ws.showKnown('known')}
          className='inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-wild hover:bg-wild/10 sm:min-h-9'
        >
          Known forms…
        </button>
      </div>
    </>
  )
}
