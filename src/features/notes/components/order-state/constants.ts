import type { NoteOrderState } from '@/types/notes'

/** The states an order didn't reach Foundry in, which its chip warns of. */
export const WARNS = new Set<NoteOrderState>(['conflict', 'failed'])
