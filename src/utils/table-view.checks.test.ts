/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { toTableMessage, toTableMessages, type Viewer } from './table-view'
import { chatMessage } from '@/mocks/sending-stone'
import type { Dnd5eCheck, SerializedMessage } from '@/types/sending-stone'

// A check, from module 0.30.0, as the chat shows it: its own creature, saying whether it succeeded
// where the viewer may know, as a save rolled from a card does.

const viewer: Viewer = {
  actorId: 'actor-thorin',
  party: new Set(['actor-thorin', 'actor-vex']),
}

const dnd5e = (
  fields: Partial<NonNullable<SerializedMessage['dnd5e']>>,
): SerializedMessage['dnd5e'] => ({
  messageType: 'roll',
  roll: null,
  item: null,
  activity: null,
  targets: [],
  ...fields,
})

/** A roll request card asking Thorin and Vex for a Perception check. */
const request = chatMessage({
  id: 'request',
  timestamp: 1000,
  dnd5e: dnd5e({
    messageType: 'request',
    targets: [
      { name: 'Thorin Oakenshield', uuid: 'Actor.thorin' },
      { name: 'Vex', uuid: 'Actor.vex' },
    ],
  }),
})

/** A check rolled by a creature, from the card or else from nowhere, such as a [[/check]] link. */
const checked = (
  id: string,
  speaker: string,
  check?: Dnd5eCheck,
  card: string | null = 'request',
) =>
  chatMessage({
    id,
    timestamp: 2000,
    speaker: { alias: speaker, actorId: null },
    rolls: [{ formula: '1d20 + 5', total: 17, dice: [] }],
    dnd5e: dnd5e({
      roll: { type: 'skill', skillId: 'prc' },
      originatingMessage: card,
      ...(check && { check }),
    }),
  })

const shown = (messages: SerializedMessage[], seen: Viewer = viewer) =>
  Object.fromEntries(
    toTableMessages(messages, seen).map(({ id, targets }) => [id, targets]),
  )

describe('utils/table-view for checks, from module 0.30.0', () => {
  it('names its creature alone, as the card names it, with whether it succeeded', () => {
    const messages = shown([
      request,
      checked('thorin', 'Thorin', {
        target: 'Actor.thorin',
        outcome: 'success',
      }),
      checked('vex', 'Vex', { target: 'Actor.vex', outcome: 'failure' }),
    ])

    expect(messages.thorin).toEqual([
      { name: 'Thorin Oakenshield', check: 'success' },
    ])
    expect(messages.vex).toEqual([{ name: 'Vex', check: 'failure' }])
  })

  it('names a creature the card never named, or one with no card, as it speaks', () => {
    const messages = shown([
      request,
      checked('bat', 'Bat', { target: 'Actor.bat', outcome: 'success' }),
      checked(
        'link',
        'Thorin',
        { target: 'Actor.thorin', outcome: 'failure' },
        null,
      ),
    ])

    expect(messages.bat).toEqual([{ name: 'Bat', check: 'success' }])
    expect(messages.link).toEqual([{ name: 'Thorin', check: 'failure' }])
  })

  it('keeps its outcome from viewers it names no character of, but shows it to those it does', () => {
    const own = checked('vex', 'Vex', {
      target: 'Actor.vex',
      outcome: 'success',
      readers: ['actor-vex'],
    })

    expect(toTableMessage(own, viewer).targets).toEqual([{ name: 'Vex' }])
    expect(
      toTableMessage(own, { ...viewer, actorId: 'actor-vex' }).targets,
    ).toEqual([{ name: 'Vex', check: 'success' }])
    // A viewer with no character of their own is named by none.
    expect(
      toTableMessage(own, { ...viewer, actorId: undefined }).targets,
    ).toEqual([{ name: 'Vex' }])
  })

  it('says nothing of one not decided, as of a modified d20', () => {
    expect(
      toTableMessage(checked('vex', 'Vex', { target: 'Actor.vex' }), viewer)
        .targets,
    ).toEqual([{ name: 'Vex' }])
  })

  it("never joins a check onto its card's targets, as a save joins", () => {
    const messages = shown([
      request,
      checked('thorin', 'Thorin', {
        target: 'Actor.thorin',
        outcome: 'success',
      }),
    ])

    expect(messages.request).toEqual([
      { name: 'Thorin Oakenshield' },
      { name: 'Vex' },
    ])
  })
})
