/* eslint-disable unicorn/no-this-outside-of-class --
 * the layout's getters, mocked, read the element they're called on */
import { useState } from 'react'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreatureSwitcher, type SwitcherCreature } from './creature-switcher'

/*
 * The browser lays out the row here as the mock below says (§8.9): a tab is 100 pixels wide, 12
 * more in the chosen weight, 8 more for a news dot; an avatar is 44. The row and the hidden copy
 * are as wide as what they hold, from 12 pixels of padding; the box is as wide as `boxWidth`.
 * Measuring the real row rather than the copy would then change with the choice and the news.
 */
let boxWidth = 1000
const scrolls = new WeakMap<Element, number>()

/** Whether an element is one of the row's tabs or avatars, or one of the copy's tabs. */
const isEntry = (element: HTMLElement) =>
  element.getAttribute('role') === 'tab' ||
  element.parentElement?.hasAttribute('inert') === true

/** How wide an entry draws itself. */
function entryWidth(element: HTMLElement): number {
  if (element.classList.contains('min-w-11')) return 44
  const dot = element.querySelector(':scope > .size-2.rounded-full.bg-primary')
  return (
    100 + (element.classList.contains('font-semibold') ? 12 : 0) + (dot ? 8 : 0)
  )
}

/** How wide a row draws itself: its entries, from its padding. */
const rowWidth = (element: HTMLElement) =>
  24 +
  [...element.children].reduce(
    (sum, child) => sum + entryWidth(child as HTMLElement),
    0,
  )

/** Where an entry starts in its row. */
function entryLeft(element: HTMLElement): number {
  let left = 12
  let before = element.previousElementSibling
  while (before) {
    left += entryWidth(before as HTMLElement)
    before = before.previousElementSibling
  }
  return left
}

/** The callbacks of the row's ResizeObservers, to call as the width changes. */
let observers: (() => void)[] = []

beforeEach(() => {
  boxWidth = 1000
  observers = []
  jest
    .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockImplementation(function (this: HTMLElement) {
      if (isEntry(this)) return entryWidth(this)
      if (this.hasAttribute('inert') || this.getAttribute('role') === 'tablist')
        return rowWidth(this)
      return 0
    })
  jest
    .spyOn(HTMLElement.prototype, 'offsetLeft', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return isEntry(this) ? entryLeft(this) : 0
    })
  jest
    .spyOn(Element.prototype, 'clientWidth', 'get')
    .mockImplementation(function (this: Element) {
      const holdsRow = this.querySelector(':scope > [role="tablist"]')
      return holdsRow || this.getAttribute('role') === 'tablist' ? boxWidth : 0
    })
  jest
    .spyOn(Element.prototype, 'scrollLeft', 'get')
    .mockImplementation(function (this: Element) {
      return scrolls.get(this) ?? 0
    })
  jest
    .spyOn(Element.prototype, 'scrollLeft', 'set')
    .mockImplementation(function (this: Element, value: number) {
      scrolls.set(this, value)
    })
  globalThis.ResizeObserver = jest.fn().mockImplementation(callback => {
    observers.push(() => callback([]))
    return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

/** The row's width changing, as its observers are told. */
const resize = () =>
  act(() => {
    for (const observer of observers) observer()
  })

const thorin: SwitcherCreature = { key: 'self', name: 'Thorin', news: '' }
const brakka: SwitcherCreature = {
  key: 'brakka',
  name: 'Brakka',
  kind: 'owned',
  news: '',
}
const bat = (key: string, number?: number): SwitcherCreature => ({
  key,
  name: 'Bat',
  number,
  kind: 'summoned',
  from: 'Find Familiar',
  news: '',
})
const drake: SwitcherCreature = {
  key: 'drake',
  name: 'Drake',
  kind: 'summoned',
  news: '',
}

type Options = {
  chosen?: string
  mounted?: string[]
  role?: 'player' | 'gm'
  onChoose?: (key: string) => void
}

const renderSwitcher = (
  creatures: SwitcherCreature[],
  { chosen = 'self', mounted = [], role = 'player', onChoose }: Options = {},
) =>
  render(
    <CreatureSwitcher
      creatures={creatures}
      chosen={chosen}
      onChoose={onChoose ?? jest.fn()}
      mounted={new Set(mounted)}
      character='Thorin'
      role={role}
    />,
  )

/** A switcher that chooses as it's told to, as the page does. */
function Choosing({
  creatures,
  onChoose,
}: Readonly<{
  creatures: SwitcherCreature[]
  onChoose?: (key: string) => void
}>) {
  const [chosen, setChosen] = useState('self')
  return (
    <CreatureSwitcher
      creatures={creatures}
      chosen={chosen}
      onChoose={key => {
        onChoose?.(key)
        setChosen(key)
      }}
      mounted={new Set()}
      character='Thorin'
      role='player'
    />
  )
}

const tablist = () =>
  screen.getByRole('tablist', { name: 'Character and companions' })
const tabs = () => within(tablist()).getAllByRole('tab')

/** Thorin, and Brakka with a portrait. */
const portraits = () => [
  thorin,
  { ...brakka, portrait: 'https://game/brakka.webp' },
]
/** An image's decode, which jsdom has none of, as a browser's answers it. */
const decodes = (decode: () => Promise<void>) =>
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    writable: true,
    value: decode,
  })

describe('CreatureSwitcher', () => {
  it('names its tablist, and has the character first, then the row in its order', () => {
    renderSwitcher([thorin, brakka, bat('b1'), drake])
    expect(tablist()).toBeInTheDocument()
    expect(tabs().map(tab => tab.getAttribute('aria-label'))).toEqual([
      'Thorin',
      'Brakka',
      'Bat',
      'Drake',
    ])
    expect(tabs()[0]).toHaveAttribute('id', 'creature-tab-self')
    expect(tabs()[1]).toHaveAttribute('id', 'creature-tab-brakka')
  })

  it('marks the chosen, gives it alone the Tab stop, and controls only mounted panes', () => {
    renderSwitcher([thorin, brakka, bat('b1')], {
      chosen: 'brakka',
      mounted: ['brakka'],
    })
    const [self, wolf, imp] = tabs()
    expect(wolf).toHaveAttribute('aria-selected', 'true')
    expect(self).toHaveAttribute('aria-selected', 'false')
    expect(wolf).toHaveAttribute('tabindex', '0')
    expect(self).toHaveAttribute('tabindex', '-1')
    expect(imp).toHaveAttribute('tabindex', '-1')
    // The character's pane always is; a companion's only once it's mounted.
    expect(self).toHaveAttribute('aria-controls', 'creature-panel-self')
    expect(wolf).toHaveAttribute('aria-controls', 'creature-panel-brakka')
    expect(imp).not.toHaveAttribute('aria-controls')
  })

  it('moves with the arrows, wrapping, and Home and End, focus first', async () => {
    const user = userEvent.setup()
    const focusedAs: (string | undefined)[] = []
    render(
      <Choosing
        creatures={[thorin, brakka, bat('b1')]}
        onChoose={() =>
          focusedAs.push(
            (document.activeElement as HTMLElement | null)?.dataset.key,
          )
        }
      />,
    )
    tabs()[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs()[1]).toHaveFocus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    // From the last, back to the character.
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowLeft}')
    expect(tabs()[2]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(tabs()[2]).toHaveAttribute('aria-selected', 'true')
    expect(tabs()[2]).toHaveFocus()
    // Each time, the tab had focus as it was chosen.
    expect(focusedAs).toEqual(['brakka', 'b1', 'self', 'b1', 'self', 'b1'])
  })

  it('shows each kind by its icon and says it in its description', () => {
    renderSwitcher([
      thorin,
      brakka,
      bat('b1'),
      drake,
      { ...bat('b2'), gone: true },
    ])
    const [self, wolf, imp, dragon, left] = tabs()
    expect(self).not.toHaveAttribute('data-kind')
    expect(self).not.toHaveAttribute('aria-describedby')
    expect(wolf).toHaveAttribute('data-kind', 'owned')
    expect(wolf.querySelector('.lucide-paw-print')).not.toBeNull()
    expect(wolf).toHaveAccessibleDescription('Thorin’s companion')
    expect(imp).toHaveAttribute('data-kind', 'summoned')
    expect(imp.querySelector('.lucide-sparkles')).not.toBeNull()
    expect(imp).toHaveAccessibleDescription(
      'Summoned by Thorin with Find Familiar',
    )
    expect(dragon).toHaveAccessibleDescription('Summoned by Thorin')
    expect(left).toHaveAttribute('data-kind', 'gone')
    expect(left.querySelector('.lucide-circle-off')).not.toBeNull()
    expect(left.querySelector('.lucide-sparkles')).toBeNull()
    expect(left).toHaveAccessibleDescription(
      'No longer with Thorin in your Gamemaster’s game',
    )
  })

  it('says "your game" for a gone one at the Gamemaster’s seat', () => {
    renderSwitcher([thorin, { ...brakka, gone: true }], { role: 'gm' })
    expect(tabs()[1]).toHaveAccessibleDescription(
      'No longer with Thorin in your game',
    )
  })

  it('ends a tab’s name with its news, in order, on a tab not chosen and not gone', () => {
    renderSwitcher(
      [
        { ...thorin, news: ', your Gamemaster asks for a roll, your turn' },
        { ...brakka, news: ', its turn, damage to roll' },
        { ...bat('b1'), news: ', damage to roll' },
        { ...bat('b2'), gone: true, news: ', its turn' },
      ],
      { chosen: 'b1' },
    )
    const [self, wolf, imp, left] = tabs()
    expect(self).toHaveAccessibleName(
      'Thorin, your Gamemaster asks for a roll, your turn',
    )
    expect(wolf).toHaveAccessibleName('Brakka, its turn, damage to roll')
    // None on the chosen one, nor on a gone one; and their dots with them.
    expect(imp).toHaveAccessibleName('Bat')
    expect(left).toHaveAccessibleName('Bat')
    const dot = '.size-2.rounded-full.bg-primary'
    expect(self.querySelector(dot)).not.toBeNull()
    expect(imp.querySelector(dot)).toBeNull()
    expect(left.querySelector(dot)).toBeNull()
  })

  it('badges a repeated name’s number, and names, titles it so', () => {
    renderSwitcher([thorin, bat('b1', 1), bat('b2', 2)])
    const [, first, second] = tabs()
    expect(first).toHaveAccessibleName('Bat 1')
    expect(second).toHaveAccessibleName('Bat 2')
    // Its own name shown, with the number its badge.
    expect(within(second).getByText('Bat')).toHaveAttribute('title', 'Bat 2')
    expect(within(second).getByText('2')).toHaveAttribute('aria-hidden')
    expect(within(tabs()[0]).getByText('Thorin')).toHaveAttribute(
      'title',
      'Thorin',
    )
  })

  describe('tabs or avatars', () => {
    // Thorin chosen and two more at their widest: 112, 120 and 120 pixels, from 24 of padding.
    const three = [thorin, brakka, bat('b1')]

    it('draws tabs where every tab fits', () => {
      boxWidth = 400
      renderSwitcher(three)
      expect(tablist()).toHaveAttribute('data-mode', 'tabs')
      expect(tabs().every(tab => tab.textContent !== '')).toBe(true)
    })

    it('draws avatars where they wouldn’t, all but the chosen, which keeps its name and kind', () => {
      boxWidth = 370
      renderSwitcher(three, { chosen: 'brakka' })
      expect(tablist()).toHaveAttribute('data-mode', 'avatars')
      const [self, wolf, imp] = tabs()
      // An avatar has no name to read but its accessible one, and no kind icon.
      expect(self).toHaveClass('min-w-11', 'rounded-full')
      expect(within(self).queryByText('Thorin')).toBeNull()
      expect(imp).toHaveClass('min-w-11')
      expect(imp.querySelector('.lucide-sparkles')).toBeNull()
      expect(within(imp).getByText('B').closest('[title]')).toHaveAttribute(
        'title',
        'Bat',
      )
      // The chosen keeps its whole tab.
      expect(wolf).not.toHaveClass('min-w-11')
      expect(within(wolf).getByText('Brakka')).toBeInTheDocument()
      expect(wolf.querySelector('.lucide-paw-print')).not.toBeNull()
      // Each still names itself.
      expect(self).toHaveAccessibleName('Thorin')
      expect(imp).toHaveAccessibleName('Bat')
    })

    it('keeps its mode as another is chosen, or news comes, the row re-measured', async () => {
      const user = userEvent.setup()
      // As tabs, the real row is 112 + 100 + 100 and 24 of padding, 336: it fits. The copy, at its
      // widest, is 376, which doesn't.
      boxWidth = 350
      const { rerender } = render(<Choosing creatures={three} />)
      expect(tablist()).toHaveAttribute('data-mode', 'avatars')
      await user.click(tabs()[2])
      resize()
      expect(tablist()).toHaveAttribute('data-mode', 'avatars')
      expect(tabs()[2]).not.toHaveClass('min-w-11')
      rerender(
        <Choosing
          creatures={[thorin, { ...brakka, news: ', its turn' }, bat('b1')]}
        />,
      )
      resize()
      expect(tablist()).toHaveAttribute('data-mode', 'avatars')
    })

    it('stays tabs as news comes and another is chosen', async () => {
      const user = userEvent.setup()
      boxWidth = 376
      const { rerender } = render(<Choosing creatures={three} />)
      expect(tablist()).toHaveAttribute('data-mode', 'tabs')
      rerender(
        <Choosing
          creatures={[
            { ...thorin, news: ', your turn' },
            { ...brakka, news: ', its turn' },
            { ...bat('b1'), news: ', damage to roll' },
          ]}
        />,
      )
      await user.click(tabs()[1])
      resize()
      expect(tablist()).toHaveAttribute('data-mode', 'tabs')
    })
  })

  it('fades an edge only where a tab runs past it', () => {
    boxWidth = 200
    renderSwitcher([thorin, brakka, bat('b1'), drake], { chosen: 'self' })
    // Avatars: the chosen 112, then three of 44, 256 pixels and 24 of padding, in a 200 box.
    const box = tablist().parentElement as HTMLElement
    const fades = () =>
      [...box.querySelectorAll(':scope > [aria-hidden].w-10')].map(fade =>
        fade.classList.contains('left-0') ? 'left' : 'right',
      )
    expect(fades()).toEqual(['right'])
    // Scrolled into the first tab's padding, no fade on the left yet.
    scrolls.set(tablist(), 10)
    fireEvent.scroll(tablist())
    expect(fades()).toEqual(['right'])
    scrolls.set(tablist(), 40)
    fireEvent.scroll(tablist())
    expect(fades()).toEqual(['left', 'right'])
    scrolls.set(tablist(), 80)
    fireEvent.scroll(tablist())
    expect(fades()).toEqual(['left'])
  })

  it('keeps the chosen tab in view, clear of either edge', () => {
    boxWidth = 200
    const { rerender } = renderSwitcher([thorin, brakka, bat('b1'), drake], {
      chosen: 'drake',
    })
    // The Drake, chosen, a tab: 12 + 44 × 3 = 144 to 256, at least 40 clear of either edge.
    const scrolled = scrolls.get(tablist()) ?? 0
    expect(144 - scrolled).toBeGreaterThanOrEqual(40)
    expect(scrolled + 200 - 256).toBeGreaterThanOrEqual(40)
    rerender(
      <CreatureSwitcher
        creatures={[thorin, brakka, bat('b1'), drake]}
        chosen='self'
        onChoose={jest.fn()}
        mounted={new Set()}
        character='Thorin'
        role='player'
      />,
    )
    // Thorin's tab at 12: scrolled back to 40 before it, as far as the row goes.
    expect(scrolls.get(tablist())).toBe(12 - 40)
  })

  it('draws a gone one’s initials in the muted tint over the card, and dims only a portrait', () => {
    renderSwitcher([
      thorin,
      { ...bat('b1'), gone: true },
      { ...drake, portrait: 'https://game/drake.webp', gone: true },
    ])
    const initials = within(tabs()[1]).getByText('B')
    expect(initials).toHaveClass('bg-text-secondary/15', 'text-text-secondary')
    expect(initials).not.toHaveClass('opacity-60')
    expect(initials.parentElement).toHaveClass('rounded-full', 'bg-card')
    const portrait = tabs()[2].querySelector('img')
    expect(portrait).toHaveClass('opacity-60')
    // The character's own in the accent, over the card too.
    const own = within(tabs()[0]).getByText('T')
    expect(own).toHaveClass('bg-primary', 'text-on-primary')
    expect(own.parentElement).toHaveClass('bg-card')
  })

  describe('a portrait that won’t load', () => {
    afterEach(() => {
      Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
    })

    it('falls back to its initials as its error is heard', () => {
      renderSwitcher(portraits())
      fireEvent.error(tabs()[1].querySelector('img')!)
      expect(tabs()[1].querySelector('img')).toBeNull()
      expect(within(tabs()[1]).getByText('B')).toBeInTheDocument()
    })

    it('falls back too where it failed before it was mounted, its error never heard', async () => {
      // As a page drawn on the server has it: the image done loading and broken before React
      // hydrates, so no error event reaches it.
      jest
        .spyOn(HTMLImageElement.prototype, 'complete', 'get')
        .mockReturnValue(true)
      jest
        .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
        .mockReturnValue(0)
      decodes(() => Promise.reject(new Error('EncodingError')))
      renderSwitcher(portraits())
      expect(await within(tabs()[1]).findByText('B')).toBeInTheDocument()
      expect(tabs()[1].querySelector('img')).toBeNull()
    })

    it('keeps one done loading that decodes with no size of its own, as an SVG may', async () => {
      jest
        .spyOn(HTMLImageElement.prototype, 'complete', 'get')
        .mockReturnValue(true)
      jest
        .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
        .mockReturnValue(0)
      const decode = jest.fn(() => Promise.resolve())
      decodes(decode)
      renderSwitcher(portraits())
      await waitFor(() => expect(decode).toHaveBeenCalled())
      await act(async () => {})
      expect(tabs()[1].querySelector('img')).toHaveAttribute(
        'src',
        'https://game/brakka.webp',
      )
    })
  })

  it('hands focus to the character’s sheet as the row empties, once its panel is shown', async () => {
    // A browser focuses nothing inside a hidden element; jsdom does, so here it's refused.
    const focus = HTMLElement.prototype.focus
    jest.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
      this: HTMLElement,
      options,
    ) {
      if (!this.closest('[hidden]')) focus.call(this, options)
    })
    // As the page has it: the character's panel hidden while the gone tab is chosen, and shown in
    // the same commit that drops the row, which React makes after the row's cleanup.
    const page = (row: boolean) => (
      <>
        {row && (
          <CreatureSwitcher
            creatures={[thorin, { ...bat('b1'), gone: true }]}
            chosen='b1'
            onChoose={jest.fn()}
            mounted={new Set(['b1'])}
            character='Thorin'
            role='player'
          />
        )}
        <div hidden={row}>
          <button
            type='button'
            role='tab'
            id='sheet-tab-character'
            aria-selected
          >
            Character
          </button>
        </div>
      </>
    )
    const { rerender } = render(page(true))
    // Focus on the character's tab, as arrowing onto it puts it before it's chosen.
    tabs()[0].focus()
    rerender(page(false))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Character' })).toHaveFocus(),
    )
  })
})
