import { render, screen } from '@testing-library/react'
import Loading from './loading'

describe('app/loading', () => {
  it('shows the loading stone while a page loads', () => {
    const { container } = render(<Loading />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(container.querySelectorAll('svg path')).toHaveLength(2)
  })
})
