import { useState, useMemo } from 'react'
import { NO_GM_ROLLS } from '@/features/rolling/constants'
import { gmRollsOf, heardOf } from '@/features/rolling/utils/gm-rolls'
import type { GmRolls } from '@/features/rolling/types'
import type { GmRollView } from '@/types/roll'
import type { TableCombat } from '@/types/table'

/**
 * The rolls the campaign's Gamemaster made as the player's character (#156), as `gmRollsOf` has
 * them, each placed among the player's own by when this page first heard of it, by this device's
 * clock, as theirs are: never by when the server says it was sent, as this device's clock may be
 * behind the server's or ahead of it. So one heard of after the player rolled is newer than their
 * roll, and one heard of before it older. Those the page opens with are heard of as it opens, in
 * the order the view has them, as are those one look at the table brings. An area attack's targets
 * are named as the player's view of the combat names them now.
 */
export function useGmRolls(
  views: readonly GmRollView[] = NO_GM_ROLLS,
  combat?: TableCombat,
): GmRolls {
  const [heard, setHeard] = useState(() => heardOf(new Map(), views))
  let known = heard
  // Those the view brings, heard of now: the page renders again at once with them.
  if (views.some(({ id }) => !heard.has(id))) {
    known = heardOf(heard, views)
    setHeard(known)
  }
  return useMemo(() => gmRollsOf(views, known, combat), [views, known, combat])
}
