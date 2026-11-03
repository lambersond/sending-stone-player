'use client'

import { CircleAlert } from 'lucide-react'
import { ConcentrationChip } from '../concentration/concentration-chip'
import { conditionDetail } from '../effects-tab/utils'
import { useImageFallback } from '@/hooks/use-image-fallback'
import type { TableSheet } from '@/types/table'

/**
 * The conditions on a character or creature, each a chip that opens its rules, or, for
 * Concentrating, ends what's concentrated on. Nothing where it has none.
 */
export function Conditions({
  conditions,
  onShowConditions,
}: Readonly<{
  conditions: TableSheet['conditions']
  onShowConditions?: (id: string) => void
}>) {
  if (conditions.length === 0) return
  return (
    <ul aria-label='Conditions' className='flex flex-wrap gap-1.5'>
      {conditions.map(condition => {
        const chip = (
          <>
            <StatusIcon src={condition.img} />
            {condition.name}
            {conditionDetail(condition) && (
              <span className='font-normal text-text-secondary'>
                {conditionDetail(condition)}
              </span>
            )}
          </>
        )
        const opener = (
          <button
            type='button'
            onClick={() => onShowConditions?.(condition.id)}
            className={CHIP}
          >
            {chip}
          </button>
        )
        return (
          <li key={condition.id}>
            {/* Concentrating has no rules here to open: it ends what's concentrated on. */}
            {condition.id === CONCENTRATING ? (
              <ConcentrationChip className={CHIP} fallback={opener}>
                {chip}
              </ConcentrationChip>
            ) : (
              opener
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** The look of a condition's chip in the header. */
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-border bg-page py-1 pr-2.5 pl-1 text-xs font-semibold transition-colors hover:border-primary hover:bg-primary/5'

/** dnd5e's status of a character concentrating, as the sheet's conditions name it. */
const CONCENTRATING = 'concentrating'

/**
 * A condition's icon. The game's status icons are white, made for its dark token controls, so they
 * sit on a dark disc.
 */
function StatusIcon({ src }: Readonly<{ src: string | null }>) {
  const { shown, ref, onError } = useImageFallback(src)
  if (!src || !shown) {
    return (
      <span
        aria-hidden
        className='flex size-5 items-center justify-center rounded-full bg-ruby/15 text-ruby'
      >
        <CircleAlert className='size-3.5' />
      </span>
    )
  }
  return (
    // An icon from the Gamemaster's game, which Next's image optimizer doesn't know.
    // eslint-disable-next-line @next/next/no-img-element -- the game's image, not Next's
    <img
      ref={ref}
      src={src}
      alt=''
      className='size-5 rounded-full bg-[#23232f] p-0.5'
      onError={onError}
    />
  )
}
