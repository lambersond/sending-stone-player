import { numberedNames } from '@/utils/companion-row'
import type { OwnedCampaign } from '@/types/campaign'

/**
 * Whether the players' rolls are made in the Gamemaster's game, and if not, how they could be; and
 * whether they're asked here for the saves the game asks of them.
 */
export function rollsText(campaign: OwnedCampaign): string {
  const { rolls } = campaign
  const made = madeText(campaign)
  return rolls.enabled && rolls.reaching && rolls.prompts
    ? `${made} When your game asks one of their characters for a saving throw, such as a concentration check, its player is asked here to roll it.`
    : made
}

/** Whether the players' rolls are made in the Gamemaster's game, and if not, how they could be. */
function madeText({ rolls }: OwnedCampaign): string {
  if (rolls.enabled && rolls.reaching && rolls.spells) {
    return 'Checks, saves, initiative, death saves, attacks and spells your players roll and cast here are made in your game too, with the same dice. Their attacks, spells and features spend ammunition, uses and spell slots there.'
  }
  if (rolls.enabled && rolls.reaching && rolls.attacks) {
    return 'Checks, saves, initiative, death saves and attacks your players roll here are made in your game too, with the same dice. Their attacks spend ammunition, uses and spell slots there.'
  }
  if (rolls.enabled && rolls.reaching) {
    return 'Checks, saves, initiative and death saves your players roll here are made in your game too, with the same dice. Their attacks and spells stay here: to have them made in your game too, tick Attacks, spells and features on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
  }
  if (rolls.enabled) {
    return 'Turned on in Foundry. Players’ rolls reach your game while it’s open; for now they stay here.'
  }
  return 'They stay here. To have them made in your game with the same dice, tick Players roll in the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
}

/**
 * Whether the players move items and coins from here, from module 0.31.0, and if not, how they
 * could: with a module before that, which has no such setting, by updating it first.
 */
export function movesText({ transfers, foundry }: OwnedCampaign): string {
  if (transfers.enabled && transfers.reaching) {
    return 'Your players take from and give to the parties they own in Foundry, and give to each other, from here. Each move is made in your game at once and posts a line in its chat.'
  }
  if (transfers.enabled) {
    return 'Turned on in Foundry. Moves reach your game while it’s open.'
  }
  if (before(foundry?.module?.version, MOVES_FROM)) {
    return 'Players can’t move items and coins from here. Sending Stone 0.31.0 or later in Foundry lets them.'
  }
  return 'Players can’t move items and coins from here. To let them, tick Players move items and coins on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
}

/** The first Sending Stone in Foundry that moves items and coins: major, minor and patch. */
const MOVES_FROM = [0, 31, 0] as const

/**
 * Whether the game takes dishes from the Magical Recipe Book, from module 0.38.0, and if not, why:
 * a module before that, which has no such switch, says nothing of dishes; nor does one under
 * another system than dnd5e 5, where the switch does nothing. The app keeps only whether they're
 * on, so the system is read from the hello's own, which the snapshot keeps: without it, a switch
 * ticked under dnd5e 6 would read as unticked. Which players see a dish's card is the module's
 * doing too: before 0.39.0 only Gamemasters do, and the app ships first.
 */
export function dishesText({ dishes, foundry }: OwnedCampaign): string {
  if (dishes?.enabled && before(foundry?.module?.version, DISHES_SHOWN_FROM)) {
    return 'On in Foundry. Players send dishes from the Magical Recipe Book, and each reaches you as a card only Gamemasters see.'
  }
  if (dishes?.enabled) {
    return 'On in Foundry. Players send dishes from the Magical Recipe Book, and each reaches your game as a card its players see too; you choose who ate it.'
  }
  if (before(foundry?.module?.version, DISHES_FROM)) {
    return 'Your Sending Stone module doesn’t take dishes yet. Version 0.38.0 or later does.'
  }
  const system = foundry?.system
  if (system && !(system.id === 'dnd5e' && system.version.startsWith('5.'))) {
    return 'Off. Dishes need dnd5e 5.x in Foundry for now.'
  }
  return 'Off. To take dishes, tick Dishes from the Magical Recipe Book on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
}

/** The first Sending Stone in Foundry that takes dishes from the Magical Recipe Book. */
const DISHES_FROM = [0, 38, 0] as const

/** The first Sending Stone in Foundry that shows a dish's card to the campaign's players too. */
const DISHES_SHOWN_FROM = [0, 39, 0] as const

/**
 * What the campaign's players' chat here holds (v0.44), which its Gamemaster may clear; and that
 * Foundry's own Clear Chat Log clears it too.
 */
export function chatText({ chat }: OwnedCampaign): string {
  if (chat.messages === 0) return 'No messages in your players’ chat here.'
  const [count, them] =
    chat.messages === 1
      ? ['1 message', 'it']
      : [`${chat.messages} messages`, 'them']
  return `${count} in your players’ chat here. Clearing Foundry’s chat log clears ${them} too.`
}

/**
 * Whether the campaign lets its players turn off and delete their own characters' effects from
 * here, from module 0.39.0, and if not, why: a module before that has no such switch; under
 * another system than D&D Fifth Edition the switch does nothing, which the hello's own system says.
 */
export function effectsText({ effects, foundry }: OwnedCampaign): string {
  if (effects?.enabled) {
    return 'On in Foundry. Your players turn off and delete the effects their party put on their own characters from here, and turn off an item’s temporary effect such as Rage: never one from a monster or one made on the sheet, a condition or a concentration.'
  }
  if (before(foundry?.module?.version, EFFECTS_FROM)) {
    return 'Your Sending Stone module doesn’t let players change their effects yet. Version 0.39.0 or later does.'
  }
  if (foundry?.system && foundry.system.id !== 'dnd5e') {
    return 'Off. Players’ effects need D&D Fifth Edition in Foundry.'
  }
  return 'Off. To let them, tick Allow Players to disable & remove their own active effects on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
}

/** The first Sending Stone in Foundry that lets players change their own effects. */
const EFFECTS_FROM = [0, 39, 0] as const

/**
 * Whether the campaign lets its players use Wild Shape from here, from module 0.40.0, and if not,
 * why: a module before that has no such switch; under another system than D&D Fifth Edition the
 * switch does nothing, which the hello's own system says.
 */
export function wildShapeText({ wildShape, foundry }: OwnedCampaign): string {
  if (wildShape?.enabled) {
    return 'On in Foundry. Your players’ druids change from here into the Beasts they know and back, by the 2024 rules: a use each time, for half their druid level in hours. They choose their known forms here too, one replaced after each Long Rest.'
  }
  if (before(foundry?.module?.version, WILD_SHAPE_FROM)) {
    return 'Your Sending Stone module doesn’t take Wild Shape yet. Version 0.40.0 or later does.'
  }
  if (foundry?.system && foundry.system.id !== 'dnd5e') {
    return 'Off. Wild Shape needs D&D Fifth Edition in Foundry.'
  }
  return 'Off. To let them, tick Allow Players to use Wild Shape from the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
}

/** The first Sending Stone in Foundry that takes Wild Shape from here. */
const WILD_SHAPE_FROM = [0, 40, 0] as const

/**
 * Whether the campaign lets its players set hit points and temporary hit points from here, from
 * module 0.43.0, and if not, why: a module before that has no such switch; under another system
 * than D&D Fifth Edition the switch does nothing, which the hello's own system says.
 */
export function hitPointsText({ hitPoints, foundry }: OwnedCampaign): string {
  if (hitPoints?.enabled) {
    return 'On in Foundry. Your players set their characters’, forms’ and companions’ hit points and temporary hit points from here.'
  }
  if (before(foundry?.module?.version, HIT_POINTS_FROM)) {
    return 'Your Sending Stone module doesn’t let players change hit points yet. Version 0.43.0 or later does.'
  }
  if (foundry?.system && foundry.system.id !== 'dnd5e') {
    return 'Off. Players’ hit points need D&D Fifth Edition in Foundry.'
  }
  return 'Off. To let them, tick Allow Players to change their hit points from the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
}

/** The first Sending Stone in Foundry that lets players set hit points from here. */
const HIT_POINTS_FROM = [0, 43, 0] as const

/**
 * Is a module's version, as its hello said it, known to be before this one? One it doesn't say,
 * or that doesn't read as major.minor.patch, isn't.
 */
function before(
  version: string | null | undefined,
  than: readonly number[],
): boolean {
  const parts = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? '')
  if (!parts) return false
  const numbers = parts.slice(1).map(Number)
  const differs = numbers.findIndex((part, index) => part !== than[index])
  return differs !== -1 && numbers[differs] < than[differs]
}

/**
 * A character's companions as its card lists them (module 0.36.0): "Companions: Brakka, Bat 1
 * (summoned), Bat 2 (summoned)", in the module's order, a repeated name numbered as a fresh row of
 * tabs numbers it. None where it has none.
 */
export function companionsLine(
  companions: OwnedCampaign['characters'][number]['companions'] = [],
): string | undefined {
  if (companions.length === 0) return undefined
  const { names } = numberedNames(
    companions.map(({ name }, index) => ({ key: String(index), name })),
    new Map(),
  )
  const listed = companions.map(
    ({ kind }, index) =>
      `${names.get(String(index))}${kind === 'summoned' ? ' (summoned)' : ''}`,
  )
  return `Companions: ${listed.join(', ')}`
}
