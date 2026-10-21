import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteChip, NoteProblem } from './note-problem'
import type { NoteState } from '@/types/notes'

type Props = Parameters<typeof NoteProblem>[0]

const renderProblem = (fields: Partial<Props> = {}) => {
  const onResolve = jest.fn()
  const onEdit = jest.fn()
  render(
    <NoteProblem
      state='conflict'
      modifiedBy='Vex'
      mine={{ title: 'Wolves, again', html: '<p>Four of them.</p>' }}
      role='player'
      tooLarge={false}
      onEdit={onEdit}
      editFor={{ note: 'wolvesEntryVex01' }}
      onResolve={onResolve}
      {...fields}
    />,
  )
  return { onResolve, onEdit }
}

/** The panel, by its state's words, and its buttons' names in order. */
const panel = (name: string) => screen.getByRole('group', { name })
const buttons = (name: string) =>
  within(panel(name))
    .getAllByRole('button')
    .map(button => button.textContent)

describe('components/notes/note-problem', () => {
  describe('NoteChip', () => {
    it.each<[NoteState, string]>([
      ['waiting', 'Waiting for the game'],
      ['saving', 'Saving to the game…'],
      ['deleting', 'Deleted here, waiting for the game'],
      ['conflict', 'Changed in Foundry'],
      ['gone', 'Deleted in Foundry'],
      ['failed', 'Not saved to the game'],
    ])('says %s in words beside its icon', (state, words) => {
      const { container } = render(<NoteChip state={state} />)
      expect(container).toHaveTextContent(words)
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden')
    })

    it('spins only where the reader hasn’t asked for less motion', () => {
      const { container } = render(<NoteChip state='saving' />)
      expect(container.querySelector('svg')).toHaveClass(
        'motion-safe:animate-spin',
      )
    })

    it('shows nothing for a note the same here and in Foundry', () => {
      const { container } = render(<NoteChip state='synced' />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  it('shows nothing for a note with no problem', () => {
    renderProblem({ state: 'waiting' })
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('offers Foundry’s version or yours, where a change met one made in Foundry', async () => {
    const user = userEvent.setup()
    const { onResolve } = renderProblem()

    const shown = panel('Changed in Foundry')
    expect(shown).toHaveTextContent(
      'Changed in Foundry by Vex while your edit waited. Foundry’s version is shown.',
    )
    expect(buttons('Changed in Foundry')).toEqual([
      'Show yours',
      'Use yours',
      'Keep Foundry’s',
    ])
    const show = within(shown).getByRole('button', { name: 'Show yours' })
    expect(show).toHaveAttribute('aria-expanded', 'false')
    expect(shown).not.toHaveTextContent('Four of them.')
    await user.click(show)
    expect(show).toHaveAttribute('aria-expanded', 'true')
    expect(shown).toHaveTextContent('Wolves, again')
    expect(shown).toHaveTextContent('Four of them.')
    await user.click(show)
    expect(shown).not.toHaveTextContent('Four of them.')

    await user.click(within(shown).getByRole('button', { name: 'Use yours' }))
    expect(onResolve).toHaveBeenLastCalledWith('mine')
    await user.click(
      within(shown).getByRole('button', { name: 'Keep Foundry’s' }),
    )
    expect(onResolve).toHaveBeenLastCalledWith('theirs')
  })

  it('says Foundry’s version can’t be shown where the journal is too large to send', () => {
    renderProblem({ tooLarge: true })
    expect(panel('Changed in Foundry')).toHaveTextContent(
      'Changed in Foundry while your edit waited. This journal is too large to show Foundry’s version here: open it in Foundry.',
    )
  })

  it('offers to delete it anyway, where a delete met a change made in Foundry', async () => {
    const user = userEvent.setup()
    const { onResolve } = renderProblem({
      mine: { title: 'Wolves', deleting: true },
    })
    expect(panel('Changed in Foundry')).toHaveTextContent(
      'Changed in Foundry by Vex, so it wasn’t deleted.',
    )
    expect(buttons('Changed in Foundry')).toEqual(['Delete anyway', 'Keep it'])
    await user.click(screen.getByRole('button', { name: 'Delete anyway' }))
    expect(onResolve).toHaveBeenLastCalledWith('mine')
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(onResolve).toHaveBeenLastCalledWith('theirs')
  })

  it('offers to add it again, where it was deleted in Foundry while an edit waited', async () => {
    const user = userEvent.setup()
    const { onResolve } = renderProblem({ state: 'gone' })
    expect(panel('Deleted in Foundry')).toHaveTextContent(
      'Deleted in Foundry while your edit waited.',
    )
    expect(buttons('Deleted in Foundry')).toEqual([
      'Add it again',
      'Discard yours',
    ])
    await user.click(screen.getByRole('button', { name: 'Add it again' }))
    expect(onResolve).toHaveBeenLastCalledWith('mine')
    await user.click(screen.getByRole('button', { name: 'Discard yours' }))
    expect(onResolve).toHaveBeenLastCalledWith('theirs')
  })

  it('says why the game refused it, and offers to try again, edit it or discard it', async () => {
    const user = userEvent.setup()
    const { onResolve, onEdit } = renderProblem({
      state: 'failed',
      reason: 'full',
    })
    expect(panel('Not saved to the game')).toHaveTextContent(
      'Not saved to your Gamemaster’s game: the journal is full.',
    )
    expect(buttons('Not saved to the game')).toEqual([
      'Try again',
      'Edit',
      'Discard yours',
    ])
    const edit = screen.getByRole('button', { name: 'Edit' })
    expect(edit).toHaveAttribute('data-note-opener', 'problem-edit')
    expect(edit).toHaveAttribute('data-note', 'wolvesEntryVex01')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onResolve).toHaveBeenLastCalledWith('mine')
    await user.click(edit)
    expect(onEdit).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Discard yours' }))
    expect(onResolve).toHaveBeenLastCalledWith('theirs')
  })

  it('offers no Edit where the seat may not make the change now', () => {
    renderProblem({ state: 'failed', reason: 'error', onEdit: undefined })
    expect(buttons('Not saved to the game')).toEqual([
      'Try again',
      'Discard yours',
    ])
    expect(panel('Not saved to the game')).toHaveTextContent(
      'Not saved to your Gamemaster’s game: something went wrong in your Gamemaster’s game.',
    )
  })

  it('offers to keep a note deleted here while the game is closed', async () => {
    const user = userEvent.setup()
    const { onResolve } = renderProblem({
      state: 'deleting',
      mine: undefined,
    })
    expect(panel('Deleted here, waiting for the game')).toHaveTextContent(
      'It’s deleted from Foundry when your Gamemaster’s game is next open.',
    )
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(onResolve).toHaveBeenLastCalledWith('theirs')
  })

  describe('another seat’s change, for the Gamemaster', () => {
    it('names whose it was, and offers theirs', () => {
      renderProblem({
        role: 'gm',
        mine: { title: 'Wolves, again', html: '<p>Four.</p>', by: 'Vex' },
      })
      expect(panel('Changed in Foundry')).toHaveTextContent(
        'Changed in Foundry by Vex while Vex’s edit waited. Foundry’s version is shown.',
      )
      expect(buttons('Changed in Foundry')).toEqual([
        'Show theirs',
        'Use theirs',
        'Keep Foundry’s',
      ])
    })

    it('names whose a refused change was, in the Gamemaster’s words', () => {
      renderProblem({
        role: 'gm',
        state: 'failed',
        reason: 'not-member',
        onEdit: undefined,
        mine: { title: 'Wolves', by: 'Vex' },
      })
      const shown = panel('Not saved to the game')
      expect(shown).toHaveTextContent('Vex’s change')
      expect(shown).toHaveTextContent(
        'Not saved to your game: the character can’t see this party in Foundry now.',
      )
      expect(buttons('Not saved to the game')).toEqual([
        'Try again',
        'Discard theirs',
      ])
    })

    it('names whose a change deleted in Foundry was', () => {
      renderProblem({
        role: 'gm',
        state: 'gone',
        mine: { title: 'Wolves', by: 'Vex' },
      })
      expect(panel('Deleted in Foundry')).toHaveTextContent(
        'Deleted in Foundry while Vex’s edit waited.',
      )
      expect(buttons('Deleted in Foundry')).toEqual([
        'Add it again',
        'Discard theirs',
      ])
    })
  })

  it('holds its choices while one is on its way', () => {
    renderProblem({ busy: true })
    expect(screen.getByRole('button', { name: 'Use yours' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Show yours' })).toBeEnabled()
  })
})
