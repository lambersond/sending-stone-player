import clsx from 'clsx'
import { Crosshair, X } from 'lucide-react'
import type { TableTarget } from '@/types/table'

/**
 * Who a roll or card was aimed at, and what came of it for each, where players may know: whether
 * an attack hit them, whether they saved, and whether their own check succeeded. Hit, Failed and
 * Success, where it landed, in the accent's look; Miss, Saved and Failure, where it didn't, muted,
 * with a cross. Over more than one, how it went in all, as `summary` says. From module 0.54.0's
 * round, where `noTarget` and it was aimed at no one, as an attack made with no token, that it had
 * no target, in its own muted look.
 * @param noTarget - An attack's card, which says so where it has none.
 */
export function Targets({
  targets,
  summary,
  noTarget = false,
}: Readonly<{
  targets: TableTarget[]
  summary?: string
  noTarget?: boolean
}>) {
  if (targets.length === 0) {
    if (!noTarget) return
    return (
      <p className='flex items-center gap-2 text-sm text-text-secondary'>
        <Crosshair aria-hidden className='size-4 shrink-0' />
        No target
      </p>
    )
  }
  return (
    <>
      {summary && (
        <p className='text-xs font-semibold text-text-secondary'>{summary}</p>
      )}
      <p className='flex flex-wrap items-center gap-x-2 gap-y-1 text-sm'>
        <Crosshair
          aria-hidden
          className='size-4 shrink-0 text-text-secondary'
        />
        <span className='sr-only'>
          {targets.length === 1 ? 'Target: ' : 'Targets: '}
        </span>
        {targets.map((target, index) => (
          <span key={index} className='inline-flex items-center gap-1.5'>
            <span className='font-semibold'>{target.name}</span>
            {target.ac !== undefined && (
              <span className='text-xs text-text-secondary'>
                AC {target.ac}
              </span>
            )}
            {target.outcome && (
              <Pill landed={target.outcome === 'hit'}>
                {target.outcome === 'hit' ? 'Hit' : 'Miss'}
              </Pill>
            )}
            {target.save && (
              <Pill landed={target.save === 'failed'}>
                {target.save === 'failed' ? 'Failed' : 'Saved'}
              </Pill>
            )}
            {target.check && (
              <Pill landed={target.check === 'success'}>
                {target.check === 'success' ? 'Success' : 'Failure'}
              </Pill>
            )}
            {index < targets.length - 1 && (
              <span aria-hidden className='text-text-secondary'>
                ,
              </span>
            )}
          </span>
        ))}
      </p>
    </>
  )
}

/**
 * What came of a roll for a target: where it landed, as a hit or a failed save, in the accent's
 * look; where it didn't, muted, after a cross. Read after the name as ", Hit".
 */
function Pill({
  landed,
  children,
}: Readonly<{ landed: boolean; children: string }>) {
  return (
    <>
      <span className='sr-only'>, </span>
      <span
        className={clsx(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11px] font-bold uppercase',
          landed
            ? 'bg-primary/10 text-primary-text'
            : 'bg-text-secondary/10 text-text-secondary',
        )}
      >
        {!landed && <X aria-hidden className='size-3' />}
        {children}
      </span>
    </>
  )
}
