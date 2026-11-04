'use client'

import { EffectsContext } from './use-effect-choice'
import type { Effects } from './types'
import type { ReactNode } from 'react'

/** What the rows inside offer of the character's own effects. */
export function Effecting({
  value,
  children,
}: Readonly<{ value: Effects; children: ReactNode }>) {
  return <EffectsContext value={value}>{children}</EffectsContext>
}
