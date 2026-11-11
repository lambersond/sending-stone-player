import { HELP_SECTIONS } from './constants'
import { CONFIGURE_COOKBOOK } from '@/features/cookbook/constants'
import { LONG_PRESS } from '@/features/rolling/constants'
import { choiceItem } from '@/features/rolling/utils/menu-points'
import { TOAST_FOR } from '@/features/rolling/utils/roll-toasts'
import { END_TURN_HOLD, TURN_UNDO_FOR } from '@/features/table/utils/end-turn'
import { EFFECT_WORDS } from '@/utils/effect-words'
import { PREPARE_WORDS } from '@/utils/prepare-words'
import type { RollChoice } from '@/features/rolling/types'

// What Help's text must keep, as its brief asks (ROADMAP item 12): every long-press menu and its
// items, every setting, every campaign switch, and four numbers. The app's own words where it keeps
// them in one place; the rest as the app and the module show them.

/** A section's text, leads and all, by its title. */
const textOf = (title: string) =>
  HELP_SECTIONS.find(section => section.title === title)
    ?.parts.map(({ lead = '', text }) => lead + text)
    .join('\n') ?? ''

const CHOICES: RollChoice[] = [
  'adv',
  'dis',
  'modify',
  'critical',
  'maximize',
  'modify-damage',
]

describe('features/help/constants', () => {
  it('names every long-press menu and its items in Hold for more', () => {
    const hold = textOf('Hold for more')
    const items = [
      ...CHOICES.map(choice => choiceItem(choice).label),
      // A heal's (action-entry, description links), and a cast's or use's (round 0.41.0).
      'Roll maximum healing',
      'Modify healing…',
      'Cast with',
      'Use with',
      // A row's (item-menu): favorites, a spell's, an item's and an effect's.
      'Add to favorites',
      'Remove from favorites',
      PREPARE_WORDS.prepare.menu,
      PREPARE_WORDS.unprepare.menu,
      'Send to…',
      'Remove…',
      EFFECT_WORDS.disable.button,
      EFFECT_WORDS.enable.button,
      EFFECT_WORDS.delete.button,
      // The hit dice's, the Combat tab's hold, and a description's links'.
      'Hold Use',
      'end your turn',
      'Ask the table',
    ]
    expect(items.filter(item => !hold.includes(item))).toEqual([])
  })

  it('names every setting in Settings, Help itself among them', () => {
    const settings = textOf('Settings')
    const entries = [
      'Send to the table',
      'Damage on its own',
      'Enter dice results manually',
      'Roll results',
      'Theme',
      'Favorites on the Character tab',
      'Actions layout',
      CONFIGURE_COOKBOOK,
      'How to use Sending Stone',
      'Report a bug',
      'Request a feature',
    ]
    expect(entries.filter(entry => !settings.includes(entry))).toEqual([])
  })

  it('names every campaign switch, as Foundry labels it, in What your Gamemaster turns on', () => {
    const switches = textOf('What your Gamemaster turns on')
    const labels = [
      'Players roll in the app',
      'Attacks, spells and features',
      'Save and concentration prompts',
      'Allow Players to enter dice results manually',
      'Players move items and coins',
      'Allow Players to disable & remove their own active effects',
      'Allow Players to use Wild Shape from the app',
      'Allow Players to change their hit points from the app',
      'Dishes from the Magical Recipe Book',
      'Companions’ initiative',
    ]
    expect(labels.filter(label => !switches.includes(label))).toEqual([])
  })

  it.each([
    ['opening a menu', LONG_PRESS, 500, 'Hold for more', 'half a second'],
    ['ending a turn', END_TURN_HOLD, 1000, 'Combat', 'for a second'],
    ['Undo', TURN_UNDO_FOR, 8000, 'Combat', '8 seconds'],
    ['a toast', TOAST_FOR, 4000, 'Settings', '4 seconds'],
  ])(
    'says how long %s takes as the app times it',
    (_what, constant, ms, title, words) => {
      expect(constant).toBe(ms)
      expect(textOf(title)).toContain(words)
    },
  )
})
