import {
  onItsWayWords,
  outcomeOf,
  reasonOf,
  sentWords,
  toneOf,
} from '../../utils/tray-words'
import { AreaOutcomes } from './area-outcomes'
import { PartlyMade } from './partly-made'
import { StatusLine } from './status-line'
import { useCreature } from '@/hooks/use-creature'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords } from '@/utils/seat-words'
import type { LocalCheck, TableRollState } from '@/types/roll'

/**
 * Where a roll is on its way to the game, or what the game made of it: for a saving throw or check
 * against a DC a description names, whether it was made, by the game's total where it doesn't say.
 * One the app took with nothing to follow it by says only that it was sent.
 */
export function TableStatus({
  state,
  dc,
  verdict,
  made,
}: Readonly<{
  state: TableRollState
  dc?: number
  verdict?: LocalCheck['verdict']
  /**
   * What the game made of it, said in place of its total, as of a die thrown again, whose total is
   * its roll's (module 0.44.0).
   */
  made?: string
}>) {
  const role = useTableRole()
  const creature = useCreature()
  const outcome = outcomeOf(state, role, dc, verdict)
  const tone = toneOf(state)
  if (tone === 'pending') {
    return (
      <StatusLine tone='pending'>
        {onItsWayWords(state, role)}
        {/* Each is sent from this page once the one before is made: leaving it, none more is. */}
        {state.together && ' Keep this page open until they’re all sent.'}
      </StatusLine>
    )
  }
  if (state.unfollowed) {
    return <StatusLine tone='made'>{sentWords(role)}</StatusLine>
  }
  if (tone === 'made') {
    const total = (
      <span>
        At the table:{' '}
        <span className='font-semibold text-text-primary tabular-nums'>
          {state.total ?? '?'}
        </span>
        {outcome && (
          <span className='font-semibold text-text-primary'>
            {' · '}
            {outcome}
          </span>
        )}
      </span>
    )
    return state.visible ? (
      <>
        <StatusLine tone='made'>{made ?? total}</StatusLine>
        <AreaOutcomes state={state} />
      </>
    ) : (
      <StatusLine tone='made' hidden>
        {seatWords(role).hidden}
      </StatusLine>
    )
  }
  const reason = reasonOf(state, role, creature)
  return (
    <StatusLine tone='not'>
      {/* As one, so that why reads on from what was made, rather than beside it. */}
      <span>
        {state.together?.made ? (
          <PartlyMade state={state} together={state.together} role={role} />
        ) : (
          'Not made at the table'
        )}
        {reason ? `: ${reason}` : ''}
      </span>
    </StatusLine>
  )
}
