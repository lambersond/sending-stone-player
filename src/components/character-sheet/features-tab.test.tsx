/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import { FeaturesTab } from './features-tab'
import { characterSheet, fullerSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet } from '@/types/sending-stone'

const renderTab = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <FeaturesTab
      characterId='char-1'
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
    />,
  )

describe('components/character-sheet/features-tab', () => {
  it('shows each class with its hit dice', () => {
    renderTab()

    const classes = within(
      screen.getByRole('region', { name: 'Classes' }),
    ).getAllByRole('listitem')
    expect(classes.map(item => item.textContent)).toEqual([
      'Fighter 5ChampionHit dice3/5 d10',
    ])
  })

  it('groups features by where they came from, with how and how often each is used', () => {
    renderTab()

    const fighter = within(
      screen.getByRole('region', { name: 'Fighter Features' }),
    )
    expect(
      fighter.getAllByRole('listitem').map(item => item.textContent),
    ).toEqual([
      'About Fighter',
      'Second Wind1 Bonus Action · Short Rest, Long Rest1/11 of 1 uses left',
      'Action SurgeSpecial · Short Rest0/10 of 1 uses left',
    ])
    expect(fighter.getByText('0/1').parentElement).toHaveClass('text-ruby')
    const species = within(
      screen.getByRole('region', { name: 'Species Features' }),
    )
    expect(species.getByRole('listitem')).toHaveTextContent('DarkvisionPassive')
    expect(species.getByRole('listitem').querySelector('img')).toHaveAttribute(
      'src',
      'https://assets.forge-vtt.com/darkvision.webp',
    )
  })

  it('names the species or background a group came from, if it has a description', () => {
    const sheet = fullerSheet()
    renderTab({
      ...sheet,
      features: [
        { ...sheet.features[1], text: '5e6f708192a3b4' },
        {
          id: 'background',
          label: 'Background Features',
          text: '6f708192a3b4c5',
          features: [],
        },
        {
          id: 'wizard',
          label: 'Wizard Features',
          text: '708192a3b4c5d6',
          features: [],
        },
      ],
    })

    expect(screen.getByText('About Dwarf')).toBeInTheDocument()
    expect(screen.getByText('About Soldier')).toBeInTheDocument()
    expect(screen.getByText('About this')).toBeInTheDocument()
  })

  it('says so when there are no features to show, as from an older module', () => {
    const { classes, ...sheet } = characterSheet()
    renderTab({ ...sheet, classes: [{ ...classes[0], hitDice: null }] })

    expect(screen.getByText('No features to show yet.')).toBeInTheDocument()
    expect(screen.queryByText('Hit dice')).toBeNull()
  })

  it('shows hit dice it only partly knows', () => {
    const sheet = fullerSheet()
    renderTab({
      ...sheet,
      classes: [
        {
          ...sheet.classes[0],
          levels: null,
          subclass: null,
          hitDice: { die: 'd8', value: null, max: null },
        },
      ],
    })

    expect(screen.getByRole('region', { name: 'Classes' })).toHaveTextContent(
      'FighterHit dice–/– d8',
    )
  })
})
