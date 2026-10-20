'use client'

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import clsx from 'clsx'
import { Timer } from 'lucide-react'
import { DiceKeypad, type DiceKey } from './dice-keypad'
import { DieIcon } from '@/components/icons/die'
import { Modal } from '@/components/modal/modal'
import { useMediaQuery } from '@/hooks/use-media-query'
import { faceComplete, faceOf, facePrefix, faceRule } from '@/utils/faces'
import type { DiceEntry, DiceEntrySides } from '@/types/dice-entry'

/** A phone held sideways, or any screen as short: the dice beside the keypad, not above it. */
const SHORT = '(max-height: 30rem)'

/** The whole seconds from one moment until another, none once it's come. */
function secondsLeft(at: number, now: number): number {
  return Math.max(0, Math.ceil((at - now) / 1000))
}

/**
 * The whole seconds left until a moment, by this page's clock, ticking down each second until it
 * comes, at none: as the prompt banner counts down what the game asks.
 */
function useSecondsLeft(until: string): number {
  const at = Date.parse(until)
  const [now, setNow] = useState(() => Date.now())
  const left = secondsLeft(at, now)
  useEffect(() => {
    if (left <= 0) return
    // Checked often, to turn with the clock's seconds, but drawn again only as it does.
    const timer = setInterval(() => {
      const moment = Date.now()
      setNow(seen =>
        secondsLeft(at, moment) === secondsLeft(at, seen) ? seen : moment,
      )
    }, 200)
    return () => clearInterval(timer)
  }, [at, left])
  return left
}

/** Such as "0:42". */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * How long is left to answer what the game asks, ticking each second, and closing the dialog once
 * it's up. A timer, not read out each second as it changes.
 */
function Countdown({
  until,
  onOut,
}: Readonly<{ until: string; onOut: () => void }>) {
  const left = useSecondsLeft(until)
  const out = left <= 0
  const end = useEffectEvent(onOut)
  useEffect(() => {
    if (out) end()
  }, [out])
  return (
    <p
      role='timer'
      className='flex items-center gap-1.5 text-sm text-text-secondary'
    >
      <Timer aria-hidden className='size-4 shrink-0' />
      <span className='tabular-nums'>{clock(left)} left to answer</span>
    </p>
  )
}

/**
 * What a box holds once a key is typed into it: a digit, or a percentile die's 00, added on; or,
 * where it already holds a face no digit more could change, or is full, the box started again.
 */
function typed(text: string, key: string, sides: DiceEntrySides): string {
  return faceComplete(text, sides) || text.length + key.length > 3
    ? key
    : text + key
}

/** Of what's typed or pasted, its digits only, as many as a box holds. */
function digitsOf(text: string): string {
  return text.replaceAll(/[^0-9]/g, '').slice(0, 3)
}

/** Each term's share of what's kept for every box in turn. */
function byTerm<T>(entry: DiceEntry, each: T[]): T[][] {
  let start = 0
  return entry.terms.map(({ count }) => {
    start += count
    return each.slice(start - count, start)
  })
}

const BUTTON = 'rounded-xl px-4 text-sm transition-colors'

/**
 * One roll's dice, a box each, typed into by the dialog's keypad or a keyboard, the total as it
 * will be kept, and Done. It's made again for each roll, every box empty.
 */
function Entry({
  entry,
  form,
  onDone,
  onCancel,
}: Readonly<{
  entry: DiceEntry
  form: RefObject<HTMLFormElement | null>
  onDone: (values: number[][]) => void
  onCancel: () => void
}>) {
  const ids = useId()
  const compact = useMediaQuery(SHORT)
  // Every die's box in turn, term by term: its place in its term, and its die.
  const boxes = entry.terms.flatMap(({ sides, count }) =>
    Array.from({ length: count }, (_, box) => ({ box, sides })),
  )
  const last = boxes.length - 1
  const [texts, setTexts] = useState<readonly string[]>(() =>
    boxes.map(() => ''),
  )
  // The box typed into, by the keypad too: the one last focused, or moved on to.
  const [current, setCurrent] = useState(0)
  // Those Done found without a face, until each is typed into again.
  const [marked, setMarked] = useState<ReadonlySet<number>>(() => new Set())
  const [tried, setTried] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const keys = useRef<HTMLDivElement>(null)
  const done = useRef<HTMLButtonElement>(null)

  // Closed by itself, once: its time running out, or what it answers answered or closed elsewhere.
  const ended = useRef(false)
  const end = () => {
    if (ended.current) return
    ended.current = true
    onCancel()
  }
  const aborted = useEffectEvent(end)
  useEffect(() => {
    const { signal } = entry
    if (!signal) return
    if (signal.aborted) {
      aborted()
      return
    }
    const closed = () => aborted()
    signal.addEventListener('abort', closed, { once: true })
    return () => signal.removeEventListener('abort', closed)
  }, [entry])

  // A frame after it opens, as the dialog is shown only after its content is drawn, and a menu or
  // dialog closing as this opens may hand focus back to what opened it, behind this one. The
  // browser's own focus, on the dialog's first button as it's shown, is no reason to leave it.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (form.current?.contains(document.activeElement)) return
      inputs.current[0]?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [entry, form])

  /** Focus a box, clear of the keypad kept over the dice as they scroll. */
  const focusBox = (index: number) => {
    const input = inputs.current[index]
    if (!input) return
    input.focus()
    const scroller = form.current?.parentElement
    if (compact || !scroller || !keys.current) return
    const hidden =
      input.getBoundingClientRect().bottom +
      8 -
      keys.current.getBoundingClientRect().top
    if (hidden > 0) scroller.scrollTop += hidden
  }

  const inBox = () =>
    inputs.current.some(input => input && input === document.activeElement)

  /**
   * On to the next die: the next box, the next term's first after a term's last, or from the last
   * to Done. Focus goes along only where a box had it, so a keyboard on the keypad stays there.
   */
  const moveOn = (index: number) => {
    const focused = inBox()
    if (index < last) {
      setCurrent(index + 1)
      if (focused) focusBox(index + 1)
    } else if (focused) done.current?.focus()
  }

  /**
   * A box's text changed; where it's grown into a face no digit more could change, on to the next.
   */
  const put = (index: number, text: string, grown = true) => {
    setTexts(held => held.map((each, at) => (at === index ? text : each)))
    setMarked(held => {
      if (!held.has(index)) return held
      const left = new Set(held)
      left.delete(index)
      return left
    })
    if (grown && faceComplete(text, boxes[index].sides)) moveOn(index)
  }

  const faces = boxes.map(({ sides }, index) => faceOf(texts[index], sides))

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const missing = faces.flatMap((face, index) =>
      face === undefined ? [index] : [],
    )
    if (missing.length === 0) {
      onDone(byTerm(entry, faces as number[]))
      return
    }
    setMarked(new Set(missing))
    setTried(true)
    setCurrent(missing[0])
    focusBox(missing[0])
  }

  /** The keypad's keys, typed into the current box, wherever focus is. */
  const press = (key: DiceKey) => {
    if (!boxes[current]) return
    if (key === 'next') moveOn(current)
    else if (key === 'delete') put(current, texts[current].slice(0, -1), false)
    else put(current, typed(texts[current], key, boxes[current].sides))
  }

  /** A keyboard's keys, typed as the keypad's are; anything else typed dropped. */
  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.nativeEvent.isComposing) return
    const { key } = event
    if (/^[0-9]$/.test(key)) {
      put(index, typed(texts[index], key, boxes[index].sides))
    } else if (key === 'Backspace' || key === 'Delete') {
      put(index, texts[index].slice(0, -1), false)
    } else if (key === 'Enter') {
      if (index === last) submit()
      else moveOn(index)
    } else if (key.length !== 1) return
    event.preventDefault()
  }

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const digits = digitsOf(event.clipboardData.getData('text'))
    if (digits) put(index, digits)
  }

  // A box's text that can't become one of its die's faces, as typed or as Done found it.
  const ruled = boxes.map(({ sides }, index) => {
    const text = texts[index]
    if (text === '' || faces[index] !== undefined) return false
    return marked.has(index) || !facePrefix(text, sides)
  })
  const notice = tried && faces.includes(undefined)
  const total = entry.total(byTerm(entry, faces))

  // Where each term's boxes start, among every box in turn.
  const starts = entry.terms.map((_, at) =>
    entry.terms.slice(0, at).reduce((sum, { count }) => sum + count, 0),
  )

  return (
    <form
      ref={form}
      noValidate
      onSubmit={submit}
      className={clsx(
        'grid',
        compact ? 'grid-cols-2 items-start gap-x-5' : 'gap-4',
      )}
    >
      <div className='grid gap-4'>
        {entry.until && <Countdown until={entry.until} onOut={end} />}
        {entry.terms.map((term, termAt) => {
          const heading = `${ids}-${termAt}`
          const error = `${heading}-error`
          const first = starts[termAt]
          const own = boxes.slice(first, first + term.count)
          return (
            <div
              key={heading}
              role='group'
              aria-labelledby={heading}
              className='grid gap-2'
            >
              <h3
                id={heading}
                className='flex items-center gap-1.5 text-sm font-medium'
              >
                {term.sides !== 100 && (
                  <DieIcon
                    sides={term.sides}
                    className='size-4 shrink-0 text-text-secondary'
                  />
                )}
                {term.label}
              </h3>
              <div className='flex flex-wrap gap-2'>
                {own.map(({ box }) => {
                  const at = first + box
                  const invalid = ruled[at] || marked.has(at)
                  let describedBy
                  if (ruled[at]) describedBy = error
                  else if (marked.has(at)) describedBy = `${ids}-notice`
                  return (
                    <input
                      key={box}
                      ref={input => {
                        inputs.current[at] = input
                      }}
                      type='text'
                      inputMode='none'
                      autoComplete='off'
                      maxLength={3}
                      autoFocus={at === 0}
                      aria-label={
                        term.count === 1
                          ? `d${term.sides}`
                          : `d${term.sides} ${box + 1} of ${term.count}`
                      }
                      aria-current={at === current ? 'true' : undefined}
                      aria-invalid={invalid || undefined}
                      aria-describedby={describedBy}
                      value={texts[at]}
                      onFocus={() => setCurrent(at)}
                      onKeyDown={event => onKeyDown(at, event)}
                      onPaste={event => onPaste(at, event)}
                      // What a keyboard's keys didn't type, such as a word chosen as it's
                      // composed: its digits only.
                      onChange={event => put(at, digitsOf(event.target.value))}
                      className={clsx(
                        'h-11 w-12 rounded-xl border bg-page text-center text-base tabular-nums outline-none',
                        invalid ? 'border-danger' : 'border-border',
                        at === current && 'ring-2 ring-primary',
                      )}
                    />
                  )
                })}
              </div>
              {own.some((_, offset) => ruled[first + offset]) && (
                <p id={error} role='alert' className='text-sm text-danger'>
                  {faceRule(term.sides)}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div
        ref={keys}
        // Kept in view as the dice scroll, below them or, on a short screen, beside them; over the
        // scroller's own padding, which a sticky block otherwise leaves a strip of dice showing in.
        className={clsx(
          'sticky grid bg-card',
          compact
            ? '-top-5 -mt-5 gap-2 pt-5'
            : '-bottom-5 -mx-5 -mb-5 gap-3 border-t border-border px-5 pt-3 pb-5',
        )}
      >
        <output
          aria-live='polite'
          className='text-lg font-semibold tabular-nums'
        >
          Total {total}
        </output>
        <DiceKeypad
          onKey={press}
          d100={boxes[current]?.sides === 100}
          compact={compact}
        />
        {notice && (
          <p id={`${ids}-notice`} role='alert' className='text-sm text-danger'>
            Type in every die first.
          </p>
        )}
        <div className='flex flex-wrap justify-end gap-2'>
          <button
            type='button'
            onClick={onCancel}
            className={clsx(
              BUTTON,
              compact ? 'h-9' : 'h-10',
              'border border-border font-medium hover:border-primary/50 hover:bg-primary/5',
            )}
          >
            Cancel
          </button>
          <button
            ref={done}
            type='submit'
            className={clsx(
              BUTTON,
              compact ? 'h-9' : 'h-10',
              'bg-primary font-semibold text-on-primary hover:bg-primary-hover',
            )}
          >
            Done
          </button>
        </div>
      </div>
    </form>
  )
}

/**
 * Asks the player for a roll's dice, typed in from their own physical dice (module 0.32.0): a box
 * for every die, each checked against its die's faces, a keypad of its own so the phone's keyboard
 * never opens, and the total as it will be kept. For an answer to what the game asks, it shows the
 * time left and closes itself once it's up, or once it's answered elsewhere.
 */
export function DiceEntryDialog({
  entry,
  onDone,
  onCancel,
}: Readonly<{
  /** The dice to type in; closed while unset. */
  entry?: DiceEntry
  /** Every die typed, term by term, box by box, each one of its die's faces. */
  onDone: (values: number[][]) => void
  /**
   * Closed without them: Cancel, Close, Escape, the backdrop, the time running out, or its signal.
   */
  onCancel: () => void
}>): ReactNode {
  // Each roll asked for is a new one, every box empty, even where the dialog stays open for the
  // next roll as the last closes.
  const [seen, setSeen] = useState<{ entry?: DiceEntry; roll: number }>({
    roll: 0,
  })
  if (seen.entry !== entry) setSeen({ entry, roll: seen.roll + 1 })
  // The dialog element, shown again only by a new one where the browser closed it itself, on
  // Escape, while the next roll asked for keeps it open.
  const [shown, setShown] = useState(0)
  const form = useRef<HTMLFormElement>(null)

  return (
    <Modal
      key={shown}
      open={entry !== undefined}
      onClose={() => {
        if (form.current?.closest('dialog')?.open === false) {
          setShown(count => count + 1)
        }
        // Not when closed for having nothing to ask, its roll done or cancelled already.
        if (entry) onCancel()
      }}
      title={entry?.title ?? ''}
      subtitle='Type in what your dice show'
      fullOnPhone
    >
      {entry && (
        <Entry
          key={seen.roll}
          entry={entry}
          form={form}
          onDone={onDone}
          onCancel={onCancel}
        />
      )}
    </Modal>
  )
}
