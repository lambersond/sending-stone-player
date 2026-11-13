import clsx from 'clsx'

/**
 * One block of a page's skeleton while it reads its data (v0.48.0), shaped by the caller's
 * classes: its size and its corners, a line's, a circle's or a card's. In the theme's placeholder
 * colour, with globals.css's shimmer sweeping a lighter shine across it, only for someone who
 * doesn't ask for less motion: they see the placeholder, still. Hidden from assistive technology,
 * as the skeleton's status says it's loading.
 */
export function Skeleton({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      aria-hidden
      className={clsx(
        'block shrink-0 bg-skeleton',
        'motion-safe:animate-shimmer motion-safe:bg-linear-to-r motion-safe:from-skeleton motion-safe:from-35% motion-safe:via-skeleton-shine motion-safe:via-50% motion-safe:to-skeleton motion-safe:to-65% motion-safe:bg-size-[200%_100%]',
        className,
      )}
    />
  )
}
