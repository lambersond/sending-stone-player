import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  END_TURN_ARMS_AFTER,
  END_TURN_DRIFT,
  END_TURN_HOLD,
  END_TURN_KEPT_FOR,
  END_TURN_TOAST_AT,
  ENDED_LINE,
  endableTurn,
  endTurnWords,
  HOLD_HINT,
  holdDescription,
  KEPT_LINE,
  TURN_OVER,
  TURN_REFUSALS,
  turnKey,
  turnRefusedLine,
  turnSendingLine,
} from './end-turn'
import { mockTurnCombat } from '@/mocks/sending-stone'
import type { RollKind } from '@/types/roll'

const KINDS: RollKind[] = ['skill', 'attack', 'endConcentration', 'endTurn']

const thorins = { combatId: 'cmbt1', round: 1, combatantId: 'c-thorin' }
const brakkas = {
  combatId: 'cmbt1',
  round: 1,
  combatantId: 'c-brakka',
  companion: { key: 'wolfBrakka', name: 'Brakka' },
}

describe('utils/end-turn', () => {
  it('holds as the user asked: the toast at half a second, the end at a second and a half', () => {
    expect(END_TURN_TOAST_AT).toBe(500)
    expect(END_TURN_HOLD).toBe(1500)
    expect(END_TURN_DRIFT).toBe(10)
    expect(END_TURN_KEPT_FOR).toBe(2000)
    expect(END_TURN_ARMS_AFTER).toBe(600)
  })

  describe('endableTurn', () => {
    it("offers the seat's character's turn, by its combat, round and combatant", () => {
      expect(endableTurn(mockTurnCombat(), KINDS)).toEqual(thorins)
    })

    it("offers one of its companions' turns, with its key and name for the page's words", () => {
      expect(
        endableTurn(mockTurnCombat({ currentId: 'c-brakka' }), KINDS),
      ).toEqual(brakkas)
    })

    it('offers none for one of the viewer’s own that isn’t a listed companion, as its character at a companion’s view', () => {
      const combat = mockTurnCombat({ currentId: 'c-brakka' })
      const [, brakka] = combat.combatants
      delete brakka.companion
      expect(endableTurn(combat, KINDS)).toBeUndefined()
    })

    it("offers none for a party member's turn, their companion's or a foe's", () => {
      for (const currentId of ['c-vex', 'c-vex-wolf', 'c-goblin']) {
        expect(
          endableTurn(mockTurnCombat({ currentId }), KINDS),
        ).toBeUndefined()
      }
    })

    it('offers none before the combat starts', () => {
      expect(
        endableTurn(mockTurnCombat({ started: false }), KINDS),
      ).toBeUndefined()
    })

    it('offers none while no one is current, as while a hidden combatant acts', () => {
      expect(
        endableTurn(mockTurnCombat({ currentId: undefined }), KINDS),
      ).toBeUndefined()
      // Nor one the page has no row of.
      expect(
        endableTurn(mockTurnCombat({ currentId: 'c-gone' }), KINDS),
      ).toBeUndefined()
    })

    it("offers none where the game doesn't take it, or there's no combat", () => {
      expect(
        endableTurn(mockTurnCombat(), ['skill', 'endConcentration']),
      ).toBeUndefined()
      expect(endableTurn(mockTurnCombat(), [])).toBeUndefined()
      expect(endableTurn(undefined, KINDS)).toBeUndefined()
    })

    it('names the round and the combat shown', () => {
      expect(
        endableTurn(mockTurnCombat({ id: 'cmbt2', round: 4 }), KINDS),
      ).toEqual({ combatId: 'cmbt2', round: 4, combatantId: 'c-thorin' })
    })
  })

  describe('turnKey', () => {
    it('keys a turn by its combat, round and combatant, its words aside', () => {
      expect(turnKey(thorins)).toBe('cmbt1:1:c-thorin')
      expect(turnKey(brakkas)).toBe('cmbt1:1:c-brakka')
      expect(turnKey({ ...thorins, round: 2 })).toBe('cmbt1:2:c-thorin')
      expect(turnKey({ ...thorins, combatId: 'cmbt2' })).toBe(
        'cmbt2:1:c-thorin',
      )
    })
  })

  describe('refusals', () => {
    it("words End Turn's own refusals as fragments after the colon", () => {
      expect(TURN_REFUSALS).toEqual({
        'not-started': 'the combat hasn’t started',
        moved: 'the turn had already moved on',
        'not-turn': 'it isn’t your turn, nor one of your companions’',
      })
    })

    it('offers no turn again once refused as over, or never the seat’s', () => {
      expect([...TURN_OVER].toSorted()).toEqual([
        'moved',
        'not-started',
        'not-turn',
      ])
      for (const reason of ['busy', 'network', 'unavailable', 'timeout']) {
        expect(TURN_OVER.has(reason)).toBe(false)
      }
    })

    it('says why a turn wasn’t ended, with a fragment and without', () => {
      expect(turnRefusedLine('the turn had already moved on')).toBe(
        'Not ended at the table: the turn had already moved on',
      )
      const none: string | undefined = undefined
      expect(turnRefusedLine(none)).toBe('Not ended at the table')
      expect(turnRefusedLine('')).toBe('Not ended at the table')
    })
  })

  describe('words', () => {
    it("says the character's own turn as the player's", () => {
      expect(endTurnWords(thorins)).toEqual({
        holding: 'Ending your turn',
        kept: 'Still your turn',
        ended: 'Your turn is over',
      })
      expect(holdDescription(thorins)).toBe('Press and hold to end your turn')
    })

    it("says a companion's turn by its name", () => {
      expect(endTurnWords(brakkas)).toEqual({
        holding: 'Ending Brakka’s turn',
        kept: 'Still Brakka’s turn',
        ended: 'Brakka’s turn is over',
      })
      expect(holdDescription(brakkas)).toBe(
        'Press and hold to end Brakka’s turn',
      )
    })

    it('says what a hold does, and what came of it', () => {
      expect(HOLD_HINT).toBe('Keep holding to end it, or let go to keep it.')
      expect(KEPT_LINE).toBe('Nothing was sent.')
      expect(ENDED_LINE).toBe('Ended at the table')
    })

    it('says where it is on its way, as the seat reads its game', () => {
      expect(turnSendingLine({ status: 'sending' }, 'player')).toBe(
        'Sending to your Gamemaster’s game…',
      )
      expect(turnSendingLine({ status: 'rolling' }, 'player')).toBe(
        'Ending it in your Gamemaster’s game…',
      )
      expect(turnSendingLine({ status: 'sending' }, 'gm')).toBe(
        'Sending to your game…',
      )
      expect(turnSendingLine({ status: 'rolling' }, 'gm')).toBe(
        'Ending it in your game…',
      )
    })
  })

  it('imports no component, so that none it’s imported by can loop back to it', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/utils/end-turn.ts'),
      'utf8',
    )
    const imports = [...source.matchAll(/from '([^']+)'/g)].map(
      ([, from]) => from,
    )
    expect(imports.length).toBeGreaterThan(0)
    expect(imports.filter(from => from.includes('components'))).toEqual([])
    // And nothing from a hook but its types.
    expect(source).not.toMatch(/^import \{[^}]*\} from '@\/hooks\//m)
  })
})
