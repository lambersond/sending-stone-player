'use client'

import { Fragment } from 'react'
import { conditionNamed } from '../conditions/utils'
import { useDescriptionActions } from '../description-actions/use-description-actions'
import { ConditionTip } from '../description-link/condition-tip'
import { SheetHeading } from '../sheet-heading/sheet-heading'
import { useSheetId } from '@/features/sheet/hooks/use-sheet-ids'
import type { DescriptionActions } from '../description-actions/types'
import type { TableSheet } from '@/types/table'

/** dnd5e's id of the Condition Immunities trait. */
const CONDITION_IMMUNITIES = 'ci'

/**
 * The character's traits, each with its values, as dnd5e's sheet lists them. Under Condition
 * Immunities, each condition the app has rules for is the descriptions' condition button: a hover
 * or focus shows its rules, a tap or click opens the conditions panel at it, as the sheet's
 * descriptions' links do; any other value is its text alone.
 */
export function SheetTraits({
  traits,
}: Readonly<{ traits: TableSheet['traits'] }>) {
  const traitsId = useSheetId('traits-heading')
  const actions = useDescriptionActions()
  if (traits.length === 0) return
  return (
    <section aria-labelledby={traitsId} className='flex flex-col gap-2'>
      <SheetHeading id={traitsId}>Traits</SheetHeading>
      <dl className='grid gap-x-4 rounded-2xl border border-border bg-card p-1.5 @2xl:grid-cols-2'>
        {traits.map(trait => (
          <div
            key={trait.id}
            className='flex flex-col gap-0.5 rounded-xl px-2.5 py-2'
          >
            <dt className='text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
              {trait.label}
            </dt>
            <dd className='text-sm'>
              {trait.values.map((value, index) => (
                // A trait may list the same value twice, as typed in Foundry.
                <Fragment key={`${index}:${value}`}>
                  {index > 0 && ', '}
                  <TraitValue
                    value={value}
                    actions={
                      trait.id === CONDITION_IMMUNITIES ? actions : undefined
                    }
                  />
                </Fragment>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * A trait's value: a condition's button, where `actions` are given and it names one; else its
 * text.
 */
function TraitValue({
  value,
  actions,
}: Readonly<{ value: string; actions?: DescriptionActions }>) {
  const condition = actions && conditionNamed(value)
  if (!condition) return value
  return <ConditionTip id={condition.id} label={value} actions={actions} />
}
