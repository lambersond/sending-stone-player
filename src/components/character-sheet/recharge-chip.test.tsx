import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionsTab } from './actions-tab'
import { CharacterPane } from './character-pane'
import { RechargeChip, rechargeable } from './recharge-chip'
import { Charging } from './uses-button'
import { RollsLocked } from '@/hooks/use-rolls-locked'
import { fireBreath, lightningBreath, spiritSheet } from '@/mocks/alone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { SheetAction, SheetUses } from '@/types/sending-stone'

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'

/** Fire Breath's uses, as given. */
const breathUses = (fields: Partial<SheetUses> = {}): SheetUses => ({
  ...fireBreath().uses!,
  ...fields,
})

/** The spirit's Actions tab, with these actions, taking recharges from here where `recharges`. */
const renderTab = (
  actions: SheetAction[],
  { recharges = true, spends = false } = {},
) => {
  const tab = (shown: SheetAction[]) => (
    <Charging actions={spends ? { spend: jest.fn() } : {}}>
      <ActionsTab
        characterId='spirit'
        sheet={toTableSheet(spiritSheet(shown), GAME)}
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
        onRollFormula={jest.fn()}
        tableDamage={{
          modifies: true,
          dueFor: jest.fn(),
          sendsAlone: false,
          recharges,
        }}
      />
    </Charging>
  )
  const { rerender } = render(tab(actions))
  return { rerender: (next: SheetAction[]) => rerender(tab(next)) }
}

/** Fire Breath's Recharge chip. */
const breathChip = () =>
  screen.queryByRole('button', {
    name: 'Roll Fire Breath’s recharge: 5 or more on a d6',
  })

describe('components/character-sheet/recharge-chip', () => {
  it.each<[string, SheetUses | null | undefined, boolean]>([
    ['spent, an item’s own', breathUses(), true],
    ['one of two left', breathUses({ value: 1, max: 2 }), true],
    ['at full', breathUses({ value: 1 }), false],
    ['that don’t recharge', breathUses({ recharge: undefined }), false],
    ['a resource’s', breathUses({ counter: { resource: 'primary' } }), false],
    ['of no counter', breathUses({ counter: undefined }), false],
    ['none', undefined, false],
  ])('recharges uses %s: %s', (_, uses, expected) => {
    expect(rechargeable(uses)).toBe(expected)
  })

  it('shows on a row with uses spent, where the game takes a recharge from here; not at full, nor without', () => {
    const { rerender } = renderTab([fireBreath()])
    expect(breathChip()).toBeInTheDocument()

    rerender([fireBreath({ uses: breathUses({ value: 1 }) })])
    expect(breathChip()).toBeNull()

    rerender([fireBreath()])
    expect(breathChip()).toBeInTheDocument()
  })

  it('shows on no row where the game takes no recharge from here', () => {
    renderTab([fireBreath(), lightningBreath()], { recharges: false })

    expect(screen.queryByRole('button', { name: /recharge/ })).toBeNull()
  })

  it('is named for the lowest d6 that recharges it, a 6 alone said so, and says what a tap does', () => {
    const onRoll = jest.fn()
    render(
      <>
        <RechargeChip name='Fire Breath' uses={breathUses()} onRoll={onRoll} />
        <RechargeChip
          name='Lightning Breath'
          uses={lightningBreath().uses!}
          onRoll={onRoll}
        />
      </>,
    )

    const fire = screen.getByRole('button', {
      name: 'Roll Fire Breath’s recharge: 5 or more on a d6',
    })
    const lightning = screen.getByRole('button', {
      name: 'Roll Lightning Breath’s recharge: a 6 on a d6',
    })
    for (const chip of [fire, lightning]) {
      expect(chip).toHaveAttribute('title', 'Roll a d6 to recharge it')
      expect(chip).toHaveTextContent('Recharge')
      // A 44-pixel target round the chip as drawn.
      expect(chip).toHaveClass('min-h-11')
      expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden')
    }
  })

  it('rolls one d6 for the uses it recharges', async () => {
    const user = userEvent.setup()
    const onRoll = jest.fn()
    render(
      <>
        <RechargeChip name='Fire Breath' uses={breathUses()} onRoll={onRoll} />
        <RechargeChip
          name='Lightning Breath'
          uses={lightningBreath().uses!}
          onRoll={onRoll}
        />
      </>,
    )

    await user.click(screen.getByRole('button', { name: /^Roll Fire Breath/ }))
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Fire Breath recharge',
      terms: [{ sign: 1, count: 1, sides: 6 }],
      recharge: { item: 'fireBreath' },
    })
    await user.click(
      screen.getByRole('button', { name: /^Roll Lightning Breath/ }),
    )
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Lightning Breath recharge',
      terms: [{ sign: 1, count: 1, sides: 6 }],
      recharge: { item: 'lightningBreath', activity: 'lightningSave' },
    })
  })

  it('sends the d6 thrown to the game as a recharge, from the pane, its activity where its counter has one', async () => {
    const user = userEvent.setup()
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    const posted: Record<string, unknown>[] = []
    globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return {
          ok: true,
          status: 202,
          json: async () => ({ id: `req-${posted.length}` }),
        } as Response
      }
      const id = String(url).split('/').at(-1)
      return {
        ok: true,
        status: 200,
        json: async () => ({ id, status: 'pending' }),
      } as Response
    }) as typeof fetch
    render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(
          spiritSheet([fireBreath(), lightningBreath()]),
          GAME,
        )}
        rollsToTable={['use', 'damage', 'recharge']}
      />,
    )
    await user.click(screen.getByRole('tab', { name: 'Actions' }))

    await user.click(screen.getByRole('button', { name: /^Roll Fire Breath/ }))
    await waitFor(() => expect(posted).toHaveLength(1))
    const tray = screen.getByRole('region', { name: 'Your rolls' })
    const thrown = Number(
      within(tray).getByText('Fire Breath recharge').closest('div')
        ?.previousElementSibling?.textContent,
    )
    expect(posted[0]).toEqual({
      kind: 'recharge',
      item: 'fireBreath',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 6, results: [thrown] }],
    })
    expect(thrown).toBeGreaterThanOrEqual(1)
    expect(thrown).toBeLessThanOrEqual(6)

    await user.click(
      screen.getByRole('button', { name: /^Roll Lightning Breath/ }),
    )
    await waitFor(() => expect(posted).toHaveLength(2))
    expect(posted[1]).toEqual({
      kind: 'recharge',
      item: 'lightningBreath',
      activity: 'lightningSave',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 6, results: [expect.any(Number)] }],
    })
  })

  it('keeps focus in its row as it goes: on its uses where they are a button', async () => {
    const spendable = breathUses({ spendable: true })
    const { rerender } = renderTab([fireBreath({ uses: spendable })], {
      spends: true,
    })
    act(() => breathChip()?.focus())
    expect(breathChip()).toHaveFocus()

    // Recharged, as the next sheet says.
    rerender([fireBreath({ uses: { ...spendable, value: 1 } })])

    expect(breathChip()).toBeNull()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Spend Fire Breath: 1 of 1 left' }),
      ).toHaveFocus(),
    )
  })

  it('keeps focus in its row as it goes: on its name where its uses fold away in a narrow list', async () => {
    // jsdom lays nothing out, so this is a browser's rule: nothing that isn't drawn takes focus,
    // as uses folded away in a narrow list aren't (`hidden`, the list too narrow for `@md:inline`).
    const drawn = HTMLElement.prototype.focus
    const focus = jest.spyOn(HTMLElement.prototype, 'focus')
    focus.mockImplementation(options => {
      const element = focus.mock.contexts.at(-1) as HTMLElement
      if (!element.closest('.hidden')) drawn.call(element, options)
    })
    try {
      const spendable = breathUses({ spendable: true })
      const { rerender } = renderTab([fireBreath({ uses: spendable })], {
        spends: true,
      })
      act(() => breathChip()?.focus())
      expect(breathChip()).toHaveFocus()

      rerender([fireBreath({ uses: { ...spendable, value: 1 } })])

      // Full, its count folds away again beside its saving throw.
      expect(
        screen
          .getByRole('button', { name: 'Spend Fire Breath: 1 of 1 left' })
          .closest('[data-uses]'),
      ).toHaveClass('hidden')
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /^Fire Breath/, expanded: false }),
        ).toHaveFocus(),
      )
    } finally {
      focus.mockRestore()
    }
  })

  it('keeps focus in its row as it goes: on its name where its uses are only a count', async () => {
    const { rerender } = renderTab([fireBreath()])
    act(() => breathChip()?.focus())

    rerender([fireBreath({ uses: breathUses({ value: 1 }) })])

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^Fire Breath/, expanded: false }),
      ).toHaveFocus(),
    )
  })

  it("leaves focus be where it hadn't it", async () => {
    const { rerender } = renderTab([fireBreath()])
    const outside = document.createElement('button')
    document.body.append(outside)
    act(() => outside.focus())

    rerender([fireBreath({ uses: breathUses({ value: 1 }) })])
    await act(async () => {})

    expect(outside).toHaveFocus()
    outside.remove()
  })

  it("is disabled while the pane's rolls are locked", async () => {
    const user = userEvent.setup()
    const onRoll = jest.fn()
    render(
      <RollsLocked value>
        <RechargeChip name='Fire Breath' uses={breathUses()} onRoll={onRoll} />
      </RollsLocked>,
    )

    const chip = screen.getByRole('button', { name: /^Roll Fire Breath/ })
    expect(chip).toBeDisabled()
    expect(chip).toHaveClass('disabled:opacity-50')
    await user.click(chip)
    expect(onRoll).not.toHaveBeenCalled()
  })
})
