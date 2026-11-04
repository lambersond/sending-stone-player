import type { SpellSlotPool } from '@/features/sheet/utils/types'
import type { SpellSlotOp } from '@/types/sending-stone'

/** What a dot's confirm was opened to do, as the dots showed the pool when it was tapped. */
export type Asked = {
  pool: SpellSlotPool
  op: SpellSlotOp
  from: number
  max: number
}
