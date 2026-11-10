import { render, screen } from '@testing-library/react'
import { TidyPane } from './tidy-pane'
import { tidyJournal } from '@/mocks/notes-server'
import type { NotesTidyView } from '@/types/notes'

const renderPane = (tidy: NotesTidyView, at = 0) =>
  render(
    <TidyPane
      entry={tidy.entries[at]}
      tidy={tidy}
      name='Thorin'
      contents={null}
      onPick={jest.fn()}
    />,
  )

describe('components/notes/tidy-pane', () => {
  it('says a Classic box is shown nowhere in Foundry under Tidy 14, and never where to change it', () => {
    renderPane(tidyJournal({ classicGone: true }), 1)

    expect(
      screen.getByText(
        'Tidy 5e Sheets no longer shows this: it was written on its Classic sheet, and is kept on Thorin.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Change it on/)).toBeNull()
  })

  it('says an entry’s secrets were left out, and dates none it never saw change', () => {
    const tidy = tidyJournal()
    tidy.entries[1] = { ...tidy.entries[1], secret: true }
    renderPane(tidy, 1)

    expect(
      screen.getByText(
        'Its secrets aren’t shown: no player owns Thorin in Foundry.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('From Tidy 5e Sheets in Foundry'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/First seen|Changed/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Next note' })).toBeDisabled()
  })
})
