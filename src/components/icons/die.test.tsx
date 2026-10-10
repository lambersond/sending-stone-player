import { render } from '@testing-library/react'
import { DieIcon, type DieSides } from './die'

describe('components/icons/die', () => {
  it.each<[DieSides, string]>([
    [4, '0 0 5120 5120'],
    [6, '0 0 100 100'],
    [8, '0 0 100 100'],
    [10, '0 0 100 100'],
    [12, '0 0 1200 1200'],
    [20, '0 0 100 100'],
  ])(
    'draws a d%i in its own box, in the colour of the text around it, only to look at',
    (sides, box) => {
      const { container } = render(
        <DieIcon sides={sides} className='size-5 text-primary' />,
      )

      const icon = container.querySelector('svg')
      expect(icon).toHaveAttribute('viewBox', box)
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveClass('size-5', 'text-primary')
      const paths = container.querySelectorAll('path')
      expect(paths).toHaveLength(1)
      expect(paths[0]).toHaveAttribute('fill', 'currentColor')
      expect(paths[0].getAttribute('d')).toMatch(/^[Mm][\d.]/)
    },
  )

  it('draws each size of die its own shape', () => {
    const shapes = ([4, 6, 8, 10, 12, 20] as const).map(sides =>
      render(<DieIcon sides={sides} />)
        .container.querySelector('path')
        ?.getAttribute('d'),
    )

    expect(new Set(shapes).size).toBe(6)
  })
})
