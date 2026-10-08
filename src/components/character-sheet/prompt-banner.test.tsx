import { render, screen, within } from '@testing-library/react'
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
