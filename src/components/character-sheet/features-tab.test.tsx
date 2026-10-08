/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FavoriteMarks } from './favorite-mark'
import { FeaturesTab } from './features-tab'
import { characterSheet, fullerSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet } from '@/types/sending-stone'

const renderTab = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <FeaturesTab
      characterId='char-1'
      onRoll={jest.fn()}
      onRollDamage={jest.fn()}
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

  it('shows what a feature rolls beside it, rolling it here or using it in the game', async () => {
    const user = userEvent.setup()
    // Its description loads once it's open.
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
    const sheet = fullerSheet()
    const [fighter, ...origins] = sheet.features
    const wind = {
      ...fighter.features[0],
      range: 'Self',
      target: null,
      concentration: false,
      activity: {
        id: 'windHeal',
        type: 'heal' as const,
        targets: {
          self: true,
          area: false,
          count: null,
          perLevel: null,
          affects: 'self',
        },
      },
      damage: [{ formula: '1d10 + 5', type: 'Healing', healing: true }],
    }
    const props = {
      characterId: 'char-1',
      sheet: toTableSheet(
        { ...sheet, features: [{ ...fighter, features: [wind] }, ...origins] },
        'https://my-game.forge-vtt.com',
      ),
      onRoll: jest.fn(),
      onRollDamage: jest.fn(),
    }
    const onUse = jest.fn()
    const { rerender } = render(<FeaturesTab {...props} onUse={onUse} />)

    await user.click(
      screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
    )
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'second-wind', type: 'feat' }),
    )
    await user.click(
      screen.getByRole('button', { name: /^Second Wind/, expanded: false }),
    )
    expect(screen.getByText('Class Feature · Fighter 1')).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('term')
        .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`),
    ).toEqual([
      'Activation: 1 Bonus Action',
      'Range: Self',
      'Healing: 1d10 + 5',
      'Uses: 1 of 1 left, Short Rest, Long Rest',
    ])

    // While the game takes no features, it's rolled here.
    rerender(<FeaturesTab {...props} />)
    await user.click(
      screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
    )
    expect(props.onRollDamage).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Second Wind healing', healing: true }),
    )
    expect(onUse).toHaveBeenCalledTimes(1)
    // A feature that rolls nothing is as it was.
    expect(
      screen.getByText('Darkvision').closest('li')?.querySelector('button'),
    ).toBeNull()
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

  it('stars a favorite', () => {
    render(
      <FavoriteMarks keys={new Set(['item:darkvision'])}>
        <FeaturesTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
        />
      </FavoriteMarks>,
    )

    expect(
      screen
        .getAllByText(', favorite')
        .map(star => star.closest('li')?.textContent),
    ).toEqual(['Darkvision, favoritePassive'])
  })
})
