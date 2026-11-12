import { gmShape } from '../../utils/gm-words'
import { againWords, enchantmentNote, savedHere } from '../../utils/tray-words'
import { dcOf, madeWord } from './utils'
import { onItsWay } from '@/utils/lifecycle'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * A roll's way to the game, in brief, among the earlier rolls: for a saving throw or check against
 * a DC a description names that the game didn't make, whether this roll made it, as when it was
 * the latest; for one the app took with nothing to follow it by, that it was sent; and of hit dice
 * that stopped part way, how many were made, or sent, where any couldn't be followed.
 */
export function TableMark({
  state,
  roll,
}: Readonly<{ state?: TableRollState; roll: LocalRoll }>) {
  const here = roll.kind === 'check' ? savedHere(roll, state) : undefined
  const mine = here && (
    <span className='ml-1.5'>
      · DC {dcOf(roll)}, {here.toLowerCase()}
    </span>
  )
  if (!state) return mine
  // The Gamemaster's as the character (#156) are told as the player's own of their kind.
  const kind = roll.kind === 'gm' ? gmShape(roll) : roll.kind
  if (state.unfollowed) return <span className='ml-1.5'>· sent</span>
  if (state.status === 'done') {
    return <MadeMark roll={roll} kind={kind} state={state} />
  }
  if (onItsWay(state)) {
    return <span className='ml-1.5'>· sending</span>
  }
  // Of dice sent one after another, those the game made before one it didn't; or those sent, where
  // any of them couldn't be followed.
  const made = state.together?.made
  if (made) {
    return (
      <span className='ml-1.5'>
        · {made} of {state.together?.count}{' '}
        {state.together?.unfollowed ? 'sent' : 'at the table'}
      </span>
    )
  }
  return (
    <>
      {mine}
      <span className='ml-1.5'>
        {kind === 'ask' ? '· not posted' : '· not at the table'}
      </span>
    </>
  )
}

/**
 * A roll's mark once the game made it: an ask posted; a use at the table, or the enchantment it
 * applied; a die thrown again (module 0.44.0), what became of it in its roll (`againWords`), whose
 * own line has the game's total; else the game's total, or that it's hidden, and what came of it
 * (`madeWord`).
 */
function MadeMark({
  roll,
  kind,
  state,
}: Readonly<{
  roll: LocalRoll
  kind: LocalRoll['kind'] | ReturnType<typeof gmShape>
  state: TableRollState
}>) {
  if (kind === 'ask') return <span className='ml-1.5'>· posted</span>
  if (kind === 'use') {
    return (
      <span className='ml-1.5'>
        {enchantmentNote(state.enchantment) ?? '· at the table'}
      </span>
    )
  }
  const again = againWords(roll)
  if (again) {
    return (
      <span className='ml-1.5'>
        {state.visible ? `· ${again.after}` : '· hidden'}
      </span>
    )
  }
  const word = madeWord(roll, state)
  return (
    <span className='ml-1.5'>
      {state.visible ? `· table ${state.total ?? '?'}` : '· hidden'}
      {word !== undefined && `, ${word.toLowerCase()}`}
    </span>
  )
}
