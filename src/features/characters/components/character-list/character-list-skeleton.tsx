import clsx from 'clsx'
import {
  CHARACTER_AVATAR,
  CHARACTER_LIST,
  CHARACTER_ROW,
  CHARACTER_ROW_LINK,
} from './constants'
import { Skeleton } from '@/components/skeleton/skeleton'
import { SkeletonStatus } from '@/components/skeleton/skeleton-status'

/**
 * The player's characters while they're read (v0.48.0): one row, as most players have one
 * character, and a new player's "no characters yet" is about as tall; an avatar and its two lines,
 * in the list's own boxes, so that a change to the list's moves its skeleton too. A player with
 * more sees the rest of their rows, and what's below them, come with the list.
 */
export function CharacterListSkeleton() {
  return (
    <div className={CHARACTER_LIST}>
      <SkeletonStatus />
      <div className={CHARACTER_ROW}>
        <div className={CHARACTER_ROW_LINK}>
          <Skeleton className={clsx(CHARACTER_AVATAR, 'rounded-full')} />
          <div className='min-w-0 flex-1'>
            {/* Its name, then its campaign's line, each a line of its size. */}
            <div className='flex h-6 items-center'>
              <Skeleton className='h-4 w-36 max-w-full rounded-md' />
            </div>
            <div className='flex h-5 items-center'>
              <Skeleton className='h-3 w-52 max-w-full rounded-md' />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
