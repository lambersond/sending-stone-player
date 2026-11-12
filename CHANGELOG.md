# Changelog

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). A version is the module's:
the app deployed with it ships with it, and app-only work goes under the version it's deployed
with.

Done work moves here from [ROADMAP.md](ROADMAP.md) as a version is built, and the version reads as
released, with its date, once the module is tagged. Each version has up to four sections, in this
order:

- **Features:** something new you can do.
- **Fixes:** something that was wrong now works as it should.
- **Enhancements:** something that already worked now works better.
- **Maintenance:** tests, docs, refactors and tooling; nothing changes at the table.

Each entry ends with where it lives, the app, the module or both, and its ROADMAP item where it had
one. Versions before v0.44.0 are in README.md's
[Supported module versions](README.md#supported-module-versions) table.

## v0.46.0 — release candidate, not yet tagged

### Fixes

- **A shared character's whispers kept to its own players.** A character shared with All Players
  as Owner no longer gets other players' whispers and private rolls at its seat, nor the saves
  their whispered cards ask, nor the outcome of a check only its author may see. Its players are
  those given Owner on it by name, else the player it's assigned to, as for its companions since
  v0.45.0. (module, item 37)
- **A shared character's owners kept to its own players.** A character shared with All Players as
  Owner now names only its own players as owners in its roster, where it named every player in the
  world, other campaigns' too, and sees a party sheet only as they may. In Foundry, a dish's card is
  whispered only to the campaign's own players, and the dish's Apply dialog names each character's
  players. (module, item 38)
- **A Recharge chip goes with "recharged".** After a recharge rolled at the table, the sheet's
  Recharge chip now goes as the tray says "recharged", where it stayed up to 3 seconds and a tap on
  it was refused. Whenever the game answers something the sheet or a companion's pane sent, the
  page reads the table again at once and half a second later, instead of waiting for its next
  poll. (app, item 39)
- **No DC of another player's save at a shared character.** A character shared with All Players as
  Owner is no longer shown the DC of a save another player's card asks, which dnd5e's Challenge
  Visibility hides from its player in Foundry. Only its own players' cards show it their DC, in
  dnd5e's prompts and in Midi-QOL's concentration card. (module, item 40)
- **The Initiative tile in an encounter switched away from.** In an encounter begun and then
  switched away from on the tracker, the sheet's Initiative tile no longer offers to roll for it,
  which the game refused: it rolls in the app, as with no combat. The app also refuses such a roll
  itself, saying you aren't in the combat. (app)

### Enhancements

- **A character assigned to a player is theirs.** A character no player owns, but assigned to a
  player in User Configuration, now counts as that player's, where it had no player outside its
  companions. It gets their whispers, private rolls, check outcomes and save DCs, sees a party sheet
  as they may and names them in its roster, and a change of whom it's assigned to reaches its party
  sheets at once. (module)

### Maintenance

- **Docs for a character's players.** README.md's supported-versions table gains v0.46.0, and the
  module's `PROTOCOL.md` gains "A character's players" and a "Module 0.46.0" entry, its
  `group.updated` now saying a user's change sends groups at once. The module's `README.md` says
  how to make a player a character's player and what the dish Apply dialog names, and comments in
  `scripts/characters.mjs`, `chat-data.mjs` and `chat.mjs` name the rule. (app and module)
- **ROADMAP kept current, and this changelog.** ROADMAP.md gains v0.46's release-candidate section
  with its checks at the table, takes out items 37 to 40 as done, adds items 41 to 45 found while
  building v0.46, and takes out v0.44's and v0.45's sections once they were released. Its follow-up
  batch is renamed "Not yet scheduled", and done work now moves from it to this CHANGELOG.md. (app)
- **Steadier tests and harness.** `e2e/README.md` lists two more known load races (ROADMAP items 41
  and 42), and `e2e/uses-e2e.mjs` part 5 waits for Bless's Prepare to be enabled before reading its
  menu. The module harness's stand-in Foundry (`test/fvtt/stub.mjs`) keeps each actor's ownership
  by user id, as Foundry does. (app and module)

## v0.45.0 — 2026-11-11

### Features

- **Help on a character's page.** The ? at the top of a character's page, or How to use Sending
  Stone in the cog's menu, opens Help in a side panel: rolling, holding for more, the dice tray,
  typing in your own dice, hit points and rests, combat, the settings and what your Gamemaster
  turns on. A box at its top says what this game and this device allow for the character, and the
  Gamemaster sees what their player sees. (app, item 12)
- **Condition immunities show their rules.** Each condition under a creature's Condition
  Immunities that the app has rules for now shows them on hover and opens the Conditions panel on a
  tap, as conditions in descriptions do. One it has no rules for, such as Poison, stays plain text.
  (app)

### Fixes

- **A campaign's chat keeps to its own cards.** Where one Foundry world runs more than one
  campaign, a campaign's chat no longer shows another campaign's public cards, such as its fight's
  initiative and attacks. The Gamemaster's narration and the cards of a fight both campaigns are in
  still reach both, and a card's edits go where the card first went. (module, item 19)
- **A shared character's sidekicks are its own players'.** A character shared with All Players as
  Owner no longer counts every player as its own, so another campaign's sidekicks, their sheets and
  their fights stay out of it. Its players are those given Owner on it by name, else the player
  it's assigned to. (module, item 19)
- **A die thrown again shows the die typed.** When you type a die the game throws again, the dice
  tray shows that die, not the whole roll's total, so a typed 3 no longer reads as the roll's 9. It
  says the die was added to its roll for an explosion, or put in place of the die rerolled for a
  reroll. (app, items 27 and 34)
- **Dice left to the game no longer read 0.** A dice ask answered with Let the game roll, or with
  every die skipped, reads "left to the game" in the dice tray and its toast instead of 0, and its
  total waits for the game's. (app, item 31)
- **No D&D Beyond tags in traits.** A sidekick imported from D&D Beyond showed
  "[condition]Charmed[/condition]" and the like in its traits; each now reads as its words alone,
  in senses and speeds too. (app)
- **Long names fit.** A very long name or word wraps instead of pushing the page sideways or
  squeezing its buttons: on the Gamemaster's campaign page, the join page, the journal's card,
  Personality and Appearance, and the Give, Take and Distribute dialogs. (app, item 17)
- **A long name in Combat keeps the round on one line.** A long name after "Next:" in the Combat
  tab is still cut short, but no longer squeezes "Round 1" onto two lines. (app, item 33)
- **Clear said once in the dice tray.** With a screen reader, Clear in the dice tray with dice and
  a number added is said once, not "No dice" and then "+0". (app, item 14)
- **Roll names never read as code.** A broken or hand-made roll could read
  "function Object() { [native code] } check" in the chat, and such a save held for a companion
  could keep its character's page from loading. Both now read as the names given. (app, items 13
  and 32)

### Enhancements

- **A die thrown again called by its roll's name.** Under dnd5e 5, when a utility's die is thrown
  again, such as Wild Sparks' exploding die, the ask for it uses the roll's own name, "Wild Sparks:
  Burst", as its chip and the dice tray do, not "Wild Sparks: Use". The Gamemaster's window says it
  too. (module, item 26)
- **The Combat tab shows only a fight under way.** The Combat tab shows whose turn it is and the
  initiative order only once an encounter has begun and is the one on the Gamemaster's tracker;
  otherwise it says "No combat right now", with a line to roll initiative from the sheet before
  Begin Combat while the character has none. A screen reader hears each turn once, the first one
  included. (app, item 19)

### Maintenance

- **Steadier tests.** `src/db/note-sync.test.ts` passes in any test order. e2e's feedback suite
  finds the attack roll's own message, not the item's card before it, and `alone-e2e.mjs` part 15
  waits for Fire Breath's Recharge chip to go, so neither fails under load and `e2e/README.md`'s
  known load races drop both. (app, items 15, 16 and 30)
- **One countdown.** The prompt banner, the dice ask banner and the dice dialog share one countdown
  (`src/hooks/use-seconds-left.ts`, `src/utils/countdown.ts`) in place of the dialog's own copy.
  (app, item 25)
- **Test counts corrected.** `e2e/README.md` counts 55 suites and 122 runs, and the module's
  `test/README.md` 115 harness runs, as `regress.sh` and `harness-all.sh` make them. (app and
  module, item 35)

## v0.44.0 — 2026-11-10

### Features

- **The dice an item rolls later.** Under dnd5e 5, a player typing in their dice is now also asked
  for the dice their item rolls after the first roll, such as Ice Knife's 2d6 after its 1d10, a
  dice cost or Midi-QOL bonus damage like Sneak Attack, never a d20 or anyone else's roll. The dice
  dialog opens by itself on the device the roll came from, with a banner on the player's other
  devices, and after a minute, or once the Gamemaster presses Roll it now, Foundry's computer dice
  roll them. (app and module, item 11)
- **Tidy 5e Sheets' journal.** A character's Tidy 5e Sheets journal entries, the Classic sheet's
  boxes too, show read only in a "From Tidy 5e Sheets" section at the end of its journal, each with
  a chip and when the app first saw it and last saw it change. Secrets stay hidden where no player
  owns the character, the entries stay readable while Tidy is off or uninstalled, and Tidy 5e
  Sheets joins the modules listed on the campaign card and in the module's settings window. (app
  and module, v1.x item 8)

### Fixes

- **Cost checks no longer ask the Gamemaster.** With the Gamemaster's Manual Dice on, using an item
  from the app no longer asks the Gamemaster for an unused roll of its dice cost, such as 1d4
  charges. The module's check of what a use would spend, Midi-QOL's own check as the use begins
  and the module's dice self-test at start-up now roll Foundry's computer dice; the cost actually
  spent is rolled as before. (module, item 22)
- **The Beast list no longer blames the game.** When the game takes Wild Shape's request for the
  Beast list but the app can't follow its answer, the list now says the Beasts couldn't be read
  back this time and offers Try again, where it said the game had failed. (app, item 4)
- **Hit dice told as sent.** In a hit-dice run made one die at a time, with a module before 0.20.0,
  a die the app can't follow is now told as sent to the game, not as made, when a later die isn't
  made. (app, item 5)
- **Focus after End Turn.** After an End Turn the app couldn't follow, keyboard focus now moves to
  the next turn's heading, as after one it could, where it stayed on the next turn's End Turn
  button. (app, item 6)
- **The dice tray for keyboard and screen readers.** Keyboard focus now stays in the dice tray when
  the last die of a size is taken away, and screen readers hear the tray's whole formula, such as
  1d6 + 2, once each time its dice change. (app, item 7)
- **The dice tray on short screens.** On a short landscape screen, the open dice tray now stays
  within the chat pane and leaves room for the chat above it, and its bar always fits, open or
  closed. (app, item 7)
- **End Turn's refusal line kept.** On phones and tablets, the turn panel's "Your turn wasn't
  ended" line now stays through a change of tab, as it did on a wide screen, until the turn moves
  on or End Turn is pressed again. (app, item 10)
- **Odd data from the game read safely.** A malformed entry in the game's settings lists no longer
  pushes a good one off the campaign card. A feature's recharge, a character's portrait and a
  roll's critical and advantage marks are checked as they arrive, so a bad value can't show a
  wrong recharge, break a page or call a roll a critical hit. (app, item 10)
- **Old prompts cleared away.** The game's save and check prompts are now deleted a day after they
  close or run out, as dice asks are, where they were kept until the campaign was deleted. (app,
  item 20)

### Enhancements

- **Exploding dice asked of the player.** Under dnd5e 5, when a typed die explodes, or is rerolled
  and not kept, the player is now asked for the extra die, one at a time, where Foundry threw it. A
  die Foundry's computer threw is never asked again. (app and module, item 11)
- **Favorites in one list on tablets.** Favorites stay in one list until their card is 720 pixels
  wide, so they no longer split into two narrow lists on a portrait tablet. (app)
- **Fewer database reads at the table.** While a table is open, the app's wait for the game's
  commands makes about 40% fewer database queries, about 20% fewer over a three-hour session.
  (app, item 10)

### Maintenance

- **Refactor follow-ups.** The pure rules in `src/db/roll-requests.ts`, `table.ts` and `notes.ts`
  move to `src/utils/` with their own tests, and every schema is tied to the hand-written type it
  reads into. One `seatTurn` rule serves the Combat tab's dot, the turn panel and End Turn, a
  companion's pane is refused 409 `unavailable` for every kind it can't take, and eslint keeps
  client code away from the `node:crypto` utilities. (app, items 1 and 10)
- **Tests and coverage.** `campaign-index.tsx` now counts towards coverage, the chapter-line test's
  clock race and the unused `@test-utils` alias are gone, and a lint test covers the type-guard
  autofix. One table-driven test checks 401 and 404 for all 16 journal-notes routes, and each
  route's file keeps its wiring check. (app, items 2, 3 and 10)
- **End-to-end runs.** `e2e/README.md` lists the known load races. New runs cover module 0.42.0
  (`SKEW=042`), the dice tray at 768 px (with rolls off and against an older module), and hit
  points under dnd5e 6 and Midi-QOL. (app, items 8 and 9)
- **The hello's order in PROTOCOL.md.** The module's `PROTOCOL.md` now says the hello's companions
  are sent before its books, the order the module uses; nothing in the app depended on it.
  (module, item 21)
- **ROADMAP and version labels.** ROADMAP.md takes v0.44's finished work out, keeps the checks to
  make at the table before v0.44.0 was tagged, and lays out the next slice and the follow-up batch.
  Work planned as module 0.45.0 is relabelled 0.44.0 in both repos, as it was released, the e2e
  screenshots' `e2e/shots-044` included. (app and module)
