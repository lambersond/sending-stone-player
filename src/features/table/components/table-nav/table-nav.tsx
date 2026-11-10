'use client'

import { MessageSquare, Swords, UserRound } from 'lucide-react'
import { TabButton } from '../tab-button/tab-button'
import { badgeCount } from '@/features/table/utils/header'
import type { Tab, TabHold } from '@/features/table/types'
import type { RefObject } from 'react'

/**
 * The table's tabs on a phone or tablet: a bar at the bottom, or a rail beside the page from 768
 * pixels, gone from 1024 where the sheet and the column sit side by side. Each marks what waits
 * on it: a save asked, or dice, the seat's turn, unread messages.
 * @param asking - Whether the game asks a save of the character, or of a companion, or from module
 *   0.45.0 its player's dice, that waits.
 * @param quiet - Whether the tabs ignore clicks now, just after a hold has ended the turn.
 * @param onShow - Shows a tab.
 * @param combatTab - The Combat tab, where focus on the turn may go.
 * @param hold - The Combat tab held to end the turn.
 */
export function TableNav({
  tab,
  asking,
  asksForRoll,
  myTurn,
  unread,
  quiet,
  onShow,
  combatTab,
  hold,
}: Readonly<{
  tab: Tab
  asking: boolean
  asksForRoll: string
  myTurn: boolean
  unread: number
  quiet: () => boolean
  onShow: (tab: Tab) => void
  combatTab: RefObject<HTMLButtonElement | null>
  hold: TabHold
}>) {
  return (
    <nav
      aria-label='Table'
      className='flex shrink-0 gap-1 border-t border-border bg-card px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:w-24 md:flex-col md:gap-2 md:border-t-0 md:border-l md:p-2.5 lg:hidden'
    >
      <TabButton
        icon={UserRound}
        label='Character'
        active={tab === 'character'}
        onClick={() => {
          if (quiet()) return
          onShow('character')
        }}
      >
        {asking && tab !== 'character' && (
          <span className='absolute top-2 right-[calc(50%-1.25rem)] size-2.5 rounded-full bg-primary ring-2 ring-card'>
            <span className='sr-only'>{asksForRoll}</span>
          </span>
        )}
      </TabButton>
      <TabButton
        ref={combatTab}
        icon={Swords}
        label='Combat'
        active={tab === 'combat'}
        onClick={() => {
          if (quiet()) return
          onShow('combat')
        }}
        hold={hold}
      >
        {myTurn && tab !== 'combat' && (
          <span className='absolute top-2 right-[calc(50%-1.25rem)] z-[1] size-2.5 rounded-full bg-primary ring-2 ring-card'>
            <span className='sr-only'>, your turn</span>
          </span>
        )}
      </TabButton>
      <TabButton
        icon={MessageSquare}
        label='Chat'
        active={tab === 'chat'}
        onClick={() => {
          if (quiet()) return
          onShow('chat')
        }}
      >
        {unread > 0 && (
          <span className='absolute top-1 right-[calc(50%-1.75rem)] flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary ring-2 ring-card'>
            {badgeCount(unread)}
            <span className='sr-only'> unread</span>
          </span>
        )}
      </TabButton>
    </nav>
  )
}
