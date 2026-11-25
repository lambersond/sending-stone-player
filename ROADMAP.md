# Roadmap

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). Each module version below
ships with the app deployed for it, the app first. The app has no version numbers of its own:
app-only work ships with its next deploy.

The further out a version is, the less settled it is, and that's expected: each one is planned in
full when work on it starts. Open questions stay with their version until then. Any version may
gain items from feedback or bugs. Done work moves to [CHANGELOG.md](CHANGELOG.md), under its
version.

Released: module v0.54.0 and its app, with v0.53.0, v0.52.0, v0.51.0, v0.50.0, v0.49.0, v0.48.0,
v0.47.0, v0.46.0, v0.45.0 and v0.44.0 before it.

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

## v0.51 (released, to check at the table)

Released on 2026-11-19: what it holds is in [CHANGELOG.md](CHANGELOG.md)'s v0.51.0 entry. v0.51 is
the release candidate for v1.0 after v0.50: it runs at the table for a while before v1.0 is tagged.

**To check at the table** (built and tested against stand-ins only), with dnd5e 5.3.3 and
Midi-QOL v14.0.x:

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

## v0.52 (released, to check at the table)

Released on 2026-11-19: what it holds is in [CHANGELOG.md](CHANGELOG.md)'s v0.52.0 entry. v0.52 is
the release candidate for v1.0 after v0.51: it runs at the table for a while before v1.0 is tagged.

**To check at the table** (built and tested against stand-ins only), with dnd5e 5.3.3 and
Midi-QOL v14.0.x:

- **Honor, Sanity and a world's own skill:** with Honor Ability Score and Sanity Ability Score
  turned on in dnd5e's settings, and a skill your world adds on Honor, such as Etiquette: on a
  player's sheet, an item whose text asks for a Sanity save, an Honor check, a Wisdom or Honor check
  and that skill shows each as a button named as dnd5e names it, Wisdom or Honor offering both, and
  each rolled from the app is made in Foundry and named so in the app's chat ("Sanity save"); a
  check activity on Sanity shows its chip and rolls; an item asking a DC 13 Sanity save shows
  "SAN 13"; the Gamemaster's request card for the skill, its DC hidden, reads "Gamemaster asks for
  an Honor (Etiquette) check", and a player's roll from its button in Foundry is made; and a
  companion the game asks for a Sanity save is named so in its character's notice. A description
  sent before the update shows its new buttons once the Gamemaster's Foundry has loaded with 0.52.0.
- **Eight abilities:** with Honor and Sanity on, a character's sheet lies its abilities four and
  four on a 390 phone, a save at Adv or Dis showing its shield, bonus and chip without the word
  Save, and four and four at 1024 and 1280 too; in Wild Shape, a druid's sheet marks as the form's
  an ability your world adds with no type, and not Honor; and under a transformation with Appearance
  it marks no tile.

## v0.53 (released, to check at the table)

Released on 2026-11-21: what it holds is in [CHANGELOG.md](CHANGELOG.md)'s v0.53.0 entry. v0.53 is
the release candidate for v1.0 after v0.52: it runs at the table for a while before v1.0 is tagged.

**To check at the table** (built and tested against stand-ins only), with dnd5e 5.3.3 and
Midi-QOL v14.0.x:

- **Midi-QOL's check of a cost, asked once:** with Manual Dice on for the Gamemaster and Midi-QOL
  set to consume the Gamemaster's resources without asking, a charm that spends 1d4 charges, used in
  Foundry, opens one Manual Dice window, not two; so does a reaction you take that spends 1d4, and
  Frost Brand's Rime, from Midi's card button too.
- **Reactions and Bonus Actions in an encounter you don't have up** (what stand-ins prove least:
  Midi-QOL's own marker there, which the module writes, is tried against a stand-in of Midi only):
  on two scenes, each with an encounter begun on it, you viewing one, and Midi-QOL's Enforce bonus
  actions on for all, a companion fighting in the other uses a Bonus Action from the app and gets
  Midi's marker; a second is refused, the app saying "Not made at the table: you’ve used your bonus
  action"; and at its next turn there the marker goes. In the console,
  `game.actors.getName('Bat').inCombat` is `false` while you view the other encounter; and for a
  druid in Wild Shape in the one you view, `game.combat.getCombatantsByActor(form).length` says
  which core matches her combatant to: 1 for her form, 0 for her.
- **A favorite moved to the other list:** on a laptop where the favorites lie in two lists (1366 px,
  Actions), Move down from the keyboard on the first list's last favorite puts it first in the
  second, with focus on it, and one open to its description stays open as it moves; with the mouse
  or a touch it moves and stays open the same, and the page follows it if its new place was out of
  sight. On a phone (390 px), a favorite open to its description is still open after Reorder is
  opened and cancelled.
- **Two lists after Reorder:** on that laptop, open Reorder and close it, by Cancel and by Save
  order: the favorites are in two lists again, and follow the window's width.
- **The header as a page loads:** on a phone, in its browser, as a sheet loads, Live and Help hold
  still while Full screen appears in the room kept for it; in Sending Stone added to an iPhone's
  Home Screen, which has no Full screen, the room closes as the page is ready, so Live and Help step
  right once, and stay there.

## v0.54 (released, to check at the table)

Released on 2026-11-24: what it holds is in [CHANGELOG.md](CHANGELOG.md)'s v0.54.0 entry. v0.54 is
the release candidate for v1.0 after v0.53: it runs at the table for a while before v1.0 is tagged.

**To check at the table** (built and tested against stand-ins only), with dnd5e 5.3.3 (and 6.0.5
where a check says so) and Midi-QOL v14.0.x:

- **Constant companions:** in Foundry, drag a Steel Defender (a linked world NPC that a Summon
  activity of Thorin's own summons, as dnd5e has no artificer) from the Actors sidebar onto Thorin's
  box on the campaign's Companions tab and save: it shows in the app last among Thorin's tabs, with
  its pin and dashed ring; summon it with Thorin's feature and the same tab's ring goes solid within
  a few seconds, by the page's next read; dismiss it and it's dashed again.
- **Known forms from anywhere, at each of Foundry's gates:** with Wild Shape from the app on, put on
  a 2024 druid's Wild Shape in Foundry, its Mode set to By Direct Link, a Beast within the rules
  from one of the world's actors and one from an Actor compendium the campaign's Beasts don't come
  from. With every gate open, the app offers each with its numbers, and the druid changes into one
  and back: the druid owned by her player, not only assigned; the form shared with them, Observer on
  the world actor or on the compendium in Foundry's compendium settings; dnd5e's Allow
  Transformation on; and Create New Actors for their role. Close each gate in turn and the form's
  card says which: "Not your character in Foundry", "Not shared in Foundry", "Transformation is off
  in Foundry" or "Needs Create New Actors in Foundry", and the player, in their own Foundry, can't
  make that change either; open it again and it's offered.
- **A summoning's choice, chosen beforehand in dnd5e's dialog** (what stand-ins prove least: the
  module sets the player's choice on dnd5e's dialog in Foundry's `preRenderSummonUsageDialog` hook,
  which counts on Foundry 14 drawing the dialog's parts after that hook, as the stand-in draws
  them), under dnd5e 5.3.3 and again under 6.0.5, with Midi-QOL and without: cast the 2014 Find
  Familiar (Spells (SRD); the 2024 one has a single "CR 0 Beast") from the app as the Owl, Fey; as
  the Gamemaster, click its card's Summon button: dnd5e's dialog opens once, with the Owl and Fey
  chosen in its very first draw (never dnd5e's own first, Bat with an empty Creature Type or Bat and
  Celestial), and you can change them; Summon places the Owl, which shows as the character's
  companion. In the console, that dialog among `foundry.applications.instances` has a
  `config.summons` that agrees with its form's `summons.profile` and `summons.creatureType`. Summon
  Beast (the Player's Handbook's, as dnd5e's own compendiums seem to hold none) cast above its level
  as Air, and a warlock's free casting of it as Air at her pact slots' level, open with Air chosen;
  the 2014 Conjure Animals cast at the 5th as "4 × Challenge Rating of 1 or lower" opens with that
  chosen, then dnd5e's compendium browser; and a summon activity given a choice of Medium or Large,
  cast Large, opens with Large chosen. A card cast in Foundry with Place Summons unticked, or the
  same activity used by hand there after a click on such a card, opens with dnd5e's own defaults.
  With Midi-QOL, the card's "Chosen on Sending Stone: Owl (Fey)" line sits on Midi's card, perhaps
  at its end, and its Summon button chooses the same. If that dialog's `config.summons` holds the
  choice while its form shows dnd5e's defaults, Foundry draws the dialog's parts before that hook,
  and the fix is to draw it again from its render hook.

## Before v1.0

All the work planned before v1.0, by number, kept under where each item came from. The owner's
plan of 2026-11-13 takes it in batches, in this order; feedback from the table, bugs found and
tweaks needed may change it as it goes. Batches 1 to 6, 8 and 9 are done; 7 moved to v1.x.

1. Item 24, the module's import cycle: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.48.0.
2. Items 23, 29, 47, 41, 42, 57, 56, 70, 71, 67 and 68, Midi-QOL's reaction checks, effects carried
   back from Wild Shape, Move up and Move down for every favorite, the three e2e races under load,
   the stone as the installed app opens, two more e2e checks under load, and coins added, taken away
   and handed out from the sheet: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.49.0.
3. Items 18, 36 and 91, companions and sidekicks wherever they are, two encounters at once, and Give
   to parties and characters alike: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.51.0.
4. Items 61, 62, 58 and 89, quieter polling, fewer sign-in reads, non-allies' health, and one Give
   and Add or remove for a character's coins: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.50.0.
5. Items 64, 65 and 66, any ability or skill the game has, named as the game names it, checks on any
   ability, and eight abilities laid out: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.52.0.
6. Items 59, 60 and 98, summon activities, known forms from anywhere and constant companions: done,
   in [CHANGELOG.md](CHANGELOG.md)'s v0.54.0.
7. Item 63, offline mode: moved back to v1.x on 2026-11-25, on the owner's word, to come after v1.0
   (v1.x's item 3).
8. Items 72, 83, 84, 92, 93 and 97, the module's fixes; 75, 82 and 96, the app's looks; and 73, 74
   and 85, keyboard and focus: done, in [CHANGELOG.md](CHANGELOG.md)'s v0.53.0.
9. Off Prisma Accelerate, retired on 2026-12-01, onto the database's pooler, before 7: done, in
   [CHANGELOG.md](CHANGELOG.md)'s v0.55.0-rc.

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
[CHANGELOG.md](CHANGELOG.md)'s v0.51.0.

**Found while building Batch 2**

Items 72 to 75, Midi-QOL's check of a Gamemaster's own use asking for its dice twice, a roll's
button dropping the first Enter after its menu was opened from the keyboard, keyboard focus after a
favorite moves from one list to the other, and the favorites in one list once Reorder has been
opened, are done, in [CHANGELOG.md](CHANGELOG.md)'s v0.53.0.

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
80. **e2e checks of the same kinds as items 41, 42 and 70, one of them seen to fail:** (a) a menu's
    or popover's focus read the moment it shows, where floating-ui gives it focus a frame later:
    `removals-e2e.mjs:354` (part 2, Shift+F10), `favoriting-e2e.mjs:598` and `:615` ("Add to
    favorites" focused, by Shift+F10 and by the context-menu key), `givetake-e2e.mjs:401` and, to be
    checked, `phone-e2e.mjs:322`. Each has a round trip or two between the menu showing and the
    look, which has been enough but once: removals' failed so in v0.55's full e2e pass, focus still
    on the Potion's name, and passed when run again alone. `focusInside` (`e2e/world-030.mjs`) is
    the wait. (b) A step that must land inside the page's own 600 ms: endturn part 20, "a tap on End
    turn … (within 600 ms)". (c) Full screen read before the page has hydrated, where it is drawn
    only once it has (its room is kept, empty, until then, item 82, so the header no longer moves):
    to be checked, `phone-e2e.mjs:363`, which reads Full screen's size after several looks at a page
    `goto()` loaded, which has been enough so far; help's `ready` (`e2e/help-e2e.mjs`) is the wait.
    The party suite reads its header (`party-e2e.mjs:213`, `:505`) after a link within the app or a
    wait for "Reconnecting", which only a page that has hydrated shows. Item 57's kind has none
    left: `stopFetching({ age })` waits, and so do notesoffline's four closings by the Gamemaster
    leaving. Nor has item 71's, a photograph read for its colors, which is toasts' alone. In no
    batch yet.
81. **What the launch page leaves to the phones:** to settle once the stone has been seen on an
    Android phone and an iPhone (v0.49's checks): the stone's size against Android's own launch
    screen (144 px now; larger also means the 512 px image, a page of about 356 KB, and two pinned
    sizes); an iPhone's white first screen before the stone, which only a startup image for each
    screen size covers; and, if an iPhone doesn't finish installing a worker whose page leaves at
    once, waiting up to a second for it on an opening that has none. An opening connected but unable
    to reach Sending Stone still ends on the phone's own error page, which is offline mode's (v1.x's
    item 3). Left by item 56. In no batch yet.

Items 82 to 85, the header's Help moving as a sheet hydrates, a spell prepared's check, coins moved
or distributed keeping their fractions, and keyboard focus after a move is sent from a character's
sheet, are done, in [CHANGELOG.md](CHANGELOG.md)'s v0.53.0.

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

Items 59 and 60, summon activities used from the app and known forms from anywhere, are done, in
[CHANGELOG.md](CHANGELOG.md)'s v0.54.0.

Items 61 and 62, quieter polling and fewer sign-in reads, are done, in
[CHANGELOG.md](CHANGELOG.md)'s v0.50.0.

Item 63, offline mode, moved back to v1.x on 2026-11-25, as its item 3.

Items 64, 65 and 66, any ability or skill the game has, named as the game names it, checks on any
ability, and eight abilities laid out, are done, in [CHANGELOG.md](CHANGELOG.md)'s v0.52.0.

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
same), is done, in [CHANGELOG.md](CHANGELOG.md)'s v0.51.0.

**Found while building Batch 3**

Items 92 and 93, Midi-QOL's checks in an encounter the Gamemaster doesn't have up and a Gamemaster's
message past the twentieth, are done, in [CHANGELOG.md](CHANGELOG.md)'s v0.53.0.

94. **The module harness's wait for a druid's copy made late, under load:**
    `test/fvtt/wildshape.mjs` (line 1171), under `MIDI=1`, "her copy made too late: Rowan's
    concentration gone, and nothing of it left on her", turns the wolf back into Elowen with the
    copy of an effect Rowan concentrates on held back eight turns (`port.faults.slowEffects = 8`),
    then waits a fixed 160 ms (`settle(160)`) for the bridge to sweep the copy off her. It found the
    copy still on her once (`[false, 1]`, where it wants `[false, 0]`; 16 of 33), in the companions
    landing's full harness, run beside that landing's e2e on three lanes, a load average near 6 on
    four cores, and passed when the full harness ran again at once on the same head (122 of 122),
    and alone three times (33 of 33 each). Neither the check nor the module's Wild Shape scripts
    have changed since v0.50.0. Of a kind with item 90. The check could wait until the sweep has
    run, or allow more than its 160 ms. Found landing item 18. In no batch yet.

**Found in Batch 3's last checks**

95. **The companions e2e near its time limit, under load:** `e2e/companions-e2e.mjs`'s three long
    runs (plain, `MIDI=1` and `DND5E6=1`) are given `e2e/regress.sh`'s usual 400 s. Passing on a
    lane beside two others, they took 333 to 345 s in batch 3, against 293 to 303 s in batch 4's
    full e2e pass: item 18's parts for companions on another scene added 8 checks and about 40 s to
    each. In batch 3's full e2e pass, three lanes up on four cores, the `DND5E6=1` run was stopped
    at 400 s in part 15, at 132 of its 146 checks with none failed, and passed when rerun alone on
    its lane at once (146 of 146 in 323 s). Of a kind with items 90 and 94. The runs could be given
    `TIMEOUT=600`, as `typed`'s and `notesoffline`'s are, or the suite split in two. Found in batch
    3's last checks. In no batch yet.

**Found while building Batch 5**

Items 96 and 97, "an" before a "u" that sounds like "you" and a world's own tools in a description's
hash, are done, in [CHANGELOG.md](CHANGELOG.md)'s v0.53.0.

**Asked for on 2026-11-20**

Item 98, constant companions, is done, in [CHANGELOG.md](CHANGELOG.md)'s v0.54.0.

**Found while building Batch 8**

99. **The checks of commands that aren't rolls let other kinds' fields by:** `prepare`, `hitPoints`
    and `coins`, whose own words say they name nothing else, let a roll's `use`, `types`,
    `modifiers`, `critical`, `combatId`, `denomination`, `hitDice`, `attackMode`, `ammunition` and
    `consume`, and a dice answer's `diceAsk`, by. The older checks refuse only the kinds that came
    before them: `effect`, `wildShape`, `favorite` and `remove` let most later kinds' fields by.
    `spellSlot`, `inspiration`, `endConcentration` and `spend` call only `namesRollFields` and let
    nearly every field by. The module makes the command and ignores them (the module's
    `scripts/command-rolls.mjs`, each `check<Kind>Command` and its list of other kinds' fields; hit
    points' in `scripts/command-checks.mjs`). The app's request schemas refuse every one first, so
    no player meets it. Found planning item 83. In no batch yet.
100. **A description's hash misses labels changed in place:** a description's hash holds the keys of
     the game's abilities, skills, tools, kinds of vehicle, and damage and healing types
     (`textFormat`, the module's `scripts/sheet-texts.mjs`), never their labels. So a module that
     renames an ability, skill or damage type in place moves which plain English text is a link and
     renumbers every later link under the same hash. A condition type added or renamed changes which
     text is a condition, though no number moves: condition spans carry no `data-n`. Found planning
     item 97. In no batch yet.
101. **Midi-QOL's Requires targets "in combat" with two encounters on one scene:** Midi reads a
     creature as in combat, for its Requires targets setting, by any encounter on the scene the
     Gamemaster's canvas shows (its `isInCombat`), and the module by Foundry's `Actor#inCombat`, the
     encounter the Gamemaster has up alone (`midiNeedsTargets`, the module's
     `scripts/command-uses.mjs`). So with two encounters on one scene, a creature in the one not up
     that uses from the app something needing a target, with none picked, isn't refused beforehand
     ("target"): Midi refuses it, and the player is told Midi-QOL didn't make it ("midi") rather
     than why. Read from Midi's source, not tried. Found planning item 92. In no batch yet.
102. **The module's "a" or "an":** Wild Shape's lines in Foundry's chat ("… uses Wild Shape and
     becomes {aForm}.", "… is no longer {aForm}: Wild Shape ends.") put "an" before every vowel and
     "a" before everything else (`articled`, the module's `scripts/command-wildshape.mjs`), so a
     world's Unicorn form reads "becomes an Unicorn", and one named for Honor "a Honor". The app's
     rule (`articleOf`, `src/utils/articles.ts`) could be the module's too. Module only, small.
     Found building item 96. In no batch yet.
103. **Move up and Move down on a favorite inside another:** a favorite open to its description
     lists rows of its own, such as an item's other activities or what a container holds. One of
     those that is a favorite too offers Move up and Move down in its menu there, and moves that
     favorite among the favorites: `FavoritesList`
     (`src/features/sheet/components/favorites/favorites-list.tsx`) gives `FavoriteMovesContext`
     around every row it draws, the rows inside a favorite's description among them, and
     `useFavoriteChoice` (`src/features/sheet/components/favoriting/use-favorite-choice.ts`) reads
     it for any row under it. Read from the code, not tried. Found planning items 74 and 75. In no
     batch yet.
104. **A move's toast over the favorite that just took focus:** where the favorites lie in two lists
     (1366 px, Actions), Move down on the first list's last favorite puts it first in the second, at
     the top of their card, with focus on it, and the move's toast ("Longsword" over "Order saved")
     shows over that very place: the favorite's name is hidden under it, its focus ring showing only
     at its edges, for as long as the toast shows. The same where the sheet scrolls a moved favorite
     into sight: it comes to the top, under the toast. The toasts are centered at the top of the
     window (`RollToasts`, `src/features/rolling/components/roll-toasts/roll-toasts.tsx`), which at
     that width is the top of the second list; their place predates batch 8, and item 74 is what now
     puts focus there. Found reviewing item 74. In no batch yet.

**Asked for on 2026-11-25**

105. **The quick wins, fewer database calls without a new service:** the owner's figure is 400k to
     1M Prisma Postgres operations for a 4-hour session of six. Today's code, measured live against
     the stand-in Foundry with the real module and projected to 4 hours, makes 207k Prisma calls
     light and 337k to 367k heavy (five players' tables and the Gamemaster's seat page open all
     session, a party sheet for an hour; light is 20 rolls a player and one group request an hour,
     heavy 120 and 10). Of those, about 177k at either profile are asking for news while nothing
     happens: 77k is the module's wait for commands, held open by the app while it checks the
     database every second, and 99k the pages' polls that find nothing new. Real play, with about
     one more change a roll (attack and damage cards, uses spent), combat, more follow reads, and at
     heavy extra phones, long waits and presence marks from several running copies of the app, is
     estimated at about 245k light and 415k to 580k heavy. The owner's figures fit code from before
     v0.48, whose real play projects to about 370k light and 540k to 740k heavy. Before this is
     planned, the owner baselines a real session at the table on Friday 2026-11-27: the Prisma
     console's count for it against its projection. That can also settle whether Prisma bills SQL
     statements (about 1.29 a Prisma call, measured) or Prisma calls, but only if the app deployed
     that day is on the database's pooler (v0.55.0-rc; through Accelerate a Prisma call is one
     operation) and counts its own calls, which it doesn't today; without that count, Friday may
     only narrow it. The changes take light from 207k to 68k, and heavy from 337k (367k at most) to
     165k (187k at most), projected; in real play about 100k light and 233k heavy, the heavy figure
     before extra phones and long waits. Each change below gives its saving on top of those before
     it (light / heavy, projected), then its cost to players:
     - The session cookie cache at 15 minutes, not 60 s (`AUTH_CACHE_MAX_AGE=900`, an environment
       variable read in `src/auth-session.ts`): 2.8k / 2.8k; a session ended elsewhere still reads
       pages for up to 15 minutes, loosening v0.50's sign-in checks (owner's call).
     - The module's wait checking the database in one SQL statement (`claimAll` and
       `holdForCommands`, `src/app/api/bridge/commands/route.ts`): 60.7k / 62.2k; none to players,
       but the statement must skip commands this game can't take, or while one waits (up to 30 s)
       every check costs what it does today.
     - That check every 2 s, not every second (`COMMANDS_CHECK_EVERY`, now 1000 ms, in
       `src/constants/sending-stone.ts`): 7.2k / 7.2k; a roll reaches Foundry half a second later
       on average, a second at worst.
     - The module's secret check remembered 60 s by each running copy of the app
       (`findEventCampaign`, `src/db/campaigns.ts`): 2.3k / 8.5k; a changed secret still works for
       up to 60 s.
     - The module's heartbeat every 5 minutes, not 30 s, while the game is fetching, gated on the
       app's `features` (`HEARTBEAT_AFTER`, the module's `scripts/heartbeat.mjs`): 0.5k / 0.5k; an
       app deployed mid-session is noticed within 5 minutes, not 30 s.
     - Table status and the Gamemaster's recent rolls in one SQL statement (`getCampaignStatus`,
       `src/db/table.ts`): 24.0k / 24.0k; none.
     - The seat remembered 60 s by each running copy (`getPlayerSeat` and `getGmSeat`,
       `src/db/seats.ts`): 27.8k / 31.7k; a removed player still sees the table for up to 60 s
       (owner's call), and another device's typed-dice switch and chat-read mark show up to 60 s
       late.
     - The page's open mark and the players' present mark written less often (`TABLE_SEEN_EVERY`
       from 5 s to 30 s, `OPEN_WITHIN` from 15 s to 75 s and `PLAYERS_SEEN_EVERY` from 30 s to 60 s,
       in `src/constants/sending-stone.ts`), and the table marked closed as the page closes
       (`pagehide`): 9.4k / 9.4k; Midi-QOL's saves and the dice asked of a player typing theirs
       wait up to their full 60 s (`MIDI_PROMPT_WAIT`, the module's `scripts/midi-prompts.mjs`;
       `DICE_ASK_WAIT`, `scripts/later-dice.mjs`), not about 15, for a page closed without that
       mark.
     - The chat-read mark (`markChatReadUpTo`, `src/app/characters/actions.ts`) on the cookie cache
       and written at most every 15 s a page: 3.6k / 22.6k; another device's unread count lags up
       to 15 s, and the mark leaves v0.50's rule that every Server Action checks the session
       against the database (`requireCheckedUser`, `src/lib/session.ts`; owner's call).
     - The 24-hour prune of a seat's rows every 10 minutes, not on every send (`holdCommand`,
       `src/db/commands.ts`): 0.4k / 2.6k; none.
     - A followed roll, checked every second (`follow`, `src/utils/lifecycle.ts`), backing off to
       every 2 s after 5 s and every 5 s after 30 s: nothing at either profile but about 7k in heavy
       real play; a roll that waits long shows its result up to 5 s late.
     - The party poll reading the group's access once (`access`, `src/db/party.ts`, now read by
       `getPartyStatus` and `getGroupView`): 0.1k / 0.5k; none.
     - The companion and notes panes each read in one statement with the seat remembered, and the
       recipe card checking for a change before it reads its view (`getCompanionStatus`,
       `src/db/companions.ts`; `notesResponse`, `src/lib/routes/notes-routes.ts`;
       `cookbookViewResponse`, `src/lib/routes/cookbook-routes.ts`): from about 82 calls a minute
       open (measured), 62 and 16 (read from the code), to a projected 22, 22 and 4, outside the
       profiles; none.
     - Card edits that change nothing the app shows: making a use or an attack, and then rolling its
       damage, each set a flag on its card (`storeUse` and `runDamageCommand`, the module's
       `scripts/command-uses.mjs`), sent as `chat.message.updated` (`onUpdateMessage`,
       `scripts/chat.mjs`) though the message sent reads neither flag, and each bumps the
       campaign's version (`applyCampaignEvent`, `src/db/campaign-events.ts`), so every open page
       reads its table again: about 45 calls an edit in all today. The module could leave them out,
       or the app skip the bump for a message equal to the one it holds (`changeMessage`, the same
       file) with no module release. Not measured: the rolls measured were saves, which edit no
       card. Read from the code, not tried.

     Raw SQL beside Prisma for the two single statements is the owner's call too. About one to two
     weeks, in the app alone but for the heartbeat and a module-side cure for card edits, each with
     its `PROTOCOL.md` entry, in a later module release. Item 106 comes after it. In no batch yet.

106. **Ably, changes pushed to the pages and the module instead of polled:** the app publishes each
     change to Ably after its database write, rendered for each seat on a channel only that seat's
     token may open, and the pages and the module are told instead of asking. Ably's presence (its
     list of who is connected) replaces the "seen" writes and the heartbeats' writes, though
     heartbeats are still sent for the app's features. An older module or app goes on polling.
     Projected, light / heavy: stage A, Ably for changes and presence with the writes as today, 10k
     to 14k / 46k to 61k; stage B, with leaner writes, 5k to 7k / 22k to 29k; stage C, with each
     roll as one read and one write and its result and chat line in one batch, 4k to 5k / 13k to
     19k. Each range runs from a session of saves alone, the profile the stand-in drove, to the
     real-play estimate. These count Prisma calls: if Prisma bills statements (item 105's baseline),
     stage A is about 1.3 times as much, and stage C built the plain Prisma way about 28k to 31k at
     heavy. Under 25k a session at heavy in real play needs stage C, though stage B with item 105's
     card-edit change comes near it; under 12k at heavy is not robust with any transport, as the
     writes alone for 2,400 rolls come to about 10k. The design keeps these safeguards:
     - the database claim stays, as the module claims each pushed command by its id before making
       it, so two Gamemaster tabs never make one twice and a reload doesn't lose one still waiting;
     - publishes are retried, and each page checks its version every 2 minutes and on waking;
     - states that change with time (live or offline, a roll lost or expired) are worked out on the
       page;
     - a write a minute marks the module live, so the app's own checks never wait on Ably;
     - a fallback polls every 15 to 30 s, not every 3, and raises an alert;
     - who is who comes only from the client id the server puts on each token;
     - tokens are revocable, and revoked on leave, removal or a seat change;
     - the chat-read mark is written when the page hides or at most every 5 minutes, from a Route
       Handler on the cookie session, so another device's unread count lags up to 5 minutes.

     About six to ten weeks for stage A across both repositories, and a few weeks more for each of
     stages B and C (a rougher estimate): an Ably fake in both test harnesses first, then the pages
     in the app alone, then the module, with Ably's browser library vendored into it as a second
     script, which changes two rules in the module's `CLAUDE.md` (one entry, and nothing but
     `module.mjs` runs as a script loads), and additions to `PROTOCOL.md`. Ably Free is for trying
     it out; Pro is $29 a month billed yearly ($35 monthly), and a heavy session is an estimated 65k
     messages (81k with combat views pushed) of Free's 6M a month. Prisma Postgres Free is 200k
     operations a month, Starter $10 with 1M then $8 a million, and Pro $49 with 10M: today each
     weekly group needs Starter, and after stage C several groups fit Free. It comes after item 105,
     whose changes also make its polling fallback cheap; the roll and result writes as single
     statements come after it, and keep stage C near its figures if statements are billed. The
     owner's calls: the vendor and plan (not a hard-capped free plan for both the database and
     Ably); the module's rules; the chat-read sign-in change, like item 105's; and whether it comes
     before or after v1.0. Weighed and not taken: Vercel's Runtime Cache as a shared cache the pages
     read instead of the database, where two changes at once can overwrite each other, entries are
     dropped, and on Vercel's free Hobby plan it pauses at its limit, landing near Ably's figures
     without the push; and Cloudflare Durable Objects (one live copy of each campaign's table, held
     by Cloudflare), which would go lower (0.3k to 2k) but is the largest rewrite. In no batch yet.

107. **Guest access to another player's character:** the owner asks that a player who can't come at
     all can have another player run their character's sheet easily, without moving back and forth
     and without the Gamemaster taking it from its own player. The app can't today: a character is
     one player's (`@@unique([campaignId, actorId])` on `Character`, `prisma/schema.prisma`), and
     every sheet route finds a player's seat through their own `Character` (`getPlayerSeat`,
     `src/db/seats.ts`). A player takes one from the invite link (`joinCampaign`,
     `src/db/characters.ts`), where one another player has taken shows "Taken" and can't be chosen
     (`CharacterChooser`,
     `src/features/characters/components/character-chooser/character-chooser.tsx`), and the second
     of two choosing at once is told "Another player has just chosen that character"
     (`src/app/characters/actions.ts`). A player may already play several of a campaign's characters
     no one else has taken, each on its own page. The ways round it now are the Gamemaster removing
     the player (`removePlayer`, `src/db/campaigns.ts`) or the player removing their own
     (`deleteCharacter`, `src/db/characters.ts`); either deletes their `Character` with its rolls,
     its recipe-book link and its chat-read mark. The Gamemaster's seat reaches any character
     without taking it, but only the campaign's owner opens it (`getGmSeat`, `src/db/seats.ts`), its
     rolls are marked the Gamemaster's (`by: "gm"`), and it is refused a player's own kinds
     (`createCommand`, `src/db/commands.ts`), so a guest needs a player's seat. What a seat is shown
     privately is kept by the character, not the player: whispers (`readers`, `src/db/table.ts`),
     the Gamemaster's rolls shown to its player (`gmRollsOf`, the same file) and its journal
     (`@@unique([campaignId, kind, actorId])` on `JournalBook`), so a second seat on it would see
     them all unless that changes. A player's rolls carry no sender (`toCommand`,
     `src/utils/requests/commands.ts`), so Foundry would make a guest's as the character's own
     player. In Foundry the module takes a character's players from its ownership, else its assigned
     player (`characterPlayers`, the module's `scripts/characters.mjs`), which decides which seats a
     whisper reaches (`chatAudience`, `scripts/chat-data.mjs`) and gates such as a Wild Shape form's
     "Not your character in Foundry" (`foundryOnlyWhy`, `scripts/wild-shape.mjs`). So giving the
     guest Owner, Foundry's usual way to share a sheet, would also put every whisper to the guest on
     the absent player's page (`charactersSeenBy`, `scripts/characters.mjs`), list the guest's own
     companions as the absent character's (`companionsOf`, `scripts/creatures.mjs`) and give it the
     guest's party access (`accessFor`, `scripts/groups.mjs`). Its cards carry its assigned
     player's name, else its one owner's, else the Gamemaster's (`authorFor`,
     `scripts/command-rolls.mjs`), and who may type its dice looks to its assigned player first
     (`primaryPlayers`, `scripts/typed-dice.mjs`). Read from the code, not tried. The likely
     reading, for the owner to confirm: the guest plays the absent player's character beside their
     own from one page, on a tab as a companion is, and the absent player keeps their seat
     untouched. To settle before planning:
     - who grants it (the Gamemaster in the app, the module's settings window, or the absent
       player);
     - for how long (one session, until taken back, or to an end date);
     - what the guest may see that is the absent player's alone (whispers, the Gamemaster's rolls
       shown to that player, private notes or journal);
     - whether the guest has their own chat-read mark, typed-dice switch and mark that their page is
       open on that character, or shares the absent player's;
     - whose name Foundry's cards carry (the character's own player, the guest, or both);
     - whether Foundry's ownership checks should know the guest, as Wild Shape's would then need
       the guest's Create New Actors too, or go on treating every roll as the character's own
       player's;
     - whether a guest may hold several characters;
     - whether the absent player is told.

     Likely two to four weeks (an estimate), in the app, and in the module and `PROTOCOL.md` only if
     Foundry is to know the guest. In no batch yet.

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
3. **Offline mode** (item 63 before v1.0, moved back on 2026-11-25): the app keeps working on a
   device without a connection, such as a phone that loses signal at the table: a player's
   characters, their last-seen sheets, notes and journal kept on the device and readable offline,
   with what's out of date marked; notes written offline sent once the device is back online; and
   rolls, moves and anything else the game must answer refused plainly until then. Item 56's launch
   worker (`/launch-worker.js`) keeps to `/launch` and its one page; offline mode's worker is its
   own, for which `/sw.js` is left free. A fairly large update: what's kept on a device and for whom
   (cleared on sign-out, so a shared device keeps nothing), how long it's kept, and how a note
   changed both offline and in Foundry meanwhile is settled.

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
- Under dnd5e 6, in a world that shows a coin's decimals, dnd5e floors each coin to them as it reads
  the sheet, so a few amounts stored as written read a hundredth low, in Foundry and in the app:
  4.56 gp reads 4.55.
- A summon activity cast from the app places nothing: the Gamemaster places the creature in Foundry,
  from the Summon button on its card, and it shows as the character's companion once placed.
- A summoning by Challenge Rating, such as Conjure Animals, is cast from the app at the band the
  player picks; the Gamemaster picks its creatures in dnd5e's compendium browser as they place them.
- With Midi-QOL's Auto Remove Summoned Creature, a creature placed from a card's Summon button isn't
  removed as the concentration ends, as in Foundry.
- A creature a companion summons isn't listed as a companion.
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
- A constant companion that a summon makes as an unlinked creature, as a Steel Defender often is,
  has with no token on a scene the numbers of its actor in Foundry's Actors sidebar, not those its
  summon adds, and not its last token's hit points or spent uses. One summoned as a linked creature
  keeps dnd5e's linked copy's.
- With no token on a scene, a constant companion's attacks and spells go without a target, its
  initiative isn't rolled into a fight, and it isn't asked the saves a card asks of the tokens it
  targets; it's still asked its concentration saves, as Foundry's card asks the actor.
- A linked NPC its player owns, once marked a constant companion, is offered no targets while no
  token of it is on a scene; unmarked, it's offered its campaign's fight as before.
- A constant companion with tokens on several scenes uses one, on the active scene first; its other
  tokens show as companions of their own only where they would anyway.
- An NPC and dnd5e's copy of it for a summon, both marked for a character, are two constant
  companions: a token of the copy goes to the copy first, its linked token before any unlinked one,
  whatever the scene; the NPC takes a token of its own or an unlinked token of the copy, else shows
  without one; every linked token of a linked copy is that one copy.
- A mark of dnd5e's linked copy isn't shown in the app while a linked token of that copy is another
  constant companion's; its row on the Companions tab says whose that token is.
- Constant companions need Sending Stone 0.54.0 in Foundry, under D&D Fifth Edition.
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
- Where the favorites lie in two lists, a favorite with keyboard focus that goes to the other list
  for any reason but its own Move up or Move down leaves focus on the page: its move refused because
  Foundry's sheet changed meanwhile, an order made in Foundry or on another device, a favorite added
  or removed, or the window resized.
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
- A known form put on a druid's Wild Shape in Foundry from outside the campaign's compendiums is
  used from the app only where each of the druid's players could use it in Foundry: the druid
  theirs, the form shared with them, dnd5e's Allow Transformation on and the Create New Actors
  permission. One outside the rules, from anywhere, is used only in Foundry.
- Beasts are learned from the app only from the campaign's compendiums: a form from anywhere else is
  put on the druid's Wild Shape in Foundry.
- A session ended from outside the app, such as one deleted from the database or revoked through
  Better Auth's own endpoints, still reads the table, the party sheet and the journal, and still
  sends what the table sends the game (rolls, moves, hit points, coins and ending a turn among them)
  and notes, for up to a minute (`AUTH_CACHE_MAX_AGE`); joining, choosing, leaving or deleting a
  character and every change on the campaign page ask the database and are refused at once.
