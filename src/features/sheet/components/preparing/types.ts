import type { PrepareOp } from '@/types/sending-stone'

/** A spell row's Prepare or Unprepare: which, and whether it waits, as while it's on its way. */
export type PrepareChoice = {
  op: PrepareOp
  waiting: boolean
  choose: () => void
}
