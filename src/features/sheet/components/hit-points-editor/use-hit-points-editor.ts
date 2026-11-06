import { useState, type FormEvent } from 'react'
import {
  clampDraft,
  editorLine,
  hitPointsEdit,
  mostOf,
  movedFrom,
} from './utils'
import type { HitPointsKey, HitPointsPair } from './types'
import type { HitPointsInput } from '@/types/roll'
import type { HitPointsNow } from '@/types/sending-stone'

/** Each field's text, at the sheet's numbers. */
const textOf = (hp: HitPointsNow): HitPointsPair<string> => ({
  value: String(hp.value),
  temp: String(hp.temp),
})

/**
 * The hit points editor's two fields as the player changes them (module 0.44.0): each typed in,
 * digits alone, or stepped by one, kept within 0 and its most; the numbers they come to, the
 * change they make from the sheet's, and the live line that says it. Should the game's numbers
 * change while it's open, both fields reset to them, and the line says so (`rebased`), so that
 * nothing is saved from numbers no longer the game's. `submit` saves the change, once there is
 * one.
 */
export function useHitPointsEditor({
  hp,
  onSave,
}: {
  hp: HitPointsNow
  onSave: (change: HitPointsInput) => void
}) {
  // The numbers it was opened at, or last reset to, which the change is made from.
  const [base, setBase] = useState(hp)
  const [draft, setDraft] = useState(() => textOf(hp))
  const [rebased, setRebased] = useState(false)
  if (movedFrom(hp, base)) {
    setBase(hp)
    setDraft(textOf(hp))
    setRebased(true)
  }
  const most: HitPointsPair<number> = {
    value: mostOf('value', base),
    temp: mostOf('temp', base),
  }
  const wanted: HitPointsPair<number> = {
    value: clampDraft(draft.value, base.value, most.value),
    temp: clampDraft(draft.temp, base.temp, most.temp),
  }
  const change = hitPointsEdit(base, wanted)
  const set = (key: HitPointsKey, text: string) =>
    setDraft(fields => ({ ...fields, [key]: text }))
  // One more or fewer; its buttons stay where it can't go further, so that focus isn't lost.
  const step = (key: HitPointsKey, by: number) => {
    const next = wanted[key] + by
    if (next < 0 || next > most[key]) return
    set(key, String(next))
  }
  const type = (key: HitPointsKey, text: string) =>
    set(key, text.replaceAll(/\D/g, ''))
  // What's typed, shown as the number it comes to, as on leaving the field.
  const settle = (key: HitPointsKey) => set(key, String(wanted[key]))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (change) onSave(change)
  }
  return {
    draft,
    wanted,
    most,
    change,
    line: editorLine(base, change, rebased),
    step,
    type,
    settle,
    submit,
  }
}
