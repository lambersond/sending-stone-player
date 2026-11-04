'use client'

import { rulesOf } from '../conditions/utils'
import { ConditionTip } from './condition-tip'
import type { DescriptionActions } from '../description-actions/types'
import type { ConditionLink } from '@/types/sending-stone'

/**
 * A condition a description names, underlined with dots: a hover or focus shows its rules, a tap
 * or click opens the conditions panel at it. One the app has no rules for is only bold text.
 */
export function ConditionButton({
  link,
  label,
  actions,
}: Readonly<{
  link: ConditionLink
  label: string
  actions: DescriptionActions
}>) {
  if (!rulesOf(link.condition)) return <span className='ref'>{label}</span>
  return <ConditionTip id={link.condition} label={label} actions={actions} />
}
