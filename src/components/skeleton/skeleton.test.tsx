import { render } from '@testing-library/react'
import { Skeleton } from './skeleton'

describe('components/skeleton', () => {
  it('is a block hidden from assistive technology, shaped by its caller', () => {
    const { container } = render(<Skeleton className='h-4 w-36 rounded-md' />)
    const block = container.firstElementChild!

    expect(block).toHaveAttribute('aria-hidden', 'true')
    expect(block).toBeEmptyDOMElement()
    expect(block).toHaveClass(
      'block',
      'bg-skeleton',
      'h-4',
      'w-36',
      'rounded-md',
    )
  })

  it('shimmers only for someone who allows motion, and is the still placeholder for anyone else', () => {
    const { container } = render(<Skeleton />)
    const classes = container
      .firstElementChild!.getAttribute('class')!
      .split(' ')

    // The sweep: the shine across the placeholder, twice the block's width, moved by the keyframes.
    expect(classes).toEqual(
      expect.arrayContaining([
        'motion-safe:animate-shimmer',
        'motion-safe:bg-linear-to-r',
        'motion-safe:via-skeleton-shine',
        'motion-safe:bg-size-[200%_100%]',
      ]),
    )
    // Under reduced motion none of it applies: no animation and no gradient, the placeholder alone.
    const unguarded = classes.filter(
      name =>
        /(^|:)(animate-|bg-linear|from-|via-|to-|bg-size)/.test(name) &&
        !name.startsWith('motion-safe:'),
    )
    expect(unguarded).toEqual([])
  })
})
