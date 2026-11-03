import { BellRing } from 'lucide-react'
import { askedWords, toneOf } from '../../utils/tray-words'
import { StatusLine } from './status-line'
import { useCreature } from '@/hooks/use-creature'
import { useTableRole } from '@/hooks/use-table-api'
import type { LocalAsk, TableRollState } from '@/types/roll'

/**
 * The table asked for a saving throw or check a description calls for: on dnd5e's own card in the
 * game's chat, for the Gamemaster to roll for those it names; its way there, or why it wasn't
 * posted.
 */
export function AskResult({
  roll,
  state,
}: Readonly<{ roll: LocalAsk; state?: TableRollState }>) {
  return (
    <div className='flex items-center gap-3'>
      <span className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
        <BellRing aria-hidden className='size-6' />
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        <AskStatus state={state} />
      </div>
    </div>
  )
}

/** Where an ask is on its way to the game's chat, or why it isn't there. */
function AskStatus({ state }: Readonly<{ state?: TableRollState }>) {
  const role = useTableRole()
  const creature = useCreature()
  return (
    <StatusLine tone={toneOf(state)}>
      {askedWords(state, role, creature)}
    </StatusLine>
  )
}
