import { Sparkles } from 'lucide-react'
import { toneOf, usedWords } from '../../utils/tray-words'
import { DamageDue } from './damage-due'
import { StatusLine } from './status-line'
import { useCreature } from '@/hooks/use-creature'
import { useTableRole } from '@/hooks/use-table-api'
import type { RollDue } from '../../types'
import type { LocalUse, TableRollState } from '@/types/roll'

/**
 * A spell or feature used in the game: its way there, and once it's made, the damage or healing
 * that follows it, rolled at once, unless its kind is to be chosen first.
 */
export function UsedResult({
  roll,
  state,
  onRollDamage,
  modifies,
}: Readonly<{
  roll: LocalUse
  state?: TableRollState
  onRollDamage?: RollDue
  modifies?: boolean
}>) {
  const status = state && <UsedStatus roll={roll} state={state} />
  return (
    <div className='flex items-center gap-3'>
      <span className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
        <Sparkles aria-hidden className='size-6' />
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        {status}
        <DamageDue
          roll={roll}
          state={state}
          onRollDamage={onRollDamage}
          modifies={modifies}
        />
      </div>
    </div>
  )
}

/**
 * Where a use is on its way to the game, or what became of it: for an enchant activity, the
 * enchantment it applied, and on what, or the one it ended. Or where an enchantment ended is.
 */
function UsedStatus({
  roll,
  state,
}: Readonly<{ roll: LocalUse; state: TableRollState }>) {
  const role = useTableRole()
  const creature = useCreature()
  const tone = toneOf(state)
  const words = usedWords(roll, state, role, creature)
  return (
    <StatusLine tone={tone}>
      {tone === 'made' ? <span>{words}</span> : words}
    </StatusLine>
  )
}
