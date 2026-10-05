'use client'

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import clsx from 'clsx'
import {
  ArrowLeft,
  MessageSquare,
  Swords,
  Ticket,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { ChatLog } from './chat-log'
import { CombatTracker } from './combat-tracker'
import { LiveStatus, type LiveState } from './live-status'
import { CharacterChooser } from '@/components/character-chooser'
import { DeleteCharacterWarning } from '@/components/character-list'
import { ConfirmDialog } from '@/components/modal'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useTableView } from '@/hooks/use-table-view'
import { gameHost } from '@/utils/game-host'
import type { CampaignChoice, ChooseCharacterFormState } from '@/types/campaign'
import type { Character } from '@/types/character'
import type { TableCombat, TableView } from '@/types/table'

type Tab = 'combat' | 'chat'

/** From Tailwind's lg width, combat and chat sit side by side rather than in tabs. */
const SIDE_BY_SIDE = '(min-width: 64rem)'

type Props = {
  character: Character
  initialView: TableView
  /** The campaign's characters, for a character in it that has yet to choose which it is. */
  choice?: CampaignChoice
  /** Saves which of its campaign's characters this character is. */
  chooseActor: (
    state: ChooseCharacterFormState,
    formData: FormData,
  ) => Promise<ChooseCharacterFormState>
  /** Deletes this character and leaves its page. */
  deleteCharacter: () => Promise<void>
}

/**
 * A character's live view of its campaign: the combat tracker and the chat log, in tabs on a phone
 * or tablet and side by side on a wider screen.
 */
export function GameTable({
  character,
  initialView,
  choice,
  chooseActor,
  deleteCharacter,
}: Readonly<Props>) {
  const { view, connection } = useTableView(character.id, initialView)
  const [tab, setTab] = useState<Tab>(() =>
    initialView.combat?.started ? 'combat' : 'chat',
  )
  // A wide screen shows the chat beside combat, so it is always in view there.
  const sideBySide = useMediaQuery(SIDE_BY_SIDE)
  const chatInView = sideBySide || tab === 'chat'

  // Messages newer than the newest one seen in the chat are unread.
  const newest = view.messages.at(-1)?.sentAt ?? ''
  const [seenUpTo, setSeenUpTo] = useState(newest)
  if (chatInView && seenUpTo !== newest) setSeenUpTo(newest)
  const unread = chatInView
    ? 0
    : view.messages.filter(({ sentAt }) => sentAt > seenUpTo).length

  const myTurn = isMyTurn(view.combat)

  // Keep the chat pinned to the newest message unless the player has scrolled up to read.
  const chatScroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  useLayoutEffect(() => {
    const element = chatScroller.current
    if (element && chatInView && pinned.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [chatInView, view.messages])
  const onChatScroll = () => {
    const element = chatScroller.current
    if (element && chatInView) {
      pinned.current =
        element.scrollHeight - element.scrollTop - element.clientHeight < 80
    }
  }
  const show = (next: Tab) => {
    // Back on the chat, start from the newest message.
    if (next === 'chat') pinned.current = true
    setTab(next)
  }

  const playing = view.campaign !== undefined && character.actorId !== null
  let table: ReactNode
  if (!view.campaign || (!character.actorId && !choice)) {
    table = (
      <Scroller>
        <NoCampaign name={character.name} />
      </Scroller>
    )
  } else if (!character.actorId && choice) {
    table = (
      <Scroller>
        <ChooseActor choice={choice} action={chooseActor} />
      </Scroller>
    )
  } else {
    // One pane at a time in tabs; side by side on a wide screen.
    table = (
      <div className='flex min-h-0 flex-1 lg:divide-x lg:divide-border'>
        <Pane
          icon={Swords}
          title='Combat'
          summary={combatSummary(view.combat)}
          shown={tab === 'combat'}
        >
          <CombatTracker combat={view.combat} />
        </Pane>
        <Pane
          icon={MessageSquare}
          title='Chat'
          summary={messageCount(view.messages.length)}
          shown={tab === 'chat'}
          scroller={chatScroller}
          onScroll={onChatScroll}
        >
          <ChatLog messages={view.messages} />
        </Pane>
      </div>
    )
  }

  return (
    <div className='flex h-[calc(100dvh-3.5rem)] flex-col md:flex-row'>
      <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
        <header className='flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-8'>
          <div className='flex min-w-0 items-center gap-2'>
            <Link
              href='/characters'
              aria-label='All characters'
              className='-ml-1.5 shrink-0 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
            >
              <ArrowLeft aria-hidden className='size-5' />
            </Link>
            <div className='min-w-0'>
              <h1 className='truncate text-lg leading-tight font-semibold'>
                {character.name}
              </h1>
              <p
                className={clsx(
                  'truncate text-sm text-text-secondary',
                  playing && 'lg:hidden',
                )}
              >
                {subtitle(tab, view, character)}
              </p>
              {playing && (
                <p className='hidden truncate text-sm text-text-secondary lg:block'>
                  {campaignAndGame(view, character)}
                </p>
              )}
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            <LiveStatus state={liveState(playing, view, connection)} />
            <ConfirmDialog
              trigger={<Trash2 aria-hidden className='size-4' />}
              triggerLabel={`Delete ${character.name}`}
              triggerClassName='rounded-lg p-2 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'
              title={`Delete ${character.name}?`}
              confirmLabel='Delete'
              onConfirm={deleteCharacter}
              danger
            >
              <DeleteCharacterWarning name={character.name} />
            </ConfirmDialog>
          </div>
        </header>
        {playing && view.campaign && !view.connected && (
          <NotConnected name={character.name} campaign={view.campaign.title} />
        )}
        {table}
      </div>
      <nav
        aria-label='Table'
        className='flex shrink-0 gap-1 border-t border-border bg-card px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:w-24 md:flex-col md:gap-2 md:border-t-0 md:border-l md:p-2.5 lg:hidden'
      >
        <TabButton
          icon={Swords}
          label='Combat'
          active={tab === 'combat'}
          onClick={() => show('combat')}
        >
          {myTurn && tab !== 'combat' && (
            <span className='absolute top-2 right-[calc(50%-1.25rem)] size-2.5 rounded-full bg-primary ring-2 ring-card'>
              <span className='sr-only'>, your turn</span>
            </span>
          )}
        </TabButton>
        <TabButton
          icon={MessageSquare}
          label='Chat'
          active={tab === 'chat'}
          onClick={() => show('chat')}
        >
          {unread > 0 && (
            <span className='absolute top-1 right-[calc(50%-1.75rem)] flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary ring-2 ring-card'>
              {unread}
              <span className='sr-only'> unread</span>
            </span>
          )}
        </TabButton>
      </nav>
    </div>
  )
}

/**
 * A scrolling area of the table. It is positioned so that what is placed absolutely inside it,
 * such as text only for screen readers, scrolls with it rather than stretching the page.
 */
function Scroller({
  ref,
  onScroll,
  children,
}: Readonly<{
  ref?: RefObject<HTMLDivElement | null>
  onScroll?: () => void
  children: ReactNode
}>) {
  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className='@container relative min-h-0 flex-1 overflow-y-auto'
    >
      {children}
    </div>
  )
}

/**
 * Combat or chat: shown as a tab on a narrower screen, and as a column, headed with what is
 * happening in it, on a wide one.
 */
function Pane({
  icon: Icon,
  title,
  summary,
  shown,
  scroller,
  onScroll,
  children,
}: Readonly<{
  icon: LucideIcon
  title: string
  summary: string
  /** Whether it is the tab shown on a narrower screen. */
  shown: boolean
  scroller?: RefObject<HTMLDivElement | null>
  onScroll?: () => void
  children: ReactNode
}>) {
  const heading = `${title.toLowerCase()}-pane`
  return (
    <section
      aria-labelledby={heading}
      className={clsx(
        'min-h-0 min-w-0 flex-1 flex-col',
        shown ? 'flex' : 'hidden lg:flex',
      )}
    >
      <div className='hidden shrink-0 items-center gap-2 border-b border-border px-8 py-2.5 lg:flex'>
        <Icon aria-hidden className='size-4 shrink-0 text-primary' />
        <h2 id={heading} className='text-sm font-semibold'>
          {title}
        </h2>
        <span className='truncate text-sm text-text-secondary'>{summary}</span>
      </div>
      <Scroller ref={scroller} onScroll={onScroll}>
        {children}
      </Scroller>
    </section>
  )
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
  children,
}: Readonly<{
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
  children?: ReactNode
}>) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors md:min-h-18 md:w-full md:flex-none',
        active
          ? 'bg-primary/10 text-text-primary'
          : 'text-text-secondary hover:text-text-primary',
      )}
    >
      <Icon aria-hidden className={clsx('size-6', active && 'text-primary')} />
      {label}
      {children}
    </button>
  )
}

function NotConnected({
  name,
  campaign,
}: Readonly<{ name: string; campaign: string }>) {
  return (
    <p className='shrink-0 border-b border-warning/40 bg-warning/10 px-4 py-2.5 text-sm md:px-8'>
      {name} is no longer one of {campaign}&apos;s characters, so only public
      messages show here. Ask your Gamemaster to add them back to the campaign
      in Sending Stone.
    </p>
  )
}

/** For a character from before invite links, or whose campaign was removed. */
function NoCampaign({ name }: Readonly<{ name: string }>) {
  return (
    <div className='mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center md:py-16'>
      <Ticket aria-hidden className='size-8 text-primary' />
      <h2 className='mt-4 text-lg font-semibold'>
        {name} isn&apos;t in a campaign
      </h2>
      <p className='mt-1 text-sm text-text-secondary'>
        Ask your Gamemaster for their campaign&apos;s invite link and open it to
        choose your character there. You can then remove this one from your
        characters.
      </p>
      <Link
        href='/characters'
        className='mt-6 rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10'
      >
        Your characters
      </Link>
    </div>
  )
}

/** For a character in a campaign that has yet to choose which of its characters it is. */
function ChooseActor({
  choice,
  action,
}: Readonly<{ choice: CampaignChoice; action: Props['chooseActor'] }>) {
  return (
    <div className='mx-auto w-full max-w-xl px-4 py-10'>
      <h2 className='text-lg font-semibold'>
        Choose your character in {choice.title}
      </h2>
      <p className='mt-1 mb-6 text-sm text-text-secondary'>
        Each character is played by one player. Choose yours to see its whispers
        and turns.
      </p>
      <CharacterChooser choice={choice} action={action} />
    </div>
  )
}

function liveState(
  playing: boolean,
  view: TableView,
  connection: 'live' | 'reconnecting',
): LiveState {
  if (!playing) return 'waiting'
  if (connection === 'reconnecting') return 'reconnecting'
  return view.live ? 'live' : 'offline'
}

function isMyTurn(combat?: TableCombat): boolean {
  return (
    combat?.started === true &&
    combat.combatants.some(
      ({ id, side }) => id === combat.currentId && side === 'me',
    )
  )
}

/** The header's line under the character's name: what is happening in the tab shown. */
function subtitle(tab: Tab, view: TableView, character: Character): string {
  if (!view.campaign) return campaignAndGame(view, character)
  if (tab === 'chat') {
    return `${view.campaign.title} · ${messageCount(view.messages.length)}`
  }
  return combatSummary(view.combat)
}

/** The campaign, as its Gamemaster now titles it, and the game it is played in. */
function campaignAndGame(view: TableView, character: Character): string {
  const host = gameHost(character.gameUrl)
  const title = view.campaign?.title ?? character.campaignTitle
  return title ? `${title} · ${host}` : host
}

function messageCount(count: number): string {
  return `${count} ${count === 1 ? 'message' : 'messages'}`
}

function combatSummary(combat?: TableCombat): string {
  if (!combat) return 'No combat'
  if (!combat.started) return 'Getting ready'
  const current = combat.combatants.find(({ id }) => id === combat.currentId)
  if (current?.side === 'me') return `Round ${combat.round} · Your turn`
  return current
    ? `Round ${combat.round} · ${current.name}’s turn`
    : `Round ${combat.round}`
}
