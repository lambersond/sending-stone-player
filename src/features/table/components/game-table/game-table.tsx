'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { DiceRendererProvider } from '@lambersond/3d-dice-react'
import clsx from 'clsx'
import { AsideColumn } from '../aside-column/aside-column'
import { ChooseActor } from '../choose-actor/choose-actor'
import { CombatTracker } from '../combat-tracker/combat-tracker'
import { CreatureSheets } from '../creature-sheets/creature-sheets'
import { NoCampaign } from '../no-campaign/no-campaign'
import { Pane } from '../pane/pane'
import { TableHeader } from '../table-header/table-header'
import { TableNav } from '../table-nav/table-nav'
import { TableNotices } from '../table-notices/table-notices'
import { TablePartyPanel } from '../table-party-panel/table-party-panel'
import { TurnToast } from '../turn-toast/turn-toast'
import {
  cookbookPlace,
  rollsInGame,
  seatOf,
  sheetPane,
  shownPanels,
} from './utils'
import { Scroller } from '@/components/scroller/scroller'
import { useCookbookEntry } from '@/features/cookbook/hooks/use-cookbook-entry'
import { DiceTray } from '@/features/rolling/components/dice-tray/dice-tray'
import { useChatRead } from '@/features/table/hooks/use-chat-read'
import { useChatScroll } from '@/features/table/hooks/use-chat-scroll'
import { useCompanionRow } from '@/features/table/hooks/use-companion-row'
import { usePartyOpen } from '@/features/table/hooks/use-party-open'
import { useTableTabs } from '@/features/table/hooks/use-table-tabs'
import { useTableView } from '@/features/table/hooks/use-table-view'
import { useTurnEnding } from '@/features/table/hooks/use-turn-ending'
import { useTypedDice } from '@/features/table/hooks/use-typed-dice'
import { isMyTurn } from '@/features/table/utils/combat'
import { pageConnection } from '@/features/table/utils/header'
import { TableApiContext } from '@/hooks/use-table-api'
import { TurnToastContext } from '@/hooks/use-turn-toast-foot'
import { useStillWaiting, useWaitingPrompts } from '@/hooks/use-waiting-prompts'
import { seatWords } from '@/utils/seat-words'
import type { NotesPlace } from '@/features/notes/types'
import type { GameTableProps, Tab } from '@/features/table/types'
import type { TableSeat } from '@/types/character'

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
}: Readonly<GameTableProps>) {
  const { role, api, key } = seatOf(given, character.id)
  const seat = useMemo<TableSeat>(() => ({ role, api, key }), [role, api, key])
  const gm = seat.role === 'gm'
  const words = seatWords(seat.role)
  const { view, connection } = useTableView(seat.api, initialView)
  const tabs = useTableTabs(initialView.combat?.started === true)
  const { party, setPartyOpen } = usePartyOpen(view.groups)
  const unread = useChatRead({
    gm,
    initialView,
    view,
    chatInView: tabs.chatInView,
    markChatRead,
  })
  const diceSwitch = useTypedDice(view, setManualDice)
  const myTurn = isMyTurn(view.combat)
  const turn = useTurnEnding({
    api: seat.api,
    gm,
    view,
    sideBySide: tabs.sideBySide,
    combatShown: tabs.combatShown,
  })
  // The saves the game asks of the character, and from module 0.44.0 the dice it asks its player
  // for, which its tab marks while they wait: an ask on the sheet's banner, out of sight behind
  // Chat or Combat, rolled by the game once its minute is up.
  const asked = useWaitingPrompts(view.connected ? view.prompts : undefined)
  const diceAsked = useStillWaiting(view.connected ? view.diceAsks : undefined)
  const asking = asked.length > 0 || diceAsked.length > 0
  const companions = useCompanionRow({
    view,
    seatKey: seat.key,
    show: tabs.show,
  })
  // The header, which the sheet's roll toasts start below while its tabs aren't shown.
  const [header, setHeader] = useState<HTMLElement | null>(null)
  // Where the turn's toast ends while one shows, which the roll toasts start below.
  const [toastFoot, setToastFoot] = useState<number>()
  const chat = useChatScroll(tabs.chatInView, view.messages)
  const show = (next: Tab) => {
    chat.pinFor(next)
    tabs.show(next)
  }

  const playing = view.campaign !== undefined && character.actorId !== null
  // The panel shown under the notices, where focus goes as one is dismissed.
  const panels = shownPanels(tabs.characterInView, tabs.tab, companions.chosen)
  // The character's own journal notes (module 0.34.0), on the sheet's Biography tab, or under why
  // there's no sheet: polled while the Character pane is in view, as it is on a wide screen or as
  // its tab, and no party sheet is open over it. On one pane it stays mounted, hidden, behind
  // combat or the chat.
  const notes: NotesPlace = {
    api: seat.api,
    role: seat.role,
    name: character.name,
    active:
      tabs.characterInView &&
      party === undefined &&
      companions.chosen === 'self',
  }
  const cookbook = cookbookPlace(
    seat,
    character,
    playing,
    makeCookbookCode,
    revokeCookbookCode,
  )
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
    // From module 0.36.0, the character's companions, each with a tab above the sheet.
    const switching = companions.row.length > 0
    const { parties, paneShown } = sheetPane(view, playing, switching)
    beside = paneShown
    // The character's own pane, and the companions' mounted, in the row's order.
    const sheets = (
      <CreatureSheets
        character={character}
        seat={seat}
        view={view}
        companions={companions}
        words={words}
        asking={asking}
        header={header}
        diceSwitch={diceSwitch}
        notes={notes}
        cookbook={cookbook}
        entry={noSheetCookbook}
        parties={parties}
        onOpenParty={setPartyOpen}
        playing={playing}
      />
    )
    // The page's one renderer (v0.44), whose canvas lies over the whole viewport: every creature's
    // pane throws its dice on it, and so does the chat's dice tray, so that the dice tumble over
    // whichever is shown. It stays as companions come and go, so that the character's pane keeps
    // its tray and its damage to roll.
    table = (
      <DiceRendererProvider>
        <div className='flex min-h-0 flex-1'>
          {/* The sheet: a tab on a narrower screen, and the main column on a wide one. */}
          <Pane
            id='character-pane'
            label='Character'
            className={clsx(
              tabs.tab === 'character' ? 'flex' : 'hidden',
              paneShown ? 'lg:flex' : 'lg:hidden',
            )}
          >
            {sheets}
          </Pane>
          <AsideColumn
            tab={tabs.tab}
            aside={tabs.aside}
            paneShown={paneShown}
            focusable={!tabs.characterInView}
            myTurn={myTurn}
            unread={unread}
            combat={view.combat}
            messages={view.messages}
            chatClearedAt={view.chatClearedAt}
            quiet={turn.quiet}
            onShow={show}
            combatTab={turn.columnCombat}
            hold={turn.holdOf('combat-hold-pane', tabs.sideBySide)}
            tracker={
              <CombatTracker
                combat={view.combat}
                onOpen={companions.openCompanion}
                keys={new Set(companions.rowKeys)}
                ending={turn.ending}
                via={turn.via}
                refused={turn.refused}
                onEnd={endable => turn.endTurn(endable, 'button')}
                focusTurn={turn.focusTurn}
              />
            }
            chat={chat}
            // The dice tray under the chat (v0.44), while the character plays in the game: always
            // the character's, whichever creature the sheet shows, as the game takes its rolls.
            dice={
              playing && (
                <DiceTray
                  characterId={seat.key}
                  {...rollsInGame(view)}
                  typing={diceSwitch?.on === true}
                />
              )
            }
          />
        </div>
      </DiceRendererProvider>
    )
  }

  return (
    // A character's page has no app bar, so the game table fills the viewport. What reads and rolls
    // through the seat's API below, the sheet's descriptions and rolls among it, finds it here.
    <TableApiContext value={seat}>
      <div className='flex h-dvh flex-col md:flex-row'>
        <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
          <TableHeader
            ref={setHeader}
            character={character}
            gm={gm}
            playing={playing}
            view={view}
            tab={tabs.tab}
            connection={pageConnection(connection, companions.reconnecting)}
            deleteCharacter={deleteCharacter}
          />
          <TableNotices
            gm={gm}
            playing={playing}
            view={view}
            character={character}
            seatKey={seat.key}
            addBack={words.addBack}
            panels={panels}
          />
          <TurnToastContext value={toastFoot}>{table}</TurnToastContext>
        </div>
        <TableNav
          tab={tabs.tab}
          asking={asking || companions.waitingKeys.size > 0}
          asksForRoll={words.asksForRoll}
          myTurn={myTurn}
          unread={unread}
          quiet={turn.quiet}
          onShow={show}
          combatTab={turn.barCombat}
          hold={turn.holdOf('combat-hold-bar', !tabs.sideBySide)}
        />
        {/* A party sheet, over the character's, never part of it. */}
        <TablePartyPanel
          seat={seat}
          character={character}
          sheet={view.sheet}
          group={party}
          onClose={() => setPartyOpen(undefined)}
        />
        {/* End Turn's toast, with Undo (module 0.36.0): there, empty, from the start. */}
        <TurnToast
          ending={turn.ending}
          undoing={turn.undoing}
          via={turn.via}
          held={turn.held}
          combatShown={tabs.combatShown}
          focusTurn={turn.focusTurn}
          combat={view.combat}
          header={header}
          beside={beside}
          onFoot={setToastFoot}
        />
      </div>
    </TableApiContext>
  )
}
