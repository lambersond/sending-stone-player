import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderChip, OrderMark, OrderProblem } from './order-state'
import type {
  NoteEntryView,
  NoteGroupView,
  NoteOrderState,
} from '@/types/notes'

const entry = (id: string, title: string): NoteEntryView => ({
  id,
  chapterId: 'chapterSession01',
  title,
  html: `<p>${title}</p>`,
  createdAt: '2026-10-20T10:00:00.000Z',
  author: { name: 'Vex' },
  modifiedAt: '2026-10-20T10:00:00.000Z',
  modifiedBy: 'Vex',
  modifiedIn: 'app',
  state: 'synced',
  canEdit: false,
  canDelete: false,
  stamp: 'n:1',
})

/** The chapter's notes as the seat sees them now, in Foundry's order. */
const ENTRIES = [
  entry('wolvesEntryVex01', 'Wolves'),
  entry('trollsEntryVex01', 'Trolls'),
  entry('caveEntryThorin1', 'The cave'),
]

type Props = Parameters<typeof OrderProblem>[0]

const renderProblem = (
  group: Partial<NoteGroupView> = {},
  fields: Partial<Props> = {},
) => {
  const onResolve = jest.fn()
  render(
    <OrderProblem
      group={{
        chapterId: 'chapterSession01',
        state: 'conflict',
        reason: 'changed',
        stamp: 'g:0123456789abcdef',
        // Hers: the cave first; one note since deleted in Foundry, which she doesn't see now.
        mine: {
          ids: [
            'caveEntryThorin1',
            'goneEntryThorin1',
            'wolvesEntryVex01',
            'trollsEntryVex01',
          ],
        },
        ...group,
      }}
      entries={ENTRIES}
      role='player'
      busy={false}
      onResolve={onResolve}
      {...fields}
    />,
  )
  return { onResolve }
}

/** The panel, by its state's words, and its buttons' names in order. */
const panel = (name: string) => screen.getByRole('group', { name })
const buttons = (name: string) =>
  within(panel(name))
    .getAllByRole('button')
    .map(button => button.textContent)

describe('components/notes/order-state', () => {
  describe('OrderChip', () => {
    it.each<[NoteOrderState, string]>([
      ['waiting', 'Order waiting for the game'],
      ['saving', 'Order saving to the game…'],
      ['conflict', 'Order changed in Foundry'],
      ['failed', 'Order not saved to the game'],
    ])('says %s in words beside its icon', (state, words) => {
      const { container } = render(<OrderChip state={state} />)
      expect(container).toHaveTextContent(words)
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden')
    })

    it('warns of an order the game didn’t take, and only of one', () => {
      const { container, rerender } = render(<OrderChip state='conflict' />)
      expect(container.firstChild).toHaveClass('text-warning')
      rerender(<OrderChip state='failed' />)
      expect(container.firstChild).toHaveClass('text-warning')
      rerender(<OrderChip state='waiting' />)
      expect(container.firstChild).not.toHaveClass('text-warning')
    })

    it('spins only where the reader hasn’t asked for less motion', () => {
      const { container } = render(<OrderChip state='saving' />)
      expect(container.querySelector('svg')).toHaveClass(
        'motion-safe:animate-spin',
      )
    })

    it('shows nothing for an order the same here and in Foundry', () => {
      const { container } = render(<OrderChip state='synced' />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('OrderMark', () => {
    it.each<[NoteOrderState, string]>([
      ['waiting', 'Order waiting for the game'],
      ['saving', 'Order saving to the game…'],
    ])(
      'marks an order %s by its icon, its words its title and read aloud',
      (state, words) => {
        const { container } = render(<OrderMark state={state} />)
        const mark = container.firstChild as HTMLElement
        expect(mark).toHaveAttribute('title', words)
        expect(within(mark).getByText(words)).toHaveClass('sr-only')
        expect(mark.querySelector('svg')).toHaveAttribute('aria-hidden')
      },
    )

    it('spins while the order is on its way', () => {
      const { container } = render(<OrderMark state='saving' />)
      expect(container.querySelector('svg')).toHaveClass(
        'motion-safe:animate-spin',
      )
    })

    it.each<NoteOrderState>(['synced', 'conflict', 'failed'])(
      'marks nothing for an order %s',
      state => {
        const { container } = render(<OrderMark state={state} />)
        expect(container).toBeEmptyDOMElement()
      },
    )
  })

  describe('OrderProblem', () => {
    it.each<NoteOrderState>(['synced', 'waiting', 'saving'])(
      'shows nothing for an order %s',
      state => {
        renderProblem({ state, reason: undefined, mine: undefined })
        expect(screen.queryByRole('group')).toBeNull()
      },
    )

    it('offers Foundry’s order or yours, where the same notes were reordered in Foundry too', async () => {
      const user = userEvent.setup()
      const { onResolve } = renderProblem()

      expect(panel('Order changed in Foundry')).toHaveTextContent(
        'Reordered in Foundry while your order waited. Foundry’s order is shown.',
      )
      expect(buttons('Order changed in Foundry')).toEqual([
        'Show yours',
        'Use yours',
        'Keep Foundry’s',
      ])

      await user.click(screen.getByRole('button', { name: 'Use yours' }))
      expect(onResolve).toHaveBeenLastCalledWith('mine')
      await user.click(screen.getByRole('button', { name: 'Keep Foundry’s' }))
      expect(onResolve).toHaveBeenLastCalledWith('theirs')
    })

    it('lists yours by title, in its order, leaving out a note you don’t see now', async () => {
      const user = userEvent.setup()
      renderProblem()
      const show = screen.getByRole('button', { name: 'Show yours' })
      expect(show).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('list')).toBeNull()

      await user.click(show)

      const hide = screen.getByRole('button', { name: 'Hide yours' })
      expect(hide).toHaveAttribute('aria-expanded', 'true')
      const list = screen.getByRole('list')
      expect(list.tagName).toBe('OL')
      expect(
        within(list)
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['The cave', 'Wolves', 'Trolls'])

      await user.click(hide)
      expect(screen.queryByRole('list')).toBeNull()
    })

    it('names another seat’s order to the Gamemaster, who chooses for it', async () => {
      const user = userEvent.setup()
      const { onResolve } = renderProblem(
        {
          mine: {
            ids: ['trollsEntryVex01', 'wolvesEntryVex01'],
            by: 'Vex',
          },
        },
        { role: 'gm' },
      )

      expect(panel('Order changed in Foundry')).toHaveTextContent(
        'Reordered in Foundry while Vex’s order waited. Foundry’s order is shown.',
      )
      expect(buttons('Order changed in Foundry')).toEqual([
        'Show theirs',
        'Use theirs',
        'Keep Foundry’s',
      ])
      await user.click(screen.getByRole('button', { name: 'Show theirs' }))
      expect(
        screen.getByRole('button', { name: 'Hide theirs' }),
      ).toBeInTheDocument()
      expect(
        within(screen.getByRole('list'))
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['Trolls', 'Wolves'])
      await user.click(screen.getByRole('button', { name: 'Use theirs' }))
      expect(onResolve).toHaveBeenLastCalledWith('mine')
    })

    it('says why the game refused it, and offers to send it again or drop it', async () => {
      const user = userEvent.setup()
      const { onResolve } = renderProblem({
        state: 'failed',
        reason: 'not-member',
        mine: { ids: ['caveEntryThorin1', 'wolvesEntryVex01'] },
      })

      expect(panel('Order not saved to the game')).toHaveTextContent(
        'Not saved to your Gamemaster’s game: the character can’t see this party in Foundry now.',
      )
      expect(buttons('Order not saved to the game')).toEqual([
        'Try again',
        'Discard yours',
      ])
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(onResolve).toHaveBeenLastCalledWith('mine')
      await user.click(screen.getByRole('button', { name: 'Discard yours' }))
      expect(onResolve).toHaveBeenLastCalledWith('theirs')
    })

    it('says the game went wrong where it gave no reason, to the Gamemaster, of another seat’s', () => {
      renderProblem(
        {
          state: 'failed',
          reason: undefined,
          mine: { ids: ['caveEntryThorin1'], by: 'Vex' },
        },
        { role: 'gm' },
      )

      expect(panel('Order not saved to the game')).toHaveTextContent(
        'Not saved to your game: something went wrong in your game.',
      )
      expect(buttons('Order not saved to the game')).toEqual([
        'Try again',
        'Discard theirs',
      ])
    })

    it('offers nothing to show where it isn’t given the order', () => {
      renderProblem({ mine: undefined })
      expect(buttons('Order changed in Foundry')).toEqual([
        'Use yours',
        'Keep Foundry’s',
      ])
    })

    it('has its buttons off while a choice is on its way', () => {
      renderProblem({}, { busy: true })
      for (const button of within(
        panel('Order changed in Foundry'),
      ).getAllByRole('button'))
        expect(button).toBeDisabled()
    })
  })
})
