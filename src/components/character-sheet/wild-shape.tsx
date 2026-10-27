'use client'

import {
  createContext,
  createRef,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import clsx from 'clsx'
import { Clock, LoaderCircle, PawPrint, Undo2, X } from 'lucide-react'
import { reasons } from './roll-tray'
import { Modal, usePortalRoot, useTopmostEscape } from '@/components/modal'
import { SearchField } from '@/components/search-field'
import { WILD_SHAPE_SETTLE } from '@/constants/sending-stone'
import { useHydrated } from '@/hooks/use-hydrated'
import { useStoredText } from '@/hooks/use-stored'
import { matchesSearch } from '@/utils/search'
import {
  articled,
  canReturn,
  checkWildShape,
  isIncapacitated,
  timeLeftWords,
  usableForm,
} from '@/utils/wild-shape'
import {
  aboutWords,
  actionsNoteWords,
  attackWords,
  badgeName,
  badgeOf,
  beastCountWords,
  changeRefusedWords,
  chipWords,
  effectsNoteWords,
  endedWords,
  ENDS_IN_FOUNDRY,
  inventoryNoteWords,
  knownCountWords,
  learnRefusedWords,
  learnWords,
  listFailedWords,
  managerLineWords,
  noFormsWords,
  NONE_OFFERED,
  notTakingWords,
  ONLY_IN_FOUNDRY,
  returnWords,
  ribbonWords,
  ROW_WORDS,
  sizeCrWords,
  spellsNoteWords,
  swapWords,
  usesNoteWords,
  wildShapeReasons,
  type WildShapeLogged,
} from '@/utils/wild-shape-words'
import type { WildShapeForms, TableRollState } from '@/hooks/use-table-rolls'
import type { WildShapeInput } from '@/types/roll'
import type {
  BeastEntry,
  KnownForm,
  SheetForm,
  SheetWildShape,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { SeatRole } from '@/utils/seat-words'

// Wild Shape from the app, from module 0.40.0 (round 0.40.0 §5): the ribbon above a shaped sheet's
// tabs, Change, Return and Known forms… on the Wild Shape row wherever it's drawn, the one dialog
// of the pane its picker, manager and Beasts to learn are views of, Return's confirm, the shaped
// tabs' notes, and the banner when the game ends a Wild Shape. A change, a return or a Beast
// learned waits while it's on its way, and once made until the sheet says so (`form.profile`, no
// `form`, `known`), for up to `WILD_SHAPE_SETTLE`, as an effect's change does; focus then goes
// where the change is, only where it was on what was pressed, in the dialog, or lost.

/** What a command sent from here asked. */
type Asked =
  | { op: 'transform'; form: string }
  | { op: 'revert' }
  | { op: 'learn'; uuid: string; replace: string | null }

/** A command sent from here, by its local id, and what it asked. */
type Sent = Asked & { id: string }

type Op = Sent['op']

/** Why the last command of an op from here wasn't made, by the reason's key. */
type Refusal = { op: Op; key: string }

/** What the pane's one Wild Shape dialog shows: the picker, the manager, or a Beast to learn. */
type View =
  | { kind: 'picker' }
  | { kind: 'known' }
  | { kind: 'learn'; replace?: KnownForm }

/** The Beasts to learn, as the game lists them, while it does, or why it didn't. */
type Beasts =
  | { status: 'loading' }
  | { status: 'failed'; reason: string }
  | { status: 'done'; forms: BeastEntry[]; more: boolean }

/**
 * Where focus goes next: the ribbon's heading, the tab's panel, an element, or one in a dialog,
 * else, where that one isn't drawn any more, the one standing in for it.
 */
type Focus =
  'heading' | 'panel' | HTMLElement | { selector: string; or?: string }

/** What a pane knows of its character's Wild Shape, and does with it. */
export type WildShapeValue = {
  /** Whether its player may use Wild Shape from here now. */
  on: boolean
  /** Whether it's the character's own pane, not a creature's. */
  pane: boolean
  role: SeatRole
  /** The character's name, which every word of it names. */
  name: string
  sheet?: TableSheet
  block?: SheetWildShape
  form?: SheetForm
  /** Whether the game takes the character's own effects from here. */
  effects: boolean
  /** The known forms that can be taken from here now: usable, and not the one the druid is in. */
  offered: KnownForm[]
  /** What's on its way from here, while it waits. */
  waiting?: Op
  /** Why the last command of an op wasn't made, where it wasn't. */
  refusal?: Refusal
  view?: View
  /** Whether the manager was opened from the picker, which its Back goes to. */
  fromPicker: boolean
  /** The card checked in the picker, the default where none is picked. */
  checked?: string
  pick: (id: string) => void
  /** Change into the checked form. */
  change: () => void
  /** The Beast chosen to learn, by its uuid. */
  beast?: string
  pickBeast: (uuid: string) => void
  learn: (beast: BeastEntry, replace?: KnownForm) => void
  beasts?: Beasts
  loadBeasts: () => void
  openPicker: (opener: HTMLElement) => void
  openKnown: (opener: HTMLElement) => void
  /** From the picker: Known forms…, or Choose forms… where the druid knows none. */
  showKnown: (from: 'known' | 'choose') => void
  /** From the manager: Learn a form… at an empty place, or Replace… a known form. */
  showLearn: (from: string, replace?: KnownForm) => void
  back: () => void
  close: () => void
  /** The Return whose confirm is open. */
  returnAnchor?: HTMLElement
  openReturn: (opener: HTMLElement) => void
  /** Closes Return's confirm, returning the character where `confirm`. */
  closeReturn: (confirm: boolean) => void
  heading: RefObject<HTMLHeadingElement | null>
  /** What's inside the dialog, for focus to be found in it. */
  body: RefObject<HTMLDivElement | null>
  /** The shown tab's panel. */
  panel: () => HTMLElement | null
}

/** None, as at a creature's pane, and anywhere outside a pane. */
const NO_WILD_SHAPE: WildShapeValue = {
  on: false,
  pane: false,
  role: 'player',
  name: '',
  effects: false,
  offered: [],
  fromPicker: false,
  pick: () => {},
  change: () => {},
  pickBeast: () => {},
  learn: () => {},
  loadBeasts: () => {},
  openPicker: () => {},
  openKnown: () => {},
  showKnown: () => {},
  showLearn: () => {},
  back: () => {},
  close: () => {},
  openReturn: () => {},
  closeReturn: () => {},
  heading: createRef(),
  body: createRef(),
  // eslint-disable-next-line unicorn/no-null -- no panel, as the DOM says none
  panel: () => null,
}

const WildShapeContext = createContext<WildShapeValue>(NO_WILD_SHAPE)

/** What the pane's rows, tabs and ribbon know of the character's Wild Shape. */
export function useWildShaping(): WildShapeValue {
  return use(WildShapeContext)
}

/** Where this browser keeps the last form taken from it, after which the seat's key. */
export const LAST_FORM_KEY = 'sending-stone:wild-shape-form'

/**
 * Whether the sheet says what the game made of a command: the form taken, as its profile; no
 * form, once returned; the Beast known, in the place it replaced, if it replaced one.
 */
function agrees(sent: Sent, sheet: TableSheet): boolean {
  switch (sent.op) {
    case 'transform': {
      return sheet.form?.profile === sent.form
    }
    case 'revert': {
      return !sheet.form
    }
    case 'learn': {
      return !!sheet.wildShape?.known.some(
        known =>
          known.uuid === sent.uuid &&
          (sent.replace === null || known.id === sent.replace),
      )
    }
  }
}

/**
 * What a pane offers of its character's Wild Shape, from module 0.40.0, and its one dialog's state,
 * held here so that it outlives the row it was opened from as a new sheet arrives.
 * @param on - Whether its player may use Wild Shape from here: the view offers it, at the
 *   character's own pane.
 * @param pane - Whether it's the character's own pane, which has the ribbon and notes, not a
 *   creature's.
 * @param send - Sends a change, a return or a Beast learned, logging it among the rolls: its local
 *   id.
 * @param read - Asks the game for the Beasts to learn, logging nothing.
 * @param panel - The shown tab's panel, which takes focus after a return.
 */
export function useWildShape({
  on,
  pane,
  role,
  name,
  sheet,
  characterId,
  effects,
  states,
  send,
  read,
  panel,
}: Readonly<{
  on: boolean
  pane: boolean
  role: SeatRole
  name: string
  sheet: TableSheet
  characterId: string
  effects: boolean
  states: ReadonlyMap<string, TableRollState>
  send: (
    input: Exclude<WildShapeInput, { op: 'forms' }>,
    logged: WildShapeLogged,
  ) => string
  read: () => Promise<WildShapeForms>
  panel: () => HTMLElement | null
}>): WildShapeValue {
  const block = sheet.wildShape
  const { form } = sheet
  const [sent, setSent] = useState<Sent>()
  // The local ids of those no longer waited for: sent long enough ago that the sheet should have
  // come, or made and the sheet has said so.
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set())
  const [refusal, setRefusal] = useState<Refusal>()
  const [view, setView] = useState<View>()
  const [fromPicker, setFromPicker] = useState(false)
  const [picked, setPicked] = useState<string>()
  const [beast, setBeast] = useState<string>()
  const [beasts, setBeasts] = useState<Beasts>()
  const [returnAnchor, setReturnAnchor] = useState<HTMLElement>()
  const [focus, setFocus] = useState<Focus>()
  const [last, keepLast] = useStoredText(`${LAST_FORM_KEY}:${characterId}`)
  const heading = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)
  // What opened the dialog, the view the manager was opened from in the picker, the control in
  // the manager that opened a Beast to learn, and the Return pressed, for focus to go back to.
  const opener = useRef<HTMLElement>(undefined)
  const knownFrom = useRef<'known' | 'choose'>('known')
  const learnFrom = useRef('')
  const pressed = useRef<HTMLElement>(undefined)
  // By local id, whether each command the settle below has handled was made.
  const handled = useRef(new Map<string, boolean>())
  const asking = useRef(0)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const running = timers.current
    return () => {
      for (const timer of running) clearTimeout(timer)
    }
  }, [])

  const offered = useMemo(
    () =>
      (block?.known ?? []).filter(
        known => usableForm(known) && known.id !== form?.profile,
      ),
    [block, form],
  )
  // The card checked: the one picked, else the last form taken from this device, else the first.
  const offers = (id?: string) => offered.some(known => known.id === id)
  let checked: string | undefined = offered[0]?.id
  if (offers(last)) checked = last
  if (offers(picked)) checked = picked

  const waitingFor = (each?: Sent): boolean => {
    if (!each) return false
    const state = states.get(each.id)
    // Sent, its way not yet heard of: as on its way, for as long as the sheet might take.
    if (!state) return !settled.has(each.id)
    if (state.status === 'sending' || state.status === 'rolling') return true
    return (
      state.status === 'done' && !settled.has(each.id) && !agrees(each, sheet)
    )
  }
  const waiting = sent && waitingFor(sent) ? sent.op : undefined

  const settle = (id: string) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setSettled(held => new Set(held).add(id))
    }, WILD_SHAPE_SETTLE)
    timers.current.add(timer)
  }
  const dispatch = (
    input: Exclude<WildShapeInput, { op: 'forms' }>,
    logged: WildShapeLogged,
    held: Asked,
  ) => {
    const id = send(input, logged)
    setSent({ ...held, id })
    setRefusal(undefined)
    settle(id)
  }
  /**
   * Why the sheet, or the view, says the game would refuse it now, in the app's order; none where
   * it wouldn't. Another of Wild Shape's commands still on its way is `moving`, as the app says it,
   * so that a Become or a Learn pressed meanwhile says why nothing was sent.
   */
  const refused = (input: Exclude<WildShapeInput, { op: 'forms' }>) =>
    (on ? checkWildShape(input, sheet) : 'unavailable') ??
    (waiting ? 'moving' : undefined)

  const change = () => {
    if (!checked || !block) return
    const input = { op: 'transform', form: checked } as const
    const why = refused(input)
    if (why) {
      setRefusal({ op: 'transform', key: why })
      return
    }
    const known = block.known.find(({ id }) => id === checked)
    dispatch(
      input,
      { op: 'transform', form: known?.name, character: name },
      { op: 'transform', form: checked },
    )
  }

  const revert = () => {
    if (waiting || !on || !form || !canReturn(sheet)) return
    dispatch(
      { op: 'revert' },
      {
        op: 'revert',
        form: form.name,
        character: name,
        temp: sheet.hp?.temp ?? 0,
      },
      { op: 'revert' },
    )
  }

  const learn = (chosen: BeastEntry, replace?: KnownForm) => {
    const input = {
      op: 'learn',
      uuid: chosen.uuid,
      // eslint-disable-next-line unicorn/no-null -- the protocol's for an empty place
      replace: replace?.id ?? null,
    } as const
    const why = refused(input)
    if (why) {
      setRefusal({ op: 'learn', key: why })
      return
    }
    dispatch(
      input,
      {
        op: 'learn',
        form: chosen.name,
        ...(replace && { old: replace.name }),
        character: name,
      },
      { op: 'learn', uuid: input.uuid, replace: input.replace },
    )
  }

  const loadBeasts = useCallback(() => {
    const token = ++asking.current
    setBeasts({ status: 'loading' })
    void read().then(result => {
      if (token !== asking.current) return
      setBeasts(
        'reason' in result
          ? { status: 'failed', reason: result.reason }
          : { status: 'done', forms: result.forms, more: result.more },
      )
    })
  }, [read])

  const dialog = () => body.current?.closest('dialog') ?? undefined

  // Once a command has settled: a change made closes the picker, its form kept as the last taken
  // here, focus to the ribbon's heading; a return made, focus to the tab's panel; a Beast learned,
  // the manager again, focus on its card; one not made, why, where it was asked. One not made can
  // still be made: one the game took too long over is followed, and made late once its Gamemaster
  // answers. Why it wasn't made then goes, and the sheet is waited for afresh, as for one made in
  // time, before it's settled as made.
  useEffect(() => {
    if (!sent || waiting) return
    const state = states.get(sent.id)
    const made = state?.status === 'done'
    const was = handled.current.get(sent.id)
    if (was === true || (was === false && !made)) return
    if (was === false) {
      handled.current.delete(sent.id)
      setRefusal(held => (held?.op === sent.op ? undefined : held))
      setSettled(held => {
        const next = new Set(held)
        next.delete(sent.id)
        return next
      })
      settle(sent.id)
      return
    }
    handled.current.set(sent.id, made)
    if (!made) {
      setRefusal({ op: sent.op, key: state?.reason ?? state?.status ?? 'lost' })
      return
    }
    // Made and settled, so that a later sheet that no longer agrees, as one where the game has
    // already ended the form, never has it on its way again until its settle runs out.
    setSettled(held => (held.has(sent.id) ? held : new Set(held).add(sent.id)))
    const active = document.activeElement
    const lost = !active || active === document.body
    switch (sent.op) {
      case 'transform': {
        keepLast(sent.form)
        const inDialog = !!active && !!dialog()?.contains(active)
        if (view) setView(undefined)
        if (lost || inDialog || active === opener.current) setFocus('heading')
        return
      }
      case 'revert': {
        if (lost || active === pressed.current) setFocus('panel')
        return
      }
      case 'learn': {
        if (view?.kind !== 'learn') return
        setView({ kind: 'known' })
        const id =
          sent.replace ??
          sheet.wildShape?.known.find(({ uuid }) => uuid === sent.uuid)?.id
        if (id) setFocus({ selector: `[data-ws-focus="form:${id}"]` })
      }
    }
  })

  // Focus, where it was asked to go, once what takes it is drawn: after the dialog has closed,
  // which gives focus back to what opened it.
  useEffect(() => {
    if (!focus) return
    setFocus(undefined)
    if (focus === 'heading') {
      heading.current?.focus()
    } else if (focus === 'panel') {
      panel()?.focus()
    } else if (focus instanceof HTMLElement) {
      if (focus.isConnected) focus.focus()
    } else {
      const inside = dialog()
      const found =
        inside?.querySelector<HTMLElement>(focus.selector) ??
        (focus.or ? inside?.querySelector<HTMLElement>(focus.or) : undefined)
      found?.focus()
    }
  }, [focus, panel])

  // Return's confirm is shown only while Return is offered. Once it isn't, as when the game stops
  // taking Wild Shape or ends it, the Return it was opened from has gone and it closes with it, so
  // that it's never confirmed for nothing, nor opens again by itself with a later form. Focus, lost
  // with it, goes to the ribbon, which says why, or once the character is itself again, the tab's
  // panel.
  const returnable = on && canReturn(sheet)
  useEffect(() => {
    if (!returnAnchor || returnable) return
    setReturnAnchor(undefined)
    const active = document.activeElement
    if (!active || active === document.body)
      setFocus(form ? 'heading' : 'panel')
  }, [returnAnchor, returnable, form])

  return {
    on,
    pane,
    role,
    name,
    sheet,
    block,
    form,
    effects,
    offered,
    waiting,
    refusal,
    view: block ? view : undefined,
    fromPicker,
    checked,
    pick: id => {
      if (!offers(id)) return
      setPicked(id)
      // Another card clears why the last change wasn't made.
      if (refusal?.op === 'transform') setRefusal(undefined)
    },
    change,
    beast,
    pickBeast: uuid => {
      setBeast(uuid)
      if (refusal?.op === 'learn') setRefusal(undefined)
    },
    learn,
    beasts,
    loadBeasts,
    openPicker: element => {
      opener.current = element
      setPicked(undefined)
      if (refusal?.op === 'transform') setRefusal(undefined)
      setView({ kind: 'picker' })
    },
    openKnown: element => {
      opener.current = element
      setFromPicker(false)
      setView({ kind: 'known' })
    },
    showKnown: from => {
      knownFrom.current = from
      setFromPicker(true)
      setView({ kind: 'known' })
      setFocus(backButton('Back to Wild Shape'))
    },
    showLearn: (from, replace) => {
      learnFrom.current = from
      setBeast(undefined)
      if (refusal?.op === 'learn') setRefusal(undefined)
      setView({ kind: 'learn', replace })
      setFocus(backButton('Back to known forms'))
      loadBeasts()
    },
    back: () => {
      if (view?.kind === 'learn') {
        setView({ kind: 'known' })
        setFocus({ selector: `[data-ws-focus="${learnFrom.current}"]` })
      } else if (view?.kind === 'known' && fromPicker) {
        setView({ kind: 'picker' })
        // Choose forms… is gone once the first form is learned: Known forms… stands in for it.
        setFocus({
          selector: `[data-ws-focus="${knownFrom.current}"]`,
          or: '[data-ws-focus="known"], [data-ws-focus="choose"]',
        })
      }
    },
    close: () => {
      setView(undefined)
      if (opener.current) setFocus(opener.current)
    },
    returnAnchor: returnable ? returnAnchor : undefined,
    openReturn: element => setReturnAnchor(element),
    closeReturn: confirm => {
      const anchor = returnable ? returnAnchor : undefined
      setReturnAnchor(undefined)
      if (anchor) setFocus(anchor)
      if (confirm) {
        pressed.current = anchor
        revert()
      }
    },
    heading,
    body,
    panel,
  }
}

/** Where a dialog's Back is, by its name, for focus to go to as its view opens. */
function backButton(label: string): Focus {
  return { selector: `button[aria-label="${label}"]` }
}

/**
 * What the rows, tabs and ribbon inside know of the character's Wild Shape; and the pane's one
 * Wild Shape dialog and Return's confirm, drawn here once, never inside a row, so that a row drawn
 * afresh as a new sheet arrives never closes either.
 */
export function WildShaping({
  value,
  children,
}: Readonly<{ value: WildShapeValue; children: ReactNode }>) {
  return (
    <WildShapeContext value={value}>
      {children}
      {value.block && <WildShapeDialog />}
      {value.returnAnchor && value.form && (
        <ReturnPopover anchor={value.returnAnchor} />
      )}
    </WildShapeContext>
  )
}

/** A Wild Shape button: solid, or a ghost; a finger's height on a phone, a chip's from `sm`. */
const BUTTON =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60 sm:min-h-9'
const SOLID = clsx(BUTTON, 'bg-wild text-on-wild hover:bg-wild/90')
const GHOST = clsx(
  BUTTON,
  'border border-wild/50 text-wild hover:bg-wild/10 aria-disabled:hover:bg-transparent',
)
const PLAIN = clsx(
  BUTTON,
  'border border-border text-text-primary hover:bg-primary/5',
)

/** A spinner, beside a control's words while what it pressed is on its way. */
function Spinner() {
  return (
    <LoaderCircle
      aria-hidden
      className='size-4 shrink-0 motion-safe:animate-spin'
    />
  )
}

/**
 * The ribbon above a shaped sheet's tabs, on every tab (round 0.40.0 §5.2): what the character is,
 * the time it has left as the module last sent it, and Return to {name} where the seat may; else
 * why not. None where the sheet has no form, nor at a creature's pane.
 */
export function WildShapeRibbon() {
  const ws = use(WildShapeContext)
  if (!ws.form || !ws.pane) return
  return <Ribbon form={ws.form} />
}

function Ribbon({ form }: Readonly<{ form: SheetForm }>) {
  const ws = use(WildShapeContext)
  const section = useRef<HTMLElement>(null)
  const { panel } = ws
  // The game ending it while focus is in the ribbon: focus to the tab's panel, as it goes.
  useLayoutEffect(() => {
    const element = section.current
    return () => {
      const active = document.activeElement
      if (element && active && element.contains(active)) panel()?.focus()
    }
  }, [panel])
  const { label, heading } = ribbonWords(form)
  const time = timeLeftWords(form.minutesLeft)
  const returnable = ws.on && ws.role === 'player' && canReturn(ws.sheet)
  // The module times it, the campaign's switch on, but the game isn't taking Wild Shape now.
  const lapsed =
    ws.role === 'player' &&
    !ws.on &&
    form.hours !== null &&
    form.minutesLeft !== null
  return (
    <section
      ref={section}
      aria-label={label}
      className='flex shrink-0 items-center gap-2.5 border-b border-wild/35 bg-wild-bg py-2 pr-2 pl-3.5 md:pl-6 lg:pl-7'
    >
      <PawPrint aria-hidden className='size-5 shrink-0 text-wild' />
      <div className='min-w-0 flex-1'>
        <h2
          ref={ws.heading}
          tabIndex={-1}
          className='text-sm font-semibold text-wild outline-none'
        >
          {heading}
        </h2>
        {time && (
          <p className='flex items-center gap-1 text-xs text-text-secondary'>
            <Clock aria-hidden className='size-3 shrink-0' />
            {time}
          </p>
        )}
        {!returnable && (
          <p className='text-xs text-text-secondary'>
            {lapsed ? notTakingWords(ws.role) : ENDS_IN_FOUNDRY}
          </p>
        )}
      </div>
      {returnable && <ReturnButton label={`Return to ${ws.name}`} />}
    </section>
  )
}

/**
 * Return, on the ribbon or the row: opens its confirm; "Returning…" while it's on its way. While a
 * change or a Beast learned is on its way, it's not offered either, as the game would refuse it.
 */
function ReturnButton({ label }: Readonly<{ label: string }>) {
  const ws = use(WildShapeContext)
  const returning = ws.waiting === 'revert'
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      aria-disabled={ws.waiting ? true : undefined}
      onClick={event => {
        if (ws.waiting) return
        ws.openReturn(event.currentTarget)
      }}
      className={GHOST}
    >
      {returning ? <Spinner /> : <Undo2 aria-hidden className='size-4' />}
      {returning ? 'Returning…' : label}
    </button>
  )
}

/**
 * Return's confirm (round 0.40.0 §5.4), from the Return pressed: what ending it does, what the
 * character keeps, and Stay {aForm} first. Stay and Escape close it, focus back to the Return
 * that opened it; Return closes it and returns the character.
 */
export function ReturnPopover({ anchor }: Readonly<{ anchor: HTMLElement }>) {
  const ws = use(WildShapeContext)
  const titleId = useId()
  const stay = useRef<HTMLButtonElement>(null)
  const root = usePortalRoot()
  useTopmostEscape(true)
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: open => {
      if (!open) ws.closeReturn(false)
    },
    elements: { reference: anchor },
    placement: 'bottom-end',
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  })
  const { getFloatingProps } = useInteractions([
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])
  const words = returnWords(
    ws.name,
    ws.form?.name ?? '',
    ws.sheet?.hp?.temp ?? 0,
  )
  return (
    <FloatingPortal root={root}>
      <FloatingFocusManager
        context={context}
        initialFocus={stay}
        modal={false}
        returnFocus={false}
      >
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          aria-labelledby={titleId}
          className='z-50 flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 text-sm text-text-primary shadow-xl'
          {...getFloatingProps()}
        >
          <p id={titleId} className='font-semibold'>
            {words.title}
          </p>
          {words.body.map(line => (
            <p key={line} className='text-text-secondary'>
              {line}
            </p>
          ))}
          <div className='flex flex-wrap justify-end gap-2'>
            <button
              ref={stay}
              type='button'
              onClick={() => ws.closeReturn(false)}
              className={PLAIN}
            >
              {words.stay}
            </button>
            <button
              type='button'
              onClick={() => ws.closeReturn(true)}
              className={SOLID}
            >
              {words.confirm}
            </button>
          </div>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

/** What the Wild Shape row says and offers, by the state it's in (round 0.40.0 §5.7). */
function rowOf(
  ws: WildShapeValue,
): { line: string; change?: 'on' | 'off'; back: boolean } | undefined {
  const { block, form, sheet, name } = ws
  if (!block || !sheet) return undefined
  if (form && !canReturn(sheet)) {
    return { line: ROW_WORDS.other(name, form.name), back: false }
  }
  const lines: string[] = []
  if (form) lines.push(ROW_WORDS.shaped(name, form.name))
  const left = block.uses.value > 0
  let change: 'on' | 'off' | undefined
  if (isIncapacitated(sheet)) {
    lines.push(ROW_WORDS.incapacitated(name))
    change = 'off'
  } else if (left) {
    if (!form) lines.push(ROW_WORDS.ready(block.hours))
    change = 'on'
  } else {
    lines.push(ROW_WORDS.spent(block.resurgence))
    change = 'off'
  }
  return { line: lines.join(' '), change, back: !!form }
}

/** Whether a row, by its id, is the character's Wild Shape row, while it may be used from here. */
function isRow(ws: WildShapeValue, id: string): boolean {
  return ws.on && ws.pane && ws.block?.item === id
}

/**
 * Wild Shape's controls at the end of its row, wherever it's drawn (round 0.40.0 §5.7), beside its
 * chips, never on what opens the row: Change, Return, and on Features, Known forms…. None on any
 * other row, nor where its player can't use it from here.
 */
export function WildShapeRowControls({
  id,
  knownForms = false,
}: Readonly<{ id: string; knownForms?: boolean }>) {
  const ws = use(WildShapeContext)
  const row = isRow(ws, id) ? rowOf(ws) : undefined
  if (!row) return
  const blocked = row.change === 'off'
  return (
    <>
      {row.back && <ReturnButton label='Return' />}
      {row.change && (
        <button
          type='button'
          aria-haspopup='dialog'
          aria-disabled={blocked || undefined}
          onClick={event => {
            if (blocked) return
            ws.openPicker(event.currentTarget)
          }}
          className={SOLID}
        >
          <PawPrint aria-hidden className='size-4' />
          Change
        </button>
      )}
      {knownForms && (
        <button
          type='button'
          aria-haspopup='dialog'
          onClick={event => ws.openKnown(event.currentTarget)}
          className={PLAIN}
        >
          Known forms…
        </button>
      )}
    </>
  )
}

/** The Wild Shape row's small line under its name: what Wild Shape does now, or why not. */
export function WildShapeRowLine({ id }: Readonly<{ id: string }>) {
  const ws = use(WildShapeContext)
  const row = isRow(ws, id) ? rowOf(ws) : undefined
  if (!row) return
  return (
    <p className='px-2.5 pb-1.5 pl-[3.25rem] text-xs text-text-secondary'>
      {row.line}
    </p>
  )
}

/**
 * Whether the row by this id is the character's Wild Shape row, as its sheet says, for Features to
 * draw it as an action's row, with its controls and its line.
 */
export function useWildShapeRow(id: string): boolean {
  return use(WildShapeContext).block?.item === id
}

/** Features' line for the Wild Shape row, from what the rules allow the druid now. */
export function WildShapeAbout({ id }: Readonly<{ id: string }>) {
  const ws = use(WildShapeContext)
  if (!ws.block || ws.block.item !== id) return
  return (
    <p className='text-xs text-text-secondary'>
      {aboutWords(ws.block, ws.name)}
    </p>
  )
}

/**
 * A shaped sheet's note on a tab (round 0.40.0 §5.6), at the player's own pane: what's left of the
 * character's gear and spells, and why its effects aren't changed from here meanwhile. Where gear
 * goes, when it comes back and the Moon's spells are Wild Shape's rules, said of a Wild Shape
 * alone: another transformation, such as a Polymorph, has its own, and its form's sheet says it.
 */
export function WildShapeNote({
  tab,
}: Readonly<{ tab: 'actions' | 'spells' | 'inventory' | 'effects' }>) {
  const ws = use(WildShapeContext)
  const { form, name, sheet } = ws
  if (!form || !ws.pane || ws.role !== 'player' || !sheet) return
  const wild = form.kind === 'wildShape'
  let text: string
  switch (tab) {
    case 'actions': {
      if (!wild) return
      text = actionsNoteWords(form.name, name)
      break
    }
    case 'spells': {
      text = spellsNoteWords(
        form.name,
        name,
        sheet.spells,
        wild && ws.block?.circle === 'moon',
      )
      break
    }
    case 'inventory': {
      if (!wild) return
      text = inventoryNoteWords(name)
      break
    }
    case 'effects': {
      if (!ws.effects) return
      text = effectsNoteWords(form.name, name)
      break
    }
  }
  return (
    <p
      data-wild-note={tab}
      className={clsx(
        'text-sm text-text-secondary',
        tab === 'spells' &&
          'rounded-2xl border border-dashed border-border p-3.5',
      )}
    >
      {text}
    </p>
  )
}

/** The dialog's title for each view. */
function titleOf(view: View | undefined): string {
  switch (view?.kind) {
    case 'known': {
      return 'Known forms'
    }
    case 'learn': {
      return view.replace
        ? `Replace ${articled(view.replace.name)}`
        : 'Learn a form'
    }
    default: {
      return 'Wild Shape'
    }
  }
}

/**
 * The pane's one Wild Shape dialog (round 0.40.0 §5.3, §5.8): a sheet from the bottom of a phone's
 * screen, a dialog on a wide one, its views the form picker, the Known forms manager and a Beast
 * to learn, Back between them; its note and its button kept in view under what scrolls.
 */
function WildShapeDialog() {
  const ws = use(WildShapeContext)
  const first = useRef<HTMLElement>(null)
  const { view } = ws
  let back: { label: string; onClick: () => void } | undefined
  if (view?.kind === 'learn') {
    back = { label: 'Back to known forms', onClick: ws.back }
  } else if (view?.kind === 'known' && ws.fromPicker) {
    back = { label: 'Back to Wild Shape', onClick: ws.back }
  }
  let footer: ReactNode
  // No footer where the druid knows no forms yet, as there's no Become: only Choose forms….
  if (view?.kind === 'picker' && (ws.block?.known.length ?? 0) > 0) {
    footer = <PickerFooter />
  }
  if (view?.kind === 'learn') footer = <LearnFooter replace={view.replace} />
  return (
    <Modal
      open={view !== undefined}
      onClose={ws.close}
      title={titleOf(view)}
      placement='sheet'
      initialFocus={first}
      back={back}
      footer={footer}
    >
      <div ref={ws.body} className='flex flex-col gap-4'>
        {view?.kind === 'picker' && <FormPicker first={first} />}
        {view?.kind === 'known' && <KnownForms />}
        {view?.kind === 'learn' && <BeastList />}
      </div>
    </Modal>
  )
}

/** The badge of a card not offered, or the current form's. */
function Badge({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className='shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-text-secondary'>
      {children}
    </span>
  )
}

/** A form's paw, where its art would be. */
function Paw() {
  return (
    <span
      aria-hidden
      className='flex size-8 shrink-0 items-center justify-center rounded-full bg-wild-bg text-wild'
    >
      <PawPrint className='size-4' />
    </span>
  )
}

/** A known form's statistics: its AC, at the Moon's floor where higher, speeds and attack. */
function formStats(
  known: KnownForm,
  acFloor: number | null,
): { ac?: string; speeds?: string; attack?: string } {
  const ac =
    typeof known.ac === 'number'
      ? `AC ${Math.max(known.ac, acFloor ?? Number.NEGATIVE_INFINITY)}`
      : undefined
  return {
    ac,
    speeds: known.speeds?.length ? known.speeds.join(', ') : undefined,
    attack: known.attack ? attackWords(known.attack) : undefined,
  }
}

/** A known form's card's face: its name, size and CR, its statistics, and its badge. */
function FormFace({
  known,
  acFloor,
  now,
  nameFocus,
}: Readonly<{
  known: KnownForm
  acFloor: number | null
  now: boolean
  /** Its name takes focus, as the manager's card does once it's learned. */
  nameFocus?: boolean
}>) {
  const badge = badgeOf(known)
  const stats = known.pool ? formStats(known, acFloor) : {}
  const line = known.pool ? sizeCrWords(known.size, known.cr) : ''
  return (
    <>
      <span className='flex items-center gap-2.5'>
        <Paw />
        <span className='min-w-0 flex-1'>
          <span
            {...(nameFocus && {
              tabIndex: -1,
              'data-ws-focus': `form:${known.id}`,
            })}
            className='block font-semibold outline-none'
          >
            {known.name}
          </span>
          {line && (
            <span className='block text-xs text-text-secondary'>{line}</span>
          )}
        </span>
        {now && <Badge>Now</Badge>}
        {!now && badge && <Badge>{badge}</Badge>}
      </span>
      {(stats.ac || stats.speeds || stats.attack) && (
        <span className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary'>
          {stats.ac && (
            <span className='font-semibold text-text-primary'>{stats.ac}</span>
          )}
          {stats.speeds && <span>{stats.speeds}</span>}
          {stats.attack && <span>{stats.attack}</span>}
        </span>
      )}
      {!now && badge && (
        <span className='text-xs text-text-secondary'>{ONLY_IN_FOUNDRY}</span>
      )}
    </>
  )
}

/** A known form's card's accessible name: what its face says, and why it isn't offered. */
function cardName(
  known: KnownForm,
  acFloor: number | null,
  now: boolean,
): string {
  const stats = known.pool ? formStats(known, acFloor) : {}
  const cr = known.pool ? sizeCrWords(undefined, known.cr) : ''
  const badge = badgeOf(known)
  let end = ''
  if (now) end = ', now'
  else if (badge) end = badgeName(badge)
  return [
    known.name,
    known.pool ? known.size : undefined,
    cr,
    stats.ac,
    stats.speeds,
    stats.attack,
  ]
    .filter(Boolean)
    .join(', ')
    .concat(end)
}

/** Which way each arrow key moves through a roving radiogroup. */
const STEPS: Record<string, 1 | -1> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
}

/** The card a roving radiogroup's arrow lands on: the next offered, wrapping, either way. */
function nextOffered(
  ids: string[],
  from: string | undefined,
  key: string,
): string | undefined {
  const step = STEPS[key]
  if (ids.length === 0 || step === undefined) return undefined
  const at = from === undefined ? -1 : ids.indexOf(from)
  if (at === -1) return step > 0 ? ids[0] : ids.at(-1)
  return ids[(at + step + ids.length) % ids.length]
}

/** Arrow keys on a roving radiogroup: the next offered card checked, and focused. */
function arrows(
  event: KeyboardEvent<HTMLElement>,
  ids: string[],
  from: string | undefined,
  choose: (id: string) => void,
  attribute: string,
) {
  const next = nextOffered(ids, from, event.key)
  if (next === undefined) return
  event.preventDefault()
  choose(next)
  event.currentTarget
    .querySelector<HTMLElement>(
      `[${CSS.escape(attribute)}="${CSS.escape(next)}"]`,
    )
    ?.focus()
}

/**
 * The form picker (round 0.40.0 §5.3): what a change gives, the known forms as radios, those not
 * offered skipped by the arrows, and the count with Known forms…; or, where the druid knows none,
 * Choose forms….
 */
function FormPicker({
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

/** The words for why a command wasn't made, as the seat reads them. */
function reasonWords(role: SeatRole, op: Op, key: string): string | undefined {
  return wildShapeReasons(role, op)[key] ?? reasons(role)[key]
}

/**
 * The picker's footer: the uses left, or why no card is offered, or why the last change wasn't
 * made; and Become {aForm}, "Changing…" while it's on its way, focus kept on it.
 */
function PickerFooter() {
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

/**
 * The Known forms manager (round 0.40.0 §5.8): what the druid knows of how many, each known form
 * with Replace… where a replacement is free, each empty place with Learn a form…, and when a
 * replacement comes.
 */
function KnownForms() {
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

/**
 * The Beasts to learn (round 0.40.0 §5.8), as the game lists them now, from the campaign's
 * compendiums: "Finding Beasts…" while it does, why not and Try again where it couldn't; then a
 * search, their count, and each as a radio, those known already not offered.
 */
function BeastList() {
  const ws = use(WildShapeContext)
  const [query, setQuery] = useState('')
  const { beasts } = ws
  if (!beasts || beasts.status === 'loading') {
    return (
      <p
        role='status'
        className='flex items-center gap-2 text-sm text-text-secondary'
      >
        <Spinner />
        Finding Beasts…
      </p>
    )
  }
  if (beasts.status === 'failed') {
    const reason =
      reasonWords(ws.role, 'learn', beasts.reason) ?? 'something went wrong'
    return (
      <div className='flex flex-col items-start gap-3'>
        <p role='alert' className='text-sm text-warning'>
          {listFailedWords(ws.role, reason)}
        </p>
        <button type='button' onClick={ws.loadBeasts} className={PLAIN}>
          Try again
        </button>
      </div>
    )
  }
  const shown = beasts.forms.filter(each => matchesSearch([each.name], query))
  const ids = shown.filter(each => !each.known).map(({ uuid }) => uuid)
  const chosen = ids.includes(ws.beast ?? '') ? ws.beast : undefined
  // The first offered takes the group's tab stop while none is chosen.
  const stop = chosen ?? ids[0]
  return (
    <>
      <SearchField
        value={query}
        onChange={setQuery}
        label='Search Beasts'
        placeholder='Search Beasts'
      />
      {/* Read where it stands, never announced (round 0.40.0 §9.5): this view's live words are
          its "Finding Beasts…" and its refusals alone. */}
      <p className='text-sm text-text-secondary'>
        {beastCountWords(shown.length, beasts.forms.length, beasts.more)}
      </p>
      <div
        role='radiogroup'
        aria-label='Beasts'
        onKeyDown={event =>
          arrows(event, ids, chosen, ws.pickBeast, 'data-ws-beast')
        }
        className='grid gap-2 md:grid-cols-2'
      >
        {shown.map(each => {
          const checked = each.uuid === chosen
          const line = sizeCrWords(each.size, each.cr)
          const facts = [
            typeof each.ac === 'number' ? `AC ${each.ac}` : undefined,
            each.speeds.length > 0 ? each.speeds.join(', ') : undefined,
          ].filter(Boolean)
          return (
            <button
              key={each.uuid}
              type='button'
              role='radio'
              aria-checked={checked}
              aria-disabled={each.known || undefined}
              aria-label={[each.name, line, ...facts]
                .filter(Boolean)
                .join(', ')
                .concat(each.known ? ', known' : '')}
              tabIndex={each.uuid === stop ? 0 : -1}
              data-ws-beast={each.uuid}
              onClick={() => {
                if (!each.known) ws.pickBeast(each.uuid)
              }}
              className={clsx(
                'flex min-h-11 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors',
                checked
                  ? 'border-wild bg-wild-bg/60 ring-1 ring-wild'
                  : 'border-border bg-card',
                each.known ? 'cursor-not-allowed' : 'hover:border-wild/50',
              )}
            >
              <span className='flex items-center gap-2.5'>
                <Paw />
                <span className='min-w-0 flex-1'>
                  <span className='block font-semibold'>{each.name}</span>
                  {line && (
                    <span className='block text-xs text-text-secondary'>
                      {line}
                    </span>
                  )}
                </span>
                {each.known && <Badge>Known</Badge>}
              </span>
              {facts.length > 0 && (
                <span className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary'>
                  {facts.map(fact => (
                    <span key={fact}>{fact}</span>
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}

/** A Beast to learn's footer: why it wasn't learned, and Learn {aForm}, "Learning…" on its way. */
function LearnFooter({ replace }: Readonly<{ replace?: KnownForm }>) {
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

/** Where this browser keeps the last ending dismissed, by when, after which the seat's key. */
export const ENDED_KEY = 'sending-stone:wild-shape-ended'

/** How long an ending is told of on a page opened since, in milliseconds: twelve hours. */
export const ENDED_FOR = 12 * 60 * 60 * 1000

/**
 * The banner when the game ends a Wild Shape (round 0.40.0 §5.11): why, and that the character is
 * itself again, under the page's header, with Dismiss. Shown while the sheet has no form and its
 * last ending wasn't from here, where it's within the last twelve hours or came while this page
 * was open, and newer than the last this browser dismissed for the seat. Nothing before the page
 * has hydrated, as what's dismissed is known only in the browser.
 */
export function WildShapeEnded({
  sheet,
  name,
  seat,
}: Readonly<{
  sheet?: TableSheet
  name: string
  /** The seat's key, which what's dismissed is kept by. */
  seat: string
}>) {
  const hydrated = useHydrated()
  const [dismissed, keep] = useStoredText(`${ENDED_KEY}:${seat}`)
  const block = sheet?.wildShape
  const ended = block?.ended ?? undefined
  // The ending the sheet had as this page first had the druid's Wild Shape, 0 for none: any other
  // came since.
  const [first, setFirst] = useState<number | undefined>(() =>
    block ? (block.ended?.at ?? 0) : undefined,
  )
  if (first === undefined && block) setFirst(block.ended?.at ?? 0)
  if (!hydrated || !block || !ended || sheet?.form) return
  const fresh = ended.at !== first || Date.now() - ended.at < ENDED_FOR
  const after = Number(dismissed) || 0
  const words = endedWords(ended, name, block.hours)
  if (!words || !fresh || ended.at <= after) return
  return (
    <div
      role='status'
      className='flex shrink-0 items-start gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2.5 text-sm md:px-8'
    >
      <Clock aria-hidden className='mt-0.5 size-4 shrink-0 text-warning' />
      <p className='min-w-0 flex-1'>{words}</p>
      <button
        type='button'
        aria-label='Dismiss'
        title='Dismiss'
        onClick={() => {
          keep(String(ended.at))
          document.querySelector<HTMLElement>('#sheet-panel')?.focus()
        }}
        className='-my-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-text-primary/5 hover:text-text-primary sm:size-9'
      >
        <X aria-hidden className='size-4' />
      </button>
    </div>
  )
}
