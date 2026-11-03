import type { SheetDamageRoll } from '@/types/roll'

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
