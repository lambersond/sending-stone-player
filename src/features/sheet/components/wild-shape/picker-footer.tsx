'use client'

import { use } from 'react'
import clsx from 'clsx'
import { PawPrint } from 'lucide-react'
import { SOLID } from './constants'
import { WildShapeContext } from './context'
import { Spinner } from './spinner'
import { reasonWords } from './utils'
import { articled } from '@/utils/wild-shape'
import {
  changeRefusedWords,
  NONE_OFFERED,
  usesNoteWords,
} from '@/utils/wild-shape-words'

/**
 * The picker's footer: the uses left, or why no card is offered, or why the last change wasn't
 * made; and Become {aForm}, "Changing…" while it's on its way, focus kept on it.
 */
export function PickerFooter() {
  const ws = use(WildShapeContext)
  const { block } = ws
  if (!block || block.known.length === 0) return
  const known = block.known.find(({ id }) => id === ws.checked)
  const changing = ws.waiting === 'transform'
  const refused = ws.refusal?.op === 'transform' ? ws.refusal : undefined
  const note = refused ? (
    <p role='alert' className='min-w-0 flex-1 text-sm text-warning'>
      {changeRefusedWords(
        ws.name,
        refused.key,
        reasonWords(ws.role, 'transform', refused.key),
      )}
    </p>
  ) : (
    <p className='min-w-0 flex-1 text-sm text-text-secondary'>
      {known ? usesNoteWords(block.uses) : NONE_OFFERED}
    </p>
  )
  const blocked = changing || !known
  return (
    <>
      {note}
      <button
        type='button'
        aria-disabled={blocked || undefined}
        onClick={() => {
          if (!blocked) ws.change()
        }}
        className={clsx(SOLID, 'ml-auto')}
      >
        {changing ? <Spinner /> : <PawPrint aria-hidden className='size-4' />}
        {changing && 'Changing…'}
        {!changing && (known ? `Become ${articled(known.name)}` : 'Become')}
      </button>
    </>
  )
}
