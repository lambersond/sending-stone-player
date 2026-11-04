import clsx from 'clsx'
import { Lock } from 'lucide-react'
import { AskBubble } from './ask-bubble'
import { RollBody } from './roll-body'
import { Targets } from './targets'
import { TextBody } from './text-body'
import { UsedBody } from './used-body'
import { LocalTime } from '@/components/local-time/local-time'
import { useImageFallback } from '@/hooks/use-image-fallback'
import { useTableRole } from '@/hooks/use-table-api'
import { initials } from '@/utils/initials'
import type { Side, TableMessage } from '@/types/table'

const AVATAR: Record<Side, string> = {
  me: 'bg-primary text-on-primary',
  party: 'bg-party/15 text-party',
  other: 'bg-whisper/15 text-whisper',
}

/** Each kind of message's body: text, a card of an item or ability used, or rolls. */
const BODIES = {
  text: TextBody,
  card: UsedBody,
  roll: RollBody,
} satisfies Record<TableMessage['kind'], unknown>

/**
 * One message in the chat: who said it, as their portrait or initials, with its time, the GM's
 * mark and a whisper's; a roll request card's ask; its body by its kind; a note under damage made
 * on its own; and who a text was aimed at.
 */
export function ChatMessage({ message }: Readonly<{ message: TableMessage }>) {
  const { speaker, side, whisper, kind, targets, summary } = message
  // The player's own messages sit on the other side, as in a messaging app.
  const mine = side === 'me'
  const gm = useTableRole() === 'gm'
  const Body = BODIES[kind]
  return (
    <article
      data-side={side}
      className={clsx('flex items-start gap-2.5', mine && 'flex-row-reverse')}
    >
      <SpeakerAvatar
        name={speaker}
        src={message.avatar}
        className={AVATAR[side]}
      />
      <div
        className={clsx(
          'flex max-w-[85%] min-w-0 flex-1 flex-col gap-1.5',
          mine ? 'items-end' : 'items-start',
        )}
      >
        <header
          className={clsx(
            'flex flex-wrap items-baseline gap-x-2 gap-y-0.5',
            mine && 'flex-row-reverse',
          )}
        >
          <span className='font-semibold'>{speaker}</span>
          {/* Made for the Gamemaster's roll as the character (#156), as this app knows it. */}
          {message.byGm && (
            <span
              title='Rolled by the Gamemaster'
              className='shrink-0 rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary-text'
            >
              GM<span className='sr-only'>, rolled by the Gamemaster</span>
            </span>
          )}
          {whisper && (
            <span className='inline-flex items-center gap-1 text-[11px] font-semibold text-whisper'>
              <Lock aria-hidden className='size-3' />
              Whisper
            </span>
          )}
          <LocalTime
            value={message.sentAt}
            className='text-xs text-text-secondary'
          />
        </header>
        {message.ask && (
          <AskBubble
            ask={message.ask}
            speaker={speaker}
            whisper={whisper}
            mine={mine}
          />
        )}
        <Body message={message} mine={mine} />
        {/* Damage or healing made on its own, from module 0.36.0, which applies nothing by itself.
            Only under a damage card, as anyone in Foundry may mark a message of theirs so. */}
        {message.alone && (message.damage?.length ?? 0) > 0 && (
          <p
            className={clsx('text-xs text-text-secondary', mine && 'self-end')}
          >
            {gm
              ? 'On its own, for you to apply'
              : 'On its own, for the Gamemaster to apply'}
          </p>
        )}
        {kind === 'text' && targets.length > 0 && (
          <div className={clsx(mine && 'self-end')}>
            <Targets targets={targets} summary={summary} />
          </div>
        )}
      </div>
    </article>
  )
}

/** The speaker's portrait, or their initials when they have none or it won't load. */
function SpeakerAvatar({
  name,
  src,
  className,
}: Readonly<{ name: string; src?: string; className: string }>) {
  const { shown, ref, onError } = useImageFallback(src)
  const box = 'size-9 shrink-0 rounded-[10px]'
  if (shown) {
    return (
      // A portrait from the Gamemaster's game, which Next's image optimizer doesn't know.
      // eslint-disable-next-line @next/next/no-img-element -- a portrait Next can't optimize
      <img
        ref={ref}
        src={src}
        alt=''
        className={clsx(box, 'border border-border object-cover object-top')}
        onError={onError}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={clsx(
        box,
        'flex items-center justify-center text-xs font-bold',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
