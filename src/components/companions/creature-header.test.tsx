/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import { CreatureHeader, otherSpeeds } from './creature-header'
import { ActionsTab } from '@/components/character-sheet/actions-tab'
import {
  characterSheet,
  mockCreature,
  sheetAction,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet, SheetCreature } from '@/types/sending-stone'
import type { CreatureFacts, TableSheet } from '@/types/table'

const GAME = 'https://my-game.forge-vtt.com'

/** A wolf's sheet, as module 0.36.0 sends an NPC's, with what's given. */
const wolfSheet = (
  fields: Partial<CharacterSheet> = {},
  creature: Partial<SheetCreature> = {},
): TableSheet =>
  toTableSheet(
    characterSheet({
      level: null,
      classes: [],
      species: null,
      background: null,
      hp: { value: 11, max: 11, temp: 0 },
      ac: 13,
      proficiency: 2,
      initiative: 2,
      speed: { value: 40, units: 'ft' },
      creature: mockCreature(creature),
      ...fields,
    }),
    GAME,
  )

const owned: CreatureFacts = {
  name: 'Brakka',
  relation: { kind: 'owned', of: 'Thorin' },
}

const renderHeader = (
  sheet: TableSheet = wolfSheet(),
  facts: CreatureFacts = owned,
  options: { follows?: string; combatId?: string; name?: string } = {},
) =>
  render(
    <CreatureHeader
      name={options.name ?? facts.name}
      sheet={sheet}
      facts={facts}
      actions={{ onRoll: jest.fn(), onMenu: jest.fn() }}
      combatId={options.combatId}
      follows={options.follows}
      idPrefix='creature-brakka-'
    />,
  )

/** The header's tiles' labels, in order. */
const tiles = () =>
  within(screen.getAllByRole('definition')[0].closest('dl') as HTMLElement)
    .getAllByRole('term')
    .map(term => term.querySelector('span')?.textContent ?? term.textContent)

/**
 * Every image as a page drawn on the server has it: done loading and broken before React
 * hydrates, so its error never reaches `onError`, and it has nothing to decode.
 */
const brokenBeforeMount = () => {
  jest
    .spyOn(HTMLImageElement.prototype, 'complete', 'get')
    .mockReturnValue(true)
  jest
    .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
    .mockReturnValue(0)
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    writable: true,
    value: () => Promise.reject(new Error('EncodingError')),
  })
}

/** The creature's own stats, each label and value. */
const stats = () => {
  const list = screen.queryByLabelText('Creature stats')
  if (!list) return []
  return within(list)
    .getAllByRole('term')
    .map(term => `${term.textContent}: ${term.nextElementSibling?.textContent}`)
}

describe('CreatureHeader', () => {
  it('names the creature in its heading, numbered where repeated, labelling its section', () => {
    renderHeader(wolfSheet(), { ...owned, name: 'Bat 2' }, { name: 'Bat 2' })
    const heading = screen.getByRole('heading', { level: 2, name: 'Bat 2' })
    expect(heading).toHaveAttribute('id', 'creature-brakka-creature-name')
    expect(screen.getByRole('region', { name: 'Bat 2' })).toContainElement(
      heading,
    )
  })

  it('says what the creature is, each part left out where it has none', () => {
    const { unmount } = renderHeader()
    expect(screen.getByText('Medium Beast, Unaligned')).toBeInTheDocument()
    unmount()
    const fey = renderHeader(
      wolfSheet({}, { size: 'Tiny', type: 'Fey', alignment: null }),
    )
    expect(screen.getByText('Tiny Fey')).toBeInTheDocument()
    fey.unmount()
    const { container } = renderHeader(
      wolfSheet({}, { size: null, type: null, alignment: null }),
    )
    expect(container.querySelectorAll('p.font-semibold')).toHaveLength(0)
  })

  it('says whose it is: owned, summoned with its item, or summoned', () => {
    const { unmount } = renderHeader()
    expect(screen.getByText('Thorin’s companion')).toBeInTheDocument()
    unmount()
    const imp = renderHeader(wolfSheet(), {
      name: 'Imp',
      relation: { kind: 'summoned', of: 'Thorin', from: 'Find Familiar' },
    })
    expect(
      screen.getByText('Summoned by Thorin with Find Familiar'),
    ).toBeInTheDocument()
    imp.unmount()
    renderHeader(wolfSheet(), {
      name: 'Drake',
      relation: { kind: 'summoned', of: 'Thorin' },
    })
    expect(screen.getByText('Summoned by Thorin')).toBeInTheDocument()
  })

  it.each([
    [0.125, 'CR 1/8'],
    [0.25, 'CR 1/4'],
    [0.5, 'CR 1/2'],
    [0, 'CR 0'],
    [17, 'CR 17'],
  ])('rates a challenge of %s as %s', (cr, words) => {
    renderHeader(wolfSheet({}, { cr }))
    expect(screen.getByText(words)).toBeInTheDocument()
  })

  it('has no rating chip for none, and says when it’s in its lair', () => {
    renderHeader(
      wolfSheet({}, { cr: null, lair: { inside: true, initiative: 20 } }),
    )
    expect(screen.queryByText(/^CR /)).toBeNull()
    expect(screen.getByText('In its lair')).toBeInTheDocument()
  })

  it('has five tiles, and no hit dice tile', () => {
    renderHeader()
    expect(tiles()).toEqual([
      'Hit points',
      'Armor class',
      'Proficiency',
      'Initiative',
      'Speed',
    ])
    expect(
      screen.getByRole('button', { name: 'Initiative, +2' }),
    ).toBeInTheDocument()
  })

  it('shows a dash for a creature with no proficiency of its own', () => {
    renderHeader(wolfSheet({ proficiency: null }))
    const tile = screen.getByText('Proficiency').closest('div')
    expect(tile).toHaveTextContent('—')
  })

  it('shows its other speeds under its walking speed', () => {
    renderHeader(
      wolfSheet({
        speed: { value: 5, units: 'ft' },
        traits: [
          { id: 'speeds', label: 'Speed', values: ['Walk 5 ft', 'Fly 30 ft'] },
        ],
      }),
    )
    const tile = screen.getByText('Speed', { selector: 'dt' }).closest('div')
    expect(within(tile as HTMLElement).getByText('fly 30 ft')).toHaveClass(
      'block',
      'text-xs',
    )
    expect(tile).toHaveTextContent('5ftfly 30 ft')
  })

  it('says each of the creature’s own stats, the lair’s initiative only in its lair', () => {
    const { unmount } = renderHeader(
      wolfSheet(
        {},
        {
          legendary: { value: 3, max: 3 },
          resistance: { value: 1, max: 1 },
          lair: { inside: true, initiative: 20 },
        },
      ),
    )
    expect(stats()).toEqual([
      'Legendary actions: 3 of 3',
      'Legendary resistance: 1 of 1',
      'Hit dice: 2 of 2 (d8)',
      'Lair initiative: 20',
    ])
    unmount()
    renderHeader(
      wolfSheet(
        {},
        {
          legendary: { value: 3, max: 3 },
          lair: { inside: false, initiative: 20 },
        },
      ),
    )
    expect(stats()).toEqual([
      'Legendary actions: 3 of 3',
      'Hit dice: 2 of 2 (d8)',
    ])
  })

  it('has no stats box where none applies', () => {
    renderHeader(wolfSheet({}, { hitDice: null }))
    expect(screen.queryByLabelText('Creature stats')).toBeNull()
  })

  it('shows death saves only for an important creature', () => {
    const down = {
      hp: { value: 0, max: 11, temp: 0 },
      deathSaves: { success: 1, failure: 0 },
    }
    const { unmount } = renderHeader(wolfSheet(down))
    expect(screen.queryByText('Death saves')).toBeNull()
    unmount()
    renderHeader(wolfSheet(down, { important: true }))
    expect(screen.getByText('Death saves')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Death saving throw' }),
    ).toBeInTheDocument()
  })

  describe('a portrait that won’t load, from module 0.36.0’s round', () => {
    afterEach(() => {
      jest.restoreAllMocks()
      Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
    })

    it('shows its initials where it failed before it was mounted, its error never heard', async () => {
      brokenBeforeMount()
      renderHeader()
      expect(await screen.findByText('B')).toHaveClass('size-16')
      expect(document.querySelector('img')).toBeNull()
    })
  })
})

const speeds = (values: string[], walk = 5) =>
  otherSpeeds(
    wolfSheet({
      speed: { value: walk, units: 'ft' },
      traits: [{ id: 'speeds', label: 'Speed', values }],
    }),
  )

describe('otherSpeeds', () => {
  it('leaves out the walking speed, and starts each in lower case', () => {
    expect(speeds(['Speed 5 ft', 'Fly 30 ft'])).toEqual(['fly 30 ft'])
    expect(speeds(['Walk 30 ft', 'Fly 60 ft', 'Swim 30 ft'])).toEqual([
      'fly 60 ft',
      'swim 30 ft',
    ])
  })

  it('gives none for one speed, or none at all', () => {
    expect(speeds(['Walk 40 ft'])).toEqual([])
    expect(otherSpeeds(wolfSheet())).toEqual([])
  })

  it('keeps the first where the creature has no walking speed', () => {
    expect(speeds(['Fly 30 ft'], 0)).toEqual(['fly 30 ft'])
  })
})

const drake = (legendary: SheetCreature['legendary']) =>
  wolfSheet(
    {
      actions: [
        {
          id: 'action',
          label: 'Actions',
          actions: [sheetAction({ id: 'rend', name: 'Rend' })],
        },
        {
          id: 'legendary',
          label: 'Legendary Actions',
          actions: [sheetAction({ id: 'wing', name: 'Wing Attack' })],
        },
      ],
    },
    { legendary },
  )

describe('the Legendary Actions count', () => {
  it('says how many it has left beside the heading, in words', () => {
    render(
      <ActionsTab
        characterId='char-1'
        sheet={drake({ value: 1, max: 3 })}
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
      />,
    )
    const section = screen.getByRole('region', { name: 'Legendary Actions' })
    expect(within(section).getByText('1 of 3 left')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Actions' })).queryByText(
        /left$/,
      ),
    ).toBeNull()
  })

  it('says nothing where the creature has no pool', () => {
    render(
      <ActionsTab
        characterId='char-1'
        sheet={drake(null)}
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
      />,
    )
    expect(screen.queryByText(/ left$/)).toBeNull()
  })
})
