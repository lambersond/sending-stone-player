import clsx from 'clsx'
import { EyeOff, LoaderCircle, Send, TriangleAlert } from 'lucide-react'
import type { RollBrief } from '../../utils/tray-words'
import type { ReactNode } from 'react'

/**
 * A roll's, a use's or an ask's way to the game, in a line beneath it, as `tone` says where it is:
 * on its way, beside a spinner; made, beside the mark of being sent, or the hidden mark where the
 * game hid it (`hidden`); or not made, in the warning's colour. What it says (`children`) is the
 * caller's, as it is, in a span or not.
 */
export function StatusLine({
  tone,
  hidden = false,
  children,
}: Readonly<{
  tone: NonNullable<RollBrief['table']>['tone']
  hidden?: boolean
  children: ReactNode
}>) {
  return (
    <p
      className={clsx(
        'mt-1 flex items-center gap-1.5 text-xs',
        tone === 'not' ? 'text-warning' : 'text-text-secondary',
      )}
    >
      <StatusIcon tone={tone} hidden={hidden} />
      {children}
    </p>
  )
}

/** The line's icon, by where it's on its way: a spinner, the sent or hidden mark, a warning. */
function StatusIcon({
  tone,
  hidden,
}: Readonly<{
  tone: NonNullable<RollBrief['table']>['tone']
  hidden: boolean
}>) {
  if (tone === 'pending') {
    return (
      <LoaderCircle
        aria-hidden
        className='size-3.5 shrink-0 motion-safe:animate-spin'
      />
    )
  }
  if (tone === 'not') {
    return <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
  }
  if (hidden) return <EyeOff aria-hidden className='size-3.5 shrink-0' />
  return <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
}
