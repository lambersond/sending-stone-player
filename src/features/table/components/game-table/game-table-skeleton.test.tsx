import { render, within } from '@testing-library/react'
import { GameTableSkeleton } from './game-table-skeleton'
import { CharacterSheet } from '@/features/sheet/components/character-sheet/character-sheet'
import { GmNote } from '@/features/table/components/gm-note/gm-note'
import { TableHeader } from '@/features/table/components/table-header/table-header'
import { fakeFullscreen } from '@/mocks/fullscreen'
import { characterSheet } from '@/mocks/sending-stone'
import { tableViewOf } from '@/mocks/switches'
import { toTableSheet } from '@/utils/table-view'

// The table's skeleton (v0.48.0) draws the Character tab's top in the sheet's own boxes, so that
// nothing moves as the sheet takes its place: here, box for box, against the sheet of a character
// with one size of hit die and no conditions, as most have.

/** The sheet's Character tab, Thorin's, with his fighter's d10s and no conditions. */
const renderSheet = () =>
  render(
    <CharacterSheet
      name='Thorin Oakenshield'
      sheet={toTableSheet(
        characterSheet({
          classes: [
            {
              name: 'Fighter',
              levels: 5,
              subclass: 'Champion',
              hitDice: { die: 'd10', value: 3, max: 5 },
            },
          ],
        }),
        'https://my-game.forge-vtt.com',
      )}
      onRoll={jest.fn()}
    />,
  ).container

/** The classes of each of an element's children. */
const childClasses = (element: Element) =>
  [...element.children].map(child => child.getAttribute('class'))

/** The skeleton's one box with exactly an element's classes. */
const drawnIn = (skeleton: Element, element: Element) => {
  const found = [...skeleton.querySelectorAll('*')].filter(
    box => box.getAttribute('class') === element.getAttribute('class'),
  )
  expect(found).toHaveLength(1)
  return found[0]
}

it("draws the sheet's card, its six tiles and the abilities in the sheet's own boxes, tile for tile", () => {
  const sheet = renderSheet()
  const skeleton = render(
    <GameTableSkeleton name='Thorin Oakenshield' />,
  ).container
  const drawn = (element: Element) => drawnIn(skeleton, element)

  // The card: who the character is, then its tiles, with no row of conditions between them; the
  // tiles its hit points and hit dice a pair, then armor class, proficiency, initiative and speed.
  const card = sheet.querySelector('header') as HTMLElement
  expect(childClasses(drawn(card))).toEqual(childClasses(card))
  const tiles = card.querySelector('dl') as HTMLElement
  expect(childClasses(drawn(tiles))).toEqual(childClasses(tiles))
  expect(tiles.children).toHaveLength(6)

  // The abilities, their six tiles, and in each its check over its save.
  const section = within(sheet).getByRole('region', { name: 'Abilities' })
  drawn(section)
  const abilities = section.querySelector('ul') as HTMLElement
  const drawnAbilities = drawn(abilities)
  expect(childClasses(drawnAbilities)).toEqual(childClasses(abilities))
  const [tile] = abilities.children
  const [drawnTile] = drawnAbilities.children
  for (const [index, part] of [...drawnTile.children].entries()) {
    expect(tile.children[index]).toHaveClass(...part.classList)
  }
})

describe('the header', () => {
  let fullscreen: ReturnType<typeof fakeFullscreen>
  beforeEach(() => {
    fullscreen = fakeFullscreen()
  })
  afterEach(() => fullscreen.restore())

  it.each([
    ["player's", false],
    ["Gamemaster's", true],
  ])(
    "draws the header in TableHeader's own boxes at the %s seat, its buttons' among them",
    (_, gm) => {
      const header = render(
        <TableHeader
          ref={null}
          character={{
            id: 'char-1',
            name: 'Thorin Oakenshield',
            gameUrl: 'https://my-game.forge-vtt.com',
            campaignTitle: 'The Lonely Mountain',
            campaignId: 'c1',
            actorId: 'thorin',
          }}
          gm={gm}
          playing
          view={tableViewOf()}
          tab='character'
          connection='live'
          onHelp={jest.fn()}
          deleteCharacter={gm ? undefined : jest.fn()}
        />,
      ).container.querySelector('header')!
      const skeleton = render(
        <GameTableSkeleton name='Thorin Oakenshield' gm={gm} />,
      ).container

      // Its two rows: back and the name, then the buttons.
      const bar = drawnIn(skeleton, header)
      expect(childClasses(bar)).toEqual(childClasses(header))
      const [lead, buttons] = header.children
      const [drawnLead, drawnButtons] = bar.children
      // The name's row: the name alone, or at the Gamemaster's seat the name and its pill.
      const row = lead.querySelector('h1')!.closest('.overflow-hidden')!
      const drawnRow = drawnIn(skeleton, row)
      expect(childClasses(drawnRow)).toEqual(childClasses(row))
      if (gm) {
        expect(childClasses(drawnRow.children[0])).toEqual(
          childClasses(row.children[0]),
        )
      }
      // Each button, back among them, has its slot's box: its own takes the same room.
      const controls = [
        lead.querySelector('a')!,
        ...buttons.querySelectorAll('button'),
      ]
      const slots = [
        drawnLead.children[0],
        ...[...drawnButtons.children].slice(1),
      ]
      expect(controls).toHaveLength(gm ? 3 : 4)
      expect(slots).toHaveLength(controls.length)
      for (const [index, slot] of slots.entries()) {
        expect(controls[index]).toHaveClass(...slot.classList)
      }
    },
  )
})

describe("the Gamemaster's note", () => {
  it("is drawn under the header at the Gamemaster's seat, in GmNote's box, with its words as they'll wrap while the game makes the rolls", () => {
    const note = render(<GmNote name='Thorin Oakenshield' rolls='made' />)
      .container.firstElementChild!
    const skeleton = render(
      <GameTableSkeleton name='Thorin Oakenshield' gm />,
    ).container

    const drawn = within(skeleton).getByText(
      "You're at Thorin Oakenshield's sheet as the Gamemaster.",
    )
    expect(drawn.previousElementSibling).toHaveTextContent(
      /^Thorin OakenshieldGM$/,
    )
    expect(drawn.nextElementSibling).toBe(
      within(skeleton).getByText('Thorin Oakenshield').closest('.flex-col')!
        .lastElementChild,
    )
    // GmNote's box, its colours the game's answer; its words GmNote's, the rest of them unseen.
    expect(drawn).toHaveClass(
      ...[...note.classList].filter(
        name => !/^(bg|border)-(primary|warning)/.test(name),
      ),
    )
    expect(drawn.textContent).toBe(note.textContent)
    expect(drawn.closest('[aria-hidden="true"]')).toBe(drawn)
    expect(drawn.querySelector('.invisible')).toHaveTextContent(
      /^What you roll here is made in your game as Thorin Oakenshield's, marked as yours\.$/,
    )
  })

  it("isn't drawn at the player's seat", () => {
    const skeleton = render(
      <GameTableSkeleton name='Thorin Oakenshield' />,
    ).container

    expect(within(skeleton).queryByText(/as the Gamemaster/)).toBeNull()
  })
})
