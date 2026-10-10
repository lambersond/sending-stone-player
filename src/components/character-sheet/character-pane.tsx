'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DiceRendererProvider } from '@lambersond/3d-dice-react'
import clsx from 'clsx'
import {
  Backpack,
  BookOpen,
  ChessKnight,
  Feather,
  ListChecks,
  UserRound,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { actionTitle, verbOf, type TableDamage } from './action-entry'
import { ActionsTab } from './actions-tab'
import { BiographyTab } from './biography-tab'
import { CharacterSheet, classLine } from './character-sheet'
import {
  ConditionsOpener,
  rulesOf,
  useConditionsPanel,
  type ShowConditions,
} from './conditions-panel'
import {
  DescriptionLinks,
  type DescriptionActions,
} from './description-actions'
import { EffectsTab } from './effects-tab'
import { FavoriteMarks } from './favorite-mark'
import { FavoritesColumn, FavoritesStrip } from './favorites'
import { FeaturesTab } from './features-tab'
import { InventoryTab } from './inventory-tab'
import { PromptBanner } from './prompt-banner'
import { REASONS, RollTray } from './roll-tray'
import { SpellsTab } from './spells-tab'
import { asks, UsePicker, type Picked, type Picking } from './use-picker'
import { Scroller } from '@/components/scroller'
import {
  useSheetRoller,
  type SheetDamageRoll,
  type SheetFormulaRoll,
  type SheetRoll,
} from '@/hooks/use-sheet-roller'
import {
  choicesOf,
  damageRollOf,
  useTableRolls,
  type DueDamage,
} from '@/hooks/use-table-rolls'
import { useWaitingPrompts } from '@/hooks/use-waiting-prompts'
import { useWidth } from '@/hooks/use-width'
import { favoriteEntries, favoriteKeys, rollsAny } from '@/utils/favorites'
import { sheetActions } from '@/utils/sheet-actions'
import type { RollFeature, RollKind } from '@/types/roll'
import type { SheetAction } from '@/types/sending-stone'
import type { TableCombat, TablePrompt, TableSheet } from '@/types/table'
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
  { id: 'effects', label: 'Effects', icon: WandSparkles },
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

/**
 * The character's sheet, rolling 3D dice across the screen. The dice and their textures load
 * once the sheet is shown, and leave with it.
 */
export function CharacterPane(props: Readonly<Props>) {
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
}: Readonly<Props>) {
  const table = useTableRolls(characterId, rollsToTable, rollFeatures)
  const waiting = useWaitingPrompts(prompts)
  // Once the player answers what the game asked, or rolls from a description, the tray shows its
  // roll whichever tab is open, Effects and Biography among them.
  const [prompted, setPrompted] = useState(false)
  const [described, setDescribed] = useState(false)
  const { roll, rollDamage, rollFormula, logUse, logAsk, rolls, rolling } =
    useSheetRoller(table.send, table.sendDamage, table.sendFormula)
  const conditions = useConditionsPanel(sheet.conditions)
  // An attack or a use made at the table, while its player picks whom at, and with what.
  const [picking, setPicking] = useState<Picking>()
  const [lastTarget, setLastTarget] = useState<string>()
  const [chosen, setTab] = useState<SheetTab>('character')
  const scroller = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const width = useWidth(body)
  const show = (next: SheetTab) => {
    setTab(next)
    scroller.current?.scrollTo?.({ top: 0 })
  }
  const casts =
    sheet.spellcasting !== null ||
    sheet.spells.some(section => section.spells.length > 0)
  const tabs = TABS.filter(({ id }) => id !== 'spells' || casts)
  // A tab the sheet no longer has, such as Spells for a character who lost theirs, shows the
  // character.
  const tab = tabs.some(({ id }) => id === chosen) ? chosen : 'character'
  const entries = useMemo(() => favoriteEntries(sheet), [sheet])
  // An attack the game makes is made at a combatant the player picks first, in a combat, and with
  // the slot, ammunition or mode they choose, where there's more than one.
  const onRoll = (request: SheetRoll) => {
    const { source } = request
    const action =
      source?.kind === 'attack' && table.takes('attack')
        ? sheetActions(sheet, entries).find(
            ({ id, attackId }) =>
              id === source.item && attackId === source.activity,
          )
        : undefined
    const asking: Picking | undefined = action && {
      kind: 'attack',
      action,
      request,
    }
    if (asking && asks(asking, combat, sheet.spells)) {
      setPicking(asking)
      return
    }
    void roll(request)
  }
  // A spell or feature the game uses: at the combatants the player picks, in a combat, and with
  // the slot they choose, its damage changed as they chose, if they did; or, while its damage is
  // due, that damage rolled.
  const onUse = (action: SheetAction, modifiers?: DamageModifiers) => {
    if (!action.activity) return
    const due = table.dueFor({ item: action.id, activity: action.activity.id })
    if (due) {
      rollDue(actionTitle(action), due, undefined, modifiers)
      return
    }
    const asking: Picking = { kind: 'use', action, modifiers }
    if (asks(asking, combat, sheet.spells)) {
      setPicking(asking)
      return
    }
    use(action, { targets: [] }, modifiers)
  }
  const use = (
    action: SheetAction,
    picked: Picked,
    modifiers?: DamageModifiers,
  ) => {
    if (!action.activity) return
    const used = logUse(actionTitle(action), verbOf(action) === 'Cast')
    table.sendUse(
      used,
      {
        kind: 'use',
        item: action.id,
        activity: action.activity.id,
        // A combat that ended while they picked leaves no one to target.
        targets: combat
          ? picked.targets.map(({ id }) => ({
              combatId: combat.id,
              combatantId: id,
            }))
          : [],
        slot: picked.slot,
      },
      modifiers,
    )
  }
  const pick = (picked: Picked) => {
    const asked = picking
    setPicking(undefined)
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
    void rollDamage(damageRollOf(name, due, type, modifiers ?? due.modifiers))
  }
  // A use's damage or healing is rolled as soon as the game says it's due, once; unless its kind
  // is to be chosen first, in the tray.
  const rolledFor = useRef(new Set<string>())
  useEffect(() => {
    for (const state of table.states.values()) {
      const { name, requestId, damage } = state
      if (!name || state.status !== 'done' || !requestId || !damage) continue
      if (state.damaged || rolledFor.current.has(requestId)) continue
      if (choicesOf(damage).length > 0) continue
      rolledFor.current.add(requestId)
      const { modifiers } = state
      void rollDamage(damageRollOf(name, { use: requestId, damage, modifiers }))
    }
  }, [table.states, rollDamage])
  const onRollDamage = (request: SheetDamageRoll) => {
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
    void rollDamage(request)
  }
  const marks = useMemo(() => favoriteKeys(sheet.favorites), [sheet.favorites])
  // On a phone or tablet, the favorites are at the top of the tabs they're shown with; where the
  // sheet is wide enough, they have a column beside them.
  const showsFavorites = WITH_FAVORITES.has(tab) && entries.length > 0
  const beside = showsFavorites && width >= COLUMN_FROM
  const using = table.takes('use') ? onUse : undefined
  // While the game takes damage: which it waits for, and whether it takes it changed.
  const tableDamage: TableDamage | undefined = table.takes('damage')
    ? { modifies: table.modifies, dueFor: table.dueFor }
    : undefined
  // A hit die spent, or a formula rolled, such as a light's radius.
  const onRollFormula = (request: SheetFormulaRoll) => void rollFormula(request)
  // A hit die is spent in the game too while it takes them; else it's only rolled here.
  const spendsAtTable = table.takes('hitDie')
  const favorites = {
    characterId,
    sheet,
    entries,
    onRoll,
    onRollDamage,
    onRollFormula,
    spendsAtTable,
    onUse: using,
    tableDamage,
  }
  const strip =
    showsFavorites && !beside ? <FavoritesStrip {...favorites} /> : undefined
  // Rolls are made from the Character, Actions, Inventory, Spells and Features tabs, and from
  // favorites, so the tray shows there; the rolls stay.
  const showsRolls =
    ROLLING.has(tab) ||
    (showsFavorites && rollsAny(entries)) ||
    prompted ||
    described
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
      setDescribed(true)
      onRoll(request)
    },
    rollDamage: request => {
      setDescribed(true)
      void rollDamage(request)
    },
    rollFormula: request => {
      setDescribed(true)
      void rollFormula(request)
    },
    takes: table.takes,
    ask: ({ label, text, link }) => {
      if (!table.takes('ask')) return
      setDescribed(true)
      table.sendAsk(logAsk(label), { text, link })
    },
    askBlocked: askBlocked(table, rollsToTable),
    // Where only this device's switch keeps the table from being asked, a way to turn it on, as
    // the tray's switch may not be on the tab.
    ...(table.available &&
      !table.sending &&
      rollsToTable?.includes('ask') && {
        sendRolls: () => table.setSending(true),
      }),
    abilities: sheet.abilities,
    conditions: sheet.conditions,
    rules: sheet.rules,
    showConditions: conditions.show,
  }
  // A condition's chip opens its rules, where the app has them; else its place in Effects.
  const showCondition = (id: string) => {
    if (rulesOf(id)) conditions.show(id)
    else show('effects')
  }

  return (
    <SheetContext
      marks={marks}
      showConditions={conditions.show}
      descriptions={descriptions}
    >
      {/* A container, so the tabs show only their icons, but for the chosen one, where all their
          labels don't fit. */}
      <div className='@container flex h-11 shrink-0 items-center gap-3 border-b border-border px-3 md:px-6 lg:px-7'>
        <div
          role='tablist'
          aria-label='Character sheet'
          className='flex min-w-0 gap-0.5 overflow-x-auto lg:shrink-0 @3xl:gap-1'
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`sheet-tab-${id}`}
              type='button'
              role='tab'
              title={label}
              aria-selected={tab === id}
              aria-controls='sheet-panel'
              onClick={() => show(id)}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold transition-colors',
                // Seven tabs' icons, and the chosen one's label, fit a 320-pixel screen.
                tab === id ? 'px-2' : 'px-1.5 @3xl:px-2',
                tab === id
                  ? 'bg-primary/10 text-primary'
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
        <span className='ml-auto hidden min-w-0 truncate text-sm text-text-secondary lg:block'>
          {classLine(sheet)}
        </span>
      </div>
      {/* What the game asks of the character, above every tab, while the game takes the answer. */}
      {waiting.length > 0 && table.available && (
        <PromptBanner
          prompts={waiting}
          sheet={sheet}
          answering={table.answering}
          sending={table.sending}
          onSend={() => table.setSending(true)}
          onRoll={request => {
            setPrompted(true)
            onRoll(request)
          }}
        />
      )}
      <div ref={body} className='flex min-h-0 flex-1'>
        {beside && <FavoritesColumn {...favorites} />}
        <Scroller ref={scroller}>
          <div
            id='sheet-panel'
            role='tabpanel'
            aria-labelledby={`sheet-tab-${tab}`}
          >
            {tab === 'character' && (
              <CharacterSheet
                name={name}
                sheet={sheet}
                combat={combat}
                onRoll={onRoll}
                onRollFormula={onRollFormula}
                spendsAtTable={spendsAtTable}
                onShowConditions={showCondition}
              />
            )}
            {tab === 'actions' && (
              <ActionsTab
                characterId={characterId}
                sheet={sheet}
                {...handlers}
                favorites={strip}
              />
            )}
            {tab === 'inventory' && (
              <InventoryTab
                characterId={characterId}
                sheet={sheet}
                {...handlers}
                favorites={strip}
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
                spendsAtTable={spendsAtTable}
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
              />
            )}
          </div>
        </Scroller>
      </div>
      {showsRolls && (
        <RollTray
          rolls={rolls}
          rolling={rolling}
          table={{ ...table, rollDamage: rollDue }}
        />
      )}
      <UsePicker
        picking={picking}
        combat={combat}
        spellbook={sheet.spells}
        areas={table.areas}
        last={lastTarget}
        onPick={pick}
        onClose={() => setPicking(undefined)}
      />
      {conditions.panel}
    </SheetContext>
  )
}

/**
 * What every part of the sheet inside knows of it: which of what it lists are favorites, how to
 * open its conditions panel, and what the links in its descriptions do.
 */
function SheetContext({
  marks,
  showConditions,
  descriptions,
  children,
}: Readonly<{
  marks: ReadonlySet<string>
  showConditions: ShowConditions
  descriptions: DescriptionActions
  children: ReactNode
}>) {
  return (
    <FavoriteMarks keys={marks}>
      <ConditionsOpener show={showConditions}>
        <DescriptionLinks actions={descriptions}>{children}</DescriptionLinks>
      </ConditionsOpener>
    </FavoriteMarks>
  )
}

/**
 * Why the table can't be asked for a saving throw a description calls for from here now, as the
 * tray says why a roll wasn't made; nothing while it can be.
 * @param kinds - The rolls the game takes now.
 */
function askBlocked(
  table: ReturnType<typeof useTableRolls>,
  kinds: readonly RollKind[] = [],
): string | undefined {
  if (table.takes('ask')) return undefined
  if (!table.available) return REASONS.unavailable
  if (!kinds.includes('ask')) {
    return 'your Gamemaster’s game can’t be asked from Sending Stone yet'
  }
  return 'this device doesn’t send your rolls to the table'
}
