'use client'

import clsx from 'clsx'
import { MessageSquare, Swords } from 'lucide-react'
import { ChatLog } from '../chat-log/chat-log'
import { Pane } from '../pane/pane'
import { PaneTab } from '../pane-tab/pane-tab'
import { Scroller } from '@/components/scroller/scroller'
import {
  badgeCount,
  combatSummary,
  messageCount,
} from '@/features/table/utils/header'
import type { Aside, Tab, TabHold } from '@/features/table/types'
import type { TableCombat, TableMessage } from '@/types/table'
import type { ReactNode, RefObject } from 'react'

/**
 * Combat and the chat: tabs on a narrower screen. On a wide one they share a narrow column beside
 * the sheet, or beside why there's none and the notes, with tabs of their own to choose between
 * them, which mark the seat's turn and unread messages, and say what's happening in the one shown.
 * @param paneShown - Whether the sheet's pane shows beside the column on a wide screen.
 * @param focusable - Whether combat and the chat may take focus: where one is the pane shown, on a
 *   phone or tablet, as a notice above it is dismissed; never beside the sheet, where nothing moves
 *   focus to them, and a click in one would.
 * @param quiet - Whether the tabs ignore clicks now, just after a hold has ended the turn.
 * @param onShow - Shows combat or the chat.
 * @param combatTab - The column's Combat tab, where focus on the turn may go.
 * @param hold - The column's Combat tab held to end the turn.
 * @param tracker - The combat tracker, the character's view of it.
 * @param chat - The chat's scroller, kept pinned to the newest message, and its scroll handler.
 */
export function AsideColumn({
  tab,
  aside,
  paneShown,
  focusable,
  myTurn,
  unread,
  combat,
  messages,
  quiet,
  onShow,
  combatTab,
  hold,
  tracker,
  chat,
}: Readonly<{
  tab: Tab
  aside: Aside
  paneShown: boolean
  focusable: boolean
  myTurn: boolean
  unread: number
  combat?: TableCombat
  messages: TableMessage[]
  quiet: () => boolean
  onShow: (aside: Aside) => void
  combatTab: RefObject<HTMLButtonElement | null>
  hold: TabHold
  tracker: ReactNode
  chat: {
    scroller: RefObject<HTMLDivElement | null>
    onScroll: () => void
  }
}>) {
  // The chat's ref taken out first: read off the props in place, the compiler takes it for a ref
  // read during render.
  const { scroller, onScroll } = chat
  return (
    <div
      className={clsx(
        'min-h-0 min-w-0 flex-1 flex-col lg:flex',
        tab === 'character' ? 'hidden' : 'flex',
        paneShown &&
          'lg:w-[clamp(320px,40%,500px)] lg:flex-none lg:border-l lg:border-border',
      )}
    >
      <div className='hidden h-12 shrink-0 items-center gap-3 border-b border-border px-3 lg:flex'>
        <div
          role='tablist'
          aria-label='Combat or chat'
          className='flex shrink-0 gap-1'
        >
          <PaneTab
            ref={combatTab}
            icon={Swords}
            label='Combat'
            pane='combat-pane'
            selected={aside === 'combat'}
            onClick={() => {
              if (!quiet()) onShow('combat')
            }}
            hold={hold}
          >
            {myTurn && aside !== 'combat' && (
              <span className='relative size-2 rounded-full bg-primary'>
                <span className='sr-only'>, your turn</span>
              </span>
            )}
          </PaneTab>
          <PaneTab
            icon={MessageSquare}
            label='Chat'
            pane='chat-pane'
            selected={aside === 'chat'}
            onClick={() => {
              if (!quiet()) onShow('chat')
            }}
          >
            {unread > 0 && (
              <span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary'>
                {badgeCount(unread)}
                <span className='sr-only'> unread</span>
              </span>
            )}
          </PaneTab>
        </div>
        <span className='truncate text-sm text-text-secondary'>
          {aside === 'combat'
            ? combatSummary(combat)
            : messageCount(messages.length)}
        </span>
      </div>
      <Pane
        id='combat-pane'
        label='Combat'
        focusable={focusable}
        className={aside === 'combat' ? 'flex' : 'hidden'}
      >
        <Scroller>
          {/* The character's view of it, whichever creature is chosen (module 0.36.0). */}
          {tracker}
        </Scroller>
      </Pane>
      <Pane
        id='chat-pane'
        label='Chat'
        focusable={focusable}
        className={aside === 'chat' ? 'flex' : 'hidden'}
      >
        <Scroller ref={scroller} onScroll={onScroll}>
          <ChatLog messages={messages} />
        </Scroller>
      </Pane>
    </div>
  )
}
