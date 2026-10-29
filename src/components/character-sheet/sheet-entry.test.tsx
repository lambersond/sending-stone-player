/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Sparkles } from 'lucide-react'
import { Favoriting } from './favoriting'
import { joinParts, SheetEntry } from './sheet-entry'
import { offeringFavorites } from '@/mocks/sending-stone'
import type { EffectChoice } from './effect-controls'

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

  describe('an icon that failed before it was mounted, from module 0.36.0’s round', () => {
    afterEach(() => {
      jest.restoreAllMocks()
      Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
    })

    it('shows the fallback, its error never heard', async () => {
      brokenBeforeMount()
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

      await waitFor(() => expect(document.querySelector('img')).toBeNull())
      expect(document.querySelector('details svg')).toBeInTheDocument()
    })
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

/** Darkvision's row: its plain row, or its summary's. */
const darkvisionRow = () =>
  screen.getByText('Darkvision').closest('li')?.firstElementChild as HTMLElement

describe('components/character-sheet/sheet-entry, favorites, from module 0.37.0', () => {
  /** A row, inside a pane that offers favorites. */
  const renderOffered = (props: Partial<Parameters<typeof SheetEntry>[0]>) => {
    const offering = offeringFavorites()
    render(
      <Favoriting value={offering.value}>
        <ul>
          <SheetEntry
            characterId='char-1'
            name='Darkvision'
            fallback={Sparkles}
            {...props}
          />
        </ul>
      </Favoriting>,
    )
    return offering
  }

  it.each([
    ['an item', 'item:darkvision', { type: 'item', id: 'darkvision' }],
    ['an effect', 'effect:cloak.ward', { type: 'effect', id: 'cloak.ward' }],
  ])(
    'offers its own menu for %s its favorites key names, and takes focus for the keyboard',
    (_name, favoriteKey, target) => {
      const offering = renderOffered({ favoriteKey })
      expect(darkvisionRow()).toHaveAttribute('tabindex', '0')
      fireEvent.contextMenu(darkvisionRow(), { button: -1 })
      fireEvent.click(
        screen.getByRole('menuitem', { name: 'Add to favorites' }),
      )
      expect(offering.chosen).toEqual([
        { target, name: 'Darkvision', op: 'add' },
      ])
    },
  )

  it.each([
    ['nothing its key names, as a skill', { favoriteKey: 'skill:prc' }],
    ['no key', {}],
    ['none, said', { favoriteKey: 'item:darkvision', favorite: null }],
  ])('offers none for %s', (_name, props) => {
    renderOffered(props)
    expect(darkvisionRow()).not.toHaveAttribute('tabindex')
    expect(fireEvent.contextMenu(darkvisionRow(), { button: 2 })).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens the menu it’s given, never its own besides', () => {
    const onMenu = jest.fn()
    renderOffered({ favoriteKey: 'item:darkvision', onMenu })
    fireEvent.contextMenu(darkvisionRow(), { button: 2 })
    expect(onMenu).toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

/** The summary of the one entry rendered, a row that opens, or null for a row that doesn't. */
const summaryRow = () => document.querySelector('summary') as HTMLElement

// Round 0.42.1 §P review: a spell's "Not prepared" mark cut its name short beside it on a phone.
// Its own prop, apart from the spell-slots favorite's, so that each item reverts alone.
describe('components/character-sheet/sheet-entry, a row that opens wrapping in a narrow list (round 0.42.1 §P review)', () => {
  const entry = (fields: Partial<Parameters<typeof SheetEntry>[0]> = {}) =>
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Detect Magic'
          fallback={Sparkles}
          detail='Action · Self'
          aside={<span data-testid='aside'>Not prepared</span>}
          meta='Level 1'
          {...fields}
        />
      </ul>,
    )

  it('wraps its summary under 28rem wide, the aside as given and the chevron last', () => {
    entry({ wraps: true })

    expect(summaryRow()).toHaveClass(
      'flex',
      'items-center',
      '@max-md:flex-wrap',
    )
    // The aside goes beneath by its own classes, as a spell's marks do; the row only lets it.
    expect(screen.getByTestId('aside').parentElement).toBe(summaryRow())
    expect(summaryRow().lastElementChild?.tagName).toBe('svg')
    expect(summaryRow().lastElementChild).toHaveClass('size-4', 'shrink-0')
  })

  it('keeps its summary as before without it', () => {
    entry()

    expect(summaryRow()).not.toHaveClass('@max-md:flex-wrap')
    expect(screen.getByTestId('aside').parentElement).toBe(summaryRow())
  })

  it('leaves a row that doesn’t open as it is', () => {
    entry({ wraps: true, meta: undefined })

    expect(summaryRow()).toBeNull()
    const own = screen.getByRole('listitem').firstElementChild as HTMLElement
    expect(own.className).toBe('flex items-center gap-3 rounded-xl px-2.5 py-2')
  })
})

/** An effect's controls, as a pane gives a row them (module 0.39.0). */
const effectChoice = (fields: Partial<EffectChoice> = {}): EffectChoice => ({
  ops: ['disable', 'delete'],
  waiting: false,
  choose: jest.fn(),
  ...fields,
})

describe('components/character-sheet/sheet-entry, one of the character’s own effects, from module 0.39.0', () => {
  it('is opened and closed by its owner, where it keeps that', () => {
    const onOpenChange = jest.fn()
    const { rerender } = render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Bless'
          fallback={Sparkles}
          lead={<p>Its controls</p>}
          open
          onOpenChange={onOpenChange}
        />
      </ul>,
    )
    // Drawn open, as where it was open in another section.
    expect(document.querySelector('details')).toHaveAttribute('open')
    expect(screen.getByText('Its controls')).toBeInTheDocument()

    rerender(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Bless'
          fallback={Sparkles}
          lead={<p>Its controls</p>}
          open={false}
          onOpenChange={onOpenChange}
        />
      </ul>,
    )
    expect(document.querySelector('details')).not.toHaveAttribute('open')
    expect(screen.queryByText('Its controls')).toBeNull()
    fireEvent.click(document.querySelector('summary') as HTMLElement)
    return waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true))
  })

  it('offers its favorites entry first in its menu, then Turn off or Turn on, then Delete…, each doing its own', () => {
    const offering = offeringFavorites(['effect:blessed'])
    const given = effectChoice()
    const onDelete = jest.fn()
    render(
      <Favoriting value={offering.value}>
        <ul>
          <SheetEntry
            characterId='char-1'
            name='Bless'
            fallback={Sparkles}
            favoriteKey='effect:blessed'
            lead={<p>Its controls</p>}
            effectChoice={given}
            onDelete={onDelete}
            dialog={<dialog aria-label='Asked' />}
          />
        </ul>
      </Favoriting>,
    )
    // Its dialog is the row's, outside what opens.
    const asked = document.querySelector('dialog') as HTMLElement
    expect(asked.closest('details')).toBeNull()
    expect(asked.parentElement?.tagName).toBe('LI')

    const summary = document.querySelector('summary') as HTMLElement
    fireEvent.contextMenu(summary, { button: 2 })
    const items = () =>
      screen.getAllByRole('menuitem').map(({ textContent }) => textContent)
    expect(items()).toEqual(['Remove from favorites', 'Turn off', 'Delete…'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Turn off' }))
    expect(given.choose).toHaveBeenCalledWith('disable')
    expect(onDelete).not.toHaveBeenCalled()
    // The row had focus as the menu closed, for a dialog to give it back to.
    expect(summary).toHaveFocus()

    fireEvent.contextMenu(summary, { button: 2 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(given.choose).toHaveBeenCalledTimes(1)
  })

  it('offers Turn on of one off, and no Delete… where its `ops` give none, nor without a dialog to ask in', () => {
    const { rerender } = render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Rage'
          fallback={Sparkles}
          lead={<p>Its controls</p>}
          effectChoice={effectChoice({ ops: ['enable'] })}
          onDelete={jest.fn()}
        />
      </ul>,
    )
    const summary = document.querySelector('summary') as HTMLElement
    fireEvent.contextMenu(summary, { button: 2 })
    expect(
      screen.getAllByRole('menuitem').map(({ textContent }) => textContent),
    ).toEqual(['Turn on'])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

    rerender(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='Rage'
          fallback={Sparkles}
          lead={<p>Its controls</p>}
          effectChoice={effectChoice({ ops: ['disable', 'delete'] })}
        />
      </ul>,
    )
    fireEvent.contextMenu(summary, { button: 2 })
    expect(
      screen.getAllByRole('menuitem').map(({ textContent }) => textContent),
    ).toEqual(['Turn off'])
  })
})

/** The row of the one entry rendered. */
const row = () => screen.getByRole('listitem').firstElementChild as HTMLElement

describe('components/character-sheet/sheet-entry, its aside beneath its name in a narrow list (round 0.42.1 §U.1.1.11)', () => {
  const entry = (fields: Partial<Parameters<typeof SheetEntry>[0]> = {}) =>
    render(
      <ul>
        <SheetEntry
          characterId='char-1'
          name='1st Level'
          fallback={Sparkles}
          detail='Spell slots'
          aside={<span data-testid='aside'>dots</span>}
          {...fields}
        />
      </ul>,
    )

  // Changed on purpose (round 0.42.1 review): by the list's width, a container under 28rem, not the
  // screen's, so that a desk's Favorites column and a tablet's two lists put it beneath too.
  it('wraps in a list under 28rem wide, the aside on its own line past the icon, after the spacer', () => {
    entry({ asideBelow: true })

    expect(row()).toHaveClass(
      'flex',
      'items-center',
      'gap-3',
      '@max-md:flex-wrap',
    )
    expect(row().className).not.toMatch(/max-sm:/)
    const own = screen.getByTestId('aside').parentElement as HTMLElement
    expect(own.parentElement).toBe(row())
    expect(own.className).toBe(
      '@max-md:order-last @max-md:basis-full @max-md:pl-11',
    )
    // The spacer stays beside the name, so the name keeps its width.
    expect(row().lastElementChild).toHaveClass('size-4', 'shrink-0')
  })

  it('keeps the row as before without it', () => {
    entry()

    expect(row().className).toBe(
      'flex items-center gap-3 rounded-xl px-2.5 py-2',
    )
    expect(screen.getByTestId('aside').parentElement).toBe(row())
  })

  it('keeps a row that opens as before, its aside in its summary', () => {
    entry({ asideBelow: true, meta: 'Spell slots' })

    const summary = document.querySelector('summary') as HTMLElement
    expect(summary).not.toHaveClass('@max-md:flex-wrap')
    expect(screen.getByTestId('aside').parentElement).toBe(summary)
  })
})
