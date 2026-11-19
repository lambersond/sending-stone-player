# Roadmap

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). Each module version below
ships with the app deployed for it, the app first. The app has no version numbers of its own:
app-only work ships with its next deploy.

The further out a version is, the less settled it is, and that's expected: each one is planned in
full when work on it starts. Open questions stay with their version until then. Any version may
gain items from feedback or bugs. Done work moves to [CHANGELOG.md](CHANGELOG.md), under its
version.

Released: module v0.50.0 and its app, with v0.49.0, v0.48.0, v0.47.0, v0.46.0, v0.45.0 and
v0.44.0 before it.

## v0.46 (released, to check at the table)

Released on 2026-11-12, before Friday's session: what it holds is in
[CHANGELOG.md](CHANGELOG.md)'s v0.46.0 entry. v0.46 is the release candidate for v1.0: it runs at
the table for a while before v1.0 is tagged.

**To check at the table** (built and tested against stand-ins only), with dnd5e 5.3.3 and
Midi-QOL v14.0.x:

- **A character shared as All Players: Owner:** no other player's whispers or private rolls at its
  seat, no other owners in its roster, no DC of another player's save.
- **A recharge rolled at the table:** its chip goes as the tray says "recharged".
- **The Initiative tile:** in an encounter begun and then switched away on the tracker, the sheet's
  Initiative tile doesn't offer to roll for it.

## v0.47 (released, to check at the table)

Released on 2026-11-12, before Friday's session: what it holds is in
[CHANGELOG.md](CHANGELOG.md)'s v0.47.0 entry. v0.47 is the release candidate for v1.0 after v0.46:
it runs at the table for a while before v1.0 is tagged.

**To check at the table** (built and tested against stand-ins only), with dnd5e 5.3.3 and
Midi-QOL v14.0.x:

- **Favorites put in order:** on a player's own sheet, Reorder's drag and keys, and on a phone Move
  up and Move down in a favorite's menu, save the order; the character's sheet in Foundry shows the
  same order, its old-style resources first, and so does Tidy 5e Sheets' where it's in use (read
  from its source, not tried).
- **A character shared as All Players: Owner and owned by one player by name:** assigned to no
  one, a roll from the app is that player's card in Foundry, not the Gamemaster's.
- **A move from a party sheet:** what a character takes from the party sheet over its own shows on
  its sheet within about a second.
- **A move from a party sheet closed at once:** on a phone, what a character takes from the party
  sheet shows on its sheet within about a second of the game making it, though the party sheet was
  closed before then.
- **A favorite added just after an order:** within 10 seconds of Save order or a Move up, a
  favorite added from a row's menu, or in Foundry, moves with Move up, Move down and Reorder, and so
  do the others, none refused.
- **Module 0.43.0 named:** where a game still runs module 0.43.0 with Allow Players to change their
  hit points from the app off, the campaign card's Players' hit points line says to tick it; with a
  module before 0.43.0, the dice tray says the module makes its rolls from version 0.43.0.

## v0.48 (released, nothing to check at the table)

Released on 2026-11-16: what it holds is in [CHANGELOG.md](CHANGELOG.md)'s v0.48.0 entry. v0.48 is
the release candidate for v1.0 after v0.47: it runs at the table for a while before v1.0 is tagged.
Nothing in it waits to be checked there: the module's scripts no longer import one another in a
loop, with nothing the module sends, takes or shows changed, and the app's pages draw an outline of
themselves while they load.

## v0.49 (released, to check at the table)

Released on 2026-11-17: what it holds is in [CHANGELOG.md](CHANGELOG.md)'s v0.49.0 entry. v0.49 is
the release candidate for v1.0 after v0.48: it runs at the table for a while before v1.0 is tagged.

**To check at the table** (built and tested against stand-ins only), with dnd5e 5.3.3 and
Midi-QOL v14.0.x:

- **Midi-QOL's look for reactions:** with Manual Dice on, a creature holding a reaction that costs
  dice, such as 1d4 charges, attacked from the app or by you in Foundry: no dice window opens as
  Midi looks for its reactions, the reaction is still offered, and taking it rolls its cost with
  your dice. Under dnd5e 6 with Midi-QOL's line for it the same is still to be seen: how that line
  looks for reactions was not read.
- **A skill, a tool or spell slots moved from its menu:** on a phone, a long-press on a skill or
  tool favorite still rolls with advantage, or opens Modify roll…, without a slip onto Move up or
  Move down, which sit nearest the thumb; Move up and Move down there, and on spell slots held by
  their name, save the order, and Foundry's sheet shows it.
- **Effects kept from Wild Shape:** a Bless cast on the wolf, some rounds gone, is on the druid
  after Return from the app and after Foundry's own Restore, with the same time left; it goes when
  the cleric stops concentrating; with Midi-QOL at its defaults the cleric is still concentrating
  after the return, also after a Restore made while you view a scene with none of the druid's
  tokens. With DAE, an effect's "on" macro runs once. The same spell cast on the druid again later
  refreshes the kept effect, not a second one.
- **Effects taken off in Wild Shape:** an effect the druid had going in, removed from the wolf, is
  gone from the druid after the return; Encumbered and Bloodied are as the druid's own numbers have
  them; one that had already run out before Wild Shape is still on the druid.
- **The stone as the installed app opens, on an Android phone:** on the production address, once the
  phone has taken the new opening up (the app closed and the phone charging on Wi-Fi, within about a
  day; or the app removed and installed again): from the second opening the stone shows from the
  device, on the dark of the phone's own launch screen, its rune lighting from the dot outward until
  your characters, or sign-in, takes its place. To see: whether the stone steps in size, shape or
  place as the phone's screen gives way to the page, whether it is as sharp, and how long an opening
  takes against before. In airplane mode the stone stays, dark, with its two sentences and Try
  again, which changes nothing while offline; back online it opens by itself within a few seconds,
  saying nothing while your characters loads. On its side, and in split screen, the words stand
  beside the stone, clear of the screen's edges. With Remove animations on, the rune is lit and
  still. Back on your characters closes the app.
- **The same on an iPhone's Home Screen app,** removed and added again (it keeps the address it was
  added with, and you sign in once more): iPhone's own white screen, then the stone, then your
  characters. To see: how long the white shows, whether the rune keeps lighting, whether the stone
  is sharp; and in airplane mode, from the third opening, the stone with its two sentences. Safari's
  own "not connected" page there instead means an iPhone didn't finish installing the worker, which
  has a known remedy.
- **Coins added, taken away and handed out:** Add or remove and Give (v0.49's Add or take away and
  Hand out) change the coins on the character's sheet in Foundry as the app says, the change coming
  back as the tray says; "Thorin paid 5 gp" is in everyone's chat, a hand-out's whispers only in
  each receiver's player's, the Gamemasters' and the giver's player's; both switches in the
  campaign's Coins box are kept as saved. Under dnd5e 6, a fraction of a coin the world shows stays
  as it was after a change.

## v0.50 (released, to check at the table)

Released on 2026-11-18: what it holds is in [CHANGELOG.md](CHANGELOG.md)'s v0.50.0 entry. v0.50 is
the release candidate for v1.0 after v0.49: it runs at the table for a while before v1.0 is tagged.

**To check at the table** (built and tested against stand-ins only), with dnd5e 5.3.3 and
Midi-QOL v14.0.x:

- **Other creatures' health:** in a fight on a scene with the creatures' tokens, a player's Combat
  tab says nothing of how hurt the monsters are until Allow Players to see other creatures' health
  in the app is ticked on the campaign's Player actions tab; then each creature that isn't the
  party's, a Friendly one too, reads Unhurt, then Hurt, Bloodied at half its hit points or less and
  Down at 0 as you damage it in Foundry, on its row and in the turn panel on its turn, within a few
  seconds and with no turn passed; with Show their hit points too ticked, its hit points show
  instead. A hidden combatant, a token hidden from players and a Secret one show nothing, and one
  hidden mid-fight loses what it showed; the party's own hit points follow damage and healing
  between turns.
- **Quieter while nobody is in the app:** with Foundry open and no character or party open in the
  app for a few minutes, the campaign's line in Sending Stone's settings window says the app is
  asked every 20 seconds; a player who then opens their character is noticed within about 20
  seconds, their first roll reaching the game then and the next at once, and the line goes back to
  its usual words; a dish from the Magical Recipe Book reaches you within about 20 seconds. The same
  with Foundry's tab in the background, where a browser slows a page's timers.
- **Sign-in on the deployed app:** on the production address, signed in on a phone and on a
  computer, a table left open for several minutes keeps reading the game and its rolls go through;
  signing out in one tab sends the table open in another tab of that browser to Sign in at its next
  read, and the other device stays signed in.
- **Give and Add or remove:** on a character's Inventory tab, on a phone and on the desk, Add or
  remove and Give sit under the coins, and a party's buttons under its coins too. 5 gp given to one
  character is whispered to their player, "Vex received 5 gp from Thorin", and the Gamemasters are
  told "Thorin handed out 5 gp each to Vex: 5 gp in all"; 2 gp each to two, "Thorin handed out 2 gp
  each to Vex and Bram: 4 gp in all"; 30 gp to the party is a line for everyone, "Gives 30 gp to The
  Iron Company", spoken by the giver. Add or remove's dialog reads Add and Remove, and each change
  is still a line for everyone, "Thorin paid 5 gp".

## v0.51 (release candidate)

Built, not yet tagged: what it holds is in [CHANGELOG.md](CHANGELOG.md)'s v0.51.0-rc entry.

**To check at the table before module v0.51.0 is tagged** (built and tested against stand-ins only),
with dnd5e 5.3.3 and Midi-QOL v14.0.x:

- **Companions on another scene:** with a familiar summoned and an owned sidekick's unlinked token
  on one scene, then another scene made active: each keeps its tab, pinned, with the note on its
  sheet; a check rolled from its tab is made by its token's creature in Foundry; the campaign card
  marks each "(on another scene)" or "(summoned, on another scene)"; reloading the Gamemaster's
  Foundry drops neither; and deleting or hiding a token takes its companion away.
- **Two encounters at once:** on two scenes, a fight with everyone on one and a companion's fight on
  the other, both begun: the Combat tab shows a tab for each, named for the encounter, or else for
  who of yours is in it, a dot on the companion's tab on its turn, and holding the Combat tab ends
  that turn while you view the other scene; the companion's initiative from its tab, cleared in
  Foundry, lands in its own encounter; and with module 0.50.0, the companion's tab offers no
  initiative into its own fight while the party's was changed last.
- **Give to a party and characters together:** on a character's Inventory tab, Give lists the
  parties you own as checkboxes, none ticked; 2 gp each to the party, Vex and Bram is "Gives 2 gp to
  The Iron Company" for everyone, Vex's and Bram's players are whispered theirs, and the Gamemasters
  are told "Thorin handed out 2 gp each to The Iron Company, Vex, and Bram: 6 gp in all"; the
  party's sheet shows 2 gp more within a few seconds, a party you aren't in too; the party's own
  Give says "held", with no All.

## Before v1.0

All the work planned before v1.0, by number, kept under where each item came from. The owner's
plan of 2026-11-13 takes it in batches, in this order; feedback from the table, bugs found and
tweaks needed may change it as it goes. Next week aims at the first three.

1. Item 24, the module's import cycle: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.48.0.
2. Items 23, 29, 47, 41, 42, 57, 56, 70, 71, 67 and 68, Midi-QOL's reaction checks, effects carried
   back from Wild Shape, Move up and Move down for every favorite, the three e2e races under load,
   the stone as the installed app opens, two more e2e checks under load, and coins added, taken away
   and handed out from the sheet: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.49.0.
3. Items 18, 36 and 91, companions and sidekicks wherever they are, two encounters at once, and Give
   to parties and characters alike: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.51.0-rc.
4. Items 61, 62, 58 and 89, quieter polling, fewer sign-in reads, non-allies' health, and one Give
   and Add or remove for a character's coins: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.50.0.
5. Items 64, 65 and 66: any ability or skill the game has.
6. Items 59 and 60: summon activities, and known forms from anywhere.
7. Item 63, offline mode.

**Found while untangling the module's imports**

69. **Left over from the module's import cycle:** small things item 24 left as they were, as it
    moved code without rewriting it; none changes what the module does, and none is in a batch
    yet. `summarizeCharacter` (`character-sync.mjs`) is called by nothing and could go. Twenty
    names are still exported that nothing outside their own script reads now: eleven kinds' checks
    and `isKey`, `isOptional` and `isRolled` in `command-rolls.mjs`, and `castFromItem`,
    `dnd5eEnchant`, `midiEnchantNow`, `workflowSettled`, `currentTargets` and `setTargets` in
    `command-uses.mjs`, which also imports two names it never uses (`DND5E_ACTIVITIES` and
    `ownDamageConfig`, unused before the move too). Two things made to keep a script out of the
    loop are no longer needed for that: `findLink`'s two `import()` in `command-links.mjs` could be
    plain imports, and the hello could read the open dice asks by a plain import in place of the
    slot `later-dice.mjs` fills (`registerDiceAsks` in `dice-plan.mjs`). And the guard,
    `test/import-layers.mjs`, reads text, not syntax, and its header says what that costs. It
    reads only `.mjs` files under `scripts/` and the forms of import Node 22 reads (`import defer`
    and `import source` are to be tried again when `.nvmrc` moves). It fails on some text that
    imports nothing, such as an import spelt out in a comment or a JSDoc type, or `import's`
    before a later apostrophe on its line, which is answered by rewording the text. A failure can
    name the line of a comment above the import it means. Its time grows as the square of the text
    in three ways, none near the module's scripts (the 77 of item 24 took 0.04 seconds), one with a
    fix tried and not taken. And it doesn't check two rules the module's `CLAUDE.md` keeps by review
    alone: state written in one script, and nothing run as a script loads outside `module.mjs`.

**Moved from the next slice**

Items 18 and 36, companions and sidekicks wherever they are and two encounters at once, are done, in
[CHANGELOG.md](CHANGELOG.md)'s v0.51.0-rc.

**Found while building Batch 2**

72. **Midi-QOL's check of a Gamemaster's own use asks for its dice twice:** where Midi spends what a
    use spends without its dialog, it works the cost out first and throws that away
    (`checkAutoConsume` in its `MidiActivityMixin.ts`), so a dice cost is rolled twice with the
    Gamemaster's dice settings, for a use they make in Foundry and for a reaction they take; and so
    is the cost of another activity Midi pairs with a Gamemaster's own attack
    (`checkOtherActivityConsumption`), read from its source and not tried. Midi's own, and said in
    the module's `PROTOCOL.md`; the module could roll the first with Foundry's computer dice, as it
    does for a use from the app and, since 0.49.0, for the reactions Midi looks for. In no batch
    yet.
73. **A roll's button drops the first Enter after its menu was opened from the keyboard:** with a
    check's, save's or attack's button focused, the menu key or Shift+F10 opens its menu; whatever
    is done there, the next Enter or Space on the button does nothing, and the one after rolls.
    `RollButton` (`src/features/rolling/components/roll-button/roll-button.tsx`) marks every menu as
    opened by a press, so that the tap ending a long-press doesn't roll too; a key's menu is
    followed by no such tap, as `usePressMenu` already knows. Every roll button, from before v0.47;
    found building item 47, whose Move up and Move down on a skill or tool favorite are one more way
    into it, and seen in Chromium at 1280 px: after Shift+F10 and Escape on a skill favorite, the
    first Enter rolled nothing and the second rolled. In no batch yet.
74. **Keyboard focus after a favorite moves from one list to the other:** where the favorites are in
    two lists side by side (their card 720 px wide or wider with no column of its own, as on a
    laptop 1366 px wide), Move up or Move down chosen from a favorite's menu with the keyboard, on
    the last row of the first list or the first of the second, takes the row to the other list and
    leaves keyboard focus on the page, where a move within a list leaves it on the row; a row open
    to its description is closed as it crosses, by the mouse too. `FavoritesList`
    (`src/features/sheet/components/favorites/favorites-list.tsx`) draws the two halves as two
    lists, so a row that crosses is drawn anew. Every favorite, since v0.47; item 47 brought a
    skill, a tool and spell slots to it. Seen in Chromium at 1366 px on an item's row, a skill and
    spell slots. The known limits say the same of Remove from favorites and Prepare. In no batch
    yet.
75. **The favorites in one list once Reorder has been opened:** where the favorites are in two lists
    side by side, opening Reorder and closing it, by Cancel or by Save order, leaves them in one
    list the card's full width, whatever the window's width after; another tab of the sheet and
    back, or the page loaded again, brings the two back. `FavoritesList` measures its card with
    `useWidth` (`src/features/sheet/hooks/use-width.ts`), which begins watching the element once;
    while Reorder shows the card isn't drawn, and the one drawn after is never watched: the cause as
    the code reads, the width itself not measured in the browser. A look only: every favorite is
    there and works. Since v0.47 (Reorder); seen in Chromium at 1366 px, looking for the two lists
    for item 47. In no batch yet.
76. **What a druid begins in Wild Shape:** a spell a Moon druid casts as a beast and concentrates
    on, such as Moonbeam or Fount of Moonlight, ends in Foundry when Wild Shape ends. Whether what
    it kept up, a template on the map or an effect on another creature, ends with the form or is
    left behind is Foundry's own, not checked here. Item 29 keeps what others put on the form, and
    leaves this as it was. In no batch yet.
77. **An effect changed in place in Wild Shape:** where the druid already has an effect and the same
    spell or item is used on the beast again, dnd5e refreshes the beast's copy; the druid comes back
    with the old one, with its old time left, or still turned off. The same for one a Gamemaster
    turns off or edits on the form. In no batch yet.
78. **Status effects that are no condition, in Wild Shape:** Sleeping, Dodging, Hiding, Marked and
    dnd5e's other status effects that are no condition are neither kept nor taken off when Wild
    Shape ends: one put on the form ends with it, and one the druid already had stays though it was
    taken off the form. Sleeping put on the wolf ends Wild Shape, as it makes the form
    Incapacitated, and the druid comes back awake until the Gamemaster puts it on the druid. As
    before 0.49.0, and as item 29 was built: whether they should come back with the druid as
    conditions do is the owner's to say. In no batch yet.
79. **End turn's 600 ms counted from when the page takes in the turn, not from when it's drawn:**
    `useEndTurn` (`src/features/table/hooks/use-end-turn.ts`) starts them in the effect of the
    render that first shows the turn. Where that render also takes a toast away, as when a turn is
    taken back with Undo, React runs the effect before the browser draws; on a slow or busy device
    the turn is then on screen a frame or more short of 600 ms before End turn can be tapped (at
    least 22 ms short in v0.45's full e2e pass, under three lanes' load; a millisecond or two
    alone). The 600 ms are the owner's (a tap aimed at the last heading, or a double tap across a
    turn's end, ends nothing), so nothing was changed: if they are meant from when the player sees
    the turn, they could start at the first frame drawn after it. Found while building item 42. In
    no batch yet.
80. **e2e checks of the same kinds as items 41, 42 and 70, not yet seen to fail:** (a) a menu's
    or popover's focus read the moment it shows, where floating-ui gives it focus a frame later:
    `removals-e2e.mjs:353` (part 2, Shift+F10), `favoriting-e2e.mjs:594` and `:611` ("Add to
    favorites" focused, by Shift+F10 and by the context-menu key), `givetake-e2e.mjs:331` and, to be
    checked, `phone-e2e.mjs:322`. Each has a round trip or two between the menu showing and the
    look, which has been enough so far; `focusInside` (`e2e/world-030.mjs`) is the wait. (b) A step
    that must land inside the page's own 600 ms: endturn part 20, "a tap on End turn … (within
    600 ms)". (c) A page's header read before the page has hydrated, where Full screen is drawn only
    once it has: to be checked, `phone-e2e.mjs:363`, which reads Full screen's size after several
    looks at a page `goto()` loaded, which has been enough so far; help's `ready`
    (`e2e/help-e2e.mjs`) is the wait. The party suite reads its header (`party-e2e.mjs:213`, `:505`)
    after a link within the app or a wait for "Reconnecting", which only a page that has hydrated
    shows. Item 57's kind has none left: `stopFetching({ age })` waits, and so do notesoffline's
    four closings by the Gamemaster leaving. Nor has item 71's, a photograph read for its colors,
    which is toasts' alone. In no batch yet.
81. **What the launch page leaves to the phones:** to settle once the stone has been seen on an
    Android phone and an iPhone (v0.49's checks): the stone's size against Android's own launch
    screen (144 px now; larger also means the 512 px image, a page of about 356 KB, and two pinned
    sizes); an iPhone's white first screen before the stone, which only a startup image for each
    screen size covers; and, if an iPhone doesn't finish installing a worker whose page leaves at
    once, waiting up to a second for it on an opening that has none. An opening connected but unable
    to reach Sending Stone still ends on the phone's own error page, which is item 63's. Left by
    item 56. In no batch yet.
82. **The header's Help moves as a sheet hydrates:** Full screen is drawn only once the page has
    hydrated (`useFullscreen` answers false until then), so between the sheet's markup arriving and
    hydration the header's right has one button fewer than the outline before it and the header
    after it: Live and Help sit one button's width to the right, then step back as Full screen
    appears (36 px at 360, measured while building item 70). A slot kept for Full screen until then,
    as the outline keeps one, would hold them still. Found while building item 70. In no batch yet.
83. **A spell prepared's check lets three other kinds' fields by:** a `prepare` command that also
    names `hitPoints`, `rerolls` or `enchantment` isn't refused `"invalid"` by the module: its list
    of other kinds' fields (`OTHERS` above `checkPrepareCommand`, in the module's
    `scripts/command-rolls.mjs`) lacks those three, where hit points' own list has every one. The
    module would prepare the spell and ignore the rest. The app's schema refuses such a request
    before it is queued, so no player meets it. Add the three, and to `test/fvtt/preparing.mjs`'s
    `OTHER_FIELDS`. Found building item 67. In no batch yet.
84. **Coins moved or distributed leave a fraction's noise:** under dnd5e 6, in a world that gives a
    coin fractional digits, coins moved to or from a party (a party's Take and Send to, and coins
    given to a party by an app before v0.51.0), coins given to another character from an app before
    v0.50.0, and a party's distributed are written as floating point makes them: 10.7 gp less 10 is
    stored as 0.6999999999999993, which dnd5e's own rounding shows as 0.69, so a hundredth of a coin
    goes to no one. The module's `moveCoins` and `distributeNow` (`scripts/command-transfers.mjs`)
    could write through `coinUpdate`, as coins added, removed and handed out do since 0.49.0, to
    parties too since 0.51.0. A default dnd5e 6 world shows whole coins, and dnd5e 5 stores whole
    coins: neither shows it. Module only, small. Found building items 67 and 68. In no batch yet.
85. **Keyboard focus after a move is sent from a character's sheet:** sent from its dialog with the
    keyboard, a move leaves focus on the page, as the dialog hands it back to the button that opened
    it, which waits disabled until the move is made. Seen for the Currency row's Add or remove and
    Give (v0.49's Add or take away and Hand out); by the same code it is so for an item's Give…,
    from v0.31. Escape, which sends nothing, gives focus back as it should. A party's sheet, which
    has no tray, gives where the move stands focus instead (`MoveStatus`); on a character's sheet,
    where focus should go (the tray's line, or the row's label, which says what's on its way) is one
    decision for all of its moves. Found reviewing items 67 and 68. In no batch yet.
86. **e2e's toasts tap check under load:** T6 in `e2e/toasts-e2e.mjs:739`, at 390×844, "tapped once
    the game has made it, the Dexterity check's toast goes at once", wants the toast gone within
    300 ms of the tap, timed from before `page.touchscreen.tap` to the toast detached, so the 300 ms
    count Playwright's own round trips and the page's main thread, not only the app's. It took
    891 ms once, 13 of 149, in the e2e run made landing items 70 and 71, the suite alone on its lane
    while another area's Jest and checks ran on the machine; it passed alone later on the same head
    (149 of 149), as it did in the races70 lane's runs and in the batch's full e2e pass. Of a kind
    with items 41, 42 and 70, which each failed under load with the app right, but not one of
    item 80's kinds: the nearest, (b), is a step of the test's that must land inside the page's own
    600 ms, where this is a bound the suite sets on the page, timed from the test's side. The check
    could time the toast's going from the page's own record, as T5 does with `watchToasts`, or allow
    for the round trips. Found landing items 70 and 71. In no batch yet.

**Found while building Batch 4**

87. **default.env's session lifetime:** its note says a session lasts 7 days unless `AUTH_MAX_AGE`
    says otherwise, with 604800 as its example; `src/auth.ts` has made it 30 days since 81a8278
    (now `src/auth-session.ts`). The note could say 30 days, with 2592000. Found planning item 62.
    In no batch yet.
88. **A session in daily use is likely to end 30 days after its cookie was last set:** Better Auth
    pushes a session's end back once a day, on whichever read of it comes first. After a day away
    that is usually a page opened afresh, a Server Component, which can't set a cookie (Next allows
    that only in a Server Action or Route Handler; Better Auth's `nextCookies` skips the push-back
    only for a client navigation's RSC request, and swallows the error). So the new end is written
    to the database, the browser keeps the old cookie and its Max-Age, and the table's polls,
    finding the session fresh, never set it again. Read from Better Auth 1.7.7's
    `api/routes/session.mjs:198-214` and `integrations/next-js.mjs:67-69, 91-95`, not tried. It was
    so before item 62; since it, a Server Action no longer pushes the end back either (its read
    passes `disableRefresh`), and the table's polls still do. Found planning item 62. In no batch
    yet.

**Moved from v1.x on 2026-11-13**

Item 58, non-allies' health, is done, in [CHANGELOG.md](CHANGELOG.md)'s v0.50.0.

59. **Summon activities** used from the app.
60. **Known forms from anywhere:** a form put on a druid's Wild Shape in Foundry from outside the
    campaign's compendiums, such as another compendium or a world actor, used from the app too,
    where its player could use it in Foundry.

Items 61 and 62, quieter polling and fewer sign-in reads, are done, in
[CHANGELOG.md](CHANGELOG.md)'s v0.50.0.

63. **Offline mode:** the app keeps working on a device without a connection, such as a phone that
    loses signal at the table: a player's characters, their last-seen sheets, notes and journal kept
    on the device and readable offline, with what's out of date marked; notes written offline sent
    once the device is back online; and rolls, moves and anything else the game must answer refused
    plainly until then. Item 56's launch worker (`/launch-worker.js`) keeps to `/launch` and its one
    page; offline mode's worker is its own, for which `/sw.js` is left free. A fairly large update:
    what's kept on a device and for whom (cleared on sign-out, so a shared device keeps nothing),
    how long it's kept, and how a note changed both offline and in Foundry meanwhile is settled.
64. **Any ability or skill the game has, named as the game names it:** with dnd5e's Honor or
    Sanity turned on, or a world's own ability or skill, the sheet already shows and rolls them
    and the Gamemaster's asked saves work, but the app still knows only the six abilities and 18
    skills in places, by English name (`src/constants/dnd5e.ts`, and the schemas' `abilityId`).
    It should accept any ability the character's sheet has, the server's checks per character
    staying the safety, and name abilities and skills from the sheet the module already sends.
    Then a Sanity save in an item's text or on the Gamemaster's request card is a button again,
    "Wisdom or Sanity" keeps both, and a companion's notice says "a Sanity saving throw", not "a
    san saving throw"; a game in another language sees its own names there too. App only; both
    parts ship together. From v0.48's look at how flexible the app is.
65. **Checks on any ability:** the module still sends checks (in chat asks, description links and
    an item's check activity) only for the six abilities, so an Honor check, a check of a world's
    own ability or a skill tied to one (Etiquette on Honor) stays plain text, and "DC 12 Wisdom or
    Honor check" becomes a button offering only Wisdom while it reads "or Honor". Once item 64 is
    in, the module sends any ability the game has, behind a feature the app announces in its
    hello so an older app is never sent one; a choice is linked whole or not at all; PROTOCOL.md
    says so, with harness cases for Honor, Sanity, a world's skill on Honor and an untyped
    ability. Module and app; needs item 64.
66. **Eight abilities, laid out:** with Honor and Sanity on, the abilities grid ends on a short
    row (3, 3 and 2 on a phone), and the loading skeleton draws six; its columns could follow the
    count. With it, two small guards: Wild Shape marks a world's untyped ability neither physical
    nor mental, as dnd5e does (the module's `sheet-wild-shape.mjs`), and abilities and skills are
    read row by row, so one bad row can't blank a whole sheet. App and module, small.

**Asked for on 2026-11-17**

Item 89, Add or remove, one Give for a character's coins, and the Currency row's buttons below its
coins, is done, in [CHANGELOG.md](CHANGELOG.md)'s v0.50.0.

**Found in Batch 4's last checks**

90. **e2e's next read of the table after a recharge, under load:** part 15 of `e2e/alone-e2e.mjs`
    (line 1114), at 1280, "the page read the table as the game answered the recharge …, and again
    … ms after that read", wants the page's next read to begin within 850 ms of the end of the read
    on its way as the game answered. The page waits 500 ms (`READ_AGAIN_AFTER`, since v0.46.0), and
    waited 1 s before, measured at 986 ms and more. It took 875 ms once, under `MIDI=1`, in batch
    4's full e2e pass, three lanes up on four cores, and passed when rerun alone on its lane at once
    (131 of 131). The other seven in the logs still on disk took 533 to 734 ms. The gap is timed
    from the stand-in's side, so it counts the page's own work after a read (reading the answer,
    drawing it) as well as the wait. Of a kind with item 86. The check could time the wait from the
    page's own record, or allow more of the 1 s it tells the wait apart from. Found in batch 4's
    last checks. In no batch yet.

**Asked for on 2026-11-18**

Item 91, Give coins to parties and characters alike (on a character's Give of its coins the parties
are checkboxes, as the characters are, and one give may go to any of them together, each given the
same), is done, in [CHANGELOG.md](CHANGELOG.md)'s v0.51.0-rc.

**Found while building Batch 3**

92. **Midi-QOL's checks in an encounter the Gamemaster doesn't have up:** for a creature fighting
    in an encounter on another scene than the one the Gamemaster views, Midi-QOL's reaction,
    bonus-action and opportunity checks aren't made (Foundry's `Actor#inCombat` and the module's
    check both read `game.combat`, the module's `scripts/command-uses.mjs:893-901`; Foundry's, to
    check), and a use at Self finds no combatant (`selfTarget`, `:531-541`). It matters only with
    Allow targets off your screen, since Midi-QOL otherwise needs the target drawn. The module
    harness's `inCombat` stand-in reads every combat (`test/fvtt/activity5e.mjs:424-428`), so it
    doesn't show this. Found building item 36. In no batch yet.
93. **A Gamemaster's message past the twentieth isn't marked as theirs:** a Gamemaster's hand-out
    to 20 characters who each have a player makes 21 messages, and the module lists only 20 in the
    result's `messages` (`MOST_MESSAGES`, `scripts/commands.mjs:175`; the app's
    `MAX_GM_ROLL_MESSAGES`, `src/schemas/sending-stone.ts:174`), so the last, the Gamemasters' own,
    isn't marked as theirs in the app. Since before 0.51.0; parties add one message each, as
    characters do. Found building item 91. In no batch yet.
94. **The module harness's wait for a druid's copy made late, under load:**
    `test/fvtt/wildshape.mjs` (line 1170), under `MIDI=1`, "her copy made too late: Rowan's
    concentration gone, and nothing of it left on her", turns the wolf back into Elowen with the
    copy of an effect Rowan concentrates on held back eight turns (`port.faults.slowEffects = 8`),
    then waits a fixed 160 ms (`settle(160)`) for the bridge to sweep the copy off her. It found the
    copy still on her once (`[false, 1]`, where it wants `[false, 0]`; 16 of 33), in the companions
    landing's full harness, run beside that landing's e2e on three lanes, a load average near 6 on
    four cores, and passed when the full harness ran again at once on the same head (122 of 122),
    and alone three times (33 of 33 each). Neither the check nor the module's Wild Shape scripts
    have changed since v0.50.0. Of a kind with item 90. The check could wait until the sweep has
    run, or allow more than its 160 ms. Found landing item 18. In no batch yet.

## v1.0

The major release of the app and the module, once the work planned before it is done and the
latest release candidate holds up at the table, before work starts on v1.x.

The module keeps its id, `sending-stone`, though its title changed in v0.37: Foundry keeps the
campaigns, their secrets and every flag under it, and installs follow its manifest URL.

## v1.x

1. **Critical hit options.** App criticals double only the dice; choices such as dnd5e's Critical
   Damage Modifiers or Midi-QOL's critical options could come back as a per-campaign setting.
2. **Inactive characters:** a campaign's character can be marked inactive. The owner's gist
   (2026-11-14), to flesh out later: an inactive character gets no updates in the app and can't
   do anything from it, and its name shows in none of the app's lists (such as the characters
   offered for item 68's hand-out); it's read-only, though its owner can still open its sheet.

## v2.0

1. **dnd5e system 6.x support.** Much already runs on dnd5e 6.0.5: critical damage, moving items,
   typed dice, removing items and party sheets. A known gap: the Gamemaster's "ask the table" save
   and check cards aren't read under dnd5e 6. If dnd5e 6 becomes the stable release sooner, this
   may move up.
2. **Dishes under dnd5e 6:** the Magical Recipe Book's dishes, which need dnd5e 5 for now.

## Known limits

- When typing in dice, damage's dice an effect adds, such as Divine Favor's, are asked for among the
  damage's own dice, unnamed, with no Skip.
- When typing in dice, a die bonus no effect explains, typed into the character in Foundry, or a
  bonus the table narrates without applying it, is rolled by Foundry, or added with Modify Roll.
- When typing in dice, an effect's die on only some kinds of attack (melee or ranged, weapon or
  spell) is rolled by Foundry; Bless's and Bane's are on every attack.
- When typing in dice with Elven Accuracy's third d20 skipped, the app's own total, and its
  "Natural 1" or "Natural 20", read the two d20s typed; the game's total, hit or miss are the
  tray's "· table" ones.
- When typing in dice, Bardic Inspiration's die is the bard's as the inspired character's sheet last
  read it, not as it was when given; it follows the bard's within a turn in combat.
- When typing in dice, Bardic Inspiration can't be added to a roll from the app once Done is
  pressed: the Gamemaster adds it in Foundry.
- When typing in dice with Bless's, Bane's or Elven Accuracy's die skipped, the dialog's total
  leaves out a die only the game rolls, so whether the roll fails can't be told before Done: type
  that die in to use Bardic Inspiration on the roll.
- When typing in dice, a spent Bardic Inspiration's Inspired that the app may not remove (the
  campaign doesn't let players remove their own effects, a companion, a druid in Wild Shape, or a
  bard who isn't a player's character) isn't offered again on that page until it's removed, but is
  once the page is reloaded; and a bard's Inspire given again before it's removed isn't offered, as
  dnd5e refreshes the same effect: the Gamemaster removes it first.
- When typing in dice, Bardic Inspiration added to a roll the game took too long to make stays
  spent until that roll is made, or until the page is reloaded: it isn't offered again meanwhile,
  and nothing says it's spent until the roll is made.
- When typing in dice in a world on the legacy (2014) rules, a Bardic Inspiration feature that
  doesn't say which rules it's for counts as 2014's and isn't offered; dnd5e's 2024 compendium
  feature, which says, is.
- An exploding die typed in still has Foundry throw its extra die under dnd5e 6, or with a module
  before 0.44.0: with 0.44.0 under dnd5e 5, its player is asked for it.
- Midi-QOL's optional bonuses, its Bardic Inspiration among them, are offered on the Gamemaster's
  screen after the roll, with Foundry's dice.
- When typing in dice, two players' attacks awaiting the same Midi-QOL bonus damage at once, such
  as two Hunter's Marks, have it rolled by Foundry for both, until each has rolled its bonus
  damage; a bonus only one of them awaits, such as Sneak Attack, is still asked.
- Moving several items at once isn't planned unless it's asked for.
- Summon activities are used in Foundry (planned before v1.0, item 59).
- A companion shared by several characters is asked a save card's save only where every one of
  their players can read the card.
- A Gamemaster's request for a save posted in chat asks the campaign's characters, not their
  companions.
- After the Gamemaster clears a campaign's chat in the app, a message posted in Foundry before the
  clear still shows if it reaches the app only after it, as it can when Foundry was out of touch.
- Whether a change to a message brings it back after a clear is told by Foundry's time for the
  message against the app's: where the Gamemaster's computer clock is well off, a message posted
  just before the clear can come back, or one posted just after it stay out.
- Companions are found on every scene, but no level is read: one on another level of the active
  scene counts as there. With a module before 0.51.0, companions show while on the active scene; a
  linked NPC its player owns shows always.
- Damage on its own from a spell an item casts, such as a wand's Magic Missile, isn't offered: Cast
  it for its damage.
- Damage on its own never spends the action itself, and with Spend off it counts nothing.
- Damage rolled with no attack asks whether to spend its spell slot, uses or charges only with
  "Damage on its own" on (in the cog; off on each device until it's turned on). Off, a spell's,
  potion's or feature's damage or healing chip that the game uses casts or uses it in Foundry,
  spending as a use does, without asking; an attack's damage is rolled in the app alone. On, a save
  spell's damage chip rolls its damage only: cast it with its save chip or Use.
- Damage on its own's Spend switch calls a charge or a potion "a use of" its row, such as "Spend a
  use of Potion of Healing", where "a charge of" the item, or "a Potion of Healing", would read
  better (polish).
- Damage whose request was lost (the module's answer never came) isn't offered again from the app,
  so it's never rolled twice: the Gamemaster rolls it in Foundry.
- Undo takes a turn back only from the app that ended it, for a few seconds, while Foundry's
  tracker is where it left it; what happened as the turn changed stays done (uses recovered, a
  recharge rolled, effects that ended with the turn, Midi-QOL's saves and damage over time,
  initiative Midi-QOL rerolled at a new round), and so does whatever the next to act did meanwhile.
- Undo isn't offered when the next to act is hidden from players.
- Notes deleted or reordered in Foundry while no Gamemaster is connected don't move the journal's
  "Last changed by" line.
- A favorite added from the app goes last; with a module before 0.47.0, favorites are put in order
  in Foundry only.
- Skills, tools and spell slots are made favorites, and removed, in Foundry: the app only puts them
  in order. No plan to change that unless it's asked for.
- Spell slots are spent and restored from the app one at a time: several are several taps, each
  asked first.
- A spell slot's dots can be tapped on the Spells tab and on a spell-slots favorite only: the
  Actions tab's spell-level headings show the count, and a tap there opens or closes the level; a
  companion's sheet, a pool of more than nine slots and a pool a module adds under a key of its own
  show the count only.
- Spell slots can't be changed from the app while Send to the table is off on that device, with a
  module before 0.42.1, where the Gamemaster doesn't let players attack and cast from the app, or
  while the character is in Wild Shape: the slots wait, as the Spells tab's note says.
- A spell slot is spent or restored from the app only from the count its dots showed: where Foundry
  changed it meanwhile, it's refused ("the slots changed in Foundry; look again"). The confirm shows
  the counts as the dots showed them when it opened.
- Nothing stops a character preparing more spells than a class may, as Foundry's own menu doesn't:
  the count then reads past the limit, such as "Prepared 7 / 6", as Foundry's sheet does. A class
  that counts none, such as a 2014 Sorcerer's, shows no count.
- On the Actions tab a spell's menu offers Unprepare only, as the tab lists only spells that can be
  cast: a spell is prepared on the Spells tab or among the favorites. One unprepared on the Actions
  tab leaves it with the next sheet.
- Cantrips, always-prepared spells, spells cast at will, innately or as rituals, and spells an item
  casts aren't prepared or unprepared from the app.
- Spells are prepared and unprepared from the player's own sheet only, with module 0.42.1, where
  the Gamemaster has players' rolls and Attacks, spells and features on and the dice check has
  passed: never from the Gamemaster's page or a companion's sheet, nor while the character is in
  Wild Shape. Where any of these is missing the menu simply lacks Prepare and Unprepare, with no
  word why.
- Spells are prepared from the app only while the Gamemaster has the game open in Foundry, as every
  roll from the app is made there: between sessions they're changed in Foundry.
- Only spells already on the character's sheet are prepared from the app. dnd5e keeps no class
  spell list on the character: a cleric's, druid's or paladin's whole list, or a spell a wizard has
  just copied into the book, is added in Foundry first, and "Always prepared" stays a setting there.
  A wizard's book works as it is. A 2014 domain spell added by hand comes in not prepared, is
  offered Prepare, and counts toward the cleric's prepared spells once prepared.
- After Prepare or Unprepare, where the next sheet draws the spell's row anew (a utility spell such
  as Bless, a favorite that turns from a spell's row to an action's, or a spell unprepared on the
  Actions tab, which leaves it), keyboard focus goes to the page, as after Remove from favorites
  among the favorites.
- Dishes from the Magical Recipe Book need dnd5e 5 for now (dnd5e 6 is planned for v2.0).
- A dish's effect ends with world time: a table that never advances time keeps it until the next
  dish replaces it or the Gamemaster deletes it.
- Players change only the effects their party put on their own character and their items' temporary
  ones: never a monster's, one made on the sheet, a condition, a concentration (End ends that) or a
  companion's.
- A dish's card is whispered to the campaign's players as it's posted: a player who joins later
  doesn't see earlier ones.
- The campaign page says what was so when it loaded; reload it for the latest. Kept as is unless
  it's asked for.
- A party sheet has no Report a bug or Request a feature link. Kept as is unless it's asked for.
- Only the 2024 Wild Shape is used from the app: a 2014 druid's Wild Shape is used in Foundry, and
  the app follows the form. Kept as is.
- What a druid begins in Wild Shape isn't carried back: a spell cast as a beast and concentrated on
  ends with the form, as does an effect of the form's own features, and anything on the form's
  items. Effects others put on the form are kept on the character, and those taken off it, or run
  out on it, are taken off the character; one the character already had that is only changed on the
  form stays as it was, as does one that had already run out before Wild Shape. A status effect that
  is no condition, such as Sleeping, Dodging, Hiding or Marked, is neither kept nor taken off: one
  put on the form ends with it, and the character's own stay as they were.
- Bonus Actions are counted only under Midi-QOL's Enforce bonus actions, in a fight: elsewhere
  Change and Return say they take one. A return or an ending made in Foundry isn't counted, as
  Midi-QOL counts none.
- A dish served while a character is in Wild Shape goes on the character's own actor: its effect
  waits for the return; its healing, and any other change to the character's own hit points
  meanwhile, is kept on the return, added to what the form took.
- Uses spent by a module's consumption hooks, such as Midi-QOL's, aren't run for a change from the
  app, which spends the use itself.
- A known form put on a druid's Wild Shape in Foundry from outside the campaign's compendiums, or
  outside the rules, is listed by name and used only in Foundry, where dnd5e's own Allow
  Polymorphing and the source's permissions apply (from outside the compendiums: planned before
  v1.0, item 60).
- A session ended from outside the app, such as one deleted from the database or revoked through
  Better Auth's own endpoints, still reads the table, the party sheet and the journal, and still
  sends what the table sends the game (rolls, moves, hit points, coins and ending a turn among them)
  and notes, for up to a minute (`AUTH_CACHE_MAX_AGE`); joining, choosing, leaving or deleting a
  character and every change on the campaign page ask the database and are refused at once.
