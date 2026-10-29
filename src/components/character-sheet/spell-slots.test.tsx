import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { slotsLive, SpellSlots } from './spell-slots'
import { Charging, type ChargeActions } from './uses-button'
import type { SpellSlotPool } from '@/utils/slot-words'

/*
 * A pool's dots, from module 0.42.1 (round 0.42.1 §U.1, §U.6): pictures, as ever, unless the pane
 * spends and restores slots; then each a button that asks first.
 */

const FIRST: SpellSlotPool = { id: 'spell1', level: 1 }
const PACT: SpellSlotPool = { id: 'pact', level: 3 }

/** The markup before module 0.42.1, of 3 of 4 slots left, as every picture of them still is. */
const TODAY =
  '<span class="flex shrink-0 items-center gap-2">' +
  '<span aria-hidden="true" class="flex gap-1">' +
  '<span class="size-2.5 rounded-full border-2 border-primary bg-primary"></span>'.repeat(
    3,
  ) +
  '<span class="size-2.5 rounded-full border-2 border-primary"></span>' +
  '</span>' +
  '<span aria-hidden="true" class="text-xs font-semibold text-text-secondary tabular-nums">3/4</span>' +
  '<span class="sr-only">3 of 4 spell slots left</span>' +
  '</span>'

const renderSlots = (
  value: number,
  max: number,
  pool: SpellSlotPool | undefined = FIRST,
  given?: ChargeActions,
) => {
  const actions = given ?? { slot: jest.fn() }
  const view = render(
    <Charging actions={actions}>
      <SpellSlots value={value} max={max} pool={pool} />
    </Charging>,
  )
  const rerender = (next: number) =>
    view.rerender(
      <Charging actions={actions}>
        <SpellSlots value={next} max={max} pool={pool} />
      </Charging>,
    )
  return { ...view, rerender, actions }
}

const dots = () => within(screen.getByRole('group')).getAllByRole('button')

describe('components/character-sheet/spell-slots', () => {
  it.each([
    ['nothing that spends them', {}],
    ['spending, but no pool', undefined],
  ] as const)('draws today’s markup exactly with %s', (_name, actions) => {
    const { container } = render(
      actions ? (
        <Charging actions={actions}>
          <SpellSlots value={3} max={4} pool={FIRST} />
        </Charging>
      ) : (
        <Charging actions={{ slot: jest.fn() }}>
          <SpellSlots value={3} max={4} />
        </Charging>
      ),
    )
    expect(container.innerHTML).toBe(TODAY)
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('dialog, .contents')).toBeNull()
  })

  it('makes each dot a button, named for what it does, with a title of the same words', () => {
    const { container } = renderSlots(3, 4)

    const group = screen.getByRole('group', { name: '1st-level spell slots' })
    expect(group).toHaveClass('flex', 'gap-0')
    expect(group).not.toHaveAttribute('aria-busy')
    expect(dots().map(dot => dot.getAttribute('aria-label'))).toEqual([
      'Spend a 1st-level spell slot, 3 of 4 left',
      'Spend a 1st-level spell slot, 3 of 4 left',
      'Spend a 1st-level spell slot, 3 of 4 left',
      'Restore a 1st-level spell slot, 3 of 4 left',
    ])
    for (const dot of dots()) {
      expect(dot).toHaveAttribute('type', 'button')
      expect(dot).toHaveAttribute('title', dot.getAttribute('aria-label'))
      expect(dot).not.toHaveAttribute('aria-disabled')
      expect(dot).toHaveClass(
        'inline-flex',
        'h-11',
        'w-7',
        'items-center',
        'justify-center',
        'rounded-md',
        'hover:bg-primary/10',
        'focus-visible:outline-2',
        'focus-visible:outline-primary',
        'sm:size-6',
      )
      expect(dot).toHaveTextContent('')
    }
    // The ring inside each, as the picture's, filled for each left.
    expect(dots().map(dot => dot.querySelector('span')?.className)).toEqual([
      'size-2.5 rounded-full border-2 border-primary bg-primary',
      'size-2.5 rounded-full border-2 border-primary bg-primary',
      'size-2.5 rounded-full border-2 border-primary bg-primary',
      'size-2.5 rounded-full border-2 border-primary',
    ])
    expect(container.querySelectorAll('.rounded-full.border-2')).toHaveLength(4)
    // The count as ever, and its words the one thing a screen reader alone is given.
    expect(screen.getByText('3/4')).toHaveAttribute('aria-hidden', 'true')
    const words = container.querySelectorAll('.sr-only')
    expect([...words].map(each => each.textContent)).toEqual([
      '3 of 4 spell slots left',
    ])
  })

  it('wraps its dots onto another line where nine have no room, the count beside them, never past the card (round 0.42.1 review)', () => {
    // Nine 28 px dots and their count need 282 px; a favorite's line beneath its name on a 360 px
    // phone has 250.
    const { container } = renderSlots(9, 9)

    const group = screen.getByRole('group', { name: '1st-level spell slots' })
    expect(dots()).toHaveLength(9)
    expect(group).toHaveClass('flex', 'flex-wrap', 'gap-0')
    // The count stays on the dots' line: only the dots wrap, and the pictures' markup is as ever.
    expect(group.parentElement?.className).toBe(
      'flex shrink-0 items-center gap-2',
    )
    expect(container.querySelectorAll('.flex-wrap')).toHaveLength(1)
  })

  it('names pact magic’s as its heading does', () => {
    renderSlots(1, 2, PACT)

    expect(
      screen.getByRole('group', { name: 'Pact Magic slots (3rd level)' }),
    ).toBeInTheDocument()
    expect(dots().map(dot => dot.getAttribute('aria-label'))).toEqual([
      'Spend a pact slot (3rd level), 1 of 2 left',
      'Restore a pact slot (3rd level), 1 of 2 left',
    ])
  })

  it('spends each of more than its maximum, as temporary slots are, and restores none', () => {
    renderSlots(5, 4)

    expect(dots().map(dot => dot.getAttribute('aria-label'))).toEqual(
      Array.from(
        { length: 4 },
        () => 'Spend a 1st-level spell slot, 5 of 4 left',
      ),
    )
  })

  it.each([
    ['more than nine slots', 3, 10, FIRST],
    ['a pool the app doesn’t know', 3, 4, { id: 'arcane1', level: 1 }],
    ['none', 0, 0, FIRST],
  ] as const)(
    'keeps the count alone, or pictures, for %s',
    (_name, value, max, pool) => {
      renderSlots(value, max, pool)

      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.queryByRole('group')).toBeNull()
    },
  )

  it('says where it’s live', () => {
    const slot = jest.fn()
    expect(slotsLive(FIRST, 4, { slot })).toBe(true)
    expect(slotsLive({ id: 'spell9', level: 9 }, 9, { slot })).toBe(true)
    expect(slotsLive(PACT, 1, { slot })).toBe(true)
    expect(slotsLive(FIRST, 4, {})).toBe(false)
    expect(slotsLive(undefined, 4, { slot })).toBe(false)
    expect(slotsLive(FIRST, 10, { slot })).toBe(false)
    expect(slotsLive(FIRST, 0, { slot })).toBe(false)
    expect(slotsLive({ id: 'spell0', level: 0 }, 1, { slot })).toBe(false)
    expect(slotsLive({ id: 'arcane1', level: 1 }, 1, { slot })).toBe(false)
  })

  it('asks before spending one, with Cancel focused, outside the dots, and spends nothing on Cancel', async () => {
    const user = userEvent.setup()
    const { actions } = renderSlots(3, 4)

    await user.click(dots()[0])
    const asked = screen.getByRole('dialog', {
      name: 'Spend a 1st-level spell slot?',
    })
    expect(asked).toHaveTextContent(
      '3 of 4 left, 2 once it’s spent. Foundry’s chat will say so.',
    )
    const cancel = within(asked).getByRole('button', { name: 'Cancel' })
    expect(cancel).toHaveFocus()
    expect(within(asked).getByRole('button', { name: 'Spend' })).toBeVisible()
    // Beside the dots, never among them, nor in their count.
    expect(screen.getByRole('group').contains(asked)).toBe(false)
    expect(asked.closest('span')).toBeNull()

    await user.click(cancel)
    expect(actions.slot).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('spends one once asked, from the count the dots showed, then closes', async () => {
    const user = userEvent.setup()
    const { actions } = renderSlots(3, 4)

    await user.click(dots()[2])
    await user.click(screen.getByRole('button', { name: 'Spend' }))
    expect(actions.slot).toHaveBeenCalledTimes(1)
    expect(actions.slot).toHaveBeenCalledWith(FIRST, 'spend', 3)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks before restoring one used, and restores it once asked', async () => {
    const user = userEvent.setup()
    const { actions } = renderSlots(3, 4)

    await user.click(dots()[3])
    const asked = screen.getByRole('dialog', {
      name: 'Restore a 1st-level spell slot?',
    })
    expect(asked).toHaveTextContent(
      '3 of 4 left, 4 once it’s restored. Foundry’s chat will say so.',
    )
    expect(within(asked).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(within(asked).getByRole('button', { name: 'Restore' }))
    expect(actions.slot).toHaveBeenCalledTimes(1)
    expect(actions.slot).toHaveBeenCalledWith(FIRST, 'restore', 3)
  })

  it('does what its confirm was opened for, from the count then, however the count changes meanwhile', async () => {
    const user = userEvent.setup()
    const { actions, rerender } = renderSlots(3, 4)

    await user.click(dots()[0])
    // A slot spent in Foundry meanwhile, as a cast there spends one.
    rerender(2)
    const asked = screen.getByRole('dialog', {
      name: 'Spend a 1st-level spell slot?',
    })
    expect(asked).toHaveTextContent(
      '3 of 4 left, 2 once it’s spent. Foundry’s chat will say so.',
    )
    await user.click(within(asked).getByRole('button', { name: 'Spend' }))
    expect(actions.slot).toHaveBeenCalledWith(FIRST, 'spend', 3)

    // A restore opened at 2 stays a restore at 2, however many are spent meanwhile.
    await user.click(dots()[3])
    rerender(0)
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    expect(actions.slot).toHaveBeenLastCalledWith(FIRST, 'restore', 2)
  })

  it('waits, dimmed and busy, doing nothing on a tap, while what was sent waits for the game', async () => {
    const user = userEvent.setup()
    const slotWaiting = jest.fn((id: string) => id === 'spell1')
    const { actions } = renderSlots(3, 4, FIRST, {
      slot: jest.fn(),
      slotWaiting,
    })

    expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true')
    for (const dot of dots()) {
      expect(dot).toHaveAttribute('aria-disabled', 'true')
      expect(dot).toHaveClass('opacity-60')
    }
    await user.click(dots()[0])
    await user.click(dots()[3])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(actions.slot).not.toHaveBeenCalled()
    expect(slotWaiting).toHaveBeenCalledWith('spell1')
  })

  it('keeps a press on its confirm from the row the dots are in', async () => {
    const user = userEvent.setup()
    const onPointerDown = jest.fn()
    const onContextMenu = jest.fn()
    const onClick = jest.fn()
    render(
      <Charging actions={{ slot: jest.fn() }}>
        <div
          onPointerDown={onPointerDown}
          onContextMenu={onContextMenu}
          onClick={onClick}
        >
          <SpellSlots value={3} max={4} pool={FIRST} />
        </div>
      </Charging>,
    )

    await user.click(dots()[0])
    // The dot's own tap is a button's, which a row's menu leaves to it.
    onPointerDown.mockClear()
    onClick.mockClear()
    const words = screen.getByText(/3 of 4 left, 2 once/)
    fireEvent.pointerDown(words)
    fireEvent.contextMenu(words)
    fireEvent.click(words)
    expect(onPointerDown).not.toHaveBeenCalled()
    expect(onContextMenu).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })
})
