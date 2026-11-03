import {
  createContext,
  use,
  useRef,
  useLayoutEffect,
  type RefObject,
} from 'react'
import { NO_EFFECTS } from './constants'
import type { Effects, EffectChoice } from './types'
import type { SheetEffect } from '@/types/sending-stone'

export const EffectsContext = createContext<Effects>(NO_EFFECTS)

/** Gives a row's own control focus, where focus was on that row or lost, and never elsewhere. */
function focusIfLost(target: HTMLElement | null | undefined): void {
  if (!target?.isConnected) return
  const active = document.activeElement
  const row = target.closest('li')
  if (!active || active === document.body || row?.contains(active)) {
    target.focus()
  }
}

/**
 * A row of one of the character's own effects, from module 0.39.0: what may be done to it, its
 * open state where the pane keeps it, and its row, which takes focus once a change chosen on it is
 * on the sheet, where focus was on the row or lost with the control pressed.
 * @param among - Where it's drawn, as an effect may be on the Effects tab and among the favorites
 *   at once, each row with its own open state.
 */
export function useEffectChoice(
  effect: SheetEffect,
  among: 'effects' | 'favorites' = 'effects',
): {
  choice?: EffectChoice
  character?: string
  open?: boolean
  setOpen?: (open: boolean) => void
  row: RefObject<HTMLElement | null>
} {
  const effects = use(EffectsContext)
  const key = `${among}:${effect.id}`
  const row = useRef<HTMLElement>(null)
  const given = effects.choiceFor(effect)
  const choice: EffectChoice | undefined = given && {
    ...given,
    choose: op => {
      const id = effects.send(effect, op)
      if (id === undefined) return
      // Where focus goes once the sheet agrees: this row, wherever it's drawn by then; or, once
      // it's deleted, the row beside it.
      const at = row.current?.closest('li')
      effects.focusing.current.set(key, {
        effect: effect.id,
        op,
        id,
        after:
          op === 'delete'
            ? [
                at?.nextElementSibling ?? undefined,
                at?.previousElementSibling ?? undefined,
                at?.closest('[role="tabpanel"]') ?? undefined,
              ]
            : [],
      })
    },
  }
  useLayoutEffect(() => {
    const focusing = effects.focusing.current
    const held = focusing.get(key)
    if (!held || effects.waitingOf(held.effect, held.id, held.op)) return
    focusing.delete(key)
    focusIfLost(row.current)
  })
  const open = effects.openAt(key)
  return {
    choice,
    character: effects.character,
    open,
    setOpen:
      open === undefined
        ? undefined
        : (next: boolean) => effects.setOpenAt(key, next),
    row,
  }
}
