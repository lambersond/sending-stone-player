import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { SwitcherCreature } from '@/features/companions/types'

/** How far a tab is kept from either edge of the row as it's shown, clear of the fades. */
const CLEAR = 40

/**
 * How the creature switcher lays out its row: tabs while every tab at its widest fits, else
 * avatars, measured on a hidden copy of the tabs as the creatures and the row's width change; a
 * fade at each edge a tab runs past; the chosen kept in view; and focus kept in the row as it goes.
 * @param creatures - The switcher's creatures, whose tabs' faces the measure follows.
 * @param chosen - The chosen creature's key.
 */
export function useSwitcherLayout(
  creatures: SwitcherCreature[],
  chosen: string,
) {
  const box = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const [avatars, setAvatars] = useState(false)
  const [fades, setFades] = useState({ left: false, right: false })
  // As the latest render has them, for what the row's observer measures.
  const latest = useRef({ chosen, avatars })
  useLayoutEffect(() => {
    latest.current = { chosen, avatars }
  })
  // What the row's tabs draw, which their widths follow; not which is chosen, nor news.
  const faces = creatures
    .map(({ key, name, number, kind, gone }) =>
      [key, name, number, kind, gone].join(':'),
    )
    .join('|')

  // A fade at each edge a tab runs past, not where only the row's padding does.
  const measureFades = useCallback(() => {
    const element = row.current
    const first = element?.firstElementChild
    const last = element?.lastElementChild
    if (
      !element ||
      !(first instanceof HTMLElement) ||
      !(last instanceof HTMLElement)
    ) {
      return
    }
    const left = first.offsetLeft < element.scrollLeft - 1
    const right =
      last.offsetLeft + last.offsetWidth >
      element.scrollLeft + element.clientWidth + 1
    setFades(held =>
      held.left === left && held.right === right ? held : { left, right },
    )
  }, [])
  // A creature's tab, or its avatar, as drawn now.
  const tabOf = useCallback(
    (key: string) =>
      [
        ...(row.current?.querySelectorAll<HTMLElement>('[data-key]') ?? []),
      ].find(each => each.dataset.key === key),
    [],
  )
  // The chosen tab scrolled into view, with room clear of either edge, at once.
  const reveal = useCallback(
    (key: string) => {
      const element = row.current
      const tab = tabOf(key)
      if (!element || !tab) return
      const left = tab.offsetLeft - CLEAR
      const right = tab.offsetLeft + tab.offsetWidth + CLEAR
      if (left < element.scrollLeft) element.scrollLeft = left
      else if (right > element.scrollLeft + element.clientWidth) {
        element.scrollLeft = right - element.clientWidth
      }
    },
    [tabOf],
  )

  // Avatars where the tabs at their widest are wider than the row: measured as the creatures
  // change, and as the row's width does.
  useLayoutEffect(() => {
    const measure = () => {
      if (!ghost.current || !box.current) return
      const next = ghost.current.offsetWidth > box.current.clientWidth
      setAvatars(next)
      // Where the mode changes, the effect below reveals the chosen once the new row is drawn.
      if (next === latest.current.avatars) reveal(latest.current.chosen)
      measureFades()
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (box.current) observer.observe(box.current)
    if (ghost.current) observer.observe(ghost.current)
    return () => observer.disconnect()
  }, [faces, measureFades, reveal])
  // The chosen kept in view: as it's chosen, as the mode changes, and as creatures come and go.
  useLayoutEffect(() => {
    reveal(chosen)
    measureFades()
  }, [chosen, avatars, faces, reveal, measureFades])

  // Focus in the row as it goes, as when the last gone tab is left for the character's, moves to
  // the character's sheet's chosen tab, never to the page. Not at once: React drops the row before
  // it shows the character's panel, in the same commit, and a browser focuses nothing hidden. So
  // once that commit is done, and only where focus has fallen to the page meanwhile.
  useLayoutEffect(() => {
    const element = box.current
    return () => {
      if (!element?.contains(document.activeElement)) return
      queueMicrotask(() => {
        const now = document.activeElement
        if (now && now !== document.body && now.isConnected) return
        document
          .querySelector<HTMLElement>(
            '[id^="sheet-tab-"][aria-selected="true"]',
          )
          ?.focus()
      })
    }
  }, [])

  return { box, ghost, row, avatars, fades, measureFades, tabOf }
}
