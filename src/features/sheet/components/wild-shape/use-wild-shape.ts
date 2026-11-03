import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type RefObject,
} from 'react'
import { WILD_SHAPE_SETTLE } from '@/constants/sending-stone'
import { useStoredText } from '@/hooks/use-stored'
import { usableForm, checkWildShape, canReturn } from '@/utils/wild-shape'
import type { WildShapeForms } from '@/features/rolling/types'
import type {
  TableRollState,
  WildShapeInput,
  WildShapeLogged,
} from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type {
  KnownForm,
  BeastEntry,
  SheetWildShape,
  SheetForm,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/** What a command sent from here asked. */
type Asked =
  | { op: 'transform'; form: string }
  | { op: 'revert' }
  | { op: 'learn'; uuid: string; replace: string | null }

/** A command sent from here, by its local id, and what it asked. */
type Sent = Asked & { id: string }

export type Op = Sent['op']

/** Why the last command of an op from here wasn't made, by the reason's key. */
type Refusal = { op: Op; key: string }

/** What the pane's one Wild Shape dialog shows: the picker, the manager, or a Beast to learn. */
export type View =
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
