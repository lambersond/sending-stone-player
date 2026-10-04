/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import {
  findActorId,
  htmlToText,
  pickCombat,
  toTableCombat,
  toTableMessage,
  type Viewer,
} from './table-view'
import { chatMessage, combat, combatant, roster } from '@/mocks/sending-stone'
import type { SerializedMessage } from '@/types/sending-stone'

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
const d20 = { formula: '1d20 + 7', total: 24, dice: [] }

describe('utils/table-view', () => {
  describe('findActorId', () => {
    it('matches a name however it is spaced or capitalized', () => {
      expect(findActorId(roster, '  thorin   OAKENSHIELD ')).toBe(
        'actor-thorin',
      )
    })

    it('finds nothing for a name not connected', () => {
      expect(findActorId(roster, 'Bilbo')).toBeUndefined()
    })
  })

  describe('toTableMessage', () => {
    it('shows something said', () => {
      expect(toTableMessage(chatMessage(), viewer)).toEqual({
        id: 'm1',
        sentAt: '2026-10-04T19:02:00.000Z',
        speaker: 'Gamemaster',
        side: 'other',
        whisper: false,
        kind: 'text',
        label: undefined,
        text: 'Roll initiative!',
        rolls: [],
        targets: [],
      })
    })

    it.each([
      ['actor-thorin', 'me'],
      ['actor-vex', 'party'],
      [null, 'other'],
    ])('puts a speaker connected as %s on the %s side', (character, side) => {
      expect(toTableMessage(chatMessage({ character }), viewer).side).toBe(side)
    })

    it('marks a whisper', () => {
      const message = chatMessage({
        audience: { public: false, characters: ['actor-thorin'] },
      })

      expect(toTableMessage(message, viewer).whisper).toBe(true)
    })

    it("falls back to the author's name, then Unknown", () => {
      const noAlias = chatMessage({ speaker: { alias: ' ', actorId: null } })
      const nobody = chatMessage({
        speaker: { alias: null, actorId: null },
        author: null,
      })

      expect(toTableMessage(noAlias, viewer).speaker).toBe('Gamemaster')
      expect(toTableMessage(nobody, viewer).speaker).toBe('Unknown')
    })

    it('leaves out blank text', () => {
      expect(toTableMessage(chatMessage({ text: '  ' }), viewer).text).toBe(
        undefined,
      )
    })

    it('lays out a roll and leaves out its rendered content', () => {
      const message = chatMessage({
        text: '1d20 + 7 17 24',
        rolls: [
          {
            formula: '2d20kh + 7',
            total: 24,
            dice: [
              {
                faces: 20,
                results: [
                  { result: 17, active: true },
                  { result: 4, active: false },
                ],
              },
            ],
            advantage: true,
            critical: false,
            damageType: 'slashing',
          },
        ],
        dnd5e: dnd5e({ targets: [{ name: 'Goblin' }] }),
      })

      expect(toTableMessage(message, viewer)).toMatchObject({
        kind: 'roll',
        text: undefined,
        targets: ['Goblin'],
        rolls: [
          {
            formula: '2d20kh + 7',
            total: 24,
            dice: [
              { faces: 20, value: 17, active: true },
              { faces: 20, value: 4, active: false },
            ],
            advantage: true,
            disadvantage: false,
            critical: false,
            fumble: false,
            damageType: 'slashing',
          },
        ],
      })
    })

    it('shows an item used as a card', () => {
      const message = chatMessage({
        type: 'usage',
        text: 'Second Wind You have a limited well…',
        dnd5e: dnd5e({
          messageType: 'usage',
          item: { name: 'Second Wind' },
          activity: { name: 'Heal', type: 'heal' },
        }),
      })

      expect(toTableMessage(message, viewer)).toMatchObject({
        kind: 'card',
        label: 'Second Wind · Heal',
        text: undefined,
      })
    })

    it("doesn't repeat an activity named after its item", () => {
      const message = chatMessage({
        dnd5e: dnd5e({
          messageType: 'usage',
          item: { name: 'Second Wind' },
          activity: { name: 'Second Wind', type: 'heal' },
        }),
      })

      expect(toTableMessage(message, viewer).label).toBe('Second Wind')
    })

    it.each([
      [{ type: 'skill', skillId: 'prc' }, undefined, 'Perception check'],
      [{ type: 'ability', ability: 'str' }, undefined, 'Strength check'],
      [{ type: 'save', ability: 'dex' }, undefined, 'Dexterity save'],
      [{ type: 'attack' }, 'Longbow', 'Longbow · Attack'],
      [{ type: 'attack' }, undefined, 'Attack'],
      [{ type: 'damage' }, 'Longbow', 'Longbow · Damage'],
      [{ type: 'damage' }, undefined, 'Damage'],
      [{ type: 'death' }, undefined, 'Death save'],
      [{ type: 'hitDie' }, undefined, 'Hit Die'],
      [{ type: 'concentration' }, undefined, 'Concentration'],
    ])('labels a %o roll', (roll, item, label) => {
      const message = chatMessage({
        rolls: [d20],
        dnd5e: dnd5e({ roll, item: item ? { name: item } : null }),
      })

      expect(toTableMessage(message, viewer).label).toBe(label)
    })

    it.each([
      { type: 'skill', skillId: 'nope' },
      { type: 'ability', ability: 'nope' },
      { type: 'save' },
      { type: 'generic' },
    ])('falls back to the flavor for %o', roll => {
      const message = chatMessage({
        rolls: [d20],
        flavor: '<b>Lucky</b> roll',
        dnd5e: dnd5e({ roll }),
      })

      expect(toTableMessage(message, viewer).label).toBe('Lucky roll')
    })

    it('falls back to the title when there is no flavor', () => {
      const message = chatMessage({ title: ' Ancient Lore ' })

      expect(toTableMessage(message, viewer).label).toBe('Ancient Lore')
    })
  })

  describe('htmlToText', () => {
    it('drops tags, decodes entities and keeps content link labels', () => {
      expect(
        htmlToText(
          '<h4>Fire &amp; Ice&nbsp;&#8212;&#x2014;</h4> @UUID[Item.x]{Frost Brand} &lt;3 &unknown; &#xZZ;',
        ),
      ).toBe('Fire & Ice —— Frost Brand <3 &unknown; &#xZZ;')
    })

    it('has nothing to say for empty markup', () => {
      expect(htmlToText('<p> </p>')).toBeUndefined()
    })
  })

  describe('pickCombat', () => {
    it("prefers the tracker's encounter under way", () => {
      const setUp = combat({ id: 'a', active: false, started: false })
      const elsewhere = combat({ id: 'b', active: false, started: true })
      const shown = combat({ id: 'c', active: true, started: false })
      const fighting = combat({ id: 'd', active: true, started: true })

      expect(pickCombat([setUp, elsewhere, shown, fighting])?.id).toBe('d')
      expect(pickCombat([setUp, elsewhere, shown])?.id).toBe('c')
      expect(pickCombat([setUp, elsewhere])?.id).toBe('b')
      expect(pickCombat([setUp])?.id).toBe('a')
      expect(pickCombat([])).toBeUndefined()
    })
  })

  describe('toTableCombat', () => {
    it('sides each combatant, and shows hit points only for the party', () => {
      const snapshot = combat({
        combatants: [
          combatant({ id: 'c-boss', hp: { value: 5, max: 50, temp: 0 } }),
          combatant({
            id: 'c-thorin',
            character: 'actor-thorin',
            hp: { value: 31, max: 44, temp: 2 },
          }),
          combatant({ id: 'c-vex', character: 'actor-vex' }),
          combatant({ id: 'c-pet', playerOwned: true }),
        ],
      })

      const { combatants } = toTableCombat(snapshot, viewer)

      expect(combatants.map(({ id, side, hp }) => ({ id, side, hp }))).toEqual([
        { id: 'c-boss', side: 'other', hp: undefined },
        { id: 'c-thorin', side: 'me', hp: { value: 31, max: 44, temp: 2 } },
        { id: 'c-vex', side: 'party', hp: undefined },
        { id: 'c-pet', side: 'party', hp: undefined },
      ])
    })

    it('leaves out hidden combatants and their turns', () => {
      const snapshot = combat({
        combatantId: 'c-lurker',
        combatants: [
          combatant({ id: 'c-lurker', hidden: true }),
          combatant({ id: 'c-boss', hidden: false }),
        ],
      })

      const view = toTableCombat(snapshot, viewer)

      expect(view.combatants.map(({ id }) => id)).toEqual(['c-boss'])
      expect(view.currentId).toBeUndefined()
    })

    it('keeps whose turn it is', () => {
      expect(toTableCombat(combat(), viewer)).toMatchObject({
        id: 'cmbt1',
        name: null,
        started: true,
        round: 1,
        currentId: 'c-boss',
      })
    })

    it('has no current turn before the start', () => {
      const view = toTableCombat(
        combat({ started: false, combatantId: null }),
        viewer,
      )

      expect(view.currentId).toBeUndefined()
    })

    it('knows no one as me when the character is not connected', () => {
      const stranger: Viewer = { actorId: undefined, party: new Set() }

      const { combatants } = toTableCombat(combat(), stranger)

      // Still an ally, being player-owned, so their hit points still show.
      expect(combatants[1]).toMatchObject({
        side: 'party',
        hp: { value: 31, max: 44, temp: 0 },
      })
    })
  })
})
