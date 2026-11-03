import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CompanionAskNotice,
  type CompanionAskRow,
} from './companion-ask-notice'
import { useWaitingCompanions } from '@/hooks/use-waiting-prompts'
import type { CompanionAsked } from '@/types/table'

/*
 * The notice on the character's own banner of the companions the game asks a save of, from module
 * 0.41.0 (round 0.41.0 §3.1.3, §3.7, §7.5): a line each, and Show, which goes to its tab and
 * answers nothing.
 */

const NOW = Date.parse('2026-10-27T19:00:00Z')

const rows: CompanionAskRow[] = [
  { key: 'arena-bat1', name: 'Bat 1', label: 'Dexterity saving throw' },
  { key: 'arena-bat2', name: 'Bat 2', label: 'Intelligence saving throw' },
  { key: 'brakka', name: 'Brakka', label: 'Concentration check (Wisdom)' },
]

/** The notice as the page shows it: those of the view's still waiting, by their tabs' names. */
function Waiting({
  asked,
  onShow,
}: Readonly<{ asked: CompanionAsked[]; onShow: (key: string) => void }>) {
  const waiting = useWaitingCompanions(asked)
  const names = new Map([
    ['arena-bat1', 'Bat 1'],
    ['arena-bat2', 'Bat 2'],
  ])
  return (
    <CompanionAskNotice
      asked={waiting.map(({ key, label }) => ({
        key,
        label,
        name: names.get(key) ?? key,
      }))}
      onShow={onShow}
    />
  )
}

describe('components/companions/companion-ask-notice', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn()
  })

  it('says one line per companion asked, what for, each with Show', () => {
    render(<CompanionAskNotice asked={rows} onShow={jest.fn()} />)

    const list = screen.getByRole('list', { name: 'Companions asked' })
    const lines = within(list).getAllByRole('listitem')
    expect(lines.map(line => line.querySelector('p')?.textContent)).toEqual([
      'Bat 1 is asked for a Dexterity saving throw',
      'Bat 2 is asked for an Intelligence saving throw',
      'Brakka is asked for a Concentration check (Wisdom)',
    ])
    expect(
      within(list)
        .getAllByRole('button')
        .map(button => button.getAttribute('aria-label')),
    ).toEqual(['Show Bat 1', 'Show Bat 2', 'Show Brakka'])
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent('Show')
  })

  it('shows the companion asked, by its key, posting nothing', async () => {
    const user = userEvent.setup()
    const onShow = jest.fn()
    render(<CompanionAskNotice asked={rows} onShow={onShow} />)

    await user.click(screen.getByRole('button', { name: 'Show Bat 2' }))
    expect(onShow).toHaveBeenCalledWith('arena-bat2')
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('says nothing where no companion is asked', () => {
    const { container } = render(
      <CompanionAskNotice asked={[]} onShow={jest.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('says none past its expiry, though nothing new comes from the game', () => {
    jest.useFakeTimers({ now: NOW })
    try {
      render(
        <Waiting
          asked={[
            {
              key: 'arena-bat1',
              label: 'Dexterity saving throw',
              expiresAt: new Date(NOW + 60_000).toISOString(),
            },
            {
              key: 'arena-bat2',
              label: 'Intelligence saving throw',
              expiresAt: new Date(NOW - 1000).toISOString(),
            },
          ]}
          onShow={jest.fn()}
        />,
      )
      expect(
        screen.getAllByRole('listitem').map(item => item.textContent),
      ).toEqual(['Bat 1 is asked for a Dexterity saving throwShow'])

      act(() => jest.advanceTimersByTime(60_100))
      expect(screen.queryByRole('list')).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })
})
