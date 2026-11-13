# Changelog

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). A version is the module's:
the app deployed with it ships with it, and app-only work goes under the module version it shipped
with, or the next one tagged after it.

Done work moves here from [ROADMAP.md](ROADMAP.md) as a version is built. Until the module is tagged
its heading reads `— release candidate, not yet tagged`; once it is, the version reads as released,
with its date. Each version has up to four sections, in this order:

- **Features:** something new you can do.
- **Fixes:** something that was wrong now works as it should.
- **Enhancements:** something that already worked now works better.
- **Maintenance:** tests, docs, refactors and tooling; nothing changes at the table.

Each entry ends with where it lives, the app, the module or both, and its ROADMAP item where it had
one. ROADMAP.md began with v0.34, so the versions before it have none, and an item from another
version's list names that version, such as v1.x item 8.

## v0.48.0 — release candidate, not yet tagged

### Enhancements

- **The stone lights up while a page loads.** Once a page has checked that it may be shown, the
  app now shows its stone in the middle of the page while the page reads its data, where it showed
  nothing before: on your characters, your campaigns, a character's sheet, the Gamemaster's seat
  at one and an invite link. Its carved rune lights like a signal's bars, over and over every 2
  seconds: dark, then the dot, the dot and the inner arc, all three, half a second each, then dark
  again. Where the device asks for reduced motion, the rune is lit and still. A screen reader hears
  "Loading…". Every page answers with the same status and redirect as before: signed out, the
  server sends you to sign in; a page that isn't open to you is not found. Opening one of these
  pages afresh, the stone may only flash where the data comes quickly; going to one from another
  page of the app, it shows for at least about a third of a second, so the page comes up that much
  later than before. An installed app's launch screen is drawn by the phone (on Android, from the
  app's manifest), so it stays still; the stone follows it once the page starts loading. (app)

### Maintenance

- **ROADMAP kept current.** ROADMAP.md's v0.47 section reads as released, its checks at the table
  kept. (app)

## v0.47.0 — 2026-11-12

### Features

- **Favorites put in order from the app.** A player can now put their character's favorites in
  order: Reorder, beneath them, lists them to drag into place, as the journal's notes are, or to
  move with a grip's up and down keys, Home and End, or the arrows beside it, then Save order. On a
  phone, a favorite's menu among the favorites has Move up and Move down, each left out where it
  can't move that way, and Help names them; a skill, tool or spell-slots favorite has no menu and
  moves in Reorder (ROADMAP item 47). The order is saved as dnd5e's own, under dnd5e 5.3.3 and
  6.0.5, so the character's sheet in Foundry shows it too, Tidy 5e Sheets' included, which sorts
  dnd5e's favorites the same way; the old-style resources dnd5e lists first stay first. Where the
  favorites changed in Foundry meanwhile, the order isn't saved ("Order not saved") and the sheet
  shows Foundry's, and none is saved while the character is in Wild Shape. With a module before
  0.47.0 neither Reorder nor Move up and Move down is offered. (app and module, item 28)

### Fixes

- **A roll from the app made as the character's player.** A character shared with All Players as
  Owner, owned by one player by name and assigned to no one, now rolls from the app as that player,
  so its card is theirs, where it rolled as the Gamemaster. One assigned to a player still rolls as
  them, and one with no player as the Gamemaster: so now does one shared with All Players and owned
  by no player by name, which in a world with a single player rolled as that player.
  (module, item 45)
- **A move from a party sheet shows on the sheet at once.** After a move of items or coins sent
  from a party sheet open over a character's, the character's sheet beside it now shows it as the
  game makes it, where it waited up to 3 seconds for the next refresh: the page reads the table
  again as the game answers, as it has since v0.46.0 for a roll or change sent from the sheet. It
  does so too where the party sheet is closed before the game answers, as on a phone to see the
  character's sheet beneath it. (app, items 43 and 46)
- **Favorites move just after an order.** For the 10 seconds after an order is sent, a favorite
  added meanwhile, from a row's menu or in Foundry, now moves with Move up, Move down and Reorder,
  and so does every other one, where the app refused the order as invalid or the game as changed:
  the order shown takes in a favorite it doesn't hold, where the sheet lists it, so the next order
  names every favorite the app shows. Nothing wrong was written. (app, item 48)
- **A request settles as the game answered it.** A roll, change or move sent from the app now
  settles as the game answered it, refused, made or lost, even where the page's own handling of
  that answer, or of the app taking it, fails: it's no longer asked after once a second for up to
  110 seconds, nor said refused for want of the network once the app took it. Nothing in the app
  fails that way today. (app, items 44 and 50)
- **Module 0.43.0 named for hit points and the dice tray.** With module 0.43.0 and its Allow
  Players to change their hit points from the app switch off, the campaign card's Players' hit
  points line now says to tick it, where it said version 0.44.0 or later was needed; and with an
  older module, the dice tray says the module makes its rolls from version 0.43.0, not 0.44.0.
  Help's list of what the Gamemaster turns on names 0.43.0 for both too, and README.md's
  supported-versions table lists both under v0.43.0, where its v0.44.0 row had them. (app, items
  51 and 53)

### Maintenance

- **Docs for v0.47.** README.md's supported-versions table gains v0.47.0. The module's
  `PROTOCOL.md` gains the `favorite` command's order (`{ op: "order", order, was }`), the hello's
  `features.favorites.orders` and a "Module 0.47.0" entry, and says whom a roll from the app is
  made as by a character's players; its `README.md` says both. (app and module)
- **ROADMAP kept current.** ROADMAP.md takes out items 28, 43 to 46 and 48 to 52 as done, adds
  v0.47's release-candidate section with its checks at the table, and items 46 to 55, found while
  building v0.47, of which 47 stays, and its known limits no longer send favorites to Foundry to
  be put in order. README.md's Tested line names module 0.46.0, which `e2e/skew.conf` runs (item
  54). (app)
- **One sortable list, one class line and a migration.** The journal's sortable list and its drag
  move to `src/components/sortable`, shared by the notes' and the favorites' Reorder, and a class's
  name with its levels is one rule (`src/features/sheet/utils/class-line.ts`) for its favorite's
  row, the sheet's class line and Reorder. Migration `20261112090000_favorite_orders` keeps whether
  the campaign's module puts favorites in order, from its next hello. (app)
- **One Reorder row.** The notes' and the favorites' Reorder draw one row, with its grip, place
  and up and down arrows (`src/components/sortable/reorder-row.tsx`), beside the sortable list they
  share, the arrows' look written once (`SQUARE_ICON_BUTTON`). Both look and work as before.
  (app, item 49)
- **End-to-end checks.** `favoriting` part 14 puts Thorin's favorites in order by Reorder's drag
  and keys and by Move up and Move down at 390 px, under dnd5e 5 and 6, Foundry's actor keeping
  each order, and moves the Wand of Frost, made a favorite in Foundry while an order is on its way
  (item 48); a new run against module 0.46.0 (`e2e/skew.conf`'s 046) checks favorites are offered
  but never put in order. `transfers` part 3 checks Thorin's sheet shows what he took from the
  party within a second, the page asking for the table as the game's answer comes, and part 4 the
  same at 390 px with the party sheet closed before it (item 46). The `dice` suite's run against
  module 0.42.0 checks the tray names 0.43.0 (item 51), and `e2e/README.md` counts `regress.sh`'s
  125 runs (item 52), its Outputs table now Prettier-formatted (item 55). (app)
- **Jest tests.** New tests pin the favorites' order rules
  (`src/features/sheet/utils/favorite-order.ts`, Move up and Move down at each end), Reorder's
  focus and a favorite's menu, an order's request and the hello's `orders`, with the words golden
  recording an order's toasts and tray lines; the party page reading the table again as a move is
  made, its panel closed or not; and a request whose callback throws settling, or followed once
  the app took it. Others pin an order naming a favorite added while the last one waits, the
  Reorder row's dimmed arrows, and the words naming module 0.43.0. An order's request reads the
  campaign once, with the command's other checks. (app)
- **The module harness.** `test/fvtt/favoriting.mjs` checks an order written as dnd5e's sorts
  under dnd5e 5 and 6, the places kept, nothing written for the same order, "changed", "error" and
  the refusals; `wildshape.mjs` checks "shaped"; and `rolls.mjs` checks a character shared through
  All Players rolling as its player by name, or as the Gamemaster where it has none. (module)

## v0.46.0 — 2026-11-12

### Fixes

- **A shared character's whispers kept to its own players.** A character shared with All Players
  as Owner no longer gets other players' whispers and private rolls at its seat, nor the saves
  their whispered cards ask, nor the outcome of a check only its author may see. Its players are
  those given Owner on it by name, else the player it's assigned to, as for its companions since
  v0.45.0. (module, item 37)
- **A shared character's owners kept to its own players.** A character shared with All Players as
  Owner no longer tells the app that every player in the world, other campaigns' too, owns it, and
  sees a party sheet only as its own players may. In Foundry, a dish's card is whispered only to
  the campaign's own players, and the dish's Apply dialog names each character's players. (module,
  item 38)
- **The Recharge chip clears with "recharged".** After a recharge rolled at the table, the
  sheet's Recharge chip now clears within a moment of the dice tray saying "recharged", where it
  stayed up to 3 seconds and a tap on it was refused. The same goes for any roll or change sent
  from the sheet or a companion's pane, End Turn and Undo aside: the page reads the table again as
  the game answers, and once more half a second later, instead of waiting for its next 3-second
  refresh. A move from a party sheet still waits for that refresh (ROADMAP item 43). (app, item 39)
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
  player in User Configuration, now gets that player's whispers, private rolls, check outcomes and
  save DCs, has its dish cards whispered to them, sees a party sheet as they may and its roster
  names them, where in v0.45.0 the assignment counted only for which sidekicks it lists; its
  journals, and who may type in its dice, still follow who owns it in Foundry. A change of a
  player's character or role in User Configuration, or a player added or removed, now reaches the
  party sheets at once. (module)

### Maintenance

- **Docs for a character's players.** README.md's supported-versions table gains v0.46.0, and the
  module's `PROTOCOL.md` gains "A character's players" and a "Module 0.46.0" entry, its
  `group.updated` now saying a user's change sends groups at once. The module's `README.md` says
  how to make a player a character's player and what the dish Apply dialog names, and comments in
  `scripts/characters.mjs`, `chat-data.mjs` and `chat.mjs` name the rule. (app and module)
- **ROADMAP kept current.** ROADMAP.md gains v0.46's section with its checks at the table, takes out
  items 37 to 40 as done, adds items 41 and 42, two load races seen in v0.45's last end-to-end pass,
  and items 43 to 45, found while building v0.46, and takes out v0.44's and v0.45's sections once
  they were released. Its follow-up batch is renamed "Not yet scheduled". (app)
- **End-to-end checks.** `alone` part 15 checks the Recharge chip goes within 2 s of "recharged"
  and the next read comes within 850 ms, `rolls` checks the Initiative tile in an encounter
  switched away from, and `typed` part 12 lets the asked save open at 10:00 left, as it now can.
  `uses` part 5 waits for Bless's Prepare to be enabled before reading its menu, and
  `e2e/README.md` lists two more known load races (items 41 and 42). (app)
- **Jest tests and one read-again rule.** Jest tests pin item 39's read-again on the character's
  page and in a companion's pane, a late roll read once as it's made, and the Initiative tile's
  rule, shared with the Combat tab's line and the app's own check. The read-again is written once,
  in `src/hooks/use-read-again.ts`. (app)
- **The module harness.** Its stand-ins keep each actor's ownership by user id, as Foundry does
  (`test/fvtt/stub.mjs`), and let a player make Midi-QOL's concentration card (`dnd5e-cards.mjs`).
  New cases check a character shared with All Players, owned by name or assigned: its whispers,
  private rolls, check outcomes, roster, dish cards and party sheet in `test/fvtt/companions.mjs`,
  a change of a player's character re-sending its party sheets in `groups.mjs`, a dish's card in
  `dishes.mjs`, and its save DCs in `prompts.mjs` and `midi-prompts.mjs`. (module)

## v0.45.0 — 2026-11-11

### Features

- **Help on a character's page.** The ? at the top of a character's page, or How to use Sending
  Stone in the cog's menu, opens Help in a side panel: rolling, holding for more, the dice tray,
  typing in your own dice, hit points and rests, combat, the settings and what your Gamemaster
  turns on. A box at its top says what this game and this device allow for the character, and the
  Gamemaster sees what their player sees. (app, item 12)

### Fixes

- **A campaign's chat keeps to its own cards.** Where one Foundry world runs more than one
  campaign, a campaign's chat no longer shows another campaign's public cards, such as its fight's
  initiative and attacks. The Gamemaster's narration and the cards of a fight both campaigns are in
  still reach both, and a card's edits go where the card first went. (module, item 19)
- **A shared character's sidekicks are its own players'.** A character shared with All Players as
  Owner no longer counts every player as its own, so another campaign's sidekicks, their sheets and
  their fights stay out of it. Its players are those given Owner on it by name, else the player
  it's assigned to. (module, item 19)
- **A die thrown again called by its roll's name.** Under dnd5e 5, when a utility's die is thrown
  again, such as Wild Sparks' exploding die, the ask for it now uses the roll's own name, "Wild
  Sparks: Burst", as its chip and the dice tray do, where it said "Wild Sparks: Use". The
  Gamemaster's window says it too. (module, item 26)
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

- **Condition immunities show their rules.** Each condition under a creature's Condition
  Immunities that the app has rules for now shows them on hover and opens the Conditions panel on a
  tap, as conditions in descriptions already did. One it has no rules for, such as Poison, stays
  plain text. (app)
- **The Combat tab shows only a fight under way.** The Combat tab shows whose turn it is and the
  initiative order only once an encounter has begun and is the one on the Gamemaster's tracker.
  Otherwise it says "No combat right now", and the header "No combat" where it said "Getting
  ready", with a line before Begin Combat to roll initiative from the sheet while the character or
  one of its companions has none. (app, item 19)

### Maintenance

- **Steadier tests.** `src/db/note-sync.test.ts` passes in any test order. e2e's feedback suite
  finds the attack roll's own message, not the item's card before it, and `alone-e2e.mjs` part 15
  waits for Fire Breath's Recharge chip to go, so neither fails under load and `e2e/README.md`'s
  known load races drop both. (app, items 15, 16 and 30)
- **One countdown.** The prompt banner, the dice ask banner and the dice dialog share one countdown
  (`src/hooks/use-seconds-left.ts`, `src/utils/countdown.ts`) in place of the dialog's own copy.
  (app, item 25)
- **Test counts corrected.** `e2e/README.md` counts 55 suites and 124 runs, and the module's
  `test/README.md` 115 harness runs, as `regress.sh` and `harness-all.sh` make them. (app and
  module, item 35)
- **End-to-end checks.** New `help` and `names` suites check Help, for a player and the
  Gamemaster, and long names in Chromium. Others now check the Combat tab with no fight under way,
  a die thrown again named by its roll, condition immunities from D&D Beyond and a campaign's chat
  without another campaign's fight cards. (app)
- **Shared pieces for Help.** The header's icon-button look, and the Conditions reference's "Go to"
  chips and their scroll, are shared with Help (`src/constants/buttons.ts`, `src/utils/scroll.ts`),
  and a side panel can open at its title. (app)
- **Docs and ROADMAP for v0.45.** README.md's supported-versions table gains v0.45.0, and the
  module's `PROTOCOL.md` gains a "Module 0.45.0" entry, its `README.md` says the same and its
  harness notes are corrected. ROADMAP.md takes out items 12 to 17, 19, 25 to 27 and 30 to
  35 as done, adds v0.45's release-candidate section with its checks at the table, moves item 18 to
  the follow-up batch beside a new item 36, and adds items 37 to 40, found while building v0.45.
  (app and module)

## v0.44.0 — 2026-11-10

Some work planned for v0.44 shipped earlier and is listed under [v0.43.0](#v0430--2026-11-06), not
below:

- On 2026-11-06, with module v0.43.0 and its app: hit points and temporary hit points set from
  the app (of the character, its Wild Shape form and its companions), and the dice tray under the
  chat. README.md's table and the module's `PROTOCOL.md` list these under 0.44.0.
- On 2026-11-04, in the app: favorites on the Character tab, larger icon buttons on tablets,
  Manual Dice in the dice dialog's header and the Gamemaster clearing a campaign's chat, with a
  round of fixes.

### Features

- **The dice an item rolls later.** Under dnd5e 5, a player typing in their dice is now also asked
  for the dice their item rolls after the first roll, such as Ice Knife's 2d6 after its 1d10, a
  dice cost or Midi-QOL bonus damage like Sneak Attack, never a d20 or anyone else's roll. The dice
  dialog opens by itself on the device the roll came from, with a banner on the player's other
  devices, and after a minute, or once the Gamemaster presses Roll it now, Foundry's computer dice
  roll them. (app and module, item 11)
- **Tidy 5e Sheets' journal.** A character's Tidy 5e Sheets journal entries, the Classic sheet's
  boxes too, show read only in a "From Tidy 5e Sheets" section at the end of its journal, each with
  a chip and when the app first saw it and last saw it change, and Tidy joins the modules listed on
  the campaign card and in the module's settings window. Secrets stay hidden where no player owns
  the character; while Tidy is off or uninstalled the entries stay readable, with a line saying
  they can't be changed until it's back; and in Wild Shape a line warns that entries changed on the
  beast's Journal tab are lost when it ends. (app and module, v1.x item 8)

### Fixes

- **Cost checks no longer ask the Gamemaster.** With the Gamemaster's Manual Dice on, using an item
  from the app no longer asks the Gamemaster for an unused roll of its dice cost, such as 1d4
  charges: the module's check of what a use would spend, Midi-QOL's own check as the use begins
  and the module's dice self-test at start-up now roll Foundry's computer dice. The cost a use
  actually spends is still rolled with the Gamemaster's dice, or asked of a player typing in their
  dice. (module, item 22)
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
- **Fewer database reads at the table.** While a table is open, the module's regular fetch for
  players' commands, which the app holds open while it waits for one, makes about 40% fewer
  database queries: about 45,000 fewer in a three-hour session, a
  fifth of all the queries the app makes in one. (app, item 10)

### Maintenance

- **Refactor follow-ups.** The pure rules in `src/db/roll-requests.ts`, `table.ts` and `notes.ts`
  move to `src/utils/` with their own tests, and every schema is tied to the hand-written type it
  reads into. One `seatTurn` rule serves the Combat tab's dot, the turn panel and End Turn, a
  companion's pane is refused 409 `unavailable` for every kind it can't take, and eslint keeps
  client code away from the `node:crypto` utilities. (app, items 1 and 10)
- **Tests and coverage.** `campaign-index.tsx` now counts towards coverage, and the chapter-line
  test's clock race and the unused `@test-utils` alias are gone. `eslint.config.mjs` keeps
  `eslint --fix` from turning a type guard into `.filter(Boolean)`, which doesn't typecheck, with a
  test that pins it, and one table-driven test checks 401 and 404 for all 16 journal-notes routes.
  (app, items 2, 3 and 10)
- **End-to-end runs.** `e2e/README.md` lists the known load races. New `tidy` and `laterdice`
  suites cover Tidy's journal and the dice an item rolls later, and new runs cover module 0.42.0
  (`SKEW=042`), the dice tray at 768 px (with rolls off and against an older module), and hit
  points under dnd5e 6 and Midi-QOL. (app, items 8 and 9)
- **Docs for v0.44.0.** README.md's supported-versions table lists Tidy's journal and the dice an
  item rolls later under v0.44.0, and the module's `PROTOCOL.md` (`journal.tidy`, "Dice asks" and
  "Dice the game rolls later") and `README.md` describe both. (app and module)
- **The hello's order in PROTOCOL.md.** The module's `PROTOCOL.md` now says the hello's companions
  are sent before its books, the order the module uses; nothing in the app depended on it.
  (module, item 21)
- **ROADMAP and version labels.** ROADMAP.md takes v0.44's finished work out, keeps the checks to
  make at the table before v0.44.0 was tagged, and lays out the next slice and the follow-up batch.
  Work planned as module 0.45.0 is relabelled 0.44.0 in both repos, as it was released, the e2e
  screenshots' `e2e/.out/shots-044` included. (app and module)

## v0.43.0 — 2026-11-06

Module v0.43.0 brought hit points set from the app and the dice tray's rolls made in the game. The
module's `PROTOCOL.md` lists both under 0.44.0, as README.md's supported-versions table did until
v0.47.0, its v0.43 row reading "Nothing new: v0.43 changed only the app, with no module release".
The app turns both on from what the module's opening post says it takes, not from its version, so
they work with module v0.43.0. Two lines were wrong about it, both fixed in v0.47.0. With module
v0.43.0 and its switch off, the campaign card's Players' hit points line said version 0.44.0 or
later was needed. With an older module, which takes other rolls but not these, the dice tray said
the module makes them from version 0.44.0, where v0.43.0 does, and README.md's v0.44.0 row repeated
it. Help, from v0.45.0, named 0.44.0 for both too, also fixed in v0.47.0. The rest is the app's:
the refactor, and part of what was planned for v0.44.

### Features

- **Hit points from the app.** A player sets their character's hit points and temporary hit points
  from the Hit points tile, its Wild Shape form's and each companion's too, for what the rolls don't
  do, such as falling through a floor. A drop still asks dnd5e's concentration save, a form set to 0
  ends its Wild Shape, and nothing is posted in chat. The module's switch, Allow Players to change
  their hit points from the app, is on by default, and the Gamemaster's campaign card says under
  Players' hit points whether it's on. (app and module, v0.44 item 4)
- **The dice tray under the chat.** Under the chat, on the player's page and the Gamemaster's, a
  dice tray rolls any mix of d4 to d100, up to 20 dice, with a number added, its dice tumbling over
  the whole page. Where the campaign's rolls are on, Foundry makes it with the player's dice, typed
  ones included, as a "Dice roll" card; with an older module the tray rolls the app's own dice and
  says why the game doesn't make the roll. (app and module, v0.44 item 7)
- **Favorites on the Character tab.** A switch in the cog, Favorites on the Character tab, off by
  default and kept for each device, shows the character's favorites between Skills and Traits. (app,
  v0.44 item 2)
- **The Gamemaster clears a campaign's chat.** Clear chat, on a campaign's card, clears its players'
  chat in the app, dish cards included, while Foundry's chat log stays, and players see "Chat
  cleared" and when. Neither this nor Foundry's own Clear Chat Log can be undone by a later change
  to a cleared message, such as a dish card being served. (app, v0.44 item 8)

### Fixes

- **A connection test binds nothing.** A Test from the module no longer binds a campaign waiting for
  Foundry, so a Test from another campaign of the same game can't leave the real one refused as not
  set up. (app, v0.44 item 9)
- **Roll damage offered again.** An attack's or use's Roll damage now comes back whenever the game
  didn't make the damage, because it was refused, ran out of time or was never sent, where it was
  gone for good. (app, v0.44 item 9)
- **A roll the app took told as sent.** A roll or command the app took, whose answer names nothing
  to follow, is now told as sent and settles at once, where it was told as unreached or as getting
  no answer from the game. (app, v0.44 item 9)
- **The Gamemaster's hit dice say the hit points regained.** When only some of the Gamemaster's hit
  dice are made, they now say the hit points regained, as the player's do. (app, v0.44 item 9)
- **Counts said right.** A single condition reads "Effects, 1 condition", and where at most 20
  targets can be ticked the target list says "Up to 20.", not "Up to 24." (app, v0.44 item 9)
- **Focus after "Wild Shape ended".** Dismissing "Wild Shape ended" moves focus to the pane actually
  shown, a companion's or a phone's tab. (app, v0.44 item 9)
- **Enchantments and Heroic Inspiration say how they went.** Ending an enchantment from the Effects
  tab, and using or gaining Heroic Inspiration, now show their result line on every tab, as ending a
  concentration does. (app, v0.44 item 9)
- **A living combatant's bar keeps a sliver.** A combatant with under half a percent of their hit
  points left keeps a sliver of bar, where it was drawn as down. (app, v0.44 item 9)
- **Chat times after midnight.** Yesterday's chat messages show their date after midnight, on an
  idle table too. (app, v0.44 item 9)
- **Initials of an emoji name.** Initials keep a name's leading emoji whole, on the sheet, in the
  chat and on avatars. (app, v0.44 item 9)
- **A companion's pane backs off.** While a companion's view can't be read, its pane backs off and
  its header says Reconnecting, as the other reads do, where it kept asking. (app, v0.44 item 9)
- **The journal sends a signed-out player to sign in.** A player signed out elsewhere is sent to
  sign in from the journal, as from the table, where the journal failed. (app, v0.44 item 9)
- **The app's address behind chained proxies.** Behind more than one proxy, the campaign page's
  listener address and invite links name the app's own host, where they named every host in the
  chain. (app, v0.44 item 9)
- **Requests read more carefully.** A roll or note that declares itself too large is refused before
  it's read, a refused description is never cached, and the server's throttles forget what's past.
  (app, v0.44 item 9)

### Enhancements

- **Larger icon buttons on tablets.** From tablet width up, icon-only buttons are 44-pixel squares,
  in headers, dialogs, toasts, lists and the − and + steppers, while the sheet's tabs, Rolls and the
  cog go compact again where their labels show. Spell-slot dots keep the phone's size. (app, v0.44
  item 3)
- **Manual Dice said in the dice dialog.** Every dialog asking for typed-in dice now says Manual
  Dice in a chip in its header. (app, v0.44 item 5)
- **A sign-in lasts 30 days.** Signing in to the app now lasts 30 days by default, where it lasted 7
  days. (app)

### Maintenance

- **The refactor.** The app's code is laid out by feature under `src/features/`, with CLAUDE.md's
  rules enforced by eslint at error, no import cycles or barrels, and one request-kind table,
  command pipeline, request lifecycle, settle hook and seat resolver. Nothing the app does changed,
  which six characterization goldens in `src/__tests__/golden/` keep checking. (app, item 1)
- **Supported module versions.** README.md gains a Supported module versions section, with a row per
  release pair saying what an older module can't do. (app, item 2)
- **Project setup.** `CLAUDE.md` sets the engineering guidelines the refactor follows, README.md's
  starter text goes, and the unused starter icons in `public/` are removed. (app)
- **Tests, docs, migrations and ROADMAP for v0.43.** New `hitpoints` and `dice` e2e suites, the
  module's `hitpoints.mjs` and `plain.mjs` harness runs, and e2e checks for Clear chat and
  favorites. The module's `PROTOCOL.md` and `README.md` describe hit points and the tray, labelled
  module 0.44.0, and ROADMAP.md marks v0.42.1 released, makes v0.43 the refactor and v0.44 the
  release candidate, and lists the refactor's bugs under v0.44 item 9, taking them out as fixed.
  Migrations `20261104090000_chat_cleared` and `20261106090000_hit_points` keep when a campaign's
  chat was last cleared and whether its players set hit points. (app and module)

## v0.42.1 — 2026-10-29

### Features

- **Bardic Inspiration offered.** When a 2024 bard's Inspired is on the character, a player typing
  in their dice is offered Bardic Inspiration's die beside Done, left out until they add it once the
  Gamemaster says the roll fails. Once the roll is made, the app removes Inspired where the campaign
  lets players remove their own effects, or asks them to have the Gamemaster remove it. (app and
  module, item 2)
- **Spell slots from the dots.** With Send to the table on, a tap on a spell slot's dot on the
  Spells tab or a spell-slots favorite asks to spend one or restore one, Pact Magic too, then
  changes it in Foundry with a line in chat. The Gamemaster's page of a character does the same.
  (app and module, item 3)
- **Spells prepared from the app.** A spell row's menu, on the Spells tab, the Favorites strip and
  the Actions tab (Unprepare only there), offers Prepare or Unprepare, made in Foundry as its own
  sheet's menu does, with nothing posted in chat. It needs the Gamemaster's game open, and isn't
  offered on the Gamemaster's page, a companion's pane or in Wild Shape. (app and module, item 4)

### Fixes

- **Undo's toast goes with the turn.** After Undo, "Taking your turn back…" now goes as the turn
  panel shows your turn, where under load it lingered a moment longer. (app)

### Enhancements

- **Prepared spells counted and marked.** The Spells tab shows how many spells each class has
  prepared of how many, "Prepared 5 / 6" as Foundry's sheet does, and a spell not prepared now says
  Not prepared on its row. (app and module, item 4)
- **Elven Accuracy's third d20 on its own line.** When typing in dice for an attack with Elven
  Accuracy, the third d20 is asked on a line of its own after the two advantage dice, with Skip to
  let Foundry roll it. (app, item 1)

### Maintenance

- **Docs and tests for v0.42.1.** The module's `PROTOCOL.md` gains "Preparing spells", a Spell slots
  paragraph and three "Module 0.42.1" entries, and ROADMAP.md marks v0.42.0 released, lists
  v0.42.1's items and says when Damage on its own asks to spend. The module's harness gains
  `preparing.mjs` and cases in `typed`, `charges` and `wildshape`, and the app's `typed`, `feedback`
  and `uses` e2e suites cover the new items. (app and module)

## v0.42.0 — 2026-10-28

### Features

- **The dice effects add, typed in.** Under dnd5e 5, a player typing in their dice for a d20 roll
  sent to the game is now asked for each die their effects add, named by the spell or item, such as
  "Bless: +1d4" or "Bane: −1d4", with Skip to let Foundry roll it. A party caster's name is added
  only to tell two alike apart, and a concentration check gets only the dice concentration adds.
  (app and module, item 1)

### Fixes

- **A dish's save bonus once on death saves.** A dish's bonus to saving throws now counts once on a
  death save, where it counted twice. A dish eaten before keeps both until it ends. (module)

### Enhancements

- **Rerolls kept at the table.** A die the player typed in now stands as entered: Foundry no longer
  rerolls it for a Halfling's Luck or Great Weapon Fighting, as the player rerolls at the table and
  types the die kept. Typed damage and formulas that reroll count each die that way, with a note to
  reroll at the table. (app and module, item 2)

### Maintenance

- **Docs and tests for v0.42.** The module's `PROTOCOL.md` gains a "Module 0.42.0" entry and says a
  listener drops an effect-dice entry with keys it doesn't know, as the app now does ahead of
  0.42.1. The `typed` harness run and e2e suite cover both items, with a module 0.41.0 run, and
  ROADMAP.md marks v0.41.0 released. (app and module)

## v0.41.0 — 2026-10-28

### Features

- **Companions' saves from the app.** A save the game asks of a listed companion, by dnd5e's save or
  concentration card or by Midi-QOL, is now asked on the companion's own pane, its tab marked and a
  notice with Show on the character's page, and rolled in Foundry on the companion. A Gamemaster's
  request for a save posted in chat still asks only the characters. (app and module, item 3)

### Fixes

- **Wild Shape held to Midi-QOL's Bonus Action.** Where Midi-QOL enforces Bonus Actions, a Wild
  Shape change or return from the app is now refused in a fight once the character has used their
  Bonus Action, as every other Bonus Action from the app already was, and marks it used when made.
  (app and module, item 1)

### Enhancements

- **Damage on its own, with its choices.** With Damage on its own on, a damage chip opens a picker
  where there's a choice: the spell's level, the weapon's mode or its ammunition, and a switch to
  spend the slot, use, ammunition or thrown weapon in Foundry. Foundry's card names the choice and
  what was spent. A spend begins concentration where the spell needs it and, under Midi-QOL, counts
  the Bonus Action or reaction it takes, and is refused in a fight once that's used. (app and
  module, item 2)

### Maintenance

- **Docs, sheets and tests for v0.41.** The module's `PROTOCOL.md` gains a "Module 0.41.0" entry,
  and its slim sheets leave out of each choice what it shares with its row, which the app's
  `expandSheet` puts back. The module's harness gains `companion-saves.mjs`, the app's e2e gains
  `companionsaves` and the `alone` suite's choices, with module 0.40.0 runs, and ROADMAP.md marks
  v0.40.0 released. (app and module)

## v0.40.0 — 2026-10-27

### Features

- **Wild Shape from the app.** With Allow Players to use Wild Shape from the app on for the campaign
  in Foundry, a 2024 druid's player learns Beasts from the Gamemaster's chosen compendiums, within
  the rules and one replaced after each Long Rest, and changes into one from the app, spending a
  use, and back again for none. The sheet becomes the beast's, with a ribbon showing the time left
  and Return, and Wild Shape ends when its hours of world time run out, at 0 hit points or
  Incapacitated, what changed in form carried back to the druid. Known forms are kept on the druid's
  own Wild Shape, so once one is learned, that druid's Wild Shape in Foundry offers them in place of
  dnd5e's Challenge Rating browser. (app and module, item 1)
- **Wild Shape on the Gamemaster's campaign page.** The campaign page gains a Wild Shape section
  saying whether the campaign's druids change from the app, or what it needs first, and its Foundry
  settings list the switch, Off or On. (app and module, item 1)

### Enhancements

- **Transformed characters followed.** A character transformed in Foundry, by Wild Shape, Polymorph
  or the Gamemaster, now shows as its form in the app, while its turns, chat cards and the saves
  asked of it stay the character's, so End Turn works on the form's turn. While the character is in
  another form, the controls to change its favorites and effects, or to move or remove what it
  carries, are hidden, and the game refuses them. (app and module, item 2)

### Maintenance

- **Docs and ROADMAP for v0.40.** The module's `PROTOCOL.md` gains a "Wild Shape" section and a
  "Module 0.40.0" entry, its `README.md` the switch and its limits, and both bug forms the Wild
  Shape switch. ROADMAP.md marks v0.39.0 released and lays out v0.41 to v1.0, with v0.43 as the
  release candidate and known limits saying which are planned. (app and module)
- **Tests and a migration for v0.40.** The module's harness ports dnd5e 5.3.3's transformation with
  its own Beasts (`transform5e.mjs`) and gains `wildshape.mjs`. The app gains the `wildshape` e2e
  suite, with dnd5e 6 and module 0.39.0 runs, and the `companions` suite waits for its pictures to
  settle. Migration `20261029090000_wild_shape` keeps whether the campaign takes Wild Shape. (app
  and module)

## v0.39.0 — 2026-10-26

App PR #52 was closed unmerged on 2026-10-25: its one change, a fix to two end-to-end suites, came
in with PR #53 and is under Maintenance below.

### Features

- **Players turn off and delete their own effects.** With Allow Players to disable & remove their
  own active effects on for the campaign in Foundry, a player turns off and deletes, from their
  Effects tab, the effects their party put on their character, such as an ally's Bless or a dish's,
  and turns off an item's temporary effect such as Rage, turning back on only what they turned off
  there. Never a monster's effect, one made on the sheet, a condition or a concentration, and the
  campaign page says whether it's on. (app and module, item 1)
- **Report a bug or request a feature.** Every cog in the app, a footer on its pages with the site
  header, and Sending Stone's settings in Foundry now link to each project's GitHub forms for a bug
  or an idea. Foundry's bug link fills in the module's, Foundry's and the system's versions, and
  nothing else. (app and module, item 3)

### Fixes

- **A dish's dialogs serve whoever is ticked.** A dish's Apply… and Apply to others… dialogs now
  serve the characters the Gamemaster ticks. Apply… served only those ticked as it opened, Apply to
  others… couldn't apply, and a card whose cook had left the campaign was never served. Check who
  ate each dish served with 0.38.x. (module, item 2)
- **Copy after Reset link.** After Reset link, the invite link's Copy button offers Copy again for
  the new link, where it still said Copied while the clipboard held the old one. (app)

### Enhancements

- **The campaign page as a list.** The Gamemaster's campaigns are now a list, those that need them
  first, with the chosen one beside it on a wide screen or opened from it on a phone, and a search
  from seven campaigns. The chosen campaign is kept in the page's address, so a reload or a sign-in
  keeps it, and the back arrow on the Gamemaster's view of a character, and on a party's page,
  returns to it. The site header marks Campaigns as the page shown. (app, item 4)
- **The Magical Recipe Book in the cog.** Configure Magical Cookbook, a new entry in the sheet's
  cog, opens the link code and the dishes sent in a window of their own, in place of the Biography
  tab's card. (app, item 2)
- **Dish cards for the campaign's players.** A dish's card in Foundry is now whispered to the
  campaign's players too, who see what became of it but no buttons, and its text reaches their chat
  in the app as a whisper, in its own campaign only. (app and module, item 2)

### Maintenance

- **Docs for v0.39.** The module's `PROTOCOL.md` gains "A player's own effects" and a "Module
  0.39.0" entry, and its `README.md` the effects switch, a dish card's readers and the new links;
  both repositories' bug forms follow the new switch and the cookbook's new place. ROADMAP.md marks
  v0.38.1 released and lays out v0.39's four items. (app and module)
- **Tests and a migration for v0.39.** The module's harness gains `effects-core.mjs`, shared with
  the app's e2e, and `effects.mjs`, and `dish-core.mjs` draws the dish dialog as Foundry core does.
  The app gains 12 Jest suites, the `effects` and `campaigns` e2e suites and migration
  `20261028090000_player_effects`, and `gmroll-e2e` and `activities-e2e` bind `localize` to
  `game.i18n`. (app and module)

## v0.38.1 — 2026-10-25

### Fixes

- **Dish cards posted in Foundry.** Under module 0.38.0 no dish's card was posted in Foundry, so the
  player's card ended at "Couldn't reach the game: Foundry didn't answer after 5 tries." Cards now
  post, and the Gamemaster's buttons and the Who ate it? dialog, which would have failed the same
  way, work. Dishes that had already failed don't retry by themselves. (module)

### Maintenance

- **A stricter harness.** The harness's `game.i18n` reads its translations as Foundry's does, so a
  call made apart from it fails in the tests as in Foundry, and a new `dishes` case answers Apply…'s
  dialog (`test/fvtt/stub.mjs`, `dishes.mjs`). (module)

## v0.38.0 — 2026-10-25

### Features

- **Dishes from the Magical Recipe Book.** A player makes a link code on their character's Biography
  tab and pastes it into the Magical Recipe Book, and each dish they eat there reaches Foundry as a
  card only Gamemasters see. There the Gamemaster chooses who ate it, each getting its effect for 24
  hours of game time, one dish at a time, or sets it aside, and the player's card shows what became
  of each dish. The Gamemaster turns dishes on for each campaign on its Player actions tab in
  Sending Stone's settings, under dnd5e 5 only. With this release no dish's card posted in Foundry,
  which v0.38.1 fixed. (app and module, item 1)
- **Dishes on the Gamemaster's campaign page.** The Gamemaster's campaign card gains a Cookbook
  dishes section saying whether the campaign takes dishes and how many wait, and its Foundry
  settings a Dishes row. A roster entry whose player has linked the cookbook shows Cookbook linked,
  with a button to revoke the link. (app and module, item 1)

### Maintenance

- **Docs, tests and ROADMAP for v0.38.** The module's `PROTOCOL.md` gains `features.dishes`, the
  `dish` command, `dish.applied`, `dish.dismissed` and a "Module 0.38.0" entry, and its `README.md`
  a dishes section; a new `cookbook` e2e suite, on the module's shared `dish-core.mjs` stand-ins,
  and a `dishes` harness run check them. ROADMAP.md marks v0.37 released, lists v0.38 and adds two
  known limits, and the bug forms gain the dishes switch and card. (app and module)
- **A migration.** `20261027090000_cookbook_dishes` adds cookbook links and dishes, and whether the
  campaign takes dishes and which versions its module reads. (app)

## v0.37.0 — 2026-10-24

### Features

- **Favorites from the app.** A right-click, long-press, the menu key or Shift+F10 on an item, one
  of its activities or an effect offers Add to favorites or Remove from favorites, and each favorite
  in the Favorites list offers Remove. They're dnd5e's own favorites, made in Foundry, so its sheet
  shows them too, a new one last. (app and module, item 1)

### Fixes

- **Two items' activities both favorites.** Favorites of two items' activities that share an id, as
  dnd5e gives migrated items, now show as two in the Favorites list, where the second was left out.
  (app)

### Enhancements

- **The module's new title.** Foundry now lists the module as illagria/sending-stone, so Manage
  Modules sorts it under I, and names its settings section the same; Connect Foundry's first step
  says so. Its id, settings, flags and links are unchanged. (app and module, item 3)

### Maintenance

- **Issue forms.** Both repositories gain GitHub bug and feature forms, each pointing to the other
  for what belongs there, with blank issues off, and each `package.json` gains its `homepage`. (app
  and module, item 2)
- **Docs, tests and ROADMAP for v0.37.** The module's `PROTOCOL.md` gains `features.favorites`, the
  `favorite` command and a "Module 0.37.0" entry, and a new `favoriting` e2e suite and harness run
  check favorites. ROADMAP.md marks v0.36 released, lists v0.37, plans dishes as v0.38, takes
  v0.37's two items out of v1.0 and adds two known limits. (app and module)
- **A migration.** `20261026090000_campaign_favorites` keeps whether the campaign's module makes
  favorites for the app. (app)

## v0.36.0 — 2026-10-24

### Features

- **Companions, sidekicks and familiars.** The creatures a character summons, such as a familiar,
  while their tokens are on the active scene, and the NPCs its player owns show as tabs above its
  sheet, each with its own sheet, dice tray and toasts. Their checks, saves, attacks, spells, uses,
  damage and recharges are made in Foundry on the creature's token as the character's player. The
  Gamemaster's pages show the same tabs, the campaign card lists each character's companions, and a
  legendary action with too few left is refused, a character's too. (app and module, item 1)
- **Companions' initiative.** The Gamemaster chooses for each campaign, on its Player actions tab in
  Sending Stone's settings, whether companions roll their own initiative or act right after their
  character. Right after its character, a companion is set just below the character in Foundry
  whenever the character's initiative is set, rerolled or cleared, and its Initiative tile reads
  "After Thorin". (app and module, item 1)
- **Damage on its own.** Damage on its own, a switch under Send to the table in the sheet's
  settings, kept for each device, sends a damage or healing chip with nothing due to Foundry as
  dnd5e's card with no targets, for the Gamemaster to select tokens and apply. Under Midi-QOL it
  stays outside the workflow until the Gamemaster applies it. (app and module, item 2)
- **Recharges.** A spent Recharge 5–6 shows a Recharge chip that rolls the player's d6 through
  dnd5e's own recharge, a character's or a companion's, and the toast says whether it recharged.
  (app and module, item 3)
- **End Turn, with Undo.** On your character's or a companion's turn, End turn in the turn panel, or
  the Combat tab held for a second from any tab, ends the turn by Foundry's own Next Turn. Undo in
  its toast takes it back for 8 seconds, with no start- or end-of-turn work run again. (app and
  module, item 4)

### Fixes

- **Pictures that won't load.** A portrait, condition or item icon, or chat or companion avatar from
  Foundry that has no address or won't load now shows initials or an icon, on a page drawn on the
  server too, where a broken image showed. (app, item 5)

### Maintenance

- **End-to-end and harness checks.** New `companions`, `alone` and `endturn` suites, each also run
  against module 0.35.0, and new `companions`, `alone` and `turns` harness runs on a new token
  stand-in, `test/fvtt/token-core.mjs`. (app and module)
- **Docs and ROADMAP for v0.36.** The module's `PROTOCOL.md` gains companions, `of`, `itemDamage`,
  `recharge`, `endTurn` and `undoEndTurn` and a "Module 0.36.0" entry, and its `README.md` the same.
  ROADMAP.md marks v0.35 released, lists v0.36's five items as built and adds six known limits. (app
  and module)
- **A migration.** `20261025090000_companions` adds companions' sheets, the campaign's companions,
  the kinds of roll they may make and how they enter initiative, and the companion a roll is for.
  (app)

## v0.35.0 — 2026-10-22

### Features

- **Reordering notes.** Anyone in a party reorders a chapter's notes, or those in no chapter, by
  dragging, the arrow buttons or the keys, then Save order; Foundry keeps the order, a reorder made
  there shows in the app, and new and moved notes go last instead of by when they were written. With
  Foundry closed an order waits in the app, and asks only if the same notes were reordered in
  Foundry meanwhile. (app and module, item 3)

### Enhancements

- **The journal redesigned.** A Journal card on the character's Biography tab and the party's
  Description tab opens the journal in its own window, full screen on a phone and up to 960 × 880
  elsewhere, with the contents on the left and one note or a chapter's notes on the right. The sheet
  no longer grows with the notes, and the editor stays clear of the on-screen keyboard. (app,
  item 1)
- **Move to chapter.** A note goes into a chapter, or out of one, from a Move menu wherever Edit is
  offered, and goes last in its new chapter. (app, item 2)
- **The journal's last change.** "Last changed by …" on the Journal card and in the journal's header
  now counts notes deleted and reordered too, whether in the app or in Foundry. (app and module,
  item 4)

### Maintenance

- **End-to-end and harness checks.** A new `notesorder` suite checks reordering, run against module
  0.34.0 too, the `notes`, `partynotes` and `notesoffline` suites are rewritten for the journal's
  window, and the module's `notes` harness run grows from 36 to 56 checks. (app and module)
- **Docs and ROADMAP for v0.35.** The module's `PROTOCOL.md` gains the `order` op, `journal.changed`
  and a "Module 0.35.0" entry, and its `README.md` describes ordering. ROADMAP.md marks v0.34
  released, lists v0.35's four items, moves each later version up by one and adds a known limit for
  changes made in Foundry with no Gamemaster connected. (app and module)
- **A migration.** `20261024090000_journal_order` adds orders waiting for Foundry, each note's
  place, the journal's last change and what else the campaign's module does with notes. (app)

## v0.34.0 — 2026-10-22

### Features

- **Personal journal notes.** A player writes their character's own notes in the first section of
  its Biography tab, in Markdown with Write and Preview, in chapters, seen only by them and the
  Gamemaster, and shown under why there's no sheet while it hasn't arrived. In Foundry they're the
  character's journal for the campaign, a page per chapter and per note, in a "Sending Stone notes"
  folder. A journal, a party's too, holds up to 50 chapters and 300 notes, each titled in up to 200
  characters. (app and module, item 1)
- **Party journal notes.** A party's members write notes in the first section of the party sheet's
  Description tab, each changing and deleting only their own, and any member or the Gamemaster can
  rename a chapter. In Foundry they're the party's journal, which members read whole and where each
  owns only their own pages. (app and module, item 2)
- **Notes while Foundry is closed.** Every change to a note is kept in the app first and reaches
  Foundry once it's running, and edits made in Foundry come back to the app, though a Gamemaster's
  secrets and pages shown to only some players stay in Foundry: a page with a secret comes back
  without it, read only. A note changed in both places keeps Foundry's version and asks the player
  whether to use theirs. (app and module, item 3)

### Maintenance

- **Tests in the repositories.** The module's harness moves into its `test/`, run by `npm test`, and
  the end-to-end suites into the app's `e2e/`, each first reproducing 0.33.0's results. New `notes`,
  `partynotes` and `notesoffline` suites and a `notes` harness run cover the journal. (app and
  module, item 4)
- **A roadmap.** ROADMAP.md is added to the app, with v0.34 in progress and the versions planned
  after it. (app)
- **Docs for v0.34.0.** The module's `PROTOCOL.md` gains `features.notes`, `journal.updated`, the
  `note` command and a "Module 0.34.0" entry, and its `README.md` describes journal notes. The app's
  README.md points to `e2e/README.md`. (app and module)
- **A migration.** `20261023090000_journal_notes` adds the journals, their notes and the changes
  waiting for Foundry, and whether the campaign's module keeps notes. (app)

## v0.33.0 — 2026-10-21

### Features

- **Removing an item.** Remove… in an inventory item's menu removes it, part of a stack or a
  container with everything in it, from the player's own character, or from a character's page for
  the Gamemaster, with no campaign switch. The game posts a line such as "Removes 2 Potion of
  Healing", and refuses it, removing nothing, if the stack changed since the dialog opened. (app and
  module)

### Fixes

- **Critical hits double only their dice.** A critical hit's damage from the app now doubles only
  its dice, never a number in it, whatever dnd5e's Critical Damage Modifiers, Midi-QOL or the roll's
  own options say: 1d6 + 4 is 2d6 + 4, where 0.32.0 made it 2d6 + 8 with Critical Damage Modifiers
  on. Under dnd5e 6 a group in parentheses or a function of dice adds only its dice, so (1d6 + 2) +
  4 is (1d6 + 2) + (1d6) + 4. (module)

### Enhancements

- **No Next die on the last die.** The dice keypad hides Next die while the box being typed in is
  the last one, a single die's too, and brings it back on an earlier box. The keypad keeps its
  height on short screens. (app)
- **One spinner on a party's rows.** While a party's coins or an item are on their way, the party
  sheet shows one spinner beside Currency or the item's name and disables its buttons, where each
  button had a spinner of its own. (app)

### Maintenance

- **Docs for v0.33.0.** The module's `PROTOCOL.md` gains `features.removals`, the `remove` command,
  a "Removing an item" section, the corrected critical paragraphs and a "Module 0.33.0" entry, and
  its `README.md` says the same. (module)
- **Tests.** Jest tests cover Remove, the keypad and the spinners. The end-to-end suites, still
  outside the repository, gained `removals` and critical checks in `attacks` and `links`, and the
  module's harness a `removals` run and more `crit-rules` cases. (app and module)
- **A migration.** `20261022090000_campaign_removals` keeps whether the campaign's module removes
  items for the app. (app)

## v0.32.0 — 2026-10-20

Party sheets from the Inventory tab, below, were app PR #44, which went in as its own commit within
PR #45, so GitHub shows #44 merged with it.

### Features

- **Typing in your own dice.** With Manual Dice on, a campaign that allows it and Make Manual Rolls
  for the character's player in Foundry, Enter dice results manually in the cog now works: a roll
  asks for each die in a dialog with its own keypad, checked against the die's faces, with no 3D
  dice, and three d20s for an attack with advantage by a character with Elven Accuracy. Maximized
  damage and damage the game can't plan aren't typed, and dice Foundry adds itself, such as Bless's
  d4 and rerolls, stay with Foundry. The game makes the roll with those values and marks its card
  "Entered by hand on Sending Stone", and the campaign's Players tab in the module's settings shows
  whose player may. (app and module)
- **A party's things sent anywhere.** A party's Owner can send its items and coins to any of the
  campaign's characters, or to another party they own, and the Gamemaster can move things party to
  party too. The chat line reads, for example, "Sends 20 gp from The Iron Company to Vex". (app and
  module)
- **Distribute a party's coin.** Distribute on the party's Currency row shares one kind of coin
  equally among the party's player characters and leaves what can't be shared with the party. One
  chat line says both, such as "Distributes 100 gp among Bram, Lia, Thorin, and Vex (25 gp each); 3
  gp stays with The Iron Company". (app and module)

### Fixes

- **Critical damage as dnd5e makes it.** A critical hit's damage from the app is now built by
  dnd5e's own rules, under Midi-QOL too, so 1d6 + 4 is 2d6 + 4 where Midi's option for the
  Gamemaster's rolls made it 1d6mx2 + 4; Midi's critical options now apply only to the Gamemaster's
  own rolls in Foundry. Where the app can't read the game's damage formula, the dice tray and toasts
  show the game's total. (app and module)
- **More dice and Maximum back under dnd5e 6.** Under dnd5e 6, players again have More dice, Another
  die and Maximum for their damage, as the module's dice self-test now passes there. A die more no
  longer doubles a critical hit's dice a second time. (module)

### Enhancements

- **Party sheets from the Inventory tab.** A character's party sheets now open from a Party list
  (Parties, with several) on its Inventory tab, the primary party first, in place of the button in
  the page's header. The list also shows while the character's sheet hasn't arrived. (app)
- **Send to from an item's menu.** Send to… is in an inventory item's own menu, by right-click,
  long-press or Shift+F10, on the character's and the party's sheets, leaving out the sheet's own
  end. The character's Currency row has Send to, the party's has Take, Send to, Give and Distribute,
  and coins sit closer to their amounts. (app)

### Maintenance

- **Docs for v0.32.0.** The module's `PROTOCOL.md` gains a "Module 0.32.0" entry, with each
  character's `manualDice`, `typed`, `elvenAccuracy`, the critical rule, party sends and `among`,
  and its `README.md` says how players type in their dice, how a party sends things and shares its
  coin, and how criticals are made. (module)
- **Tests.** Jest tests cover the dice dialog and keypad, typed rolls, Send to, Distribute and the
  party list. The end-to-end suites and the module's harness, kept outside the repositories until
  v0.34, gained `typed`, `givetake`, `crit-rules` and `sends` runs. (app and module)
- **Two migrations.** `20261021120000_character_manual_dice` keeps whether each character's player
  types in their dice, and `20261021120100_campaign_transfer_features` what else the campaign's
  module does with moves. (app)

## v0.31.0 — 2026-10-20

### Features

- **Moving items and coins.** With a campaign's new Players move items and coins on, a player takes
  items and coins from a party they have Owner on with Take on its sheet, and gives their own to a
  party or another campaign character with Give… on their Inventory, choosing how many and moving
  containers whole. Moved items, contents included, arrive unequipped and unattuned, and a
  consumable joins a like stack only when it's identified, unspent and unenchanted. Each move posts
  a line in Foundry's chat, such as "Gives 2 Potion of Healing to The Iron Company", and the
  Gamemaster can move for any character from their pages. (app and module)
- **Hit/miss and save results in the app.** A new world setting in Sending Stone's settings,
  "Hit/miss and save results in the app", can Always show them to players, whatever dnd5e and
  Midi-QOL show, on chat cards and the app's own rolls alike, but never with a DC or armor class.
  Its default follows Foundry's visibility settings, and the campaign's Foundry settings in the app
  show which is chosen. (app and module)

### Enhancements

- **Midi-QOL's cards judged at every target.** Where Midi-QOL checks no hits, each target on its
  card is judged against the armor class Midi writes on it, at several targets as at one, under
  Always or with Gamemaster-only information. (module)

### Maintenance

- **Docs for moves and the results setting.** The module's `PROTOCOL.md` gains the `transfer`
  command, its refusals and result, `features.transfers`, the move rules and a "Module 0.31.0"
  entry, and its README "Items and coins" and the results setting. (module)
- **A migration and tests.** The campaign's move switch is stored in the app (`transfersEnabled`,
  one migration), and Jest tests cover Take, Give, their dialogs, the server's checks on a move and
  the results setting. (app)

## v0.30.0 — 2026-10-19

### Features

- **Party sheets.** On a campaign's new Party tab in Sending Stone's settings, the Gamemaster adds
  the world's dnd5e Group actors, and a player whose Foundry user has Observer or Owner on a group
  opens its sheet from the Party button at the top of their character's page: its members' names and
  portraits, its inventory and coin and its description, read-only, in a side panel or as a page.
  The tab says who sees each group and warns when no one does, and the Gamemaster's campaign card
  lists the party sheets. (app and module)
- **Full screen.** A Full screen button at the top of a character's page, the Gamemaster's page and
  a party's page fills the screen, and stays on from a character to their party. On iPhone, which
  doesn't allow it, the button explains Add to Home Screen, and the Home Screen app opens without
  Safari's bars. (app)
- **The campaign's Foundry settings in the app.** The Gamemaster's campaign card gains a Foundry
  settings section: the versions of Foundry, dnd5e, Sending Stone, Midi-QOL and libWrapper, the
  campaign's switches, dnd5e's and Midi-QOL's visibility settings, and what players see in chat.
  Sending Stone's settings in Foundry show the same "what players see" line under each campaign's
  title. (app and module)

### Fixes

- **Hits and saves as Foundry draws them.** Midi-QOL's hits and saves are told only as its own card
  shows them to players, a target under total cover reads as dnd5e's card draws it, and under dnd5e
  6 a message's results reach the app at all. One malformed target no longer drops every result on
  its card. (app and module)
- **The Gamemaster's Midi-QOL rolls kept as hidden as Midi keeps them.** With Gamemaster-only
  information off, the Gamemaster's attack and damage rolls on Midi-QOL's cards reach the app only
  as far as Midi's GM Attack Roll Display and GM Damage Roll Display show them, and no target's
  armor class or button's DC goes with a dnd5e 6 message. (module)

### Enhancements

- **Saved and Failed from any card.** Saves and checks now show their result whatever asked for
  them, a roll request, a description's link, a concentration card or Midi-QOL's card, where only a
  save activity's card counted. Each is told as dnd5e's Challenge Visibility allows. (app and
  module)

### Maintenance

- **Docs for party sheets and the settings report.** The module's `PROTOCOL.md` gains the hello's
  `groups` and `settings`, `group.updated`, `group.removed` and `bridge.settings`, `dnd5e.check`,
  the results rules and a "Module 0.30.0" entry, and its README a Party sheets section and the
  results rules. The visibility rules live in one place, `scripts/results.mjs`, which the chat and
  the verdict share. (module)
- **Two migrations and tests.** The app stores a campaign's party sheets (`GroupSheet`,
  `Campaign.groups`) and its Foundry settings (`Campaign.foundry`) in two migrations, and Jest tests
  cover the party sheet, full screen, the settings section and the results. (app)

## v0.29.0 — 2026-10-17

### Features

- **End a concentration from the app.** The Concentrating chip at the top of the sheet, or the
  concentration's row on Effects, ends it after a confirm, with a menu where there are two, and what
  it keeps up on allies ends too. Its waiting concentration check closes, and the Gamemaster's page
  doesn't offer it. (app and module)
- **Spend charges and Heroic Inspiration.** A counter's count, such as Sorcery Points, is a button
  to spend some, posting "Spends 2 · Sorcery Points" in Foundry's chat, and Inspired is a button to
  use or gain Heroic Inspiration, with a line of its own, while a Use whose own counter is out greys
  out. Both need Attacks, spells and features, and work from the Gamemaster's page, marked as
  theirs. (app and module)
- **Hits, misses and saves on chat cards.** Each target on a chat card shows Hit, Miss, Saved or
  Failed, with a line such as "Hit 1 of 2 · 1 of 2 saved", from dnd5e's attacks and saves and
  Midi-QOL's hits and saves, where Hit or Miss showed only beside a target's armor class. They show
  only where Foundry shows players the result, and the module's Chat messages hint names the
  settings that decide it. (app and module)
- **Search in the target list.** A search box shows once the target list has more than 5 entries,
  matching word by word whatever the case or accents and keeping ticked targets in view. The Spells
  tab's search now matches the same way. (app)

### Fixes

- **No hidden DCs in chat cards.** A chat card sent to the app no longer carries a save's DC, nor
  Midi-QOL's Gamemaster-drawn hit and save sections, where Foundry doesn't show them to players.
  (module)
- **The Inspired mark easier to read.** The Inspired mark uses a deeper gold in the light theme,
  where the old one fell below WCAG AA as small text. (app)

### Enhancements

- **Allies in the target list.** The target list sorts into Allies and Others, with Ally, You and
  Neutral pills: attacks list Others first, and healing and helping uses list you and your allies
  first. NPCs the Gamemaster marked Friendly count as allies, from module 0.29.0, and the combat
  tracker colours them so. (app and module)
- **The Sending Stone logo.** The browser tab's icon, the app bar's mark and the home page's icon
  are now the Sending Stone stone, and the Effects tab gets a new icon. (app)

### Maintenance

- **Docs for concentration, charges and results.** The module's `PROTOCOL.md` gains
  `endConcentration`, `spend` and `inspiration` with their refusals, the sheet's `concentration`,
  counters and `spends`, a combatant's `disposition`, chat outcomes and the cleaned content, and a
  "Module 0.29.0" entry. Its README names dnd5e's and Midi-QOL's visibility settings. (module)
- **A shared search field and tests.** The target list and the Spells tab share one search field and
  its matching (`src/components/search-field`, `src/utils/search.ts`), new colour tokens are checked
  at AA in `globals.test.ts`, and Jest tests cover the rest, with `logo.test.tsx` checking every
  logo image exists. (app)

## v0.28.0 — 2026-10-15

### Fixes

- **dnd5e 5's usage cards named by their item.** A usage card with rolls under dnd5e 5 is labelled
  by its item and gets its Spell chip back. (app)
- **A critical's gold border on your own messages.** A critical card's gold border showed only on
  other people's messages. It's now gold on the player's own messages and on whispers too, which
  stay dashed. (app)
- **Chat chips easier to read.** The Attack, Damage, Spell and Healing chips and the Hit and Miss
  pills, which fell below WCAG AA on some chat bubbles in the light theme, use deeper colours. (app)

### Enhancements

- **One damage card per chat message.** A message's damage shows on one card, as Foundry draws it:
  the item's name, the formula, one chip per kind such as "5 Piercing" and "7 Poison", and the
  total, with each roll's dice a tap away and a bonus such as Sneak Attack named. Midi-QOL's other
  damage gets a card of its own, the attack on Midi's card gets the Attack chip with Hit or Miss,
  and dnd5e's "Half damage on a save" shows. (app and module)

### Maintenance

- **Docs for each roll's part.** The module's `PROTOCOL.md` gains the roll summary's `damage`,
  `damageLabel`, `section`, `flavor` and `attack`, a bonus-roll example, Midi's `useOther` limit and
  a "Module 0.28.0" entry, and the README's `chat-data.mjs` row says it. (module)
- **One way to add damage, and tests.** The table's damage total now adds damage as the chat card
  does, each kind at least 0, with its output pinned by a test, and Jest tests cover the card's
  folding and the chips' contrast. (app)

## v0.27.0 — 2026-10-15

### Features

- **Midi-QOL's own saves asked in the app.** While a character's page is open and its campaign's
  Save and concentration prompts are on, a save, check or skill Midi-QOL asks of it in a workflow
  the Gamemaster runs, its concentration check or an OverTime turn save such as Frightened's is
  asked in the app with Midi's advantage, and rolled with the player's dice. Its banner counts down,
  "Midi rolls for you in 0:42", or "Answer here or in Foundry · 0:42" where Foundry asks too and
  the first answer wins, and the Gamemaster can answer from their page. Where Sending Stone can't
  find the parts of Midi it hooks, Midi's saves go on as before, and Sending Stone's Modules section
  in Foundry says so. (app and module)

### Fixes

- **Green text easier to read.** Green text that fell below WCAG AA contrast, such as the cog's
  chosen option, the selected tab, chips, healing buttons and the GM pills, now uses a deeper green.
  (app)

### Maintenance

- **Docs for Midi-QOL's saves.** The module's `PROTOCOL.md` gains "Midi-QOL's own saves", a "Module
  0.27.0" entry and the prompt rows, and its README says which saves are asked and what Midi does
  meanwhile. (module)
- **Jest tests and the open page.** The app records when a player's page last read the table
  (`Character.tableSeenAt`, one migration) to tell the module which characters are open, and
  `globals.test.ts` measures green text's contrast from the CSS. A dice test now expects damage
  floored at 0, as the roller does. (app)

## v0.26.0 — 2026-10-14

### Fixes

- **The app's help names the module's settings window.** The Gamemaster's help in the app pointed at
  Manage Campaigns and its old option names, which module 0.24.0 replaced. Connect Foundry, the
  campaign card and the new-campaign form now name Open Settings and the campaign's Connection,
  Players and Player actions tabs, and Connect Foundry asks for module 0.24.0 or later. (app)
- **The GM pill easier to read.** The GM pill on the Gamemaster's rolls uses a deeper green in the
  light theme, where it fell below WCAG AA. (app)

### Enhancements

- **Critical damage in gold.** A critical hit's damage takes the natural 20's gold in its toast, the
  banner and the Your rolls list, where it was red, and the Gamemaster's critical damage on the
  player's page also reads "Critical hit". (app)
- **The Gamemaster's area attack names who it hit.** On the player's page it reads "Hit 2 of 3:
  Bandit 1, Bandit 3", from the player's own view of the fight, and a target hit that the player
  can't see is counted as "and 1 more", never named. (app)
- **Entering dice results manually, coming soon.** A campaign's Player actions tab in Sending
  Stone's settings replaces its "Who rolls the dice" choice, whose Players enter results was marked
  Coming soon, with "Allow Players to enter dice results manually", which can be on only while
  Manual Dice is installed, active and on, and Players roll in the app is on. While it is, each
  character on the Players tab and the app's cog show a switch for it, off and marked "Coming soon":
  nothing is typed in yet, and nothing rolls differently. (app and module)

### Maintenance

- **Docs and tests for the dice switch.** The module's `PROTOCOL.md` gains a "Module 0.26.0" entry
  and `manualDice` in the hello, its README the new switch, and its settings window drops the old
  choice's strings and styles. Jest tests cover the cog's switch, the help's new words, critical
  damage in gold and the area attack's names. (app and module)

## v0.25.0 — 2026-10-14

### Features

- **The Gamemaster's rolls on the player's page.** When the campaign's Gamemaster rolls as a
  player's character, the player sees it among their own rolls, in their toasts or banner, marked
  "Rolled by your Gamemaster", with the game's result and nothing to tap. It shows even with the
  module's chat events off. (app)
- **A Your rolls button.** In Toasts mode, a Your rolls button beside the cog opens what the banner
  held: the latest roll in full, every roll whose damage is still due, and earlier rolls. A dot on
  it says a hit's damage is still due, so a toast closed with × isn't lost. (app)

### Fixes

- **The GM pill only on the Gamemaster's own messages.** With module 0.25.0, each roll the
  Gamemaster makes in the app tells it which chat messages it made, and the app puts the GM pill on
  those alone. A message a player posts with a Gamemaster's roll's marks copied onto it no longer
  gets the pill. (app and module)

### Enhancements

- **Toasts or the banner, not both.** "Roll results: Toasts | Banner" in the cog replaces the Roll
  toasts switch, and only the one chosen shows, where toasts used to show beside the banner. Toasts
  are the default, and anyone who had turned toasts off keeps the banner. (app)
- **A hit's toast waits for its damage.** After an attack that hits, or a use whose kind of damage
  must be chosen, its toast holds the Roll damage buttons, the damage menu and an area attack's
  hits, and stays until the damage is rolled or it's closed with ×. Every other toast, a miss's
  included, goes after 4 seconds. (app)
- **Bolder toasts, clear of the tabs.** Toasts are a wider card with the tray's large total and an
  edge by outcome: gold for a critical, ruby for a miss or failure, red for damage, green otherwise.
  They start below the character's tab row, or under the game's prompts while it asks for a save, so
  the tabs, the cog and the save buttons stay within reach. (app)
- **Last refused clears once posts get through.** On a campaign's Connection tab in Sending Stone's
  settings, the last post the app refused now clears once a post of the same kind gets through, for
  a sheet that character's, rather than staying until the next refusal. (module)

### Maintenance

- **Docs for a Gamemaster's roll's messages.** The module's `PROTOCOL.md` gains a "Module 0.25.0"
  entry, a roll result's `messages` and the hello's `gmRollMessages`, and its `README.md` says which
  messages the app marks as the Gamemaster's and when a refusal clears. (module)
- **Jest tests, and fewer secrets tried on a stray post.** Jest tests cover the toasts, the Your
  rolls button and the Gamemaster's rolls at the player's page, whose labels are kept in a new
  column (one migration). A post whose title matches no campaign is checked against the secrets of
  at most the 5 newest waiting campaigns, and none when it sends no secret. (app)
- **The module's harness ported to the settings window.** Three runs of the module's harness, then
  kept outside the repository, no longer loaded after 0.24.0's settings window, and a new stand-in
  now draws the real `templates/settings/*.hbs`, so Test, the status lines, secrets, the roll switch
  and closing are checked against it. (module)

## v0.24.0 — 2026-10-13

### Features

- **Which modules are on.** A Modules section in the module's settings lists the author's own
  modules, Manual Dice, Combat Focus and any other installed module sharing an author, with whether
  each is on and what it unlocks, beside Midi-QOL, libWrapper and the D&D 5e requirement. A
  campaign's Player actions tab shows who rolls the dice: the app for now, with players entering
  their own results greyed out until the app takes them. (module)

### Enhancements

- **One settings window.** Manage Campaigns becomes one Sending Stone window, opened with Open
  Settings, its sections down the side: General, which takes the app's address and what's sent out
  of Foundry's own settings list, Modules, each campaign and the Roster. Only the open section is
  drawn, and edits are kept as you move between them until Save Changes. (module)
- **Campaigns one at a time.** A campaign has Players, Player actions and Connection tabs, Players
  listing only its own characters, by player, with the other campaigns each is in, and Add
  characters the rest, with search and Select all; a new campaign can copy another's. The Roster
  ticks every character against every campaign in one table. (module)
- **Shorter labels.** Every label and hint in the module's settings is rewritten to a line or two,
  such as Chat messages for Send Chat Events, and the window suits Foundry's light and dark themes.
  (module)

### Maintenance

- **Docs use the new names.** The module's `PROTOCOL.md` and `README.md` name the settings as the
  window does, such as Players roll in the app on a campaign's Player actions tab; `PROTOCOL.md` has
  no "Module 0.24.0" entry, as nothing sent changed. (module)

## v0.23.0 — 2026-10-13

### Features

- **The Gamemaster rolls as a character.** A campaign's Gamemaster opens any of its characters from
  the campaign card, claimed or not, sees what its player sees and rolls as them, prompt answers
  included; each such roll is marked "GM" on Foundry's card and with a GM pill in the app's chat.
  With a module before 0.23.0 their rolls stay in the app, and the page says to update it. (app and
  module)
- **Roll toasts.** Each roll's result pops up at the top centre for 4 seconds, changing as the game
  answers, and a tap clears it; Roll toasts in the cog turns them off on that device. (app)

### Fixes

- **Resource favorites stand for their features.** An old-style resource favorite, such as Second
  Wind or Bardic Inspiration, now shows as its feature's row, with its description, Use and rolls
  and the resource's count, where it showed only a name and a count. Module 0.23.0 names the
  feature; with an older module the app matches it by name. (app and module)
- **Delivery notices told once.** The Gamemaster's notices that the app isn't taking events come
  once per cause, and no longer alternate between failing and recovered while one campaign is
  refused beside one that isn't. (module)

### Enhancements

- **Refusals explained.** When the app refuses the module's posts, the Gamemaster is told what went
  wrong and what to do, Manage Campaigns shows a status line for each campaign, and Test says the
  problem and its fix. The app's campaign card shows the latest refusal it can tie to the campaign
  for a day. (app and module)

### Maintenance

- **Tests, data and docs.** Jest grows from 2,706 to 3,206 tests, and two database migrations add a
  campaign's last refusal and who made each roll. The module's `PROTOCOL.md` gains a "Module 0.23.0"
  entry and the refusal reasons, and its README covers each change; the errors harness run and the
  `favres`, `toasts`, `gmroll` and `gmerr` end-to-end suites the PRs report ran outside the
  repositories. (app and module)

## v0.22.0 — 2026-10-13

### Features

- **Self as a target.** An activity with range Self, such as a potion or Wild Shape, offers Self in
  the target list, the default for healing and utilities. An area that hits creatures, such as
  Fireball, lists Self last, and no attack offers it. The game's card targets the character's token,
  or the character where there's none. (app and module)

### Fixes

- **Damage with Foundry's dice modifiers.** Damage and formulas with Foundry's dice modifiers, such
  as Great Weapon Fighting's 2d6r<=2, 4d6kh3 or an exploding die, are buttons now, not plain text,
  on rows, favorites and description links: your dice are the first throw, the game throws any
  reroll or explosion, and the tray shows its total. A roll kept on the phone throws its rerolls
  there, the dice rerolled or dropped struck through, and Maximum isn't offered where a die explodes
  or its highest face is rerolled. As the game loads, the module checks that Foundry rolls such dice
  as it expects, and offers no attacks from the app where it doesn't. (app and module)

### Enhancements

- **Each sheet in a post of its own.** The module's opening post now carries the roster alone, and
  each character's sheet follows in a post of its own, slimmer where the app expands it, so a
  party's sheets no longer add up against the 4 MB the app takes since v0.21.0: the party of nine's
  1.1 MB post becomes a 12.5 KB roster and nine sheets of at most 197 KB. A sheet still too large
  is held back, the Gamemaster told once, and the character's page gives its size and the limit. A
  sheet dropped from a full queue or refused for a while is sent again at the next check, and the
  app keeps a character's sheet when an opening post carries none. (app and module)
- **A settings cog on the character's page.** A cog at the end of a character's tab row opens the
  sheet's settings from any tab: Send to the table, moved from the roll tray, the theme, and the
  Actions tab's layout where the screen fits more than one. (app)
- **No app bar on a character's page.** A character's page no longer shows the app bar, so the game
  takes the whole screen, and its own header leads back to the characters. (app)
- **The Character tab first.** A phone or tablet opens a character on the Character tab, even in a
  fight, and shows it again when the screen narrows from side by side to one pane. (app)

### Maintenance

- **Tests and docs.** Jest grows from 2,401 to 2,706 tests, with a 480 KB fixture of synthetic slim
  sheets. The module's `PROTOCOL.md` gains "Post size and slim sheets" and a "Module 0.22.0" entry
  and its README covers each change; the sync harness run and the phone, rolling and sync end-to-end
  suites the PRs report ran outside the repositories. (app and module)

## v0.21.0 — 2026-10-12

### Features

- **Check activities.** Under dnd5e 5, a check activity, such as Fast Hands, Thieves' Tools or
  Manacles' Bind, has a chip with its check and DC: Ask the table uses it as the game's card does,
  spending what it spends, and Roll my check, where the check is the character's own, rolls it with
  your dice against its DC, spending nothing. (app and module)
- **Enchant activities.** Magic Weapon, Shillelagh, a Flame Tongue's Engulf in Flames and the like
  are used from the app with the profile and item you pick, applied as dnd5e's tray applies them and
  tied to their concentration, one that turns on and off at no cost shown as a switch. Enchanted
  items carry a badge listing their enchantments, with End, after a confirmation, where their player
  may end one. (app and module)
- **Free castings and follow-up checks.** A spell's free casting, such as Fey Touched's Misty Step,
  is used from the app through the spell, spending its own use rather than a slot, and repeats of it
  are listed once. A spell's follow-up check, such as the 2014 Entangle's Escape Plants, is listed
  after how the spell is cast and used without a slot. (app and module)

### Fixes

- **Damage that takes a die away.** Damage that takes a die away, such as Reduce's −1d4, is no
  longer offered or rolled at its highest, and more dice and another die change the first die it
  adds, never the one taken away. (app and module)
- **Description damage the game can't plan.** A description's damage the world can't plan for your
  dice, such as a d3, now reads as text instead of a link the game refuses. (module)
- **A large party reaches the app.** The app now takes a campaign's opening post from the module of
  up to 4 MB, where a party of nine with large spellbooks sent 1.1 MB, was refused, and none of its
  characters reached the app. (app)
- **Menus stay on a phone's screen.** A right-click menu, or the hit dice popover, opened with a
  mouse on a narrow screen now moves back onto the screen, where it ran off the right edge, out to
  423 px on a 390 px screen. (app)
- **The header fits every phone.** On a phone the app bar's gaps close up and its name shrinks below
  390 px and hides below 360 px, so the account avatar is no longer squeezed and the page no longer
  scrolls sideways. (app)

### Enhancements

- **Damage choices fitted before a use.** More dice chosen before a use are capped to what the
  game's damage can take, such as Cure Wounds at 3rd level sending 34 of 38, and a choice the damage
  can't take is dropped before the throw rather than refused after it. (app)

### Maintenance

- **Tests and docs.** Jest grows from 2,109 to 2,401 tests. The module's `PROTOCOL.md` gains
  "Enchantments" and a "Module 0.21.0" entry and its README covers each change; the new activities
  and enchant harness runs and the activities end-to-end suite the PRs report ran outside the
  repositories. (app and module)

## v0.20.0 — 2026-10-11

### Features

- **An item's spell cast higher.** A Cast that lets a spell go higher for more charges, such as a
  Wand of Magic Missiles or of Fireballs, offers level chips with their charges, and the game casts
  it at the level picked, its targets and damage scaled as dnd5e scales them. Levels the item can't
  pay for now are disabled, and those it never could are hidden. (app and module)

### Fixes

- **Damage that can't take your dice refused.** An attack's, a use's or a description's damage that,
  once dnd5e has built it, can't take every die the player threw is now refused with nothing posted,
  where it was quietly made wrong. (module)
- **Descriptions follow their damage.** A description with damage links is sent to the app again
  when the damage it shows changes, as with Rage or a class's scale, so the app shows it as it
  stands. (module)

### Enhancements

- **Critical hits that add dice.** Savage Attacks' and Brutal Critical's extra dice, and critical
  damage with dice of its own such as a greataxe's +1d6, are now planned and thrown with your dice
  on an attack's, a use's and a description's damage, as your world's rules treat them; more dice
  and another die change the weapon's own first die, never the critical's. Where those rules can't
  be told, as under dnd5e 6's Powerful Critical, no such critical is offered. (app and module)
- **Several hit dice, of several sizes, at once.** One popover for every size picks how many of
  each, up to 20, and with module 0.20.0 they go to the game as one request, spent a die at a time
  with a card each, so leaving the page no longer leaves some unspent. They stop at full hit points,
  and the tray says how many were made. (app and module)
- **A cast spell's later activities beside its Cast.** Once a spell is cast from an item, its other
  activities, such as Hex's Bonus Hex Damage, listed before only on the Spells tab beneath the
  spell, now also sit beneath the item's Cast row on Actions, Inventory, Features and Favorites, and
  are used from there, spending what dnd5e spends. (app and module)

### Maintenance

- **Tests and docs.** Jest grows from 1,892 to 2,109 tests. The module's `PROTOCOL.md` gains three
  "Module 0.20.0" entries and its README covers each change; the harness and the attacks, links,
  uses and rolls end-to-end runs the PRs report were outside the repositories. (app and module)

## v0.19.0 — 2026-10-10

### Features

- **A description's damage as a critical hit's, or changed.** A right-click, long-press or the
  keyboard on a description's damage opens the menu an attack's damage has: Roll critical damage, as
  your world rolls one, Midi-QOL's rules too, Roll maximum damage, and Modify damage… with more
  dice, another die and a Critical hit switch; a tap still rolls it plainly. No critical is offered
  for healing, where dnd5e's own link refuses one, as for a save's damage, or where it would add
  dice the app can't yet plan, such as Savage Attacks'. (app and module)

### Maintenance

- **Tests and docs.** Jest grows from 1,822 to 1,892 tests. The module's `PROTOCOL.md` describes the
  sheet's critical rule, damage never rolled as a critical hit's and a "Module 0.19.0" entry, and
  its README the damage menu; the harness and links end-to-end runs the PRs report were outside the
  repositories. (app and module)

## v0.18.0 — 2026-10-10

### Features

- **Checks in descriptions.** A check a description names, from dnd5e's check, skill and tool links
  or plain English such as "a DC 15 Strength (Athletics) check", opens the same menu as a save: Ask
  the table posts dnd5e's request card with a button for each check, and Roll my check rolls one the
  character can make against its DC, the tray saying Passed or Failed. A skill check made using a
  tool rolls with advantage where the character is proficient in both, as dnd5e's 2024 rules have
  it; passive checks stay text. (app and module)

### Enhancements

- **Check requests in chat.** The app's chat shows a check's roll request card, the Gamemaster's as
  well as a player's, as an ask with a Check chip, as it already showed a save's. (app and module)
- **Hit dice beside hit points.** Hit points and hit dice share a row at every width, each size with
  its die's icon, its count and a Use button; a right-click or long-press picks how many, showing
  the heal with Constitution added, and several are thrown together and sent to the game one after
  another. The Classes card shows its hit dice without a button, while a class favorite keeps Use.
  (app)
- **Large coin amounts shortened.** Coin amounts of 1,000 or more read short, rounded down so they
  never overstate, such as 12.8k gp, and a tap shows the exact amount. (app)
- **The class beside the name.** On wide screens the class and subclass, such as "Bard 6 · College
  of Eloquence", sit beside the character's name in the page header instead of the tabs row. (app)

### Maintenance

- **Tests and docs.** Jest grows from 1,633 to 1,822 tests. The module's `PROTOCOL.md` gains
  `ss-check`, the sheet's tools and a "Module 0.18.0" entry, and its README covers checks; the links
  end-to-end suite's new checks ran outside the repositories. (app and module)

## v0.17.0 — 2026-10-10

### Features

- **Saves in descriptions.** A saving throw a description names, such as a wand's "DC 15 Dexterity
  saving throw", opens a menu: Ask the table posts dnd5e's roll request card in Foundry from the
  character, prompting no one in the app, and Roll my save rolls it with your dice against the
  description's DC, even one it hides. A character may ask once every 10 seconds, and for the same
  save once every 30; under dnd5e 6, Ask the table shows disabled, saying why. (app and module)
- **Damage, healing and rolls in descriptions.** Damage, healing and a description's own rolls, such
  as "2d6 cold damage" or a [[/r 1d4]] in a biography, roll with your dice at a tap, named for where
  they come from, such as "Starry Wisp (Everburning Torch)". They're made in the game too, on a
  card, under dnd5e 5 only, and damage only where the campaign's players may attack. (app and
  module)
- **Conditions in descriptions.** A condition a description names, such as Prone, shows its rules on
  hover or focus and, on a tap, opens the Conditions panel at it from any tab. The Character tab's
  condition chips open the panel at their condition too. (app and module)
- **Details for an item's activities.** Every activity folded under an item, on the Actions,
  Inventory, Features and Favorites tabs, has an ⓘ that opens its details: for a spell the card the
  Spells tab shows, otherwise its facts and the item's description. It shows a duration and a
  reaction's trigger, and the description's links work inside it. (app and module)

### Fixes

- **No doubled DC in chat.** A save or check card's text in the app's chat keeps only the label
  players see in Foundry, so it no longer reads "DC 15 Dexterity saving throw Dexterity saving
  throw", and never shows a DC the card hides. (module)
- **The hit point maximum dnd5e shows.** The module now sends the hit point maximum dnd5e shows and
  heals up to, with any temporary change to it such as Aid's or a wraith's Life Drain, for the
  character and in combat, so a character with a lowered maximum reads as full at it. (module)

### Enhancements

- **Save requests in chat.** The app's chat shows a save or concentration roll request card, a
  player's Ask the table or the Gamemaster's own, as an ask with a Saving throw or Concentration
  chip, such as "Thorin asks for a DC 15 Dexterity saving throw". The DC shows only where dnd5e's
  Challenge Visibility lets players see it, and from an older module the Gamemaster's card is read
  from its buttons, without the DC. (app and module)
- **Hit dice in a tile of their own.** Hit dice, a small chip under Hit points that read as a count,
  get a tile on the Character tab: a row for each size with how many are left and a Spend button, or
  Roll where the game won't take hit dice, disabled at full hit points. The class card and a class
  favorite show the same button. (app)
- **Links that do nothing read as text.** Roll pills in a description that did nothing in the app,
  such as an attack's or a Gamemaster-only roll, now read as plain text. (app and module)

### Maintenance

- **Descriptions drawn from a fixed list.** The app draws descriptions as page elements from a fixed
  list of tags and attributes instead of raw HTML, keeps a link's data only where every attribute
  checks out, and checks each roll from a description against its stored copy. (app)
- **Tests and docs.** Jest grows from 1,320 to 1,633 tests. The module's `PROTOCOL.md` gains "Links
  in descriptions", "Descriptions that roll" and a "Module 0.17.0" entry, and its README a
  "Descriptions that roll" section; the harness checks and the new links end-to-end suite the PRs
  report ran outside both repositories, which took them in on 2026-10-21. (app and module)

## v0.16.0 — 2026-10-09

### Features

- **Spend hit dice.** Each size of hit die now has a button under the hit points, on its class's
  card on the Features tab, and on a class made a favorite. A tap rolls the die plus Constitution,
  giving back at least 1 hit point (0 under the 2014 rules), and where the game takes hit dice it
  spends the die there too, through dnd5e, with the tray saying how many hit points it gave back.
  (app and module)
- **Roll a feature's formula.** An activity's own formula, such as a light's radius, is now a chip
  that rolls it at any time without using the item. While the game may use that activity, the roll
  is made in the game too, with the player's dice. (app and module)
- **Area attacks at the targets ticked.** An area attack, such as a breath weapon's cone, is now
  made in the game at the combatants the player ticks, up to as many as it takes, with one attack
  roll. The tray says how many it hit, such as "Hit 1 of 2", and lists each target under it, such
  as "Goblin: Hit" and "Ogre: Miss". Only an area that Midi-QOL targets itself is still refused.
  (app and module)
- **Search spells.** With more than four spells, the Spells tab has a search box that finds spells
  by name, ignoring case, and tells a screen reader what it found. (app)

### Fixes

- **Every spell an item casts.** The Spells tab now lists every spell an item casts, where before a
  spell whose Cast activity isn't shown in the spellbook was missing, and favorites follow the same
  rule. A spell the item can't cast right now is muted, says why first, such as "Needs attuning",
  and rolls nothing. (app and module)
- **An unprepared spell's favorite stays on the phone.** An activity made a favorite of a spell that
  isn't prepared is now rolled on the phone only, as on the Spells tab. Before, its attack or use
  went to the game, which wanted the spell prepared first. (app)
- **Targets counted at the level cast.** With only one pool of spell slots, such as a warlock's, the
  picker now counts how many targets a spell may take at the level that pool casts it, as the game
  does. Before, it counted at the spell's own level. (app)

### Maintenance

- **Docs.** The module's `PROTOCOL.md` gains Hit dice and formulas, area attacks, `rules` and its
  0.16.0 entry, and notes that Midi-QOL still draws its own template for an area around its user
  when its auto-targeting is off. Its README covers hit dice, features' own rolls and areas picked
  rather than placed. (module)
- **Tests.** The app's Jest suite grows to 1,320 tests, and a mutation check of the new server,
  schema and hook code caught all 74 mutations. (app)

## v0.15.0 — 2026-10-09

### Features

- **An item's spells cast from it.** A spell that a weapon, wand or scroll casts is now cast from
  the item, in Foundry too, spending the item's charges and no slot. Its row says Cast, is named for
  both, such as "Staff (Silvery Barbs)", notes the charges it spends, and fades with a note when too
  few are left. The item's separate group of spells is gone, and a row for one of its spells opens
  to the spell's description. (app and module)

### Fixes

- **Spells cast from an item shown as prepared.** A spell cast from an item was sent as not
  prepared, so the Spells tab muted it and rolled it on the phone only. It now shows as dnd5e's
  sheet has it and is cast at the table like any other spell. (module)
- **An activity's own range.** An activity with no range of its own no longer shows its item's
  range. (module)

### Enhancements

- **An item under each kind of action.** The Actions tab now lists an item in a section for each way
  its activities are taken, such as a staff that strikes under Actions and casts Silvery Barbs under
  Reactions. Each row is named for the activity it rolls as when that isn't the item's first and
  shows that activity's own uses, not the first's, and rows no longer repeat the kind of action
  their section's heading already says. (app and module)
- **An item's activities folded away.** An item's other activities now sit inside its row's detail,
  closed until the row is opened, in a list and in a table on every tab. A closed row says how many
  more it holds, such as "6 more". (app)
- **Used-up items with the consumables.** Anything used up rather than kept, such as a scroll or a
  necklace whose beads never come back, is grouped with the consumables. (app and module)

### Maintenance

- **Docs and tests.** The module's `PROTOCOL.md` gains `cast`, casting from an item and its 0.15.0
  entry, and its README casting from an item. The app's Jest suite grows to 1,160 tests. (app and
  module)

## v0.14.0 — 2026-10-08

The first three features below are the app's half of what module v0.13.0 brought, deployed after
that tag.

### Features

- **Saves the game asks, in the app.** When the Gamemaster turns on Prompt Players for Saves &
  Concentration, a banner, Your Gamemaster asks, appears above every tab of the character with each
  save the game asks of it, such as "Dexterity saving throw · DC 13 · Burning Hands". The player
  rolls it with a tap or the roll menu, it's made on the card that asked, and the tray says Saved or
  Failed where the game shows that. On a phone the Character tab is marked while a save waits, a
  device that doesn't send rolls says so and offers a button to send them, and the Gamemaster's
  campaign card says players are asked. (app)
- **Roll and cast from every tab.** A spell, feature or item that rolls now shows its chips on the
  Spells, Features and Inventory tabs and in favorites, as on the Actions tab. It rolls in the app
  or, while the game takes such rolls, is made at the table, with the roll tray on those tabs too. A
  spell that isn't prepared rolls on the phone only, and an item doesn't need to be equipped. (app)
- **Change damage before it's rolled.** A right-click or long-press on damage or healing now offers
  Roll maximum damage, and Modify damage…, a dialog that adds more of the first die, changes that
  die's size (as for a versatile weapon) or sets maximum, showing the formula as it changes. At the
  table the game rolls it that way with the player's dice, and a spell whose damage follows its
  casting offers the same choices on its chip, such as Cast with maximum damage. (app)
- **Each of an item's activities.** An item with more than one activity, such as Hex, Channel
  Divinity or an unarmed strike, shows each of its other activities as a short row beneath it
  wherever the sheet lists it. Each row rolls in the app or is used at the table on its own, such as
  Hex's Bonus Hex Damage or Grapple/Shove, and one the app can't use, such as Flaming Sphere's
  summoning, says it's used in Foundry. An activity that follows a spell without spending a slot,
  such as Spirit Guardians' save each turn, is used at the level picked, whether or not a slot of
  that level is left. (app and module)

### Fixes

- **An item's row casts the item.** An item's own row now rolls and uses its first activity, which
  for a spell is how it's cast. Before, it mixed the item's first attack, save and damage, so Hex's
  row used Bonus Hex Damage and Spirit Guardians' row its save each turn, instead of casting the
  spell. (app and module)
- **The latest roll is the one thrown last.** A roll thrown while an earlier roll's dice were still
  tumbling could land first, and the tray then showed the earlier roll as the latest and hid the new
  one. Rolls now keep the order they were thrown in. (app)
- **A refused target's level named.** When the game refuses a target the Gamemaster isn't viewing,
  the tray now says "your Gamemaster isn't viewing that target's level or scene", where before it
  named only the scene. With Midi-QOL on Foundry V14, a target on another level of the same scene is
  also one the Gamemaster isn't viewing, and from module v0.13.0 the Gamemaster may allow such
  targets. (app)

### Maintenance

- **Docs and moves.** The module's `PROTOCOL.md` gains its 0.14.0 entry and its README a section on
  items with several activities. `describeActivity` moves to `scripts/sheet-rolls.mjs` and
  `limitedUses` to `sheet-values.mjs`. In the app, one list, `sheetActions` in
  `src/utils/sheet-actions.ts`, serves both the pickers and the server's checks, and `UsesLeft` gets
  its own file. (app and module)
- **Tests.** The app's Jest suite grows to 1,152 tests, covering prompts, changed damage, the chips
  on every tab and an item's activities, and the end-to-end suites, kept outside the repository
  then, gained a prompts suite. (app)
- **Two migrations.** `20261011090000_roll_features` keeps what else the campaign's module does with
  rolls, such as asking for saves, and `20261012090000_roll_prompts` the saves the game asks. (app)

## v0.13.0 — 2026-10-08

Module only: the app's side of its saves, changed damage and rolls from any tab came with v0.14.0.

### Features

- **Targets the Gamemaster isn't viewing.** A new world setting, Allow Targets You Aren't Viewing,
  is shown while Midi-QOL is active and is off by default. With it on, a player's attack or spell at
  a token on a level or scene the Gamemaster isn't viewing is made anyway instead of refused. Midi
  works on the targets it can see, and the card names every target so the Gamemaster can apply the
  rest. (module)
- **Saves the game asks, put to the players.** A new campaign option, Prompt Players for Saves &
  Concentration, tells the app about each save Foundry is waiting for a player to click: a
  concentration check after damage, a save a spell targeting the character calls for, or one the
  Gamemaster requests in chat. The player's answer is made on the card that asked, and a failed
  concentration check ends concentration. Where Midi-QOL rolls saves itself it still does, and the
  app asks players from v0.14.0. (module)
- **Changed damage made in the game.** Damage sent from the app can now ask for more of its first
  die, a different size for that die, or every die at its highest, as dnd5e's damage dialog allows.
  Once a self-test has checked it, the game rolls the damage that way with the player's dice, and
  the app offers it from v0.14.0. (module)
- **What spells, features and items roll.** Each spell, feature and inventory item now carries its
  attack, save, damage or healing and the activity it's used through, as an action does. This lets
  the app roll and cast them from any tab, which it does from v0.14.0. (module)

### Fixes

- **A roll made under the campaign as it is now.** If the Gamemaster changed a campaign's settings
  while a roll from the app was being fetched, that roll used to be made under the old settings. It
  is now made under the new ones. (module)

### Maintenance

- **Docs and moves.** `PROTOCOL.md` gains "Saves the game asks for" and the 0.13.0 entry, and the
  README covers changed damage, targets you aren't viewing and saves the game asks for. What an item
  rolls moves from `scripts/sheet-actions.mjs` to a new `scripts/sheet-rolls.mjs`, and prompts live
  in a new `scripts/prompts.mjs`. (module)

## v0.12.0 — 2026-10-07

### Features

- **Spells and features cast in the game.** The campaign option becomes Let Players Attack and Cast
  from Sending Stone, and with it spells and features from the Actions tab and favorites are used in
  Foundry too. That covers a save's chip, such as Fireball's DEX 15, a damage or healing chip, such
  as Magic Missile's, and a new Cast or Use chip for one that rolls nothing, such as Bless or Action
  Surge. A picker asks for the spell slot and, in a fight, the targets, up to as many as the spell
  takes, and once the game has used it the damage or healing is thrown and sent with no second tap.
  The Gamemaster's campaign card says whether spells reach the game. (app and module)

### Enhancements

- **Attacks with their choices.** An attack made in the game can now choose its spell slot,
  ammunition and attack mode, such as two-handed or thrown. One whose damage offers a choice of
  types, such as Chromatic Orb, is no longer refused: the tray asks which kind. The Midi-QOL setting
  becomes Make Players' Attacks and Spells Through Midi-QOL. (app and module)

### Maintenance

- **Docs, moves and tests.** The module's `PROTOCOL.md` gains Spells and features, and its README
  the renamed option and setting. `scripts/command-attacks.mjs` becomes `command-uses.mjs`, one
  preparation for attacks and uses. In the app, `use-picker.tsx` replaces `target-picker.tsx`, and
  Jest grows to 1,049 tests. (app and module)

## v0.11.0 — 2026-10-07

### Features

- **Players' attacks made in the game.** With Let Players Attack from Sending Stone also ticked,
  attacks from the Actions tab and favorites are made in Foundry: the item is used as Foundry uses
  it, spending ammunition, uses and slots, and the attack is rolled with the player's d20s at the
  combatant they pick. The tray says Hit, Miss or Critical hit where the Gamemaster shows that, then
  the damage, from the tray or the damage chip, is rolled on the same use with their dice. With
  Midi-QOL, Midi checks the hit and applies the damage, and if the Gamemaster turns off Make
  Players' Attacks Through Midi-QOL, attacks stay in the app. The Gamemaster's campaign card says
  whether attacks reach the game. (app and module)

### Fixes

- **A slow roll's result reaches the tray.** A roll the game took over a minute to make, as when a
  module first asked the Gamemaster something, used to stay marked as having taken too long. The
  game now reports it once it's made, and the tray shows its result instead. (app and module)

### Maintenance

- **Docs, data and tests.** The module's `PROTOCOL.md` gains Attacks, and its README covers the
  option, the Midi-QOL setting and what Midi may still ask the Gamemaster. In the app, migration
  `20261010090000_roll_request_use` links a damage roll to its attack, and the Jest suite grows to
  952 tests. (app and module)

## v0.10.0 — 2026-10-06

### Features

- **Players' rolls made in the game, with their dice.** When a Gamemaster ticks Let Players Roll
  from Sending Stone for a campaign in Manage Campaigns, players' checks, saving throws, initiative
  and death saving throws from the app are made in Foundry through dnd5e, as the player, with the
  dice they rolled, each card marked "Rolled on Sending Stone". If a start-up self-test fails, rolls
  stay in the app and Manage Campaigns says why. The roll tray shows what became of each roll, such
  as "At the table: 19", a Send to the table switch keeps a device's rolls to itself, and the
  Gamemaster's campaign card says whether players' rolls reach the game. (app and module)
- **Favorites on the sheet.** What the player made a favorite in Foundry now shows on the Actions,
  Inventory, Spells and Effects tabs, as a strip at the top whose heading hides it, remembered for
  the character, or as a column beside the tab where the sheet is wide enough. Each favorite rolls
  as its row does elsewhere, and a star marks it wherever else the sheet lists it. (app)
- **Initiative and death saves from the sheet.** The sheet's Initiative now rolls, marked Roll while
  the character waits for initiative in a combat. A dying character's death saves get a Roll button.
  (app)

### Maintenance

- **Docs for players' rolls.** The module's README gains Players' rolls, `PROTOCOL.md` replaces its
  Coming next with Rolls from the app, and `module.json` recommends libWrapper, through which the
  dice are wrapped when it's active. (module)
- **Tests, data and moves.** The Actions tab's row, chips and damage menu move to `action-entry.tsx`
  so a favorite shares them. A `RollRequest` table arrives with migration
  `20261009090000_roll_requests`, and Jest tests cover favorites, roll requests, their checks and
  routes, and the tray. (app)

## v0.9.0 — 2026-10-06

### Features

- **Actions groups that close.** Each group on the Actions tab now has a name you can tap to close
  the group or open it again, with how many actions it holds and, for a spell level, its slots. This
  works in the list, the columns and the table, and the browser remembers closed groups for each
  character. (app)
- **Favorites sent to the app.** The module sends each character's favorites in the order dnd5e's
  sheet shows them under Favorites and Tidy 5e in its sidebar: first the old-style resources with a
  name and a maximum, then what the player made a favorite, in their order, such as items,
  activities like a staff's Cast Fireball, effects, skills, tools and spell slots. A favorite the
  player can't see, such as a hidden item's, is left out, and the app shows favorites from v0.10.0.
  (module)

### Fixes

- **A spell cast from an item goes under that item.** A spell cast from an item, such as a wand's,
  now goes under the item's name on the Actions tab. Before, a spell the spellbook doesn't list
  landed in a second group of its level, such as a second "1st Level". The Spells tab says which
  item a spell is cast from. (app and module)

### Enhancements

- **Actions grouped by where they come from.** Within each section of the Actions tab, groups now
  follow Tidy 5e's order. Carried items come first, by kind (Weapons, Equipment, Consumables, Tools,
  Containers, Loot), where weapons came first and the other items shared one Items group after
  features; then spells as the spellbook groups them, then spells cast from an item, then features.
  (app)

### Maintenance

- **Docs, moves and tests.** The module's `PROTOCOL.md` documents `castFrom`, listed as module
  0.8.2's addition though no 0.8.2 was tagged, and `favorites`, its README lists
  `scripts/sheet-favorites.mjs`, and the roll-mode helpers move to `scripts/sheet-values.mjs`. In
  the app, `useStoredChoice` moves to `src/hooks/use-stored.ts` beside a new `useStoredSet`, and
  Jest tests cover the new grouping. (app and module)

## v0.8.1 — 2026-10-06

### Features

- **Actions tab.** The sheet's second tab lists the character's actions in sections by how each is
  activated, grouped as weapons, spells (as the spellbook groups them, with their slots), features
  and items. A chip rolls each attack, damage or healing into the tray, and a right-click or
  long-press offers advantage, disadvantage, Modify roll or a critical hit's damage. Each action
  opens to all there is to know of it. (app)
- **What a spell can be cast at.** An opened spell lists every slot it can be cast with and how many
  are left, and one with no slot left and no use of its own is dimmed with "No slots left". The
  module now sends each slot's level, so pact slots are offered only for spells they can cast. (app
  and module)
- **Table and Columns layouts.** On a tablet or wider, the Actions tab can be laid out as a table
  from 576 pixels, with range, to hit, damage and uses in columns, or in columns from 720 pixels.
  The browser remembers the choice. (app)
- **Every condition's rules.** An info button beside the Effects tab's Conditions heading opens all
  fifteen conditions of the 2024 rules, from the SRD 5.2. A row of their names jumps to each, and
  the character's own are marked. (app)

### Maintenance

- **Shared pieces and docs.** `SidePanel` and `Modal` share `useModalDialog`, and the roll menu and
  Modify roll become `useD20Rolls`, used by both tabs. `useStoredChoice`, `useWidth` and
  `SpellSlots` are new, with Jest tests, and `PROTOCOL.md` documents a slot's `level` as module
  0.8.1's addition. (app and module)

## v0.8.0 — 2026-10-05

Module only: the app's Actions tab, which shows what it sends, came with v0.8.1.

### Features

- **Each character's actions sent.** Each sheet now lists what the character can do in a fight, as
  Tidy 5e's Actions tab lists them by default and with the player's own Tidy choices, sectioned by
  how each is activated. Each action carries its range, bonus to hit, saving throw, damage or
  healing, uses and description, and an unidentified item keeps its numbers back. (module)

### Maintenance

- **Docs for actions.** `PROTOCOL.md` and the module's README describe `actions` as module 0.8.0's
  addition, and items and activities now share one uses helper. (module)

## v0.7.0 — 2026-10-05

### Features

- **Inventory tab.** The sheet gains Inventory: coin, load against carrying capacity (marked where
  the variant rule encumbers), attunement, and items by type with what's equipped or attuned,
  weight, price, count and charges. Each item opens to its rarity, properties and description,
  containers open to what they hold, containers within them too, and an unidentified item shows only
  what a player sees in Foundry. (app and module)
- **Spells tab.** A character who casts gains Spells: spellcasting ability, save DC and attack
  bonus, each class's too, then the spellbook's sections in dnd5e's order with each level's and pact
  magic's slots left. Each spell shows its casting time, range, concentration, ritual and whether
  it's prepared, and opens to its target, duration, components and description. (app and module)
- **Biography tab.** The sheet gains Biography: experience toward the next level, alignment, age and
  the like, personality, appearance and the biography itself, leaving out what's blank. (app and
  module)
- **Traits and death saves.** The Character tab shows size, senses, speeds, languages,
  proficiencies, resistances and immunities under the skills. Death saves show beside the hit points
  while the character is down or has any marked. (app and module)

### Enhancements

- **Tabs that fit.** The sheet's tabs use dnd5e's icons. Where their labels don't all fit, as on a
  phone or beside the chat on a smaller laptop, only the chosen tab is labelled. (app)

### Maintenance

- **Lint passes everywhere.** `postcss.config.mjs` and `src/clients/prisma.ts` are now formatted as
  the linter expects, so `npm run lint` passes across the app. (app)
- **Docs, shared sheet pieces and tests.** `PROTOCOL.md` documents module 0.7.0's inventory, spells,
  traits, death saves and details. The app's sheet entries gain labelled facts (`SheetFact`) and
  nested content, with Jest tests. (app and module)

## v0.6.0 — 2026-10-05

### Features

- **The Character tab, with 3D dice.** A character's page gains its sheet, laid out after Tidy 5e's:
  portrait, class, species, background, inspiration, hit points, armor class, proficiency,
  initiative, speed, abilities, saves and skills. A tap rolls a check, save or skill with jade 3D
  dice and the advantage its conditions give, and a roll tray shows the result and keeps recent
  rolls. The results stay on the page, as the tray says. The sheet and its tray are up to 1024
  pixels wide, and a box too narrow for Proficiency, Armor class or Initiative says Prof, AC or
  Init. (app)
- **Roll menu and Modify roll.** A right-click, a long-press or the menu key on a check, save or
  skill opens a menu, where it was asked for, offering Roll with advantage, Roll with disadvantage
  or Modify roll. Modify roll picks Disadvantage, Normal or Advantage, starting from how a tap would
  roll, and adds dice or modifiers such as 1d4 or +5, each shown in the tray. (app)
- **Features and Effects tabs, with conditions.** The sheet gains Features, grouped by the class,
  species or background that granted each, with uses, when they come back and each class's hit dice.
  It also gains Effects, in dnd5e's categories with each one's source and time left, which runs down
  as time passes, and the character's conditions as chips under the portrait, such as Exhaustion
  Level 2. Only what the character's player would see in Foundry is sent. (app and module)
- **Descriptions.** A feature, effect, class, species or background opens to its description as its
  player sees it in Foundry, with rolls and links marked and secrets set apart. A description loads
  only when it's opened. (app and module)

### Enhancements

- **The sheet beside combat and chat.** From 1024 pixels wide, the sheet fills the left, and combat
  and chat share a column on the right, switched by tabs that flag your turn and unread messages.
  The page opens on combat during a fight, otherwise on the sheet. (app)
- **Unread chat that lasts.** The Chat tab's unread count now survives a reload and carries across
  devices. It leaves out your own messages and stops at 99+. (app)
- **A turn panel that stays in view.** The panel with the round and the current and next turns now
  sits above the initiative list at every width and stays in view as it scrolls, where before only
  a one-line round summary did. (app)
- **Portraits in the chat.** A campaign character's message shows its portrait from the game, or
  initials where there's none. (app)

### Maintenance

- **The 3D dice packages.** `@lambersond/3d-dice-core`, `-react` and `-engine` join the app, their
  textures and sounds copied to `public/3d-dice` on install, and transpiled for Next and Jest. (app)
- **Sheets and descriptions stored.** The `actor_sheet`, `chat_read` and `sheet_text` migrations
  keep sheets, read positions and descriptions, sanitised with `sanitize-html`. A poll now carries a
  sheet only when it changed, and Jest tests cover the sheet, the roll hook, the menu and the tabs.
  `PROTOCOL.md` documents module 0.6.0's sheet fields and `character.texts`, which the transport's
  `sendLater` keeps in order. (app and module)

## v0.5.0 — 2026-10-05

### Features

- **Each character's sheet sent.** Under dnd5e, each campaign character goes to the app with its
  sheet: level, classes, species, background, portrait, hit points, armor class, proficiency,
  initiative, speed, inspiration, and each ability's and skill's modifiers with the advantage or
  disadvantage its conditions give. It's sent again within a moment of any change to the character,
  its items or its effects, and the app's Character tab, which shows it, came with v0.6.0. (module)

### Fixes

- **One scrollbar on the game table.** Once the combat tracker or chat was long enough to scroll,
  the whole page scrolled as well. Now only the panes do. (app)

### Enhancements

- **Combat and chat side by side.** From 1024 pixels wide, as on a landscape tablet or laptop,
  combat and chat sit side by side, each scrolling on its own under a line saying what's happening
  in it, and a chat always in view counts nothing as unread. The tracker splits into two columns
  only when its own pane is wide enough. (app)

### Maintenance

- **Sheet docs and a media query hook.** `PROTOCOL.md` documents the character sheet and
  `character.updated` as module 0.5.0's addition, and the module's README describes the sync. The
  app gains `useMediaQuery`, with a `matchMedia` stand-in for Jest. (app and module)

## v0.4.0 — 2026-10-04

### Features

- **Each campaign's own secret.** Manage Campaigns now holds the app's address and each campaign's
  secret, kept only in that browser, with the campaign's ticked characters listed first, and the
  separate Connection dialog is gone. Each campaign's Test checks that campaign as typed, passing
  only with its own secret or saying it isn't set up, and a campaign without its own secret still
  sends the shared one from before. (app and module)
- **Removing a player, deleting a character.** A Gamemaster can remove a player from a character, so
  it can be chosen again from the invite link, and a player can delete a character from its page as
  well as from the list. Each asks first. (app)

### Fixes

- **Characters reach a campaign set up after Foundry opened.** A campaign set up in the app while
  the game was already open now gets its characters without the Gamemaster reloading Foundry: the
  app asks for them and the module sends them again, at most every 30 seconds. The Gamemaster's
  campaign card tells a campaign still waiting for its characters from one Foundry sent none for.
  (app and module)

### Enhancements

- **The campaigns page in dialogs.** New campaign opens its setup in a dialog that shows the secret
  once to copy, and Connect Foundry lists the module's steps with the app's address to copy. Delete
  campaign moves to the foot of each campaign card, and it and Reset link now ask in a dialog, where
  they asked inline. (app)

### Maintenance

- **Docs, shared dialogs and tests.** `PROTOCOL.md` records the resend request, listed as module
  0.3.1's addition though no 0.3.1 was tagged, and per-campaign secrets with test pings that name
  their campaign, and the module's README says secrets are kept per browser. The app gains shared
  `Modal` and `ConfirmDialog` components, the `hello_session` migration and Jest tests for them.
  (app and module)

## v0.3.0 — 2026-10-04

### Features

- **Campaigns set up by their Gamemaster.** On a new Campaigns page, a Gamemaster sets up each
  campaign with its title, Forge game and a secret, shown once to copy. They see whether Foundry is
  connected and who plays each character, and can change the secret, reset the invite link or remove
  the campaign. The app takes a campaign's events only with that campaign's own secret, and tells a
  game or campaign that isn't set up so. (app)
- **Invite links.** Players join through a campaign's invite link, signing in if need be, and choose
  one of its characters, each of which belongs to one player. A box on Your characters takes a
  pasted link in place of the old form. Characters added before are linked to their campaign's
  character of the same name, or asked to choose. (app)
- **Combat rolls marked.** Attack, spell attack, damage, healing and spell rolls in the chat get a
  chip and a coloured edge with the item's name. Their targets are called out, with Hit or Miss when
  the Gamemaster shares armor class, and damage rolled from an attack's card shows that attack's
  targets. (app)

### Fixes

- **Initiative tiebreakers fit.** An initiative such as 18.14 now fits its box in the combat
  tracker, the rows line up, and values are rounded to two places. (app)

### Enhancements

- **Live or Offline.** The module sends a heartbeat to any campaign it has sent nothing for 30
  seconds, and the status on a character's page now says whether the game is heard from: Live, or
  Offline after two minutes without word, changing without a reload, where Live meant only that the
  app answered. The Gamemaster's campaign card shows Live, Offline or Waiting for Foundry, and when
  the game was last heard while it isn't Live, as they stood when the page loaded. (app and module)
- **Test Connection says when nothing is set up.** A test the app answers with 404 now says no
  campaign is set up for this game, and to set one up in the app with the game's address and the
  same secret. (module)

### Maintenance

- **Docs and tests.** `PROTOCOL.md` documents `bridge.heartbeat` as module 0.3.0's addition within
  protocol 2, and the module's README and setting hints start setup in the app. The app's migration
  links existing characters to campaigns, and Jest tests cover the campaigns page, invite links and
  secrets. (app and module)

## v0.2.0 — 2026-10-04

The app's first release.

### Features

- **Campaigns.** In Manage Campaigns, which replaces Choose Characters, the Gamemaster groups a
  world's player characters into titled campaigns. Each event goes only to the campaigns it
  involves, such as a whisper to its reader's campaign or a fight once one of the campaign's
  characters joins it. A player's character follows the campaign whose title they enter, and
  characters connected before are moved into a campaign named after the world. (app and module)
- **Sign in and your characters.** A landing page says how Sending Stone connects a player to their
  game, with Sign in to get started, or Choose your character once signed in. Players sign in with
  Google or Discord and add their characters, each with a name, its Forge game's address and its
  campaign's title. They choose one to open, or remove it. (app)
- **The game's chat and combat, live.** A character's page shows its campaign's chat and combat
  tracker as they happen, with whispers only for their players, hidden combatants left out and only
  the party's hit points shown. A status in its header reads Live while the app answers, or
  Reconnecting while it can't be reached, and the page stops asking for news while its tab is in the
  background. Until the game has sent anything, the page shows the address the Gamemaster sets in
  Foundry instead. Roll cards show the dice, total, damage type and targets, with Critical,
  Advantage, Disadvantage and Nat 1 marked, and your own messages sit on the right, with an unread
  count on Chat and a dot on Combat on your turn. (app)
- **Light, dark or system theme.** A switch in the header picks Light, Dark or System, applied
  before the page draws so it never flashes, in Sending Stone's jade green. (app)

### Enhancements

- **Only the app's address to enter.** Configure Connection asks only for the Sending Stone app's
  address, such as https://sending-stone.vercel.app, and shows where events will go as you type. The
  module adds the path itself, and a full address saved before keeps working. (module)

### Maintenance

- **Protocol 2.** `PROTOCOL.md` documents protocol 2, in which every event names its campaign and is
  counted per campaign, and lists its changes from protocol 1. The echo listener shows each event's
  campaign. The app's `/api/events` takes only protocol 2, so it refuses module 0.1.0. (app and
  module)
- **The app's foundations.** The app is set up with Next.js, Prisma, sign-in and Jest.
  `jest.setup.ts` no longer mocks a module the app lacks, so the suites start, and Jest tests cover
  the pages, server actions, data access and the events endpoint. (app)

## v0.1.0 — 2026-10-03

The module's first release, before the app. It speaks protocol 1, which no released app takes.

### Features

- **Chat and combat sent from Foundry.** The active Gamemaster's browser posts the table's chat
  messages and the combat tracker's changes, as they happen, to a listener at an address the
  Gamemaster chooses. Roll messages carry dnd5e's roll, item, activity and target details, chat and
  combat are switched on separately, and nothing is sent while no Gamemaster is connected. (module)
- **Connected characters.** In Choose Characters the Gamemaster ticks the player characters that are
  connected. Their hit points go with combat events, chat can be limited to their messages, and
  every message says which players and connected characters can read it. (module)
- **What only the Gamemaster sees stays back.** Gamemaster whispers, blind rolls, hidden combatants,
  other combatants' hit points and targets' armor class aren't sent unless the Gamemaster turns on
  Send Gamemaster-Only Information. A message made private after it was sent is withdrawn. (module)
- **Connection settings and a test.** Configure Connection takes the listener's address and an
  optional shared secret, kept only in the browser it's typed in, with Test Connection and the
  delivery status. A failed post is tried twice more, and the Gamemaster is warned once while posts
  keep failing. (module)

### Maintenance

- **The protocol and a stand-in listener.** `PROTOCOL.md` documents protocol 1's events,
  `tools/echo-listener.mjs` prints every event for development, and the module's README covers
  setup, CORS and what the listener sees. (module)
- **Releases from a tag.** `.github/workflows/release.yml` builds and publishes a release when a
  `v*` tag is pushed, stamping the version into `module.json`. It also attaches the manifest and
  archive to a release already published from GitHub, which the first run of v0.1.0 failed to do.
  (module)
