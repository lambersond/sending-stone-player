import { CHARACTER_LIST } from './constants'
import { Skeleton } from '@/components/skeleton/skeleton'
import { SkeletonStatus } from '@/components/skeleton/skeleton-status'

/**
 * The player's characters while they're read (v0.48.0): two rows the shape of CharacterList's,
 * each an avatar and its two lines, at its rows' height, in its list's own box.
 */
export function CharacterListSkeleton() {
  return (
    <div className={CHARACTER_LIST}>
      <SkeletonStatus />
      <RowSkeleton />
      <RowSkeleton />
    </div>
  )
}

/** One character's row: its avatar, its name and its campaign's line. */
function RowSkeleton() {
  return (
    <div className='flex items-center gap-4 rounded-2xl border border-border bg-card p-4'>
      <Skeleton className='size-11 rounded-full' />
      <div className='min-w-0 flex-1'>
        <div className='flex h-6 items-center'>
          <Skeleton className='h-4 w-36 max-w-full rounded-md' />
        </div>
        <div className='flex h-5 items-center'>
          <Skeleton className='h-3 w-52 max-w-full rounded-md' />
        </div>
      </div>
    </div>
  )
}
