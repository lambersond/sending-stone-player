import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyJournal } from './empty-journal'

describe('components/notes/empty-journal', () => {
  it('says what a journal is for, and starts a note or a chapter where the seat may', async () => {
    const user = userEvent.setup()
    const onNewNote = jest.fn()
    const onNewChapter = jest.fn()
    render(
      <EmptyJournal canAdd onNewNote={onNewNote} onNewChapter={onNewChapter} />,
    )
    expect(screen.getByText('No notes yet')).toHaveClass(
      'text-lg',
      'font-semibold',
    )
    expect(
      screen.getByText(
        'Write down what happened, what you found and who you met.',
      ),
    ).toBeInTheDocument()
    const note = screen.getByRole('button', { name: 'New note' })
    const chapter = screen.getByRole('button', { name: 'New chapter' })
    expect(note).toHaveClass('bg-primary')
    expect(note).toHaveAttribute('data-note-opener', 'new')
    expect(chapter).toHaveClass('border')
    expect(chapter).toHaveAttribute('data-note-opener', 'new-chapter')
    await user.click(note)
    expect(onNewNote).toHaveBeenCalledTimes(1)
    await user.click(chapter)
    expect(onNewChapter).toHaveBeenCalledTimes(1)
  })

  it('offers neither where the journal takes no change', () => {
    render(
      <EmptyJournal
        canAdd={false}
        onNewNote={jest.fn()}
        onNewChapter={jest.fn()}
      />,
    )
    expect(screen.getByText('No notes yet')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
