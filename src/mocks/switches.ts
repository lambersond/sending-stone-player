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

/** What a hello says of a kind of command with the campaign's switch off, the default. */
export const SWITCHED_OFF = {
  enabled: false,
  kinds: [],
  reason: 'off',
} as const

/** What a hello says of a kind of command under another system: off, and why. */
export const OTHER_SYSTEM = {
  enabled: false,
  kinds: [],
  reason: 'system',
} as const

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
