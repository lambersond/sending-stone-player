'use client'

import { useState } from 'react'
import {
  FloatingPortal,
  safePolygon,
  useDismiss,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { rulesOf } from '../conditions/utils'
import { usePopover } from '@/hooks/use-popover'
import type { DescriptionActions } from '../description-actions/types'

/**
 * A condition's button and the tooltip with its rules, which Escape closes, and only it, inside a
 * dialog too.
 */
export function ConditionTip({
  id,
  label,
  actions,
}: Readonly<{ id: string; label: string; actions: DescriptionActions }>) {
  const [open, setOpen] = useState(false)
  const { setReference, setFloating, floatingStyles, context, root } =
    usePopover({ open, onOpenChange: setOpen, placement: 'top', gap: 6 })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, {
      mouseOnly: true,
      delay: { open: 250 },
      handleClose: safePolygon(),
    }),
    // A tap that focuses it opens the panel, with no tooltip on the way.
    useFocus(context, { visibleOnly: true }),
    useRole(context, { role: 'tooltip' }),
    useDismiss(context),
  ])
  const rules = rulesOf(id)
  const yours = actions.conditions.find(condition => condition.id === id)
  return (
    <>
      <button
        ref={setReference}
        type='button'
        aria-haspopup='dialog'
        className='font-semibold underline decoration-dotted underline-offset-2 transition-colors hover:text-primary'
        {...getReferenceProps({
          onClick: () => {
            setOpen(false)
            actions.showConditions(id)
          },
        })}
      >
        {label}
      </button>
      {open && rules && (
        <FloatingPortal root={root}>
          <div
            ref={setFloating}
            style={floatingStyles}
            className='z-50 flex max-w-xs flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-xs font-normal whitespace-normal text-text-primary shadow-xl'
            {...getFloatingProps()}
          >
            <p className='flex flex-wrap items-baseline gap-x-2 text-sm font-semibold'>
              {rules.name}
              {actions.rules === 'legacy' && (
                <span className='text-xs font-normal text-text-secondary'>
                  (2024 rules)
                </span>
              )}
              {yours && (
                <span className='text-xs font-semibold text-ruby'>
                  {yours.level === null
                    ? 'You have it'
                    : `You're at level ${yours.level}`}
                </span>
              )}
            </p>
            {rules.rules.map(rule => (
              <p key={rule.title}>
                <strong>{rule.title}.</strong> {rule.text}
              </p>
            ))}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
