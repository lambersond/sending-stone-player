/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { fireEvent, render, screen } from '@testing-library/react'
import { Sparkles } from 'lucide-react'
import { joinParts, SheetEntry } from './sheet-entry'

describe('components/character-sheet/sheet-entry', () => {
  it("doesn't open without a description or details", () => {
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Darkvision'
          fallback={Sparkles}
          text={null}
        />
      </ul>,
    )

    expect(screen.getByRole('listitem')).toHaveTextContent('Darkvision')
    expect(document.querySelector('details')).toBeNull()
  })

  it('shows its icon, or the fallback when it fails to load', () => {
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Second Wind'
          img='https://my-game.forge-vtt.com/icons/heart.webp'
          fallback={Sparkles}
          meta='Class Feature'
          text={null}
        />
      </ul>,
    )

    const icon = document.querySelector('img') as HTMLImageElement
    expect(icon).toHaveClass('object-cover')
    fireEvent.error(icon)
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('details svg')).toBeInTheDocument()
  })

  it('opens to its details without loading anything when it has no description', () => {
    globalThis.fetch = jest.fn()
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Lucky'
          fallback={Sparkles}
          meta='Feat'
          text={null}
        />
      </ul>,
    )

    const details = document.querySelector('details') as HTMLDetailsElement
    details.open = true
    fireEvent(details, new Event('toggle'))

    expect(screen.getByText('Feat')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('opens to its facts, each with its label, and what follows its description', () => {
    globalThis.fetch = jest.fn()
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Shield'
          fallback={Sparkles}
          facts={[
            { label: 'Casting time', value: '1 Reaction' },
            { label: 'Range', value: 'Self' },
          ]}
          text={null}
        >
          <p>And then some.</p>
        </SheetEntry>
      </ul>,
    )

    const details = document.querySelector('details') as HTMLDetailsElement
    details.open = true
    fireEvent(details, new Event('toggle'))

    expect(
      screen
        .getAllByRole('term')
        .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`),
    ).toEqual(['Casting time: 1 Reaction', 'Range: Self'])
    expect(screen.getByText('And then some.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('opens to what follows its description alone', () => {
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Sack'
          fallback={Sparkles}
          text={null}
        >
          <p>It&apos;s empty.</p>
        </SheetEntry>
      </ul>,
    )

    expect(document.querySelector('details')).toBeInTheDocument()
  })

  it.each<[(string | false | null | undefined)[], string | undefined]>([
    [['1 Action', '30 ft'], '1 Action · 30 ft'],
    [['1 Action', null, false, undefined, ''], '1 Action'],
    [[null, false], undefined],
  ])('joins the parts %p of a row as %p', (parts, joined) => {
    expect(joinParts(...parts)).toBe(joined)
  })

  it('takes an address that is not a URL as not an SVG', () => {
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Odd'
          img='not a url'
          fallback={Sparkles}
          text={null}
        />
      </ul>,
    )

    expect(document.querySelector('img')).toHaveClass('object-cover')
  })
})

describe('components/character-sheet/sheet-entry, a plain row with a menu, from module 0.33.0', () => {
  it('takes focus, so the keyboard opens its menu, below it', () => {
    const onMenu = jest.fn()
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Pebble'
          fallback={Sparkles}
          text={null}
          onMenu={onMenu}
        />
      </ul>,
    )
    const row = screen.getByRole('listitem').firstElementChild as HTMLElement
    expect(document.querySelector('details')).toBeNull()
    expect(row).toHaveAttribute('tabindex', '0')
    row.focus()
    expect(row).toHaveFocus()

    // Shift+F10, or the context menu key, as Chrome sends it: no button.
    expect(fireEvent.contextMenu(row, { button: -1 })).toBe(false)
    expect(onMenu).toHaveBeenCalledWith(row, undefined)
  })

  it('takes no focus without a menu, as before', () => {
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Pebble'
          fallback={Sparkles}
          text={null}
        />
      </ul>,
    )
    const row = screen.getByRole('listitem').firstElementChild as HTMLElement
    expect(row).not.toHaveAttribute('tabindex')
  })
})

/** The spinners inside a part of the page. */
const spinners = (scope: Element) => [
  ...scope.querySelectorAll(String.raw`svg.motion-safe\:animate-spin`),
]

describe('components/character-sheet/sheet-entry, busy on a party’s sheet, from module 0.33.0’s feedback', () => {
  it.each([
    ['opens', 'Class Feature'],
    ['doesn’t open', undefined],
  ])(
    'shows one spinner right after its name, and its row busy, where it %s',
    (_, meta) => {
      render(
        <ul>
          <SheetEntry
            characterId='char-1'
            name='Rope'
            fallback={Sparkles}
            meta={meta}
            text={null}
            aside={<button type='button'>Take</button>}
            busy
          />
        </ul>,
      )

      const row = screen.getByRole('listitem')
      expect(row).toHaveAttribute('aria-busy', 'true')
      const [spinner, ...more] = spinners(row)
      expect(more).toEqual([])
      expect(spinner.previousElementSibling).toBe(screen.getByText('Rope'))
      expect(spinner).toHaveAttribute('aria-hidden', 'true')
      expect(spinner).toHaveClass('size-3.5', 'shrink-0', 'text-text-secondary')
      // Its text, and so its name, unchanged.
      expect(
        (row.querySelector('summary') ?? row.firstElementChild)?.textContent,
      ).toBe('RopeTake')
      expect(screen.getByRole('button', { name: 'Take' })).toBeInTheDocument()
    },
  )

  it('shows none, and isn’t busy, otherwise', () => {
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Rope'
          fallback={Sparkles}
          meta='Loot'
          text={null}
        />
      </ul>,
    )

    const row = screen.getByRole('listitem')
    expect(row).not.toHaveAttribute('aria-busy')
    expect(spinners(row)).toEqual([])
  })
})
