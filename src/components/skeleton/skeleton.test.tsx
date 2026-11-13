import { render } from '@testing-library/react'
import { Skeleton } from './skeleton'
import { SkeletonWords } from './skeleton-words'

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

  it('stands for words in a run of text, unseen in the room they take, a block under each line of them', () => {
    const { container } = render(
      <p>
        Known at once.{' '}
        <SkeletonWords className='rounded-md'>Read later.</SkeletonWords>
      </p>,
    )
    const words = container.querySelector('p > span')!

    expect(words).toHaveAttribute('aria-hidden', 'true')
    // Inline, the placeholder drawn under each line the words take, its corners on each.
    expect(words).not.toHaveClass('block')
    expect(words).toHaveClass(
      'box-decoration-clone',
      'bg-skeleton',
      'rounded-md',
    )
    expect(words.firstElementChild).toHaveClass('invisible')
    expect(words).toHaveTextContent(/^Read later\.$/)
  })

  it.each([
    ['a block', <Skeleton key='block' />],
    ['words', <SkeletonWords key='words'>Read later.</SkeletonWords>],
  ])(
    'shimmers only for someone who allows motion, and is the still placeholder for anyone else: %s',
    (_, skeleton) => {
      const { container } = render(skeleton)
      const classes = container
        .firstElementChild!.getAttribute('class')!
        .split(' ')

      // The sweep: the shine across the placeholder, twice its width, moved by the keyframes.
      expect(classes).toEqual(
        expect.arrayContaining([
          'motion-safe:animate-shimmer',
          'motion-safe:bg-linear-to-r',
          'motion-safe:via-skeleton-shine',
          'motion-safe:bg-size-[200%_100%]',
        ]),
      )
      // Under reduced motion none of it applies: no animation and no gradient, the placeholder
      // alone.
      const unguarded = classes.filter(
        name =>
          /(^|:)(animate-|bg-linear|from-|via-|to-|bg-size)/.test(name) &&
          !name.startsWith('motion-safe:'),
      )
      expect(unguarded).toEqual([])
    },
  )
})
