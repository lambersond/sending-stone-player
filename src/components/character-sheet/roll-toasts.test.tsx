/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { RollToasts } from './roll-toasts'
import { RollTray } from './roll-tray'
import { TurnToastContext } from '@/components/game-table/turn-toast'
import {
  gmRollsOf,
  useGmRolls,
  withGmRolls,
  type TableRollState,
} from '@/hooks/use-table-rolls'
import type {
  LocalCheck,
  LocalDamage,
  LocalRoll,
  LocalUse,
} from '@/hooks/use-sheet-roller'
import type { GmRollView } from '@/types/roll'
import type { TableCombat } from '@/types/table'

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

/** Damage the player rolled, its dice thrown here. */
const rolled = (id: string, fields: Partial<LocalDamage>): LocalDamage => ({
  kind: 'damage',
  id,
  label: `${id} damage`,
  total: 9,
  critical: false,
  healing: false,
  parts: [
    {
      type: 'Slashing',
      total: 9,
      terms: [{ text: '1d8', values: [5], value: 5 }],
    },
  ],
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

/** A user that waits as the fake timers do. */
const player = () =>
  userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

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
    // Kept to two lines, as the player's own area attack lists its targets after it.
    expect(
      within(first as HTMLElement).getByText('At the table: 18'),
    ).toHaveClass('text-text-primary', 'line-clamp-2')

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

  it('starts below the turn’s toast while one shows, from module 0.36.0', () => {
    const header = document.createElement('header')
    document.body.append(header)
    jest
      .spyOn(header, 'getBoundingClientRect')
      .mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 390, height: 56 }))
    const toasts = (foot?: number) => (
      <TurnToastContext value={foot}>
        <RollToasts rolls={[strength]} states={NONE} on header={header} />
      </TurnToastContext>
    )
    const { rerender } = render(toasts())
    // Below the header, 56 pixels tall, by the gap.
    expect(log().parentElement).toHaveStyle({ top: '64px' })
    // The turn's toast ends 120 pixels down: below it, by the same gap.
    rerender(toasts(120))
    expect(log().parentElement).toHaveStyle({ top: '128px' })
    // One that ends above their own top changes nothing.
    rerender(toasts(30))
    expect(log().parentElement).toHaveStyle({ top: '64px' })
    rerender(toasts())
    expect(log().parentElement).toHaveStyle({ top: '64px' })
    header.remove()
  })

  it('C23 keeps a stack taller than the room below its top on the screen, scrolling it there, as on a phone turned sideways', () => {
    render(<RollToasts rolls={[strength, dexterity]} states={NONE} on />)

    const region = log().parentElement as HTMLElement
    // As tall as the room down to the bottom of the screen, the toasts at its top, scrolled by a
    // finger or a wheel on them, with no scrollbar at the screen's edge, which taps go through.
    expect(region).toHaveClass(
      'bottom-0',
      'items-start',
      'overflow-y-auto',
      '[scrollbar-width:none]',
      'pointer-events-none',
    )
    // The 8 pixels above them inside it, which their slide drops through, so that scrolled they go
    // under the row of tabs' edge, not over it; and room below for their shadow.
    expect(region).toHaveClass('-mt-2', 'pt-2', 'pb-8')
  })

  it('C9 renders nothing on the server, where the setting is not known and there is no body', () => {
    const html = renderToString(
      <RollToasts rolls={[strength]} states={NONE} on />,
    )

    expect(html).toBe('')
  })

  describe('one that waits for the player', () => {
    const attack = check('a', { label: 'Longsword attack', total: 19 })
    const preview = {
      critical: false,
      plannable: true,
      rolls: [
        {
          formula: '1d8 + 4',
          type: 'slashing',
          dice: [{ faces: 8, number: 1 }],
        },
      ],
    }
    /** The game's answer to the attack: a hit, its damage still to roll. */
    const hit = (fields: Partial<TableRollState> = {}): TableRollState => ({
      status: 'done',
      visible: true,
      total: 19,
      requestId: 'req-1',
      attack: { critical: false, fumble: false, outcome: 'hit' },
      damage: preview,
      ...fields,
    })

    /** The game's answer to an area attack at two, which hit one. */
    const area = (damage: TableRollState['damage']): TableRollState =>
      hit({
        attack: {
          critical: false,
          fumble: false,
          outcome: null,
          targets: [
            { combatId: 'c1', combatantId: 'g1', outcome: 'hit' },
            { combatId: 'c1', combatantId: 'g2', outcome: 'miss' },
          ],
        },
        targetNames: { g1: 'Goblin', g2: 'Hobgoblin' },
        damage,
      })

    it('C10 holds the damage to roll, rolled as the tray rolls it, with a × to close it', async () => {
      const user = player()
      const rollDamage = jest.fn()
      render(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit()])}
          on
          rollDamage={rollDamage}
        />,
      )

      const held = toast('a') as HTMLElement
      expect(held).toHaveAttribute('data-waits', 'true')
      expect(within(held).getByRole('button', { name: 'Dismiss' })).toBeTruthy()
      await user.click(
        within(held).getByRole('button', { name: 'Roll damage' }),
      )
      expect(rollDamage).toHaveBeenCalledTimes(1)

      // The tray rolls it with the same arguments.
      const trayRolls = jest.fn()
      render(
        <RollTray
          rolls={[attack]}
          rolling={false}
          table={{
            states: ways(['a', hit()]),
            available: true,
            sending: true,
            rollDamage: trayRolls,
          }}
        />,
      )
      await user.click(
        within(screen.getByRole('region', { name: 'Your rolls' })).getByRole(
          'button',
          { name: 'Roll damage' },
        ),
      )
      expect(rollDamage.mock.calls).toEqual(trayRolls.mock.calls)
      // On the toast's tint, the button is the card's own colour, for its words to read; the
      // tray's is as it was.
      expect(
        within(held).getByRole('button', { name: 'Roll damage' }),
      ).toHaveClass('bg-card', 'text-damage')
      expect(
        within(screen.getByRole('region', { name: 'Your rolls' })).getByRole(
          'button',
          { name: 'Roll damage' },
        ),
      ).toHaveClass('bg-damage/15', 'text-damage')
      expect(rollDamage).toHaveBeenCalledWith('Longsword', {
        use: 'req-1',
        damage: preview,
      })
      // Rolling it from the toast left it there, for the game to say it's rolled.
      expect(toast('a')).toBe(held)
    })

    it('C11 offers each kind of damage to choose, and the damage menu, which opens in the toast', async () => {
      const user = player()
      const rollDamage = jest.fn()
      const orb = {
        ...preview,
        rolls: [
          {
            formula: '3d8',
            type: 'acid',
            types: [
              { key: 'acid', label: 'Acid' },
              { key: 'fire', label: 'Fire' },
            ],
            dice: [{ faces: 8, number: 3 }],
          },
        ],
      }
      const orbAttack = check('a', { label: 'Chromatic Orb attack' })
      const { rerender } = render(
        <RollToasts
          rolls={[orbAttack]}
          states={ways(['a', hit({ damage: orb })])}
          on
          rollDamage={rollDamage}
        />,
      )
      const held = toast('a') as HTMLElement
      expect(held).toHaveTextContent('Choose its kind of damage:AcidFire')
      expect(
        within(held).queryByRole('button', { name: 'Roll damage' }),
      ).toBeNull()
      await user.click(
        within(held).getByRole('button', { name: 'Roll Fire damage' }),
      )
      expect(rollDamage).toHaveBeenLastCalledWith(
        'Chromatic Orb',
        { use: 'req-1', damage: orb },
        'fire',
      )

      rerender(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit()])}
          on
          rollDamage={rollDamage}
          modifies
        />,
      )
      fireEvent.contextMenu(
        within(toast('a') as HTMLElement).getByRole('button', {
          name: 'Roll damage',
        }),
      )
      const menu = screen.getByRole('menu', {
        name: 'Longsword damage 1d8 + 4',
      })
      expect(toast('a')).toContainElement(menu)
      // Not read out by the log as it opens, nor the dialog that changes the damage.
      expect(menu.closest('[aria-live]')).toHaveAttribute('aria-live', 'off')
      await user.click(
        within(menu).getByRole('menuitem', { name: 'Roll maximum damage' }),
      )
      expect(rollDamage).toHaveBeenLastCalledWith(
        'Longsword',
        { use: 'req-1', damage: preview },
        undefined,
        { maximize: true },
      )
      expect(toast('a')).toBeInTheDocument()
      fireEvent.contextMenu(
        within(toast('a') as HTMLElement).getByRole('button', {
          name: 'Roll damage',
        }),
      )
      await user.click(screen.getByRole('menuitem', { name: 'Modify damage…' }))
      const dialog = screen.getByRole('dialog', { name: 'Modify damage' })
      expect(toast('a')).toContainElement(dialog)
      expect(dialog.closest('[aria-live]')).toHaveAttribute('aria-live', 'off')
    })

    it('C12 never goes by itself, nor when tapped, but for its ×', () => {
      render(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit()])}
          on
          rollDamage={jest.fn()}
        />,
      )

      wait(60_000)
      expect(toast('a')).not.toHaveAttribute('data-leaving')
      fireEvent.click(toast('a') as HTMLElement)
      fireEvent.click(
        within(toast('a') as HTMLElement).getByText('Longsword attack'),
      )
      expect(toast('a')).toBeInTheDocument()
      expect(toast('a')).not.toHaveClass('cursor-pointer')
    })

    it('C13 is never dropped by the cap, the oldest of the others going instead', () => {
      const others = ['b', 'c', 'd'].map((id, at) => check(id, { at: at + 1 }))
      const { rerender } = render(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit()])}
          on
          rollDamage={jest.fn()}
        />,
      )
      for (const at of others.keys()) {
        rerender(
          <RollToasts
            rolls={[...others.slice(0, at + 1).toReversed(), attack]}
            states={ways(['a', hit()])}
            on
            rollDamage={jest.fn()}
          />,
        )
      }

      expect(shown()).toEqual(['d', 'c', 'a'])
    })

    it('C20 shows and says a roll that pops up over three that wait, for its four seconds', () => {
      // Attacks that hit, their damage to roll.
      const attacks = ['a1', 'a2', 'a3'].map((id, at) =>
        check(id, { label: `Attack ${at + 1}`, at }),
      )
      const hits = attacks.map(({ id }): [string, TableRollState] => [
        id,
        hit(),
      ])
      const save = check('s', { label: 'Dexterity saving throw', at: 3 })
      const toasting = (
        rolls: LocalCheck[],
        ...more: [string, TableRollState][]
      ) => (
        <RollToasts
          rolls={rolls}
          states={ways(...hits, ...more)}
          on
          rollDamage={jest.fn()}
        />
      )
      const { rerender } = render(toasting([attacks[0]]))
      for (const at of [1, 2]) {
        wait(100)
        rerender(toasting(attacks.slice(0, at + 1).toReversed()))
      }
      expect(shown()).toEqual(['a3', 'a2', 'a1'])
      const rolls = [save, ...attacks.toReversed()]

      wait(100)
      rerender(toasting(rolls, ['s', { status: 'sending' }]))
      expect(shown()).toEqual(['s', 'a3', 'a2', 'a1'])
      expect(log()).toHaveTextContent('Dexterity saving throw')
      wait(1000)
      rerender(
        toasting(rolls, ['s', { status: 'done', visible: true, total: 12 }]),
      )
      expect(shown()).toEqual(['s', 'a3', 'a2', 'a1'])
      expect(toast('s')).toHaveTextContent('At the table: 12')

      wait(3999)
      expect(toast('s')).toBeInTheDocument()
      wait(1)
      expect(shown()).toEqual(['a3', 'a2', 'a1'])
    })

    it("C14 goes for good when closed by its ×, as the game's answer comes again", () => {
      const later = check('b', { at: 1 })
      const { rerender } = render(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit()])}
          on
          rollDamage={jest.fn()}
        />,
      )

      fireEvent.click(
        within(toast('a') as HTMLElement).getByRole('button', {
          name: 'Dismiss',
        }),
      )
      expect(toast('a')).toBeNull()
      const again = () =>
        rerender(
          <RollToasts
            rolls={[later, attack]}
            states={ways(['a', hit()])}
            on
            rollDamage={jest.fn()}
          />,
        )
      wait(1000)
      again()
      expect(shown()).toEqual(['b'])

      // The later roll has had its four seconds; the attack never comes back.
      wait(10_000)
      again()
      wait(0)
      expect(shown()).toEqual([])
    })

    it('C15 goes at once, with its fade, as its damage is rolled', () => {
      const { rerender } = render(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit()])}
          on
          rollDamage={jest.fn()}
        />,
      )
      wait(5000)

      rerender(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit({ damaged: true })])}
          on
          rollDamage={jest.fn()}
        />,
      )
      wait(0)

      expect(toast('a')).toHaveAttribute('data-leaving', 'true')
      expect(within(toast('a') as HTMLElement).queryByRole('button')).toBeNull()
      wait(200)
      expect(toast('a')).toBeNull()
    })

    it('C15b starts its fade as its damage is rolled, not a timer later, fading for all 200 ms', () => {
      const { rerender } = render(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit()])}
          on
          rollDamage={jest.fn()}
        />,
      )
      wait(5000)

      rerender(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit({ damaged: true })])}
          on
          rollDamage={jest.fn()}
        />,
      )

      expect(toast('a')).toHaveAttribute('data-leaving', 'true')
      wait(199)
      expect(toast('a')).toBeInTheDocument()
      wait(1)
      expect(toast('a')).toBeNull()
    })

    it('C15c takes away one whose time passed while timers were held up, once the rolls change', () => {
      const { rerender } = render(
        <RollToasts
          rolls={[strength]}
          states={NONE}
          on
          rollDamage={jest.fn()}
        />,
      )
      expect(toast('s')).toBeInTheDocument()

      // Five seconds on the clock, its timers not yet run, as on a busy page.
      jest.setSystemTime(Date.now() + 5000)
      rerender(
        <RollToasts
          rolls={[dexterity, strength]}
          states={NONE}
          on
          rollDamage={jest.fn()}
        />,
      )
      wait(0)

      expect(shown()).toEqual(['d'])
    })

    it('C16 takes its four seconds from when it stops waiting otherwise', () => {
      const { rerender } = render(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit()])}
          on
          rollDamage={jest.fn()}
        />,
      )
      wait(5000)

      rerender(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', hit({ damage: null })])}
          on
          rollDamage={jest.fn()}
        />,
      )

      expect(toast('a')).not.toHaveAttribute('data-waits')
      // Not at once, as when its damage is rolled.
      wait(0)
      wait(200)
      expect(toast('a')).not.toHaveAttribute('data-leaving')
      wait(3799)
      expect(toast('a')).toBeInTheDocument()
      wait(1)
      expect(toast('a')).toBeNull()
    })

    it('C17 takes no focus as it pops up, its buttons a tab away', async () => {
      const user = player()
      const { rerender } = render(
        <>
          <button type='button'>Elsewhere</button>
          <RollToasts rolls={[]} states={NONE} on rollDamage={jest.fn()} />
        </>,
      )
      const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
      elsewhere.focus()

      rerender(
        <>
          <button type='button'>Elsewhere</button>
          <RollToasts
            rolls={[attack]}
            states={ways(['a', hit()])}
            on
            rollDamage={jest.fn()}
          />
        </>,
      )

      expect(document.activeElement).toBe(elsewhere)
      await user.tab()
      expect(document.activeElement).toHaveAccessibleName('Roll damage')
      await user.tab()
      expect(document.activeElement).toHaveAccessibleName('Dismiss')
    })

    it('C18 says whom an area attack hit, whether it waits or not', () => {
      const targets = () =>
        within(
          within(toast('a') as HTMLElement).getByRole('list', {
            name: 'Targets',
          }),
        )
          .getAllByRole('listitem')
          .map(item => item.textContent)
      const { rerender } = render(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', area(preview)])}
          on
          rollDamage={jest.fn()}
        />,
      )
      expect(toast('a')).toHaveAttribute('data-waits', 'true')
      expect(targets()).toEqual(['Goblin: Hit', 'Hobgoblin: Miss'])

      rerender(
        <RollToasts
          rolls={[attack]}
          states={ways(['a', area(null)])}
          on
          rollDamage={jest.fn()}
        />,
      )
      expect(toast('a')).not.toHaveAttribute('data-waits')
      expect(targets()).toEqual(['Goblin: Hit', 'Hobgoblin: Miss'])
    })

    describe('C21 after a miss', () => {
      /** An area attack's outcome at each of its two targets. */
      const outcomes = (first: 'hit' | 'miss', second: 'hit' | 'miss') =>
        hit({
          attack: {
            critical: false,
            fumble: false,
            outcome: null,
            targets: [
              { combatId: 'c1', combatantId: 'g1', outcome: first },
              { combatId: 'c1', combatantId: 'g2', outcome: second },
            ],
          },
          targetNames: { g1: 'Goblin', g2: 'Hobgoblin' },
        })

      it.each<[string, TableRollState]>([
        [
          'an attack that missed',
          hit({ attack: { critical: false, fumble: false, outcome: 'miss' } }),
        ],
        ['an area attack that missed everyone', outcomes('miss', 'miss')],
      ])(
        '%s goes four seconds after the game says so, holding no damage to roll nor ×, its tap closing it',
        (_, missed) => {
          const toasting = (state: TableRollState) => (
            <RollToasts
              rolls={[attack]}
              states={ways(['a', state])}
              on
              rollDamage={jest.fn()}
            />
          )
          const { rerender } = render(toasting({ status: 'sending' }))
          wait(1000)
          rerender(toasting(missed))

          expect(toast('a')).not.toHaveAttribute('data-waits')
          expect(toast('a')).toHaveAttribute('data-accent', 'ruby')
          expect(
            within(toast('a') as HTMLElement).queryByRole('button'),
          ).toBeNull()
          wait(3999)
          expect(toast('a')).toBeInTheDocument()
          wait(1)
          expect(toast('a')).toBeNull()

          // Tapped, it goes at once, as any other.
          rerender(
            <RollToasts
              rolls={[{ ...attack, id: 'b' }]}
              states={ways(['b', missed])}
              on
              rollDamage={jest.fn()}
            />,
          )
          fireEvent.click(toast('b') as HTMLElement)
          expect(toast('b')).toBeNull()
        },
      )

      it.each<[string, TableRollState]>([
        ['an attack that hit', hit()],
        ['an area attack that hit one of two', outcomes('miss', 'hit')],
        [
          'an attack whose outcome the game kept to itself',
          hit({ attack: { critical: false, fumble: false, outcome: null } }),
        ],
      ])('%s stays, its damage to roll', (_, state) => {
        render(
          <RollToasts
            rolls={[attack]}
            states={ways(['a', state])}
            on
            rollDamage={jest.fn()}
          />,
        )

        wait(60_000)
        expect(toast('a')).toHaveAttribute('data-waits', 'true')
        expect(
          within(toast('a') as HTMLElement).getByRole('button', {
            name: 'Roll damage',
          }),
        ).toBeInTheDocument()
      })
    })
  })

  describe('C22 where they start', () => {
    const Observer = globalThis.ResizeObserver
    /** What the layout's observer was asked to watch, and how to say it changed. */
    let watched: Element[]
    let resized: () => void
    let disconnect: jest.Mock
    /** Where each element is laid out, in pixels: none, while it isn't. */
    const at = new Map<Element, { top: number; bottom: number }>()
    const laid = (tag: string) => {
      const element = document.createElement(tag)
      element.getBoundingClientRect = () => {
        const { top, bottom } = at.get(element) ?? { top: 0, bottom: 0 }
        const height = bottom - top
        return { top, bottom, height, width: height > 0 ? 390 : 0 } as DOMRect
      }
      return element
    }
    let header: HTMLElement
    let pane: HTMLElement
    let tabs: HTMLElement

    beforeEach(() => {
      watched = []
      resized = () => {}
      disconnect = jest.fn()
      globalThis.ResizeObserver = jest.fn((callback: () => void) => {
        resized = callback
        return {
          observe: (element: Element) => watched.push(element),
          unobserve: (element: Element) => {
            watched = watched.filter(one => one !== element)
          },
          disconnect,
        }
      }) as unknown as typeof ResizeObserver
      header = laid('header')
      pane = laid('section')
      tabs = laid('div')
      pane.append(tabs)
      document.body.append(header, pane)
      at.set(header, { top: 0, bottom: 64 })
      at.set(tabs, { top: 64, bottom: 108 })
    })

    afterEach(() => {
      globalThis.ResizeObserver = Observer
      header.remove()
      pane.remove()
      at.clear()
    })

    /** Where the toasts start, as their region is placed. */
    const top = () => (log().parentElement as HTMLElement).style.top

    it('8 pixels below the row of tabs, measured as they first show, and again as the row moves', () => {
      render(
        <RollToasts
          rolls={[strength]}
          states={NONE}
          on
          tabs={tabs}
          header={header}
        />,
      )

      expect(top()).toBe('116px')
      // The row, the pane it tops, which grows or shrinks as anything above it does, and the
      // header.
      expect(watched).toEqual([tabs, pane, header])
      // A note above the row, such as the Gamemaster's, wraps.
      at.set(tabs, { top: 104, bottom: 148 })
      act(() => resized())
      expect(top()).toBe('156px')
    })

    it('again as something comes above the row in the pane it tops, as the Wild Shape ribbon (module 0.40.0), wraps, and goes, though neither the row nor the pane changes size', async () => {
      render(
        <RollToasts
          rolls={[strength]}
          states={NONE}
          on
          tabs={tabs}
          header={header}
        />,
      )
      expect(top()).toBe('116px')

      // Become: the ribbon comes before the row, which it pushes down inside a pane of the same
      // height, as the e2e's 1280-pixel page lays it out.
      const ribbon = laid('section')
      at.set(ribbon, { top: 64, bottom: 117 })
      at.set(tabs, { top: 117, bottom: 161 })
      await act(async () => {
        pane.prepend(ribbon)
      })
      expect(top()).toBe('169px')
      expect(watched).toContain(ribbon)

      // Its time wraps under its title, on a phone.
      at.set(ribbon, { top: 64, bottom: 133 })
      at.set(tabs, { top: 133, bottom: 177 })
      act(() => resized())
      expect(top()).toBe('185px')

      // Return: it goes, no longer watched, and the toasts move back up.
      at.set(tabs, { top: 64, bottom: 108 })
      await act(async () => {
        ribbon.remove()
      })
      expect(top()).toBe('116px')
      expect(watched).toEqual([tabs, pane, header])
    })

    it('below the header while the row is not shown, as on a phone showing combat or the chat, and at the top of the screen with neither', () => {
      const { rerender } = render(
        <RollToasts
          rolls={[strength]}
          states={NONE}
          on
          tabs={tabs}
          header={header}
        />,
      )

      at.delete(tabs)
      act(() => resized())
      expect(top()).toBe('72px')
      at.set(tabs, { top: 64, bottom: 108 })
      act(() => resized())
      expect(top()).toBe('116px')

      rerender(<RollToasts rolls={[strength]} states={NONE} on />)
      expect(top()).toBe('')
      expect(log().parentElement).toHaveClass(
        'top-[max(0.5rem,env(safe-area-inset-top))]',
      )
    })

    it('again as the window is resized or turned, until the toasts go', () => {
      const { unmount } = render(
        <RollToasts
          rolls={[strength]}
          states={NONE}
          on
          tabs={tabs}
          header={header}
        />,
      )

      at.set(tabs, { top: 60, bottom: 104 })
      act(() => {
        globalThis.dispatchEvent(new Event('resize'))
      })
      expect(top()).toBe('112px')
      at.set(tabs, { top: 56, bottom: 100 })
      act(() => {
        globalThis.dispatchEvent(new Event('orientationchange'))
      })
      expect(top()).toBe('108px')

      unmount()
      expect(disconnect).toHaveBeenCalled()
      at.set(tabs, { top: 0, bottom: 44 })
      const measured = jest.spyOn(tabs, 'getBoundingClientRect')
      globalThis.dispatchEvent(new Event('resize'))
      globalThis.dispatchEvent(new Event('orientationchange'))
      expect(measured).not.toHaveBeenCalled()
    })

    it("below the game's prompts beneath the row while it asks any, so as not to cover their buttons, and below the row once they go", () => {
      const prompts = laid('section')
      pane.append(prompts)
      at.set(prompts, { top: 108, bottom: 231 })
      const { rerender } = render(
        <RollToasts
          rolls={[strength]}
          states={NONE}
          on
          tabs={tabs}
          prompts={prompts}
          header={header}
        />,
      )

      expect(top()).toBe('239px')
      // Watched too, as one answered goes and the rest close up.
      expect(watched).toEqual([prompts, tabs, pane, header])
      at.set(prompts, { top: 108, bottom: 187 })
      act(() => resized())
      expect(top()).toBe('195px')
      // Neither laid out, as on a phone showing combat or the chat.
      at.delete(prompts)
      at.delete(tabs)
      act(() => resized())
      expect(top()).toBe('72px')

      // The game asks nothing more, back on the sheet.
      at.set(tabs, { top: 64, bottom: 108 })
      prompts.remove()
      rerender(
        <RollToasts
          rolls={[strength]}
          states={NONE}
          on
          tabs={tabs}
          header={header}
        />,
      )
      expect(top()).toBe('116px')
    })

    it('nowhere while toasts are off, the row not watched', () => {
      render(
        <RollToasts
          rolls={[strength]}
          states={NONE}
          on={false}
          tabs={tabs}
          header={header}
        />,
      )

      expect(watched).toEqual([])
      expect(globalThis.ResizeObserver).not.toHaveBeenCalled()
    })
  })

  it.each<[string, Parameters<typeof RollToasts>[0], string, string]>([
    [
      'not made at the table',
      {
        rolls: [strength],
        states: ways(['s', { status: 'refused', reason: 'busy' }]),
        on: true,
      },
      'warning',
      'border-l-warning',
    ],
    [
      'a natural 20',
      {
        rolls: [check('s', { natural: 20, d20s: [20] })],
        states: NONE,
        on: true,
      },
      'gold',
      'border-l-gold',
    ],
    [
      'a natural 1',
      {
        rolls: [check('s', { natural: 1, d20s: [1] })],
        states: NONE,
        on: true,
      },
      'ruby',
      'border-l-ruby',
    ],
    [
      'damage',
      {
        rolls: [
          {
            kind: 'damage',
            id: 's',
            label: 'Longsword damage',
            total: 9,
            critical: false,
            healing: false,
            parts: [{ type: 'Slashing', total: 9, terms: [] }],
            at: 0,
          } satisfies LocalDamage,
        ],
        states: NONE,
        on: true,
      },
      'damage',
      'border-l-damage',
    ],
    [
      'a critical hit’s damage',
      {
        rolls: [
          {
            kind: 'damage',
            id: 's',
            label: 'Longsword damage',
            total: 18,
            critical: true,
            healing: false,
            parts: [{ type: 'Slashing', total: 18, terms: [] }],
            at: 0,
          } satisfies LocalDamage,
        ],
        states: NONE,
        on: true,
      },
      'gold',
      'border-l-gold',
    ],
    [
      'a plain check',
      { rolls: [strength], states: NONE, on: true },
      'primary',
      'border-l-primary',
    ],
  ])(
    'C19 edges and tints the card of %s in its colour, as a bold card',
    (_, props, accent, edge) => {
      render(<RollToasts {...props} />)

      const card = toast('s') as HTMLElement
      expect(card).toHaveAttribute('data-accent', accent)
      expect(card).toHaveClass(
        'border-l-4',
        edge,
        `border-${accent}/${accent === 'gold' ? 40 : 30}`,
        'bg-card',
        'bg-linear-to-r',
        `from-${accent}/${accent === 'gold' ? 15 : 10}`,
        'shadow-2xl',
      )
      // Wider, with the tray's large total and a bold title.
      expect(log()).toHaveClass('w-full', 'sm:max-w-md')
      expect(card.firstElementChild).toHaveClass(
        'size-12',
        'rounded-xl',
        'text-2xl',
        'font-bold',
      )
      expect(within(card).getByText(props.rolls[0].label)).toHaveClass(
        'text-base',
        'font-semibold',
      )
      for (const line of card.querySelectorAll('p + p')) {
        expect(line).toHaveClass('text-sm')
      }
    },
  )

  it('C24 shows a critical hit’s damage in the gold of a natural 20, its total too; other damage, and healing, in their own colours', () => {
    render(
      <RollToasts
        rolls={[
          rolled('crit', { critical: true, total: 14 }),
          rolled('plain', {}),
          rolled('heal', { critical: true, healing: true, total: 8 }),
        ]}
        states={NONE}
        on
      />,
    )

    const crit = toast('crit') as HTMLElement
    expect(crit).toHaveAttribute('data-accent', 'gold')
    expect(crit).toHaveClass('border-l-gold', 'border-gold/40', 'from-gold/15')
    expect(crit.firstElementChild).toHaveTextContent('14')
    expect(crit.firstElementChild).toHaveClass('bg-gold', 'text-on-gold')
    expect(crit).toHaveTextContent('Slashing · Critical hit')

    const plain = toast('plain') as HTMLElement
    expect(plain).toHaveAttribute('data-accent', 'damage')
    expect(plain.firstElementChild).toHaveClass('bg-damage/15', 'text-damage')

    // A critical hit's healing stays healing.
    const heal = toast('heal') as HTMLElement
    expect(heal).toHaveAttribute('data-accent', 'primary')
    expect(heal.firstElementChild).toHaveClass('bg-primary/10', 'text-primary')
    expect(heal.firstElementChild).not.toHaveClass('bg-gold')
  })
})

/** A roll of the Gamemaster's, as the player's view tells it. */
const view = (fields: Partial<GmRollView> = {}): GmRollView => ({
  id: 'req-gm',
  kind: 'attack',
  label: 'Longsword attack',
  at: '2026-10-14T12:00:00.000Z',
  status: 'rolling',
  ...fields,
})
/** The Gamemaster's area attack, at the targets picked, in order, with what came of each. */
const gmArea = (
  targets: [string, 'hit' | 'miss' | null][],
  fields: Partial<GmRollView> = {},
) =>
  view({
    id: 'area',
    kind: 'attack',
    label: 'Breath Weapon attack',
    status: 'done',
    visible: true,
    total: 15,
    attack: {
      critical: false,
      fumble: false,
      outcome: null,
      targets: targets.map(([combatantId, outcome]) => ({
        combatId: 'c1',
        combatantId,
        outcome,
      })),
    },
    ...fields,
  })

/** What the page shows of it among the player's own, as the pane gives them. */
const shownOf = (...views: GmRollView[]) =>
  withGmRolls(
    [strength],
    ways(['s', { status: 'done', visible: true, total: 17 }]),
    gmRollsOf(views),
  )

describe('components/character-sheet/roll-toasts, favorites added and removed, from module 0.37.0', () => {
  it('toasts a favorite as a use, titled by its row, saying how it went', () => {
    const rope: LocalUse = {
      kind: 'use',
      id: 'f',
      label: 'Rope',
      spell: false,
      favorite: 'add',
      at: 2,
    }
    const { rerender } = render(
      <RollToasts
        rolls={[rope]}
        states={ways(['f', { status: 'rolling', favorite: 'add' }])}
        on
      />,
    )
    expect(toast('f')).toHaveTextContent(
      'RopeAdding it to favorites in your Gamemaster’s game…',
    )
    rerender(
      <RollToasts
        rolls={[rope]}
        states={ways([
          'f',
          { status: 'done', visible: true, favorited: true, favorite: 'add' },
        ])}
        on
      />,
    )
    expect(toast('f')).toHaveTextContent('RopeAdded to favorites')
  })
})

describe("components/character-sheet/roll-toasts, the Gamemaster's rolls as the character (#156)", () => {
  const hit = view({
    status: 'done',
    visible: true,
    total: 21,
    attack: { critical: false, fumble: false, outcome: 'hit' },
  })

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('G1 pops up only once the game has made it, marked as the Gamemaster’s, with the game’s result and nothing to roll after it', () => {
    // Already on its way as the page opens: in the rolls' history only, for now.
    const pending = shownOf(view())
    const { rerender } = render(
      <RollToasts rolls={pending.rolls} states={pending.states} on />,
    )
    expect(toast('gm:req-gm')).toBeNull()

    const made = shownOf(hit)
    rerender(<RollToasts rolls={made.rolls} states={made.states} on />)

    const card = toast('gm:req-gm') as HTMLElement
    expect(card).toHaveAttribute('data-gm', 'true')
    expect(card).toHaveAttribute('data-accent', 'primary')
    expect(card).not.toHaveAttribute('data-waits')
    expect(card).toHaveTextContent(
      '21Longsword attackGM, rolled by your GamemasterRolled by your GamemasterAt the table: 21 · Hit',
    )
    expect(
      within(card).getByTitle('Rolled by your Gamemaster'),
    ).toHaveTextContent('GM')
    // Its damage is the Gamemaster's to roll: nothing to tap, and it goes as any other.
    expect(within(card).queryByRole('button')).toBeNull()
    wait(3800)
    wait(200)
    expect(toast('gm:req-gm')).toBeNull()
  })

  it('G1 never offers its damage, nor stays for it, whatever the game said follows it', () => {
    const made = shownOf(hit)
    const states = new Map(made.states)
    states.set('gm:req-gm', {
      ...states.get('gm:req-gm'),
      status: 'done',
      damage: { critical: false, plannable: true, rolls: [] },
    })
    const page = (rolls: LocalRoll[]) => (
      <>
        <RollToasts rolls={rolls} states={states} on rollDamage={jest.fn()} />
        <RollTray
          rolls={rolls}
          rolling={false}
          table={{
            states,
            available: true,
            sending: true,
            rollDamage: jest.fn(),
          }}
        />
      </>
    )
    // Made since the page opened.
    const { rerender } = render(page([]))
    rerender(page(made.rolls))

    expect(toast('gm:req-gm')).toBeInTheDocument()
    expect(toast('gm:req-gm')).not.toHaveAttribute('data-waits')
    expect(screen.queryByRole('button', { name: /damage/i })).toBeNull()
  })

  it('G2 never pops up one the game had made, or not, before the page opened', () => {
    const made = shownOf(
      hit,
      view({
        id: 'req-lost',
        status: 'failed',
        reason: 'not-dying',
        kind: 'death',
        label: 'Death saving throw',
      }),
    )
    render(<RollToasts rolls={made.rolls} states={made.states} on />)

    expect(shown()).toEqual(['s'])
  })

  it('G3 pops up one made between two looks at the table, at once', () => {
    const { rerender } = render(
      <RollToasts rolls={[strength]} states={NONE} on />,
    )
    const made = shownOf(
      view({
        status: 'failed',
        reason: 'not-dying',
        kind: 'death',
        label: 'Death saving throw',
      }),
    )
    rerender(<RollToasts rolls={made.rolls} states={made.states} on />)

    expect(toast('gm:req-gm')).toHaveAttribute('data-accent', 'warning')
    expect(toast('gm:req-gm')).toHaveTextContent(
      'Death saving throwGM, rolled by your GamemasterRolled by your GamemasterNot made at the table: you aren’t dying',
    )
  })

  it('G4 shows one the game hid as the player’s own hidden rolls show: hidden, and nothing of what it came to', () => {
    const { rerender } = render(<RollToasts rolls={[]} states={NONE} on />)
    const hidden = shownOf(
      view({
        status: 'done',
        visible: false,
        kind: 'skill',
        label: 'Stealth check',
      }),
    )
    rerender(<RollToasts rolls={hidden.rolls} states={hidden.states} on />)

    const card = toast('gm:req-gm') as HTMLElement
    expect(card).toHaveTextContent(
      'Stealth checkGM, rolled by your GamemasterRolled by your GamemasterRolled at the table, hidden by your Gamemaster',
    )
    expect(card.firstElementChild?.querySelector('svg')).toHaveClass(
      'lucide-eye-off',
    )
    expect(card).toHaveAttribute('data-accent', 'primary')
  })

  it('G5 colours one as the player’s own: a critical gold, a fumble or a miss ruby, damage its own colour, healing as healing', () => {
    const { rerender } = render(<RollToasts rolls={[]} states={NONE} on />)
    const accents = [
      [
        view({
          ...hit,
          id: 'crit',
          d20: 'critical',
          attack: { critical: true, fumble: false, outcome: 'hit' },
        }),
        'gold',
      ],
      [
        view({
          ...hit,
          id: 'fumble',
          d20: 'fumble',
          attack: { critical: false, fumble: true, outcome: 'miss' },
        }),
        'ruby',
      ],
      [
        view({
          ...hit,
          id: 'miss',
          attack: { critical: false, fumble: false, outcome: 'miss' },
        }),
        'ruby',
      ],
      [
        view({
          id: 'save',
          kind: 'save',
          label: 'Dexterity save',
          status: 'done',
          visible: true,
          total: 9,
          outcome: 'failure',
        }),
        'ruby',
      ],
      [
        view({
          id: 'dmg',
          kind: 'damage',
          label: 'Longsword damage',
          status: 'done',
          visible: true,
          total: 8,
        }),
        'damage',
      ],
      [
        view({
          id: 'cast',
          kind: 'use',
          label: 'Bless',
          status: 'done',
          visible: true,
        }),
        'primary',
      ],
      [
        view({
          id: 'heal',
          kind: 'damage',
          label: 'Cure Wounds healing',
          status: 'done',
          visible: true,
          total: 9,
          healing: true,
        }),
        'primary',
      ],
      [
        view({
          id: 'critdmg',
          kind: 'damage',
          label: 'Longsword damage',
          status: 'done',
          visible: true,
          total: 17,
          critical: true,
        }),
        'gold',
      ],
      [
        view({
          id: 'critheal',
          kind: 'textDamage',
          label: 'Healing Word healing',
          status: 'done',
          visible: true,
          total: 6,
          critical: true,
          healing: true,
        }),
        'primary',
      ],
    ] as const
    const made = gmRollsOf(accents.map(([one]) => one))
    rerender(<RollToasts rolls={made.rolls} states={made.states} on />)

    for (const [{ id }, accent] of accents) {
      expect(toast(`gm:${id}`)).toHaveAttribute('data-accent', accent)
    }
    // Its total in the colours of the player's own healing; damage's in damage's.
    expect(toast('gm:heal')?.firstElementChild).toHaveClass(
      'bg-primary/10',
      'text-primary',
    )
    expect(toast('gm:dmg')?.firstElementChild).toHaveClass(
      'bg-damage/15',
      'text-damage',
    )
    expect(toast('gm:cast')).toHaveTextContent(
      'BlessGM, rolled by your GamemasterRolled by your GamemasterUsed at the table',
    )
    expect(toast('gm:crit')?.firstElementChild).toHaveClass('bg-gold')
    expect(toast('gm:save')).toHaveTextContent('At the table: 9 · Failed')
    // A critical hit's damage in a critical's gold, as the player's own; its healing as healing.
    expect(toast('gm:critdmg')?.firstElementChild).toHaveClass(
      'bg-gold',
      'text-on-gold',
    )
    expect(toast('gm:critheal')?.firstElementChild).toHaveClass(
      'bg-primary/10',
      'text-primary',
    )
    // Said in words too, not by its gold alone; never of healing, nor of other damage.
    expect(toast('gm:critdmg')).toHaveTextContent(
      'At the table: 17 · Critical hit',
    )
    expect(toast('gm:critheal')).toHaveTextContent('At the table: 6')
    expect(toast('gm:critheal')).not.toHaveTextContent('Critical hit')
    expect(toast('gm:dmg')).toHaveTextContent('At the table: 8')
    expect(toast('gm:dmg')).not.toHaveTextContent('Critical hit')
    // Its GM pill, in the accent as small text, its deeper shade in the light theme, meeting WCAG
    // AA this small.
    const pill = within(toast('gm:crit') as HTMLElement).getByTitle(
      'Rolled by your Gamemaster',
    )
    expect(pill).toHaveClass('text-primary-text')
    expect(pill).not.toHaveClass('text-primary')
  })

  it('G6 shows it in the banner as the latest roll, and among the earlier ones, marked as the Gamemaster’s', () => {
    const made = shownOf(view({ ...hit, at: new Date(5).toISOString() }))
    const { rerender } = render(
      <RollTray
        rolls={made.rolls}
        rolling={false}
        table={{ states: made.states, available: true, sending: true }}
      />,
    )

    const latest = screen.getByRole('status')
    expect(latest).toHaveTextContent(
      '21Longsword attackGM, rolled by your GamemasterRolled by your GamemasterAt the table: 21 · Hit',
    )
    expect(screen.queryByRole('button')).toBeNull()

    // The player's own roll since, the Gamemaster's among the earlier ones.
    const later = check('later', {
      label: 'Perception check',
      at: Date.parse('2026-10-14T12:01:00.000Z'),
    })
    rerender(
      <RollTray
        rolls={[later, ...made.rolls]}
        rolling={false}
        table={{ states: made.states, available: true, sending: true }}
      />,
    )
    const earlier = screen
      .getByText('Longsword attack')
      .closest('li') as HTMLElement
    expect(earlier).toHaveTextContent(
      'Longsword attackGM, rolled by your Gamemasterrolled by your Gamemaster· table 21',
    )
  })

  it('G7 shows the latest among the player’s own by when each was made', () => {
    const made = withGmRolls(
      [
        check('new', { at: Date.parse('2026-10-14T12:02:00.000Z') }),
        check('old', { at: Date.parse('2026-10-14T11:00:00.000Z') }),
      ],
      NONE,
      gmRollsOf([hit, view({ id: 'older', at: '2026-10-14T10:00:00.000Z' })]),
    )

    expect(made.rolls.map(({ id }) => id)).toEqual([
      'new',
      'gm:req-gm',
      'old',
      'gm:older',
    ])
    expect(made.states.get('gm:req-gm')).toEqual({
      status: 'done',
      visible: true,
      total: 21,
      attack: { critical: false, fumble: false, outcome: 'hit' },
      requestId: 'req-gm',
    })
  })

  it("G8 places each among the player's own by when the page first heard of it, by this device's clock, never the server's", () => {
    // This device's clock two minutes behind the server's.
    jest.setSystemTime(Date.parse('2026-10-14T11:58:00.000Z'))
    const before = view({
      ...hit,
      id: 'before',
      at: '2026-10-14T11:59:00.000Z',
    })
    const { result, rerender } = renderHook(
      ({ views }: { views: GmRollView[] }) => useGmRolls(views),
      { initialProps: { views: [before] } },
    )
    const order = (rolls: LocalRoll[]) =>
      withGmRolls(rolls, NONE, result.current).rolls.map(({ id }) => id)

    // The player attacks after the page opened with it: their roll is the newer, though the
    // server's clock says the Gamemaster's was sent later.
    wait(30_000)
    const attack = check('own', { at: Date.now() })
    expect(order([attack])).toEqual(['own', 'gm:before'])

    // Heard of since, newer than the attack, though the server's clock says they were sent before
    // it; heard of together, in the view's order.
    wait(3000)
    const after = view({ ...hit, id: 'after', at: '2026-10-14T11:58:10.000Z' })
    const also = view({ ...hit, id: 'also', at: '2026-10-14T11:58:05.000Z' })
    rerender({ views: [after, also, before] })
    expect(order([attack])).toEqual(['gm:after', 'gm:also', 'own', 'gm:before'])

    // Each heard of once, as later looks bring it again.
    const heard = result.current.rolls.map(({ at }) => at)
    wait(3000)
    rerender({ views: [{ ...after }, { ...also }, { ...before }] })
    expect(result.current.rolls.map(({ at }) => at)).toEqual(heard)
  })

  describe('G9 an area attack, naming whom it hit by the player’s own view of the combat', () => {
    /** The combat as the player sees it: no one hidden from players is in it. */
    const combat: TableCombat = {
      id: 'c1',
      name: null,
      started: true,
      round: 1,
      combatants: [
        {
          id: 'b1',
          name: 'Bandit 1',
          initiative: 15,
          defeated: false,
          side: 'other',
        },
        {
          id: 'b2',
          name: 'Bandit 2',
          initiative: 12,
          defeated: false,
          side: 'other',
        },
        {
          id: 'b3',
          name: 'Bandit 3',
          initiative: 9,
          defeated: false,
          side: 'other',
        },
      ],
    }
    /** What the toast, the banner and the rolls' popover say of it, made since the page opened. */
    const said = (made: GmRollView, seen?: TableCombat) => {
      const shown = gmRollsOf([made], undefined, seen)
      const { rerender, unmount } = render(
        <RollToasts rolls={[]} states={NONE} on />,
      )
      rerender(
        <>
          <RollToasts rolls={shown.rolls} states={shown.states} on />
          <RollTray
            rolls={shown.rolls}
            rolling={false}
            table={{ states: shown.states, available: true, sending: true }}
          />
        </>,
      )
      const card = toast('gm:area') as HTMLElement
      const line = within(card).getByText(/^At the table/)
      // The line alone says whom, with no list of its targets after it, so it's said whole.
      expect(within(card).queryByRole('list', { name: 'Targets' })).toBeNull()
      expect(line.className).not.toMatch(/line-clamp/)
      const toastLine = line.textContent
      const banner = screen.getByRole('status').textContent ?? ''
      unmount()
      return { toast: toastLine, banner }
    }

    it('names those it hit, in the order they were picked, in its toast and the banner', () => {
      const { toast: line, banner } = said(
        gmArea([
          ['b3', 'hit'],
          ['b2', 'miss'],
          ['b1', 'hit'],
        ]),
        combat,
      )
      expect(line).toBe('At the table: 15 · Hit 2 of 3: Bandit 3, Bandit 1')
      expect(banner).toContain(
        'At the table: 15 · Hit 2 of 3: Bandit 3, Bandit 1',
      )
    })

    it('names every one of many it hit in its toast, longer than two lines on a phone', () => {
      const ids = ['s1', 's2', 's3', 's4', 's5', 's6']
      const skeletons: TableCombat = {
        ...combat,
        combatants: ids.map((id, index) => ({
          id,
          name: `Skeleton ${index + 1}`,
          initiative: 10,
          defeated: false,
          side: 'other',
        })),
      }
      const { toast: line } = said(
        gmArea(ids.map((id, index) => [id, index < 5 ? 'hit' : 'miss'])),
        skeletons,
      )
      expect(line).toBe(
        'At the table: 15 · Hit 5 of 6: Skeleton 1, Skeleton 2, Skeleton 3, Skeleton 4, Skeleton 5',
      )
    })

    it('keeps the critical hit before it', () => {
      const { toast: line } = said(
        gmArea(
          [
            ['b1', 'hit'],
            ['b2', 'miss'],
            ['b3', 'hit'],
          ],
          {
            attack: {
              critical: true,
              fumble: false,
              outcome: null,
              targets: [
                { combatId: 'c1', combatantId: 'b1', outcome: 'hit' },
                { combatId: 'c1', combatantId: 'b2', outcome: 'miss' },
                { combatId: 'c1', combatantId: 'b3', outcome: 'hit' },
              ],
            },
            d20: 'critical',
          },
        ),
        combat,
      )
      expect(line).toBe(
        'At the table: 15 · Critical hit · Hit 2 of 3: Bandit 1, Bandit 3',
      )
    })

    it('counts one hit the player’s view can’t name, as one hidden from players, as more, never naming it', () => {
      // "x9" is hidden from players: their view of the combat leaves it out.
      const { toast: line, banner } = said(
        gmArea([
          ['b1', 'hit'],
          ['x9', 'hit'],
          ['b2', 'miss'],
        ]),
        combat,
      )
      expect(line).toBe('At the table: 15 · Hit 2 of 3: Bandit 1 and 1 more')
      expect(banner).toContain('Hit 2 of 3: Bandit 1 and 1 more')
      expect(document.body).not.toHaveTextContent('x9')
    })

    it('names none in another combat than the one the player sees, nor with no combat, saying only how many', () => {
      const elsewhere: TableCombat = {
        ...combat,
        id: 'c2',
        combatants: [
          {
            id: 'b1',
            name: 'Owlbear',
            initiative: 3,
            defeated: false,
            side: 'other',
          },
        ],
      }
      const made = gmArea([
        ['b1', 'hit'],
        ['b2', 'miss'],
      ])
      expect(said(made, elsewhere).toast).toBe('At the table: 15 · Hit 1 of 2')
      expect(said(made).toast).toBe('At the table: 15 · Hit 1 of 2')
      expect(
        said(
          gmArea([
            ['b1', 'miss'],
            ['b2', 'miss'],
          ]),
          combat,
        ).toast,
      ).toBe('At the table: 15 · Hit 0 of 2')
    })

    it('leaves the player’s own area attack as it was: how many it hit, its targets listed', () => {
      const own = check('own', { label: 'Breath Weapon attack', total: 15 })
      render(
        <RollTray
          rolls={[own]}
          rolling={false}
          table={{
            states: ways([
              'own',
              {
                status: 'done',
                visible: true,
                total: 15,
                attack: gmArea([
                  ['b1', 'hit'],
                  ['b2', 'miss'],
                ]).attack,
                targetNames: { b1: 'Bandit 1', b2: 'Bandit 2' },
              },
            ]),
            available: true,
            sending: true,
          }}
        />,
      )
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent(
        'At the table: 15 · Hit 1 of 2Bandit 1: HitBandit 2: Miss',
      )
      expect(status).not.toHaveTextContent('Hit 1 of 2: Bandit 1')
    })
  })
})
