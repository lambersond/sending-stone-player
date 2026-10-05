/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import { EffectsTab } from './effects-tab'
import { characterSheet, fullerSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet } from '@/types/sending-stone'

const renderTab = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <EffectsTab
      characterId='char-1'
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
    />,
  )

describe('components/character-sheet/effects-tab', () => {
  it("lists the character's conditions, with exhaustion's level and what concentration is on", () => {
    renderTab()

    const conditions = within(
      screen.getByRole('region', { name: 'Conditions' }),
    )
    expect(
      conditions.getAllByRole('listitem').map(item => item.textContent),
    ).toEqual(['ConcentratingBless', 'ExhaustionLevel 2', 'Poisoned'])
    // The game's white status icons sit on a dark tile.
    expect(
      screen.getByRole('region', { name: 'Conditions' }).querySelector('img'),
    ).toHaveClass('bg-[#23232f]')
  })

  it("groups effects in dnd5e's categories, with where each came from and the time it has left", () => {
    renderTab()

    expect(
      within(
        screen.getByRole('region', { name: 'Temporary Effects' }),
      ).getByRole('listitem'),
    ).toHaveTextContent(/^Bless9 Rounds/)
    const rage = within(
      screen.getByRole('region', { name: 'Inactive Effects' }),
    ).getByRole('listitem')
    expect(rage).toHaveTextContent('RageOff')
    expect(rage.firstElementChild).toHaveClass('opacity-60')
  })

  it("names where an effect came from when that isn't its own name", () => {
    const sheet = fullerSheet()
    const [temporary] = sheet.effects
    renderTab({
      ...sheet,
      effects: [
        {
          ...temporary,
          effects: [
            { ...temporary.effects[0], name: 'Blessed', duration: null },
          ],
        },
      ],
    })

    expect(
      within(
        screen.getByRole('region', { name: 'Temporary Effects' }),
      ).getByRole('listitem'),
    ).toHaveTextContent(/^BlessedFrom Bless$/)
  })

  it('says so when there are none', () => {
    renderTab(characterSheet())

    expect(screen.getByText('None.')).toBeInTheDocument()
    expect(screen.getByText('No effects.')).toBeInTheDocument()
  })
})
