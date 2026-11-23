'use client'

import { Go } from './go'
import { summonLine } from './utils'
import { useTableRole } from '@/hooks/use-table-api'

/**
 * A summoning's button, from module 0.54.0, under the line saying who places what it summons in
 * Foundry from the card, as the seat reads it; not to be pressed with no creature to summon.
 */
export function SummonGo({
  verb,
  ready,
  onGo,
}: Readonly<{ verb: string; ready: boolean; onGo: () => void }>) {
  const line = summonLine(useTableRole())
  return (
    <div>
      <p className='text-sm text-text-secondary'>{line}</p>
      <Go label={verb} disabled={!ready} onGo={onGo} />
    </div>
  )
}
