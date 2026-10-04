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
    // eslint-disable-next-line unicorn/no-null -- as stored for a user with no image
    const { container } = render(<Avatar name=' alice' image={null} />)

    expect(container).toHaveTextContent('A')
    expect(container.querySelector('img')).toBeNull()
  })

  it('copes with a blank name', () => {
    const { container } = render(<Avatar name='' />)

    expect(container).toHaveTextContent('?')
  })
})
