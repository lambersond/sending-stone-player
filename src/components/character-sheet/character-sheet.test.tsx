/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterSheet, classLine } from './character-sheet'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet as Sheet } from '@/types/sending-stone'
import type { TableCombat } from '@/types/table'

const sheetOf = (fields: Partial<Sheet> = {}) =>
  toTableSheet(characterSheet(fields), 'https://my-game.forge-vtt.com')

const renderSheet = (fields: Partial<Sheet> = {}) => {
  const onRoll = jest.fn()
  render(
    <CharacterSheet
      name='Thorin Oakenshield'
      sheet={sheetOf(fields)}
      onRoll={onRoll}
    />,
  )
  return onRoll
}

/** A combat the character is in, with its initiative. */
const combatWith = (initiative: number | null): TableCombat => ({
  id: 'cmbt1',
  name: null,
  started: true,
  round: 1,
  combatants: [
    {
      id: 'c-boss',
      name: 'Goblin Boss',
      initiative: null,
      defeated: false,
      side: 'other',
    },
    {
      id: 'c-thorin',
      name: 'Thorin Oakenshield',
      initiative,
      defeated: false,
      side: 'me',
    },
  ],
})

/** A class with hit dice of a size, this many left of how many. */
const hitDice = (die: string, value: number | null, max: number | null) => ({
  id: die,
  identifier: die,
  name: die,
  levels: max,
  subclass: null,
  hitDice: { die, value, max },
})

/** A stat's label, by its text. */
const term = (label: string) =>
  screen.queryAllByRole('term').find(term => term.textContent === label)

/** The Hit dice tile's description. */
const tile = () => term('Hit dice')?.nextSibling as HTMLElement

/** How many hit dice of a size are left, as a row of the Hit dice tile shows it. */
const counts = (row: HTMLElement) =>
  row.querySelector('[aria-hidden].tabular-nums') as HTMLElement

describe('components/character-sheet/character-sheet', () => {
  it('shows who the character is and their vital numbers', () => {
    renderSheet({ inspiration: true, hp: { value: 31, max: 44, temp: 5 } })

    expect(screen.getByText('Fighter 5 · Champion')).toBeInTheDocument()
    expect(screen.getByText('Dwarf · Soldier')).toBeInTheDocument()
    expect(screen.getByText('Inspired')).toBeInTheDocument()
    const stat = (label: string) =>
      screen.getByText(label).closest('dt')?.nextSibling
    expect(stat('Hit points')).toHaveTextContent('31 / 44 +5 temp')
    expect(stat('Armor class')).toHaveTextContent('18')
    expect(stat('Proficiency')).toHaveTextContent('+3')
    // Short forms, for a narrow box, are there for the narrow box to show.
    expect(screen.getByTitle('Proficiency')).toHaveTextContent('Prof')
    expect(screen.getByTitle('Armor class')).toHaveTextContent('AC')
    expect(screen.getByTitle('Initiative')).toHaveTextContent('Init')
    expect(stat('Initiative')).toHaveTextContent('+1')
    expect(stat('Speed')).toHaveTextContent('25ft')
  })

  it('leaves out what the sheet does not have', () => {
    renderSheet({
      hp: null,
      ac: null,
      proficiency: null,
      initiative: null,
      speed: null,
      species: null,
      background: null,
      skills: [],
    })

    expect(screen.queryByText('Armor class')).toBeNull()
    expect(screen.queryByText('Speed')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Skills' })).toBeNull()
  })

  it.each([
    [{ value: 30, max: 44, temp: 0 }, 'bg-primary'],
    [{ value: 20, max: 44, temp: 0 }, 'bg-warning'],
    [{ value: 5, max: 44, temp: 0 }, 'bg-danger'],
  ])('colors hit points %o by how hurt the character is', (hp, color) => {
    const { container } = render(
      <CharacterSheet
        name='Thorin'
        sheet={sheetOf({ hp })}
        onRoll={jest.fn()}
      />,
    )

    expect(container.querySelector(`.${color}[style]`)).toBeInTheDocument()
  })

  it("lists the character's traits", () => {
    renderSheet({
      traits: [
        { id: 'senses', label: 'Senses', values: ['Darkvision 60 ft'] },
        { id: 'languages', label: 'Languages', values: ['Common', 'Dwarvish'] },
      ],
    })

    const traits = screen.getByRole('region', { name: 'Traits' })
    expect(
      within(traits)
        .getAllByRole('term')
        .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`),
    ).toEqual(['Senses: Darkvision 60 ft', 'Languages: Common, Dwarvish'])
  })

  it('has no traits to show for a character without any', () => {
    renderSheet({ traits: [] })

    expect(screen.queryByRole('region', { name: 'Traits' })).toBeNull()
  })

  it.each([
    [
      { value: 0, max: 44, temp: 0 },
      { success: 0, failure: 0 },
    ],
    [
      { value: 3, max: 44, temp: 0 },
      { success: 2, failure: 1 },
    ],
  ])(
    'shows death saves while the character is down at %o, or has some marked, %o',
    (hp, deathSaves) => {
      renderSheet({ hp, deathSaves })

      const saves = screen.getByText('Death saves').closest('div')
      const marks = (label: string) => {
        const row = within(saves as HTMLElement).getByText(label)
          .parentElement as HTMLElement
        return [...(row.querySelector('[aria-hidden]')?.children ?? [])].map(
          mark => mark.classList.contains('border-transparent'),
        )
      }
      expect(marks('Successes')).toEqual(
        [0, 1, 2].map(index => index < deathSaves.success),
      )
      expect(marks('Failures')).toEqual(
        [0, 1, 2].map(index => index < deathSaves.failure),
      )
      expect(saves).toHaveTextContent(
        `Successes${deathSaves.success} of 3Failures${deathSaves.failure} of 3`,
      )
    },
  )

  it('rolls a death saving throw while the character is dying, for the game to make too', async () => {
    const user = userEvent.setup()
    const onRoll = renderSheet({
      hp: { value: 0, max: 44, temp: 0 },
      deathSaves: { success: 1, failure: 2 },
    })

    await user.click(screen.getByRole('button', { name: 'Death saving throw' }))

    expect(onRoll).toHaveBeenCalledWith({
      label: 'Death saving throw',
      modifier: 0,
      advantage: undefined,
      source: { kind: 'death' },
      explicit: false,
    })
  })

  it.each([
    ['up again', { value: 3, max: 44, temp: 0 }, { success: 2, failure: 1 }],
    ['stable', { value: 0, max: 44, temp: 0 }, { success: 3, failure: 0 }],
    ['dead', { value: 0, max: 44, temp: 0 }, { success: 1, failure: 3 }],
  ])('rolls no death saving throw for a character %s', (_, hp, deathSaves) => {
    renderSheet({ hp, deathSaves })

    expect(screen.getByText('Death saves')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Death saving throw' }),
    ).toBeNull()
  })

  it('rolls initiative, for the combat when the character waits to roll it there', async () => {
    const user = userEvent.setup()
    const onRoll = jest.fn()
    const { rerender } = render(
      <CharacterSheet
        name='Thorin Oakenshield'
        sheet={sheetOf()}
        combat={combatWith(null)}
        onRoll={onRoll}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Initiative, +1, to roll for the combat',
      }),
    )
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Initiative',
      modifier: 1,
      advantage: undefined,
      source: { kind: 'initiative', combatId: 'cmbt1' },
      explicit: false,
    })

    // Once rolled, or outside a combat, it rolls here only.
    rerender(
      <CharacterSheet
        name='Thorin Oakenshield'
        sheet={sheetOf()}
        combat={combatWith(14)}
        onRoll={onRoll}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Initiative, +1' }))
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Initiative',
      modifier: 1,
      advantage: undefined,
      source: undefined,
      explicit: false,
    })
    expect(onRoll.mock.lastCall?.[0].source).toBeUndefined()
  })

  describe('hit dice', () => {
    /** Thorin's sheet with classes of these hit dice, the game spending them or not. */
    const renderDice = (
      fields: Partial<Sheet>,
      spendsAtTable?: boolean,
    ): jest.Mock => {
      const onRollFormula = jest.fn()
      render(
        <CharacterSheet
          name='Thorin Oakenshield'
          sheet={sheetOf(fields)}
          onRoll={jest.fn()}
          onRollFormula={onRollFormula}
          spendsAtTable={spendsAtTable}
        />,
      )
      return onRollFormula
    }

    it('spends a hit die from a tile of its own, a tap a die of its size, the largest first, none with none left', async () => {
      const user = userEvent.setup()
      const onRollFormula = renderDice(
        {
          classes: [
            hitDice('d6', 0, 2),
            hitDice('d10', 3, 5),
            hitDice('d10', 1, 2),
          ],
        },
        true,
      )

      // Named for what each shows, then how many are left, a space before the comma, as a browser
      // also sets apart the words only a screen reader has.
      const spend = [
        within(tile()).getByRole('button', { name: 'Spend d10 , 4 of 7 left' }),
        within(tile()).getByRole('button', { name: 'Spend d6 , 0 of 2 left' }),
      ]
      expect(within(tile()).getAllByRole('button')).toEqual(spend)
      expect(spend[0]).toHaveTextContent(/^Spend d10/)
      expect(spend[0]).toBeEnabled()
      expect(spend[1]).toBeDisabled()
      // Beside each, what's left: as pips, and in words, in ruby with none left.
      const [d10, d6] = within(tile()).getAllByRole('listitem')
      expect(counts(d10)).toHaveTextContent('4 of 7 left')
      expect(
        [...counts(d10).querySelectorAll('.rounded-full')].map(pip =>
          pip.classList.contains('bg-primary'),
        ),
      ).toEqual([true, true, true, true, false, false, false])
      expect(counts(d10)).not.toHaveClass('text-ruby')
      expect(counts(d6)).toHaveTextContent('0 of 2 left')
      expect(counts(d6)).toHaveClass('text-ruby')
      // Taking the room the button leaves, the count puts its words under its pips on a phone,
      // the button staying beside it, rather than the button going under it.
      expect(counts(d10)).toHaveClass('flex-1', 'flex-wrap')

      await user.click(spend[0])
      // The die, and Thorin's Constitution modifier, giving back at least 1.
      expect(onRollFormula).toHaveBeenCalledWith({
        label: 'Hit die (d10)',
        terms: [
          { sign: 1, count: 1, sides: 10 },
          { sign: 1, flat: 3 },
        ],
        healing: true,
        minimum: 1,
        source: { kind: 'hitDie', denomination: 'd10' },
      })
    })

    it("says it rolls a hit die where the game won't spend it, as it's only rolled here", async () => {
      const user = userEvent.setup()
      const onRollFormula = renderDice({ classes: [hitDice('d10', 3, 5)] })

      await user.click(
        within(tile()).getByRole('button', { name: 'Roll d10 , 3 of 5 left' }),
      )
      expect(onRollFormula).toHaveBeenCalledWith(
        expect.objectContaining({
          source: { kind: 'hitDie', denomination: 'd10' },
        }),
      )
      expect(screen.queryByRole('button', { name: /^Spend/ })).toBeNull()
    })

    it('spends none at full hit points, and says so', async () => {
      const user = userEvent.setup()
      const onRollFormula = renderDice(
        {
          hp: { value: 44, max: 44, temp: 0 },
          classes: [hitDice('d10', 3, 5)],
        },
        true,
      )

      const spend = within(tile()).getByRole('button', {
        name: 'Spend d10 , 3 of 5 left',
      })
      expect(spend).toBeDisabled()
      expect(spend).toHaveAccessibleDescription('At full hit points')
      expect(tile()).toHaveTextContent(/At full hit points$/)
      await user.click(spend)
      expect(onRollFormula).not.toHaveBeenCalled()
    })

    it.each([
      ['one short of them', { value: 43, max: 44, temp: 0 }],
      // Above the maximum the sheet has, which leaves out an effect raising it, such as Aid's, as
      // at 42 of 40 raised to 45: some may still be missing.
      ['above their maximum', { value: 42, max: 40, temp: 0 }],
      ['with them unknown', { value: 43, max: null, temp: 0 }],
    ])('spends one at full hit points %s', (_, hp) => {
      renderDice({ hp, classes: [hitDice('d10', 3, 5)] }, true)

      expect(
        within(tile()).getByRole('button', { name: 'Spend d10 , 3 of 5 left' }),
      ).toBeEnabled()
      expect(tile()).not.toHaveTextContent('At full hit points')
    })

    it('says how many are left as far as the sheet knows', () => {
      renderDice(
        {
          classes: [
            hitDice('d12', null, 5),
            hitDice('d10', 2, null),
            hitDice('d8', null, null),
          ],
        },
        true,
      )

      expect(
        within(tile())
          .getAllByRole('button')
          .map(button => button.textContent),
      ).toEqual([
        'Spend d12, an unknown number of 5 left',
        'Spend d10, 2 left',
        'Spend d8, an unknown number left',
      ])
      // Without both counts, no pips.
      expect(
        within(tile())
          .getAllByRole('listitem')
          .map(row => row.querySelector('[aria-hidden]')?.textContent),
      ).toEqual(['– of 5 left', '2 left', '– left'])
      expect(tile().querySelector('.rounded-full')).toBeNull()
    })

    it('draws no pips past nine, where the words say it alone', () => {
      renderDice({ classes: [hitDice('d10', 7, 12)] }, true)

      expect(tile().querySelector('.rounded-full')).toBeNull()
      expect(tile()).toHaveTextContent(/^7 of 12 left/)
    })

    it('shows how many are left where nothing rolls them, with nothing to tap', () => {
      renderSheet({
        hp: null,
        classes: [hitDice('d10', 3, 5), hitDice('d3', 1, 1)],
      })

      // Whether or not the sheet has hit points; and only those of a size the game has.
      expect(within(tile()).queryByRole('button')).toBeNull()
      expect(
        within(tile())
          .getAllByRole('listitem')
          .map(row => row.textContent),
      ).toEqual(['3 of 5 leftd10, 3 of 5 left'])
      expect(tile()).not.toHaveTextContent('At full hit points')
    })

    it('has no tile for a character without hit dice the game has', () => {
      renderSheet({ classes: [hitDice('d3', 1, 1)] })

      expect(term('Hit dice')).toBeUndefined()
    })

    it('comes after the hit points and the death saves, and last on a row of its own where the sheet is wide, however wide', () => {
      renderDice(
        {
          hp: { value: 0, max: 44, temp: 0 },
          deathSaves: { success: 1, failure: 0 },
          classes: [hitDice('d10', 3, 5)],
        },
        true,
      )

      const terms = screen.getAllByRole('term')
      expect(terms.slice(0, 4).map(term => term.textContent)).toEqual([
        'Hit points',
        'Death saves',
        'Hit dice',
        'Armor classAC',
      ])
      // Never put back beside the others, in a column too narrow for a die and its button, nor
      // the others left shorter than it.
      const stat = terms[2].parentElement as HTMLElement
      expect(
        [...stat.classList].filter(name => /(order|col-span)-/.test(name)),
      ).toEqual(['col-span-2', '@lg:order-last', '@lg:col-span-6'])
      expect([...(stat.parentElement as HTMLElement).classList]).toEqual([
        'grid',
        'grid-cols-2',
        'gap-2',
        '@lg:grid-cols-6',
      ])
    })
  })

  it('leaves out death saves while the character is up and none are marked', () => {
    renderSheet({
      hp: { value: 3, max: 44, temp: 0 },
      deathSaves: { success: 0, failure: 0 },
    })

    expect(screen.queryByText('Death saves')).toBeNull()
  })

  it('leaves out death saves for a system without them', () => {
    renderSheet({ hp: { value: 0, max: 44, temp: 0 }, deathSaves: null })

    expect(screen.queryByText('Death saves')).toBeNull()
  })

  it('shows the portrait, or the initials when there is none or it fails', () => {
    const { container, unmount } = render(
      <CharacterSheet
        name='Thorin Oakenshield'
        sheet={sheetOf()}
        onRoll={jest.fn()}
      />,
    )
    const portrait = container.querySelector('img') as HTMLImageElement
    expect(portrait).toHaveAttribute(
      'src',
      'https://my-game.forge-vtt.com/worlds/erebor/thorin.webp',
    )
    fireEvent.error(portrait)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('TO')).toBeInTheDocument()
    unmount()

    renderSheet({ img: null })
    expect(screen.getByText('TO')).toBeInTheDocument()
  })

  it('rolls an ability check or a saving throw', async () => {
    const user = userEvent.setup()
    const onRoll = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Strength check, +4' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Strength saving throw, +7, proficient',
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Intelligence saving throw, −1' }),
    )

    // Each says what it is, for the Gamemaster's game to roll it too.
    const tap = { advantage: undefined, explicit: false }
    expect(onRoll.mock.calls).toEqual([
      [
        {
          ...tap,
          label: 'Strength check',
          modifier: 4,
          source: { kind: 'ability', key: 'str' },
        },
      ],
      [
        {
          ...tap,
          label: 'Strength saving throw',
          modifier: 7,
          source: { kind: 'save', key: 'str' },
        },
      ],
      [
        {
          ...tap,
          label: 'Intelligence saving throw',
          modifier: -1,
          source: { kind: 'save', key: 'int' },
        },
      ],
    ])
  })

  it('rolls a skill, with the advantage or disadvantage the character has', async () => {
    const user = userEvent.setup()
    const onRoll = renderSheet()
    const skills = screen.getByRole('region', { name: 'Skills' })

    expect(
      within(skills).getByRole('button', {
        name: 'Athletics check, +7 (proficient, passive 17)',
      }),
    ).toBeInTheDocument()
    expect(within(skills).getByText('Dis')).toBeInTheDocument()
    await user.click(
      within(skills).getByRole('button', {
        name: 'Stealth check, +1 (passive 11), with disadvantage',
      }),
    )

    expect(onRoll).toHaveBeenCalledWith({
      label: 'Stealth check',
      modifier: 1,
      advantage: 'dis',
      source: { kind: 'skill', key: 'ste' },
      explicit: false,
    })
  })

  it('marks half proficiency and expertise', () => {
    const sheet = characterSheet()
    renderSheet({
      skills: [
        { ...sheet.skills[0], proficiency: 2 },
        { ...sheet.skills[1], proficiency: 0.5, passive: null },
      ],
    })

    expect(
      screen.getByRole('button', {
        name: 'Athletics check, +7 (expertise, passive 17)',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Perception check, +4 (half proficiency)',
      }),
    ).toBeInTheDocument()
  })

  it("rolls with the advantage the character's conditions or features give", async () => {
    const user = userEvent.setup()
    const sheet = characterSheet()
    const onRoll = renderSheet({
      abilities: [{ ...sheet.abilities[0], checkMode: 1 }],
    })

    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByText('Adv')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: 'Strength check, +4, with advantage',
      }),
    )

    expect(onRoll).toHaveBeenCalledWith({
      label: 'Strength check',
      modifier: 4,
      advantage: 'adv',
      source: { kind: 'ability', key: 'str' },
      explicit: false,
    })
  })

  it("rolls with advantage or disadvantage from a right-click's menu, whatever the character's mode", async () => {
    const user = userEvent.setup()
    const onRoll = renderSheet()
    const stealth = screen.getByRole('button', { name: /^Stealth check/ })

    fireEvent.contextMenu(stealth)
    expect(
      screen.getByRole('menu', { name: 'Stealth check +1' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll with advantage' }),
    )

    // The player's say on how to roll it, as in dnd5e's roll dialog.
    expect(onRoll).toHaveBeenCalledWith({
      label: 'Stealth check',
      modifier: 1,
      advantage: 'adv',
      source: { kind: 'skill', key: 'ste' },
      explicit: true,
    })
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Strength check, +4' }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll with disadvantage' }),
    )
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Strength check',
      modifier: 4,
      advantage: 'dis',
      source: { kind: 'ability', key: 'str' },
      explicit: true,
    })
  })

  it('modifies a roll in a dialog, starting from how a tap would roll', async () => {
    const user = userEvent.setup()
    const onRoll = renderSheet()

    fireEvent.contextMenu(
      screen.getByRole('button', { name: /^Stealth check/ }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Modify roll…' }))

    const dialog = screen.getByRole('dialog', { name: 'Modify roll' })
    // Stealth has disadvantage from the character's conditions; the player rolls it normally.
    expect(
      within(dialog).getByRole('radio', { name: 'Disadvantage' }),
    ).toBeChecked()
    await user.click(within(dialog).getByRole('radio', { name: 'Normal' }))
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Extra dice or modifiers' }),
      '1d4',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Roll' }))

    expect(onRoll).toHaveBeenCalledWith({
      label: 'Stealth check',
      modifier: 1,
      advantage: undefined,
      extras: [{ sign: 1, count: 1, sides: 4 }],
      source: { kind: 'skill', key: 'ste' },
      explicit: true,
    })
    expect(dialog).not.toHaveAttribute('open')
  })

  it('closes the dialog without rolling', async () => {
    const user = userEvent.setup()
    const onRoll = renderSheet()

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Strength check, +4' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Modify roll…' }))
    const dialog = screen.getByRole('dialog', { name: 'Modify roll' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(dialog).not.toHaveAttribute('open')
    expect(onRoll).not.toHaveBeenCalled()

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Strength check, +4' }),
    )
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  describe('classLine', () => {
    it.each([
      [{}, 'Fighter 5 · Champion'],
      [
        {
          classes: [
            { name: 'Fighter', levels: 4, subclass: 'Champion' },
            { name: 'Rogue', levels: 1, subclass: null },
          ],
        },
        'Fighter 4 / Rogue 1 · Champion',
      ],
      [
        { classes: [{ name: 'Wizard', levels: null, subclass: null }] },
        'Wizard',
      ],
      [{ classes: [] }, 'Level 5'],
      [{ classes: [], level: null }, 'Character'],
    ])('describes %o as %s', (fields, line) => {
      expect(classLine(sheetOf(fields))).toBe(line)
    })
  })
})
