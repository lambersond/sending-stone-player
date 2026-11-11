import { useLayoutEffect, useRef } from 'react'
import { turnKey } from '@/features/table/utils/end-turn'
import type { PanelEnding } from '@/features/table/types'
import type { TableRollState } from '@/types/roll'
import type { TableCombat, TableCombatant } from '@/types/table'

/**
 * Focus on the turn panel. The button's End Turn made, or taken with no id to follow it by, and the
 * panel showing the turn moved on: focus on the button, or lost to the page, goes to the heading,
 * whoever acts now, never resting on an End Turn for the next turn. And the button gone from under
 * focus: to the heading where the panel stays, else, as the encounter ends and the panel goes with
 * it, to the page's own place for the turn, never the page's body.
 * @param current - Who acts now, as the panel shows the combat.
 * @param sent - The last End Turn sent, with its way.
 * @returns The heading and End Turn's button, and `handOn`, for when the button goes.
 */
export function useTurnFocus({
  combat,
  current,
  via,
  sent,
  focusTurn,
}: {
  combat: TableCombat
  current?: TableCombatant
  via?: PanelEnding['via']
  sent?: NonNullable<PanelEnding['ending']>['sent']
  focusTurn?: () => void
}) {
  const titled = useRef<HTMLHeadingElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const now =
    combat.underWay && current
      ? `${combat.id}:${combat.round}:${current.id}`
      : ''
  // The End Turn that moved the turn on, by its id; or, where the app took it with no id to follow
  // it by, by its way, which is that End Turn's own once done.
  const moved =
    via === 'button' &&
    sent?.way.status === 'done' &&
    now !== turnKey(sent.turn)
      ? (sent.way.requestId ?? sent.way)
      : undefined
  const handed = useRef<string | TableRollState>(undefined)
  useLayoutEffect(() => {
    if (moved === undefined || handed.current === moved) return
    handed.current = moved
    const active = document.activeElement
    if (!active || active === document.body || active === button.current) {
      titled.current?.focus({ preventScroll: true })
    }
  }, [moved])
  const handOn = () => {
    const heading = titled.current
    if (heading?.isConnected) heading.focus({ preventScroll: true })
    else focusTurn?.()
  }
  return { titled, button, handOn }
}
