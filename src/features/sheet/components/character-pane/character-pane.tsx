'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useConditionsPanel } from '../conditions/use-conditions-panel'
import { rulesOf } from '../conditions/utils'
import { DiceAskBanner } from '../dice-ask-banner/dice-ask-banner'
import { useEffectControls } from '../effect-controls/use-effect-controls'
import { FavoritesStrip } from '../favorites/favorites'
import { FavoritesColumn } from '../favorites/favorites-column'
import { useFavorites } from '../favoriting/use-favorites'
import { usePreparing } from '../preparing/use-preparing'
import { PromptBanner } from '../prompt-banner/prompt-banner'
import { ALONE_SPEND_KEY } from '../use-picker/constants'
import { UsePicker } from '../use-picker/use-picker'
import { useWildShape } from '../wild-shape/use-wild-shape'
import { WildShapeRibbon } from '../wild-shape/wild-shape'
import { linkActions } from './link-actions'
import { PaneContext } from './pane-context'
import { rollActions } from './roll-actions'
import { SheetContext } from './sheet-context'
import { SheetPanel } from './sheet-panel'
import { SheetTabs } from './sheet-tabs'
import { useDueDamage } from './use-due-damage'
import { useFavoritesLayout } from './use-favorites-layout'
import { useGiveRemove } from './use-give-remove'
import { usePaneCommands } from './use-pane-commands'
import { usePaneLock } from './use-pane-lock'
import { usePaneStatus } from './use-pane-status'
import { usePicking } from './use-picking'
import { usePromptAnswers } from './use-prompt-answers'
import { useSheetTabs } from './use-sheet-tabs'
import { useTrayTriggers } from './use-tray-triggers'
import { useTypedRolls } from './use-typed-rolls'
import { paneOffers, paneSettings, showsRolls } from './utils'
import { useCookbookEntry } from '@/features/cookbook/hooks/use-cookbook-entry'
import { useDiceEntry } from '@/features/rolling/components/dice-entry/use-dice-entry'
import { RollToasts } from '@/features/rolling/components/roll-toasts/roll-toasts'
import { RollTray } from '@/features/rolling/components/roll-tray/roll-tray'
import { useDiceAsks } from '@/features/rolling/hooks/use-dice-asks'
import { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import { useToastSetting } from '@/features/rolling/hooks/use-toast-setting'
import { useSpentOffers } from '@/features/sheet/hooks/use-spent-offers'
import { useWidth } from '@/features/sheet/hooks/use-width'
import { belongingsOf } from '@/features/sheet/utils/enchantments'
import { useTableRole } from '@/hooks/use-table-api'
import { castIndex } from '@/utils/casts'
import { favoriteEntries, favoriteKeys } from '@/utils/favorites'
import type { CharacterPaneProps } from './types'
import type { TableRolls } from '@/features/rolling/types'

/**
 * The character's sheet, rolling 3D dice across the screen, or a companion's (module 0.36.0). Its
 * dice are thrown on its page's one renderer, which a DiceRendererProvider above it gives: every
 * pane on the page throws on it, and so does the chat's dice tray (v0.44), so the dice land over
 * whichever is shown.
 */
export function CharacterPane({
  characterId,
  name,
  sheet,
  combat,
  rollsToTable,
  rollFeatures,
  prompts,
  diceAsks,
  gmRolls,
  header,
  moves,
  removes,
  favorites: favoritesOn,
  effects: effectsOn,
  wildShape: wildShapeOn,
  hitPoints: hitPointsOn,
  actorId,
  parties,
  manualDice,
  notes,
  cookbook,
  creature,
  shown: paneShown = true,
  onPending,
  onBusy,
  follows,
  locked = false,
  idPrefix = '',
  note,
  companionNotice,
}: Readonly<CharacterPaneProps>) {
  const table = useTableRolls(characterId, rollsToTable, rollFeatures)
  // Whether its rolls are locked now, as a gone companion's are (module 0.36.0), for what was
  // opened before it went, such as a description's menu, to roll nothing after.
  const { lockedNow, unlessLocked } = usePaneLock(locked)
  // While the player types in what their own dice show, each roll asks for them, in place of the
  // app's dice.
  const typing = manualDice?.on === true
  const entry = useDiceEntry()
  const role = useTableRole()
  const { waiting, answering } = usePromptAnswers(prompts)
  const triggers = useTrayTriggers()
  const { roller, spent } = useTypedRolls({
    table,
    sheet,
    prompts,
    typing,
    entry,
  })
  const { rolls, rolling } = roller
  // The dice the game asks for later in the player's typed rolls' runs, from module 0.45.0: their
  // dialog at once on the device that sent the roll, else a banner.
  const diceAsking = useDiceAsks({
    asks: diceAsks,
    states: table.states,
    sending: table.sending,
    enter: entry.enter,
    logAnswer: roller.logDiceAnswer,
    sendAnswer: table.sendDiceAnswer,
  })
  // While the character is transformed, as by Wild Shape (module 0.40.0), what its form's sheet
  // can't keep, or its gear isn't on, isn't offered: favorites added or removed, effects changed,
  // and its items given, removed or taken into it.
  const shaped = sheet.form !== undefined
  const { giving, removing, transfers } = useGiveRemove({
    moves,
    removes,
    shaped,
    sheet,
    table,
    role,
    name,
    actorId,
    logMove: roller.logMove,
    setActed: triggers.setActed,
  })
  const shown = usePaneStatus({
    rolls,
    table,
    gmRolls,
    combat,
    onPending,
    onBusy,
  })
  // Whether the rolls pop up as toasts, with the rest a button away, or stay in the banner: one or
  // the other, never both.
  const [toasting, setToasting] = useToastSetting()
  const conditions = useConditionsPanel(sheet.conditions)
  // The player's Magical Recipe Book, from the cog (round 0.39.0): read as the pane mounts and as
  // the cog opens, offered while the game takes dishes or the character has a link.
  const cookbookPlace = creature ? undefined : cookbook
  const cookbookEntry = useCookbookEntry(cookbookPlace)
  const entries = useMemo(() => favoriteEntries(sheet), [sheet])
  // How each spell an item casts is cast, and at which levels it may be.
  const itemCasts = useMemo(() => castIndex(sheet), [sheet])
  const picking = usePicking({
    locked,
    lockedNow,
    table,
    roller,
    sheet,
    entries,
    itemCasts,
    combat,
  })
  const { tab, tabs, show, scroller } = useSheetTabs({ sheet, creature, notes })
  const body = useRef<HTMLDivElement>(null)
  // The row of tabs, and the game's prompts beneath it while it asks any, which the rolls' toasts
  // start below, so as not to cover the prompts' only buttons.
  const [tabRow, setTabRow] = useState<HTMLDivElement | null>(null)
  const [promptBanner, setPromptBanner] = useState<HTMLElement | null>(null)
  // And the dice the game asks for beneath them, from module 0.45.0, which the toasts start below.
  const [diceBanner, setDiceBanner] = useState<HTMLElement | null>(null)
  const width = useWidth(body)
  // What the character has that an enchantment may be put on.
  const belongings = useMemo(() => belongingsOf(sheet), [sheet])
  const offers = paneOffers({
    favorites: favoritesOn,
    prepares: table.lists('prepare'),
    effects: effectsOn,
    wildShape: wildShapeOn,
    hitPoints: hitPointsOn,
    creature,
    role,
    shaped,
  })
  const commands = usePaneCommands({
    table,
    roller,
    sheet,
    shaped,
    belongings,
    hitPoints: offers.hitPoints,
    setActed: triggers.setActed,
  })
  // Favorites added and removed from a row's menu, from module 0.37.0: never at a creature's pane,
  // whose NPC has none.
  const favoriting = useFavorites({
    on: offers.favorites,
    favorites: sheet.favorites,
    entries,
    states: table.states,
    send: commands.favoriteOf,
  })
  // The character's spells prepared and unprepared from a row's menu, from module 0.42.1, where the
  // game takes it, whatever this device's Send to the table, as it has no version made here: the
  // player's alone, at the character's own pane, never while transformed, whose spells are the
  // form's.
  const preparing = usePreparing({
    on: offers.prepare,
    spells: sheet.spells,
    states: table.states,
    send: commands.prepareOf,
  })
  // The character's own effects turned off, on and deleted, from module 0.39.0, where the campaign
  // lets its player: never at a creature's pane, nor the Gamemaster's page.
  const effecting = useEffectControls({
    on: offers.effects,
    character: name,
    effects: sheet.effects,
    states: table.states,
    send: commands.effectOf,
  })
  // From module 0.42.1, the effects the dice offered that the player added spent, such as Bardic
  // Inspiration's Inspired: never offered again, and once their rolls are made, removed where the
  // controls above may remove them.
  useSpentOffers({ spent, rolls, states: table.states, effecting })
  // Wild Shape from here, from module 0.40.0, the player's alone, at the character's own pane; the
  // Beasts to learn are read apart.
  const panelOf = useCallback(
    () =>
      document.querySelector<HTMLElement>(
        `#${CSS.escape(`${idPrefix}sheet-panel`)}`,
      ),
    [idPrefix],
  )
  const wildShaping = useWildShape({
    on: offers.wildShape,
    pane: !creature,
    role,
    name,
    sheet,
    characterId,
    effects: effectsOn === true,
    states: table.states,
    send: commands.wildShapeOf,
    read: table.readWildShapeForms,
    panel: panelOf,
  })
  const { rollDue, onRollDamage } = useDueDamage({
    table,
    rollDamage: roller.rollDamage,
    unlessLocked,
    lockedNow,
    typing,
    paneShown,
  })
  // What the tabs and the favorites roll and use, once for all of them.
  const actions = rollActions({
    table,
    roller,
    picking,
    unlessLocked,
    rollDue,
    onRollDamage,
    sheet,
    entries,
    combat,
  })
  // The features resources stand for are marked as favorites too, as their entries say.
  const marks = useMemo(
    () => favoriteKeys(sheet.favorites, entries),
    [sheet.favorites, entries],
  )
  const { showsFavorites, beside, actionsLayout, characterFavorites } =
    useFavoritesLayout(tab, entries, width)
  const favorites = { characterId, sheet, entries, ...actions }
  // The rolls' way to the game, and their damage to roll, as the banner, the toasts and the rolls'
  // button all offer it.
  const trayTable: TableRolls = {
    ...table,
    states: shown.states,
    rollDamage: rollDue,
  }
  // What the links in descriptions do, on every tab, favorite and dialog: each roll they make,
  // and the table asked, shows in the tray, whichever tab it's on.
  const descriptions = linkActions({
    table,
    roller,
    onRoll: actions.onRoll,
    sheet,
    role,
    rollsToTable,
    setDescribed: triggers.setDescribed,
    unlessLocked,
    command: commands.command,
    showConditions: conditions.show,
  })
  // A condition's chip opens its rules, where the app has them; else its place in Effects.
  const showCondition = (id: string) => {
    if (rulesOf(id)) conditions.show(id)
    else show('effects')
  }
  // What the game asks of the character, above every tab, while the game takes the answer; and
  // from module 0.41.0 which of their companions it asks, said under its heading.
  const asked = (waiting.length > 0 && table.available) || companionNotice

  return (
    <PaneContext creature={creature} locked={locked} idPrefix={idPrefix}>
      <SheetContext
        marks={marks}
        favoriting={favoriting}
        preparing={preparing}
        effecting={effecting}
        wildShaping={wildShaping}
        showConditions={conditions.show}
        descriptions={descriptions}
        enchanting={commands.enchanting}
        concentrating={commands.concentrating}
        charging={commands.charging}
      >
        {/* What the character is transformed into, above the tabs, on every tab (module
            0.40.0). */}
        <WildShapeRibbon />
        <SheetTabs
          rowRef={setTabRow}
          tabs={tabs}
          tab={tab}
          idPrefix={idPrefix}
          conditions={sheet.conditions.length}
          onShow={show}
          rolls={
            toasting
              ? { rolls: shown.rolls, rolling, table: trayTable }
              : undefined
          }
          settings={paneSettings({
            table,
            manualDice,
            toasts: { on: toasting, onChange: setToasting },
            characterFavorites,
            hasFavorites: entries.length > 0,
            actionsLayout,
            hasActions: sheet.actions.length > 0,
            cookbookOn: !!cookbookPlace,
            cookbookEntry,
          })}
          cookbookModal={cookbookEntry.modal}
        />
        {note}
        {asked && (
          <PromptBanner
            ref={setPromptBanner}
            prompts={table.available ? waiting : []}
            notice={companionNotice}
            sheet={sheet}
            answering={table.answering}
            sending={table.sending}
            onSend={() => table.setSending(true)}
            onRoll={request => {
              triggers.setPrompted(true)
              actions.onRoll(answering(request))
            }}
          />
        )}
        {diceAsking.offered.length > 0 && (
          <DiceAskBanner
            ref={setDiceBanner}
            asks={diceAsking.offered}
            onTypeIn={diceAsking.typeIn}
            onLeave={diceAsking.leave}
          />
        )}
        <SheetPanel
          bodyRef={body}
          scrollerRef={scroller}
          column={beside && <FavoritesColumn {...favorites} />}
          strip={
            showsFavorites && !beside ? (
              <FavoritesStrip {...favorites} />
            ) : undefined
          }
          idPrefix={idPrefix}
          tab={tab}
          characterId={characterId}
          name={name}
          sheet={sheet}
          combat={combat}
          creature={creature}
          follows={follows}
          notes={notes}
          parties={parties}
          transfers={transfers}
          layout={actionsLayout.layout}
          actions={actions}
          onShowConditions={showCondition}
        />
        {showsRolls({
          tab,
          toasting,
          showsFavorites,
          entries,
          triggered: triggers.triggered,
        }) && (
          <RollTray rolls={shown.rolls} rolling={rolling} table={trayTable} />
        )}
        {/* On every tab, as a roll's way to the game may end on another. */}
        {/* Mounted while the pane is hidden too, and off, so that what it meets meanwhile is kept
            quiet rather than popping up as it's shown again (module 0.36.0). */}
        <RollToasts
          rolls={shown.rolls}
          states={shown.states}
          on={toasting && paneShown}
          rollDamage={rollDue}
          modifies={table.modifies}
          tabs={tabRow}
          prompts={diceBanner ?? promptBanner}
          header={header}
        />
        <UsePicker
          picking={picking.picking}
          combat={combat}
          spellbook={sheet.spells}
          casts={itemCasts}
          belongings={belongings}
          areas={table.areas}
          selfTargets={table.selfTargets}
          last={picking.lastTarget}
          // Damage on its own's Spend switch, kept on this device for the seat and this pane.
          spendKey={`${ALONE_SPEND_KEY}:${role}:${characterId}`}
          onPick={picking.pick}
          onClose={picking.closePicker}
        />
        {giving.dialog}
        {removing.dialog}
        {entry.dialog}
        {conditions.panel}
      </SheetContext>
    </PaneContext>
  )
}
