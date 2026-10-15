import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptBanner } from './prompt-banner'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { TablePrompt } from '@/types/table'

const sheet = toTableSheet(characterSheet(), 'https://my-game.forge-vtt.com')

/** The game asks Thorin for a Dexterity save against Burning Hands, DC 13. */
const burning: TablePrompt = {
  id: 'msg1-thorin',
  type: 'save',
  abilities: ['dex'],
  dc: 13,
  label: 'Burning Hands',
  expiresAt: '2026-10-08T12:10:00.000Z',
}

/** And a concentration check, its DC hidden, while he concentrates on Bless. */
const concentration: TablePrompt = {
  id: 'msg2-thorin',
  type: 'concentration',
  abilities: ['con'],
  label: 'Bless',
  expiresAt: '2026-10-08T12:11:00.000Z',
}

const renderBanner = (
  prompts: TablePrompt[],
  { answering = new Set<string>(), sending = true } = {},
) => {
  const onRoll = jest.fn()
  const onSend = jest.fn()
  render(
    <PromptBanner
      prompts={prompts}
      sheet={sheet}
      answering={answering}
      sending={sending}
      onSend={onSend}
      onRoll={onRoll}
    />,
  )
  return { onRoll, onSend }
}

describe('PromptBanner', () => {
  it('says what the Gamemaster asks, with its DC and what asks where the game shows them', () => {
    renderBanner([burning, concentration])

    const banner = screen.getByRole('region', { name: 'Your Gamemaster asks' })
    const [save, check] = within(banner).getAllByRole('listitem')
    expect(save).toHaveTextContent(
      'Dexterity saving throwDC 13 · Burning HandsRoll +1',
    )
    expect(check).toHaveTextContent('Concentration checkBlessRoll +6')
  })

  it('rolls the save as the sheet does, answering what the game asked', async () => {
    const user = userEvent.setup()
    const { onRoll } = renderBanner([burning])

    await user.click(
      screen.getByRole('button', { name: 'Roll Dexterity saving throw, +1' }),
    )

    expect(onRoll).toHaveBeenCalledWith({
      label: 'Dexterity saving throw',
      modifier: 1,
      advantage: undefined,
      source: { kind: 'save', key: 'dex', prompt: 'msg1-thorin' },
      explicit: false,
    })
  })

  it('offers advantage, disadvantage or a modified roll from a right-click', async () => {
    const user = userEvent.setup()
    const { onRoll } = renderBanner([concentration])

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', {
        name: 'Roll Concentration check, +6',
      }),
    })
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll with advantage' }),
    )

    expect(onRoll).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Concentration check',
        advantage: 'adv',
        explicit: true,
        source: { kind: 'save', key: 'con', prompt: 'msg2-thorin' },
      }),
    )
  })

  it('offers each ability a save may be rolled with, and names a concentration check’s own', () => {
    renderBanner([
      { ...burning, abilities: ['str', 'dex'] },
      { ...concentration, abilities: ['wis'] },
    ])

    expect(
      screen.getByText('Strength or Dexterity saving throw'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Roll Strength saving throw, +7' }),
    ).toHaveTextContent('STR +7')
    expect(
      screen.getByRole('button', { name: 'Roll Dexterity saving throw, +1' }),
    ).toHaveTextContent('DEX +1')
    expect(screen.getByText('Concentration check (Wisdom)')).toBeInTheDocument()
  })

  it('waits for the table once answered, offering it no more', () => {
    renderBanner([burning, concentration], {
      answering: new Set(['msg1-thorin']),
    })

    const [save, check] = screen.getAllByRole('listitem')
    expect(save).toHaveTextContent('Rolled. Waiting for the table…')
    expect(within(save).queryByRole('button')).not.toBeInTheDocument()
    expect(within(check).getByRole('button')).toBeInTheDocument()
  })

  it('says where this device keeps its rolls, and offers to send them', async () => {
    const user = userEvent.setup()
    const { onSend } = renderBanner([burning], { sending: false })

    expect(
      screen.queryByRole('button', { name: /Roll Dexterity/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/This device doesn't send your rolls to the table/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Send them' }))
    expect(onSend).toHaveBeenCalled()
  })
})

/** A player at the sheet, as its clock is faked. */
const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

/** Lets this many seconds pass, a second at a time, as the page's clock ticks. */
const pass = (seconds: number) => {
  for (let second = 0; second < seconds; second++) {
    act(() => jest.advanceTimersByTime(1000))
  }
}

describe('PromptBanner, what Midi-QOL asks (module 0.27.0)', () => {
  const NOW = Date.parse('2026-10-08T12:05:00Z')
  /** Midi-QOL asks Thorin for a Wisdom save against Hold Person, DC 15, with advantage. */
  const hold: TablePrompt = {
    id: 'k3y-thorin',
    type: 'save',
    abilities: ['wis'],
    dc: 15,
    label: 'Hold Person',
    expiresAt: '2026-10-08T12:05:42.000Z',
    source: 'midi',
    advantage: { wis: 'adv' },
  }
  /** A web he's caught in, at the end of his turn: Athletics or Stealth, its DC hidden. */
  const web: TablePrompt = {
    id: 'k4y-thorin',
    type: 'skill',
    abilities: [],
    skills: ['ath', 'ste'],
    label: 'Web',
    expiresAt: '2026-10-08T12:06:00.000Z',
    source: 'overtime',
    advantage: { ath: 'dis' },
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('names what asks, what for and its DC, how Midi-QOL has it rolled, and how long is left', () => {
    renderBanner([hold])

    const [row] = screen.getAllByRole('listitem')
    expect(row).toHaveTextContent(
      'Hold Person: Wisdom saveDC 15 · Advantage (Midi)Midi rolls for you in 0:42Roll +1',
    )
    expect(within(row).getByRole('timer')).toHaveTextContent('0:42')
  })

  it('rolls it only as Midi-QOL has it, with a tap, never offering another way', async () => {
    const { onRoll } = renderBanner([hold])
    const button = screen.getByRole('button', {
      name: 'Roll Wisdom saving throw, Advantage (Midi), +1',
    })
    expect(button).not.toHaveAttribute('aria-haspopup')

    await user().pointer({ keys: '[MouseRight]', target: button })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(onRoll).not.toHaveBeenCalled()

    await user().click(button)
    expect(onRoll).toHaveBeenCalledWith({
      label: 'Wisdom saving throw',
      modifier: 1,
      advantage: 'adv',
      source: { kind: 'save', key: 'wis', prompt: 'k3y-thorin' },
      explicit: false,
    })
  })

  it('offers each skill of a skill check by its total, saying how Midi-QOL has each rolled', async () => {
    const { onRoll } = renderBanner([web])

    const [row] = screen.getAllByRole('listitem')
    expect(row).toHaveTextContent('Web: Athletics or Stealth check')
    expect(row).toHaveTextContent('Athletics: Disadvantage (Midi)')
    expect(row).not.toHaveTextContent('DC')
    expect(
      screen.getByRole('button', {
        name: 'Roll Athletics check, Disadvantage (Midi), +7',
      }),
    ).toHaveTextContent('Athletics +7')

    await user().click(
      screen.getByRole('button', { name: 'Roll Stealth check, +1' }),
    )
    expect(onRoll).toHaveBeenCalledWith({
      label: 'Stealth check',
      modifier: 1,
      advantage: undefined,
      source: { kind: 'skill', key: 'ste', prompt: 'k4y-thorin' },
      explicit: false,
    })
  })

  it('rolls an ability check by its check, and a concentration check by its save', async () => {
    const { onRoll } = renderBanner([
      {
        ...hold,
        id: 'k5y-thorin',
        type: 'check',
        abilities: ['str'],
        label: 'Grappled',
        advantage: {},
      },
      {
        ...hold,
        id: 'k6y-thorin',
        type: 'concentration',
        abilities: ['con'],
        label: 'Bless',
        source: 'concentration',
        advantage: { con: 'dis' },
      },
    ])

    const [check, concentration] = screen.getAllByRole('listitem')
    expect(check).toHaveTextContent('Grappled: Strength check')
    expect(concentration).toHaveTextContent(
      'Bless: Concentration checkDC 15 · Disadvantage (Midi)',
    )
    await user().click(
      screen.getByRole('button', { name: 'Roll Strength check, +4' }),
    )
    expect(onRoll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modifier: 4,
        advantage: undefined,
        source: { kind: 'ability', key: 'str', prompt: 'k5y-thorin' },
      }),
    )
    await user().click(
      screen.getByRole('button', {
        name: 'Roll Concentration check, Disadvantage (Midi), +6',
      }),
    )
    expect(onRoll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modifier: 6,
        advantage: 'dis',
        source: { kind: 'save', key: 'con', prompt: 'k6y-thorin' },
      }),
    )
  })

  it('counts down, then says Midi-QOL is rolling it, offering it no more', () => {
    renderBanner([hold])

    pass(41)
    expect(screen.getByRole('timer')).toHaveTextContent(
      'Midi rolls for you in 0:01',
    )
    pass(1)
    const [row] = screen.getAllByRole('listitem')
    expect(row).toHaveTextContent('Midi is rolling…')
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    expect(within(row).queryByRole('timer')).not.toBeInTheDocument()
  })

  it('says it may be answered in Foundry too, where Foundry asks as well, and is left to it once time is up', () => {
    renderBanner([{ ...hold, askedInFoundry: true }])

    expect(screen.getByRole('timer')).toHaveTextContent(
      'Answer here or in Foundry · 0:42',
    )
    pass(42)
    expect(screen.getByRole('listitem')).toHaveTextContent('Left to Foundry')
    expect(screen.queryByText(/Midi is rolling/)).not.toBeInTheDocument()
  })

  it('waits for the table once answered', () => {
    renderBanner([hold], { answering: new Set(['k3y-thorin']) })

    const [row] = screen.getAllByRole('listitem')
    expect(row).toHaveTextContent('Rolled. Waiting for the table…')
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  })

  it.each<[string, Partial<TablePrompt>, string]>([
    ['rolled in Foundry first', { closed: 'rolled' }, 'Rolled in Foundry'],
    ['rolled by Midi-QOL', { closed: 'expired' }, 'Midi rolled it'],
    [
      'left to Foundry',
      { closed: 'expired', askedInFoundry: true },
      'Left to Foundry',
    ],
  ])('says once it was %s', (_, fields, said) => {
    renderBanner([{ ...hold, ...fields }])

    const [row] = screen.getAllByRole('listitem')
    expect(row).toHaveTextContent(
      `Hold Person: Wisdom saveDC 15 · Advantage (Midi)${said}`,
    )
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers no roll where this device keeps its rolls, but still says how long is left', () => {
    renderBanner([hold], { sending: false })

    expect(
      screen.queryByRole('button', { name: /Roll/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:42')
  })

  it('reads its heading and its offer to send in the accent deep enough for small text', () => {
    renderBanner([hold], { sending: false })

    expect(
      screen.getByRole('heading', { name: 'Your Gamemaster asks' }),
    ).toHaveClass('text-primary-text')
    expect(screen.getByRole('button', { name: 'Send them' })).toHaveClass(
      'text-primary-text',
    )
  })
})
