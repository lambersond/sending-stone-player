import { render, screen } from '@testing-library/react'
import { CharacterList } from './character-list'
import { CharacterListSkeleton } from './character-list-skeleton'
import { Skeleton } from '@/components/skeleton/skeleton'

// The list's skeleton (v0.48.0) draws one character's row in the list's own boxes, so that the row,
// and the page below it, sit where they will once the list comes: a player has one character more
// often than any other number, and a new player's "no characters yet" is about as tall.

/** A box's classes, sorted, but those named, which neither its size nor its place depends on. */
const classesBut = (box: Element, ...but: Iterable<string>[]) => {
  const left = new Set(but.flatMap(names => [...names]))
  return [...box.classList].filter(name => !left.has(name)).toSorted()
}

/** A box's size classes, sorted. */
const size = (box: Element) =>
  [...box.classList].filter(name => /^(size|w|h)-/.test(name)).toSorted()

it("draws one row in the list's own boxes: the list, the row, the link across it and its avatar", () => {
  render(
    <CharacterList
      characters={[
        {
          id: 'char-1',
          name: 'Thorin',
          gameUrl: 'https://my-game.forge-vtt.com',
          campaignTitle: 'The Lonely Mountain',
          campaignId: 'c1',
          actorId: 'actor-thorin',
        },
      ]}
      onRemove={jest.fn()}
    />,
  )
  const link = screen.getByRole('link', { name: /Thorin/ })
  const row = link.parentElement as HTMLElement
  const skeleton = render(<CharacterListSkeleton />).container
    .firstElementChild as HTMLElement
  /** Every block's look, to which its caller adds its size and corners. */
  const blockLook = new Set(
    render(<Skeleton />).container.firstElementChild?.classList,
  )

  // Its status, then one row; each of its boxes with exactly the list's classes, both ways, but
  // for those the list's have for their looks: the row's as it's hovered (and the room it keeps
  // for its Delete, beside the link), the link's corner and the initials' size; and the avatar's
  // block's own look, its circle and its size.
  expect(skeleton.children).toHaveLength(2)
  const drawnRow = skeleton.querySelector(':scope > div') as HTMLElement
  const drawnLink = drawnRow.firstElementChild as HTMLElement
  const drawnAvatar = drawnLink.firstElementChild as HTMLElement
  const avatar = link.firstElementChild as HTMLElement
  expect(classesBut(skeleton)).toEqual(classesBut(row.parentElement!))
  expect(classesBut(drawnRow)).toEqual(
    classesBut(row, [
      'group',
      'pr-2',
      'transition-colors',
      'hover:border-primary/50',
    ]),
  )
  expect(classesBut(drawnLink)).toEqual(classesBut(link, ['rounded-l-2xl']))
  // The avatar's own look (its colours, its letters) aside, its size is the list's.
  expect(size(drawnAvatar)).toEqual(size(avatar))
  expect(classesBut(drawnAvatar, blockLook, ['rounded-full'])).toEqual(
    size(avatar),
  )
})
