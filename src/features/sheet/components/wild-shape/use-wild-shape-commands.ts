import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { agrees } from './utils'
import { WILD_SHAPE_SETTLE } from '@/constants/sending-stone'
import { useSettle } from '@/features/sheet/hooks/use-settle'
import { checkWildShape, canReturn } from '@/utils/wild-shape'
import type { Asked, Refusal, Sent } from './types'
import type {
  TableRollState,
  WildShapeInput,
  WildShapeLogged,
} from '@/types/roll'
import type { BeastEntry, KnownForm } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/** The one command of Wild Shape's waited for at a time, by this key. */
const COMMAND = 'wild-shape'

/**
 * Wild Shape's commands from here (module 0.40.0): a change into the checked form, a return and a
 * Beast learned, each sent and logged, or why the sheet or the view says the game would refuse it
 * now (`setRefusal`). One waits while it's on its way, and once made until the sheet says so, for
 * up to `WILD_SHAPE_SETTLE` from the send (`waiting`). Once one has settled, one made goes on as
 * `made` says; one not made says why, where it was asked. One not made can still be made: one the
 * game took too long over is followed, and made late once its Gamemaster answers. Why it wasn't
 * made then goes, and the sheet is waited for afresh, as for one made in time, before it's settled
 * as made.
 * @param made - What follows a command the game made, once the sheet says so.
 */
export function useWildShapeCommands({
  on,
  name,
  sheet,
  states,
  send,
  checked,
  setRefusal,
  made,
}: Readonly<{
  on: boolean
  name: string
  sheet: TableSheet
  states: ReadonlyMap<string, TableRollState>
  send: (
    input: Exclude<WildShapeInput, { op: 'forms' }>,
    logged: WildShapeLogged,
  ) => string
  checked?: string
  setRefusal: Dispatch<SetStateAction<Refusal | undefined>>
  made: (sent: Sent) => void
}>) {
  const block = sheet.wildShape
  const { form } = sheet
  // Sent, its way not yet heard of: as on its way, for as long as the sheet might take.
  const {
    sent: keep,
    last,
    waitingOf,
    settleNow,
    unsettle,
  } = useSettle<Sent>({
    states,
    settleMs: WILD_SHAPE_SETTLE,
    missing: 'waiting',
    agrees: useCallback((each: Sent) => agrees(each, sheet), [sheet]),
  })
  // By local id, whether each command the settle below has handled was made.
  const handled = useRef(new Map<string, boolean>())
  const sent = last(COMMAND)
  const waiting = sent && waitingOf(sent) ? sent.op : undefined

  const dispatch = (
    input: Exclude<WildShapeInput, { op: 'forms' }>,
    logged: WildShapeLogged,
    held: Asked,
  ) => {
    const id = send(input, logged)
    keep(COMMAND, { ...held, id })
    setRefusal(undefined)
  }
  /**
   * Why the sheet, or the view, says the game would refuse it now, in the app's order; none where
   * it wouldn't. Another of Wild Shape's commands still on its way is `moving`, as the app says it,
   * so that a Become or a Learn pressed meanwhile says why nothing was sent.
   */
  const refused = (input: Exclude<WildShapeInput, { op: 'forms' }>) =>
    (on ? checkWildShape(input, sheet) : 'unavailable') ??
    (waiting ? 'moving' : undefined)

  const change = () => {
    if (!checked || !block) return
    const input = { op: 'transform', form: checked } as const
    const why = refused(input)
    if (why) {
      setRefusal({ op: 'transform', key: why })
      return
    }
    const known = block.known.find(({ id }) => id === checked)
    dispatch(
      input,
      { op: 'transform', form: known?.name, character: name },
      { op: 'transform', form: checked },
    )
  }

  const revert = () => {
    if (waiting || !on || !form || !canReturn(sheet)) return
    dispatch(
      { op: 'revert' },
      {
        op: 'revert',
        form: form.name,
        character: name,
        temp: sheet.hp?.temp ?? 0,
      },
      { op: 'revert' },
    )
  }

  const learn = (chosen: BeastEntry, replace?: KnownForm) => {
    const input = {
      op: 'learn',
      uuid: chosen.uuid,
      replace: replace?.id ?? null,
    } as const
    const why = refused(input)
    if (why) {
      setRefusal({ op: 'learn', key: why })
      return
    }
    dispatch(
      input,
      {
        op: 'learn',
        form: chosen.name,
        ...(replace && { old: replace.name }),
        character: name,
      },
      { op: 'learn', uuid: input.uuid, replace: input.replace },
    )
  }

  useEffect(() => {
    if (!sent || waiting) return
    const state = states.get(sent.id)
    const done = state?.status === 'done'
    const was = handled.current.get(sent.id)
    if (was === true || (was === false && !done)) return
    if (was === false) {
      handled.current.delete(sent.id)
      setRefusal(held => (held?.op === sent.op ? undefined : held))
      unsettle(sent.id)
      return
    }
    handled.current.set(sent.id, done)
    if (!done) {
      setRefusal({ op: sent.op, key: state?.reason ?? state?.status ?? 'lost' })
      return
    }
    // Made and settled, so that a later sheet that no longer agrees, as one where the game has
    // already ended the form, never has it on its way again until its settle runs out.
    settleNow(sent.id)
    made(sent)
  })

  return { waiting, change, revert, learn }
}
