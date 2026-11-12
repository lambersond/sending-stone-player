import { useCallback } from 'react'
import { useHitPointWaits } from './use-hit-point-waits'
import { useSlotWaits } from './use-slot-waits'
import { slotName } from '@/features/sheet/utils/slot-words'
import { capitalized } from '@/utils/wild-shape-words'
import type { Command, PaneRoller, PaneTable } from './types'
import type { ChargeActions } from '../charging/types'
import type { ConcentrationActions } from '../concentration/types'
import type { EnchantActions } from '../enchantments/types'
import type { Belonging } from '@/features/sheet/types'
import type {
  FavoriteTarget,
  WildShapeInput,
  WildShapeLogged,
} from '@/types/roll'
import type {
  EffectOp,
  PrepareOp,
  SheetEffect,
  SheetSpell,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/**
 * The commands a pane sends the game, each logged among its rolls as it's sent: once one is, the
 * tray shows its line whichever tab it's on (`acted`), Effects and Biography among them. Each is
 * the same steps: the tray told, its line logged, the line sent, its local id returned.
 */
export function usePaneCommands({
  table,
  roller,
  sheet,
  shaped,
  belongings,
  hitPoints,
  setActed,
}: Readonly<{
  table: PaneTable
  roller: PaneRoller
  sheet: TableSheet
  /** Whether the character is transformed, as by Wild Shape, whose slots wait then. */
  shaped: boolean
  /** What the character has that an enchantment may be put on. */
  belongings: ReadonlyMap<string, Belonging>
  /** Whether the player may set the hit points here (module 0.44.0), as `paneOffers` says. */
  hitPoints: boolean
  setActed: (acted: boolean) => void
}>) {
  const command = useCallback<Command>(
    (log, send, { acts = true } = {}) => {
      if (acts) setActed(true)
      const logged = log()
      send(logged)
      return logged.id
    },
    [setActed],
  )
  const {
    logFavorite,
    logPrepare,
    logEffect,
    logWildShape,
    logEnd,
    logCharge,
    logHitPoints,
  } = roller
  // Favorites added and removed from a row's menu, from module 0.37.0: a line among the rolls says
  // how it went, on whichever tab it was chosen, Effects among them.
  const { sendFavorite, sendPrepare, sendEffect, sendWildShape } = table
  const favoriteOf = useCallback(
    (target: FavoriteTarget, op: 'add' | 'remove', label: string) =>
      command(
        () => logFavorite(label, op),
        logged => sendFavorite(logged, { ...target, op }),
      ),
    [command, logFavorite, sendFavorite],
  )
  // The favorites put in order, from module 0.47.0: a line among the rolls says how it went,
  // named for what moved, as a favorite's.
  const orderOf = useCallback(
    (order: FavoriteTarget[], was: FavoriteTarget[], label: string) =>
      command(
        () => logFavorite(label, 'order'),
        logged => sendFavorite(logged, { op: 'order', order, was }),
      ),
    [command, logFavorite, sendFavorite],
  )
  // The character's spells prepared and unprepared from a row's menu, from module 0.42.1: a line
  // among the rolls says how it went, as for a favorite.
  const prepareOf = useCallback(
    (spell: SheetSpell, op: PrepareOp) =>
      command(
        () => logPrepare(spell.name, op),
        logged => sendPrepare(logged, { op, id: spell.id }),
      ),
    [command, logPrepare, sendPrepare],
  )
  // The character's own effects turned off, on and deleted, from module 0.39.0: a line among the
  // rolls says how it went, as for a favorite; from 0.42.1, one a roll made, beneath it.
  const effectOf = useCallback(
    (effect: SheetEffect, op: EffectOp, at?: number) =>
      command(
        () => logEffect(effect.name, op, at),
        logged => sendEffect(logged, effect),
      ),
    [command, logEffect, sendEffect],
  )
  // Wild Shape from here, from module 0.40.0: a line among the rolls says how each went, on
  // whichever tab.
  const wildShapeOf = useCallback(
    (
      input: Exclude<WildShapeInput, { op: 'forms' }>,
      logged: WildShapeLogged,
    ) =>
      command(
        () => logWildShape(logged),
        line => sendWildShape(line, input),
      ),
    [command, logWildShape, sendWildShape],
  )
  // Enchantments on the character's items, ended as dnd5e's chat card ends them, while the game
  // takes it, each item named as the sheet lists it; and each enchant activity's latest use, which
  // its switch follows.
  const enchanting: EnchantActions = {
    latestFor: table.latestFor,
    belongings,
    ...(table.takes('endEnchantment') && {
      end: (item, { id, name: ended }, source) =>
        command(
          () => logEnd(ended),
          logged => table.sendEnd(logged, { item, effect: id }, source),
        ),
    }),
  }
  // The character's concentrations, each ended as dnd5e's Break Concentration ends it, while the
  // game takes it from here, as it never does from the Gamemaster's page, where it would leave no
  // mark; nothing goes to the game's chat.
  const concentrating: ConcentrationActions = {
    effects: sheet.concentration?.effects,
    ...(table.takes('endConcentration') && {
      end: ({ id, name: on }) => {
        command(
          () => logEnd(`Concentration on ${on}`),
          logged => table.sendEndConcentration(logged, id),
        )
      },
    }),
  }
  // From module 0.42.1, one of the character's spell slots spent or restored from the dots, while
  // the game takes it from here, never while transformed, as the slots wait then: a line among the
  // rolls says how it went, on whichever tab, and each pool waits for the game once one is sent.
  const slotWaits = useSlotWaits(table.states, sheet.spells)
  // From module 0.44.0, the hit points and temporary hit points set from their tile, where the
  // campaign lets the player, whatever the rolls and this device's Send to the table: a line among
  // the rolls says how it went, on whichever tab, and the tile waits for the game once one is sent.
  const hitPointWaits = useHitPointWaits(table.states, sheet.hp)
  // A counter's charges spent directly, and Heroic Inspiration used or gained, while the game takes
  // them from here: each posts a line in the game's chat, the Gamemaster's marked as theirs.
  const charging: ChargeActions = {
    ...(table.takes('spend') && {
      spend: (counter, count, counterName) => {
        command(
          () => logCharge(counterName, { spent: count }),
          logged => table.sendSpend(logged, { counter, count }),
        )
      },
    }),
    ...(table.takes('inspiration') && {
      inspire: inspiration => {
        command(
          () => logCharge('Heroic Inspiration', { inspiration }),
          logged => table.sendInspiration(logged, inspiration),
        )
      },
    }),
    ...(table.takes('spellSlot') &&
      !shaped && {
        slot: (pool, op, from) => {
          if (slotWaits.waiting(pool.id)) return
          command(
            () => logCharge(capitalized(slotName(pool)), { slot: op }),
            logged => {
              table.sendSpellSlot(logged, { op, id: pool.id, from })
              slotWaits.sent(pool.id, { id: logged.id, op, from })
            },
          )
        },
        slotWaiting: slotWaits.waiting,
      }),
    ...(hitPoints && {
      hitPoints: change => {
        if (hitPointWaits.waiting) return
        command(
          () => logHitPoints(change),
          logged => {
            table.sendHitPoints(logged, change)
            hitPointWaits.sent({ id: logged.id, from: change.from })
          },
        )
      },
      hitPointsWaiting: hitPointWaits.waiting,
    }),
  }
  return {
    command,
    favoriteOf,
    orderOf,
    prepareOf,
    effectOf,
    wildShapeOf,
    enchanting,
    concentrating,
    charging,
  }
}
