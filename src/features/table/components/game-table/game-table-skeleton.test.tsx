import { render, within } from '@testing-library/react'
import { GameTableSkeleton } from './game-table-skeleton'
import { CharacterSheet } from '@/features/sheet/components/character-sheet/character-sheet'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'

// The table's skeleton (v0.48.0) draws the Character tab's top in the sheet's own boxes, so that
// nothing moves as the sheet takes its place: here, box for box, against the sheet of a character
// with one size of hit die, as most have.

/** The sheet's Character tab, Thorin's, with his fighter's d10s. */
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

it("draws the sheet's card, its six tiles and the abilities in the sheet's own boxes, tile for tile", () => {
  const sheet = renderSheet()
  const skeleton = render(
    <GameTableSkeleton name='Thorin Oakenshield' />,
  ).container
  /** The skeleton's one box with exactly an element of the sheet's classes. */
  const drawn = (element: Element) => {
    const found = [...skeleton.querySelectorAll('*')].filter(
      box => box.getAttribute('class') === element.getAttribute('class'),
    )
    expect(found).toHaveLength(1)
    return found[0]
  }

  // The card, then its hit points and hit dice a pair, then armor class, proficiency, initiative
  // and speed.
  const card = sheet.querySelector('header') as HTMLElement
  drawn(card)
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
