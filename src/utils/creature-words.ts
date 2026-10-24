import type { SheetCreature } from '@/types/sending-stone'
import type { CreatureRelation } from '@/types/table'

/*
 * The words a creature's pane says of it (module 0.36.0): what it is, whose it is, its challenge
 * rating, a recharge, and whom it acts right after in initiative.
 */

/**
 * What a creature is, as dnd5e's NPC sheet says it: its size and type, then its alignment, such as
 * "Medium Beast, Unaligned" or "Tiny Fey", each part left out where it has none. None where it has
 * none of them, or isn't a creature.
 */
export function creatureLine(creature?: SheetCreature): string | undefined {
  if (!creature) return undefined
  const what = [creature.size, creature.type].filter(Boolean).join(' ')
  const line = [what, creature.alignment].filter(Boolean).join(', ')
  return line || undefined
}

/**
 * Whose a creature is: "Thorin’s companion" for one its player owns; "Summoned by Thorin", and
 * " with Find Familiar" where what summoned it is known, for a summoned one.
 */
export function relationWords(relation: CreatureRelation): string {
  if (relation.kind === 'owned') return `${relation.of}’s companion`
  const from = relation.from ? ` with ${relation.from}` : ''
  return `Summoned by ${relation.of}${from}`
}

/** A challenge rating's fractions, as dnd5e writes them. */
const FRACTIONS = new Map([
  [0.125, '1/8'],
  [0.25, '1/4'],
  [0.5, '1/2'],
])

/** A challenge rating as dnd5e writes it, such as "1/8" or "17"; none for none. */
export function crWords(cr: number | null): string | undefined {
  if (cr === null) return undefined
  return FRACTIONS.get(cr) ?? String(cr)
}

/**
 * What recharges uses, as dnd5e's stat block says it: "Recharge 5–6" from the lowest d6 that does,
 * or "Recharge 6" where only a 6 does.
 */
export function rechargeWords(recharge: number): string {
  return recharge === 6 ? 'Recharge 6' : `Recharge ${recharge}–6`
}

/** Whom a companion acts right after in initiative, such as "After Thorin". */
export function afterWords(name: string): string {
  return `After ${name}`
}
