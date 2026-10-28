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
import { flushSync } from 'react-dom'
import { DiceKeypad, type DiceKey } from './dice-keypad'
import { DieIcon } from '@/components/icons/die'
import { Modal } from '@/components/modal/modal'
import { useMediaQuery } from '@/hooks/use-media-query'
import { dieWords } from '@/utils/effect-dice'
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
 * Skip and Type it in, beside a die an effect adds (module 0.42.0): as tall as a fingertip on a
 * phone, the app's rule for new controls, and as Cancel from a tablet up.
 */
const SKIP = clsx(
  BUTTON,
  'min-h-11 shrink-0 border border-border font-medium hover:border-primary/50 hover:bg-primary/5 sm:min-h-9',
)

/**
 * One roll's dice, a box each, typed into by the dialog's keypad or a keyboard, the total as it
 * will be kept, and Done. It's made again for each roll, every box empty. From module 0.42.0, a
 * die an effect adds may be skipped, for the game to roll it: its boxes then leave the dialog, and
 * what's typed, moved through and asked for, until it's typed in again.
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
  // Every die's box in turn, term by term: its place in its term, its die, and its term.
  const boxes = entry.terms.flatMap(({ sides, count }, term) =>
    Array.from({ length: count }, (_, box) => ({ box, sides, term })),
  )
  // The terms skipped, by their places, which the game rolls: their boxes aren't shown.
  const [out, setOut] = useState<ReadonlySet<number>>(() => new Set())
  // The boxes shown, in turn, which alone are typed into, moved through and asked for.
  const shown = boxes.flatMap(({ term }, index) =>
    out.has(term) ? [] : [index],
  )
  const last = shown.at(-1) ?? -1
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

  /** Scroll what has focus, a box or a button, clear of the keypad kept over the dice. */
  const keepClear = (element: HTMLElement) => {
    const scroller = form.current?.parentElement
    if (compact || !scroller || !keys.current) return
    const hidden =
      element.getBoundingClientRect().bottom +
      8 -
      keys.current.getBoundingClientRect().top
    if (hidden > 0) scroller.scrollTop += hidden
  }

  /** Focus a box, clear of the keypad kept over the dice as they scroll. */
  const focusBox = (index: number) => {
    const input = inputs.current[index]
    if (!input) return
    input.focus()
    keepClear(input)
  }

  const inBox = () =>
    inputs.current.some(input => input && input === document.activeElement)

  /**
   * On to the next die: the next box shown, the next term's first after a term's last, past any
   * skipped, or from the last to Done. Focus goes along only where a box had it, so a keyboard on
   * the keypad stays there; and where Next die had focus as the last box comes, which it goes with,
   * the last box takes it.
   */
  const moveOn = (index: number) => {
    const focused = inBox()
    // Next die goes as the last box becomes current: where it had focus, the last box takes it, so
    // that focus never falls to the page, and what a keyboard types goes into the last box.
    const fromNext =
      (document.activeElement as HTMLElement | null)?.dataset?.key === 'next'
    const next = shown.find(at => at > index)
    if (next !== undefined) {
      setCurrent(next)
      if (focused || (fromNext && next === last)) focusBox(next)
    } else if (focused) done.current?.focus()
  }

  // Where each term's boxes start, among every box in turn.
  const starts = entry.terms.map((_, at) =>
    entry.terms.slice(0, at).reduce((sum, { count }) => sum + count, 0),
  )

  /**
   * Skip a die an effect adds, for the game to roll it. Where the keypad typed into its box, it
   * types into the next box shown after it, or else the last before it; and where Skip had focus,
   * which goes with it, the next box shown after it takes it, or Done: as it does where one of the
   * die's own boxes had it, as a tap on a phone leaves it, so that focus never falls to the page.
   * @param pressed - Whether Skip had focus as it was pressed.
   */
  const skip = (term: number, pressed: boolean) => {
    const after = shown.find(index => boxes[index].term > term)
    const before = shown.findLast(index => boxes[index].term < term)
    const inIt = boxes.some(
      (each, index) =>
        each.term === term && inputs.current[index] === document.activeElement,
    )
    setOut(held => new Set(held).add(term))
    if (boxes[current]?.term === term) setCurrent(after ?? before ?? current)
    if (!pressed && !inIt) return
    if (after === undefined) done.current?.focus()
    else focusBox(after)
  }

  /**
   * Type a skipped die in after all: its boxes come back, the first the one the keypad types
   * into, and where Type it in had focus, which goes with it, the one focused.
   * @param pressed - Whether Type it in had focus as it was pressed.
   */
  const typeIn = (term: number, pressed: boolean) => {
    // Drawn at once, so that its first box is there to focus.
    flushSync(() => {
      setOut(held => {
        const left = new Set(held)
        left.delete(term)
        return left
      })
      setCurrent(starts[term])
    })
    if (pressed) focusBox(starts[term])
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

  /** Each term's share of what's kept for every box in turn: none for a term skipped. */
  const valuesOf = <T,>(each: T[]): T[][] =>
    byTerm(entry, each).map((values, term) => (out.has(term) ? [] : values))

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    // Only the boxes shown: a die skipped is the game's.
    const missing = shown.filter(index => faces[index] === undefined)
    if (missing.length === 0) {
      onDone(valuesOf(faces as number[]))
      return
    }
    setMarked(new Set(missing))
    setTried(true)
    setCurrent(missing[0])
    focusBox(missing[0])
  }

  /** The keypad's keys, typed into the current box, wherever focus is. */
  const press = (key: DiceKey) => {
    if (!boxes[current] || out.has(boxes[current].term)) return
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
  const notice = tried && shown.some(index => faces[index] === undefined)
  const total = entry.total(valuesOf(faces))
  // What the total leaves out while a die is skipped, in its own words, so that it's heard with it.
  const skipped = [...out].toSorted((a, b) => a - b)
  const caveat = skipped.length > 0 ? (entry.skippedWords?.(skipped) ?? '') : ''

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
        {entry.note && (
          <p className='text-sm text-text-secondary'>{entry.note}</p>
        )}
        {entry.until && <Countdown until={entry.until} onOut={end} />}
        {entry.terms.map((term, termAt) => {
          const heading = `${ids}-${termAt}`
          const error = `${heading}-error`
          // What a term skipped says, which describes its Type it in (0.42.1).
          const outLine = `${heading}-out`
          const first = starts[termAt]
          const own = boxes.slice(first, first + term.count)
          const title = (
            <h3
              id={heading}
              className='flex min-w-0 items-center gap-1.5 text-sm font-medium'
            >
              {term.sides !== 100 && (
                <DieIcon
                  sides={term.sides}
                  className='size-4 shrink-0 text-text-secondary'
                />
              )}
              {term.label}
            </h3>
          )
          // A die an effect adds, such as Bless's: by its name, and its dice, "d4" or "2d4".
          const whose = `${term.name ?? term.label}’s ${dieWords({ faces: term.sides, count: term.count })}`
          const isOut = out.has(termAt)
          return (
            <div
              key={heading}
              role='group'
              aria-labelledby={heading}
              className='grid gap-2'
            >
              {term.skippable ? (
                // The button wraps under the heading before anything scrolls sideways.
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  {title}
                  {/* Each named by the words it shows first, then whose die, so a voice saying
                      them finds it (WCAG 2.5.3). */}
                  {isOut ? (
                    <button
                      type='button'
                      aria-label={`Type it in, ${whose}`}
                      aria-describedby={outLine}
                      onFocus={event => keepClear(event.currentTarget)}
                      onClick={event =>
                        typeIn(
                          termAt,
                          document.activeElement === event.currentTarget,
                        )
                      }
                      className={SKIP}
                    >
                      Type it in
                    </button>
                  ) : (
                    <button
                      type='button'
                      aria-label={`Skip ${whose}`}
                      onFocus={event => keepClear(event.currentTarget)}
                      onClick={event =>
                        skip(
                          termAt,
                          document.activeElement === event.currentTarget,
                        )
                      }
                      className={SKIP}
                    >
                      Skip
                    </button>
                  )}
                </div>
              ) : (
                title
              )}
              {isOut ? (
                <p id={outLine} className='text-sm text-text-secondary'>
                  The game rolls {whose}.
                </p>
              ) : (
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
                        onChange={event =>
                          put(at, digitsOf(event.target.value))
                        }
                        className={clsx(
                          'h-11 w-12 rounded-xl border bg-page text-center text-base tabular-nums outline-none',
                          // An empty box shows nothing but its edge, so it's drawn at 3:1 or more
                          // against the dialog in either theme, as the app's fainter border isn't.
                          invalid
                            ? 'border-danger'
                            : 'border-text-secondary/80',
                          at === current && 'ring-2 ring-primary',
                        )}
                      />
                    )
                  })}
                </div>
              )}
              {!isOut && own.some((_, offset) => ruled[first + offset]) && (
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
          {caveat && (
            <span className='text-sm font-normal text-text-secondary'>
              , {caveat}
            </span>
          )}
        </output>
        <DiceKeypad
          onKey={press}
          d100={boxes[current]?.sides === 100}
          compact={compact}
          next={current < last}
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
