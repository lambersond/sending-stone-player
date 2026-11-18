import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipientChecks } from './recipient-checks'
import type { MoveEnd } from '@/features/transfers/types'

/** So many of the campaign's characters, named Character 1 and on. */
const characters = (count: number): MoveEnd[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `actor${index + 1}`,
    name: `Character ${index + 1}`,
  }))

/** The checks, holding those ticked as a dialog does, and saying them as they change. */
function Checks({
  ends,
  onTicked,
}: Readonly<{ ends: MoveEnd[]; onTicked: (ids: string[]) => void }>) {
  const [value, setValue] = useState<string[]>([])
  return (
    <RecipientChecks
      characters={ends}
      value={value}
      onChange={ids => {
        setValue(ids)
        onTicked(ids)
      }}
    />
  )
}

describe('features/transfers/recipient-checks', () => {
  it('ticks any of them, none at first, kept in the list’s order whatever order they’re ticked in, with Select all from two', async () => {
    const user = userEvent.setup()
    const onTicked = jest.fn()
    render(<Checks ends={characters(2)} onTicked={onTicked} />)

    const boxes = screen.getAllByRole('checkbox')
    expect(boxes.map(box => box.closest('label')?.textContent)).toEqual([
      'Select all',
      'Character 1',
      'Character 2',
    ])
    expect(boxes.every(box => !(box as HTMLInputElement).checked)).toBe(true)

    await user.click(screen.getByRole('checkbox', { name: 'Character 2' }))
    await user.click(screen.getByRole('checkbox', { name: 'Character 1' }))
    expect(onTicked).toHaveBeenLastCalledWith(['actor1', 'actor2'])
    await user.click(screen.getByRole('checkbox', { name: 'Character 2' }))
    expect(onTicked).toHaveBeenLastCalledWith(['actor1'])
  })

  it('ticks them all with Select all, ticked itself once they all are, and unticks them all with it', async () => {
    const user = userEvent.setup()
    const onTicked = jest.fn()
    render(<Checks ends={characters(20)} onTicked={onTicked} />)
    const all = screen.getByRole('checkbox', { name: 'Select all' })

    await user.click(all)
    expect(onTicked.mock.lastCall?.[0]).toHaveLength(20)
    expect(all).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Character 7' }))
    expect(all).not.toBeChecked()
    await user.click(all)
    await user.click(all)
    expect(onTicked).toHaveBeenLastCalledWith([])
  })

  it.each([
    ['more than one hand-out gives to', 21],
    ['only one to tick', 1],
  ])('has no Select all where there are %s', (_name, count) => {
    render(<Checks ends={characters(count)} onTicked={jest.fn()} />)
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
    expect(screen.getAllByRole('checkbox')).toHaveLength(count)
  })
})
