'use client'

import { type ReactNode } from 'react'
import { Charging } from '../charging/charging'
import { Concentrating } from '../concentration/concentrating'
import { ConditionsOpener } from '../conditions/conditions-opener'
import { DescriptionLinks } from '../description-actions/description-links'
import { Effecting } from '../effect-controls/effecting'
import { Enchanting } from '../enchantments/enchanting'
import { FavoriteMarks } from '../favorite-mark/favorite-marks'
import { Favoriting } from '../favoriting/favoriting'
import { Preparing } from '../preparing/preparing'
import { WildShaping } from '../wild-shape/wild-shaping'
import type { ChargeActions } from '../charging/types'
import type { ConcentrationActions } from '../concentration/types'
import type { ShowConditions } from '../conditions/types'
import type { DescriptionActions } from '../description-actions/types'
import type { Effects } from '../effect-controls/types'
import type { EnchantActions } from '../enchantments/types'
import type { Favorites } from '../favoriting/types'
import type { Preparations } from '../preparing/types'
import type { WildShapeValue } from '../wild-shape/types'

/**
 * What every part of the sheet inside knows of it: which of what it lists are favorites, and from
 * module 0.37.0 how they're added and removed, and from module 0.39.0 how its own effects are
 * changed, and from module 0.40.0 its Wild Shape, how to open its conditions panel, what the
 * links in its descriptions do, how enchantments and concentrations end, and how counters are
 * spent and Heroic Inspiration changed; and from module 0.42.1 how its spells are prepared.
 */
export function SheetContext({
  marks,
  favoriting,
  preparing,
  effecting,
  wildShaping,
  showConditions,
  descriptions,
  enchanting,
  concentrating,
  charging,
  children,
}: Readonly<{
  marks: ReadonlySet<string>
  favoriting: Favorites
  preparing: Preparations
  effecting: Effects
  wildShaping: WildShapeValue
  showConditions: ShowConditions
  descriptions: DescriptionActions
  enchanting: EnchantActions
  concentrating: ConcentrationActions
  charging: ChargeActions
  children: ReactNode
}>) {
  return (
    <FavoriteMarks keys={marks}>
      <Favoriting value={favoriting}>
        <Effecting value={effecting}>
          <WildShaping value={wildShaping}>
            <ConditionsOpener show={showConditions}>
              <DescriptionLinks actions={descriptions}>
                <Enchanting actions={enchanting}>
                  <Concentrating actions={concentrating}>
                    <Charging actions={charging}>
                      <Preparing value={preparing}>{children}</Preparing>
                    </Charging>
                  </Concentrating>
                </Enchanting>
              </DescriptionLinks>
            </ConditionsOpener>
          </WildShaping>
        </Effecting>
      </Favoriting>
    </FavoriteMarks>
  )
}
