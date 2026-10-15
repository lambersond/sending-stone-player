/** D&D Fifth Edition's ability, skill and tool ids, as the system records them on rolls. */

export const ABILITIES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

export const SKILLS: Record<string, string> = {
  acr: 'Acrobatics',
  ani: 'Animal Handling',
  arc: 'Arcana',
  ath: 'Athletics',
  dec: 'Deception',
  his: 'History',
  ins: 'Insight',
  itm: 'Intimidation',
  inv: 'Investigation',
  med: 'Medicine',
  nat: 'Nature',
  prc: 'Perception',
  prf: 'Performance',
  per: 'Persuasion',
  rel: 'Religion',
  slt: 'Sleight of Hand',
  ste: 'Stealth',
  sur: 'Survival',
}

/**
 * dnd5e's damage and healing types, by its keys, with its English labels: the short ones where it
 * has them, as its own damage card shows them. For a roll the module sent no label for.
 */
export const DAMAGE_TYPE_LABELS: Record<string, string> = {
  acid: 'Acid',
  bludgeoning: 'Bludgeoning',
  cold: 'Cold',
  fire: 'Fire',
  force: 'Force',
  lightning: 'Lightning',
  necrotic: 'Necrotic',
  piercing: 'Piercing',
  poison: 'Poison',
  psychic: 'Psychic',
  radiant: 'Radiant',
  slashing: 'Slashing',
  thunder: 'Thunder',
  healing: 'Healing',
  temphp: 'Temp HP',
  maximum: 'Max HP',
  // Midi-QOL's own type for damage of no type, as it labels it.
  none: 'No Type',
}

/**
 * The tools dnd5e checks, by its keys, with the names of its 2024 base items, as its own links
 * name them; and the vehicles it checks as tools. For a tool the sheet doesn't name.
 */
export const TOOLS: Record<string, string> = {
  alchemist: "Alchemist's Supplies",
  bagpipes: 'Bagpipes',
  brewer: "Brewer's Supplies",
  calligrapher: "Calligrapher's Supplies",
  card: 'Playing Cards',
  carpenter: "Carpenter's Tools",
  cartographer: "Cartographer's Tools",
  chess: 'Dragonchess',
  cobbler: "Cobbler's Tools",
  cook: "Cook's Utensils",
  dice: 'Dice',
  disg: 'Disguise Kit',
  drum: 'Drum',
  dulcimer: 'Dulcimer',
  flute: 'Flute',
  forg: 'Forgery Kit',
  glassblower: "Glassblower's Tools",
  herb: 'Herbalism Kit',
  horn: 'Horn',
  jeweler: "Jeweler's Tools",
  leatherworker: "Leatherworker's Tools",
  lute: 'Lute',
  lyre: 'Lyre',
  mason: "Mason's Tools",
  navg: "Navigator's Tools",
  painter: "Painter's Supplies",
  panflute: 'Pan Flute',
  pois: "Poisoner's Kit",
  potter: "Potter's Tools",
  shawm: 'Shawm',
  smith: "Smith's Tools",
  thief: "Thieves' Tools",
  tinker: "Tinker's Tools",
  viol: 'Viol',
  weaver: "Weaver's Tools",
  woodcarver: "Woodcarver's Tools",
  air: 'Air Vehicle',
  land: 'Land Vehicle',
  space: 'Space Vehicle',
  water: 'Water Vehicle',
}
