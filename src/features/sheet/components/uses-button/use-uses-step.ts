import { useState, type FormEvent } from 'react'

/**
 * How many of a counter's charges are chosen to spend directly, as `UsesMenu` offers them: from 1,
 * as it opens, to as many as are left, pulled back should the sheet say fewer are while it's open.
 * `submit` spends them.
 */
export function useUsesStep(left: number, onSpend: (count: number) => void) {
  const [chosen, setChosen] = useState(1)
  // No more than are left, should the sheet say fewer are while it's open.
  const most = Math.max(1, left)
  if (chosen > most) setChosen(most)
  // Kept within 1 and as many as are left; its buttons stay where they can't go further, so that
  // focus isn't lost from one.
  const step = (by: number) => {
    const next = chosen + by
    if (next < 1 || next > most) return
    setChosen(next)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSpend(Math.min(chosen, most))
  }
  return { chosen, most, step, submit }
}
