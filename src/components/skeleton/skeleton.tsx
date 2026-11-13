import clsx from 'clsx'
import { SHIMMER } from './constants'

/**
 * One block of a page's skeleton while it reads its data (v0.48.0), shaped by the caller's
 * classes: its size and its corners, a line's, a circle's or a card's. In the theme's placeholder
 * colour, shimmering for someone who allows motion (`SHIMMER`). Hidden from assistive technology,
 * as the skeleton's status says it's loading.
 */
export function Skeleton({ className }: Readonly<{ className?: string }>) {
  return (
    <span aria-hidden className={clsx('block shrink-0', SHIMMER, className)} />
  )
}
