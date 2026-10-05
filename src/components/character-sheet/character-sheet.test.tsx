/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterSheet, classLine } from './character-sheet'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet as Sheet } from '@/types/sending-stone'

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

    expect(onRoll.mock.calls).toEqual([
      [{ label: 'Strength check', modifier: 4, advantage: undefined }],
      [{ label: 'Strength saving throw', modifier: 7, advantage: undefined }],
      [
        {
          label: 'Intelligence saving throw',
          modifier: -1,
          advantage: undefined,
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

    expect(onRoll).toHaveBeenCalledWith({
      label: 'Stealth check',
      modifier: 1,
      advantage: 'adv',
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
