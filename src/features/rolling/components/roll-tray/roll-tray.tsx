import { rollsName } from '../../utils/tray-words'
import { RollHistory } from './roll-history'
import { useCreature } from '@/hooks/use-creature'
import type { TableRolls } from '../../types'
import type { LocalRoll } from '@/types/roll'

/**
 * The player's rolls, newest first, in a banner at the bottom of the sheet, as `RollHistory` has
 * them, where the player has their rolls shown so rather than as toasts.
 */
export function RollTray({
  rolls,
  rolling,
  table,
  announce = true,
}: Readonly<{
  rolls: LocalRoll[]
  rolling: boolean
  table?: TableRolls
  announce?: boolean
}>) {
  const creature = useCreature()
  return (
    <section
      aria-label={rollsName(creature)}
      className='shrink-0 border-t border-border bg-card px-4 py-3 md:px-8'
    >
      <RollHistory
        rolls={rolls}
        rolling={rolling}
        table={table}
        announce={announce}
        className='mx-auto max-w-5xl'
      />
    </section>
  )
}
