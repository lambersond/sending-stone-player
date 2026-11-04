import type { PrepareOp } from '@/types/sending-stone'

/** A spell row's Prepare or Unprepare: which, and whether it waits, as while it's on its way. */
export type PrepareChoice = {
  op: PrepareOp
  waiting: boolean
  choose: () => void
}

/** The last sent of a spell from here: its line's local id, the state it asked for, and which. */
export type SentSpell = { id: string; op: PrepareOp; spell: string }

/** What a pane offers of its character's spells: none where they can't be changed here. */
export type Preparations = {
  choiceFor: (id: string) => PrepareChoice | undefined
}
