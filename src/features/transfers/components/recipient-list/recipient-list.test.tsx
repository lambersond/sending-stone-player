import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipientList } from './recipient-list'
import type { MoveEnd, Several } from '@/features/transfers/types'

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

/** The list as a dialog holds it: those picked, said as they change. */
function Held({
  parties,
  characters,
  start = [],
  several,
  onPicked,
}: Readonly<{
  parties?: MoveEnd[]
  characters: MoveEnd[]
  start?: string[]
  several?: Several
  onPicked?: (ids: string[]) => void
}>) {
  const [value, setValue] = useState(start)
  return (
    <RecipientList
      parties={parties}
      characters={characters}
      value={value}
      onChange={ids => {
        setValue(ids)
        onPicked?.(ids)
      }}
      several={several}
    />
  )
}

/** So many of the campaign's characters, named Character 1 and on. */
const numbered = (count: number): MoveEnd[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `actor${index + 1}`,
    name: `Character ${index + 1}`,
  }))

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

  it('wraps a long name, whole, to be read before it’s chosen (item 17)', () => {
    const name = 'Seraphina Nightingale-Ashworth of the Ever-Burning Lighthouse'
    render(<Held characters={[{ id: 'actorSera0001', name }]} />)
    // Kept on one line, it held the move's fieldset, as wide as what's in it, past the dialog.
    expect(screen.getByText(name)).toHaveClass('wrap-anywhere')
    expect(screen.getByText(name)).not.toHaveClass('truncate')
  })

  it('leaves out a section with none in it', () => {
    render(<Held characters={[vex]} />)
    expect(screen.queryByRole('group', { name: 'Parties' })).toBeNull()
    expect(screen.queryByText('Parties')).toBeNull()
    expect(screen.getByRole('group', { name: 'Characters' })).toBeVisible()
  })

  it('chooses the one tapped, and the browser’s arrows move it', async () => {
    const user = userEvent.setup()
    render(
      <Held parties={[iron]} characters={[vex]} start={['groupIronCo01']} />,
    )
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
        start={['actorVex0001']}
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

// From module 0.49.0, on a character's Give of its coins: what's picked follows
// utils.test.ts's rules; these check that the list draws and wires them.
describe('components/transfers/recipient-list, several characters (module 0.49.0)', () => {
  it('ticks the characters, as native checkboxes, and chooses a party alone, as a radio', async () => {
    const user = userEvent.setup()
    const onPicked = jest.fn()
    render(
      <Held
        parties={[iron, order]}
        characters={[vex, ...more.slice(0, 2)]}
        start={['groupIronCo01']}
        several='characters'
        onPicked={onPicked}
      />,
    )
    const parties = screen.getByRole('group', { name: 'Parties' })
    const characters = screen.getByRole('group', { name: 'Characters' })
    expect(within(parties).getAllByRole('radio')).toHaveLength(2)
    expect(within(parties).queryAllByRole('checkbox')).toHaveLength(0)
    expect(
      within(characters)
        .getAllByRole('checkbox')
        .map(box => box.closest('label')?.textContent),
    ).toEqual(['Select all', 'Vex', 'Arwen', 'Bilbo'])
    expect(within(characters).queryAllByRole('radio')).toHaveLength(0)

    // A character ticked lets go of the party; the party chosen again unticks the characters.
    await user.click(screen.getByRole('checkbox', { name: 'Bilbo' }))
    await user.click(screen.getByRole('checkbox', { name: 'Vex' }))
    expect(onPicked).toHaveBeenLastCalledWith(['actorVex0001', 'actorBilbo'])
    expect(
      screen.getByRole('radio', { name: 'The Iron Company Primary' }),
    ).not.toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'The Silent Order' }))
    expect(onPicked).toHaveBeenLastCalledWith(['groupOrder01'])
    expect(screen.getByRole('checkbox', { name: 'Vex' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Bilbo' })).not.toBeChecked()
  })

  it('ticks them all with Select all, ticked itself once they all are, and none with it again', async () => {
    const user = userEvent.setup()
    const onPicked = jest.fn()
    render(
      <Held
        characters={numbered(20)}
        several='characters'
        onPicked={onPicked}
      />,
    )
    const all = screen.getByRole('checkbox', { name: 'Select all' })

    await user.click(all)
    expect(onPicked.mock.lastCall?.[0]).toHaveLength(20)
    expect(all).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Character 7' }))
    expect(all).not.toBeChecked()
    await user.click(all)
    await user.click(all)
    expect(onPicked).toHaveBeenLastCalledWith([])
  })

  it.each([
    ['more than one give goes to', 21],
    ['only one to tick', 1],
  ])('has no Select all where there are %s', (_name, count) => {
    render(<Held characters={numbered(count)} several='characters' />)
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
    expect(screen.getAllByRole('checkbox')).toHaveLength(count)
  })

  it('keeps those ticked while searching, and ticks those hidden too with Select all', async () => {
    const user = userEvent.setup()
    render(
      <Held
        parties={[iron]}
        characters={[vex, ...more]}
        several='characters'
      />,
    )
    await user.click(screen.getByRole('checkbox', { name: 'Durin' }))
    await user.type(screen.getByRole('searchbox'), 'vex')
    expect(
      screen
        .getAllByRole('checkbox')
        .map(box => box.closest('label')?.textContent),
    ).toEqual(['Select all', 'Vex', 'Durin'])

    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    // Every character, those the search hid too, which show once ticked.
    expect(
      screen
        .getAllByRole('checkbox')
        .filter(box => (box as HTMLInputElement).checked)
        .map(box => box.closest('label')?.textContent),
    ).toEqual(['Select all', 'Vex', 'Arwen', 'Bilbo', 'Celeborn', 'Durin'])
  })
})

describe('components/transfers/recipient-list, every party and character (module 0.51.0)', () => {
  it('ticks the parties and the characters alike, as native checkboxes, none of them a radio', async () => {
    const user = userEvent.setup()
    const onPicked = jest.fn()
    render(
      <Held
        parties={[iron, order]}
        characters={[vex, ...more.slice(0, 2)]}
        several='everyone'
        onPicked={onPicked}
      />,
    )
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(
      within(screen.getByRole('group', { name: 'Parties' }))
        .getAllByRole('checkbox')
        .map(box => box.closest('label')?.textContent),
    ).toEqual(['The Iron Company Primary', 'The Silent Order'])
    expect(
      within(screen.getByRole('group', { name: 'Characters' }))
        .getAllByRole('checkbox')
        .map(box => box.closest('label')?.textContent),
    ).toEqual(['Select all', 'Vex', 'Arwen', 'Bilbo'])

    // Ticked together, in the list's order, a tick never letting go of another.
    await user.click(screen.getByRole('checkbox', { name: 'Bilbo' }))
    await user.click(
      screen.getByRole('checkbox', { name: 'The Iron Company Primary' }),
    )
    await user.click(screen.getByRole('checkbox', { name: 'Vex' }))
    expect(onPicked).toHaveBeenLastCalledWith([
      'groupIronCo01',
      'actorVex0001',
      'actorBilbo',
    ])
    await user.click(
      screen.getByRole('checkbox', { name: 'The Iron Company Primary' }),
    )
    expect(onPicked).toHaveBeenLastCalledWith(['actorVex0001', 'actorBilbo'])
  })

  it('ticks every character with Select all, leaving a party ticked, and unticks only them again', async () => {
    const user = userEvent.setup()
    const onPicked = jest.fn()
    render(
      <Held
        parties={[iron]}
        characters={[vex, ...more.slice(0, 2)]}
        start={['groupIronCo01']}
        several='everyone'
        onPicked={onPicked}
      />,
    )
    const all = screen.getByRole('checkbox', { name: 'Select all' })
    await user.click(all)
    expect(onPicked).toHaveBeenLastCalledWith([
      'groupIronCo01',
      'actorVex0001',
      'actorArwen',
      'actorBilbo',
    ])
    expect(all).toBeChecked()
    await user.click(all)
    expect(onPicked).toHaveBeenLastCalledWith(['groupIronCo01'])
    // Select all is the characters' alone: the parties have none.
    expect(
      screen.getAllByRole('checkbox', { name: 'Select all' }),
    ).toHaveLength(1)
  })
})
