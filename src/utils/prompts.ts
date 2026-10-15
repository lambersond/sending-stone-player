import { MIDI_PROMPT_GRACE, PROMPT_NOTICE_FOR } from '@/constants/sending-stone'
import {
  rollStatus,
  type HeldRollRequest,
  type RollRefusal,
} from '@/utils/roll-requests'
import type { RollRequestInput } from '@/types/roll'
import type { GamePrompt } from '@/types/sending-stone'
import type { PromptNotice, TablePrompt } from '@/types/table'

/*
 * Saving throws the Gamemaster's game asks of a player's character, such as a concentration check
 * after damage: held as the module described them, until it says they closed, or their time runs
 * out; shown to the character's player to roll here; and checked when they answer one. From module
 * 0.27.0, also what Midi-QOL asks of them while they're open in the app: saves, and ability and
 * skill checks, which Midi-QOL rolls as it has them rolled, once their time is up if not before.
 */

/** What a save the game asks for asks, as held. */
export type PromptData = Pick<
  GamePrompt,
  | 'type'
  | 'abilities'
  | 'skills'
  | 'dc'
  | 'label'
  | 'messageId'
  | 'source'
  | 'advantage'
  | 'askedInFoundry'
>

/** A save the game asks for, as held for its player to answer. */
export type HeldPrompt = {
  promptId: string
  actorId: string
  data: unknown
  expiresAt: Date
  closedAt: Date | null
  /** Why it closed, such as "answered" or "gone". */
  closedReason?: string | null
}

/** How a prompt Midi-QOL asked may close that its player is told of. */
const NOTICES: ReadonlySet<string> = new Set<PromptNotice>([
  'rolled',
  'expired',
])

/** A save the game asks for, as its player is shown it. */
export function toTablePrompt(
  prompt: Pick<HeldPrompt, 'promptId' | 'data' | 'expiresAt'> &
    Partial<Pick<HeldPrompt, 'closedAt' | 'closedReason'>>,
): TablePrompt {
  const data = prompt.data as PromptData
  const { type, abilities, skills, dc, label, source, advantage } = data
  const closed = prompt.closedAt ? prompt.closedReason : undefined
  return {
    id: prompt.promptId,
    type,
    abilities,
    ...(skills && { skills }),
    ...(dc !== null && dc !== undefined && { dc }),
    ...(label && { label }),
    expiresAt: prompt.expiresAt.toISOString(),
    ...(source && { source }),
    ...(advantage && Object.keys(advantage).length > 0 && { advantage }),
    ...(data.askedInFoundry === true && { askedInFoundry: true as const }),
    ...(closed && NOTICES.has(closed) && { closed: closed as PromptNotice }),
  }
}

/**
 * Of the saves the game asked of a character, as held lately, those its player is shown now: each
 * still open, until its time runs out; one Midi-QOL asks a while longer, until the module says
 * what became of it, which Midi-QOL is doing meanwhile; and one Midi-QOL asked that closed just now
 * other than as answered here or gone, to tell its player it was rolled in Foundry, or by
 * Midi-QOL.
 */
export function toTablePrompts(
  held: Pick<
    HeldPrompt,
    'promptId' | 'data' | 'expiresAt' | 'closedAt' | 'closedReason'
  >[],
  now = Date.now(),
): TablePrompt[] {
  return held.flatMap(prompt => {
    const midi = !!(prompt.data as PromptData).source
    const expires = prompt.expiresAt.getTime()
    const shown = prompt.closedAt
      ? midi &&
        NOTICES.has(prompt.closedReason ?? '') &&
        prompt.closedAt.getTime() > now - PROMPT_NOTICE_FOR
      : expires > now || (midi && expires > now - MIDI_PROMPT_GRACE)
    return shown ? [toTablePrompt(prompt)] : []
  })
}

/**
 * The saves still waiting for their player now, to answer: those still open whose time hasn't run
 * out.
 */
export function waitingPrompts(
  prompts: readonly TablePrompt[] = [],
  now = Date.now(),
): TablePrompt[] {
  return prompts.filter(
    ({ expiresAt, closed }) => !closed && Date.parse(expiresAt) > now,
  )
}

/**
 * Of the saves the game asks, those shown now, given when this page first saw each closing's
 * notice: those still waiting; what Midi-QOL asks a while after its time runs out, until the
 * module says what became of it; and each notice of how one closed, for a few seconds from when
 * this page first saw it, whatever the clocks say.
 * @param seen - When this page first saw each notice, by the prompt's id: one not yet seen shows.
 */
export function shownPrompts(
  prompts: readonly TablePrompt[],
  seen: ReadonlyMap<string, number>,
  now = Date.now(),
): TablePrompt[] {
  return prompts.filter(prompt => {
    if (prompt.closed) {
      return now < (seen.get(prompt.id) ?? now) + PROMPT_NOTICE_FOR
    }
    const expires = Date.parse(prompt.expiresAt)
    return (
      expires > now || (!!prompt.source && expires + MIDI_PROMPT_GRACE > now)
    )
  })
}

/**
 * Whether a prompt offers this roll, as what it asks for: a saving throw, for a save or
 * concentration check, with one of its abilities; an ability check, for an ability check, with one
 * of its abilities; and a skill check, for a skill check, with one of its skills.
 */
export function offers(
  prompt: Pick<PromptData, 'type' | 'abilities' | 'skills'>,
  { kind, key }: Pick<RollRequestInput, 'kind' | 'key'>,
): boolean {
  if (key === undefined) return false
  switch (prompt.type) {
    case 'save':
    case 'concentration': {
      return kind === 'save' && prompt.abilities.includes(key)
    }
    case 'check': {
      return kind === 'ability' && prompt.abilities.includes(key)
    }
    case 'skill': {
      return kind === 'skill' && (prompt.skills ?? []).includes(key)
    }
  }
}

/**
 * Can this saving throw answer what the game asked: is it asked of this character, still open,
 * rolled with one of the abilities it may be, and is no other answer to it on its way or made? Of
 * what Midi-QOL asks, which may be an ability or skill check, it must be of that kind, and rolled
 * as Midi-QOL has it rolled, never with advantage the player chose, nor anything added.
 * @param prompt - The save the game asked for, if held.
 * @param answers - The character's other answers to it.
 * @returns Why not, or nothing when it can.
 */
export function checkPrompt(
  input: RollRequestInput,
  prompt: Omit<HeldPrompt, 'promptId'> | null | undefined,
  actorId: string,
  answers: Pick<HeldRollRequest, 'status' | 'createdAt' | 'claimedAt'>[],
  now = Date.now(),
): RollRefusal | undefined {
  if (!prompt || prompt.actorId !== actorId || prompt.closedAt) return 'prompt'
  if (prompt.expiresAt.getTime() <= now) return 'prompt'
  const data = prompt.data as PromptData
  if (!offers(data, input)) return 'prompt'
  if (data.source && (input.explicit || input.extras.length > 0)) {
    return 'prompt'
  }
  const answering = answers.some(answer =>
    ['sending', 'rolling', 'done'].includes(rollStatus(answer, now)),
  )
  return answering ? 'prompt' : undefined
}
