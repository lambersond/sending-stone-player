import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipientList } from './recipient-list'
import type { MoveEnd } from './move-dialog'

const iron: MoveEnd = {
  id: 'groupIronCo01',
  name: 'The Iron Company',
  primary: true,
}
const order: MoveEnd = { id: 'groupOrder01', name: 'The Silent Order' }
const vex: MoveEnd = {
  id: 'actorVex0001',
  name: 'Vex',
  portrait: 'https://foundry.example/vex.webp',
}
const more = ['Arwen', 'Bilbo', 'Celeborn', 'Durin'].map(name => ({
  id: `actor${name}`,
  name,
}))

/** The list as a dialog holds it: the one chosen. */
function Held({
  parties,
  characters,
  start,
}: Readonly<{ parties?: MoveEnd[]; characters: MoveEnd[]; start?: string }>) {
  const [value, setValue] = useState(start)
  return (
    <RecipientList
      parties={parties}
      characters={characters}
      value={value}
      onChange={setValue}
    />
  )
}

describe('components/transfers/recipient-list', () => {
  it('lists parties, then characters, each under its heading, as native radios of one name', () => {
    render(<Held parties={[iron, order]} characters={[vex]} />)
    const parties = screen.getByRole('group', { name: 'Parties' })
    const characters = screen.getByRole('group', { name: 'Characters' })
    expect(
      parties.compareDocumentPosition(characters) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      within(parties)
        .getAllByRole('radio')
        .map(radio => radio.getAttribute('value')),
    ).toEqual(['groupIronCo01', 'groupOrder01'])
    expect(
      within(characters).getByRole('radio', { name: 'Vex' }),
    ).toHaveAttribute('value', 'actorVex0001')

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    const [{ name }] = radios as HTMLInputElement[]
    expect(name).not.toBe('')
    for (const radio of radios as HTMLInputElement[]) {
      expect(radio.tagName).toBe('INPUT')
      expect(radio).toHaveAttribute('type', 'radio')
      expect(radio.name).toBe(name)
      expect(radio).not.toHaveAttribute('role')
    }
    expect(
      screen.getByRole('radio', { name: 'The Iron Company Primary' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'The Silent Order' }),
    ).toBeInTheDocument()
  })

  it('marks the primary party, and shows the portrait each has', () => {
    const { container } = render(<Held parties={[iron]} characters={[vex]} />)
    expect(screen.getByText('Primary')).toHaveClass(
      'text-xs',
      'text-text-secondary',
    )
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://foundry.example/vex.webp',
    )
  })

  it('leaves out a section with none in it', () => {
    render(<Held characters={[vex]} />)
    expect(screen.queryByRole('group', { name: 'Parties' })).toBeNull()
    expect(screen.queryByText('Parties')).toBeNull()
    expect(screen.getByRole('group', { name: 'Characters' })).toBeVisible()
  })

  it('chooses the one tapped, and the browser’s arrows move it', async () => {
    const user = userEvent.setup()
    render(<Held parties={[iron]} characters={[vex]} start='groupIronCo01' />)
    const party = screen.getByRole('radio', {
      name: 'The Iron Company Primary',
    })
    expect(party).toBeChecked()
    await user.click(screen.getByText('Vex'))
    expect(screen.getByRole('radio', { name: 'Vex' })).toBeChecked()
    expect(party).not.toBeChecked()
    // One group across both sections, as the browser moves through it.
    await user.keyboard('{ArrowUp}')
    expect(party).toBeChecked()
    expect(party).toHaveFocus()
  })

  it('has no search for five or fewer', () => {
    render(<Held parties={[iron]} characters={[vex, ...more.slice(0, 3)]} />)
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('searches both sections by name above five, keeping the one chosen', async () => {
    const user = userEvent.setup()
    render(
      <Held
        parties={[iron, order]}
        characters={[vex, ...more]}
        start='actorVex0001'
      />,
    )
    const search = screen.getByRole('searchbox', { name: 'Search by name' })
    expect(search).toHaveAttribute('placeholder', 'Search')

    await user.type(search, 'SILENT')
    expect(
      screen.getAllByRole('radio').map(radio => radio.getAttribute('value')),
    ).toEqual(['groupOrder01', 'actorVex0001'])
    // The one chosen stays, though it doesn't match.
    expect(screen.getByRole('radio', { name: 'Vex' })).toBeChecked()

    await user.clear(search)
    await user.type(search, 'bil')
    expect(
      screen.getAllByRole('radio').map(radio => radio.getAttribute('value')),
    ).toEqual(['actorVex0001', 'actorBilbo'])
    expect(screen.queryByRole('group', { name: 'Parties' })).toBeNull()

    await user.clear(search)
    await user.type(search, 'zzz')
    expect(screen.getByText('No one matches')).toBeVisible()
    expect(screen.getAllByRole('radio')).toHaveLength(1)
  })
})
