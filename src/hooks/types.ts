import type { RollRequestInput, TableRollState } from '@/types/roll'

/** Send a request to the game and follow it, as `useFollow` gives it. */
export type Follow = (
  api: string,
  input: RollRequestInput,
  onState: (state: TableRollState) => void,
  onTaken?: (id: string) => void,
) => void
