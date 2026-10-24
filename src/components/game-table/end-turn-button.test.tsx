import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EndTurnButton } from './end-turn-button'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { EndableTurn } from '@/types/table'

const thorins: EndableTurn = {
  combatId: 'cmbt1',
  round: 1,
  combatantId: 'c-thorin',
}
const brakkas: EndableTurn = {
  combatId: 'cmbt1',
  round: 1,
  combatantId: 'c-brakka',
  companion: { key: 'wolfBrakka', name: 'Brakka' },
}

const setup = (
  props: {
    turn?: EndableTurn
    offered?: boolean
    way?: TableRollState
    onGone?: () => void
  } = {},
) => {
  const onEnd = jest.fn()
  const all = { turn: thorins, offered: true, onEnd, ...props }
  const view = render(
    <>
      <h2 id='turn-heading'>Your turn</h2>
      <EndTurnButton {...all} />
    </>,
  )
  return {
    onEnd,
    ...view,
    again: (more: Partial<typeof all>) =>
      view.rerender(
        <>
          <h2 id='turn-heading'>Your turn</h2>
          <EndTurnButton {...all} {...more} />
        </>,
      ),
  }
}

/** Lets the page settle: what the commit just made has gone, and its hand-off has run. */
const settle = () => act(async () => {})

describe('components/game-table/end-turn-button', () => {
  it('is named by its words and described by the turn panel’s heading', () => {
    setup()
    const button = screen.getByRole('button', { name: 'End turn' })
    expect(button).toHaveAccessibleDescription('Your turn')
    expect(button).toHaveAttribute('aria-describedby', 'turn-heading')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).not.toHaveAttribute('aria-disabled')
  })

  it('takes the card’s width on a phone, its own beside the heading from 768 px', () => {
    setup()
    expect(screen.getByRole('button')).toHaveClass(
      'w-full',
      'md:w-auto',
      'min-h-11',
      'rounded-xl',
      'bg-primary',
      'text-on-primary',
      'text-[15px]',
      'font-semibold',
    )
  })

  it('has no icon', () => {
    setup()
    const button = screen.getByRole('button')
    expect(button.querySelector('svg')).toBeNull()
    expect(button.children).toHaveLength(0)
  })

  it('ends the turn it shows, by a tap or Enter', async () => {
    const user = userEvent.setup()
    const { onEnd } = setup()
    await user.click(screen.getByRole('button'))
    expect(onEnd).toHaveBeenCalledWith(thorins)
    screen.getByRole('button').focus()
    await user.keyboard('{Enter}')
    expect(onEnd).toHaveBeenCalledTimes(2)
  })

  it('does nothing before the turn is offered, though it keeps taking focus', async () => {
    const user = userEvent.setup()
    const { onEnd } = setup({ offered: false })
    const button = screen.getByRole('button', { name: 'End turn' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    expect(button).not.toHaveAttribute('data-sending')
    await user.click(button)
    button.focus()
    await user.keyboard('{Enter}')
    expect(onEnd).not.toHaveBeenCalled()
    expect(button).toHaveFocus()
  })

  it.each<[string, TableRollState]>([
    ['sent', { status: 'sending' }],
    ['being made', { status: 'rolling', requestId: 'req-1' }],
    [
      'made, while the page still shows the turn',
      { status: 'done', requestId: 'req-1' },
    ],
  ])(
    'says it’s ending the turn, with a spinner, and does nothing more, while %s',
    async (_, way) => {
      const user = userEvent.setup()
      const { onEnd } = setup({ offered: false, way })
      const button = screen.getByRole('button', { name: 'Ending your turn…' })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).toHaveAttribute('data-sending')
      expect(button).toHaveClass(
        'data-[sending]:opacity-75',
        'data-[sending]:cursor-default',
      )
      expect(button).not.toBeDisabled()
      const [spinner] = button.children
      expect(spinner).toHaveAttribute('aria-hidden', 'true')
      expect(spinner).toHaveClass(
        'animate-[spin_0.8s_linear_infinite]',
        'motion-reduce:animate-[spin_2s_linear_infinite]',
      )
      expect(button.querySelector('svg')).toBeNull()
      await user.click(button)
      button.focus()
      await user.keyboard('{Enter}')
      expect(onEnd).not.toHaveBeenCalled()
    },
  )

  it('says a companion’s turn by its name on its way', () => {
    setup({ turn: brakkas, offered: false, way: { status: 'sending' } })
    expect(
      screen.getByRole('button', { name: 'Ending Brakka’s turn…' }),
    ).toBeInTheDocument()
  })

  it('offers the turn again once refused for a reason that leaves it the seat’s', async () => {
    const user = userEvent.setup()
    const { onEnd } = setup({
      offered: true,
      way: { status: 'refused', reason: 'busy' },
    })
    const button = screen.getByRole('button', { name: 'End turn' })
    expect(button).not.toHaveAttribute('aria-disabled')
    await user.click(button)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('stays, doing nothing, once refused as a turn that’s over', async () => {
    const user = userEvent.setup()
    const { onEnd } = setup({
      offered: false,
      way: { status: 'refused', reason: 'moved' },
    })
    const button = screen.getByRole('button', { name: 'End turn' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await user.click(button)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('ends one turn for a held Enter, never the next too', () => {
    setup()
    const button = screen.getByRole('button')
    expect(fireEvent.keyDown(button, { key: 'Enter', repeat: true })).toBe(
      false,
    )
    expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(true)
  })

  it('hands focus on as it goes from under it, once the page has settled, not otherwise', async () => {
    const onGone = jest.fn()
    const view = setup({ onGone })
    screen.getByRole('button').focus()
    view.rerender(<h2 id='turn-heading'>Brakka is acting</h2>)
    await settle()
    expect(onGone).toHaveBeenCalledTimes(1)

    const unfocused = jest.fn()
    view.rerender(
      <>
        <h2 id='turn-heading'>Your turn</h2>
        <EndTurnButton
          turn={thorins}
          offered
          onEnd={jest.fn()}
          onGone={unfocused}
        />
      </>,
    )
    view.rerender(<h2 id='turn-heading'>Brakka is acting</h2>)
    await settle()
    expect(unfocused).not.toHaveBeenCalled()

    // Nor where focus has been taken elsewhere before the page settled.
    const taken = jest.fn()
    const elsewhere = <button type='button'>Elsewhere</button>
    view.rerender(
      <>
        {elsewhere}
        <EndTurnButton
          turn={thorins}
          offered
          onEnd={jest.fn()}
          onGone={taken}
        />
      </>,
    )
    screen.getByRole('button', { name: 'End turn' }).focus()
    view.rerender(elsewhere)
    screen.getByRole('button', { name: 'Elsewhere' }).focus()
    await settle()
    expect(taken).not.toHaveBeenCalled()
  })
})
