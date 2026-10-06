/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConditionsReference } from './conditions-reference'
import { CONDITIONS } from '@/constants/conditions'
import type { SheetCondition } from '@/types/sending-stone'

const condition = (
  fields: Partial<SheetCondition> & Pick<SheetCondition, 'id' | 'name'>,
): SheetCondition => ({
  img: null,
  level: null,
  detail: null,
  text: null,
  ...fields,
})

describe('components/character-sheet/conditions-reference', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    delete (Element.prototype as Partial<Element>).scrollIntoView
  })

  it('gives every condition of the 2024 rules, in order, with its rules', () => {
    render(<ConditionsReference conditions={[]} />)

    const names = [
      'Blinded',
      'Charmed',
      'Deafened',
      'Exhaustion',
      'Frightened',
      'Grappled',
      'Incapacitated',
      'Invisible',
      'Paralyzed',
      'Petrified',
      'Poisoned',
      'Prone',
      'Restrained',
      'Stunned',
      'Unconscious',
    ]
    expect(
      screen.getAllByRole('heading').map(heading => heading.textContent),
    ).toEqual(names)
    expect(new Set(CONDITIONS.map(({ id }) => id)).size).toBe(names.length)
    expect(CONDITIONS.every(({ rules }) => rules.length > 0)).toBe(true)
    const exhaustion = screen.getByRole('region', { name: 'Exhaustion' })
    expect(
      within(exhaustion)
        .getAllByRole('paragraph')
        .map(rule => rule.textContent),
    ).toEqual([
      'Exhaustion Levels. This condition is cumulative. Each time you receive it, you gain 1 Exhaustion level. You die if your Exhaustion level is 6.',
      'D20 Tests Affected. When you make a D20 Test, the roll is reduced by 2 times your Exhaustion level.',
      'Speed Reduced. Your Speed is reduced by a number of feet equal to 5 times your Exhaustion level.',
      'Removing Exhaustion Levels. Finishing a Long Rest removes 1 of your Exhaustion levels. When your Exhaustion level reaches 0, the condition ends.',
    ])
    expect(
      screen.getByText(/A condition is a temporary game state/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Each instance of the condition/i),
    ).toBeInTheDocument()
  })

  it("marks the character's own, and exhaustion's level", () => {
    render(
      <ConditionsReference
        conditions={[
          condition({ id: 'poisoned', name: 'Poisoned' }),
          condition({ id: 'exhaustion', name: 'Exhaustion', level: 2 }),
          condition({ id: 'concentrating', name: 'Concentrating' }),
        ]}
      />,
    )

    expect(screen.getByRole('region', { name: 'Poisoned' })).toHaveTextContent(
      'You have it',
    )
    expect(
      screen.getByRole('region', { name: 'Exhaustion' }),
    ).toHaveTextContent("You're at level 2")
    expect(
      screen.getByRole('region', { name: 'Blinded' }),
    ).not.toHaveTextContent('You have it')
    const jump = within(
      screen.getByRole('navigation', { name: 'Go to a condition' }),
    )
    expect(jump.getByRole('button', { name: 'Poisoned' })).toHaveClass(
      'text-ruby',
    )
    expect(jump.getByRole('button', { name: 'Prone' })).not.toHaveClass(
      'text-ruby',
    )
  })

  it.each([
    [false, 'smooth'],
    [true, 'auto'],
  ])(
    'jumps to a condition by its name (reduced motion: %s)',
    async (reduced, behavior) => {
      const user = userEvent.setup()
      const scrolled = jest.fn()
      Element.prototype.scrollIntoView = scrolled
      jest
        .spyOn(globalThis, 'matchMedia')
        .mockReturnValue({ matches: reduced } as MediaQueryList)
      render(<ConditionsReference conditions={[]} />)

      await user.click(screen.getByRole('button', { name: 'Stunned' }))

      expect(scrolled).toHaveBeenCalledWith({ block: 'start', behavior })
      expect(scrolled.mock.contexts[0]).toBe(
        screen.getByRole('region', { name: 'Stunned' }),
      )
    },
  )

  it("credits the SRD 5.2 as its licence asks, and says what's left out", () => {
    render(<ConditionsReference conditions={[]} />)

    expect(
      screen.getByText(/This work includes material from the System Reference/),
    ).toHaveTextContent(
      'This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
    )
    expect(
      screen.getByRole('link', { name: 'https://www.dndbeyond.com/srd' }),
    ).toHaveAttribute('href', 'https://www.dndbeyond.com/srd')
    expect(
      screen.getByText(/Each condition's opening line is left out/),
    ).toBeInTheDocument()
  })
})
