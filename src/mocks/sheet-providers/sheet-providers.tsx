import { useCallback, useMemo, type ReactNode } from 'react'
import { DiceRendererProvider } from '@lambersond/3d-dice-react'
import { useSheetRoller } from '@/features/rolling/hooks/use-sheet-roller'
import { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import { Charging } from '@/features/sheet/components/charging/charging'
import { Concentrating } from '@/features/sheet/components/concentration/concentrating'
import { ConditionsOpener } from '@/features/sheet/components/conditions/conditions-opener'
import { useConditionsPanel } from '@/features/sheet/components/conditions/use-conditions-panel'
import { DescriptionLinks } from '@/features/sheet/components/description-actions/description-links'
import { sheetTools } from '@/features/sheet/components/description-actions/utils'
import { Effecting } from '@/features/sheet/components/effect-controls/effecting'
import { useEffectControls } from '@/features/sheet/components/effect-controls/use-effect-controls'
import { Enchanting } from '@/features/sheet/components/enchantments/enchanting'
import { FavoriteMarks } from '@/features/sheet/components/favorite-mark/favorite-marks'
import { Favoriting } from '@/features/sheet/components/favoriting/favoriting'
import { useFavorites } from '@/features/sheet/components/favoriting/use-favorites'
import { Preparing } from '@/features/sheet/components/preparing/preparing'
import { usePreparing } from '@/features/sheet/components/preparing/use-preparing'
import { useWildShape } from '@/features/sheet/components/wild-shape/use-wild-shape'
import { WildShaping } from '@/features/sheet/components/wild-shape/wild-shaping'
import { SheetIdPrefix } from '@/features/sheet/hooks/use-sheet-ids'
import { belongingsOf } from '@/features/sheet/utils/enchantments'
import { CreatureContext } from '@/hooks/use-creature'
import { RollsLocked } from '@/hooks/use-rolls-locked'
import { TableApiContext, useTableRole } from '@/hooks/use-table-api'
import { favoriteEntries, favoriteKeys } from '@/utils/favorites'
import type { PaneRoller, PaneTable, SheetProvidersProps } from './types'

/**
 * A sheet's contexts, for a golden that draws a part of a sheet outside a pane (v0.43): those
 * CharacterPane gives what's inside it, made as it makes them, by the real hooks, over the sheet
 * and the seat given (TableApiContext, its rolls through `useTableRolls`, its 3D dice a provider
 * of their own). Each context a prop names is given that instead. What only a pane's own state
 * decides is left to CharacterPane, which a golden draws for it: an attack's or a use's picker,
 * why the table can't be asked (a description's `askBlocked`, `useBlocked`), and the spell
 * slots' dots, whose waits the pane keeps (`charging.slot`).
 */
export function SheetProviders({
  seat,
  ...props
}: Readonly<SheetProvidersProps>) {
  return (
    <TableApiContext value={seat}>
      <DiceRendererProvider>
        <PaneProviders {...props} />
      </DiceRendererProvider>
    </TableApiContext>
  )
}

/** The contexts, inside the seat's, as the pane nests them; given ones in place of its own. */
function PaneProviders({
  sheet,
  characterId = 'char-1',
  name,
  rollsToTable,
  rollFeatures,
  favorites,
  effects,
  wildShape,
  creature,
  locked = false,
  idPrefix = '',
  children,
  ...given
}: Readonly<Omit<SheetProvidersProps, 'seat'>>) {
  const { panel, ...made } = usePaneContexts({
    sheet,
    characterId,
    name,
    rollsToTable,
    rollFeatures,
    favorites,
    effects,
    wildShape,
    creature,
    locked,
    idPrefix,
  })
  const value = { ...made, ...given }
  return (
    <CreatureContext
      value={creature && { ...creature, character: creature.relation.of }}
    >
      <RollsLocked value={locked}>
        <SheetIdPrefix value={idPrefix}>
          <FavoriteMarks keys={value.marks}>
            <Favoriting value={value.favoriting}>
              <Effecting value={value.effecting}>
                <WildShaping value={value.wildShaping}>
                  <ConditionsOpener show={value.showConditions}>
                    <DescriptionLinks actions={value.descriptions}>
                      <Enchanting actions={value.enchanting}>
                        <Concentrating actions={value.concentrating}>
                          <Charging actions={value.charging}>
                            <Preparing value={value.preparing}>
                              {children as ReactNode}
                              {panel}
                            </Preparing>
                          </Charging>
                        </Concentrating>
                      </Enchanting>
                    </DescriptionLinks>
                  </ConditionsOpener>
                </WildShaping>
              </Effecting>
            </Favoriting>
          </FavoriteMarks>
        </SheetIdPrefix>
      </RollsLocked>
    </CreatureContext>
  )
}

/** What CharacterPane makes for each context, over a sheet, by the same hooks and sends. */
function usePaneContexts({
  sheet,
  characterId,
  name,
  rollsToTable,
  rollFeatures,
  favorites,
  effects,
  wildShape,
  creature,
  locked,
  idPrefix,
}: Readonly<
  Required<Pick<SheetProvidersProps, 'characterId' | 'locked'>> &
    Omit<SheetProvidersProps, 'seat' | 'children'>
>) {
  const table = useTableRolls(characterId, rollsToTable, rollFeatures)
  const role = useTableRole()
  const { sendFormula, sendRecharge } = table
  const formulaThrown = useCallback<
    NonNullable<Parameters<typeof useSheetRoller>[2]>
  >(
    (thrown, rolled) => {
      if (thrown.recharge) {
        sendRecharge({ label: thrown.label, counter: thrown.recharge }, rolled)
      } else {
        sendFormula(thrown, rolled)
      }
    },
    [sendFormula, sendRecharge],
  )
  const roller = useSheetRoller(table.send, table.sendDamage, formulaThrown)
  const { logFavorite, logPrepare, logEffect, logWildShape } = roller
  const shaped = sheet.form !== undefined
  const entries = useMemo(() => favoriteEntries(sheet), [sheet])
  const { sendFavorite, sendPrepare, sendEffect, sendWildShape } = table
  const favoriting = useFavorites({
    on: favorites === true && !creature && !shaped,
    favorites: sheet.favorites,
    entries,
    states: table.states,
    send: useCallback(
      (target, op, label) => {
        const logged = logFavorite(label, op)
        sendFavorite(logged, { ...target, op })
        return logged.id
      },
      [logFavorite, sendFavorite],
    ),
  })
  const preparing = usePreparing({
    on: table.lists('prepare') && !creature && role === 'player' && !shaped,
    spells: sheet.spells,
    states: table.states,
    send: useCallback(
      (spell, op) => {
        const logged = logPrepare(spell.name, op)
        sendPrepare(logged, { op, id: spell.id })
        return logged.id
      },
      [logPrepare, sendPrepare],
    ),
  })
  const effecting = useEffectControls({
    on: effects === true && !creature && role === 'player' && !shaped,
    character: name,
    effects: sheet.effects,
    states: table.states,
    send: useCallback(
      (effect, op, at) => {
        const logged = logEffect(effect.name, op, at)
        sendEffect(logged, effect)
        return logged.id
      },
      [logEffect, sendEffect],
    ),
  })
  const wildShaping = useWildShape({
    on: wildShape === true && !creature && role === 'player',
    pane: !creature,
    role,
    name,
    sheet,
    characterId,
    effects: effects === true,
    states: table.states,
    send: useCallback(
      (input, logged) => {
        const line = logWildShape(logged)
        sendWildShape(line, input)
        return line.id
      },
      [logWildShape, sendWildShape],
    ),
    read: table.readWildShapeForms,
    panel: useCallback(
      () =>
        document.querySelector<HTMLElement>(
          `#${CSS.escape(`${idPrefix}sheet-panel`)}`,
        ),
      [idPrefix],
    ),
  })
  const conditions = useConditionsPanel(sheet.conditions)
  const marks = useMemo(
    () => favoriteKeys(sheet.favorites, entries),
    [sheet.favorites, entries],
  )
  return {
    marks,
    favoriting,
    preparing,
    effecting,
    wildShaping,
    showConditions: conditions.show,
    panel: conditions.panel,
    descriptions: descriptionsOf({
      sheet,
      table,
      roller,
      locked,
      rollsToTable,
      showConditions: conditions.show,
    }),
    ...endingsOf(sheet, table, roller),
  }
}

/**
 * What the links in descriptions do, as the pane has them: its rolls thrown by the sheet's roller,
 * the table asked, and what the sheet says of the character.
 */
function descriptionsOf({
  sheet,
  table,
  roller: { roll, rollDamage, rollFormula, logAsk },
  locked,
  rollsToTable,
  showConditions,
}: Readonly<{
  sheet: SheetProvidersProps['sheet']
  table: PaneTable
  roller: PaneRoller
  locked: boolean
  rollsToTable?: SheetProvidersProps['rollsToTable']
  showConditions: NonNullable<SheetProvidersProps['showConditions']>
}>): NonNullable<SheetProvidersProps['descriptions']> {
  const unless =
    <T,>(run: (request: T) => unknown) =>
    (request: T) => {
      if (!locked) void run(request)
    }
  return {
    roll: unless(roll),
    rollDamage: unless(rollDamage),
    rollFormula: unless(rollFormula),
    takes: table.takes,
    ...(table.takes('textDamage') && {
      damage: {
        modifies: table.modifiesText && sheet.critical !== undefined,
        signed: table.signsText,
        ...(sheet.critical && { critical: sheet.critical }),
      },
    }),
    ask: ({ label, text, link }) => {
      if (locked || !table.takes('ask')) return
      table.sendAsk(logAsk(label), { text, link })
    },
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
    showConditions,
  }
}

/**
 * How enchantments and concentrations end, and counters are spent and Heroic Inspiration changed,
 * as the pane has them, while the game takes each.
 */
function endingsOf(
  sheet: SheetProvidersProps['sheet'],
  table: PaneTable,
  { logEnd, logCharge }: PaneRoller,
) {
  const enchanting: NonNullable<SheetProvidersProps['enchanting']> = {
    latestFor: table.latestFor,
    belongings: belongingsOf(sheet),
    ...(table.takes('endEnchantment') && {
      end: (item, { id, name: ended }, source) =>
        table.sendEnd(logEnd(ended), { item, effect: id }, source),
    }),
  }
  const concentrating: NonNullable<SheetProvidersProps['concentrating']> = {
    effects: sheet.concentration?.effects,
    ...(table.takes('endConcentration') && {
      end: ({ id, name: on }) =>
        table.sendEndConcentration(logEnd(`Concentration on ${on}`), id),
    }),
  }
  const charging: NonNullable<SheetProvidersProps['charging']> = {
    ...(table.takes('spend') && {
      spend: (counter, count, counterName) =>
        table.sendSpend(logCharge(counterName, { spent: count }), {
          counter,
          count,
        }),
    }),
    ...(table.takes('inspiration') && {
      inspire: inspiration =>
        table.sendInspiration(
          logCharge('Heroic Inspiration', { inspiration }),
          inspiration,
        ),
    }),
  }
  return { enchanting, concentrating, charging }
}
