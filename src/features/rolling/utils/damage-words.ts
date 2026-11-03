import type { DamageSubject, RollChoice } from '../types'
import type { SheetDamageRoll } from '@/types/roll'
import type { CriticalRule } from '@/types/sending-stone'

/** Damage's parts as a formula, as thrown: such as "2d12 + 4 Necrotic + 1d6 Fire". */
export function formulaOf(parts: SheetDamageRoll['parts']): string {
  return parts
    .map(({ terms, type }) => {
      const text = terms
        .map((term, index) => {
          const value =
            'sides' in term ? `${term.count}d${term.sides}` : String(term.flat)
          if (index === 0) return term.sign < 0 ? `−${value}` : value
          return `${term.sign < 0 ? '−' : '+'} ${value}`
        })
        .join(' ')
      return type ? `${text} ${type}`.trim() : text
    })
    .filter(Boolean)
    .join(' + ')
}

/**
 * What a critical hit's damage is, in a few words: every die twice, as dnd5e makes it by default,
 * or as the world's rules make it, such as under Powerful Critical; and where those rules change
 * its dice as only the game can add them up, such as Midi-QOL's at their highest, that it's the
 * game's.
 */
export function criticalHint(game: string, rule?: CriticalRule): string {
  const perDie = rule?.perDie ?? 2
  const times = perDie === 2 ? 'twice' : `${perDie} times`
  if (rule?.altered) {
    return perDie === 1
      ? `As ${game} rolls one.`
      : `Every die ${times}, as ${game} rolls one.`
  }
  const numbers = rule?.multiplyNumeric === true
  if (rule?.powerfulCritical) {
    return numbers
      ? 'Its dice, the most they could roll added, and every number twice.'
      : 'Its dice, and the most they could roll added.'
  }
  // Such as Midi-QOL's rule that adds only a weapon's own critical damage.
  if (perDie === 1) return `As ${game} rolls one.`
  return numbers ? `Every die and number ${times}.` : `Every die ${times}.`
}

/** What the menu calls each way, for damage or healing, rolled or used with a spell or feature. */
export function labelsFor({
  healing,
  verb,
}: DamageSubject): Partial<Record<RollChoice, string>> {
  const kind = healing ? 'healing' : 'damage'
  return verb
    ? {
        maximize: `${verb} with maximum ${kind}`,
        'modify-damage': `${verb} with ${kind} modified…`,
      }
    : { maximize: `Roll maximum ${kind}`, 'modify-damage': `Modify ${kind}…` }
}
