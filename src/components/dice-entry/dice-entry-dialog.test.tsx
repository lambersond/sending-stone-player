import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiceEntryDialog } from './dice-entry-dialog'
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
const total = () => screen.getByRole('status')

const ADVANTAGE_AND_BLESS = entry({
  terms: [
    { sides: 20, count: 2, label: 'd20, advantage' },
    { sides: 4, count: 1, label: '+1d4' },
  ],
})

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
      expect(box('d20 1 of 2')).toHaveAttribute('aria-current', 'true')
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
      expect(box('d6 2 of 2')).toHaveAttribute('aria-current', 'true')
      expect(box('d6 1 of 2')).not.toHaveAttribute('aria-current')
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
      open(entry({ terms: [{ sides: 6, count: 1, label: '1d6' }] }))

      await user.click(key('4'))

      expect(key('Done')).toHaveFocus()
      expect(box('d6')).toHaveAttribute('aria-current', 'true')
    })

    it('moves from the last box to Done with Next die', async () => {
      const user = userEvent.setup()
      open()

      await user.click(key('1'))
      await user.click(key('Next die'))

      expect(key('Done')).toHaveFocus()
      expect(box('d20')).toHaveValue('1')
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
      // The next box is current, focus left on the key.
      expect(box('d6 2 of 3')).toHaveAttribute('aria-current', 'true')
      expect(key('4')).toHaveFocus()

      act(() => key('2').focus())
      await user.keyboard(' ')
      expect(box('d6 2 of 3')).toHaveValue('2')
      expect(box('d6 3 of 3')).toHaveAttribute('aria-current', 'true')
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
      await user.click(key('Next die'))
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

  describe('layout', () => {
    it('sits the dice beside a five-column keypad on a short screen', () => {
      jest.spyOn(globalThis, 'matchMedia').mockImplementation(
        query =>
          ({
            matches: query === '(max-height: 30rem)',
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      )
      open(ADVANTAGE_AND_BLESS)

      expect(screen.getByRole('group', { name: 'Keypad' })).toHaveClass(
        'grid-cols-5',
      )
      expect(screen.getByRole('dialog').querySelector('form')).toHaveClass(
        'grid-cols-2',
      )
      expect(key('Done')).toHaveClass('h-9')
    })

    it('keeps the keypad and Done below the dice otherwise, three columns', () => {
      open(ADVANTAGE_AND_BLESS)

      expect(screen.getByRole('group', { name: 'Keypad' })).toHaveClass(
        'grid-cols-3',
      )
      expect(screen.getByRole('dialog').querySelector('form')).not.toHaveClass(
        'grid-cols-2',
      )
      expect(
        screen.getByRole('group', { name: 'Keypad' }).parentElement,
      ).toHaveClass('sticky', 'bg-card')
    })
  })
})
