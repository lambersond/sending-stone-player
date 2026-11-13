import { render, screen } from '@testing-library/react'
import { CharacterList } from './character-list'
import { CharacterListSkeleton } from './character-list-skeleton'
import { Skeleton } from '@/components/skeleton/skeleton'

// The list's skeleton (v0.48.0) draws one character's row in the list's own boxes, so that the row,
// and the page below it, sit where they will once the list comes: a player has one character more
// often than any other number, and a new player's "no characters yet" is about as tall.

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

  // Its status, then one row; each of its boxes with every class of the list's, which also has
  // its looks as it's hovered or focused, which neither its size nor its place depends on.
  expect(skeleton.children).toHaveLength(2)
  const drawnRow = skeleton.querySelector(':scope > div') as HTMLElement
  const drawnLink = drawnRow.firstElementChild as HTMLElement
  const drawnAvatar = drawnLink.firstElementChild as HTMLElement
  expect(row.parentElement).toHaveClass(...skeleton.classList)
  expect(row).toHaveClass(...drawnRow.classList)
  expect(link).toHaveClass(...drawnLink.classList)
  expect(link.firstElementChild).toHaveClass(
    ...[...drawnAvatar.classList].filter(name => !blockLook.has(name)),
  )
})
