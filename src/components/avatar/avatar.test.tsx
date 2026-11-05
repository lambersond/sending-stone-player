import { render } from '@testing-library/react'
import { Avatar } from './avatar'

describe('components/avatar', () => {
  it('shows the image when there is one', () => {
    const { container } = render(
      <Avatar name='Alice' image='https://example.com/a.png' />,
    )

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/a.png',
    )
  })

  it('falls back to the first letter of the name', () => {
    const { container } = render(<Avatar name=' alice' image={null} />)

    expect(container).toHaveTextContent('A')
    expect(container.querySelector('img')).toBeNull()
  })

  it('keeps a first letter beyond one UTF-16 unit whole, as an emoji', () => {
    const { container } = render(<Avatar name='🐉 Ember' />)

    expect(container).toHaveTextContent('🐉')
  })

  it('copes with a blank name', () => {
    const { container } = render(<Avatar name='' />)

    expect(container).toHaveTextContent('?')
  })
})
