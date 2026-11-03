import clsx from 'clsx'
import { bubble } from './utils'
import type { TableMessage } from '@/types/table'

/**
 * A text message's body: its label over its text, where it has both, in a bubble; nothing of its
 * own for a roll request card, whose ask says what it is.
 */
export function TextBody({
  message,
  mine,
}: Readonly<{ message: TableMessage; mine: boolean }>) {
  const { label, text, whisper } = message
  if (message.ask) return
  return (
    <>
      {label && text && (
        <span className='text-xs font-semibold text-text-secondary'>
          {label}
        </span>
      )}
      {(text ?? label) && (
        <p
          className={clsx(
            bubble(whisper, mine),
            'break-words whitespace-pre-wrap',
          )}
        >
          {text ?? label}
        </p>
      )}
    </>
  )
}
