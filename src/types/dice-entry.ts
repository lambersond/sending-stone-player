// What a player types in from their own physical dice, in place of the app's (module 0.32.0): the
// roller asks for a roll's dice once they're known, and the dice entry dialog asks the player.

/** The dice a player may type in: as the app throws them. */
export type DiceEntrySides = 4 | 6 | 8 | 10 | 12 | 20 | 100

/** One term's dice, a box each. */
export type DiceEntryTerm = {
  sides: DiceEntrySides
  /** How many: 1 to 40. */
  count: number
  /**
   * As its group is headed and named, such as "d20, advantage", "+1d4", "2d6 Slashing", or for a
   * die an effect adds, "Bless: +1d4".
   */
  label: string
  /**
   * A die one of the character's effects adds, or takes away, from module 0.42.0, or, from 0.42.1,
   * Elven Accuracy's third d20, which the game rolls where it's skipped: asked for, but the player
   * may skip it, for the game to roll it.
   */
  skippable?: true
  /**
   * A die the player may add, from module 0.42.1, such as Bardic Inspiration's: left out until they
   * add it, its control beside Done.
   */
  offered?: true
  /**
   * What adds it, such as "Bless" or "Elven Accuracy", which its Skip and the words of its skipping
   * name it by; or what offers it, such as "Bardic Inspiration", which its Add and Leave out do.
   */
  name?: string
}

/** A roll's dice for the player to type in. */
export type DiceEntry = {
  /** The roll's label, such as "Perception check": the dialog's title. */
  title: string
  terms: DiceEntryTerm[]
  /**
   * What the roll comes to with the dice typed so far, as it will be kept: a die not typed yet, or
   * not one of its faces, counts for nothing, and a term skipped has none.
   */
  total: (values: (number | undefined)[][]) => number
  /** For an answer to what the game asks: when it stops waiting, as an ISO time. */
  until?: string
  /** Aborted once what it answers is answered or closed elsewhere: the dialog then closes. */
  signal?: AbortSignal
  /**
   * Said under the dialog's subtitle, such as that the player rerolls at the table as their feature
   * says, from module 0.42.0.
   */
  note?: string
  /**
   * What the total leaves out while these terms, by their places, are skipped, said after it, such
   * as "not counting Bless’s d4", from module 0.42.0. Never asked of a die offered and left out,
   * which no game rolls.
   */
  skippedWords?: (skipped: number[]) => string
}

/**
 * Ask for a roll's dice, term by term, a term skipped, or a die offered and left out, giving `[]`;
 * undefined when the player cancelled, or it closed by itself.
 */
export type EnterDice = (entry: DiceEntry) => Promise<number[][] | undefined>
