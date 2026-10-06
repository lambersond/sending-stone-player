/**
 * The conditions of D&D's 2024 rules ("5.5e"), as the System Reference Document 5.2 gives them,
 * each with its rules. The opening line of each, "While you have the … condition, you experience
 * the following effects.", is left out.
 */

/** One of a condition's rules, such as Blinded's "Can’t See". */
export type ConditionRule = { title: string; text: string }

/** A condition and its rules. Its id is dnd5e's, as the sheet's conditions are. */
export type ConditionRules = {
  id: string
  name: string
  rules: ConditionRule[]
}

/** What conditions are, and how they last and combine. */
export const CONDITION_BASICS: { title?: string; text: string }[] = [
  {
    text: 'A condition is a temporary game state. The definition of a condition says how it affects its recipient, and various rules define how to end a condition.',
  },
  {
    title: 'Duration',
    text: 'A condition lasts either for a duration specified by the effect that imposed the condition or until the condition is countered (the Prone condition is countered by standing up, for example).',
  },
  {
    title: 'No Stacking',
    text: 'If multiple effects impose the same condition on you, each instance of the condition has its own duration, but the condition’s effects don’t get worse. Either you have a condition or you don’t. The Exhaustion condition is an exception; its effects get worse if you have the condition and receive it again.',
  },
]

/** Where the SRD 5.2 and its licence are, for the attribution it asks of a work that uses it. */
export const SRD_LINKS = {
  srd: 'https://www.dndbeyond.com/srd',
  licence: 'https://creativecommons.org/licenses/by/4.0/legalcode',
}

/** The conditions, in the SRD's order. */
export const CONDITIONS: ConditionRules[] = [
  {
    id: 'blinded',
    name: 'Blinded',
    rules: [
      {
        title: 'Can’t See',
        text: 'You can’t see and automatically fail any ability check that requires sight.',
      },
      {
        title: 'Attacks Affected',
        text: 'Attack rolls against you have Advantage, and your attack rolls have Disadvantage.',
      },
    ],
  },
  {
    id: 'charmed',
    name: 'Charmed',
    rules: [
      {
        title: 'Can’t Harm the Charmer',
        text: 'You can’t attack the charmer or target the charmer with damaging abilities or magical effects.',
      },
      {
        title: 'Social Advantage',
        text: 'The charmer has Advantage on any ability check to interact with you socially.',
      },
    ],
  },
  {
    id: 'deafened',
    name: 'Deafened',
    rules: [
      {
        title: 'Can’t Hear',
        text: 'You can’t hear and automatically fail any ability check that requires hearing.',
      },
    ],
  },
  {
    id: 'exhaustion',
    name: 'Exhaustion',
    rules: [
      {
        title: 'Exhaustion Levels',
        text: 'This condition is cumulative. Each time you receive it, you gain 1 Exhaustion level. You die if your Exhaustion level is 6.',
      },
      {
        title: 'D20 Tests Affected',
        text: 'When you make a D20 Test, the roll is reduced by 2 times your Exhaustion level.',
      },
      {
        title: 'Speed Reduced',
        text: 'Your Speed is reduced by a number of feet equal to 5 times your Exhaustion level.',
      },
      {
        title: 'Removing Exhaustion Levels',
        text: 'Finishing a Long Rest removes 1 of your Exhaustion levels. When your Exhaustion level reaches 0, the condition ends.',
      },
    ],
  },
  {
    id: 'frightened',
    name: 'Frightened',
    rules: [
      {
        title: 'Ability Checks and Attacks Affected',
        text: 'You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.',
      },
      {
        title: 'Can’t Approach',
        text: 'You can’t willingly move closer to the source of fear.',
      },
    ],
  },
  {
    id: 'grappled',
    name: 'Grappled',
    rules: [
      { title: 'Speed 0', text: 'Your Speed is 0 and can’t increase.' },
      {
        title: 'Attacks Affected',
        text: 'You have Disadvantage on attack rolls against any target other than the grappler.',
      },
      {
        title: 'Movable',
        text: 'The grappler can drag or carry you when it moves, but every foot of movement costs it 1 extra foot unless you are Tiny or two or more sizes smaller than it.',
      },
    ],
  },
  {
    id: 'incapacitated',
    name: 'Incapacitated',
    rules: [
      {
        title: 'Inactive',
        text: 'You can’t take any action, Bonus Action, or Reaction.',
      },
      { title: 'No Concentration', text: 'Your Concentration is broken.' },
      { title: 'Speechless', text: 'You can’t speak.' },
      {
        title: 'Surprised',
        text: 'If you’re Incapacitated when you roll Initiative, you have Disadvantage on the roll.',
      },
    ],
  },
  {
    id: 'invisible',
    name: 'Invisible',
    rules: [
      {
        title: 'Surprise',
        text: 'If you’re Invisible when you roll Initiative, you have Advantage on the roll.',
      },
      {
        title: 'Concealed',
        text: 'You aren’t affected by any effect that requires its target to be seen unless the effect’s creator can somehow see you. Any equipment you are wearing or carrying is also concealed.',
      },
      {
        title: 'Attacks Affected',
        text: 'Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don’t gain this benefit against that creature.',
      },
    ],
  },
  {
    id: 'paralyzed',
    name: 'Paralyzed',
    rules: [
      { title: 'Incapacitated', text: 'You have the Incapacitated condition.' },
      { title: 'Speed 0', text: 'Your Speed is 0 and can’t increase.' },
      {
        title: 'Saving Throws Affected',
        text: 'You automatically fail Strength and Dexterity saving throws.',
      },
      {
        title: 'Attacks Affected',
        text: 'Attack rolls against you have Advantage.',
      },
      {
        title: 'Automatic Critical Hits',
        text: 'Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.',
      },
    ],
  },
  {
    id: 'petrified',
    name: 'Petrified',
    rules: [
      {
        title: 'Turned to Inanimate Substance',
        text: 'You are transformed, along with any nonmagical objects you are wearing and carrying, into a solid inanimate substance (usually stone). Your weight increases by a factor of ten, and you cease aging.',
      },
      { title: 'Incapacitated', text: 'You have the Incapacitated condition.' },
      { title: 'Speed 0', text: 'Your Speed is 0 and can’t increase.' },
      {
        title: 'Attacks Affected',
        text: 'Attack rolls against you have Advantage.',
      },
      {
        title: 'Saving Throws Affected',
        text: 'You automatically fail Strength and Dexterity saving throws.',
      },
      { title: 'Resist Damage', text: 'You have Resistance to all damage.' },
      {
        title: 'Poison Immunity',
        text: 'You have Immunity to the Poisoned condition.',
      },
    ],
  },
  {
    id: 'poisoned',
    name: 'Poisoned',
    rules: [
      {
        title: 'Ability Checks and Attacks Affected',
        text: 'You have Disadvantage on attack rolls and ability checks.',
      },
    ],
  },
  {
    id: 'prone',
    name: 'Prone',
    rules: [
      {
        title: 'Restricted Movement',
        text: 'Your only movement options are to crawl or to spend an amount of movement equal to half your Speed (round down) to right yourself and thereby end the condition. If your Speed is 0, you can’t right yourself.',
      },
      {
        title: 'Attacks Affected',
        text: 'You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, that attack roll has Disadvantage.',
      },
    ],
  },
  {
    id: 'restrained',
    name: 'Restrained',
    rules: [
      { title: 'Speed 0', text: 'Your Speed is 0 and can’t increase.' },
      {
        title: 'Attacks Affected',
        text: 'Attack rolls against you have Advantage, and your attack rolls have Disadvantage.',
      },
      {
        title: 'Saving Throws Affected',
        text: 'You have Disadvantage on Dexterity saving throws.',
      },
    ],
  },
  {
    id: 'stunned',
    name: 'Stunned',
    rules: [
      { title: 'Incapacitated', text: 'You have the Incapacitated condition.' },
      {
        title: 'Saving Throws Affected',
        text: 'You automatically fail Strength and Dexterity saving throws.',
      },
      {
        title: 'Attacks Affected',
        text: 'Attack rolls against you have Advantage.',
      },
    ],
  },
  {
    id: 'unconscious',
    name: 'Unconscious',
    rules: [
      {
        title: 'Inert',
        text: 'You have the Incapacitated and Prone conditions, and you drop whatever you’re holding. When this condition ends, you remain Prone.',
      },
      { title: 'Speed 0', text: 'Your Speed is 0 and can’t increase.' },
      {
        title: 'Attacks Affected',
        text: 'Attack rolls against you have Advantage.',
      },
      {
        title: 'Saving Throws Affected',
        text: 'You automatically fail Strength and Dexterity saving throws.',
      },
      {
        title: 'Automatic Critical Hits',
        text: 'Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.',
      },
    ],
  },
]
