import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiceAskBanner } from './dice-ask-banner'
import { tableIceKnife } from '@/mocks/dice-asks'

const NOW = Date.parse('2026-11-10T12:00:08Z')
/** Ice Knife's 2d6 cold, waiting 52 s more. */
const ask = tableIceKnife({ expiresAt: new Date(NOW + 52_000).toISOString() })

const renderBanner = (asked = ask) => {
  const onTypeIn = jest.fn()
  const onLeave = jest.fn()
  render(<DiceAskBanner asks={[asked]} onTypeIn={onTypeIn} onLeave={onLeave} />)
  return { onTypeIn, onLeave }
}

describe('DiceAskBanner (module 0.44.0)', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW }))
  afterEach(() => jest.useRealTimers())

  it('says what rolls, its dice and the time left, under its own heading', () => {
    renderBanner()
    const banner = screen.getByRole('region', {
      name: 'The game asks for your dice',
    })
    expect(within(banner).getByText('Ice Knife: Shard Explosion')).toBeVisible()
    expect(within(banner).getByText('2d6 Cold')).toBeVisible()
    expect(within(banner).getByRole('timer')).toHaveTextContent('0:52 left')
  })

  it('says a critical hit’s dice so, and calls an ask with no label what it is', () => {
    renderBanner(tableIceKnife({ ...ask, label: '', critical: true }))
    expect(screen.getByText('Dice the game asks for')).toBeVisible()
    expect(screen.getByText('2d6 Cold · Critical hit')).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: 'Type in 2d6 Cold for Dice the game asks for',
      }),
    ).toBeVisible()
  })

  it('types them in, or lets the game roll them, naming both', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const { onTypeIn, onLeave } = renderBanner()

    await user.click(
      screen.getByRole('button', {
        name: 'Type in 2d6 Cold for Ice Knife: Shard Explosion',
      }),
    )
    expect(onTypeIn).toHaveBeenCalledWith(ask)
    await user.click(
      screen.getByRole('button', {
        name: 'Let the game roll 2d6 Cold for Ice Knife: Shard Explosion',
      }),
    )
    expect(onLeave).toHaveBeenCalledWith(ask)
  })

  it('says the game rolls them once its time is up, offering nothing', () => {
    renderBanner()
    act(() => {
      jest.advanceTimersByTime(52_000)
    })
    expect(screen.getByText('The game rolls them')).toBeVisible()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
