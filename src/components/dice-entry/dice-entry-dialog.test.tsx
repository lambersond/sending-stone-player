import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiceEntryDialog } from './dice-entry-dialog'
import { BANE_DIE, BLESS_DIE } from '@/mocks/sending-stone'
import { skippedWords } from '@/utils/effect-dice'
import { ELVEN_DIE } from '@/utils/typed-dice'
import type { DiceEntry } from '@/types/dice-entry'

/** Every die typed counting as itself, plus 5, as a check's modifier would. */
const plusFive = (values: (number | undefined)[][]) =>
  values.flat().reduce<number>((sum, value) => sum + (value ?? 0), 5)

const entry = (fields: Partial<DiceEntry> = {}): DiceEntry => ({
  title: 'Perception check',
  terms: [{ sides: 20, count: 1, label: 'd20' }],
  total: plusFive,
  ...fields,
})

// Animation frames, run only when a test says, as the browser draws after the dialog is shown.
let frames: FrameRequestCallback[] = []
const runFrames = () =>
  act(() => {
    for (const frame of frames.splice(0)) frame(0)
  })

beforeEach(() => {
  frames = []
  jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation(callback => frames.push(callback))
  jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const open = (
  asked: DiceEntry = entry(),
  { drawn = true }: { drawn?: boolean } = {},
) => {
  const onDone = jest.fn()
  const onCancel = jest.fn()
  const view = render(
    <DiceEntryDialog entry={asked} onDone={onDone} onCancel={onCancel} />,
  )
  if (drawn) runFrames()
  return { onDone, onCancel, ...view }
}

const box = (name: string) => screen.getByRole('textbox', { name })
const key = (name: string) => screen.getByRole('button', { name })
const keypad = () => screen.getByRole('group', { name: 'Keypad' })
/** The keypad's Next die, which isn't there on the last box. */
const queryNext = () =>
  within(keypad()).queryByRole('button', { name: 'Next die' })
const total = () => screen.getByRole('status')
/** The block of the total, the keypad and Done, kept in view as the dice scroll. */
const keptInView = () =>
  screen.getByRole('group', { name: 'Keypad' }).parentElement as HTMLElement
/** The Modal's scroller, the dice scrolling in it. */
const scroller = () =>
  screen.getByRole('dialog').querySelector('form')?.parentElement as HTMLElement

/**
 * The one box the keypad types into: marked current, and ringed, which is all that shows which it
 * is while focus is on a key or Done. Every other box neither.
 */
const expectCurrent = (name: string) => {
  const current = box(name)
  expect(current).toHaveAttribute('aria-current', 'true')
  expect(current).toHaveClass('ring-2', 'ring-primary')
  for (const each of screen.getAllByRole('textbox')) {
    if (each === current) continue
    expect(each).not.toHaveAttribute('aria-current')
    expect(each).not.toHaveClass('ring-2')
    expect(each).not.toHaveClass('ring-primary')
  }
}

// The theme's colours, as globals.css sets them, to measure a box's edge as WCAG measures it.
const css = readFileSync(
  path.join(process.cwd(), 'src/app/globals.css'),
  'utf8',
)

/** The colour tokens one block of the stylesheet sets, by name. */
const tokens = (start: string): Record<string, string> => {
  const from = css.indexOf(start)
  const block = css.slice(from, css.indexOf('\n}', from))
  return Object.fromEntries(
    [...block.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6});/gi)].map(
      ([, name, value]) => [name, value],
    ),
  )
}

const LIGHT = tokens('@theme {')
const DARK = { ...LIGHT, ...tokens('.dark {') }

const rgb = (hex: string) =>
  [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16))

const luminance = (channels: number[]) => {
  const [r, g, b] = channels.map(channel => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG's contrast ratio between two colours. */
const contrast = (one: number[], other: number[]) => {
  const [lighter, darker] = [luminance(one), luminance(other)].toSorted(
    (a, b) => b - a,
  )
  return (lighter + 0.05) / (darker + 0.05)
}

/** A short screen, such as a phone held sideways. */
const onShortScreen = () =>
  jest.spyOn(globalThis, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: query === '(max-height: 30rem)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )

const ADVANTAGE_AND_BLESS = entry({
  terms: [
    { sides: 20, count: 2, label: 'd20, advantage' },
    { sides: 4, count: 1, label: '+1d4' },
  ],
})

/** A critical hit's 20d6, its dice doubled: forty boxes, more than a short screen shows. */
const CRITICAL_20D6 = entry({
  title: 'Fireball damage',
  terms: [{ sides: 6, count: 40, label: '40d6 Fire' }],
})

/** A term's group of boxes, by its heading. */
const group = (name: string) => screen.getByRole('group', { name })

/** The boxes of Bless's d4 and Bane's, as asked for a save below. */
const blessBox = () => within(group('Bless: +1d4')).getByRole('textbox')
const baneBox = () => within(group('Bane: −1d4')).getByRole('textbox')
/** Elven Accuracy's third d20, on a line of its own from 0.42.1. */
const elven = () => group('Elven Accuracy: third d20')

describe('components/dice-entry/dice-entry-dialog', () => {
  describe('structure', () => {
    it('is closed with nothing to ask', () => {
      render(<DiceEntryDialog onDone={jest.fn()} onCancel={jest.fn()} />)

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('asks for the roll by its title, a group of boxes per term, named by its label', () => {
      open(ADVANTAGE_AND_BLESS)

      const dialog = screen.getByRole('dialog', { name: 'Perception check' })
      expect(dialog).toHaveTextContent('Type in what your dice show')
      const d20s = screen.getByRole('group', { name: 'd20, advantage' })
      expect(
        within(d20s)
          .getAllByRole('textbox')
          .map(each => each.getAttribute('aria-label')),
      ).toEqual(['d20 1 of 2', 'd20 2 of 2'])
      const bless = screen.getByRole('group', { name: '+1d4' })
      expect(within(bless).getByRole('textbox')).toHaveAccessibleName('d4')
      expect(screen.getByRole('group', { name: 'Keypad' })).toBeInTheDocument()
    })

    it('names each of many dice by its place, such as the third of 8d6', () => {
      open(entry({ terms: [{ sides: 6, count: 8, label: '8d6 Fire' }] }))

      expect(box('d6 3 of 8')).toBeInTheDocument()
      expect(screen.getAllByRole('textbox')).toHaveLength(8)
    })

    it('never opens the phone’s keyboard, holds three digits and has 16px text, as iOS zooms into smaller', () => {
      open(ADVANTAGE_AND_BLESS)

      for (const each of screen.getAllByRole('textbox')) {
        expect(each).toHaveAttribute('type', 'text')
        expect(each).toHaveAttribute('inputmode', 'none')
        expect(each).toHaveAttribute('autocomplete', 'off')
        expect(each).toHaveAttribute('maxlength', '3')
        expect(each).toHaveClass(
          'h-11',
          'w-12',
          'rounded-xl',
          'border',
          'bg-page',
          'text-center',
          'text-base',
          'tabular-nums',
        )
      }
    })

    it.each([
      ['light', LIGHT],
      ['dark', DARK],
    ])(
      'draws an empty box’s edge at 3:1 or more against the dialog, in the %s theme',
      (_, theme) => {
        open(ADVANTAGE_AND_BLESS)
        // Empty and not the one typed into: nothing but its edge shows where it is.
        const empty = box('d20 2 of 2')
        expect(empty).toHaveClass('border', 'bg-page')
        const edges = [...empty.classList].flatMap(name => {
          const [, token, percent] =
            /^border-([a-z-]+?)(?:\/(\d+))?$/.exec(name) ?? []
          return token && theme[token] ? [{ token, percent }] : []
        })
        expect(edges).toHaveLength(1)
        const [{ token, percent = '100' }] = edges
        // Drawn over the box's own fill, as a box's background reaches under its border.
        const alpha = Number(percent) / 100
        const below = rgb(theme.page)
        const edge = rgb(theme[token]).map(
          (channel, at) => channel * alpha + below[at] * (1 - alpha),
        )

        expect(contrast(edge, rgb(theme.card))).toBeGreaterThanOrEqual(3)
        // As the app's own border, the inputs' elsewhere, isn't.
        expect(contrast(rgb(theme.border), rgb(theme.card))).toBeLessThan(3)
      },
    )

    it('focuses the first box a frame after it opens, though a menu closing as it opened took focus back', () => {
      render(
        <>
          <button type='button'>Perception</button>
          <DiceEntryDialog
            entry={ADVANTAGE_AND_BLESS}
            onDone={jest.fn()}
            onCancel={jest.fn()}
          />
        </>,
      )
      // As the roll menu, closing in the same update, hands focus back to the chip that opened it.
      act(() => key('Perception').focus())

      runFrames()
      expect(box('d20 1 of 2')).toHaveFocus()
      expectCurrent('d20 1 of 2')
    })

    it('focuses the first box over the browser’s own focus on the dialog’s first button', () => {
      open(ADVANTAGE_AND_BLESS, { drawn: false })
      // The browser focuses the first thing it can in a dialog it shows: its Close.
      act(() => key('Close').focus())

      runFrames()
      expect(box('d20 1 of 2')).toHaveFocus()
    })

    it('leaves focus where the player put it before the frame', () => {
      open(ADVANTAGE_AND_BLESS, { drawn: false })
      act(() => box('d4').focus())

      runFrames()
      expect(box('d4')).toHaveFocus()
    })

    it('starts afresh for each roll asked for, every box empty', async () => {
      const user = userEvent.setup()
      const { rerender } = open()
      await user.click(key('1'))
      expect(box('d20')).toHaveValue('1')

      const next = entry({ title: 'Stealth check' })
      rerender(
        <DiceEntryDialog
          entry={next}
          onDone={jest.fn()}
          onCancel={jest.fn()}
        />,
      )
      runFrames()

      expect(
        screen.getByRole('dialog', { name: 'Stealth check' }),
      ).toBeInTheDocument()
      expect(box('d20')).toHaveValue('')
      expect(box('d20')).toHaveFocus()
    })
  })

  describe('typing', () => {
    it('types the keypad’s keys into the focused box, focus staying there', async () => {
      const user = userEvent.setup()
      open(ADVANTAGE_AND_BLESS)

      await user.click(key('1'))

      expect(box('d20 1 of 2')).toHaveValue('1')
      expect(box('d20 1 of 2')).toHaveFocus()
    })

    it('moves on once a die’s face is whole: a d6’s 4 at once', async () => {
      const user = userEvent.setup()
      open(entry({ terms: [{ sides: 6, count: 2, label: '2d6 Slashing' }] }))

      await user.click(key('4'))

      expect(box('d6 1 of 2')).toHaveValue('4')
      expect(box('d6 2 of 2')).toHaveFocus()
      expectCurrent('d6 2 of 2')
    })

    it('waits on a d20’s 1, which may be 10 to 19, until Next die', async () => {
      const user = userEvent.setup()
      open(ADVANTAGE_AND_BLESS)

      await user.click(key('1'))
      expect(box('d20 1 of 2')).toHaveFocus()

      await user.click(key('Next die'))
      expect(box('d20 1 of 2')).toHaveValue('1')
      expect(box('d20 2 of 2')).toHaveFocus()
    })

    it('moves on from a term’s last box to the next term’s first', async () => {
      const user = userEvent.setup()
      open(ADVANTAGE_AND_BLESS)

      await user.click(key('1'))
      await user.click(key('7'))
      expect(box('d20 2 of 2')).toHaveFocus()
      await user.click(key('4'))

      expect(box('d4')).toHaveFocus()
    })

    it('starts a box holding a whole face again with the next digit', async () => {
      const user = userEvent.setup()
      open(entry({ terms: [{ sides: 6, count: 2, label: '2d6' }] }))

      await user.click(key('4'))
      await user.click(box('d6 1 of 2'))
      await user.click(key('5'))

      expect(box('d6 1 of 2')).toHaveValue('5')
      expect(box('d6 2 of 2')).toHaveFocus()

      await user.click(box('d6 1 of 2'))
      await user.keyboard('3')
      expect(box('d6 1 of 2')).toHaveValue('3')
    })

    it('starts a d20 holding 17 again with a 3, as no digit more could make another face', async () => {
      const user = userEvent.setup()
      open(ADVANTAGE_AND_BLESS)

      await user.keyboard('17')
      await user.click(box('d20 1 of 2'))
      await user.keyboard('3')

      expect(box('d20 1 of 2')).toHaveValue('3')
    })

    it('moves on with Enter, and submits with it on the last box', async () => {
      const user = userEvent.setup()
      const { onDone } = open(ADVANTAGE_AND_BLESS)

      await user.keyboard('1{Enter}')
      expect(box('d20 2 of 2')).toHaveFocus()
      await user.keyboard('{Enter}')
      expect(box('d4')).toHaveFocus()
      expect(onDone).not.toHaveBeenCalled()

      await user.click(box('d20 2 of 2'))
      await user.keyboard('15')
      expect(box('d4')).toHaveFocus()
      await user.keyboard('3')
      expect(key('Done')).toHaveFocus()
      expect(onDone).not.toHaveBeenCalled()
      await user.click(box('d4'))
      await user.keyboard('{Enter}')

      expect(onDone).toHaveBeenCalledWith([[1, 15], [3]])
    })

    it('focuses Done once the last box is whole, the last box staying current', async () => {
      const user = userEvent.setup()
      open(entry({ terms: [{ sides: 6, count: 2, label: '2d6' }] }))

      await user.click(key('4'))
      await user.click(key('5'))

      expect(key('Done')).toHaveFocus()
      // Its ring is all that shows a key tapped now would type into it, in place of its 5.
      expectCurrent('d6 2 of 2')
      await user.click(key('2'))
      expect(box('d6 2 of 2')).toHaveValue('2')
      expect(box('d6 1 of 2')).toHaveValue('4')
    })

    it('has no Next die on its last box, a single die’s too', async () => {
      const user = userEvent.setup()
      const { onDone } = open()

      expect(queryNext()).toBeNull()
      expect(key('Done')).toBeVisible()
      await user.click(key('1'))
      // A d20's 1 may be 10 to 19: still no Next die, which would say there's more to type in.
      expect(queryNext()).toBeNull()
      expect(box('d20')).toHaveValue('1')
      expect(box('d20')).toHaveFocus()
      await user.click(key('7'))
      expect(queryNext()).toBeNull()
      expect(key('Done')).toHaveFocus()

      await user.click(key('Done'))
      expect(onDone).toHaveBeenCalledWith([[17]])
    })

    it('takes off the last digit with Delete and Backspace, without moving on', async () => {
      const user = userEvent.setup()
      open(ADVANTAGE_AND_BLESS)

      await user.keyboard('1')
      await user.click(key('Delete'))
      expect(box('d20 1 of 2')).toHaveValue('')

      await user.keyboard('25')
      expect(box('d20 1 of 2')).toHaveValue('25')
      // Its 2 left is a d20's start, and its 5 taken off moves nowhere.
      await user.keyboard('{Backspace}')
      expect(box('d20 1 of 2')).toHaveValue('2')
      expect(box('d20 1 of 2')).toHaveFocus()

      await user.keyboard('{Backspace}{Backspace}')
      expect(box('d20 1 of 2')).toHaveValue('')

      // The keyboard's own Delete too.
      await user.keyboard('25{Delete}')
      expect(box('d20 1 of 2')).toHaveValue('2')
    })

    it('stays on a box whose digit taken off leaves a whole face, by keyboard or keypad', async () => {
      const user = userEvent.setup()
      open(ADVANTAGE_AND_BLESS)

      // A d20's 35 comes only from a paste, as typing its 3 would move on; with its 5 taken off,
      // its 3 is whole, and the player is still on it.
      for (const takeOff of [
        () => user.keyboard('{Backspace}'),
        () => user.keyboard('{Delete}'),
        () => user.click(key('Delete')),
      ]) {
        await user.paste('35')
        expect(box('d20 1 of 2')).toHaveValue('35')
        await takeOff()

        expect(box('d20 1 of 2')).toHaveValue('3')
        expect(box('d20 1 of 2')).toHaveFocus()
        expectCurrent('d20 1 of 2')
      }
    })

    it('starts a box holding three digits again, as it holds no more', async () => {
      const user = userEvent.setup()
      open(ADVANTAGE_AND_BLESS)

      // As its maxLength holds back only what the browser types itself, not what the dialog puts.
      await user.keyboard('253')
      expect(box('d20 1 of 2')).toHaveValue('253')
      expect(box('d20 1 of 2')).toHaveAttribute('aria-invalid', 'true')

      await user.keyboard('4')
      expect(box('d20 1 of 2')).toHaveValue('4')
      expect(box('d20 1 of 2')).not.toHaveAttribute('aria-invalid')
      expect(box('d20 2 of 2')).toHaveFocus()
    })

    it('leaves a key held with Ctrl, Cmd or Alt to the browser, such as a paste', () => {
      open(ADVANTAGE_AND_BLESS)
      const first = box('d20 1 of 2')

      // fireEvent says false where the key's own action was prevented, as a plain letter's is.
      expect(fireEvent.keyDown(first, { key: 'v' })).toBe(false)
      for (const held of ['ctrlKey', 'metaKey', 'altKey']) {
        expect(fireEvent.keyDown(first, { key: 'v', [held]: true })).toBe(true)
        expect(fireEvent.keyDown(first, { key: '1', [held]: true })).toBe(true)
      }
      expect(first).toHaveValue('')
    })

    it('drops anything typed but digits, and keeps a paste’s digits, three at most', async () => {
      const user = userEvent.setup()
      open(entry({ terms: [{ sides: 100, count: 2, label: 'd100' }] }))

      await user.keyboard('a- .e')
      expect(box('d100 1 of 2')).toHaveValue('')

      await user.paste('1 0 0 7')
      expect(box('d100 1 of 2')).toHaveValue('100')
      expect(box('d100 2 of 2')).toHaveFocus()

      await user.paste('none')
      expect(box('d100 2 of 2')).toHaveValue('')
    })

    it('leaves Tab to move as usual', async () => {
      const user = userEvent.setup()
      open(ADVANTAGE_AND_BLESS)

      await user.tab()

      expect(box('d20 2 of 2')).toHaveFocus()
    })

    it('takes 00 only in a percentile die’s box', async () => {
      const user = userEvent.setup()
      const { onDone } = open(
        entry({
          title: 'Wild Magic Surge',
          terms: [
            { sides: 20, count: 1, label: 'd20' },
            { sides: 100, count: 1, label: '1d100' },
          ],
        }),
      )

      expect(key('00')).toHaveAttribute('aria-disabled', 'true')
      await user.click(key('00'))
      expect(box('d20')).toHaveValue('')

      await user.click(box('d100'))
      expect(key('00')).not.toHaveAttribute('aria-disabled')
      await user.click(key('00'))
      expect(box('d100')).toHaveValue('00')

      await user.click(box('d20'))
      await user.keyboard('9')
      await user.click(key('Done'))
      expect(onDone).toHaveBeenCalledWith([[9], [100]])
    })

    it('types a key into the current box wherever focus is, as on the keypad by keyboard', async () => {
      const user = userEvent.setup()
      open(entry({ terms: [{ sides: 6, count: 3, label: '3d6' }] }))

      // A keyboard or screen reader moved onto the keypad.
      act(() => key('4').focus())
      await user.keyboard('{Enter}')

      expect(box('d6 1 of 3')).toHaveValue('4')
      // The next box is current, and ringed as it is, focus left on the key.
      expectCurrent('d6 2 of 3')
      expect(key('4')).toHaveFocus()

      act(() => key('2').focus())
      await user.keyboard(' ')
      expect(box('d6 2 of 3')).toHaveValue('2')
      expectCurrent('d6 3 of 3')
    })

    it('scrolls the box moved on to clear of the keypad kept over the dice', async () => {
      const user = userEvent.setup()
      open(entry({ terms: [{ sides: 6, count: 12, label: '12d6' }] }))
      const keys = screen.getByRole('group', { name: 'Keypad' })
        .parentElement as HTMLElement
      const scroller = screen.getByRole('dialog').querySelector('form')
        ?.parentElement as HTMLElement
      jest
        .spyOn(keys, 'getBoundingClientRect')
        .mockReturnValue({ top: 500 } as DOMRect)
      jest
        .spyOn(box('d6 2 of 12'), 'getBoundingClientRect')
        .mockReturnValue({ bottom: 520 } as DOMRect)

      await user.click(key('4'))

      expect(box('d6 2 of 12')).toHaveFocus()
      expect(scroller.scrollTop).toBe(28)
    })
  })

  describe('errors', () => {
    it('marks a d6’s 7 at once, with what a d6 shows', async () => {
      const user = userEvent.setup()
      open(entry({ terms: [{ sides: 6, count: 2, label: '2d6' }] }))

      await user.keyboard('7')

      const seven = box('d6 1 of 2')
      expect(seven).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('alert')).toHaveTextContent('A d6 shows 1 to 6.')
      expect(seven).toHaveAccessibleDescription('A d6 shows 1 to 6.')
      expect(seven).toHaveFocus()

      await user.keyboard('{Backspace}')
      expect(seven).not.toHaveAttribute('aria-invalid')
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('leaves a d20’s 1 unmarked, which may yet be 10 to 19', async () => {
      const user = userEvent.setup()
      open()

      await user.keyboard('1')

      expect(box('d20')).not.toHaveAttribute('aria-invalid')
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('focuses the first box without a face on Done, marking each, and asks for every die', async () => {
      const user = userEvent.setup()
      const { onDone } = open(
        entry({
          terms: [
            { sides: 20, count: 2, label: 'd20, advantage' },
            { sides: 100, count: 1, label: '1d100' },
          ],
        }),
      )

      await user.keyboard('17')
      await user.click(box('d100'))
      await user.keyboard('0')
      // A percentile die's 0 may be on its way to 05: unmarked as typed.
      expect(box('d100')).not.toHaveAttribute('aria-invalid')
      expect(screen.queryByRole('alert')).toBeNull()
      await user.click(key('Done'))

      expect(onDone).not.toHaveBeenCalled()
      expect(box('d20 2 of 2')).toHaveFocus()
      expect(box('d20 2 of 2')).toHaveAttribute('aria-invalid', 'true')
      expect(box('d20 2 of 2')).toHaveAccessibleDescription(
        'Type in every die first.',
      )
      expect(box('d20 1 of 2')).not.toHaveAttribute('aria-invalid')
      // Not once Done finds it there.
      expect(box('d100')).toHaveAttribute('aria-invalid', 'true')
      expect(box('d100')).toHaveAccessibleDescription(
        'A d100 shows 1 to 100. Type 00 for 100.',
      )
      expect(
        screen.getAllByRole('alert').map(alert => alert.textContent),
      ).toEqual([
        'A d100 shows 1 to 100. Type 00 for 100.',
        'Type in every die first.',
      ])

      await user.keyboard('9')
      expect(box('d20 2 of 2')).not.toHaveAttribute('aria-invalid')
      await user.click(box('d100'))
      await user.keyboard('5')
      expect(box('d100')).toHaveValue('05')
      expect(screen.queryByRole('alert')).toBeNull()
      await user.click(key('Done'))
      expect(onDone).toHaveBeenCalledWith([[17, 9], [5]])
    })
  })

  describe('total', () => {
    it('counts nothing for a box empty or not a face, updating as typed', async () => {
      const user = userEvent.setup()
      const totals = jest.fn(plusFive)
      open(
        entry({
          terms: [
            { sides: 20, count: 1, label: 'd20' },
            { sides: 6, count: 2, label: '2d6' },
          ],
          total: totals,
        }),
      )

      expect(total()).toHaveTextContent('Total 5')
      expect(totals).toHaveBeenLastCalledWith([
        [undefined],
        [undefined, undefined],
      ])

      await user.keyboard('17')
      expect(total()).toHaveTextContent('Total 22')
      await user.keyboard('7')
      expect(totals).toHaveBeenLastCalledWith([[17], [undefined, undefined]])
      expect(total()).toHaveTextContent('Total 22')
      await user.keyboard('{Backspace}3')

      expect(totals).toHaveBeenLastCalledWith([[17], [3, undefined]])
      expect(total()).toHaveTextContent('Total 25')
      expect(total().tagName).toBe('OUTPUT')
      expect(total()).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('done and cancel', () => {
    it('gives every die typed, term by term, as numbers', async () => {
      const user = userEvent.setup()
      const { onDone } = open(
        entry({
          terms: [
            { sides: 20, count: 1, label: 'd20' },
            { sides: 4, count: 1, label: '+1d4' },
          ],
        }),
      )

      await user.click(key('1'))
      await user.click(key('7'))
      await user.click(key('3'))
      await user.click(key('Done'))

      expect(onDone).toHaveBeenCalledTimes(1)
      expect(onDone).toHaveBeenCalledWith([[17], [3]])
    })

    it('gives a d10’s 0 as 10', async () => {
      const user = userEvent.setup()
      const { onDone } = open(
        entry({ terms: [{ sides: 10, count: 2, label: '2d10' }] }),
      )

      await user.click(key('0'))
      expect(box('d10 2 of 2')).toHaveFocus()
      await user.click(key('1'))
      // Its second box is the last: no Next die, and Done takes what's there.
      expect(queryNext()).toBeNull()
      await user.click(key('Done'))

      expect(onDone).toHaveBeenCalledWith([[10, 1]])
    })

    it('cancels on Cancel, Close and Escape', async () => {
      const user = userEvent.setup()
      const { onCancel, onDone } = open()

      await user.click(key('Cancel'))
      expect(onCancel).toHaveBeenCalledTimes(1)
      await user.click(key('Close'))
      expect(onCancel).toHaveBeenCalledTimes(2)
      // The browser closes the dialog on Escape, firing close.
      fireEvent(screen.getByRole('dialog'), new Event('close'))
      expect(onCancel).toHaveBeenCalledTimes(3)
      expect(onDone).not.toHaveBeenCalled()
    })

    it('shows again for the next roll asked for, where the browser closed it itself on Escape', () => {
      const first = entry()
      const onCancel = jest.fn()
      const { rerender } = render(
        <DiceEntryDialog
          entry={first}
          onDone={jest.fn()}
          onCancel={onCancel}
        />,
      )
      const shown = screen.getByRole('dialog') as HTMLDialogElement
      expect(shown.open).toBe(true)

      act(() => shown.close())
      expect(onCancel).toHaveBeenCalledTimes(1)
      rerender(
        <DiceEntryDialog
          entry={entry({ title: 'Stealth check' })}
          onDone={jest.fn()}
          onCancel={onCancel}
        />,
      )

      const next = screen.getByRole('dialog', {
        name: 'Stealth check',
      }) as HTMLDialogElement
      expect(next.open).toBe(true)
    })

    it('says nothing when closed for having nothing to ask', () => {
      const onCancel = jest.fn()
      const { rerender } = render(
        <DiceEntryDialog
          entry={entry()}
          onDone={jest.fn()}
          onCancel={onCancel}
        />,
      )

      rerender(<DiceEntryDialog onDone={jest.fn()} onCancel={onCancel} />)

      expect(onCancel).not.toHaveBeenCalled()
    })

    it('counts down the time left to answer as a timer, and cancels once at none', () => {
      jest.useFakeTimers({ now: Date.parse('2026-10-20T12:00:00Z') })
      const { onCancel } = open(entry({ until: '2026-10-20T12:00:03Z' }))

      const timer = screen.getByRole('timer')
      expect(timer).toHaveTextContent('0:03 left to answer')
      expect(timer).not.toHaveAttribute('aria-live')
      act(() => jest.advanceTimersByTime(1000))
      expect(timer).toHaveTextContent('0:02 left to answer')
      expect(onCancel).not.toHaveBeenCalled()

      act(() => jest.advanceTimersByTime(2000))
      expect(onCancel).toHaveBeenCalledTimes(1)
      act(() => jest.advanceTimersByTime(5000))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('shows minutes too, as for dnd5e’s ten', () => {
      jest.useFakeTimers({ now: Date.parse('2026-10-20T12:00:00Z') })
      open(entry({ until: '2026-10-20T12:09:58Z' }))

      expect(screen.getByRole('timer')).toHaveTextContent('9:58 left to answer')
    })

    it('has no countdown with no time to answer by', () => {
      open()

      expect(screen.queryByRole('timer')).toBeNull()
    })

    it('cancels once when what it answers is answered elsewhere', () => {
      const controller = new AbortController()
      const { onCancel } = open(entry({ signal: controller.signal }))
      expect(onCancel).not.toHaveBeenCalled()

      act(() => controller.abort())
      act(() => controller.abort())

      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('cancels at once where it was answered elsewhere already', () => {
      const controller = new AbortController()
      controller.abort()

      const { onCancel } = open(entry({ signal: controller.signal }))

      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('many dice', () => {
    it('has 40 boxes in one term, each named', () => {
      open(entry({ terms: [{ sides: 6, count: 40, label: '40d6 Fire' }] }))

      const boxes = within(
        screen.getByRole('group', { name: '40d6 Fire' }),
      ).getAllByRole('textbox')
      expect(boxes).toHaveLength(40)
      expect(boxes.at(-1)).toHaveAccessibleName('d6 40 of 40')
    })

    it('has 20 terms, each a group named by its label', () => {
      open(
        entry({
          terms: Array.from({ length: 20 }, (_, at) => ({
            sides: 4,
            count: 1,
            label: `+1d4 (${at + 1})`,
          })),
        }),
      )

      expect(screen.getAllByRole('textbox')).toHaveLength(20)
      for (let at = 1; at <= 20; at += 1) {
        expect(
          within(screen.getByRole('group', { name: `+1d4 (${at})` })).getByRole(
            'textbox',
          ),
        ).toHaveAccessibleName('d4')
      }
    })
  })

  describe('Next die', () => {
    const TWO_D6 = entry({ terms: [{ sides: 6, count: 2, label: '2d6' }] })

    it('is there while an earlier box is current, gone at the last, and back on an earlier one', async () => {
      const user = userEvent.setup()
      open(TWO_D6)

      expectCurrent('d6 1 of 2')
      expect(queryNext()).toBeInTheDocument()
      await user.click(key('4'))
      expectCurrent('d6 2 of 2')
      expect(queryNext()).toBeNull()

      await user.click(box('d6 1 of 2'))
      expectCurrent('d6 1 of 2')
      expect(queryNext()).toBeInTheDocument()
    })

    it('is there at each box of advantage’s two d20s, and gone at Bless’s d4, the last', async () => {
      const user = userEvent.setup()
      open(ADVANTAGE_AND_BLESS)

      expect(queryNext()).toBeInTheDocument()
      await user.keyboard('17')
      expectCurrent('d20 2 of 2')
      expect(queryNext()).toBeInTheDocument()
      await user.keyboard('15')
      expectCurrent('d4')
      expect(queryNext()).toBeNull()
      // Back by keyboard, as a Shift+Tab would.
      act(() => box('d20 2 of 2').focus())
      expect(queryNext()).toBeInTheDocument()
    })

    it.each([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])(
      'gives the last box focus where it was pressed by keyboard, with %s, as it goes',
      async (_, press) => {
        const user = userEvent.setup()
        open(TWO_D6)
        await user.keyboard('2')
        await user.click(box('d6 1 of 2'))
        // Tabbed to by a keyboard or reached by a screen reader.
        act(() => key('Next die').focus())

        await user.keyboard(press)

        expect(queryNext()).toBeNull()
        expect(box('d6 2 of 2')).toHaveFocus()
        expect(document.activeElement).not.toBe(document.body)
        expectCurrent('d6 2 of 2')
        // What a keyboard types next goes into it.
        await user.keyboard('5')
        expect(box('d6 2 of 2')).toHaveValue('5')
        expect(box('d6 1 of 2')).toHaveValue('2')
      },
    )

    it('gives the last box focus where Next die had it as a key tapped completes the box before', async () => {
      const user = userEvent.setup()
      open(TWO_D6)
      act(() => key('Next die').focus())

      // A tap or a click leaves focus where it was, on Next die, which then goes.
      await user.click(key('4'))

      expect(box('d6 1 of 2')).toHaveValue('4')
      expect(queryNext()).toBeNull()
      expect(box('d6 2 of 2')).toHaveFocus()
      expect(document.activeElement).not.toBe(document.body)
    })

    it('leaves focus on Next die moving to a box before the last, where it stays', async () => {
      const user = userEvent.setup()
      open(entry({ terms: [{ sides: 6, count: 3, label: '3d6' }] }))
      act(() => key('Next die').focus())

      await user.keyboard('{Enter}')

      expectCurrent('d6 2 of 3')
      expect(key('Next die')).toHaveFocus()
    })

    it('leaves focus on any other key as the last box comes, as that key stays', async () => {
      const user = userEvent.setup()
      open(TWO_D6)
      act(() => key('4').focus())

      await user.keyboard('{Enter}')

      expect(box('d6 1 of 2')).toHaveValue('4')
      expectCurrent('d6 2 of 2')
      expect(queryNext()).toBeNull()
      expect(key('4')).toHaveFocus()
    })

    it('still focuses Done once the last box is whole, and Enter there still submits', async () => {
      const user = userEvent.setup()
      const { onDone } = open(TWO_D6)

      await user.keyboard('45')
      expect(key('Done')).toHaveFocus()
      expect(queryNext()).toBeNull()

      await user.click(box('d6 2 of 2'))
      await user.keyboard('{Enter}')
      expect(onDone).toHaveBeenCalledWith([[4, 5]])
    })

    it('comes back with Done finding an earlier box empty, which it makes current', async () => {
      const user = userEvent.setup()
      const { onDone } = open(TWO_D6)
      await user.click(box('d6 2 of 2'))
      await user.keyboard('3')
      expect(queryNext()).toBeNull()

      await user.click(key('Done'))

      expect(onDone).not.toHaveBeenCalled()
      expectCurrent('d6 1 of 2')
      expect(box('d6 1 of 2')).toHaveFocus()
      expect(queryNext()).toBeInTheDocument()
    })
  })

  describe('layout', () => {
    it('sits the dice beside a five-column keypad on a short screen', () => {
      onShortScreen()
      open(ADVANTAGE_AND_BLESS)

      expect(screen.getByRole('group', { name: 'Keypad' })).toHaveClass(
        'grid-cols-5',
      )
      expect(screen.getByRole('dialog').querySelector('form')).toHaveClass(
        'grid-cols-2',
      )
      expect(key('Done')).toHaveClass('h-9')
    })

    it('keeps the keypad and Done in view beside many dice on a short screen, as the dice scroll', () => {
      onShortScreen()
      open(CRITICAL_20D6)
      const form = screen.getByRole('dialog').querySelector('form')

      // The dice on the left, the keypad and Done on the right.
      expect(form?.children[0]).toContainElement(box('d6 40 of 40'))
      expect(form?.children[1]).toBe(keptInView())
      // Only as tall as itself, not stretched to the dice's height, so it has somewhere to stick.
      expect(form).toHaveClass('grid-cols-2', 'items-start')
      // Stuck at the scroller's top, over its padding: without the inset it scrolls away.
      expect(scroller()).toHaveClass('overflow-y-auto', 'p-5')
      expect(keptInView()).toHaveClass(
        'sticky',
        '-top-5',
        '-mt-5',
        'pt-5',
        'bg-card',
      )
    })

    it('widens Delete into Next die’s place at the last box on a short screen', async () => {
      const user = userEvent.setup()
      onShortScreen()
      open(entry({ terms: [{ sides: 6, count: 2, label: '2d6' }] }))
      expect(key('Delete').className).not.toMatch(/col-span-/)

      await user.click(key('4'))

      expect(keypad()).toHaveClass('grid-cols-5')
      expect(queryNext()).toBeNull()
      expect(key('Delete')).toHaveClass('col-span-4')
      expect(key('00').className).not.toMatch(/col-span-/)
    })

    it('has twelve keys of one column each at the last box in three columns, a row fewer', async () => {
      const user = userEvent.setup()
      open(entry({ terms: [{ sides: 6, count: 2, label: '2d6' }] }))

      await user.click(key('4'))

      expect(keypad()).toHaveClass('grid-cols-3')
      const keys = within(keypad()).getAllByRole('button')
      expect(keys).toHaveLength(12)
      for (const each of keys) expect(each.className).not.toMatch(/col-span-/)
      // Done where it was, in the row after the keypad.
      expect(keptInView().lastElementChild).toContainElement(key('Done'))
    })

    it('keeps the keypad and Done below the dice otherwise, three columns', () => {
      open(ADVANTAGE_AND_BLESS)

      expect(screen.getByRole('group', { name: 'Keypad' })).toHaveClass(
        'grid-cols-3',
      )
      expect(screen.getByRole('dialog').querySelector('form')).not.toHaveClass(
        'grid-cols-2',
      )
      // Stuck at the scroller's foot, over its padding: without the inset it scrolls away with
      // the dice, Done out of view below forty of them.
      expect(scroller()).toHaveClass('overflow-y-auto', 'p-5')
      expect(keptInView()).toHaveClass(
        'sticky',
        '-bottom-5',
        '-mx-5',
        '-mb-5',
        'px-5',
        'pb-5',
        'bg-card',
      )
      expect(keptInView()).not.toHaveClass('-top-5')
    })
  })

  describe('dice effects add, from module 0.42.0', () => {
    /**
     * A Dexterity save, Bless's d4 and Bane's after its d20, each counted with its sign, plus 5, as
     * the roller counts them.
     */
    const BLESSED = entry({
      title: 'Dexterity saving throw',
      terms: [
        { sides: 20, count: 1, label: 'd20' },
        {
          sides: 4,
          count: 1,
          label: 'Bless: +1d4',
          skippable: true,
          name: 'Bless',
        },
        {
          sides: 4,
          count: 1,
          label: 'Bane: −1d4',
          skippable: true,
          name: 'Bane',
        },
      ],
      total: values =>
        values.reduce(
          (sum, term, at) =>
            sum +
            (at === 2 ? -1 : 1) *
              term.reduce<number>((all, value) => all + (value ?? 0), 0),
          5,
        ),
      skippedWords: skipped =>
        skippedWords(skipped.map(at => [BLESS_DIE, BANE_DIE][at - 1])),
    })

    it('heads each by its name and die, in a group of its own, with Skip named for it', () => {
      open(BLESSED)

      const bless = group('Bless: +1d4')
      expect(within(bless).getByRole('textbox')).toHaveAccessibleName('d4')
      const skip = within(bless).getByRole('button', {
        name: 'Skip Bless’s d4',
      })
      expect(skip).toHaveTextContent(/^Skip$/)
      // Its name starts with what it shows, so it's found by the words a voice says (WCAG 2.5.3).
      expect(skip).toHaveAccessibleName(/^Skip\b/)
      expect(skip).toHaveAttribute('type', 'button')
      expect(skip).not.toHaveAttribute('aria-pressed')
      expect(
        within(group('Bane: −1d4')).getByRole('button', {
          name: 'Skip Bane’s d4',
        }),
      ).toBeInTheDocument()
      // The player's own dice have none.
      expect(within(group('d20')).queryByRole('button')).toBeNull()
    })

    it('names two of a die by how many', () => {
      open(
        entry({
          terms: [
            { sides: 20, count: 1, label: 'd20' },
            {
              sides: 4,
              count: 2,
              label: 'Bless: +2d4',
              skippable: true,
              name: 'Bless',
            },
          ],
        }),
      )

      expect(key('Skip Bless’s 2d4')).toBeInTheDocument()
      fireEvent.click(key('Skip Bless’s 2d4'))
      expect(group('Bless: +2d4')).toHaveTextContent(
        'The game rolls Bless’s 2d4.',
      )
      expect(key('Type it in, Bless’s 2d4')).toBeInTheDocument()
    })

    it('says the game rolls one skipped, in plain words in its group, its box gone, offering Type it in', async () => {
      const user = userEvent.setup()
      open(BLESSED)

      await user.click(key('Skip Bless’s d4'))

      const bless = group('Bless: +1d4')
      expect(within(bless).queryByRole('textbox')).toBeNull()
      const line = within(bless).getByText('The game rolls Bless’s d4.')
      expect(line).toHaveClass('text-text-secondary')
      const typeIn = within(bless).getByRole('button', {
        name: 'Type it in, Bless’s d4',
      })
      expect(typeIn).toHaveTextContent(/^Type it in$/)
      // Review fix (round 0.42.0): its name starts with what it shows, as Skip's does, so a voice
      // saying "Type it in" finds it (WCAG 2.5.3).
      expect(typeIn).toHaveAccessibleName(/^Type it in\b/)
      expect(typeIn).not.toHaveAttribute('aria-pressed')
      expect(within(bless).queryByRole('button', { name: /^Skip/ })).toBeNull()
      expect(screen.getAllByRole('textbox')).toHaveLength(2)
    })

    it('gives none for one skipped on Done, its box never asked for', async () => {
      const user = userEvent.setup()
      const { onDone } = open(BLESSED)

      await user.keyboard('17')
      await user.click(key('Skip Bless’s d4'))
      await user.click(baneBox())
      await user.keyboard('1')
      await user.click(key('Done'))

      expect(onDone).toHaveBeenCalledWith([[17], [], [1]])
    })

    it('asks only for the boxes shown, as Type in every die first says, and nothing once the rest are skipped', async () => {
      const user = userEvent.setup()
      const { onDone } = open(BLESSED)

      await user.keyboard('17')
      await user.click(key('Skip Bless’s d4'))
      await user.click(key('Done'))

      expect(onDone).not.toHaveBeenCalled()
      expect(baneBox()).toHaveFocus()
      expect(baneBox()).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Type in every die first.',
      )

      await user.click(key('Skip Bane’s d4'))
      expect(screen.queryByRole('alert')).toBeNull()
      await user.click(key('Done'))
      expect(onDone).toHaveBeenCalledWith([[17], [], []])
    })

    it('moves focus from Skip pressed by keyboard to the next box shown, or else Done', async () => {
      const user = userEvent.setup()
      open(BLESSED)

      act(() => key('Skip Bless’s d4').focus())
      await user.keyboard('{Enter}')
      expect(baneBox()).toHaveFocus()
      expect(baneBox()).toHaveAttribute('aria-current', 'true')

      act(() => key('Skip Bane’s d4').focus())
      await user.keyboard(' ')
      expect(key('Done')).toHaveFocus()
      expect(document.activeElement).not.toBe(document.body)
    })

    it('leaves focus where it was where Skip is pressed without taking it, and moves the keypad off a box gone', async () => {
      const user = userEvent.setup()
      open(BLESSED)
      expect(box('d20')).toHaveFocus()

      // As a tap on a phone, which leaves focus where it was.
      fireEvent.click(key('Skip Bane’s d4'))
      expect(box('d20')).toHaveFocus()
      expectCurrent('d20')

      // The keypad typing into Bless's box, which has focus: on to the box shown before it, Bane's
      // gone, and focus, which never falls to the page from a box that's gone, to Done.
      act(() => blessBox().focus())
      expect(blessBox()).toHaveAttribute('aria-current', 'true')
      fireEvent.click(key('Skip Bless’s d4'))
      expect(key('Done')).toHaveFocus()
      expectCurrent('d20')
      await user.click(key('4'))
      expect(box('d20')).toHaveValue('4')
    })

    it('brings one skipped back with Type it in, its box focused and current', async () => {
      const user = userEvent.setup()
      open(BLESSED)
      await user.click(key('Skip Bless’s d4'))

      act(() => key('Type it in, Bless’s d4').focus())
      await user.keyboard('{Enter}')

      expect(blessBox()).toHaveFocus()
      expect(blessBox()).toHaveAttribute('aria-current', 'true')
      expect(blessBox()).toHaveClass('ring-2')
      expect(baneBox()).not.toHaveAttribute('aria-current')
      expect(group('Bless: +1d4')).not.toHaveTextContent('The game rolls')
      expect(key('Skip Bless’s d4')).toBeInTheDocument()
      await user.keyboard('3')
      expect(blessBox()).toHaveValue('3')
    })

    it('makes its box current with Type it in tapped, focus left where it was', () => {
      open(BLESSED)
      fireEvent.click(key('Skip Bless’s d4'))
      expect(box('d20')).toHaveFocus()

      fireEvent.click(key('Type it in, Bless’s d4'))

      expect(box('d20')).toHaveFocus()
      expect(blessBox()).toHaveAttribute('aria-current', 'true')
    })

    it('moves Next die past one skipped, gone at the last box shown, where Enter is Done', async () => {
      const user = userEvent.setup()
      const { onDone } = open(BLESSED)

      await user.click(key('Skip Bless’s d4'))
      await user.click(box('d20'))
      await user.keyboard('1')
      await user.click(key('Next die'))
      expect(baneBox()).toHaveAttribute('aria-current', 'true')
      expect(box('d20')).not.toHaveAttribute('aria-current')
      expect(queryNext()).toBeNull()

      await user.click(baneBox())
      await user.keyboard('2')
      expect(key('Done')).toHaveFocus()
      await user.click(baneBox())
      await user.keyboard('{Enter}')
      expect(onDone).toHaveBeenCalledWith([[1], [], [2]])
    })

    it('has no Next die at Bless’s box with Bane’s skipped, the last shown', async () => {
      const user = userEvent.setup()
      open(BLESSED)

      await user.click(key('Skip Bane’s d4'))
      await user.click(blessBox())

      expect(queryNext()).toBeNull()
      await user.click(box('d20'))
      expect(queryNext()).toBeInTheDocument()
    })

    it('says in the total’s own words what a die skipped leaves out, only while one is', async () => {
      const user = userEvent.setup()
      open(BLESSED)

      expect(total()).toHaveTextContent(/^Total 5$/)
      await user.click(key('Skip Bless’s d4'))
      expect(total()).toHaveTextContent(/^Total 5, not counting Bless’s d4$/)
      await user.click(key('Skip Bane’s d4'))
      expect(total()).toHaveTextContent(
        /^Total 5, not counting 2 dice the game rolls$/,
      )
      await user.click(key('Type it in, Bless’s d4'))
      expect(total()).toHaveTextContent(/^Total 5, not counting Bane’s d4$/)
      await user.click(key('Type it in, Bane’s d4'))
      expect(total()).toHaveTextContent(/^Total 5$/)
      expect(total().tagName).toBe('OUTPUT')
      expect(total()).toHaveAttribute('aria-live', 'polite')
    })

    it('counts Bane’s die taken away, and none of one skipped', async () => {
      const user = userEvent.setup()
      const totals = jest.fn(BLESSED.total)
      open({ ...BLESSED, total: totals })

      await user.keyboard('17')
      await user.keyboard('3')
      await user.keyboard('1')
      expect(total()).toHaveTextContent(/^Total 24$/)

      await user.click(key('Skip Bless’s d4'))
      expect(totals).toHaveBeenLastCalledWith([[17], [], [1]])
      expect(total()).toHaveTextContent(/^Total 21, not counting Bless’s d4$/)
    })

    it('shows its note under the subtitle, and none without one', () => {
      const note =
        'Reroll at the table as your feature says, and type in the die you keep.'
      const { unmount } = open(
        entry({
          title: 'Greatsword damage',
          terms: [{ sides: 6, count: 2, label: '2d6r<=2 Slashing' }],
          note,
        }),
      )

      const dialog = screen.getByRole('dialog', { name: 'Greatsword damage' })
      expect(dialog).toHaveTextContent('Type in what your dice show')
      expect(within(dialog).getByText(note)).toHaveClass('text-text-secondary')
      unmount()

      open(BLESSED)
      expect(screen.queryByText(note)).toBeNull()
    })

    it('makes Skip and Type it in as tall as a fingertip on a phone, as Cancel from a tablet up, beside their heading until they wrap', () => {
      open(BLESSED)

      const skip = key('Skip Bless’s d4')
      expect(skip).toHaveClass('min-h-11', 'sm:min-h-9')
      expect(skip.parentElement).toHaveClass(
        'flex',
        'flex-wrap',
        'items-center',
        'justify-between',
        'gap-2',
      )
      expect(skip.parentElement).toContainElement(
        screen.getByRole('heading', { name: 'Bless: +1d4' }),
      )
      fireEvent.click(skip)
      expect(key('Type it in, Bless’s d4')).toHaveClass(
        'min-h-11',
        'sm:min-h-9',
      )
    })

    it('scrolls a Skip focused clear of the keypad kept over the dice', () => {
      open(BLESSED)
      jest
        .spyOn(keptInView(), 'getBoundingClientRect')
        .mockReturnValue({ top: 500 } as DOMRect)
      const skip = key('Skip Bane’s d4')
      jest
        .spyOn(skip, 'getBoundingClientRect')
        .mockReturnValue({ bottom: 530 } as DOMRect)

      act(() => skip.focus())

      expect(scroller().scrollTop).toBe(38)
    })
  })

  describe('Elven Accuracy’s third d20 on its own line, from 0.42.1', () => {
    /**
     * A rapier attack with advantage: its two d20s, then Elven Accuracy's third on a line of its
     * own, then Bless's d4, each of the last two skippable, as the roller asks where the attack
     * goes to the game.
     */
    const ELVEN = entry({
      title: 'Rapier attack',
      terms: [
        { sides: 20, count: 2, label: 'd20, advantage' },
        {
          sides: 20,
          count: 1,
          label: 'Elven Accuracy: third d20',
          skippable: true,
          name: 'Elven Accuracy',
        },
        {
          sides: 4,
          count: 1,
          label: 'Bless: +1d4',
          skippable: true,
          name: 'Bless',
        },
      ],
      skippedWords: skipped =>
        skippedWords(skipped.map(at => [ELVEN_DIE, BLESS_DIE][at - 1])),
    })

    it('heads the third d20 as a line of its own after the two, its box a d20, with Skip named for it', () => {
      open(ELVEN)

      const two = group('d20, advantage')
      expect(
        within(two)
          .getAllByRole('textbox')
          .map(each => each.getAttribute('aria-label')),
      ).toEqual(['d20 1 of 2', 'd20 2 of 2'])
      expect(within(two).queryByRole('button')).toBeNull()
      expect(within(elven()).getByRole('textbox')).toHaveAccessibleName('d20')
      // Its heading shows a d20, as the two's does.
      const icon = (name: string) =>
        screen.getByRole('heading', { name }).querySelector('svg')
      expect(icon('Elven Accuracy: third d20')).not.toBeNull()
      expect(icon('Elven Accuracy: third d20')?.getAttribute('viewBox')).toBe(
        icon('d20, advantage')?.getAttribute('viewBox'),
      )
      const skip = within(elven()).getByRole('button', {
        name: 'Skip Elven Accuracy’s d20',
      })
      expect(skip).toHaveTextContent(/^Skip$/)
      expect(skip).toHaveClass('min-h-11', 'sm:min-h-9')
      // The groups in turn, by their headings: the two, the third, then Bless's.
      expect(
        screen
          .getAllByRole('heading', { level: 3 })
          .map(each => each.textContent),
      ).toEqual(['d20, advantage', 'Elven Accuracy: third d20', 'Bless: +1d4'])
    })

    it('says the game rolls it once skipped, its Type it in described by that line, as every skipped die’s is', async () => {
      const user = userEvent.setup()
      open(ELVEN)

      await user.click(key('Skip Elven Accuracy’s d20'))

      expect(within(elven()).queryByRole('textbox')).toBeNull()
      const line = within(elven()).getByText(
        'The game rolls Elven Accuracy’s d20.',
      )
      expect(line).toHaveClass('text-text-secondary')
      const typeIn = within(elven()).getByRole('button', {
        name: 'Type it in, Elven Accuracy’s d20',
      })
      expect(typeIn).toHaveTextContent(/^Type it in$/)
      expect(typeIn).toHaveAccessibleDescription(
        'The game rolls Elven Accuracy’s d20.',
      )
      expect(typeIn).toHaveClass('min-h-11', 'sm:min-h-9')
      expect(total()).toHaveTextContent(
        /^Total 5, not counting Elven Accuracy’s d20$/,
      )

      await user.click(key('Skip Bless’s d4'))
      expect(key('Type it in, Bless’s d4')).toHaveAccessibleDescription(
        'The game rolls Bless’s d4.',
      )
      expect(total()).toHaveTextContent(
        /^Total 5, not counting 2 dice the game rolls$/,
      )

      // Typed in again by keyboard: its box back, focused and current.
      act(() => key('Type it in, Elven Accuracy’s d20').focus())
      await user.keyboard('{Enter}')
      const third = within(elven()).getByRole('textbox')
      expect(third).toHaveFocus()
      expect(third).toHaveAttribute('aria-current', 'true')
      expect(key('Skip Elven Accuracy’s d20')).toBeInTheDocument()
    })

    it('moves Next die from the second of the two to the third, and Skip by keyboard on to Bless’s', async () => {
      const user = userEvent.setup()
      open(ELVEN)

      await user.click(box('d20 2 of 2'))
      await user.click(key('Next die'))
      expectCurrent('d20')
      await user.keyboard('1')
      expectCurrent('d20')
      await user.keyboard('5')
      expectCurrent('d4')

      act(() => key('Skip Elven Accuracy’s d20').focus())
      await user.keyboard('{Enter}')
      expect(blessBox()).toHaveFocus()
      expectCurrent('d4')
    })

    it('gives none for it on Done once skipped, its box never asked for', async () => {
      const user = userEvent.setup()
      const { onDone } = open(ELVEN)

      await user.keyboard('17')
      await user.keyboard('15')
      await user.click(key('Skip Elven Accuracy’s d20'))
      await user.click(blessBox())
      await user.keyboard('3')
      await user.click(key('Done'))

      expect(onDone).toHaveBeenCalledWith([[17, 15], [], [3]])
    })
  })
})
