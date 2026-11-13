import { render, screen } from '@testing-library/react'
import { RUNE } from './constants'
import { LoadingStone } from './loading-stone'

/** The rune's parts as drawn, in the order they light. */
function runeParts(container: HTMLElement) {
  const svg = container.querySelector('svg')!
  return {
    svg,
    parts: [
      svg.querySelector('circle')!,
      ...svg.querySelectorAll<SVGPathElement>('path'),
    ],
  }
}

describe('components/loading-stone', () => {
  it('says it is loading, as a status, on the stone at the loading size', () => {
    const { container } = render(<LoadingStone />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    const stone = container.querySelector('img')!
    expect(stone).toHaveAttribute('src', '/brand/stone-icon-96.png')
    expect(stone).toHaveAttribute('alt', '')
  })

  it('draws the rune on the stone, hidden from assistive technology', () => {
    const { container } = render(<LoadingStone />)
    const { svg, parts } = runeParts(container)

    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('viewBox', '0 0 512 512')
    expect(parts).toHaveLength(3)
    const [dot, inner, outer] = parts
    expect(dot).toHaveAttribute('cx', String(RUNE.dot.cx))
    expect(dot).toHaveAttribute('cy', String(RUNE.dot.cy))
    expect(dot).toHaveAttribute('r', String(RUNE.dot.r))
    expect(inner).toHaveAttribute('d', RUNE.inner)
    expect(outer).toHaveAttribute('d', RUNE.outer)
  })

  it.each([
    ['dot', 0, 'animate-rune-dot'],
    ['inner arc', 1, 'animate-rune-inner'],
    ['outer arc', 2, 'animate-rune-outer'],
  ])(
    'lights the %s by its own keyframes, dark until then, and lit and still for reduced motion',
    (_, index, keyframes) => {
      const { container } = render(<LoadingStone />)
      const part = runeParts(container).parts[index]

      expect(part).toHaveClass(
        'opacity-0',
        `motion-safe:${keyframes}`,
        'motion-reduce:opacity-85',
      )
    },
  )
})
