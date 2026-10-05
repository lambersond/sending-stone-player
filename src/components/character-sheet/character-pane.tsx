'use client'

import { DiceRendererProvider } from '@lambersond/3d-dice-react'
import { CharacterSheet } from './character-sheet'
import { RollTray } from './roll-tray'
import { Scroller } from '@/components/scroller'
import { useSheetRoller } from '@/hooks/use-sheet-roller'
import type { TableSheet } from '@/types/table'

/**
 * The character's sheet, rolling 3D dice across the screen. The dice and their textures load
 * once the sheet is shown, and leave with it.
 */
export function CharacterPane(
  props: Readonly<{ name: string; sheet: TableSheet }>,
) {
  return (
    <DiceRendererProvider>
      <RollingSheet {...props} />
    </DiceRendererProvider>
  )
}

function RollingSheet({
  name,
  sheet,
}: Readonly<{ name: string; sheet: TableSheet }>) {
  const { roll, rolls, rolling } = useSheetRoller()
  return (
    <>
      <Scroller>
        <CharacterSheet
          name={name}
          sheet={sheet}
          onRoll={request => {
            void roll(request)
          }}
        />
      </Scroller>
      <RollTray rolls={rolls} rolling={rolling} />
    </>
  )
}
