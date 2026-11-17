# Roadmap

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). Each module version below
ships with the app deployed for it, the app first. The app has no version numbers of its own:
app-only work ships with its next deploy.

The further out a version is, the less settled it is, and that's expected: each one is planned in
full when work on it starts. Open questions stay with their version until then. Any version may
gain items from feedback or bugs. Done work moves to [CHANGELOG.md](CHANGELOG.md), under its
version.

Released: module v0.47.0 and its app, with v0.46.0, v0.45.0 and v0.44.0 before it.

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

## v0.48 (release candidate)

Being built: what it holds so far is in [CHANGELOG.md](CHANGELOG.md)'s v0.48.0-rc entry.

**To check at the table before module v0.48.0 is tagged** (built and tested against stand-ins only),
with dnd5e 5.3.3 and Midi-QOL v14.0.x:

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

## Before v1.0

All the work planned before v1.0, by number, kept under where each item came from. The owner's
plan of 2026-11-13 takes it in batches, in this order; feedback from the table, bugs found and
tweaks needed may change it as it goes. Next week aims at the first three.

1. Item 24, the module's import cycle: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.48.0-rc.
2. Items 56, 41, 42, 57, 67 and 68: the stone as the installed app opens, the three e2e races under
   load, and coins added, taken away and handed out from the sheet. Items 23, 29 and 47, Midi-QOL's
   reaction checks, effects carried back from Wild Shape, and Move up and Move down for every
   favorite: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.48.0-rc.
3. Items 18 and 36: companions and sidekicks wherever they are, and two encounters at once.
4. Items 61, 62 and 58: quieter polling, fewer sign-in reads, and non-allies' health.
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
    in three ways, none near the module's scripts (all 77 take 0.04 seconds), one with a fix tried
    and not taken. And it doesn't check two rules the module's `CLAUDE.md` keeps by review alone:
    state written in one script, and nothing run as a script loads outside `module.mjs`.
70. **e2e's help header check under load:** part 1 of `e2e/help-e2e.mjs`, plain, "the header's ?
    sits after Live and before Full screen", failed once under three lanes' load in the full e2e
    pass made for item 24, 2 seconds in, and passed alone (28 of 28): the header's buttons read
    status, Help and Delete Thorin, with no Full screen yet. The Full screen button is drawn only
    once the page has hydrated (`useFullscreen` answers false until then), and the check reads the
    header as soon as the sheet is ready; it should wait for the button. Of a kind with items 41,
    42 and 57, and in no batch yet.
71. **e2e's toasts colour check under load:** in `e2e/toasts-e2e.mjs`, plain, "on a tablet, dark,
    given up by the app, it pops up again … the bold card in the warning's colours" failed once,
    142 of 149, in the second full e2e pass made for item 24, and passed on its retry (149 of 149).
    The suite runs alone on its lane, but other work was running on the machine. The tint it read
    was darker than the card itself, where it wants it part of the way to the warning's colour.
    Likely, from the numbers and not proven: the check reads the toast's look as soon as its words
    are there, while it is still popping up; it could wait for the toast to settle. In no batch
    yet.

**Moved from the next slice**

18. **Companions and sidekicks wherever they are:** a companion or sidekick has its own tab and can
    be rolled with even when it isn't on its player's scene or level, with a warning that it isn't
    there. Today the module lists a linked NPC wherever its tokens are, but an unlinked token and a
    summoned creature only while they're visible on the active scene, and never looks at levels
    (`scripts/creatures.mjs`). The owner's answers: on which scenes a companion is found, "Ideally
    all of them, however if NPC sheets never get deleted it could pose an issue of too many.
    Perhaps this is a more complex feature than originally thought."; where its character is, C,
    the active scene only and no levels, "but this could conflict with the #3 answer's example"
    (item 36).

And from the owner's answers on item 19, later work too:

36. **A sidekick fighting without its character, and two encounters at once:** a sidekick in an
    encounter its character isn't in still brings that encounter to its campaign, as since module
    0.36.0 (0.45.0 keeps the rule). The Combat tab shows one encounter, the one `pickCombat` ranks
    first, under way first. The owner: "Yes, a sidekick could get into an encounter w/out the main
    character. This opens up other questions around how many active encounters should be able to be
    shown in the app. Example, if there is an encounter on scene A with all the characters and their
    sidekicks, and a second scene with one character's sidekick, which is in a different encounter,
    how would you depict the two encounters? Foundry definately supports multiple encounters."

**Found while building the next slice**

41. **e2e's removals focus race:** part 13 of `e2e/removals-e2e.mjs`, plain, "while its removal is
    on its way: … focus inside it", failed under three lanes' load in v0.45's full e2e pass and on
    its retry there, and passed alone (81 of 81): the row's context menu opened with the right
    items, but focus wasn't inside it just after the Remove dialog closed (`inside: false`). Most
    likely the menu's first focus loses a race with focus going back from the closed dialog, or with
    a re-render as the removal's waiting state arrives. The e2e README lists it among its known load
    races.
42. **e2e's endturn Undo under load:** part 3 of `e2e/endturn-e2e.mjs` with MIDI=1 failed in v0.45's
    full e2e pass, End turn offered 578 ms after the panel shows the turn where the check wants 590
    to 900 ms (the 600 ms arm), and passed on its retry: the arm's countdown starts before the
    page's MutationObserver records the heading's text, and under load the gap grows. The e2e
    README lists it among its known load races.

**Asked for while building v0.48**

56. **The stone lighting up as the installed app opens:** an installed app's first screen is drawn
    by the phone (Android builds it from the manifest; an iPhone shows its own), so it stays still.
    A small offline app shell, a service worker serving one cached launch page, could show the
    same stone, the same size, centred on the same dark background, lighting up the moment the app
    opens, until the first page takes over. Only the launch page is cached, never a signed-in page;
    a new release replaces it; tested on Android and iPhone home-screen apps.

**Found while building v0.48**

57. **e2e's notesoffline "the game closed" under load:** part 13 of `e2e/notesoffline-e2e.mjs`
    (`orderMeanwhile`) timed out once, 43 of 47, waiting 15 seconds for the game to read as closed
    after `stopFetching`, with the app on its lane slow to answer; it passed alone and in the full
    pass. Likely, from the code and not proven: a command poll the app had already taken in
    stamps `bridgePolledAt` after the suite ages it, and the notes API reads the game as live for
    45 seconds after a poll. The suite could wait for in-flight polls to settle before ageing, or
    age again once they have.

**Found while building Batch 2**

72. **Midi-QOL's check of a Gamemaster's own use asks for its dice twice:** where Midi spends what a
    use spends without its dialog, it works the cost out first and throws that away
    (`checkAutoConsume` in its `MidiActivityMixin.ts`), so a dice cost is rolled twice with the
    Gamemaster's dice settings, for a use they make in Foundry and for a reaction they take; and so
    is the cost of another activity Midi pairs with a Gamemaster's own attack
    (`checkOtherActivityConsumption`), read from its source and not tried. Midi's own, and said in
    the module's `PROTOCOL.md`; the module could roll the first with Foundry's computer dice, as it
    does for a use from the app and, since 0.48.0, for the reactions Midi looks for. In no batch
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
    before 0.48.0, and as item 29 was built: whether they should come back with the druid as
    conditions do is the owner's to say. In no batch yet.

**Moved from v1.x on 2026-11-13**

58. **Non-allies' health:** permission to show it in the app, with an optional setting to show the
    actual hit points (off by default, as it gives information away).
59. **Summon activities** used from the app.
60. **Known forms from anywhere:** a form put on a druid's Wild Shape in Foundry from outside the
    campaign's compendiums, such as another compendium or a world actor, used from the app too,
    where its player could use it in Foundry.
61. **Quieter polling:** if the Gamemaster isn't in Foundry and nobody is in the app, there's no
    need to poll constantly. Nothing polls while Foundry is closed, since Foundry does the asking,
    so the case to handle is Foundry open with nobody in the app; Foundry must still pick up notes
    made offline as it connects.
62. **Fewer sign-in reads:** every table and party sheet poll, once each 3 seconds, reads the
    player's session and user from the database: 2 of its 5 or 6 queries, about 13% of a session's
    (v0.44's measurement). Better Auth's session cookie cache would answer most polls from the
    signed cookie instead. The trade-off: a signed-out device or a revoked session keeps working
    until the cache expires, so its lifetime is chosen with that in mind.
63. **Offline mode:** the app keeps working on a device without a connection, such as a phone
    that loses signal at the table: a player's characters, their last-seen sheets, notes and
    journal kept on the device and readable offline, with what's out of date marked; notes
    written offline sent once the device is back online; and rolls, moves and anything else
    the game must answer refused plainly until then. It builds on item 56's app shell, a
    service worker. A fairly large update: what's kept on a device and for whom (cleared on
    sign-out, so a shared device keeps nothing), how long it's kept, and how a note changed
    both offline and in Foundry meanwhile is settled.
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

**Asked for on 2026-11-14**

67. **Coins added and taken away from the sheet:** a player adds coins to their character or takes
    them away, from the inventory's coins, without going to Foundry. The owner: "As a player
    character, I want to be able to add/remove coins from my inventory so that I do not need to
    go to the foundry to add/remove coins from my character", and as the Gamemaster, "for when a
    player goes to a store to buy or sell items, gets food/drink at the tavern, or performs at
    the tavern and earns some coin. I want to be able to just tell them to add/remove an amount,
    and they can do it." Today the app shows each coin and moves coins between a character and a
    party or another character (module 0.31.0's `transfer`), but nothing adds or removes them.
    It needs a new command the module answers by changing the character's coins, behind a
    feature it announces in its hello, and in the app an amount of each coin to add or take
    away. The owner's answers (2026-11-14): each change posts a chat line in Foundry, "Thorin
    paid 5 gp" or "Thorin received 5 gp"; taking more of a coin than the character holds breaks
    a larger coin by default, and a new module setting lets the Gamemaster forbid that, when
    such a change is refused; companions are left out, as none is known to carry coins.
68. **Coins handed out to the party from a character:** a player picks fellow characters and the
    amount each gets, and the app shows the total to be given before it's sent, then moves it
    from the player's own coins, refused where they haven't that much. The owner: "As a player
    character, I want to easily distribute coins to my fellow party members from my inventory so
    that I don't have to do math or weird workarounds. The scenario was that the player wanted to
    give 200 PP to each player by selecting the players and setting the coin amount each player
    should get. Text should display the total amount to be given." Today a character gives coins
    to one other character or a party at a time, and only a party's coin is shared among its
    characters, all of one coin split evenly (module 0.32.0's `among`). It needs the module to
    take a set amount each from a character to the characters picked, behind a feature in the
    hello, and the app's dialog to pick them and show the total as it's set ("600 PP in all").
    The owner's answers (2026-11-14): anyone in the campaign can be picked (once v1.x's inactive
    characters exist, not those); several coins can go at once, such as 200 PP and 50 GP each;
    and each character given coins is whispered how much they received and from whom. And
    (2026-11-14, later): the Gamemaster gets a message for the hand-out too, and a hand-out breaks
    a larger coin as item 67 does, under the same module setting.

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
- Summon activities are used in Foundry (planned for v1.x).
- A companion shared by several characters is asked a save card's save only where every one of
  their players can read the card.
- A Gamemaster's request for a save posted in chat asks the campaign's characters, not their
  companions.
- After the Gamemaster clears a campaign's chat in the app, a message posted in Foundry before the
  clear still shows if it reaches the app only after it, as it can when Foundry was out of touch.
- Whether a change to a message brings it back after a clear is told by Foundry's time for the
  message against the app's: where the Gamemaster's computer clock is well off, a message posted
  just before the clear can come back, or one posted just after it stay out.
- Companions show while on the active scene; a linked NPC its player owns shows always.
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
  Polymorphing and the source's permissions apply (from outside the compendiums: planned for v1.x).
