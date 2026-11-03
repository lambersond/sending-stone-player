import clsx from 'clsx'
import { BellRing } from 'lucide-react'
import { article, bubble } from './utils'
import { ASK_CHIPS, askTitle } from '@/utils/ask-words'
import type { TableAsk } from '@/types/table'

/**
 * A roll request card: who asks the table for which saving throw or check, with its DC where
 * players may see it, and what asks for it, such as the asker's item. It's for the Gamemaster, who
 * rolls it for the creatures it names.
 */
export function AskBubble({
  ask,
  speaker,
  whisper,
  mine,
}: Readonly<{
  ask: TableAsk
  speaker: string
  whisper: boolean
  mine: boolean
}>) {
  const title = askTitle(ask)
  return (
    <div
      className={clsx(
        bubble(whisper, mine),
        'flex flex-col gap-1.5 border-l-4 border-l-primary',
      )}
    >
      {/* The sentence below says what it is; the chip only marks it, for the eye. */}
      <span
        aria-hidden
        className='inline-flex w-fit items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary-text uppercase'
      >
        <BellRing className='size-3' />
        {ASK_CHIPS[ask.type]}
      </span>
      <p className='font-semibold break-words'>
        {speaker} asks for {article(title)} {title}
      </p>
      {ask.label && (
        <p className='text-xs break-words text-text-secondary'>
          <span className='sr-only'>From </span>
          {ask.label}
        </p>
      )}
    </div>
  )
}
