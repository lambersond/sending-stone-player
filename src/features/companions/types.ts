/** One of the switcher's creatures, as its tab shows it (v5). */
export type SwitcherCreature = {
  /** 'self' for the character; else the companion's key. */
  key: string
  /** Its own name, as the game names it: the character's, or the companion's ("Bat"). */
  name: string
  /**
   * A repeated name's number, for its badge: its tab is then named, titled and described as
   * `${name} ${number}` ("Bat 2").
   */
  number?: number
  portrait?: string
  /** A companion's kind; none for the character. */
  kind?: 'owned' | 'summoned'
  /** For a summoned one, the item it was summoned with. */
  from?: string
  /** No longer listed: kept until it has been shown and left (§8.3). */
  gone?: boolean
  /**
   * For the character, what it's transformed into, from module 0.40.0, as its accessible name
   * says it, chosen or not, before its news: ", in Wild Shape as a Wolf".
   */
  shape?: string
  /**
   * Its marks' words, joined, as its accessible name ends: ", its turn" and the like; "" for none.
   */
  news: string
}

/** One of the character's companions the game asks a save of, or dice, as its tab names it. */
export type CompanionAskRow = {
  key: string
  /** Its name as its tab says it, numbered where repeated, such as "Bat 2". */
  name: string
  /** What it's asked for, such as "Dexterity saving throw"; or for dice, what rolls them. */
  label: string
  /** Asked its player's dice, from module 0.45.0, not a save. */
  dice?: true
}
