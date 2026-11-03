'use client'

import { Sparkles } from 'lucide-react'
import { joinParts } from '../../utils/join-parts'
import { ActionEntry } from '../action-entry/action-entry'
import { enchantedEntry } from '../enchantments/enchanted-entry'
import { SheetEntry } from '../sheet-entry/sheet-entry'
import { UsesButton } from '../uses-button/uses-button'
import { useWildShapeRow } from '../wild-shape/use-wild-shape-row'
import { WildShapeAbout } from '../wild-shape/wild-shape-about'
import { rechargeWords } from '@/utils/creature-words'
import { featureAction } from '@/utils/sheet-actions'
import type { ActionRows } from '../action-entry/types'
import type { FavoriteTarget } from '@/types/roll'
import type {
  SheetFeature,
  SheetUses,
  SheetAction,
} from '@/types/sending-stone'

/**
 * A feature: how it's used and its uses left, opening to its description. Given the rows actions
 * are in, one that rolls shows what it rolls beside it, as an action does. Among the favorites, it
 * may show other uses in place of its own, such as those of a resource it stands for, with a note
 * first.
 */
export function FeatureEntry({
  characterId,
  feature,
  rows,
  uses,
  note,
  favorite,
  knownForms = false,
}: Readonly<{
  characterId: string
  feature: SheetFeature
  rows?: ActionRows
  /**
   * Uses to show in place of its own, only shown, and shown however narrow the list; null for
   * none.
   */
  uses?: SheetUses | null
  /** What to say of it first, such as the name of the resource it stands for. */
  note?: string
  /**
   * What its row's favorites entry adds or removes, from module 0.37.0: the feature, unless said;
   * null for none, as among the favorites for a resource's.
   */
  favorite?: FavoriteTarget | null
  /** On Features, Wild Shape's row offers Known forms… too (module 0.40.0). */
  knownForms?: boolean
}>) {
  const meta = joinParts(feature.kind, feature.requirements)
  // A 2024 druid's Wild Shape, from module 0.40.0, is drawn as an action's row, rolling nothing,
  // so that its controls sit at its end, never on what opens it, as they do on Actions.
  const wild = useWildShapeRow(feature.id)
  const action =
    rows &&
    (featureAction(feature) ?? (wild ? plainAction(feature) : undefined))
  if (rows && action) {
    return (
      <ActionEntry
        action={action}
        rows={rows}
        note={note}
        look={{
          meta,
          uses,
          ...(wild && {
            lead: <WildShapeAbout id={feature.id} />,
            knownForms,
          }),
        }}
        favorite={favorite}
      />
    )
  }
  const shown = uses === undefined ? feature.uses : uses
  return (
    <SheetEntry
      characterId={characterId}
      name={feature.name}
      img={feature.img}
      fallback={Sparkles}
      favoriteKey={`item:${feature.id}`}
      favorite={favorite}
      detail={joinParts(
        note,
        feature.activation ?? (feature.passive ? 'Passive' : undefined),
        // As dnd5e's stat block says a recharge, from module 0.36.0, not "Recharge [5+]".
        feature.uses?.recharge
          ? rechargeWords(feature.uses.recharge)
          : feature.uses?.recovery,
      )}
      aside={shown && <UsesButton uses={shown} name={feature.name} />}
      meta={meta}
      text={feature.text}
      origin={{ name: feature.name, item: feature.id }}
      {...enchantedEntry(feature)}
    />
  )
}

/** A feature as an action's row that rolls nothing, such as Wild Shape, its uses its own. */
function plainAction(feature: SheetFeature): SheetAction {
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
