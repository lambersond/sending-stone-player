import type { TableView } from '@/types/table'

/**
 * What a hello says of a kind of command the game takes: on, for no reason, and what else it says
 * of it, such as the versions it takes.
 */
export function switchedOn<
  const Kind extends string,
  const More extends object = object,
>(kind: Kind, more?: More) {
  return { enabled: true, kinds: [kind], reason: null, ...more } as const
}

/**
 * What a hello says of a kind of command the game doesn't take: off, and why, with the campaign's
 * switch off (`off`, the default) or under another system (`system`), and what else it says of it.
 * Each call makes its own object, as `switchedOn`'s do.
 */
export function switchedOff<
  const Reason extends 'off' | 'system',
  const More extends object = object,
>(reason: Reason, more?: More) {
  return { enabled: false, kinds: [], reason, ...more } as const
}

/** A table view of Thorin's in The Lonely Mountain, as his player has it, live and connected. */
export function tableViewOf(fields: Partial<TableView> = {}): TableView {
  return {
    version: 7,
    live: true,
    campaign: { title: 'The Lonely Mountain' },
    connected: true,
    messages: [],
    ...fields,
  }
}
