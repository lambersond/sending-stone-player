import type { SheetAction, SheetFeature } from '@/types/sending-stone'

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
