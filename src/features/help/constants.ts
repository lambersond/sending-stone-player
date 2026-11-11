import type { HelpSection } from './types'

// Help's words (ROADMAP item 12): the owner's final text, the draft text of the Help panel's brief
// unchanged, and the "In this game" box's rows as the brief has them. `{name}` is the character's.

/** The panel's title, and the header's Help button's name. */
export const HELP_TITLE = 'Help'

/** Under the title: the player's, and at the Gamemaster's seat what Help is there (H3 B). */
export const HELP_SUBTITLE = {
  player: 'Playing from Sending Stone',
  gm: 'What your player sees',
} as const

/** Help's entry in the settings menu's Help group, first (H1 B). */
export const HOW_TO_USE = 'How to use Sending Stone'

/** The row of chips, each going to a section (D1), and what's said above it. */
export const GO_TO = { label: 'Go to a section', caption: 'Go to' } as const

/** At the Gamemaster's seat only, above the box (H3 B). */
export const GM_NOTE =
  'At your player’s sheet. This is the help your player sees. Here, you roll as {name}, and your rolls are marked GM; the box below says where they go. You can send and remove their items too. Ending their turn, favorites, Prepare, effects, Wild Shape, hit points and typing in dice are your player’s alone, from their own page.'

/**
 * The eight sections (H4 B), each part a bold lead and what follows it, which carries its own
 * punctuation. "Dice an item rolls later" is the campaign's module's alone (`later`, H6 B).
 */
export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'rolling',
    title: 'Rolling',
    parts: [
      {
        lead: 'Checks and saves.',
        text: ' Tap an ability, a saving throw or a skill on the Character tab to roll it, and Initiative and Death saves the same way. It rolls with the advantage or disadvantage your conditions and features give.',
      },
      {
        lead: 'Attacks.',
        text: ' Your attacks are on the Actions tab, and on the Spells, Inventory and Features tabs too. Tap an attack’s bonus, such as +5. Where your Gamemaster’s game makes your attacks, you first choose a spell slot or ammunition where there’s a choice, then tap who you attack, or No target. The attack is made there, with the same dice.',
      },
      {
        lead: 'Damage.',
        text: ' When the game waits for your damage, Roll damage shows with the attack’s result, in its toast or in the banner at the foot of the sheet: tap it. Tap a damage or healing number on its own to roll just that.',
      },
      {
        lead: 'Spells and features.',
        text: ' Tap a spell’s saving throw, such as DEX 14, to cast it: the game asks its targets for their saves. A spell or feature that rolls nothing, such as Bless, has a button that uses it. On the Spells tab, tap a filled spell slot dot to spend it, or a hollow one to get it back; it asks first.',
      },
      {
        lead: 'Hit dice.',
        text: ' On the Character tab, Use in the Hit dice tile spends one die and gives you back hit points. Hold Use to spend several at once. You can’t spend one at full hit points, or with none left.',
      },
      {
        lead: 'What the game asks.',
        text: ' When your Gamemaster’s game asks you for a save, such as a concentration save, it waits at the top of the sheet. Tap it to roll. One Midi-QOL asks, which may be a check too, shows how long you have: roll it in time, or it’s rolled for you in Foundry.',
      },
      {
        lead: 'Where your roll went.',
        text: ' Each roll says what it came to, and whether it was made in your Gamemaster’s game. “Only you see this roll” means it stayed here.',
      },
      {
        lead: 'Companions and conditions.',
        text: ' A companion has its own tab above the sheet: roll for it there. Tap a condition to read its rules.',
      },
    ],
  },
  {
    id: 'hold',
    title: 'Hold for more',
    parts: [
      {
        text: 'Hold a button for half a second to see more ways to use it. With a mouse, right-click it. With a keyboard, press the menu key or Shift+F10. Escape, or a tap anywhere else, closes the menu. The Combat tab is different: see below.',
      },
      {
        lead: 'Checks, saves and attacks.',
        text: ' Roll with advantage, Roll with disadvantage, or Modify roll…, to add dice or a number first, such as Bless’s +1d4. A save the game asks has them too, except one Midi-QOL asks, which takes a tap.',
      },
      {
        lead: 'Damage and healing.',
        text: ' Roll critical damage, Roll maximum damage, or Modify damage…, to add dice or change a die’s size first. Healing has Roll maximum healing and Modify healing…. On a spell or feature your Gamemaster’s game casts or uses for you, they begin Cast with or Use with instead, such as Cast with maximum damage. Only what the game takes is offered.',
      },
      {
        lead: 'Hit dice.',
        text: ' Hold Use to choose how many to spend of each size, up to 20 in all, and see what they give back.',
      },
      {
        lead: 'A row, such as an item, a spell, a feature or an effect',
        text: ': Add to favorites or Remove from favorites; for a spell, Prepare or Unprepare; for an item, Send to… and Remove…; for one of your own effects, Turn off or Turn on, and Delete…. Each is there only where your Gamemaster’s game takes it.',
      },
      {
        lead: 'The Combat tab.',
        text: ' Press and hold to end your turn: hold the tab for a second with a finger, a pen or the mouse’s main button. A right-click or the keyboard just opens the tab; use End turn there instead. See Combat.',
      },
      {
        lead: 'A description’s links',
        text: ', such as a saving throw it names, open their menu with a tap: roll it yourself, or Ask the table, where your Gamemaster’s game takes it.',
      },
    ],
  },
  {
    id: 'tray',
    title: 'Dice tray',
    parts: [
      {
        text: 'For a roll your Gamemaster asks for that isn’t on your sheet. Open the Chat tab (on a wide screen, Chat beside the sheet) and tap Roll dice under the chat. Tap a die to add one, from d4 to d100. Use − and + to change how many, and set a number to add. Then tap Roll. Clear empties the tray; otherwise your dice stay for the next roll. Where your Gamemaster’s game takes it, the roll is made there too, as your character, and its card comes into the chat.',
      },
    ],
  },
  {
    id: 'typing',
    title: 'Typing in your own dice',
    parts: [
      {
        lead: 'Turning it on.',
        text: ' Your Gamemaster allows it in Foundry (Allow Players to enter dice results manually, with the Manual Dice module on) and gives your Foundry player Make Manual Rolls. Then turn on Enter dice results manually in Settings. It’s kept for you on every device.',
      },
      {
        lead: 'The dice dialog.',
        text: ' Each roll you make asks for its dice in a dialog marked Manual Dice. Type each die into its box with the keypad: Next die moves on, and Delete takes a digit back. The total shows as you go. Done keeps the roll; Cancel makes none.',
      },
      {
        lead: 'Dice your effects add.',
        text: ' In some games, the dialog also asks for a die one of your effects adds, such as Bless’s d4, after your own. Type it in, or Skip it and the game rolls it. Where the dialog doesn’t ask, the game rolls those dice itself. The In this game box at the top says which.',
      },
      {
        lead: 'A die you may add.',
        text: ' In some games, a die you’ve been given, such as Bardic Inspiration’s, waits beside Done. Add it if your Gamemaster says the roll fails; otherwise Leave out.',
      },
      {
        lead: 'Rerolls at the table.',
        text: ' Where a feature lets you reroll, such as Great Weapon Fighting, reroll at the table and type in the die you keep. The dialog says so.',
      },
      {
        lead: 'A save the game asks',
        text: ' shows how long you have, and closes when the time is up.',
      },
      {
        lead: 'Dice an item rolls later.',
        text: ' When an item rolls more after its first roll, such as Ice Knife’s 2d6 cold after its d10, or extra damage Midi-QOL adds such as Sneak Attack, the game waits for your dice. The dice dialog opens by itself on the device you rolled from, and a banner shows on your others. It names the roll and counts down from a minute. Type the dice in, skip one, or let the game roll them. When the minute is up, or your Gamemaster rolls them for you in Foundry, the game rolls them. A die that explodes asks for its extra die too. If you roll with the app’s own 3D dice instead of typing, the game rolls these later dice itself.',
        later: true,
      },
      {
        lead: 'In Foundry’s chat',
        text: ', the rolls you type in are marked as entered by hand.',
      },
    ],
  },
  {
    id: 'rests',
    title: 'Hit points and rests',
    parts: [
      {
        lead: 'Hit points.',
        text: ' Where your Gamemaster allows it, tap the Hit points tile to set your hit points and temporary hit points, for what the rolls don’t do, such as a fall. Save sends them, and the tile waits for the game. Your companions’ and your Wild Shape form’s tiles work the same way. Losing hit points while you concentrate asks you for a concentration save. Nothing is posted in chat.',
      },
      {
        lead: 'Short and long rests are your Gamemaster’s.',
        text: ' They rest you in Foundry, and your hit points, hit dice, spell slots and uses come back here when they do. There’s no rest button in the app. During a short rest, spend your hit dice from the Hit dice tile.',
      },
      {
        text: 'If your Gamemaster sends a rest request to the chat instead, its button works only in Foundry: ask them to rest the party with Auto Rest.',
      },
    ],
  },
  {
    id: 'combat',
    title: 'Combat',
    parts: [
      {
        text: 'The Combat tab shows the initiative order and whose turn it is; on a wide screen it’s beside the sheet. Roll Initiative from the Character tab when the encounter starts. Where your Gamemaster’s game takes your rolls, the Combat tab has End turn on your turn, and Undo shows in a toast for 8 seconds after. Or press and hold the Combat tab for a second, from any tab: a toast says your turn is ending, and if you let go early, nothing happens. On a companion’s turn, the same ends its turn. A companion rolls its own initiative from its tab, unless your Gamemaster puts companions right after their character, when it isn’t rolled at all.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    parts: [
      {
        text: 'The cog beside the sheet’s tabs. Each setting stays on this device, except Enter dice results manually, which is kept for you on every device.',
      },
      {
        lead: 'Send to the table.',
        text: ' Your rolls here are made in your Gamemaster’s game too, with the same dice. Off, only you see them. It shows while the game takes your rolls.',
      },
      {
        lead: 'Damage on its own.',
        text: ' Damage you roll by itself goes to the game for your Gamemaster to apply, with no attack or save made there. It needs Send to the table.',
      },
      {
        lead: 'Enter dice results manually.',
        text: ' Type in what your own dice show. See Typing in your own dice.',
      },
      {
        lead: 'Roll results.',
        text: ' Toasts pop up at the top for 4 seconds, and one you need to act on stays; the button beside the cog lists your recent rolls. Banner keeps them at the foot of the sheet.',
      },
      { lead: 'Theme.', text: ' Light, Dark, or System, as your device is.' },
      {
        lead: 'Favorites on the Character tab.',
        text: ' Shows your favorites between Skills and Traits.',
      },
      {
        lead: 'Actions layout.',
        text: ' List, Table or Columns, where the screen is wide enough.',
      },
      {
        lead: 'Configure Magical Cookbook.',
        text: ' Your Magical Recipe Book, where your Gamemaster takes dishes.',
      },
      {
        lead: 'Help.',
        text: ' How to use Sending Stone (this help), Report a bug, and Request a feature.',
      },
    ],
  },
  {
    id: 'switches',
    title: 'What your Gamemaster turns on',
    parts: [
      {
        text: 'Your Gamemaster sets these in Foundry, on the Player actions tab of Sending Stone’s settings. If something in this help is missing for you, it may be off there, their game may be closed, or their setup may not allow it yet: an older Sending Stone module, another module, or their version of the game system. Ask them.',
      },
      {
        lead: 'Players roll in the app',
        text: ': your checks, saves, initiative, death saves, hit dice and the dice tray are made in their game.',
      },
      {
        lead: 'Attacks, spells and features',
        text: ': made in their game at the targets you pick, spending slots, uses and ammunition there. With Midi-QOL, they also turn on Run players’ attacks through Midi.',
      },
      {
        lead: 'Save and concentration prompts',
        text: ': the saves their game asks of you are asked here.',
      },
      {
        lead: 'Allow Players to enter dice results manually',
        text: ': typing in your own dice (Sending Stone 0.32.0 or later, with Manual Dice).',
      },
      {
        lead: 'Players move items and coins',
        text: ': Send to…, Take and Give (0.31.0).',
      },
      {
        lead: 'Allow Players to disable & remove their own active effects',
        text: ': Turn off, Turn on and Delete… (0.39.0).',
      },
      {
        lead: 'Allow Players to use Wild Shape from the app',
        text: ': a 2024 druid’s Wild Shape (0.40.0).',
      },
      {
        lead: 'Allow Players to change their hit points from the app',
        text: ': the Hit points tile; on unless they turn it off (0.44.0).',
      },
      {
        lead: 'Dishes from the Magical Recipe Book',
        text: ': your cookbook’s dishes, in some games (0.38.0).',
      },
      {
        lead: 'Companions’ initiative',
        text: ': whether your companions roll their own, or go right after you.',
      },
      {
        lead: 'No switch, but a recent module',
        text: ': End turn (0.36.0), Remove… (0.33.0), favorites (0.37.0), Prepare and spell slot dots (0.42.1), the dice tray made in their game (0.44.0), and dice an item rolls later (0.44.0).',
      },
    ],
  },
]

/** The box's title, at either seat (H2 B). */
export const BOX_TITLE = 'In this game, for {name}'

/** A row's own words: what it's about, and what it says while on and off. */
const FROM_HERE = { on: 'From here', off: 'Not from here' } as const

/** The rows at the player's seat, in their order. */
export const PLAYER_ROWS = {
  rolls: {
    label: 'Your rolls',
    on: 'Made in your Gamemaster’s game too',
    off: 'Stay here: only you see them',
  },
  attacks: {
    label: 'Attacks, spells and features',
    on: 'Made in the game',
    off: 'Stay here',
  },
  prompts: {
    label: 'Saves the game asks',
    on: 'Asked here',
    off: 'Asked in Foundry',
  },
  tray: {
    label: 'Dice tray',
    on: 'Rolled in the game too',
    off: 'Rolls here only',
  },
  endTurn: { label: 'End turn', ...FROM_HERE },
  typing: {
    label: 'Typing in your dice',
    on: 'On',
    allowed: 'Allowed: turn it on in Settings',
    off: 'Not in this game',
  },
  effectDice: {
    label: 'Dice your effects add',
    on: 'Asked for',
    off: 'Rolled by the game',
  },
  // Shown only where the game asks for them (H6 B), so it never says otherwise.
  laterDice: { label: 'Dice an item rolls later', on: 'Asked for' },
  hitPoints: {
    label: 'Hit points',
    on: 'Set from here',
    off: 'Not from here',
  },
  moves: { label: 'Moving items and coins', ...FROM_HERE },
  removes: { label: 'Removing items', ...FROM_HERE },
  favorites: { label: 'Favorites', ...FROM_HERE },
  effects: { label: 'Your own effects', ...FROM_HERE },
  wildShape: { label: 'Wild Shape', ...FROM_HERE },
} as const

/** The rolls' row at the Gamemaster's seat, by where their rolls go (`TableView['gm']`). */
export const GM_ROLLS_ROW = {
  label: 'Your rolls here',
  made: 'Made in your game as {name}, marked GM',
  update: 'Stay here until your Sending Stone module is updated',
  off: 'Stay here: your game takes no rolls now',
} as const

/**
 * Under the rows: the player's, then while their Gamemaster's game isn't connected; and the
 * Gamemaster's.
 */
export const BOX_NOTES = {
  player:
    'Missing something? Most of these are your Gamemaster’s switches in Foundry. Some need a newer Sending Stone module, or a different setup there. Ask them.',
  offline:
    'Your Gamemaster’s game isn’t connected right now, so nothing is made there.',
  gm: 'Your switches are on the Player actions tab of Sending Stone’s settings in Foundry.',
} as const
