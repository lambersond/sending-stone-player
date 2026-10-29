import { useLayoutEffect } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { TurnToast } from './turn-toast'
import { TableApiContext } from '@/hooks/use-table-api'
import { mockTurnCombat } from '@/mocks/sending-stone'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { TableSeat } from '@/types/character'
import type { EndableTurn, TableCombat, TurnUndo } from '@/types/table'

jest.mock('@/hooks/use-table-view', () => ({ POLL_INTERVAL: 3000 }))

/*
 * End Turn's toast (module 0.36.0), as the user's End Turn prototype draws it, given what the
 * page's End Turn and Undo hooks say: each state's words, how long each lasts, Undo, its region.
 */

const thorins = (): EndableTurn => ({
  combatId: 'cmbt1',
  round: 1,
  combatantId: 'c-thorin',
})
const brakkas = (): EndableTurn => ({
  combatId: 'cmbt1',
  round: 1,
  combatantId: 'c-brakka',
  companion: { key: 'wolfBrakka', name: 'Brakka' },
})

/** The combat on Thorin's turn, round 1, unless another current combatant is given. */
const on = (currentId: string, fields: Partial<TableCombat> = {}) =>
  mockTurnCombat({ currentId, ...fields })

type Sent = { turn: EndableTurn; way: TableRollState }

type State = {
  turn?: EndableTurn
  sent?: Sent
  offer?: TurnUndo
  way?: TableRollState & { for: string }
  via?: 'button' | 'hold'
  held?: boolean
  combatShown?: boolean
  combat?: TableCombat
  beside?: boolean
}

const GM: TableSeat = {
  role: 'gm',
  api: '/api/campaigns/c1/seats/s1',
  key: 's1',
}

/**
 * What another part of the page, as the turn panel's heading, finds as the changes of each render
 * that gives it a new combat are made, before any effect runs.
 */
let watching: ((combat: TableCombat | undefined) => void) | undefined
function Watch({ combat }: Readonly<{ combat?: TableCombat }>): undefined {
  useLayoutEffect(() => {
    watching?.(combat)
  }, [combat])
}

const setup = (initial: State = {}, seat?: TableSeat) => {
  const undo = jest.fn()
  const focusTurn = jest.fn()
  const onFoot = jest.fn()
  let state: State = { combat: on('c-thorin'), combatShown: true, ...initial }
  const ui = () => (
    <TableApiContext value={seat}>
      <TurnToast
        ending={{
          turn: state.turn,
          offered: true,
          sent: state.sent,
          end: jest.fn(),
        }}
        undoing={{ offer: state.offer, way: state.way, undo }}
        via={state.via}
        held={state.held ?? false}
        combatShown={state.combatShown ?? true}
        focusTurn={focusTurn}
        combat={state.combat}
        beside={state.beside}
        onFoot={onFoot}
      />
      <Watch combat={state.combat} />
    </TableApiContext>
  )
  const view = render(ui())
  return {
    undo,
    focusTurn,
    onFoot,
    ...view,
    update: (change: State) => {
      state = { ...state, ...change }
      view.rerender(ui())
    },
  }
}

/** The toast's live region, portalled to the page's body. */
const region = () => {
  const found = document.body.querySelector<HTMLElement>('[aria-live]')
  if (!found) throw new Error('No region')
  return found
}

/** The card shown, if any. */
const card = () => document.body.querySelector<HTMLElement>('[data-turn-toast]')

/** The card's words and the line under them. */
const said = () => {
  const shown = card()
  if (!shown) return
  const small = shown.querySelector('small')
  const words = shown.querySelector('p')?.firstChild?.textContent
  return small ? [words, small.textContent] : [words]
}

const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms))

/** Undo offered for Thorin's End Turn `req-1`, which left the combat on Brakka's turn. */
const offerOf = (
  turn: EndableTurn,
  fields: Partial<TurnUndo['left']> = {},
): TurnUndo => ({
  requestId: 'req-1',
  turn,
  left: {
    combatId: 'cmbt1',
    round: 1,
    combatantId: 'c-brakka',
    name: 'Brakka',
    mine: false,
    ...fields,
  },
})

/** Thorin's turn ended by a hold, through to the game ending it and the page moving on. */
const heldToTheEnd = (seat?: TableSeat) => {
  const turn = thorins()
  const view = setup({ turn }, seat)
  view.update({ held: true })
  view.update({
    held: false,
    via: 'hold',
    sent: { turn, way: { status: 'sending' } },
  })
  return { ...view, turn }
}

/** Thorin's turn ended by the button, the game's answer in, and the page on Brakka's turn. */
const endedByButton = () => {
  const turn = thorins()
  const view = setup({ turn })
  view.update({ via: 'button', sent: { turn, way: { status: 'sending' } } })
  view.update({
    sent: { turn, way: { status: 'done', requestId: 'req-1' } },
    combat: on('c-brakka'),
    offer: offerOf(turn),
  })
  return { ...view, turn }
}

describe('components/game-table/turn-toast', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    jest.useRealTimers()
    watching = undefined
  })

  it('has its region there, empty, before any toast: polite, read whole, with no role', () => {
    setup()
    const live = region()
    expect(live).toBeEmptyDOMElement()
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveAttribute('aria-atomic', 'true')
    expect(live).not.toHaveAttribute('role')
    expect(live.parentElement).toBe(document.body)
    expect(live).toHaveClass(
      'pointer-events-none',
      'fixed',
      'inset-x-0',
      'top-[max(0.5rem,env(safe-area-inset-top))]',
      'z-[100001]',
      'flex',
      'justify-center',
      'pr-[max(1rem,env(safe-area-inset-right))]',
      'pl-[max(1rem,env(safe-area-inset-left))]',
    )
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps to the sheet’s side of the screen where the sheet is beside the column, from 1024 pixels wide', () => {
    // The column is clamp(320px, 40%, 500px) of the page, which is the screen's width there: so the
    // toast, centred in what's left, stays clear of the column's Combat tab a hold presses.
    const clear =
      'lg:pr-[calc(clamp(320px,40%,500px)_+_max(1rem,env(safe-area-inset-right)))]'
    const { update } = setup()
    expect(region()).not.toHaveClass(clear)
    update({ beside: true })
    expect(region()).toHaveClass(
      clear,
      'pr-[max(1rem,env(safe-area-inset-right))]',
      'justify-center',
    )
  })

  it('portals nothing before the page has hydrated', () => {
    const html = renderToString(
      <TurnToast
        ending={{ offered: false, end: jest.fn() }}
        undoing={{ undo: jest.fn() }}
        held={false}
        combatShown
        focusTurn={jest.fn()}
      />,
    )
    expect(html).toBe('')
  })

  it('says a hold past half a second is ending the turn, and goes at once when let go early', () => {
    const turn = thorins()
    const { update } = setup({ turn })
    update({ held: true })
    expect(said()).toEqual([
      'Ending your turn…',
      'Keep holding to end it, or let go to keep it.',
    ])
    update({ held: false })
    expect(card()).toBeNull()
    expect(region()).toBeEmptyDOMElement()
  })

  it('follows a hold’s End Turn on its way, then says it ended, who acts now, and offers Undo', () => {
    const { update, turn } = heldToTheEnd()
    expect(said()).toEqual([
      'Ending your turn…',
      'Sending to your Gamemaster’s game…',
    ])
    update({ sent: { turn, way: { status: 'rolling', requestId: 'req-1' } } })
    expect(said()).toEqual([
      'Ending your turn…',
      'Ending it in your Gamemaster’s game…',
    ])
    // Made, the page still on the turn: still on its way.
    update({ sent: { turn, way: { status: 'done', requestId: 'req-1' } } })
    expect(said()).toEqual([
      'Ending your turn…',
      'Ending it in your Gamemaster’s game…',
    ])
    update({ combat: on('c-brakka'), offer: offerOf(turn) })
    expect(said()).toEqual(['Your turn has ended.', 'Brakka is acting.'])
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('says a companion’s turn by its name', () => {
    const turn = brakkas()
    const { update } = setup({ turn, combat: on('c-brakka') })
    update({ held: true })
    expect(said()).toEqual([
      'Ending Brakka’s turn…',
      'Keep holding to end it, or let go to keep it.',
    ])
    update({
      held: false,
      via: 'hold',
      sent: { turn, way: { status: 'sending' } },
    })
    expect(said()?.[0]).toBe('Ending Brakka’s turn…')
    update({
      sent: { turn, way: { status: 'done', requestId: 'req-1' } },
      combat: on('c-goblin'),
      offer: {
        requestId: 'req-1',
        turn,
        left: {
          combatId: 'cmbt1',
          round: 1,
          combatantId: 'c-goblin',
          name: 'Goblin',
          mine: false,
        },
      },
    })
    expect(said()).toEqual(['Brakka’s turn has ended.', 'Goblin is acting.'])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(said()).toEqual(['Taking Brakka’s turn back…'])
  })

  it('says the Gamemaster’s game is their own at their seat', () => {
    heldToTheEnd(GM)
    expect(said()).toEqual(['Ending your turn…', 'Sending to your game…'])
  })

  it('says it’s the player’s turn where their own character acts next', () => {
    const turn = brakkas()
    const { update } = setup({ turn, combat: on('c-brakka') })
    update({ via: 'button', sent: { turn, way: { status: 'sending' } } })
    update({
      sent: { turn, way: { status: 'done', requestId: 'req-1' } },
      combat: on('c-thorin', { round: 2 }),
      offer: {
        requestId: 'req-1',
        turn,
        left: {
          combatId: 'cmbt1',
          round: 2,
          combatantId: 'c-thorin',
          name: 'Thorin',
          mine: true,
        },
      },
    })
    expect(said()).toEqual(['Brakka’s turn has ended.', 'It’s your turn.'])
  })

  it('shows nothing while the button’s End Turn is on its way, then says it ended once the page moves on', () => {
    const turn = thorins()
    const { update } = setup({ turn })
    update({ via: 'button', sent: { turn, way: { status: 'sending' } } })
    expect(card()).toBeNull()
    update({ sent: { turn, way: { status: 'done', requestId: 'req-1' } } })
    expect(card()).toBeNull()
    update({ combat: on('c-brakka'), offer: offerOf(turn) })
    expect(said()).toEqual(['Your turn has ended.', 'Brakka is acting.'])
  })

  it('names no one where no one the page shows acts next', () => {
    const turn = thorins()
    const { update } = setup({ turn })
    update({ via: 'button', sent: { turn, way: { status: 'sending' } } })
    update({
      sent: { turn, way: { status: 'done', requestId: 'req-1' } },
      combat: mockTurnCombat({ currentId: undefined }),
    })
    expect(said()).toEqual(['Your turn has ended.'])
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('offers Undo by name, as a 44 pixel target, taking the turn back', () => {
    const { undo } = endedByButton()
    const button = screen.getByRole('button', { name: 'Undo' })
    expect(button).toHaveClass(
      'min-h-11',
      'min-w-11',
      'rounded-[10px]',
      'border',
      'border-border',
      'bg-transparent',
      'px-3',
      'font-semibold',
    )
    fireEvent.click(button)
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('goes 8 seconds after it shows with Undo', () => {
    endedByButton()
    wait(7999)
    expect(card()).not.toBeNull()
    wait(1)
    expect(card()).toBeNull()
  })

  it('goes 5 seconds after it shows without Undo', () => {
    const turn = thorins()
    const { update } = setup({ turn })
    update({ via: 'button', sent: { turn, way: { status: 'sending' } } })
    update({
      sent: { turn, way: { status: 'done', requestId: 'req-1' } },
      combat: on('c-brakka'),
    })
    expect(said()).toEqual(['Your turn has ended.', 'Brakka is acting.'])
    wait(4999)
    expect(card()).not.toBeNull()
    wait(1)
    expect(card()).toBeNull()
  })

  it('pauses its time while the pointer is over it, then goes after what was left', () => {
    endedByButton()
    wait(3000)
    fireEvent.pointerEnter(card() as HTMLElement)
    wait(20_000)
    expect(card()).not.toBeNull()
    fireEvent.pointerLeave(card() as HTMLElement)
    wait(4999)
    expect(card()).not.toBeNull()
    wait(1)
    expect(card()).toBeNull()
  })

  it('pauses its time while focus is in it, then goes after what was left', () => {
    render(<button type='button'>Elsewhere</button>)
    endedByButton()
    wait(6000)
    const undo = screen.getByRole('button', { name: 'Undo' })
    act(() => undo.focus())
    wait(20_000)
    expect(card()).not.toBeNull()
    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus())
    wait(1999)
    expect(card()).not.toBeNull()
    wait(1)
    expect(card()).toBeNull()
  })

  it('goes at once, silently, once Undo is no longer offered, handing focus on', () => {
    const { update, focusTurn } = endedByButton()
    act(() => screen.getByRole('button', { name: 'Undo' }).focus())
    update({ offer: undefined, combat: on('c-goblin') })
    expect(card()).toBeNull()
    expect(focusTurn).toHaveBeenCalledTimes(1)
  })

  it('says Undo is taking the turn back until its way settles and the turn shows again', () => {
    const { update, turn, focusTurn } = endedByButton()
    act(() => screen.getByRole('button', { name: 'Undo' }).focus())
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    // Its button goes from under focus, which is handed on.
    expect(focusTurn).toHaveBeenCalledTimes(1)
    expect(said()).toEqual(['Taking your turn back…'])
    update({ offer: undefined, way: { status: 'sending', for: 'req-1' } })
    update({ way: { status: 'rolling', for: 'req-1', requestId: 'req-2' } })
    expect(said()).toEqual(['Taking your turn back…'])
    // Made, the page still on Brakka's turn.
    update({ way: { status: 'done', for: 'req-1', requestId: 'req-2' } })
    expect(said()).toEqual(['Taking your turn back…'])
    wait(5000)
    expect(said()).toEqual(['Taking your turn back…'])
    // The page shows Thorin's turn again: it goes.
    update({ combat: on(turn.combatantId) })
    expect(card()).toBeNull()
  })

  it('goes as the page shows the turn back, though Undo’s way hasn’t yet said it’s made', () => {
    const { update, turn } = endedByButton()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    update({
      offer: undefined,
      way: { status: 'rolling', for: 'req-1', requestId: 'req-2' },
    })
    expect(said()).toEqual(['Taking your turn back…'])
    // The table's poll shows Thorin's turn again before Undo's own says the game made it.
    update({ combat: on(turn.combatantId) })
    expect(card()).toBeNull()
    update({ way: { status: 'done', for: 'req-1', requestId: 'req-2' } })
    wait(6000)
    expect(card()).toBeNull()
  })

  it('goes in the very render in which the page shows the turn back, never one after it', () => {
    const { update, turn } = endedByButton()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    update({
      offer: undefined,
      way: { status: 'done', for: 'req-1', requestId: 'req-2' },
    })
    const seen: string[] = []
    watching = combat => {
      seen.push(`${combat?.currentId}: ${card()?.dataset.turnToast ?? 'none'}`)
    }
    update({ combat: on(turn.combatantId) })
    expect(seen).toEqual(['c-thorin: none'])
    expect(card()).toBeNull()
  })

  it('goes all the same two polls after Undo is made where the page still doesn’t show the turn back', () => {
    const { update } = endedByButton()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    update({
      offer: undefined,
      way: { status: 'done', for: 'req-1', requestId: 'req-2' },
    })
    wait(5999)
    expect(said()).toEqual(['Taking your turn back…'])
    wait(1)
    expect(card()).toBeNull()
  })

  it.each<[string, TableRollState & { for: string }, string]>([
    [
      'refused',
      { status: 'refused', reason: 'not-undoable', for: 'req-1' },
      'It can’t be taken back now.',
    ],
    [
      'refused as moved on',
      { status: 'refused', reason: 'moved', for: 'req-1' },
      'The turn had already moved on.',
    ],
    [
      'not picked up',
      { status: 'expired', for: 'req-1', requestId: 'req-2' },
      'Your Gamemaster’s game didn’t pick it up.',
    ],
  ])(
    'says why Undo wasn’t made where it was %s, for 5 seconds',
    (_, way, line) => {
      const { update } = endedByButton()
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      update({ offer: undefined, way })
      expect(said()).toEqual(['Your turn wasn’t taken back.', line])
      wait(4999)
      expect(card()).not.toBeNull()
      wait(1)
      expect(card()).toBeNull()
    },
  )

  it('says a companion’s turn wasn’t taken back by its name', () => {
    const turn = brakkas()
    const { update } = setup({ turn, combat: on('c-brakka') })
    update({ via: 'button', sent: { turn, way: { status: 'sending' } } })
    update({
      sent: { turn, way: { status: 'done', requestId: 'req-1' } },
      combat: on('c-goblin'),
      offer: { ...offerOf(turn), turn },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    update({
      offer: undefined,
      way: { status: 'refused', reason: 'busy', for: 'req-1' },
    })
    expect(said()).toEqual([
      'Brakka’s turn wasn’t taken back.',
      'Too many rolls at once.',
    ])
  })

  it('never says again that an End Turn ended once it was taken back', () => {
    const { update, turn } = endedByButton()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    update({
      offer: undefined,
      way: { status: 'done', for: 'req-1', requestId: 'req-2' },
    })
    update({ combat: on('c-thorin') })
    expect(card()).toBeNull()
    // The Gamemaster moves the turn on again; the End Turn sent last is still that one.
    update({ combat: on('c-brakka') })
    expect(card()).toBeNull()
    wait(10_000)
    update({
      combat: on('c-thorin'),
      sent: { turn, way: { status: 'done', requestId: 'req-1' } },
    })
    wait(10_000)
    expect(card()).toBeNull()
  })

  it('says an End Turn ended, with no line or Undo, where the page still shows its turn two polls on', () => {
    const turn = thorins()
    const { update } = setup({ turn })
    update({ via: 'button', sent: { turn, way: { status: 'sending' } } })
    update({ sent: { turn, way: { status: 'done', requestId: 'req-1' } } })
    wait(5999)
    expect(card()).toBeNull()
    // Another poll, the same turn.
    update({ combat: on('c-thorin') })
    wait(1)
    expect(said()).toEqual(['Your turn has ended.'])
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    wait(4999)
    expect(card()).not.toBeNull()
    wait(1)
    expect(card()).toBeNull()
    // Told once: the page moving on after says nothing more.
    update({ combat: on('c-brakka') })
    expect(card()).toBeNull()
  })

  it.each<[string, TableRollState, string]>([
    [
      'refused as moved on',
      { status: 'refused', reason: 'moved' },
      'The turn had already moved on.',
    ],
    [
      'refused as too many at once',
      { status: 'refused', reason: 'busy' },
      'Too many rolls at once.',
    ],
    [
      'not picked up',
      { status: 'expired', requestId: 'req-1' },
      'Your Gamemaster’s game didn’t pick it up.',
    ],
    [
      'lost',
      { status: 'lost', requestId: 'req-1' },
      'No answer from your Gamemaster’s game.',
    ],
  ])(
    'says why a hold’s End Turn wasn’t made where it was %s, for 5 seconds',
    (_, way, line) => {
      const { update, turn } = heldToTheEnd()
      update({ sent: { turn, way } })
      expect(said()).toEqual(['Your turn wasn’t ended.', line])
      wait(4999)
      expect(card()).not.toBeNull()
      wait(1)
      expect(card()).toBeNull()
    },
  )

  it('says why the button’s End Turn wasn’t made only where the combat isn’t shown to say it', () => {
    const turn = thorins()
    const { update } = setup({ turn })
    update({ via: 'button', sent: { turn, way: { status: 'sending' } } })
    update({ sent: { turn, way: { status: 'refused', reason: 'busy' } } })
    expect(card()).toBeNull()

    const again = { ...thorins() }
    update({ sent: { turn: again, way: { status: 'sending' } } })
    update({ combatShown: false })
    update({
      sent: { turn: again, way: { status: 'expired', requestId: 'req-2' } },
    })
    expect(said()).toEqual([
      'Your turn wasn’t ended.',
      'Your Gamemaster’s game didn’t pick it up.',
    ])
  })

  it('says each End Turn not made once, however often its way is heard again', () => {
    const { update, turn } = heldToTheEnd()
    update({
      sent: {
        turn,
        way: { status: 'failed', reason: 'timeout', requestId: 'req-1' },
      },
    })
    expect(said()?.[0]).toBe('Your turn wasn’t ended.')
    wait(5000)
    expect(card()).toBeNull()
    update({
      sent: {
        turn,
        way: { status: 'failed', reason: 'timeout', requestId: 'req-1' },
      },
    })
    expect(card()).toBeNull()
  })

  it('shows one card at a time, a new one in the last one’s place', () => {
    const { update, turn } = endedByButton()
    expect(document.body.querySelectorAll('[data-turn-toast]')).toHaveLength(1)
    // Brakka's turn is held next: the hold's words replace the last.
    update({ turn: brakkas(), held: true })
    expect(document.body.querySelectorAll('[data-turn-toast]')).toHaveLength(1)
    expect(said()?.[0]).toBe('Ending Brakka’s turn…')
    expect(turn).toBeDefined()
  })

  it('puts back the card a hold took the place of where it’s let go early, Undo and all, for what was left of its time', () => {
    const { update, undo } = endedByButton()
    wait(2000)
    // Brakka's turn, the seat's too, held past half a second, then let go.
    update({ turn: brakkas(), held: true })
    expect(said()?.[0]).toBe('Ending Brakka’s turn…')
    update({ held: false })
    expect(said()).toEqual(['Your turn has ended.', 'Brakka is acting.'])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('puts back the card a hold took the place of for what was left of its time, and no longer', () => {
    const { update } = endedByButton()
    wait(2000)
    update({ turn: brakkas(), held: true })
    update({ held: false })
    wait(5999)
    expect(card()).not.toBeNull()
    wait(1)
    expect(card()).toBeNull()
  })

  it('puts back no card whose Undo was withdrawn under the hold', () => {
    const { update } = endedByButton()
    update({ turn: brakkas(), held: true })
    // The Gamemaster moves the turn on: Undo is withdrawn and the hold stopped.
    update({
      turn: undefined,
      held: false,
      offer: undefined,
      combat: on('c-goblin'),
    })
    expect(card()).toBeNull()
  })

  it('has no close button, and does nothing when tapped', () => {
    const { update, turn } = heldToTheEnd()
    update({ sent: { turn, way: { status: 'refused', reason: 'moved' } } })
    expect(screen.queryByRole('button')).toBeNull()
    fireEvent.click(card() as HTMLElement)
    expect(card()).not.toBeNull()
  })

  it('animates in only where motion is welcome, drawn as the prototype draws it', () => {
    endedByButton()
    const shown = card() as HTMLElement
    expect(shown).toHaveClass(
      'motion-safe:animate-toast-in',
      'pointer-events-auto',
      'max-w-[420px]',
      'rounded-2xl',
      'border-border',
      'bg-card',
      'text-sm',
    )
    expect(
      shown.className.split(' ').filter(name => name.includes('animate')),
    ).toEqual(['motion-safe:animate-toast-in'])
    expect(shown.querySelector('small')).toHaveClass(
      'block',
      'text-xs',
      'text-text-secondary',
    )
  })

  it('tells where the card ends as it shows, and that it has gone', () => {
    const { onFoot, update, turn } = heldToTheEnd()
    expect(onFoot).toHaveBeenLastCalledWith(0)
    update({ sent: { turn, way: { status: 'refused', reason: 'moved' } } })
    wait(5000)
    expect(onFoot.mock.lastCall).toEqual([undefined])
  })

  it('tells where the card comes to rest, not where its entry draws it', () => {
    const { onFoot } = heldToTheEnd()
    const shown = card() as HTMLElement
    // As the card's entry draws it: 8 pixels up, which moves its drawn box but not its box as
    // laid out, 58 pixels tall at the top of its region, 64 pixels down.
    region().getBoundingClientRect = () =>
      ({ top: 64, bottom: 64, height: 0 }) as DOMRect
    shown.getBoundingClientRect = () =>
      ({ top: 56, bottom: 114, height: 58 }) as DOMRect
    Object.defineProperty(shown, 'offsetHeight', { value: 58 })
    act(() => {
      globalThis.dispatchEvent(new Event('resize'))
    })
    expect(onFoot).toHaveBeenLastCalledWith(122)
  })
})
