'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DiceRendererProvider } from '@lambersond/3d-dice-react'
import clsx from 'clsx'
import {
  Backpack,
  BookOpen,
  ChessKnight,
  Feather,
  ListChecks,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { actionTitle, verbOf, type TableDamage } from './action-entry'
import { useActionsLayout } from './actions-layout'
import { ActionsTab } from './actions-tab'
import { BiographyTab } from './biography-tab'
import { CharacterSheet } from './character-sheet'
import { Concentrating, type ConcentrationActions } from './concentration'
import {
  ConditionsOpener,
  rulesOf,
  useConditionsPanel,
  type ShowConditions,
} from './conditions-panel'
import {
  DescriptionLinks,
  sheetTools,
  type DescriptionActions,
} from './description-actions'
import { EffectsTab } from './effects-tab'
import { Enchanting, type EnchantActions } from './enchantments'
import { FavoriteMarks } from './favorite-mark'
import { FavoritesColumn, FavoritesStrip } from './favorites'
import { FeaturesTab } from './features-tab'
import { InventoryTab } from './inventory-tab'
import { PromptBanner } from './prompt-banner'
import { RollToasts } from './roll-toasts'
import { reasons, RollTray, type TableRolls } from './roll-tray'
import { RollsButton } from './rolls-button'
import { SheetSettings } from './sheet-settings'
import { SpellsTab } from './spells-tab'
import {
  asks,
  enchantPicks,
  selfPick,
  UsePicker,
  type Picked,
  type Picking,
} from './use-picker'
import { Charging, type ChargeActions } from './uses-button'
import { useDiceEntry } from '@/components/dice-entry'
import { Scroller } from '@/components/scroller'
import { useGiveControls } from '@/components/transfers/give-controls'
import { useRemoveControls } from '@/components/transfers/remove-controls'
import { CreatureContext } from '@/hooks/use-creature'
import { hasDraft, journalOpen } from '@/hooks/use-notes'
import { useToastSetting } from '@/hooks/use-roll-toasts'
import { RollsLocked } from '@/hooks/use-rolls-locked'
import { SheetIdPrefix } from '@/hooks/use-sheet-ids'
import {
  useSheetRoller,
  type LocalFormula,
  type SheetDamageRoll,
  type SheetFormulaRoll,
  type SheetRoll,
} from '@/hooks/use-sheet-roller'
import { useTableRole } from '@/hooks/use-table-api'
import {
  choicesOf,
  damageRollOf,
  needsPlayer,
  SETTLED,
  useGmRolls,
  useTableRolls,
  withGmRolls,
  type DueDamage,
} from '@/hooks/use-table-rolls'
import { useShownPrompts } from '@/hooks/use-waiting-prompts'
import { useWidth } from '@/hooks/use-width'
import { castIndex, isItemCast } from '@/utils/casts'
import { belongingsOf } from '@/utils/enchantments'
import { favoriteEntries, favoriteKeys, rollsAny } from '@/utils/favorites'
import { seatWords, type SeatRole } from '@/utils/seat-words'
import { sheetActions } from '@/utils/sheet-actions'
import type { PartySheets } from './party-sheets'
import type { NotesPlace } from '@/components/notes'
import type { GmRollView, RollFeature, RollKind } from '@/types/roll'
import type { SheetAction } from '@/types/sending-stone'
import type {
  CreatureFacts,
  TableCombat,
  TableMoves,
  TablePrompt,
  TableSheet,
} from '@/types/table'
import type { DamageModifiers } from '@/utils/damage-modifiers'

type Props = {
  characterId: string
  name: string
  sheet: TableSheet
  /** The encounter under way. */
  combat?: TableCombat
  /** The rolls the Gamemaster's game takes from the player now, made there with the same dice. */
  rollsToTable?: RollKind[]
  /** What else the game does with them, such as take damage the player changed. */
  rollFeatures?: RollFeature[]
  /** The saving throws the game asks of the character, for its player to roll here. */
  prompts?: TablePrompt[]
  /**
   * For its player, the rolls the campaign's Gamemaster made as the character lately (#156), shown
   * among their own.
   */
  gmRolls?: GmRollView[]
  /**
   * The table's header, which the rolls' toasts start below where the sheet's tabs aren't shown,
   * as on a phone showing combat or the chat.
   */
  header?: HTMLElement | null
  /**
   * Where the character's items and coins may be given to, from module 0.31.0, while the game
   * takes moves: from the Inventory tab, through the seat's own API.
   */
  moves?: TableMoves
  /**
   * Whether the seat may remove the character's items there, from module 0.33.0, as its game takes
   * them.
   */
  removes?: boolean
  /** The character's Foundry actor, which what's given is given from. */
  actorId?: string
  /** The party sheets the seat may open from the Inventory tab, from module 0.30.0. */
  parties?: PartySheets
  /**
   * Whether the player types in their own dice here, where the game lets them, from module
   * 0.32.0.
   */
  manualDice?: { on: boolean; onChange: (on: boolean) => void }
  /**
   * Where the character's own journal notes are read and written, from module 0.34.0: shown on
   * the Biography tab alone.
   */
  notes?: NotesPlace
  /**
   * A creature's pane rather than the character's (module 0.36.0): its header is the creature's,
   * and it offers nothing an NPC lacks (Heroic Inspiration, give, remove, parties, the journal).
   */
  creature?: CreatureFacts
  /**
   * Whether the pane is the one shown, where several share the Character pane (module 0.36.0):
   * a pane not shown neither pops toasts nor rolls damage by itself, but offers it in its tray,
   * and says so through `onPending`. Shown when absent.
   */
  shown?: boolean
  onPending?: (pending: boolean) => void
  /**
   * (v5, critic) Told whether any of the pane's rolls is on its way to the game (its state not yet
   * in `SETTLED`), so that the page never unmounts it then, which would abort its follows.
   */
  onBusy?: (busy: boolean) => void
  /**
   * Whether the pane throws its dice with a renderer its page provides, shared by every creature's
   * pane, rather than one of its own (module 0.36.0). Its own when absent.
   */
  sharedDice?: boolean
  /**
   * At a companion's pane under "Right after its character", while its character is in the combat
   * (module 0.36.0): that character's name. Its Initiative tile then says it acts after it, and
   * offers no roll (§8.10).
   */
  follows?: string
  /**
   * (v5) A companion no longer the seat's character's (module 0.36.0): its sheet shows as it was,
   * and nothing on it rolls (§8.3; Q 16).
   */
  locked?: boolean
  /**
   * (v5) What the ids of its tabs and their panel begin with, so that no two panes on one page
   * share one: none at the character's own pane, `creature-<key>-` at a companion's.
   */
  idPrefix?: string
  /**
   * What's said of the sheet under its tab row, above everything else, as a gone companion's note
   * (module 0.36.0).
   */
  note?: ReactNode
}

/**
 * The parts of the sheet, in the order Tidy 5e's character sheet has them, with dnd5e's icons for
 * them where it has them, and Tidy's for Actions. Spells is only for a character who casts them.
 */
const TABS: { id: SheetTab; label: string; icon: LucideIcon }[] = [
  { id: 'character', label: 'Character', icon: UserRound },
  { id: 'actions', label: 'Actions', icon: ChessKnight },
  { id: 'inventory', label: 'Inventory', icon: Backpack },
  { id: 'spells', label: 'Spells', icon: BookOpen },
  { id: 'features', label: 'Features', icon: ListChecks },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'biography', label: 'Biography', icon: Feather },
]
type SheetTab =
  | 'character'
  | 'actions'
  | 'inventory'
  | 'spells'
  | 'features'
  | 'effects'
  | 'biography'

/** The tabs things are rolled from, which the rolls are shown with. */
const ROLLING = new Set<SheetTab>([
  'character',
  'actions',
  'inventory',
  'spells',
  'features',
])

/** The tabs the character's favorites are shown with, as what's used most there. */
const WITH_FAVORITES = new Set<SheetTab>([
  'actions',
  'inventory',
  'spells',
  'effects',
])

/**
 * How wide the sheet must be, in pixels, for the favorites to have a column of their own beside
 * the tab: room for their column, 360 pixels, about a phone's width, and beside it for the
 * Actions tab's table.
 */
const COLUMN_FROM = 936

/** How wide the favorites' column is, in pixels, where they have one. */
const FAVORITES_COLUMN = 360

/**
 * The character's sheet, rolling 3D dice across the screen. The dice and their textures load
 * once the sheet is shown, and leave with it. Where its page shows a companion's pane beside it,
 * every pane throws its dice on the page's one renderer (`sharedDice`), so they land over whichever
 * is shown (module 0.36.0).
 */
export function CharacterPane(props: Readonly<Props>) {
  if (props.sharedDice) return <RollingSheet {...props} />
  return (
    <DiceRendererProvider>
      <RollingSheet {...props} />
    </DiceRendererProvider>
  )
}

function RollingSheet({
  characterId,
  name,
  sheet,
  combat,
  rollsToTable,
  rollFeatures,
  prompts,
  gmRolls,
  header,
  moves,
  removes,
  actorId,
  parties,
  manualDice,
  notes,
  creature,
  shown: paneShown = true,
  onPending,
  onBusy,
  follows,
  locked = false,
  idPrefix = '',
  note,
}: Readonly<Props>) {
  const table = useTableRolls(characterId, rollsToTable, rollFeatures)
  // Whether its rolls are locked now, as a gone companion's are (module 0.36.0), for what was
  // opened before it went, such as a description's menu, to roll nothing after.
  const lockedNow = useRef(locked)
  useLayoutEffect(() => {
    lockedNow.current = locked
  }, [locked])
  // While the player types in what their own dice show, each roll asks for them, in place of the
  // app's dice.
  const typing = manualDice?.on === true
  const entry = useDiceEntry()
  const role = useTableRole()
  // What the game asks, and what Midi-QOL is doing with what it asked, or did a moment ago.
  const waiting = useShownPrompts(prompts)
  // An answer to what the game asks, while its dice are typed in, until when the game waits for
  // it, dnd5e's and Midi-QOL's alike, as the app refuses either after; and how it's told that it
  // was answered or closed elsewhere: rolled in Foundry, answered from the other seat, or left to
  // Midi-QOL, its dialog then closing, as nothing here could answer it any more.
  const answers = useRef(new Map<string, AbortController>())
  useEffect(() => {
    for (const [id, controller] of answers.current) {
      const prompt = waiting.find(each => each.id === id)
      if (prompt && !prompt.closed) continue
      controller.abort()
      answers.current.delete(id)
    }
  }, [waiting])
  const answering = (request: SheetRoll): SheetRoll => {
    const { source } = request
    const id = source && 'prompt' in source ? source.prompt : undefined
    const prompt = id ? waiting.find(each => each.id === id) : undefined
    if (!prompt) return request
    let controller = answers.current.get(prompt.id)
    if (!controller) {
      controller = new AbortController()
      answers.current.set(prompt.id, controller)
    }
    return { ...request, until: prompt.expiresAt, signal: controller.signal }
  }
  // Once the player answers what the game asked, or rolls from a description, the tray shows its
  // roll whichever tab is open, Effects and Biography among them.
  const [prompted, setPrompted] = useState(false)
  const [described, setDescribed] = useState(false)
  // And once they end a concentration, or spend a counter's charges, which they may from Effects
  // too, a favorite's among them, or give an item or coin, as that rolls nothing.
  const [acted, setActed] = useState(false)
  // A recharge's d6, from module 0.36.0, goes to the game as one; any other formula as ever.
  const { sendFormula, sendRecharge } = table
  const formulaThrown = useCallback(
    (thrown: SheetFormulaRoll, rolled: LocalFormula) => {
      if (thrown.recharge) {
        sendRecharge({ label: thrown.label, counter: thrown.recharge }, rolled)
      } else {
        sendFormula(thrown, rolled)
      }
    },
    [sendFormula, sendRecharge],
  )
  const {
    roll,
    rollDamage,
    rollFormula,
    logUse,
    logEnd,
    logCharge,
    logMove,
    logAsk,
    rolls,
    rolling,
  } = useSheetRoller(
    table.send,
    table.sendDamage,
    formulaThrown,
    typing ? entry.enter : undefined,
  )
  // Give, on the Inventory tab, from module 0.31.0: its dialog is held here, so that it outlives
  // the row it was opened from, and the controls going, as when the game stops taking moves.
  const giving = useGiveControls({
    moves,
    table,
    role,
    name,
    actorId,
    logMove,
    setActed,
  })
  const removing = useRemoveControls({
    removes: removes === true,
    inventory: sheet.inventory,
    table,
    role,
    name,
    logMove,
    setActed,
  })
  // Remove…, from module 0.33.0, beside Send to…: with moves off too.
  const transfers = useMemo(
    () =>
      removing.remove
        ? { ...giving.controls, remove: removing.remove }
        : giving.controls,
    [giving.controls, removing.remove],
  )
  // The Gamemaster's rolls as the character (#156) among the player's own, wherever they're shown,
  // with nothing to roll after them; their area attacks' targets named as this page's own combat
  // names them, which never holds one hidden from players.
  const fromGm = useGmRolls(gmRolls, combat)
  const shown = useMemo(
    () => withGmRolls(rolls, table.states, fromGm),
    [rolls, table.states, fromGm],
  )
  // Where several panes share the Character pane (module 0.36.0): whether any of its rolls waits
  // for its player, as damage to roll, which its tab marks while it's hidden; and whether any is
  // still on its way to the game, while the page must keep it mounted, so as not to lose it.
  const pending = shown.rolls.some(roll =>
    needsPlayer(roll, shown.states.get(roll.id)),
  )
  const busy = [...table.states.values()].some(
    ({ status }) => !SETTLED.has(status),
  )
  useEffect(() => {
    onPending?.(pending)
  }, [pending, onPending])
  useEffect(() => {
    onBusy?.(busy)
  }, [busy, onBusy])
  // Whether the rolls pop up as toasts, with the rest a button away, or stay in the banner: one or
  // the other, never both.
  const [toasting, setToasting] = useToastSetting()
  const conditions = useConditionsPanel(sheet.conditions)
  // An attack or a use made at the table, while its player picks whom at, and with what. One open
  // as the pane's rolls lock, as a companion's that has gone, closes: nothing it picks is made.
  const [picking, setPicking] = useState<Picking>()
  if (locked && picking) setPicking(undefined)
  const [lastTarget, setLastTarget] = useState<string>()
  // The sheet opens on the character; on Biography where a note is being written there, or the
  // journal is open, as when either was under why there was no sheet, before this one arrived.
  const [chosen, setTab] = useState<SheetTab>(() =>
    notes && (hasDraft(notes.api) || journalOpen(notes.api))
      ? 'biography'
      : 'character',
  )
  const scroller = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  // The row of tabs, and the game's prompts beneath it while it asks any, which the rolls' toasts
  // start below, so as not to cover the prompts' only buttons.
  // eslint-disable-next-line unicorn/no-null -- React sets a ref to null as it goes
  const [tabRow, setTabRow] = useState<HTMLDivElement | null>(null)
  // eslint-disable-next-line unicorn/no-null -- React sets a ref to null as it goes
  const [promptBanner, setPromptBanner] = useState<HTMLElement | null>(null)
  const width = useWidth(body)
  const show = (next: SheetTab) => {
    setTab(next)
    scroller.current?.scrollTo?.({ top: 0 })
  }
  const casts =
    sheet.spellcasting !== null ||
    sheet.spells.some(section => section.spells.length > 0)
  // A creature's tabs, from module 0.36.0, only where its sheet has something for them.
  const tabs = TABS.filter(
    ({ id }) => (id !== 'spells' || casts) && (!creature || hasFor(sheet, id)),
  )
  // A tab the sheet no longer has, such as Spells for a character who lost theirs, shows the
  // character.
  const tab = tabs.some(({ id }) => id === chosen) ? chosen : 'character'
  const entries = useMemo(() => favoriteEntries(sheet), [sheet])
  // How each spell an item casts is cast, and at which levels it may be.
  const itemCasts = useMemo(() => castIndex(sheet), [sheet])
  // What the character has that an enchantment may be put on.
  const belongings = useMemo(() => belongingsOf(sheet), [sheet])
  // An attack the game makes is made at a combatant the player picks first, in a combat, and with
  // the slot, ammunition or mode they choose, where there's more than one.
  const onRoll = (asked: SheetRoll) => {
    // Nothing rolls at a gone companion's pane, should a control have missed it (module 0.36.0).
    if (lockedNow.current) return
    const { source } = asked
    const attack =
      source?.kind === 'attack'
        ? sheetActions(sheet, entries).find(
            ({ id, attackId }) =>
              id === source.item && attackId === source.activity,
          )
        : undefined
    // Where dnd5e gives the attack Elven Accuracy, a third d20 with advantage, typed in, whatever
    // the table takes.
    const request: SheetRoll = attack?.elvenAccuracy
      ? { ...asked, elvenAccuracy: true }
      : asked
    const action = table.takes('attack') ? attack : undefined
    const asking: Picking | undefined = action && {
      kind: 'attack',
      action,
      request,
    }
    if (
      asking &&
      asks(asking, combat, sheet.spells, itemCasts, table.selfTargets)
    ) {
      setPicking(asking)
      return
    }
    void roll(action ? { ...request, ...itemCastOf(action) } : request)
  }
  // A spell or feature the game uses: at the combatants the player picks, in a combat, and with
  // the slot they choose, its damage changed as they chose, if they did; or, while its damage is
  // due, that damage rolled. One made at its user by default, as a potion, with no one to pick, as
  // out of a combat, is made at them, where it may be; any other at no one.
  const onUse = (action: SheetAction, modifiers?: DamageModifiers) => {
    if (!action.activity) return
    const due = table.dueFor({ item: action.id, activity: action.activity.id })
    if (due) {
      rollDue(actionTitle(action), due, undefined, modifiers)
      return
    }
    const asking: Picking = { kind: 'use', action, modifiers }
    if (asks(asking, combat, sheet.spells, itemCasts, table.selfTargets)) {
      setPicking(asking)
      return
    }
    const at = selfPick(action, combat, table.selfTargets)
    use(action, at ?? { targets: [] }, modifiers)
  }
  const use = (
    action: SheetAction,
    chose: Picked,
    modifiers?: DamageModifiers,
  ) => {
    if (!action.activity) return
    // An enchant activity used without asking is used as dnd5e would use it, in the first way it
    // may enchant.
    const picked =
      action.activity.type === 'enchant' && !chose.enchant
        ? { ...chose, ...enchantPicks(action, sheet.spells, itemCasts) }
        : chose
    const used = logUse(
      actionTitle(action),
      verbOf(action) === 'Cast',
      isItemCast(action),
    )
    // A combat that ended while they picked leaves no one to target; its user, as Self, is still
    // its user, where the game makes a use at them as asked.
    const self =
      picked.self === true ||
      (!combat &&
        table.selfTargets &&
        picked.targets.some(({ side }) => side === 'me'))
    table.sendUse(
      used,
      {
        kind: 'use',
        item: action.id,
        activity: action.activity.id,
        targets: combat
          ? picked.targets.map(({ id }) => ({
              combatId: combat.id,
              combatantId: id,
            }))
          : [],
        ...(self && { self: true as const }),
        slot: picked.slot,
        ...(picked.enchant && { enchant: picked.enchant }),
      },
      modifiers,
    )
  }
  const pick = (picked: Picked) => {
    const asked = picking
    setPicking(undefined)
    // Nothing picked at a pane whose rolls have locked since is made (module 0.36.0).
    if (lockedNow.current) return
    if (asked?.kind === 'use') {
      use(asked.action, picked, asked.modifiers)
      return
    }
    const source = asked?.request.source
    if (!asked || source?.kind !== 'attack') return
    const { slot, ammunition, attackMode } = picked
    // An area attack, where the game makes it at those picked, is made at those in its area.
    if (table.areas && asked.action.attackArea) {
      // A combat that ended while they picked leaves no one to attack.
      const caught = combat ? picked.targets : []
      void roll({
        ...asked.request,
        source: {
          ...source,
          targets: combat
            ? caught.map(({ id }) => ({ combatId: combat.id, combatantId: id }))
            : [],
          slot,
          ammunition,
          attackMode,
        },
        targetNames: Object.fromEntries(
          caught.map(({ id, name }) => [id, name]),
        ),
        ...itemCastOf(asked.action),
      })
      return
    }
    const [combatant] = picked.targets
    if (combatant) setLastTarget(combatant.id)
    // A combat that ended while they picked leaves no one to attack.
    const target =
      combatant && combat
        ? { combatId: combat.id, combatantId: combatant.id }
        : undefined
    void roll({
      ...asked.request,
      source: { ...source, target, slot, ammunition, attackMode },
      ...itemCastOf(asked.action),
    })
  }
  // An attack's or a use's damage, while the game waits for it, is rolled for the game, as the
  // game said, as the kind of damage chosen, if any, and changed as the player chose, if they did.
  const rollDue = (
    name: string,
    due: DueDamage,
    type?: string,
    modifiers?: DamageModifiers,
  ) => {
    if (lockedNow.current) return
    void rollDamage(damageRollOf(name, due, type, modifiers ?? due.modifiers))
  }
  // A use's damage or healing is rolled as soon as the game says it's due, once; unless its kind
  // is to be chosen first, in the tray; or, while the player types in their own dice, offered there
  // for them to roll it, rather than asking for their dice by itself; and so too while the pane
  // isn't the one shown (module 0.36.0), whose dice would land over another's, or while its rolls
  // are locked, as a gone companion's are, whose use made before it went may still come back with
  // its damage. Either way only once, so that turning typing off after, or showing the pane, never
  // rolls it by itself.
  const rolledFor = useRef(new Set<string>())
  const { offerDamage } = table
  useEffect(() => {
    for (const [id, state] of table.states) {
      const { name, requestId, damage } = state
      if (!name || state.status !== 'done' || !requestId || !damage) continue
      if (state.damaged || rolledFor.current.has(requestId)) continue
      if (choicesOf(damage).length > 0) continue
      rolledFor.current.add(requestId)
      if (typing || !paneShown || lockedNow.current) {
        offerDamage(id)
        continue
      }
      const { modifiers } = state
      void rollDamage(damageRollOf(name, { use: requestId, damage, modifiers }))
    }
  }, [table.states, rollDamage, typing, paneShown, offerDamage])
  const onRollDamage = (request: SheetDamageRoll) => {
    if (lockedNow.current) return
    const due = request.source && table.dueFor(request.source)
    if (due) {
      rollDue(
        request.label.replace(/ (damage|healing)$/, ''),
        due,
        undefined,
        request.modifiers,
      )
      return
    }
    // Damage on its own, from module 0.36.0, is rolled as its row gave it: its dice the game's
    // plan, a critical hit's where chosen, as the kind chosen; sent as such, unless the switch went
    // off since, when it's the player's alone. Any other is rolled here, as ever.
    void rollDamage(request)
  }
  // The features resources stand for are marked as favorites too, as their entries say.
  const marks = useMemo(
    () => favoriteKeys(sheet.favorites, entries),
    [sheet.favorites, entries],
  )
  // On a phone or tablet, the favorites are at the top of the tabs they're shown with; where the
  // sheet is wide enough, they have a column beside them.
  const showsFavorites = WITH_FAVORITES.has(tab) && entries.length > 0
  const beside = showsFavorites && width >= COLUMN_FROM
  // How the Actions tab is laid out, as wide as it is, beside the favorites' column where it has
  // one: kept here, so that the settings offer what it shows from every tab.
  const actionsLayout = useActionsLayout(
    entries.length > 0 && width >= COLUMN_FROM
      ? width - FAVORITES_COLUMN
      : width,
  )
  const using = table.takes('use') ? onUse : undefined
  // While the game takes damage, or damage on its own or recharges from module 0.36.0: which it
  // waits for, whether it takes it changed, whether it goes on its own, and whether a recharge is
  // rolled here. A game may take recharges and not damage, as with Midi-QOL's activities and the
  // module's integration off, whatever this device's switch for damage on its own.
  const tableDamage: TableDamage | undefined =
    table.takes('damage') || table.sendsAlone || table.takes('recharge')
      ? {
          modifies: table.modifies,
          dueFor: table.dueFor,
          sendsAlone: table.sendsAlone,
          recharges: table.takes('recharge'),
        }
      : undefined
  // Hit dice spent, or a formula rolled, such as a light's radius.
  const onRollFormula = (request: SheetFormulaRoll) => {
    if (lockedNow.current) return
    void rollFormula(request)
  }
  const favorites = {
    characterId,
    sheet,
    entries,
    onRoll,
    onRollDamage,
    onRollFormula,
    onUse: using,
    tableDamage,
  }
  const strip =
    showsFavorites && !beside ? <FavoritesStrip {...favorites} /> : undefined
  // Rolls are made from the Character, Actions, Inventory, Spells and Features tabs, and from
  // favorites, so the banner shows there, where the player has it rather than toasts; the rolls
  // stay.
  const showsRolls =
    !toasting &&
    (ROLLING.has(tab) ||
      (showsFavorites && rollsAny(entries)) ||
      prompted ||
      described ||
      acted)
  // The rolls' way to the game, and their damage to roll, as the banner, the toasts and the rolls'
  // button all offer it.
  const trayTable: TableRolls = {
    ...table,
    states: shown.states,
    rollDamage: rollDue,
  }
  const handlers = {
    onRoll,
    onRollDamage,
    onRollFormula,
    onUse: using,
    tableDamage,
  }
  // What the links in descriptions do, on every tab, favorite and dialog: each roll they make,
  // and the table asked, shows in the tray, whichever tab it's on.
  const descriptions: DescriptionActions = {
    roll: request => {
      if (lockedNow.current) return
      setDescribed(true)
      onRoll(request)
    },
    rollDamage: request => {
      if (lockedNow.current) return
      setDescribed(true)
      void rollDamage(request)
    },
    rollFormula: request => {
      if (lockedNow.current) return
      setDescribed(true)
      void rollFormula(request)
    },
    takes: table.takes,
    // A description's damage at the table: changed, where the game takes it so, which it does
    // only from module 0.19.0, whose sheets say how it makes a critical hit's, and on its first
    // die whatever its sign before module 0.21.0; and as one, where they say how.
    ...(table.takes('textDamage') && {
      damage: {
        modifies: table.modifiesText && sheet.critical !== undefined,
        signed: table.signsText,
        ...(sheet.critical && { critical: sheet.critical }),
      },
    }),
    ask: ({ label, text, link }) => {
      if (lockedNow.current || !table.takes('ask')) return
      setDescribed(true)
      table.sendAsk(logAsk(label), { text, link })
    },
    askBlocked: askBlocked(table, role, rollsToTable),
    useBlocked: useBlocked(table, role, rollsToTable),
    // Where only this device's switch keeps the table from being asked, a way to turn it on, as
    // the switch in the sheet's settings is a step away.
    ...(table.available &&
      !table.sending &&
      rollsToTable?.includes('ask') && {
        sendRolls: () => table.setSending(true),
      }),
    abilities: sheet.abilities,
    skills: sheet.skills,
    tools: sheetTools(sheet),
    proficiency: sheet.proficiency,
    conditions: sheet.conditions,
    rules: sheet.rules,
    showConditions: conditions.show,
  }
  // Enchantments on the character's items, ended as dnd5e's chat card ends them, while the game
  // takes it, each item named as the sheet lists it; and each enchant activity's latest use, which
  // its switch follows.
  const enchanting: EnchantActions = {
    latestFor: table.latestFor,
    belongings,
    ...(table.takes('endEnchantment') && {
      end: (item, { id, name: ended }, source) =>
        table.sendEnd(logEnd(ended), { item, effect: id }, source),
    }),
  }
  // The character's concentrations, each ended as dnd5e's Break Concentration ends it, while the
  // game takes it from here, as it never does from the Gamemaster's page, where it would leave no
  // mark; nothing goes to the game's chat.
  const concentrating: ConcentrationActions = {
    effects: sheet.concentration?.effects,
    ...(table.takes('endConcentration') && {
      end: ({ id, name: on }) => {
        setActed(true)
        table.sendEndConcentration(logEnd(`Concentration on ${on}`), id)
      },
    }),
  }
  // A counter's charges spent directly, and Heroic Inspiration used or gained, while the game takes
  // them from here: each posts a line in the game's chat, the Gamemaster's marked as theirs.
  const charging: ChargeActions = {
    ...(table.takes('spend') && {
      spend: (counter, count, counterName) => {
        setActed(true)
        table.sendSpend(logCharge(counterName, { spent: count }), {
          counter,
          count,
        })
      },
    }),
    ...(table.takes('inspiration') && {
      inspire: inspiration =>
        table.sendInspiration(
          logCharge('Heroic Inspiration', { inspiration }),
          inspiration,
        ),
    }),
  }
  // A condition's chip opens its rules, where the app has them; else its place in Effects.
  const showCondition = (id: string) => {
    if (rulesOf(id)) conditions.show(id)
    else show('effects')
  }

  const pane = (
    <SheetContext
      marks={marks}
      showConditions={conditions.show}
      descriptions={descriptions}
      enchanting={enchanting}
      concentrating={concentrating}
      charging={charging}
    >
      {/* A container, so the tabs show only their icons, but for the chosen one, where all their
          labels don't fit; the settings' cog after them, at the end of the row, and the rolls'
          button before it where they pop up as toasts. No gap before them, as their margin and
          their own padding keep them apart: a caster's seven tabs, with a condition's dot on
          Effects, take 301 pixels, of the 302 beside both on a 390-pixel screen. Narrower, the
          tabs and the buttons are a little tighter, so that they take 277 of the 280 on a
          360-pixel one; narrower still, the tabs scroll. */}
      <div
        ref={setTabRow}
        className='@container flex h-11 shrink-0 items-center border-b border-border px-3 md:px-6 lg:px-7'
      >
        <div
          role='tablist'
          aria-label='Character sheet'
          className='flex min-w-0 gap-0.5 overflow-x-auto @3xl:gap-1'
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`${idPrefix}sheet-tab-${id}`}
              type='button'
              role='tab'
              title={label}
              aria-selected={tab === id}
              aria-controls={`${idPrefix}sheet-panel`}
              onClick={() => show(id)}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold transition-colors',
                // Seven tabs' icons, Effects' dot, the chosen one's label, the rolls' button and
                // the settings' cog fit a 360-pixel screen; on a narrower one the tabs scroll.
                // Tighter under 366 pixels inside the row's padding, a screen under 390.
                tab === id ? 'px-2' : 'px-1.5 @max-[366px]:px-1 @3xl:px-2',
                tab === id
                  ? 'bg-primary/10 text-primary-text'
                  : 'text-text-secondary hover:bg-primary/5 hover:text-text-primary',
              )}
            >
              <Icon aria-hidden className='size-4' />
              <span className={clsx(tab !== id && 'sr-only @3xl:not-sr-only')}>
                {label}
              </span>
              {id === 'effects' && sheet.conditions.length > 0 && (
                <span className='size-1.5 rounded-full bg-ruby'>
                  <span className='sr-only'>
                    , {sheet.conditions.length} conditions
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
        <div className='ml-auto flex shrink-0 items-center'>
          {toasting && (
            <RollsButton
              rolls={shown.rolls}
              rolling={rolling}
              table={trayTable}
            />
          )}
          <SheetSettings
            send={
              table.available
                ? { on: table.sending, onChange: table.setSending }
                : undefined
            }
            // Where the game takes damage on its own, from module 0.36.0: this device's switch.
            alone={
              table.aloneOffered
                ? {
                    on: table.aloneOn,
                    onChange: table.setAlone,
                    disabled: !table.sending,
                  }
                : undefined
            }
            // Where the game lets the player type in their own dice, from module 0.32.0.
            manualDice={manualDice}
            toasts={{ on: toasting, onChange: setToasting }}
            layouts={
              actionsLayout.offered.length > 1 && sheet.actions.length > 0
                ? actionsLayout
                : undefined
            }
          />
        </div>
      </div>
      {note}
      {/* What the game asks of the character, above every tab, while the game takes the answer. */}
      {waiting.length > 0 && table.available && (
        <PromptBanner
          ref={setPromptBanner}
          prompts={waiting}
          sheet={sheet}
          answering={table.answering}
          sending={table.sending}
          onSend={() => table.setSending(true)}
          onRoll={request => {
            setPrompted(true)
            onRoll(answering(request))
          }}
        />
      )}
      <div ref={body} className='flex min-h-0 flex-1'>
        {beside && <FavoritesColumn {...favorites} />}
        <Scroller ref={scroller}>
          <div
            id={`${idPrefix}sheet-panel`}
            role='tabpanel'
            aria-labelledby={`${idPrefix}sheet-tab-${tab}`}
          >
            {tab === 'character' && (
              <CharacterSheet
                name={name}
                sheet={sheet}
                combat={combat}
                onRoll={onRoll}
                onRollFormula={onRollFormula}
                onShowConditions={showCondition}
                creature={creature}
                follows={follows}
                idPrefix={idPrefix}
              />
            )}
            {tab === 'actions' && (
              <ActionsTab
                characterId={characterId}
                sheet={sheet}
                {...handlers}
                favorites={strip}
                layout={actionsLayout.layout}
              />
            )}
            {tab === 'inventory' && (
              <InventoryTab
                characterId={characterId}
                sheet={sheet}
                {...handlers}
                favorites={strip}
                transfers={transfers}
                parties={parties}
              />
            )}
            {tab === 'spells' && (
              <SpellsTab
                characterId={characterId}
                sheet={sheet}
                {...handlers}
                favorites={strip}
              />
            )}
            {tab === 'features' && (
              <FeaturesTab
                characterId={characterId}
                sheet={sheet}
                {...handlers}
              />
            )}
            {tab === 'effects' && (
              <EffectsTab
                characterId={characterId}
                sheet={sheet}
                favorites={strip}
              />
            )}
            {tab === 'biography' && (
              <BiographyTab
                characterId={characterId}
                name={name}
                sheet={sheet}
                notes={notes}
              />
            )}
          </div>
        </Scroller>
      </div>
      {showsRolls && (
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
        prompts={promptBanner}
        header={header}
      />
      <UsePicker
        picking={picking}
        combat={combat}
        spellbook={sheet.spells}
        casts={itemCasts}
        belongings={belongings}
        areas={table.areas}
        selfTargets={table.selfTargets}
        last={lastTarget}
        onPick={pick}
        onClose={() => setPicking(undefined)}
      />
      {giving.dialog}
      {removing.dialog}
      {entry.dialog}
      {conditions.panel}
    </SheetContext>
  )
  return (
    <PaneContext creature={creature} locked={locked} idPrefix={idPrefix}>
      {pane}
    </PaneContext>
  )
}

/**
 * What every part of a pane inside knows of whose it is (module 0.36.0): at a companion's, the
 * creature and its character, for the words it says; whether its rolls are locked, as a gone
 * companion's are; and what its ids begin with. Its toasts, portalled, know it too.
 */
function PaneContext({
  creature,
  locked,
  idPrefix,
  children,
}: Readonly<{
  creature?: CreatureFacts
  locked: boolean
  idPrefix: string
  children: ReactNode
}>) {
  return (
    <CreatureContext
      value={creature && { ...creature, character: creature.relation.of }}
    >
      <RollsLocked value={locked}>
        <SheetIdPrefix value={idPrefix}>{children}</SheetIdPrefix>
      </RollsLocked>
    </CreatureContext>
  )
}

/**
 * Whether a creature's sheet has something for one of its tabs (module 0.36.0): Inventory where it
 * lists an item or a container, or has a coin, as the module lists every coin, at none too;
 * Effects where it has an effect or a condition; Biography where it has more than its alignment,
 * which the creature line already says. The rest always, Spells as a character's.
 */
function hasFor(sheet: TableSheet, tab: SheetTab): boolean {
  const { inventory, details } = sheet
  switch (tab) {
    case 'inventory': {
      return (
        inventory.sections.length > 0 ||
        inventory.containers.length > 0 ||
        inventory.currency.some(({ value }) => value > 0)
      )
    }
    case 'effects': {
      return (
        sheet.effects.some(({ effects }) => effects.length > 0) ||
        sheet.conditions.length > 0
      )
    }
    case 'biography': {
      return (
        Boolean(details.biography) ||
        Boolean(details.appearance) ||
        details.personality.length > 0 ||
        details.about.some(({ id }) => id !== 'alignment')
      )
    }
    default: {
      return true
    }
  }
}

/**
 * What every part of the sheet inside knows of it: which of what it lists are favorites, how to
 * open its conditions panel, what the links in its descriptions do, how enchantments and
 * concentrations end, and how counters are spent and Heroic Inspiration changed.
 */
function SheetContext({
  marks,
  showConditions,
  descriptions,
  enchanting,
  concentrating,
  charging,
  children,
}: Readonly<{
  marks: ReadonlySet<string>
  showConditions: ShowConditions
  descriptions: DescriptionActions
  enchanting: EnchantActions
  concentrating: ConcentrationActions
  charging: ChargeActions
  children: ReactNode
}>) {
  return (
    <FavoriteMarks keys={marks}>
      <ConditionsOpener show={showConditions}>
        <DescriptionLinks actions={descriptions}>
          <Enchanting actions={enchanting}>
            <Concentrating actions={concentrating}>
              <Charging actions={charging}>{children}</Charging>
            </Concentrating>
          </Enchanting>
        </DescriptionLinks>
      </ConditionsOpener>
    </FavoriteMarks>
  )
}

/**
 * An attack of a spell an item casts, such as a staff's Guiding Bolt, marked as one: it's cast at a
 * level the item offers, not with a slot, which the tray says where the game refuses it.
 */
function itemCastOf(action: SheetAction): { itemCast?: true } {
  return isItemCast(action) ? { itemCast: true } : {}
}

/**
 * Why the table can't be asked for a saving throw or check a description calls for from here now,
 * as the tray says why a roll wasn't made; nothing while it can be.
 * @param kinds - The rolls the game takes now.
 */
function askBlocked(
  table: ReturnType<typeof useTableRolls>,
  role: SeatRole,
  kinds: readonly RollKind[] = [],
): string | undefined {
  if (table.takes('ask')) return undefined
  if (!table.available) return reasons(role).unavailable
  if (!kinds.includes('ask')) {
    return `${seatWords(role).game} can’t be asked from Sending Stone yet`
  }
  return 'this device doesn’t send your rolls to the table'
}

/**
 * Why a spell or feature can't be used in the game from here now, as an activity's check asks the
 * table by using it, as the tray says why a roll wasn't made; nothing while it can be.
 * @param kinds - The rolls the game takes now.
 */
function useBlocked(
  table: ReturnType<typeof useTableRolls>,
  role: SeatRole,
  kinds: readonly RollKind[] = [],
): string | undefined {
  if (table.takes('use')) return undefined
  if (!table.available) return reasons(role).unavailable
  if (!kinds.includes('use')) {
    return `${seatWords(role).game} isn’t taking spells and features`
  }
  return 'this device doesn’t send your rolls to the table'
}
