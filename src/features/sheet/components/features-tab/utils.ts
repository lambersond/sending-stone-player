import type { SheetAction, SheetFeature } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/** A feature as an action's row that rolls nothing, such as Wild Shape, its uses its own. */
export function plainAction(feature: SheetFeature): SheetAction {
  return {
    id: feature.id,
    name: feature.name,
    img: feature.img,
    type: 'feat',
    activation: feature.activation,
    range: feature.range ?? null,
    target: feature.target ?? null,
    toHit: null,
    attackId: null,
    activity: null,
    attackModes: null,
    ammunition: null,
    save: null,
    damage: [],
    uses: feature.uses,
    level: null,
    castFrom: null,
    concentration: feature.concentration ?? false,
    identified: true,
    text: feature.text,
  }
}

/** The name of what a group of features came from: its class, species or background. */
export function originName(sheet: TableSheet, id: string): string | undefined {
  if (id === 'species') return sheet.species ?? undefined
  if (id === 'background') return sheet.background ?? undefined
  return sheet.classes.find(entry => entry.identifier === id)?.name
}
