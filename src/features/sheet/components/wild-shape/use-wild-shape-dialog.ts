import { useRef, useState, type RefObject } from 'react'
import { backButton, dialogOf } from './utils'
import type { Focus, Refusal, Sent, View } from './types'
import type { KnownForm } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/**
 * The pane's one Wild Shape dialog's state (`view`), held here so that it outlives the row it was
 * opened from as a new sheet arrives: the picker and the card checked in it, the default where none
 * is picked (`checked`); the manager, and whether it was opened from the picker, which its Back
 * goes to; and the Beast chosen to learn. What opened it, the view the manager was opened from in
 * the picker, and the control in the manager that opened a Beast to learn are kept for focus to go
 * back to.
 * @param offered - The known forms that can be taken from here now.
 * @param last - The last form taken from this device, checked where it's offered.
 */
export function useWildShapeDialog({
  offered,
  last,
  refusal,
  setRefusal,
  setFocus,
  loadBeasts,
  keepLast,
  body,
  pressed,
}: Readonly<{
  offered: KnownForm[]
  last?: string
  refusal?: Refusal
  setRefusal: (refusal: Refusal | undefined) => void
  setFocus: (focus: Focus | undefined) => void
  loadBeasts: () => void
  keepLast: (form: string) => void
  body: RefObject<HTMLDivElement | null>
  pressed: RefObject<HTMLElement | undefined>
}>) {
  const [view, setView] = useState<View>()
  const [fromPicker, setFromPicker] = useState(false)
  const [picked, setPicked] = useState<string>()
  const [beast, setBeast] = useState<string>()
  const opener = useRef<HTMLElement>(undefined)
  const knownFrom = useRef<'known' | 'choose'>('known')
  const learnFrom = useRef('')
  // The card checked: the one picked, else the last form taken from this device, else the first.
  const offers = (id?: string) => offered.some(known => known.id === id)
  let checked: string | undefined = offered[0]?.id
  if (offers(last)) checked = last
  if (offers(picked)) checked = picked

  // Once a command has settled as made: a change closes the picker, its form kept as the last
  // taken here, focus to the ribbon's heading; a return, focus to the tab's panel; a Beast learned,
  // the manager again, focus on its card.
  const made = (sent: Sent, sheet: TableSheet) => {
    const active = document.activeElement
    const lost = !active || active === document.body
    switch (sent.op) {
      case 'transform': {
        keepLast(sent.form)
        const inDialog = !!active && !!dialogOf(body)?.contains(active)
        if (view) setView(undefined)
        if (lost || inDialog || active === opener.current) setFocus('heading')
        return
      }
      case 'revert': {
        if (lost || active === pressed.current) setFocus('panel')
        return
      }
      case 'learn': {
        if (view?.kind !== 'learn') return
        setView({ kind: 'known' })
        const id =
          sent.replace ??
          sheet.wildShape?.known.find(({ uuid }) => uuid === sent.uuid)?.id
        if (id) setFocus({ selector: `[data-ws-focus="form:${id}"]` })
      }
    }
  }

  return {
    view,
    fromPicker,
    checked,
    beast,
    made,
    pick: (id: string) => {
      if (!offers(id)) return
      setPicked(id)
      // Another card clears why the last change wasn't made.
      if (refusal?.op === 'transform') setRefusal(undefined)
    },
    pickBeast: (uuid: string) => {
      setBeast(uuid)
      if (refusal?.op === 'learn') setRefusal(undefined)
    },
    openPicker: (element: HTMLElement) => {
      opener.current = element
      setPicked(undefined)
      if (refusal?.op === 'transform') setRefusal(undefined)
      setView({ kind: 'picker' })
    },
    openKnown: (element: HTMLElement) => {
      opener.current = element
      setFromPicker(false)
      setView({ kind: 'known' })
    },
    showKnown: (from: 'known' | 'choose') => {
      knownFrom.current = from
      setFromPicker(true)
      setView({ kind: 'known' })
      setFocus(backButton('Back to Wild Shape'))
    },
    showLearn: (from: string, replace?: KnownForm) => {
      learnFrom.current = from
      setBeast(undefined)
      if (refusal?.op === 'learn') setRefusal(undefined)
      setView({ kind: 'learn', replace })
      setFocus(backButton('Back to known forms'))
      loadBeasts()
    },
    back: () => {
      if (view?.kind === 'learn') {
        setView({ kind: 'known' })
        setFocus({ selector: `[data-ws-focus="${learnFrom.current}"]` })
      } else if (view?.kind === 'known' && fromPicker) {
        setView({ kind: 'picker' })
        // Choose forms… is gone once the first form is learned: Known forms… stands in for it.
        setFocus({
          selector: `[data-ws-focus="${knownFrom.current}"]`,
          or: '[data-ws-focus="known"], [data-ws-focus="choose"]',
        })
      }
    },
    close: () => {
      setView(undefined)
      if (opener.current) setFocus(opener.current)
    },
  }
}
