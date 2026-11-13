import { render, screen } from '@testing-library/react'
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
    // In the middle of the page's main part, which it fills, between the header and the footer.
    expect(screen.getByRole('status').parentElement).toHaveClass(
      'flex-1',
      'items-center',
      'justify-center',
    )
    const stone = container.querySelector('img')!
    expect(stone).toHaveAttribute('src', '/brand/stone-icon-96.png')
    expect(stone).toHaveAttribute('alt', '')
  })

  it('draws the rune where the approved design carves it on the stone, hidden from assistive technology', () => {
    const { container } = render(<LoadingStone />)
    const { svg, parts } = runeParts(container)

    // The design's own numbers, in the icon's 512 by 512 square, so the light stays on the carving.
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('viewBox', '0 0 512 512')
    expect(parts).toHaveLength(3)
    const [dot, inner, outer] = parts
    expect(dot).toHaveAttribute('cx', '228.2')
    expect(dot).toHaveAttribute('cy', '277.2')
    expect(dot).toHaveAttribute('r', '12')
    expect(inner).toHaveAttribute(
      'd',
      'M221.38 228.68 A49 49 0 0 1 276.93 282.32',
    )
    expect(outer).toHaveAttribute(
      'd',
      'M219.00 189.68 A88 88 0 0 1 314.86 292.48',
    )
  })

  it('paints the light as the design does: the dot filled and the arcs stroked, in the glow, screened onto the stone', () => {
    const { container } = render(<LoadingStone />)
    const { svg, parts } = runeParts(container)
    const [dot, inner, outer] = parts
    const arcs = inner.parentElement!

    // Its two glows are the design's 2px and 8px at 144px, scaled to the stone's 96px.
    expect(svg).toHaveClass(
      'mix-blend-screen',
      'drop-shadow-[0_0_1.33px_var(--color-rune-glow),0_0_5.33px_var(--color-rune-glow)]',
    )
    expect(dot).toHaveClass('fill-rune-glow')
    expect(dot).not.toHaveAttribute('stroke')
    expect(dot.getAttribute('class')).not.toMatch(/\bstroke-/)
    expect(arcs.tagName).toBe('g')
    expect(outer.parentElement).toBe(arcs)
    expect(arcs).toHaveAttribute('fill', 'none')
    expect(arcs).toHaveClass('stroke-rune-glow')
    expect(arcs).toHaveAttribute('stroke-width', '14')
    expect(arcs).toHaveAttribute('stroke-linecap', 'round')
    for (const arc of [inner, outer]) {
      expect(arc.getAttribute('class')).not.toMatch(/\b(fill|stroke)-/)
    }
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
