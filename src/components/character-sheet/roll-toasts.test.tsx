import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { RollToasts } from './roll-toasts'
import type { LocalCheck, LocalUse } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

/** A check, as the page keeps it. */
const check = (id: string, fields: Partial<LocalCheck> = {}): LocalCheck => ({
  kind: 'check',
  id,
  label: `${id} check`,
  total: 17,
  modifier: 3,
  d20s: [14],
  natural: 14,
  extras: [],
  at: 0,
  ...fields,
})

const strength = check('s', { label: 'Strength check' })
const dexterity = check('d', { label: 'Dexterity check', at: 1 })

/** The rolls' ways to the game, by their ids. */
const ways = (...entries: [string, TableRollState][]) => new Map(entries)

const NONE = ways()

/** The toasts' log. */
const log = () => screen.getByRole('log', { name: 'Roll results' })

/** A roll's toast, by its id. */
const toast = (id: string) =>
  document.querySelector<HTMLElement>(`[data-roll-toast="${CSS.escape(id)}"]`)

/** The ids of the toasts showing, top first. */
const shown = () =>
  [...document.querySelectorAll<HTMLElement>('[data-roll-toast]')].map(
    node => node.dataset.rollToast,
  )

/** Lets this many milliseconds pass. */
const wait = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms)
  })

describe('components/character-sheet/roll-toasts', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('C1 says a roll in the log: its name, total, dice and way to the game, with nothing to tab to', () => {
    render(
      <RollToasts
        rolls={[strength]}
        states={ways(['s', { status: 'done', visible: true, total: 17 }])}
        on
      />,
    )

    const roll = within(log()).getByText('Strength check').closest('div')
      ?.parentElement as HTMLElement
    expect(roll).toHaveAttribute('data-roll-toast', 's')
    expect(roll).toHaveTextContent('17Strength checkd20 14 +3At the table: 17')
    expect(within(log()).queryByRole('button')).toBeNull()
    expect(within(log()).queryByRole('link')).toBeNull()
    expect(log().querySelector('[tabindex]')).toBeNull()
  })

  it('C1 shows a use and an ask with their icons, and nothing of a roll never sent', () => {
    const bless: LocalUse = {
      kind: 'use',
      id: 'u',
      label: 'Bless',
      spell: true,
      at: 2,
    }
    render(
      <RollToasts
        rolls={[bless, strength]}
        states={ways(['u', { status: 'sending' }])}
        on
      />,
    )

    expect(toast('u')).toHaveTextContent(
      'BlessSending to your Gamemaster’s game…',
    )
    expect(toast('u')?.querySelector('svg')).toHaveAttribute('aria-hidden')
    expect(toast('s')).toHaveTextContent('17Strength checkd20 14 +3')
    expect(toast('s')?.querySelectorAll('p')).toHaveLength(2)
  })

  it('C2 shows a toast for four seconds, fading for the last fifth of one', () => {
    render(<RollToasts rolls={[strength]} states={NONE} on />)

    wait(3799)
    expect(toast('s')).not.toHaveAttribute('data-leaving')
    wait(1)
    expect(toast('s')).toHaveAttribute('data-leaving', 'true')
    wait(199)
    expect(toast('s')).toBeInTheDocument()
    wait(1)
    expect(toast('s')).toBeNull()
    expect(log()).toBeInTheDocument()
  })

  it('C3 takes a toast away at once when tapped, leaving the others', () => {
    render(<RollToasts rolls={[dexterity, strength]} states={NONE} on />)
    expect(shown()).toEqual(['d', 's'])

    fireEvent.click(toast('d') as HTMLElement)

    expect(shown()).toEqual(['s'])
  })

  it('C4 says where a roll is at the table in its toast as it goes, giving it its full time once made', () => {
    const { rerender } = render(
      <RollToasts
        rolls={[strength]}
        states={ways(['s', { status: 'sending' }])}
        on
      />,
    )
    const first = toast('s')
    expect(first).toHaveTextContent('Sending to your Gamemaster’s game…')

    wait(1000)
    rerender(
      <RollToasts
        rolls={[strength]}
        states={ways(['s', { status: 'rolling' }])}
        on
      />,
    )
    expect(toast('s')).toBe(first)
    expect(first).toHaveTextContent('Rolling in your Gamemaster’s game…')

    wait(1000)
    rerender(
      <RollToasts
        rolls={[strength]}
        states={ways(['s', { status: 'done', visible: true, total: 18 }])}
        on
      />,
    )
    expect(toast('s')).toBe(first)
    expect(first).toHaveTextContent('At the table: 18')
    expect(
      within(first as HTMLElement).getByText('At the table: 18'),
    ).toHaveClass('text-text-primary')

    wait(3999)
    expect(toast('s')).toBe(first)
    wait(1)
    expect(toast('s')).toBeNull()
  })

  it('C5 pops a toast tapped away up again on top, once its roll is made at the table', () => {
    const { rerender } = render(
      <RollToasts
        rolls={[dexterity, strength]}
        states={ways(['s', { status: 'sending' }])}
        on
      />,
    )
    const first = toast('s')
    fireEvent.click(first as HTMLElement)
    expect(shown()).toEqual(['d'])

    wait(500)
    rerender(
      <RollToasts
        rolls={[dexterity, strength]}
        states={ways(['s', { status: 'refused', reason: 'busy' }])}
        on
      />,
    )

    expect(shown()).toEqual(['s', 'd'])
    expect(toast('s')).not.toBe(first)
    expect(toast('s')).toHaveTextContent(
      'Not made at the table: too many rolls at once. Wait a moment',
    )
    expect(
      within(toast('s') as HTMLElement).getByText(/^Not made/),
    ).toHaveClass('text-warning')
  })

  it('C6 takes no focus as it pops up', () => {
    const { rerender } = render(
      <>
        <button type='button'>Elsewhere</button>
        <RollToasts rolls={[]} states={NONE} on />
      </>,
    )
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    elsewhere.focus()

    rerender(
      <>
        <button type='button'>Elsewhere</button>
        <RollToasts rolls={[strength]} states={NONE} on />
      </>,
    )

    expect(toast('s')).toBeInTheDocument()
    expect(document.activeElement).toBe(elsewhere)
  })

  it('C7 shows none while toasts are off, taking those showing away', () => {
    const { rerender } = render(
      <RollToasts rolls={[strength]} states={NONE} on />,
    )
    expect(toast('s')).toBeInTheDocument()

    rerender(<RollToasts rolls={[strength]} states={NONE} on={false} />)
    expect(screen.queryByRole('log')).toBeNull()
    expect(toast('s')).toBeNull()

    rerender(
      <RollToasts rolls={[dexterity, strength]} states={NONE} on={false} />,
    )
    rerender(<RollToasts rolls={[dexterity, strength]} states={NONE} on />)
    expect(log()).toBeEmptyDOMElement()
  })

  it('C8 drops in from the top of the screen, above the dice, from the page itself, letting taps beside it through', () => {
    const { container } = render(
      <RollToasts rolls={[strength]} states={NONE} on />,
    )

    // Fading only where motion is welcome: elsewhere it shows in full until it goes.
    expect(toast('s')).toHaveClass(
      'motion-safe:animate-toast-in',
      'pointer-events-auto',
      'motion-safe:data-leaving:opacity-0',
    )
    expect(toast('s')).not.toHaveClass('data-leaving:opacity-0')
    const region = log().parentElement as HTMLElement
    // The screen's width across, so taps beside the toasts go through to what's under them.
    expect(region).toHaveClass(
      'fixed',
      'top-[max(0.5rem,env(safe-area-inset-top))]',
      'z-[100001]',
      'pointer-events-none',
    )
    expect(region.parentElement).toBe(document.body)
    expect(container).not.toContainElement(log())
  })

  it('C9 renders nothing on the server, where the setting is not known and there is no body', () => {
    const html = renderToString(
      <RollToasts rolls={[strength]} states={NONE} on />,
    )

    expect(html).toBe('')
  })
})
