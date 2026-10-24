import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  actingLine,
  END_TURN_ARMS_AFTER,
  END_TURN_BUZZ,
  END_TURN_DRIFT,
  END_TURN_HINT,
  END_TURN_HOLD,
  END_TURN_LABEL,
  END_TURN_QUIET,
  END_TURN_QUIET_CLICKS,
  END_TURN_TAP_WITHIN,
  END_TURN_TOAST_AT,
  endableTurn,
  endTurnWords,
  HOLD_HINT,
  holdDescription,
  reasonSentence,
  TURN_OVER,
  TURN_REFUSALS,
  TURN_TOAST_FOR,
  TURN_UNDO_FOR,
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
  // Changed on purpose (round 0.36.0 §7.13 item 10, v6): the hold is the user's 1 second, and its
  // timings their End Turn prototype's; nothing says "Still your turn" any more.
  it('holds as the user asked: the toast at half a second, the end at a second', () => {
    expect(END_TURN_TOAST_AT).toBe(500)
    expect(END_TURN_HOLD).toBe(1000)
    expect(END_TURN_DRIFT).toBe(10)
    expect(END_TURN_ARMS_AFTER).toBe(600)
  })

  it('times the rest as the user’s End Turn prototype does', () => {
    expect(END_TURN_QUIET).toBeCloseTo(1 / 6, 10)
    // The fill's quiet first sixth of the hold is 167 milliseconds.
    expect(Math.round(END_TURN_QUIET * END_TURN_HOLD)).toBe(167)
    expect(END_TURN_TAP_WITHIN).toBe(300)
    expect(END_TURN_QUIET_CLICKS).toBe(700)
    expect(END_TURN_BUZZ).toBe(12)
    expect(TURN_TOAST_FOR).toBe(5000)
    expect(TURN_UNDO_FOR).toBe(8000)
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
        // Changed on purpose (round 0.36.0 §12, v6): Undo's own refusal.
        'not-undoable': 'it can’t be taken back now',
        // Changed on purpose (round 0.36.0 §7.13 item 10, v6): the tray's says to wait already.
        busy: 'too many rolls at once',
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

    // Changed on purpose (round 0.36.0 §7.13 item 10, v6): the turn panel's line, as the user's
    // prototype words it, whose turn it was and whether to try again.
    it('says why a turn wasn’t ended, with a fragment and without', () => {
      expect(
        turnRefusedLine(thorins, 'the turn had already moved on', false),
      ).toBe('Your turn wasn’t ended: the turn had already moved on.')
      expect(
        turnRefusedLine(
          thorins,
          'your Gamemaster’s game didn’t pick it up',
          true,
        ),
      ).toBe(
        'Your turn wasn’t ended: your Gamemaster’s game didn’t pick it up. Try again in a moment.',
      )
      expect(turnRefusedLine(brakkas, TURN_REFUSALS.busy, true)).toBe(
        'Brakka’s turn wasn’t ended: too many rolls at once. Try again in a moment.',
      )
      const none: string | undefined = undefined
      expect(turnRefusedLine(thorins, none, true)).toBe(
        'Your turn wasn’t ended. Try again in a moment.',
      )
      expect(turnRefusedLine(brakkas, '', false)).toBe(
        'Brakka’s turn wasn’t ended.',
      )
    })

    it('says a reason as a sentence of its own', () => {
      expect(reasonSentence(TURN_REFUSALS.moved)).toBe(
        'The turn had already moved on.',
      )
      expect(reasonSentence(TURN_REFUSALS.busy)).toBe('Too many rolls at once.')
      expect(reasonSentence(TURN_REFUSALS['not-undoable'])).toBe(
        'It can’t be taken back now.',
      )
      expect(reasonSentence('your Gamemaster’s game didn’t pick it up')).toBe(
        'Your Gamemaster’s game didn’t pick it up.',
      )
    })
  })

  describe('words', () => {
    // Changed on purpose (round 0.36.0 §7.13 item 10, v6): the words of the user's End Turn
    // prototype, and of Undo.
    it("says the character's own turn as the player's", () => {
      expect(endTurnWords(thorins)).toEqual({
        ending: 'Ending your turn…',
        ended: 'Your turn has ended.',
        notEnded: 'Your turn wasn’t ended',
        takingBack: 'Taking your turn back…',
        notTakenBack: 'Your turn wasn’t taken back.',
      })
      expect(holdDescription(thorins)).toBe('Press and hold to end your turn')
    })

    it("says a companion's turn by its name", () => {
      expect(endTurnWords(brakkas)).toEqual({
        ending: 'Ending Brakka’s turn…',
        ended: 'Brakka’s turn has ended.',
        notEnded: 'Brakka’s turn wasn’t ended',
        takingBack: 'Taking Brakka’s turn back…',
        notTakenBack: 'Brakka’s turn wasn’t taken back.',
      })
      expect(holdDescription(brakkas)).toBe(
        'Press and hold to end Brakka’s turn',
      )
    })

    it('says who acts next, the player where it’s their own character', () => {
      expect(actingLine({ name: 'Brakka', mine: false })).toBe(
        'Brakka is acting.',
      )
      expect(actingLine({ name: 'Thorin', mine: true })).toBe('It’s your turn.')
    })

    it('says what the button and a hold do', () => {
      expect(END_TURN_LABEL).toBe('End turn')
      expect(END_TURN_HINT).toBe(
        'Or press and hold the Combat tab, from any tab.',
      )
      expect(HOLD_HINT).toBe('Keep holding to end it, or let go to keep it.')
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
