import { useEffect, useState } from 'react'
import type { Focus } from './types'
import type { SheetForm } from '@/types/sending-stone'

/**
 * Return's confirm, from the Return pressed (`returnAnchor`). It's shown only while Return is
 * offered (`returnable`). Once it isn't, as when the game stops taking Wild Shape or ends it, the
 * Return it was opened from has gone and it closes with it, so that it's never confirmed for
 * nothing, nor opens again by itself with a later form. Focus, lost with it, goes to the ribbon,
 * which says why, or once the character is itself again, the tab's panel.
 * @param confirm - Returns the character, from the Return confirmed.
 */
export function useReturnConfirm({
  returnable,
  form,
  setFocus,
  confirm,
}: Readonly<{
  returnable: boolean
  form?: SheetForm
  setFocus: (focus: Focus | undefined) => void
  confirm: (anchor: HTMLElement | undefined) => void
}>) {
  const [returnAnchor, setReturnAnchor] = useState<HTMLElement>()
  useEffect(() => {
    if (!returnAnchor || returnable) return
    // The confirm closes once the commit that took its Return away is drawn, as before v0.43:
    // closing it as it's drawn would change when focus moves.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closed after the commit, as ever
    setReturnAnchor(undefined)
    const active = document.activeElement
    if (!active || active === document.body)
      setFocus(form ? 'heading' : 'panel')
  }, [returnAnchor, returnable, form, setFocus])
  return {
    returnAnchor: returnable ? returnAnchor : undefined,
    openReturn: (element: HTMLElement) => setReturnAnchor(element),
    /** Closes Return's confirm, returning the character where `confirm`. */
    closeReturn: (confirmed: boolean) => {
      const anchor = returnable ? returnAnchor : undefined
      setReturnAnchor(undefined)
      if (anchor) setFocus(anchor)
      if (confirmed) confirm(anchor)
    },
  }
}
