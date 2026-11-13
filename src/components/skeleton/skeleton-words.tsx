import clsx from 'clsx'
import { SHIMMER } from './constants'

/**
 * Words a page's skeleton stands for while it reads them (v0.48.0), in a run of text: unseen, so
 * that they take the room the page's will, and wrap where they will, with a block of the skeleton's
 * under each line they take (`SHIMMER`), shaped by the caller's classes, such as its corners.
 * Hidden from assistive technology, as the skeleton's status says it's loading.
 * @param children - Words as long as those it stands for.
 */
export function SkeletonWords({
  className,
  children,
}: Readonly<{ className?: string; children: string }>) {
  return (
    <span
      aria-hidden
      className={clsx('box-decoration-clone select-none', SHIMMER, className)}
    >
      <span className='invisible'>{children}</span>
    </span>
  )
}
