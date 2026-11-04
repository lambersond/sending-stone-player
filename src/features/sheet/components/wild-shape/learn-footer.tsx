'use client'

import { use } from 'react'
import clsx from 'clsx'
import { PawPrint } from 'lucide-react'
import { SOLID } from './constants'
import { WildShapeContext } from './context'
import { Spinner } from './spinner'
import { reasonWords } from './utils'
import { learnRefusedWords, learnWords } from '@/utils/wild-shape-words'
import type { KnownForm } from '@/types/sending-stone'

/** A Beast to learn's footer: why it wasn't learned, and Learn {aForm}, "Learning…" on its way. */
export function LearnFooter({ replace }: Readonly<{ replace?: KnownForm }>) {
  const ws = use(WildShapeContext)
  const { beasts } = ws
  const chosen =
    beasts?.status === 'done'
      ? beasts.forms.find(each => each.uuid === ws.beast && !each.known)
      : undefined
  const learning = ws.waiting === 'learn'
  const refused = ws.refusal?.op === 'learn' ? ws.refusal : undefined
  const blocked = learning || !chosen
  return (
    <>
      {refused && (
        <p role='alert' className='min-w-0 flex-1 text-sm text-warning'>
          {learnRefusedWords(
            ws.name,
            reasonWords(ws.role, 'learn', refused.key),
          )}
        </p>
      )}
      <button
        type='button'
        aria-disabled={blocked || undefined}
        onClick={() => {
          if (chosen && !learning) ws.learn(chosen, replace)
        }}
        className={clsx(SOLID, 'ml-auto')}
      >
        {learning ? <Spinner /> : <PawPrint aria-hidden className='size-4' />}
        {learning && 'Learning…'}
        {!learning &&
          (chosen ? learnWords(chosen.name, replace?.name) : 'Learn')}
      </button>
    </>
  )
}
