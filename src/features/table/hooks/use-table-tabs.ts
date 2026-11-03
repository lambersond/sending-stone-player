import { useState } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { Aside, Tab } from '@/features/table/types'

/** From Tailwind's lg width, the sheet and the combat or chat column sit side by side. */
const SIDE_BY_SIDE = '(min-width: 64rem)'

/**
 * The table's tabs: the one shown on a phone or tablet, the character, combat or the chat; what
 * sits beside the sheet on a wide screen, combat or the chat; and whether the screen is that wide.
 * @param fighting - Whether the page opened on a combat already started: combat then sits beside
 *   the sheet, else the chat.
 * @returns The tab and the column's choice; whether they sit side by side; whether the chat, the
 *   combat pane and the Character pane are in view; and `show`, which shows a tab, and on a wide
 *   screen puts combat or the chat beside the sheet.
 */
export function useTableTabs(fighting: boolean) {
  const [aside, setAside] = useState<Aside>(() =>
    fighting ? 'combat' : 'chat',
  )
  // The character comes first, in a fight too, where the Combat tab marks the player's turn; and
  // without a sheet, where its tab says why.
  const [tab, setTab] = useState<Tab>('character')
  const sideBySide = useMediaQuery(SIDE_BY_SIDE)
  // A screen that narrows from the sheet beside combat or the chat to one pane shows the
  // character, keeping the part of the sheet shown. Widening changes nothing.
  const [wasSideBySide, setWasSideBySide] = useState(sideBySide)
  if (sideBySide !== wasSideBySide) {
    setWasSideBySide(sideBySide)
    if (!sideBySide) setTab('character')
  }
  // The chat is in view when it is the tab shown, or on a wide screen when it is what sits beside
  // the sheet.
  const chatInView = aside === 'chat' && (sideBySide || tab === 'chat')
  // Whether the combat pane is shown: Combat chosen in one pane, or beside the sheet.
  const combatShown = sideBySide ? aside === 'combat' : tab === 'combat'
  // Whether the Character pane is in view: on a wide screen, or as its tab.
  const characterInView = tab === 'character' || sideBySide
  const show = (next: Tab) => {
    if (next !== 'character') setAside(next)
    setTab(next)
  }
  return {
    tab,
    aside,
    sideBySide,
    chatInView,
    combatShown,
    characterInView,
    show,
  }
}
