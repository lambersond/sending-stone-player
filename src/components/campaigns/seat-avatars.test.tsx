import { render, screen } from '@testing-library/react'
import { SeatAvatars } from './seat-avatars'
import { seatsOf } from '@/utils/campaign-order'
import type { OwnedCampaign } from '@/types/campaign'

/** A campaign's characters, each with its player where one has chosen it. */
const characters = (
  ...seats: [string, string?][]
): OwnedCampaign['characters'] =>
  seats.map(([name, player], index) => ({
    id: `actor-${index}`,
    name,
    ...(player && { player, characterId: `char-${index}` }),
  }))

/** The circles drawn, each its letters and its title. */
const circles = (container: HTMLElement) =>
  [...(container.querySelector('[data-seats]')?.children ?? [])].map(circle => [
    circle.textContent,
    circle.getAttribute('title'),
  ])

describe('components/campaigns/seat-avatars (round 0.39.0)', () => {
  it('draws each player as two letters of their name, a question mark for a character not chosen, each titled', () => {
    const { container } = render(
      <SeatAvatars
        seats={seatsOf({
          characters: characters(
            ['Ireena Kolyana', 'Maya Ross'],
            ['Thorin Oakenshield', 'Alice'],
            ['Kasimir'],
          ),
        })}
      />,
    )

    expect(circles(container)).toEqual([
      ['MR', 'Maya Ross as Ireena Kolyana'],
      ['A', 'Alice as Thorin Oakenshield'],
      ['?', 'Kasimir, not chosen yet'],
    ])
    expect(screen.getByText('2 of 3 characters chosen')).toBeInTheDocument()
  })

  it('draws them for the eye only, the count saying it for a screen reader', () => {
    const { container } = render(
      <SeatAvatars
        seats={seatsOf({ characters: characters(['Vex', 'Bob Stone']) })}
      />,
    )

    const drawn = container.querySelector('[data-seats]')
    expect(drawn).toHaveAttribute('aria-hidden', 'true')
    for (const circle of drawn?.children ?? []) {
      expect(circle).toHaveClass('size-6', 'rounded-full')
      // Never a sign-in picture.
      expect(circle.querySelector('img')).toBeNull()
    }
    expect(screen.getByText('1 of 1 characters chosen')).toBeVisible()
  })

  it('draws five at most, counting every character', () => {
    const { container } = render(
      <SeatAvatars
        seats={seatsOf({
          characters: characters(
            ['Rook', 'Alice'],
            ['Wren', 'Bob'],
            ['Ilsa'],
            ['Sildar', 'Jo'],
            ['Mirna', 'Kai'],
            ['Gundren', 'Ash'],
            ['Daran'],
          ),
        })}
      />,
    )

    expect(circles(container).map(([letters]) => letters)).toEqual([
      'A',
      'B',
      '?',
      'J',
      'K',
    ])
    expect(screen.getByText('5 of 7 characters chosen')).toBeInTheDocument()
  })

  it('says there are no characters yet, drawing none', () => {
    const { container } = render(
      <SeatAvatars seats={seatsOf({ characters: [] })} />,
    )

    expect(container).toHaveTextContent(/^No characters yet$/)
    expect(container.querySelector('[data-seats]')).toBeNull()
  })
})
