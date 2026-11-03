import type { SpellSlotPool } from '../../utils/slot-words'
import type { SpellSlotOp } from '@/types/sending-stone'

/** What a dot's confirm was opened to do, as the dots showed the pool when it was tapped. */
export type Asked = {
  pool: SpellSlotPool
  op: SpellSlotOp
  from: number
  max: number
}
