'use client'

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
import {
  ArrowLeft,
  MessageSquare,
  Swords,
  Ticket,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { ChatLog } from './chat-log'
import { CombatTracker } from './combat-tracker'
import { EmptyState } from './empty-state'
import { FullscreenButton } from './fullscreen-button'
import { LiveStatus, type LiveState } from './live-status'
import { CharacterChooser } from '@/components/character-chooser'
import { DeleteCharacterWarning } from '@/components/character-list'
import { CharacterPane, classLine } from '@/components/character-sheet'
import { ConfirmDialog } from '@/components/modal'
import { PartyPanel } from '@/components/party-sheet/party-panel'
import { Scroller } from '@/components/scroller'
import { useMediaQuery } from '@/hooks/use-media-query'
import { TableApiContext } from '@/hooks/use-table-api'
import { useTableView } from '@/hooks/use-table-view'
import { useWaitingPrompts } from '@/hooks/use-waiting-prompts'
import { megabytes } from '@/utils/format-amount'
import { gameHost } from '@/utils/game-host'
import { seatWords } from '@/utils/seat-words'
import type { CampaignChoice, ChooseCharacterFormState } from '@/types/campaign'
import type { Character, TableSeat } from '@/types/character'
import type { TableGroup } from '@/types/party'
import type {
  GmRolls,
  TableCombat,
  TableMessage,
  TableView,
} from '@/types/table'

type Tab = 'character' | 'combat' | 'chat'

/** What shares the narrow column beside the sheet on a wide screen: combat, or the chat. */
type Aside = Exclude<Tab, 'character'>

/** How far a player has read an empty chat: every message after it is unread. */
const NOTHING_READ = new Date(0).toISOString()

/** From Tailwind's lg width, the sheet and the combat or chat column sit side by side. */
const SIDE_BY_SIDE = '(min-width: 64rem)'

type Props = {
  character: Character
  initialView: TableView
  /**
   * Who is at the sheet (#156): its player, by default, through the character's own API; or its
   * campaign's Gamemaster, through theirs, rolling as it.
   */
  seat?: TableSeat
  /** The campaign's characters, for a character in it that has yet to choose which it is. */
  choice?: CampaignChoice
  /** Saves which of its campaign's characters this character is. A player's page only. */
  chooseActor?: (
    state: ChooseCharacterFormState,
    formData: FormData,
  ) => Promise<ChooseCharacterFormState>
  /** Deletes this character and leaves its page. A player's page only. */
  deleteCharacter?: () => Promise<void>
  /**
   * Notes that the player has read the chat up to the message sent at this ISO time. A player's
   * page only: the Gamemaster never moves their place in it.
   */
  markChatRead?: (readAt: string) => Promise<void>
}

/**
 * A character's live view of its campaign: their sheet to roll from, the combat tracker and the
 * chat log. In tabs on a phone or tablet. On a wider screen the sheet fills the main column, and
 * combat and the chat share a narrow one beside it. Its campaign's Gamemaster sees it as its
 * player does, and rolls as it, with no way to choose or delete it (#156).
 */
export function GameTable({
  character,
  initialView,
  seat: given,
  choice,
  chooseActor,
  deleteCharacter,
  markChatRead,
}: Readonly<Props>) {
  const role = given?.role ?? 'player'
  const api = given?.api ?? `/api/characters/${character.id}`
  const key = given?.key ?? character.id
  const seat = useMemo<TableSeat>(() => ({ role, api, key }), [role, api, key])
  const gm = seat.role === 'gm'
  const words = seatWords(seat.role)
  const { view, connection } = useTableView(seat.api, initialView)
  const fighting = initialView.combat?.started === true
  const [aside, setAside] = useState<Aside>(() =>
    fighting ? 'combat' : 'chat',
  )
  // The character comes first, in a fight too, where the Combat tab marks the player's turn; and
  // without a sheet, where its tab says why.
  const [tab, setTab] = useState<Tab>('character')
  // The party sheet open in its side panel, by its group's id (module 0.30.0). Once open, it stays
  // open as the group was last listed, should the group leave the list, as when the player's
  // access to it is taken away: the panel then says so, rather than vanishing.
  const [partyOpen, setPartyOpen] = useState<string>()
  const listedParty = view.groups?.find(({ id }) => id === partyOpen)
  const [lastParty, setLastParty] = useState<TableGroup>()
  if (listedParty && !sameGroup(listedParty, lastParty)) {
    setLastParty(listedParty)
  }
  const party =
    listedParty ?? (lastParty?.id === partyOpen ? lastParty : undefined)
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

  // Messages from others newer than the newest the player has had in view are unread. How far
  // they have read is kept with the character, so it lasts across visits and devices. On a first
  // visit, what is already there counts as read, and anything after it as unread. The
  // Gamemaster's rolls as the character are the player's to read, though theirs; and at its
  // sheet, the Gamemaster reads all but their own, from the newest when they came, never moving
  // the player's place (#156).
  const newest = view.messages.at(-1)?.sentAt ?? ''
  const [seenUpTo, setSeenUpTo] = useState(
    () => (gm ? undefined : initialView.chatReadAt) ?? (newest || NOTHING_READ),
  )
  const readElsewhere = gm ? '' : (view.chatReadAt ?? '')
  if (readElsewhere > seenUpTo) setSeenUpTo(readElsewhere)
  if (chatInView && newest > seenUpTo) setSeenUpTo(newest)
  const unread = chatInView
    ? 0
    : view.messages.filter(
        message => countsAsUnread(message, gm) && message.sentAt > seenUpTo,
      ).length
  const saved = useRef(gm ? seenUpTo : initialView.chatReadAt)
  useEffect(() => {
    if (gm || !markChatRead || seenUpTo === saved.current) return
    saved.current = seenUpTo
    // Failing to save only means those messages count as unread again on another visit.
    markChatRead(seenUpTo).catch(() => {})
  }, [gm, seenUpTo, markChatRead])

  const myTurn = isMyTurn(view.combat)
  // The saves the game asks of the character, which its tab marks while they wait.
  const asked = useWaitingPrompts(view.connected ? view.prompts : undefined)

  // The header, which the sheet's roll toasts start below while its tabs aren't shown.
  // eslint-disable-next-line unicorn/no-null -- React sets a ref to null as it goes
  const [header, setHeader] = useState<HTMLElement | null>(null)

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
    if (next !== 'character') setAside(next)
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
  } else if (!character.actorId && choice && chooseActor) {
    table = (
      <Scroller>
        <ChooseActor choice={choice} action={chooseActor} />
      </Scroller>
    )
  } else {
    const hasSheet = view.sheet !== undefined
    table = (
      <div className='flex min-h-0 flex-1'>
        {/* The sheet: a tab on a narrower screen, and the main column on a wide one. */}
        <Pane
          id='character-pane'
          label='Character'
          className={clsx(
            tab === 'character' ? 'flex' : 'hidden',
            hasSheet ? 'lg:flex' : 'lg:hidden',
          )}
        >
          {view.sheet ? (
            <CharacterPane
              characterId={seat.key}
              name={character.name}
              sheet={view.sheet}
              combat={view.combat}
              // A character no longer in the campaign's game has no rolls made there.
              rollsToTable={view.connected ? view.rollsToTable : undefined}
              rollFeatures={view.connected ? view.rollFeatures : undefined}
              prompts={view.connected ? view.prompts : undefined}
              gmRolls={view.gmRolls}
              header={header}
              // Nor its items and coins moved there (module 0.31.0), by either seat.
              moves={view.connected ? view.moves : undefined}
              actorId={character.actorId ?? undefined}
              // The party sheets it may open, on its Inventory tab (module 0.30.0).
              parties={
                view.groups && { groups: view.groups, onOpen: setPartyOpen }
              }
            />
          ) : (
            <Scroller>
              <NoSheet
                name={character.name}
                withheld={view.sheetWithheld}
                told={words.told}
                coming={words.noSheet}
              />
            </Scroller>
          )}
        </Pane>
        {/* Combat and the chat: tabs on a narrower screen. On a wide one they share a narrow
            column beside the sheet, or the whole width until a sheet arrives. */}
        <div
          className={clsx(
            'min-h-0 min-w-0 flex-1 flex-col lg:flex',
            tab === 'character' ? 'hidden' : 'flex',
            hasSheet &&
              'lg:w-[clamp(320px,40%,500px)] lg:flex-none lg:border-l lg:border-border',
          )}
        >
          <div className='hidden h-11 shrink-0 items-center gap-3 border-b border-border px-3 lg:flex'>
            <div
              role='tablist'
              aria-label='Combat or chat'
              className='flex shrink-0 gap-1'
            >
              <PaneTab
                icon={Swords}
                label='Combat'
                pane='combat-pane'
                selected={aside === 'combat'}
                onClick={() => show('combat')}
              >
                {myTurn && aside !== 'combat' && (
                  <span className='size-2 rounded-full bg-primary'>
                    <span className='sr-only'>, your turn</span>
                  </span>
                )}
              </PaneTab>
              <PaneTab
                icon={MessageSquare}
                label='Chat'
                pane='chat-pane'
                selected={aside === 'chat'}
                onClick={() => show('chat')}
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
                ? combatSummary(view.combat)
                : messageCount(view.messages.length)}
            </span>
          </div>
          <Pane
            id='combat-pane'
            label='Combat'
            className={aside === 'combat' ? 'flex' : 'hidden'}
          >
            <Scroller>
              <CombatTracker combat={view.combat} />
            </Scroller>
          </Pane>
          <Pane
            id='chat-pane'
            label='Chat'
            className={aside === 'chat' ? 'flex' : 'hidden'}
          >
            <Scroller ref={chatScroller} onScroll={onChatScroll}>
              <ChatLog messages={view.messages} />
            </Scroller>
          </Pane>
        </div>
      </div>
    )
  }

  return (
    // A character's page has no app bar, so the game table fills the viewport. What reads and rolls
    // through the seat's API below, the sheet's descriptions and rolls among it, finds it here.
    <TableApiContext value={seat}>
      <div className='flex h-dvh flex-col md:flex-row'>
        <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
          <header
            ref={setHeader}
            className='flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-8'
          >
            <div className='flex min-w-0 items-center gap-2'>
              <Link
                href={gm ? '/campaigns' : '/characters'}
                aria-label={gm ? 'Your campaigns' : 'All characters'}
                className='-ml-1.5 shrink-0 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
              >
                <ArrowLeft aria-hidden className='size-5' />
              </Link>
              <div className='min-w-0'>
                {/* On a wide screen, the class and subclass follow the name, cut short before it
                  is. Narrower, the line under the name has them, on the Character tab. */}
                <div className='flex items-baseline gap-2 overflow-hidden'>
                  {gm ? (
                    // The name and its GM pill stand where the name alone does, and only the name
                    // is cut short, so a long one on a phone never pushes the pill out of view.
                    <div className='flex max-w-full shrink-0 items-baseline gap-2'>
                      <h1 className='min-w-0 truncate text-lg leading-tight font-semibold'>
                        {character.name}
                      </h1>
                      <span className='shrink-0 self-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-text'>
                        GM<span className='sr-only'>, Gamemaster view</span>
                      </span>
                    </div>
                  ) : (
                    <h1 className='max-w-full shrink-0 truncate text-lg leading-tight font-semibold'>
                      {character.name}
                    </h1>
                  )}
                  {playing && view.sheet && (
                    <p className='hidden min-w-0 truncate text-sm text-text-secondary lg:block'>
                      {classLine(view.sheet)}
                    </p>
                  )}
                </div>
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
              <FullscreenButton />
              {!gm && deleteCharacter && (
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
              )}
            </div>
          </header>
          {gm && (
            <GmNote name={character.name} rolls={view.gm?.rolls ?? 'off'} />
          )}
          {playing && view.campaign && !view.connected && (
            <NotConnected
              name={character.name}
              campaign={view.campaign.title}
              addBack={words.addBack}
            />
          )}
          {table}
        </div>
        <nav
          aria-label='Table'
          className='flex shrink-0 gap-1 border-t border-border bg-card px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:w-24 md:flex-col md:gap-2 md:border-t-0 md:border-l md:p-2.5 lg:hidden'
        >
          <TabButton
            icon={UserRound}
            label='Character'
            active={tab === 'character'}
            onClick={() => show('character')}
          >
            {asked.length > 0 && tab !== 'character' && (
              <span className='absolute top-2 right-[calc(50%-1.25rem)] size-2.5 rounded-full bg-primary ring-2 ring-card'>
                <span className='sr-only'>{words.asksForRoll}</span>
              </span>
            )}
          </TabButton>
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
                {badgeCount(unread)}
                <span className='sr-only'> unread</span>
              </span>
            )}
          </TabButton>
        </nav>
        {/* A party sheet, over the character's, never part of it. */}
        <PartyPanel
          group={party}
          api={partyApi(seat, character, party?.id)}
          pageHref={partyPage(seat, character, party?.id)}
          role={seat.role}
          ownSheetHref={gm ? undefined : `/characters/${character.id}`}
          // Taken into the character at this table, through this seat's own API (module 0.31.0).
          takeInto={
            character.actorId
              ? {
                  kind: 'own',
                  actorId: character.actorId,
                  name: character.name,
                  api: seat.api,
                }
              : undefined
          }
          onClose={() => setPartyOpen(undefined)}
        />
      </div>
    </TableApiContext>
  )
}

/** Is this the same group, as listed, as the one kept? */
function sameGroup(group: TableGroup, kept: TableGroup | undefined): boolean {
  return (
    group.id === kept?.id &&
    group.name === kept.name &&
    group.primary === kept.primary &&
    group.portrait === kept.portrait
  )
}

/**
 * Where a party sheet open at the table is read: through the player's character, or for the
 * Gamemaster's seat, through their campaign.
 */
function partyApi(seat: TableSeat, character: Character, group = ''): string {
  const id = encodeURIComponent(group)
  return seat.role === 'gm'
    ? `/api/campaigns/${encodeURIComponent(character.campaignId ?? '')}/party/${id}`
    : `/api/characters/${encodeURIComponent(character.id)}/party/${id}`
}

/** A party sheet's own page, as the player or the Gamemaster opens it. */
function partyPage(seat: TableSeat, character: Character, group = ''): string {
  const id = encodeURIComponent(group)
  return seat.role === 'gm'
    ? `/campaigns/${encodeURIComponent(character.campaignId ?? '')}/party/${id}`
    : `/characters/${encodeURIComponent(character.id)}/party/${id}`
}

/**
 * Whether a message counts toward the unread: for the player, any but their own rolls, and the
 * Gamemaster's rolls as their character all the same; for the Gamemaster at the sheet, any but
 * their own rolls there.
 */
function countsAsUnread(message: TableMessage, gm: boolean): boolean {
  if (gm) return message.byGm !== true
  return message.side !== 'me' || message.byGm === true
}

/**
 * Tells the Gamemaster at one of their campaign's characters' sheets (#156) where what they roll
 * there goes: made in their game as the character's, marked as theirs; kept here until their
 * module is new enough to mark it; or kept here while their game takes no rolls.
 */
function GmNote({ name, rolls }: Readonly<{ name: string; rolls: GmRolls }>) {
  const at = `You're at ${name}'s sheet as the Gamemaster.`
  let note = `${at} What you roll here is made in your game as ${name}'s, marked as yours.`
  if (rolls === 'update') {
    note = `${at} Your rolls stay here: update Sending Stone in Foundry to 0.23.0 to make them in your game as ${name}'s.`
  } else if (rolls === 'off') {
    note = `${at} Your rolls stay here while your game isn't taking rolls from Sending Stone.`
  }
  return (
    <p
      className={clsx(
        'shrink-0 border-b px-4 py-2.5 text-sm md:px-8',
        rolls === 'made'
          ? 'border-primary/30 bg-primary/5'
          : 'border-warning/40 bg-warning/10',
      )}
    >
      {note}
    </p>
  )
}

/** The character's sheet, combat or chat. Its classes say when it is shown. */
function Pane({
  id,
  label,
  className,
  children,
}: Readonly<{
  id: string
  label: string
  className: string
  children: ReactNode
}>) {
  return (
    <section
      id={id}
      aria-label={label}
      className={clsx('min-h-0 min-w-0 flex-1 flex-col', className)}
    >
      {children}
    </section>
  )
}

/** Choosing whether combat or the chat sits beside the sheet on a wide screen. */
function PaneTab({
  icon: Icon,
  label,
  pane,
  selected,
  onClick,
  children,
}: Readonly<{
  icon: LucideIcon
  label: string
  pane: string
  selected: boolean
  onClick: () => void
  /** What draws the eye to it, such as unread messages. */
  children?: ReactNode
}>) {
  return (
    <button
      type='button'
      role='tab'
      aria-selected={selected}
      aria-controls={pane}
      onClick={onClick}
      className={clsx(
        'relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold transition-colors',
        selected
          ? 'bg-primary/10 text-text-primary'
          : 'text-text-secondary hover:text-text-primary',
      )}
    >
      <Icon
        aria-hidden
        className={clsx('size-4', selected && 'text-primary')}
      />
      {label}
      {children}
    </button>
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
  addBack,
}: Readonly<{ name: string; campaign: string; addBack: string }>) {
  return (
    <p className='shrink-0 border-b border-warning/40 bg-warning/10 px-4 py-2.5 text-sm md:px-8'>
      {name} is no longer one of {campaign}&apos;s characters, so only public
      messages show here. {addBack}
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
        className='mt-6 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-text transition-colors hover:bg-primary/10'
      >
        Your characters
      </Link>
    </div>
  )
}

/**
 * For a character whose sheet hasn't arrived, as under a system other than dnd5e; or from module
 * 0.22.0, one the module held back for being larger than this app takes, which its Gamemaster has
 * been told.
 */
function NoSheet({
  name,
  withheld,
  told,
  coming,
}: Readonly<{
  name: string
  withheld?: TableView['sheetWithheld']
  /** Who was told it was held back. */
  told: string
  /** How a sheet comes. */
  coming: string
}>) {
  if (withheld?.reason === 'tooLarge') {
    const { bytes, limit } = withheld
    return (
      <EmptyState
        icon={UserRound}
        title={`${name}'s sheet is too large to send`}
      >
        {typeof bytes === 'number' &&
          typeof limit === 'number' &&
          `It came to ${megabytes(bytes, Math.ceil)}, more than the ${megabytes(limit, Math.floor)} this app takes. `}
        {told}
      </EmptyState>
    )
  }
  return (
    <EmptyState icon={UserRound} title={`${name}'s sheet hasn't arrived`}>
      {coming}
    </EmptyState>
  )
}

/** For a character in a campaign that has yet to choose which of its characters it is. */
function ChooseActor({
  choice,
  action,
}: Readonly<{
  choice: CampaignChoice
  action: NonNullable<Props['chooseActor']>
}>) {
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
  if (tab === 'character') return sheetSummary(view)
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

/** Such as "Fighter 5 · Champion", or the campaign's title until the sheet arrives. */
function sheetSummary(view: TableView): string {
  if (view.sheet) return classLine(view.sheet)
  return view.campaign?.title ?? 'No sheet yet'
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

/** An unread count as a badge shows it. */
function badgeCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}
