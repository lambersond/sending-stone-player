import { useLayoutEffect, useRef } from 'react'
import { act, render, screen } from '@testing-library/react'
import { useFocusHandedOn } from './use-focus-handed-on'

/** A row of a list whose button hands focus on as it goes; another of its own beside it. */
function Row({ name, on }: Readonly<{ name: string; on: boolean }>) {
  const button = useRef<HTMLButtonElement>(null)
  useFocusHandedOn(button, on)
  return (
    <li>
      <button ref={button} type='button'>
        {name}
      </button>
      <button type='button'>{name}’s uses</button>
    </li>
  )
}

/** Something drawn in the same commit as a row goes, which takes focus itself. */
function Taker() {
  const input = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => input.current?.focus(), [])
  return <input ref={input} aria-label='Taker' />
}

const List = ({
  names,
  on = true,
  taker = false,
}: Readonly<{ names: string[]; on?: boolean; taker?: boolean }>) => (
  <div role='tabpanel' tabIndex={-1}>
    <ul>
      {names.map(name => (
        <Row key={name} name={name} on={on} />
      ))}
    </ul>
    {taker && <Taker />}
  </div>
)

const button = (name: string) => screen.getByRole('button', { name })
/** Once the page has settled: the microtask the hook queues has run. */
const settled = () => act(async () => {})

describe('hooks/use-focus-handed-on', () => {
  it('hands focus to the next row as the row with it goes', async () => {
    const { rerender } = render(<List names={['Rope', 'Ring', 'Cloak']} />)
    button('Ring').focus()

    rerender(<List names={['Rope', 'Cloak']} />)
    await settled()

    expect(button('Cloak')).toHaveFocus()
  })

  it('hands focus to the next row as the row goes with focus elsewhere in it', async () => {
    const { rerender } = render(<List names={['Rope', 'Ring', 'Cloak']} />)
    button('Ring’s uses').focus()

    rerender(<List names={['Rope', 'Cloak']} />)
    await settled()

    expect(button('Cloak')).toHaveFocus()
  })

  it('moves nothing as a row goes without focus in it', async () => {
    const { rerender } = render(<List names={['Rope', 'Ring', 'Cloak']} />)
    button('Rope').focus()

    rerender(<List names={['Rope', 'Cloak']} />)
    await settled()

    expect(button('Rope')).toHaveFocus()
  })

  it('leaves focus where something else took it as the row went', async () => {
    const { rerender } = render(<List names={['Rope', 'Ring', 'Cloak']} />)
    button('Ring').focus()

    rerender(<List names={['Rope', 'Cloak']} taker />)
    await settled()

    expect(screen.getByRole('textbox', { name: 'Taker' })).toHaveFocus()
  })

  it('hands nothing on where it is off, as a row with no move', async () => {
    const { rerender } = render(
      <List names={['Rope', 'Ring', 'Cloak']} on={false} />,
    )
    button('Ring').focus()

    rerender(<List names={['Rope', 'Cloak']} on={false} />)
    await settled()

    expect(document.body).toHaveFocus()
  })
})
