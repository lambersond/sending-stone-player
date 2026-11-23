import { COOKBOOK_VERSIONS } from '@/constants/cookbook'
import { OWN_KINDS } from '@/constants/roll-kinds'
import { COMPANION_UNTAKEN, ROLL_KINDS } from '@/constants/sending-stone'
import type { BridgeFeatures } from '@/types/sending-stone'

// What a module's hello says the campaign does, as the campaign keeps it: replaced whole on every
// hello, so what a module before a feature says nothing of is cleared.

/**
 * What else the game does with players' rolls, as a hello says it, in the order the campaign keeps
 * them: from module 0.13.0, take damage a player changed, and ask players for the saves their game
 * asks of them; from module 0.16.0, make area attacks at the combatants players pick; from module
 * 0.21.0, make a check an activity asks for, the player's own, against it, and change a
 * description's damage only on a die it adds; from module 0.22.0, make a use at its user; from
 * module 0.23.0, make the Gamemaster's rolls as a character, marked as theirs; from module 0.25.0,
 * list the messages each of those made in its result, which only this listener reads, never a
 * viewer; from module 0.26.0, let players enter their own dice's results; from module 0.27.0, ask
 * here what Midi-QOL asks of characters, which nothing reads yet; from module 0.41.0, let damage on
 * its own name its choices and spend what it uses, and ask companions for the saves the game asks
 * of them; and from module 0.42.0, take a typed roll's effects' dice, and keep its rerolls; and
 * from module 0.44.0, ask a typing player for the dice the game rolls later in their roll's run.
 */
export const HELLO_ROLL_FLAGS = [
  'modifiers',
  'prompts',
  'areaAttacks',
  'activityChecks',
  'signedDice',
  'selfTargets',
  'gmRolls',
  'gmRollMessages',
  'manualDice',
  'midiPrompts',
  'aloneChoices',
  'companionPrompts',
  'effectDice',
  'keptRerolls',
  'diceAsks',
] as const

/**
 * What else the game does with moves, as a hello says it, in the order the campaign keeps them:
 * from module 0.32.0, a party's things sent elsewhere by its Owner, and its coin distributed; from
 * module 0.49.0, a character's coins handed out, and its giver paying with other coins where it's
 * short of one; and from module 0.51.0, a hand-out giving to the campaign's parties too.
 */
const HELLO_TRANSFER_FLAGS = [
  'partySends',
  'distribute',
  'handOut',
  'change',
  'handOutParties',
] as const

/** Whether a hello says a feature of its own is on, and takes this kind of command. */
export function kindOn(
  feature: { enabled: boolean; kinds?: string[] } | null | undefined,
  kind: string,
): boolean {
  return feature?.enabled === true && (feature.kinds ?? []).includes(kind)
}

/**
 * The campaign's switches and what else its game does, as a hello says them, in the order the
 * campaign keeps them; replaced whole on every hello, so a module before a feature, which says
 * nothing of it, clears it.
 */
export function helloCampaignData(features: BridgeFeatures | null | undefined) {
  // Whether its players may move items and coins from here, from module 0.31.0, apart from the
  // rolls. A module before it says nothing of them, which clears it.
  const transfersOn = kindOn(features?.transfers, 'transfer')
  // Whether the campaign takes dishes from the Magical Recipe Book, from module 0.38.0, by its own
  // switch under dnd5e 5.
  const dishesOn = kindOn(features?.dishes, 'dish')
  // Whether its players may add coins to their characters and take them away from here, from
  // module 0.49.0, by its own switch under dnd5e.
  const coinsOn = kindOn(features?.coins, 'coins')
  // Whether the campaign's players see how hurt other creatures are, from module 0.50.0, by its
  // own switch under dnd5e. It isn't a command, so it has no kinds.
  const healthOn = features?.health?.enabled === true
  return {
    // Whether its players may roll in the game from here. A module before 0.10.0 can't make their
    // rolls, and says nothing of them.
    rollsEnabled: features?.rolls?.enabled === true,
    // A move of items and coins, a removal, a favorite, from module 0.39.0 an effect changed, from
    // module 0.40.0 Wild Shape, from module 0.44.0 hit points set, or from module 0.49.0 coins
    // added or taken away, is never one of the rolls, even where a module says so: each has its
    // own feature. A plain roll, from module 0.44.0, is one of them.
    rollKinds: (features?.rolls?.kinds ?? []).filter(
      kind =>
        (ROLL_KINDS as readonly string[]).includes(kind) &&
        !(OWN_KINDS as readonly string[]).includes(kind),
    ),
    rollFeatures: HELLO_ROLL_FLAGS.filter(
      flag => features?.rolls?.[flag] === true,
    ),
    transfersEnabled: transfersOn,
    // What else it does with moves, from module 0.32.0, from module 0.49.0 whether a character's
    // coins may be handed out ('handOut') and a giver short of a coin pays with its other coins
    // ('change'), and from module 0.51.0 whether it may give to parties too ('handOutParties');
    // nothing while moves are off, and a module before each says nothing of it, which clears it.
    transferFeatures: transfersOn
      ? HELLO_TRANSFER_FLAGS.filter(
          flag => features?.transfers?.[flag] === true,
        )
      : [],
    // Whether the module removes characters' items for the app, from module 0.33.0, with no
    // switch: a module before it says nothing of them, which clears it.
    removalsEnabled: kindOn(features?.removals, 'remove'),
    // Whether the module adds and removes characters' favorites for the app, from module 0.37.0,
    // with no switch: a module before it says nothing of them, which clears it.
    favoritesEnabled: kindOn(features?.favorites, 'favorite'),
    // What else it does with favorites, from module 0.47.0: 'orders' where it puts them in the
    // order the app sends; nothing while favorites are off, and a module before it says nothing,
    // which clears it.
    favoriteFeatures:
      kindOn(features?.favorites, 'favorite') &&
      features?.favorites?.orders === true
        ? ['orders']
        : [],
    // Whether the module takes dishes from the Magical Recipe Book for the app, and which body
    // versions, from module 0.38.0, by its own switch under dnd5e 5: a module before it says
    // nothing of dishes, which clears both.
    dishesEnabled: dishesOn,
    dishVersions: dishesOn
      ? (features?.dishes?.versions ?? []).filter(version =>
          (COOKBOOK_VERSIONS as readonly number[]).includes(version),
        )
      : [],
    // Whether the campaign lets its players turn off, turn on and delete their own characters'
    // effects from here, from module 0.39.0, by its own switch under dnd5e: a module before it
    // says nothing of them, which clears it.
    effectsEnabled: kindOn(features?.effects, 'effect'),
    // Whether the campaign lets its players use Wild Shape from here, from module 0.40.0, by its
    // own switch under dnd5e: a module before it says nothing of it, which clears it.
    wildShapeEnabled: kindOn(features?.wildShape, 'wildShape'),
    // Whether the campaign lets its players set hit points and temporary hit points from here, of
    // their characters, forms and companions, from module 0.44.0, by its own switch under dnd5e,
    // apart from the rolls: a module before it says nothing of them, which clears it.
    hitPointsEnabled: kindOn(features?.hitPoints, 'hitPoints'),
    // Whether the campaign lets its players add coins to their characters and take them away from
    // here, from module 0.49.0, by its own switch under dnd5e, apart from the rolls and the moves:
    // a module before it says nothing of them, which clears it.
    coinsEnabled: coinsOn,
    // What else it does with them: 'change' where a character short of a coin pays with its other
    // coins; nothing while they're off.
    coinFeatures: coinsOn && features?.coins?.change === true ? ['change'] : [],
    // Whether the campaign's players see how hurt other creatures are, from module 0.50.0, by its
    // own switch under dnd5e, and whether their hit points too: a module before it says nothing,
    // which clears both.
    healthEnabled: healthOn,
    healthFeatures:
      healthOn && features?.health?.hitPoints === true ? ['hitPoints'] : [],
    // Whether the module keeps journal notes for the app, from module 0.34.0, with no switch: a
    // module before it says nothing of them, which clears it.
    notesEnabled: kindOn(features?.notes, 'personal'),
    // What else the module does with journal notes, from module 0.35.0: 'orders' where it takes
    // the app's orders of a group's notes. A module before it says nothing, which clears it.
    noteFeatures:
      features?.notes?.enabled === true && features.notes.orders === true
        ? ['orders']
        : [],
    // Whether Tidy 5e Sheets is active, and its version, from module 0.44.0, under dnd5e, where
    // it's installed or a character holds its journal's entries: a module before it, or a hello
    // that says nothing of Tidy, clears both.
    tidyActive: features?.notes?.tidy?.active ?? null,
    tidyVersion: features?.notes?.tidy?.version ?? null,
  }
}

/**
 * How its characters' companions roll, as a hello says it (module 0.36.0): the kinds a companion's
 * rolls may be, never one no companion's is, nor one this app doesn't know, nor one with a switch
 * of its own, as hit points set from module 0.44.0, which a companion takes wherever its own
 * feature does, or coins from module 0.49.0, which none takes; and how they enter initiative, each
 * its own roll unless the module says otherwise. A module before it says nothing of them, which
 * clears the first and sets the second back to its own roll. And from module 0.51.0, whether it
 * lists companions on every scene, each saying whether it's away, for Help: only where it says so;
 * and from module 0.54.0 whether it lists the Gamemaster's constant companions, the same way.
 */
export function helloCompanionData(
  features: BridgeFeatures | null | undefined,
) {
  return {
    companionKinds: (features?.companions?.kinds ?? []).filter(
      kind =>
        (ROLL_KINDS as readonly string[]).includes(kind) &&
        !(COMPANION_UNTAKEN as readonly string[]).includes(kind) &&
        !(OWN_KINDS as readonly string[]).includes(kind),
    ),
    companionInitiative:
      features?.companions?.initiative === 'after' ? 'after' : 'own',
    companionsAway: features?.companions?.away === true,
    companionsConstant: features?.companions?.constant === true,
  }
}
