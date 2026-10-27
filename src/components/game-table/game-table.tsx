'use client'

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { DiceRendererProvider } from '@lambersond/3d-dice-react'
import clsx from 'clsx'
import {
  ArrowLeft,
  CookingPot,
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
import {
  newlyNotMade,
  refusalKey,
  TurnToast,
  TurnToastContext,
} from './turn-toast'
import { CharacterChooser } from '@/components/character-chooser'
import { DeleteCharacterWarning } from '@/components/character-list'
import { CharacterPane, classLine } from '@/components/character-sheet'
import { PartySheetList } from '@/components/character-sheet/party-sheets'
import { WildShapeEnded } from '@/components/character-sheet/wild-shape'
import { CompanionPane } from '@/components/companions/companion-pane'
import {
  CreatureSwitcher,
  type SwitcherCreature,
} from '@/components/companions/creature-switcher'
import {
  CONFIGURE_COOKBOOK,
  useCookbookEntry,
} from '@/components/cookbook-card'
import { ConfirmDialog } from '@/components/modal'
import { JournalCard, type NotesPlace } from '@/components/notes'
import { PartyPanel } from '@/components/party-sheet/party-panel'
import { Scroller } from '@/components/scroller'
import { useCreatureChoice } from '@/hooks/use-creature-choice'
import { useEndTurn } from '@/hooks/use-end-turn'
import { useHold } from '@/hooks/use-hold'
import { useMediaQuery } from '@/hooks/use-media-query'
import { TableApiContext } from '@/hooks/use-table-api'
import { POLL_INTERVAL, useTableView } from '@/hooks/use-table-view'
import { useTurnUndo } from '@/hooks/use-turn-undo'
import { useWaitingPrompts } from '@/hooks/use-waiting-prompts'
import {
  companionRow,
  numberedNames,
  type RowCompanion,
} from '@/utils/companion-row'
import {
  END_TURN_QUIET_CLICKS,
  holdDescription,
  turnKey,
} from '@/utils/end-turn'
import { megabytes } from '@/utils/format-amount'
import { gameHost } from '@/utils/game-host'
import { seatWords } from '@/utils/seat-words'
import { headerLineOf, switcherWords } from '@/utils/wild-shape-words'
import type { CampaignChoice, ChooseCharacterFormState } from '@/types/campaign'
import type { Character, TableSeat } from '@/types/character'
import type { CookbookCodeAnswer, CookbookPlace } from '@/types/cookbook'
import type { TableGroup } from '@/types/party'
import type { RollKind } from '@/types/roll'
import type {
  EndableTurn,
  GmRolls,
  TableCombat,
  TableCompanion,
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

/**
 * At most this many companions' panes stay mounted at once (module 0.36.0): the least recently
 * shown goes as another is chosen, unless it has damage to roll or a roll on its way.
 */
const MOST_PANES = 4

/** No keys, the same each time. */
const NO_KEYS: ReadonlySet<string> = new Set()

/** No rolls the game takes from here, the same each time. */
const NO_KINDS: readonly RollKind[] = []

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
  /**
   * Remembers whether the player types in their own dice for this character, on every device. A
   * player's page only.
   */
  setManualDice?: (on: boolean) => Promise<void>
  /**
   * Makes a link code for the Magical Recipe Book for this character, from module 0.38.0,
   * replacing any before it. A player's page only.
   */
  makeCookbookCode?: () => Promise<CookbookCodeAnswer>
  /** Revokes this character's link code for the Magical Recipe Book. A player's page only. */
  revokeCookbookCode?: () => Promise<void>
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
  setManualDice,
  makeCookbookCode,
  revokeCookbookCode,
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

  // Whether the player types in their own dice, as they chose on any device (module 0.32.0): the
  // player's change, until a view agrees with it; one that disagrees, coming a poll after the
  // save settled, is another device's later choice.
  const [diceChoice, setDiceChoice] = useState<{
    on: boolean
    settled?: number
  }>()
  const stored = view.manualDice?.on === true
  const typing = diceChoice?.on ?? stored
  useEffect(() => {
    const told = view.manualDice?.on === true
    setDiceChoice(held => {
      if (!held || held.on === told) return
      // A view polled before the save settled may still say what was stored before it.
      const later =
        held.settled !== undefined && Date.now() - held.settled > POLL_INTERVAL
      return later ? undefined : held
    })
  }, [view])
  const onManualDice = (next: boolean) => {
    if (!setManualDice) return
    const made = { on: next }
    setDiceChoice(made)
    setManualDice(next).then(
      () =>
        setDiceChoice(held =>
          held === made ? { ...made, settled: Date.now() } : held,
        ),
      // Not saved: the switch shows what's stored again.
      () => setDiceChoice(held => (held === made ? undefined : held)),
    )
  }

  const myTurn = isMyTurn(view.combat)
  // End Turn (module 0.36.0): the seat's turn, its character's or a companion's, ended from the
  // turn panel's button or the Combat tab held, with Undo in the toast that follows; wherever the
  // game takes it from here. A character no longer in its campaign's game ends no turn.
  const kinds = (view.connected && view.rollsToTable) || NO_KINDS
  const ending = useEndTurn({ api: seat.api, gm, combat: view.combat, kinds })
  const undoing = useTurnUndo({
    api: seat.api,
    gm,
    combat: view.combat,
    kinds,
    sent: ending.sent,
  })
  // How the last End Turn was sent, by the button or by a hold.
  const [via, setVia] = useState<'button' | 'hold'>()
  // Why the last End Turn wasn't made, which the turn panel says while it shows that turn: by
  // the turn and its way's reason, as a refusal by this app's own server has no id.
  const [refused, setRefused] = useState<{ turn: EndableTurn; key: string }>()
  const lastSent = useRef(ending.sent)
  useEffect(() => {
    const was = lastSent.current
    lastSent.current = ending.sent
    if (newlyNotMade(was, ending.sent)) {
      setRefused({ turn: ending.sent.turn, key: refusalKey(ending.sent.way) })
    }
  }, [ending.sent])
  const turnShown = ending.turn && turnKey(ending.turn)
  if (refused && turnShown !== turnKey(refused.turn)) setRefused(undefined)
  const endTurn = (turn: EndableTurn, how: 'button' | 'hold') => {
    setVia(how)
    setRefused(undefined)
    ending.end(turn)
  }
  // Whether a hold of the Combat tab is past half a second, which its toast says.
  const [held, setHeld] = useState(false)
  // Once a hold has ended the turn, the page's tabs ignore clicks for a moment, so that the click
  // that ends the press, wherever it lands, opens nothing.
  const quietUntil = useRef(0)
  const quiet = () => performance.now() < quietUntil.current
  const hold = useHold({
    key: ending.offered && ending.turn ? turnKey(ending.turn) : undefined,
    onToast: () => setHeld(true),
    onEnd: () => {
      quietUntil.current = performance.now() + END_TURN_QUIET_CLICKS
      setHeld(false)
      if (ending.turn) endTurn(ending.turn, 'hold')
    },
    onCancel: () => setHeld(false),
  })
  // The saves the game asks of the character, which its tab marks while they wait.
  const asked = useWaitingPrompts(view.connected ? view.prompts : undefined)

  // The character's companions (module 0.36.0), as the row of tabs above the sheet shows them:
  // those the module lists, and those it no longer lists, kept until the player has seen they've
  // gone; each name numbered where the row repeats it, each number kept while it does.
  const [companions, setCompanions] = useState(() =>
    nextRow(NO_ROW, view.companions, NO_KEYS),
  )
  // Those whose panes were told they're gone (404) while the page still listed them, as one that
  // leaves and comes back between two of the page's polls: mounted afresh as a later view lists
  // them, since a pane told so asks no more.
  const [lost, setLost] = useState<ReadonlySet<string>>(NO_KEYS)
  let shownRow = companions
  if (companions.listed !== view.companions) {
    shownRow = nextRow(companions, view.companions, companions.dismissed, lost)
    setCompanions(shownRow)
    if (lost.size > 0) setLost(NO_KEYS)
  }
  const { row, names, numbers, generations } = shownRow
  const rowKeys = row.map(({ key }) => key)
  const [chosen, chooseKept] = useCreatureChoice(seat.key, rowKeys)
  const goneKeys = new Set(row.flatMap(({ key, gone }) => (gone ? [key] : [])))
  // A gone companion's tab goes once it has been shown and another is chosen.
  const choose = (next: string) => {
    if (next !== chosen && goneKeys.has(chosen)) {
      setCompanions(held =>
        nextRow(held, held.listed, new Set(held.dismissed).add(chosen)),
      )
    }
    chooseKept(next)
  }
  // What each companion's pane says of itself: damage to roll, which its tab marks while it's
  // hidden, and a roll on its way, while the page must keep it.
  const [paneMarks, setPaneMarks] = useState<ReadonlyMap<string, PaneMarks>>(
    () => new Map(),
  )
  const [reporters] = useState(() => new Map<string, PaneReporters>())
  const reportersOf = (key: string): PaneReporters => {
    let held = reporters.get(key)
    if (!held) {
      held = {
        onPending: pending =>
          setPaneMarks(marks => withMark(marks, key, { pending })),
        onBusy: busy => setPaneMarks(marks => withMark(marks, key, { busy })),
        onLost: () =>
          setLost(keys => (keys.has(key) ? keys : new Set(keys).add(key))),
      }
      reporters.set(key, held)
    }
    return held
  }
  // The companions' panes mounted, most recently shown first: each as it's first chosen, kept as
  // others are, at most four, the least recently shown with nothing to roll or on its way going.
  // One whose tab has gone goes with it, and with it what it said of itself.
  const [mounted, setMounted] = useState<readonly string[]>([])
  let panes = mounted.filter(key => rowKeys.includes(key))
  if (chosen !== 'self' && panes[0] !== chosen) {
    panes = [chosen, ...panes.filter(key => key !== chosen)]
    while (panes.length > MOST_PANES) {
      const spare = panes.findLast(key => {
        const marks = paneMarks.get(key)
        return key !== chosen && !marks?.pending && !marks?.busy
      })
      if (spare === undefined) break
      panes = panes.filter(key => key !== spare)
    }
  }
  if (panes.join('|') !== mounted.join('|')) {
    setMounted(panes)
    if ([...paneMarks.keys()].some(key => !panes.includes(key))) {
      setPaneMarks(
        new Map([...paneMarks].filter(([key]) => panes.includes(key))),
      )
    }
  }

  // The header, which the sheet's roll toasts start below while its tabs aren't shown.
  // eslint-disable-next-line unicorn/no-null -- React sets a ref to null as it goes
  const [header, setHeader] = useState<HTMLElement | null>(null)
  // Where the turn's toast ends while one shows, which the roll toasts start below.
  const [toastFoot, setToastFoot] = useState<number>()

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
  // Whether the combat pane is shown: Combat chosen in one pane, or beside the sheet.
  const combatShown = sideBySide ? aside === 'combat' : tab === 'combat'
  // The Combat tab of each layout: the bottom bar's or rail's, and the column's.
  const barCombat = useRef<HTMLButtonElement>(null)
  const columnCombat = useRef<HTMLButtonElement>(null)
  // Focus, where the control under it goes, as Undo does: to the turn panel's heading where the
  // combat pane is shown, else to the Combat tab of the layout shown, never the page's body.
  const focusTurn = () => {
    const heading = document.querySelector<HTMLElement>('#turn-heading')
    if (combatShown && heading) {
      heading.focus({ preventScroll: true })
      return
    }
    const combatTab = sideBySide ? columnCombat : barCombat
    combatTab.current?.focus()
  }
  // The Combat tab held to end the turn, on the layout shown: its handlers on it always, which do
  // nothing with no turn to end; while one may be ended, its fill and what it's described as.
  const offeredTurn = ending.offered ? ending.turn : undefined
  const holdOf = (id: string, shown: boolean): TabHold => ({
    handlers: hold.handlers,
    holding: shown && hold.holding,
    touch: shown && (offeredTurn !== undefined || hold.pressed),
    offer:
      shown && offeredTurn
        ? { fill: hold.fill, id, description: holdDescription(offeredTurn) }
        : undefined,
  })
  // A companion's tab, from the turn panel's "its tab" (module 0.36.0): chosen, shown, focused.
  const openCompanion = (key: string) => {
    choose(key)
    show('character')
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`#${CSS.escape(`creature-tab-${key}`)}`)
        ?.focus(),
    )
  }

  const playing = view.campaign !== undefined && character.actorId !== null
  // The character's own journal notes (module 0.34.0), on the sheet's Biography tab, or under why
  // there's no sheet: polled while the Character pane is in view, as it is on a wide screen or as
  // its tab, and no party sheet is open over it. On one pane it stays mounted, hidden, behind
  // combat or the chat.
  const notes: NotesPlace = {
    api: seat.api,
    role: seat.role,
    name: character.name,
    active:
      (tab === 'character' || sideBySide) &&
      party === undefined &&
      chosen === 'self',
  }
  // The player's Magical Recipe Book (module 0.38.0): their own seat's alone, while their
  // character plays one of the campaign's, opened from the sheet's cog (round 0.39.0). The
  // Gamemaster's page passes neither action, so never offers it.
  const cookbook: CookbookPlace | undefined =
    seat.role === 'player' && playing && makeCookbookCode && revokeCookbookCode
      ? {
          characterId: character.id,
          make: makeCookbookCode,
          revoke: revokeCookbookCode,
        }
      : undefined
  // With no sheet yet, and so no cog, a button in its place under why there's none opens it.
  const noSheetCookbook = useCookbookEntry(view.sheet ? undefined : cookbook)
  let table: ReactNode
  // Whether the sheet's pane is beside the combat and chat column on a wide screen.
  let beside = false
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
    // The party sheets open from the sheet's Inventory tab, or, with no sheet, from under why
    // there's none: either way the Character pane shows on a wide screen too. So it does at a
    // character, with no sheet, for its notes there.
    const parties =
      view.groups && view.groups.length > 0 ? view.groups : undefined
    // From module 0.36.0, the character's companions, each with a tab above the sheet.
    const switching = row.length > 0
    const paneShown = hasSheet || parties !== undefined || playing || switching
    beside = paneShown
    // Whether its player types in their own dice, where the game lets them (module 0.32.0): never
    // on the Gamemaster's page, which has nowhere to remember it. Their companions' are the same.
    const diceSwitch =
      view.connected && view.manualDice?.offered && setManualDice
        ? { on: typing, onChange: onManualDice }
        : undefined
    const creatures: SwitcherCreature[] = [
      {
        key: 'self',
        name: character.name,
        portrait: view.sheet?.portrait,
        // What the character is transformed into, from module 0.40.0, as its name says it.
        ...(view.sheet?.form && { shape: switcherWords(view.sheet.form) }),
        news: [
          asked.length > 0 && words.asksForRoll,
          isTurnOf(view.combat, ({ side }) => side === 'me') && ', your turn',
        ]
          .filter(Boolean)
          .join(''),
      },
      ...row.map(
        ({ key, name, portrait, kind, from, gone }): SwitcherCreature => ({
          key,
          name,
          number: numbers.get(key),
          portrait,
          kind,
          from,
          gone,
          news: gone
            ? ''
            : [
                isTurnOf(
                  view.combat,
                  combatant => combatant.companion === key,
                ) && ', its turn',
                paneMarks.get(key)?.pending && ', damage to roll',
              ]
                .filter(Boolean)
                .join(''),
        }),
      ),
    ]
    const selfShown = chosen === 'self'
    // The character's own pane, and the companions' mounted, in the row's order; dice thrown on
    // one renderer for them all, which stays as companions come and go, so that the character's
    // pane keeps its tray and its damage to roll.
    const sheets = (
      <>
        {switching && (
          <CreatureSwitcher
            creatures={creatures}
            chosen={chosen}
            onChoose={choose}
            mounted={new Set(panes)}
            character={character.name}
            role={seat.role}
          />
        )}
        <div
          id='creature-panel-self'
          {...(switching && {
            role: 'tabpanel',
            'aria-labelledby': 'creature-tab-self',
          })}
          hidden={switching && !selfShown}
          className={clsx(
            'min-h-0 min-w-0 flex-1 flex-col',
            switching && !selfShown ? 'hidden' : 'flex',
          )}
        >
          {view.sheet ? (
            <CharacterPane
              shown={selfShown}
              sharedDice
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
              // Nor its items removed there (module 0.33.0), by either seat.
              removes={view.connected && view.removes === true}
              favorites={view.connected && view.favorites === true}
              // Its own effects turned off, on and deleted (module 0.39.0): the player's alone, at
              // the character's own pane, never a companion's.
              effects={view.effects}
              // Wild Shape from here (module 0.40.0): the player's alone, at the character's own
              // pane, never a companion's.
              wildShape={view.wildShape}
              actorId={character.actorId ?? undefined}
              // The party sheets it may open, on its Inventory tab (module 0.30.0).
              parties={
                view.groups && { groups: view.groups, onOpen: setPartyOpen }
              }
              manualDice={diceSwitch}
              notes={notes}
              cookbook={cookbook}
            />
          ) : (
            <Scroller>
              <NoSheet
                name={character.name}
                withheld={view.sheetWithheld}
                told={words.told}
                coming={words.noSheet}
              />
              {parties && (
                <div className='mx-auto w-full max-w-md px-4 pb-8'>
                  <PartySheetList groups={parties} onOpen={setPartyOpen} />
                </div>
              )}
              {/* The journal, which needs no sheet, nor Foundry. */}
              {playing && (
                <div className='mx-auto w-full max-w-2xl px-4 pb-8'>
                  <JournalCard kind='personal' look='sheet' {...notes} />
                </div>
              )}
              {/* The Magical Recipe Book, which needs no sheet either: offered as the cog offers it
                  (round 0.39.0). */}
              {cookbook && noSheetCookbook.shown && (
                <div className='mx-auto w-full max-w-2xl px-4 pb-8'>
                  <button
                    type='button'
                    aria-haspopup='dialog'
                    onClick={noSheetCookbook.open}
                    className='inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
                  >
                    <CookingPot aria-hidden className='size-4 shrink-0' />
                    {CONFIGURE_COOKBOOK}
                  </button>
                </div>
              )}
              {noSheetCookbook.modal}
            </Scroller>
          )}
        </div>
        {row
          .filter(({ key }) => panes.includes(key))
          .map(companion => (
            <CompanionPane
              // Mounted afresh when it comes back after it had gone, as its view stops for good.
              key={`${companion.key}:${generations.get(companion.key) ?? 0}`}
              seat={seat}
              companion={companion}
              name={names.get(companion.key) ?? companion.name}
              character={character.name}
              shown={chosen === companion.key}
              gone={companion.gone === true}
              {...reportersOf(companion.key)}
              header={header}
              manualDice={diceSwitch}
            />
          ))}
      </>
    )
    table = (
      <div className='flex min-h-0 flex-1'>
        {/* The sheet: a tab on a narrower screen, and the main column on a wide one. */}
        <Pane
          id='character-pane'
          label='Character'
          className={clsx(
            tab === 'character' ? 'flex' : 'hidden',
            paneShown ? 'lg:flex' : 'lg:hidden',
          )}
        >
          {/* The sheet's renderer, which every creature's pane throws its dice on. */}
          {hasSheet || switching ? (
            <DiceRendererProvider>{sheets}</DiceRendererProvider>
          ) : (
            sheets
          )}
        </Pane>
        {/* Combat and the chat: tabs on a narrower screen. On a wide one they share a narrow
            column beside the sheet, or beside why there's none and the notes. */}
        <div
          className={clsx(
            'min-h-0 min-w-0 flex-1 flex-col lg:flex',
            tab === 'character' ? 'hidden' : 'flex',
            paneShown &&
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
                ref={columnCombat}
                icon={Swords}
                label='Combat'
                pane='combat-pane'
                selected={aside === 'combat'}
                onClick={() => {
                  if (!quiet()) show('combat')
                }}
                hold={holdOf('combat-hold-pane', sideBySide)}
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
                  if (!quiet()) show('chat')
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
              {/* The character's view of it, whichever creature is chosen (module 0.36.0). */}
              <CombatTracker
                combat={view.combat}
                onOpen={openCompanion}
                keys={new Set(rowKeys)}
                ending={ending}
                via={via}
                refused={refused}
                onEnd={turn => endTurn(turn, 'button')}
                focusTurn={focusTurn}
              />
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
                // Back to the campaign it was opened from, chosen on the campaigns page (round
                // 0.39.0).
                href={
                  gm
                    ? `/campaigns?campaign=${encodeURIComponent(character.campaignId ?? '')}`
                    : '/characters'
                }
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
                      {headerLine(view.sheet)}
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
          {/* The game ended a Wild Shape (module 0.40.0): why, until dismissed. */}
          {playing && (
            <WildShapeEnded
              sheet={view.sheet}
              name={character.name}
              seat={seat.key}
            />
          )}
          <TurnToastContext value={toastFoot}>{table}</TurnToastContext>
        </div>
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
              setRefused(undefined)
              show('character')
            }}
          >
            {asked.length > 0 && tab !== 'character' && (
              <span className='absolute top-2 right-[calc(50%-1.25rem)] size-2.5 rounded-full bg-primary ring-2 ring-card'>
                <span className='sr-only'>{words.asksForRoll}</span>
              </span>
            )}
          </TabButton>
          <TabButton
            ref={barCombat}
            icon={Swords}
            label='Combat'
            active={tab === 'combat'}
            onClick={() => {
              if (quiet()) return
              setRefused(undefined)
              show('combat')
            }}
            hold={holdOf('combat-hold-bar', !sideBySide)}
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
              setRefused(undefined)
              show('chat')
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
        {/* A party sheet, over the character's, never part of it. */}
        <PartyPanel
          group={party}
          api={partyApi(seat, character, party?.id)}
          pageHref={partyPage(seat, character, party?.id)}
          role={seat.role}
          ownSheetHref={gm ? undefined : `/characters/${character.id}`}
          // Taken into the character at this table, through this seat's own API (module 0.31.0).
          // Never while the character is transformed, as by Wild Shape (module 0.40.0), its gear
          // not on its form.
          takeInto={
            character.actorId && !view.sheet?.form
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
        {/* End Turn's toast, with Undo (module 0.36.0): there, empty, from the start. */}
        <TurnToast
          ending={ending}
          undoing={undoing}
          via={via}
          held={held}
          combatShown={combatShown}
          focusTurn={focusTurn}
          combat={view.combat}
          header={header}
          beside={beside}
          onFoot={setToastFoot}
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

/**
 * The Combat tab held to end the turn (module 0.36.0): the hold's handlers, on it always; whether
 * a press is held, and whether the tab takes a held touch; and while a turn may be ended, its
 * fill and what it's described as, by the id of the words that say so.
 */
type TabHold = {
  handlers: ReturnType<typeof useHold>['handlers']
  holding: boolean
  touch: boolean
  offer?: {
    fill: RefObject<HTMLSpanElement | null>
    id: string
    description: string
  }
}

/** What a tab held to end the turn takes on its button: its handlers, classes and description. */
function holdProps(hold?: TabHold) {
  return {
    ...hold?.handlers,
    'aria-describedby': hold?.offer?.id,
    className: clsx(
      // A held touch neither selects the label nor opens iOS's callout, and the fill keeps inside.
      hold?.touch &&
        'touch-manipulation overflow-hidden select-none [-webkit-touch-callout:none]',
    ),
  }
}

/**
 * The fill of a tab held to end the turn, from the left, and its description: hidden words, so
 * that they describe the tab without being its name. The hook draws the fill each frame.
 */
function HoldFill({ hold }: Readonly<{ hold?: TabHold }>) {
  if (!hold?.offer) return
  return (
    <span
      ref={hold.offer.fill}
      aria-hidden
      className='pointer-events-none absolute inset-0 origin-left rounded-[inherit] bg-primary/22'
      style={{ transform: 'scaleX(0)' }}
    />
  )
}

function HoldDescription({ hold }: Readonly<{ hold?: TabHold }>) {
  if (!hold?.offer) return
  return (
    <span id={hold.offer.id} hidden>
      {hold.offer.description}
    </span>
  )
}

/** Choosing whether combat or the chat sits beside the sheet on a wide screen. */
function PaneTab({
  icon: Icon,
  label,
  pane,
  selected,
  onClick,
  hold,
  ref,
  children,
}: Readonly<{
  icon: LucideIcon
  label: string
  pane: string
  selected: boolean
  onClick: () => void
  /** From module 0.36.0, the Combat tab held to end the turn. */
  hold?: TabHold
  ref?: RefObject<HTMLButtonElement | null>
  /** What draws the eye to it, such as unread messages. */
  children?: ReactNode
}>) {
  const { className, ...holding } = holdProps(hold)
  return (
    <button
      ref={ref}
      type='button'
      role='tab'
      aria-selected={selected}
      aria-controls={pane}
      onClick={onClick}
      {...holding}
      className={clsx(
        'relative inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold transition-colors',
        selected || hold?.holding
          ? 'text-text-primary'
          : 'text-text-secondary hover:text-text-primary',
        selected && 'bg-primary/10',
        className,
      )}
    >
      <HoldFill hold={hold} />
      <Icon
        aria-hidden
        className={clsx('relative size-4', selected && 'text-primary')}
      />
      <span className='relative'>{label}</span>
      {children}
      <HoldDescription hold={hold} />
    </button>
  )
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
  hold,
  ref,
  children,
}: Readonly<{
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
  /** From module 0.36.0, the Combat tab held to end the turn. */
  hold?: TabHold
  ref?: RefObject<HTMLButtonElement | null>
  children?: ReactNode
}>) {
  const { className, ...holding } = holdProps(hold)
  return (
    <button
      ref={ref}
      type='button'
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      {...holding}
      className={clsx(
        'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors md:min-h-18 md:w-full md:flex-none',
        active || hold?.holding
          ? 'text-text-primary'
          : 'text-text-secondary hover:text-text-primary',
        active && 'bg-primary/10',
        className,
      )}
    >
      <HoldFill hold={hold} />
      <Icon
        aria-hidden
        className={clsx('relative size-6', active && 'text-primary')}
      />
      <span className='relative'>{label}</span>
      {children}
      <HoldDescription hold={hold} />
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

/**
 * Whether it's the player's turn: their character's, or from module 0.36.0 one of its companions',
 * as the combat names it. Not a gone companion's, which no longer has its key.
 */
function isMyTurn(combat?: TableCombat): boolean {
  return isTurnOf(
    combat,
    ({ side, yours, companion }) =>
      side === 'me' || (yours === true && companion !== undefined),
  )
}

/** Whether the combat has started and its current combatant is one that `is` picks. */
function isTurnOf(
  combat: TableCombat | undefined,
  is: (combatant: TableCombat['combatants'][number]) => boolean,
): boolean {
  return (
    combat?.started === true &&
    combat.combatants.some(
      combatant => combatant.id === combat.currentId && is(combatant),
    )
  )
}

/**
 * The row of companions as the page keeps it (module 0.36.0): as last listed, which it was worked
 * out from; the gone ones whose tabs have been left; the row; each one's name and number where
 * the row repeats a name; and how many times each has come back after it had gone, which its pane
 * is mounted afresh for.
 */
type RowState = {
  listed?: TableCompanion[]
  dismissed: ReadonlySet<string>
  row: RowCompanion[]
  names: ReadonlyMap<string, string>
  numbers: ReadonlyMap<string, number>
  generations: ReadonlyMap<string, number>
}

/** The row before any companion's been listed. */
const NO_ROW: RowState = {
  dismissed: NO_KEYS,
  row: [],
  names: new Map(),
  numbers: new Map(),
  generations: new Map(),
}

/**
 * The row as it is now, from the row as it was: the companions listed now and those gone, kept
 * until dismissed, as `companionRow` keeps them. One listed again is no longer dismissed, and if
 * it had gone, or its pane was told it had, its pane is mounted afresh. Names are numbered as
 * `numberedNames` numbers them, the numbers given before kept.
 * @param listed - The companions the module lists now.
 * @param dismissed - The gone ones whose tabs have been shown and left.
 * @param lost - Those whose panes were told they're gone while the row still listed them.
 */
function nextRow(
  held: RowState,
  listed: TableCompanion[] | undefined,
  dismissed: ReadonlySet<string>,
  lost: ReadonlySet<string> = NO_KEYS,
): RowState {
  const keys = new Set((listed ?? []).map(({ key }) => key))
  const left = [...dismissed].some(key => keys.has(key))
    ? new Set([...dismissed].filter(key => !keys.has(key)))
    : dismissed
  const row = companionRow(held.row, listed ?? [], left)
  let generations = held.generations
  for (const { key, gone } of held.row) {
    if ((gone || lost.has(key)) && keys.has(key)) {
      generations = new Map(generations).set(
        key,
        (generations.get(key) ?? 0) + 1,
      )
    }
  }
  const { names, kept } = numberedNames(row, held.numbers)
  return { listed, dismissed: left, row, names, numbers: kept, generations }
}

/** What a companion's pane says of itself: damage to roll, and a roll on its way. */
type PaneMarks = { pending?: boolean; busy?: boolean }

/**
 * How a companion's pane tells the page so, and that its route said it's gone, the same each time
 * for its key.
 */
type PaneReporters = {
  onPending: (pending: boolean) => void
  onBusy: (busy: boolean) => void
  onLost: () => void
}

/** A pane's marks, with one changed: the same map where it's unchanged. */
function withMark(
  marks: ReadonlyMap<string, PaneMarks>,
  key: string,
  change: PaneMarks,
): ReadonlyMap<string, PaneMarks> {
  const held = marks.get(key) ?? {}
  const next = { ...held, ...change }
  if (next.pending === held.pending && next.busy === held.busy) return marks
  return new Map(marks).set(key, next)
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
  if (view.sheet) return headerLine(view.sheet)
  return view.campaign?.title ?? 'No sheet yet'
}

/**
 * The header's line about the character: its classes, or from module 0.40.0, while it's
 * transformed, what into, "In Wild Shape · Wolf".
 */
function headerLine(sheet: NonNullable<TableView['sheet']>): string {
  return sheet.form ? headerLineOf(sheet.form) : classLine(sheet)
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
