# Roadmap

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). Each version below ships as
one app release and one module release, the app deployed first.

The further out a version is, the less settled it is, and that's expected: each one is planned in
full when work on it starts. Open questions stay with their version until then. Any version may
gain items from feedback or bugs.

Released: module v0.42.1 and its app.

## v0.43

1. **Refactor (done in v0.43's PR):** the app's code laid out by feature under `src/features/`, each
   `.tsx` exporting one component, named types in `types.ts`, rules in utilities and behaviour in
   hooks; one request-kind table, one command pipeline on the server, one request lifecycle, one
   settle hook and one seat resolver; no import cycles or barrels; CLAUDE.md's rules enforced by the
   linter. No behaviour changed: the module and its protocol are untouched, and the bugs found are
   below, under v0.44.
2. **Supported versions (done in v0.44's PR):** a breakdown of which module versions each app
   version supports.

## v0.44 (release candidate)

From the table's first session with v0.42.1, after the refactor.

Done in v0.44's PRs:

- **Favorites on the Character tab:** a setting to show the favorites between skills and traits.
- **Larger icon buttons on tablets:** icon-only buttons grow above a small screen, and can shrink
  again where the screen is wide enough for their words.
- **Hit points from the app:** players set their own character's hit points and temporary hit
  points as numbers, its Wild Shape form's and its companions' too, for what the rolls don't do
  ("you fall through the floor and take 4 damage"), by a switch on the Player actions tab of the
  module's settings, on by default; a drop asks a concentration save, and no chat line is posted.
  The Hit points tile, and each companion's, opens an editor of the two.
- **Manual dice said in the dice dialog:** a "Manual Dice" chip in its header, that the die results
  are typed in.
- **A plain die roll:** a dice tray under the chat, for what the Gamemaster asks: dice of any of d4,
  d6, d8, d10, d12, d20 and d100 added and removed, several sizes at once, with a modifier and no
  advantage or disadvantage, made in the game where the rolls are on; its dice tumble over the
  whole character page.
- **The Gamemaster clears a campaign's chat:** including messages from the cookbook, whose whispers
  now stay.
- **The bugs the v0.43 refactor found,** fixed, and the favorites in one list until their card is
  720 pixels wide.

Left, in two batches. Pick from the list by number.

**Batch 1: what's left from the refactor, the fixes and the last two PRs**

1. **Rules out of the database modules (done):** `src/db/roll-requests.ts` still holds a roll's pure
   refusal rules (`rollGate`, `lacksFeature`, `combatOf`, `rollPayload`, `namesAloneChoices`,
   `companionRefusal`), `src/db/table.ts` the table view's parts (`viewerOf`, `gmRollParts`,
   `seatAllows`) and `src/db/notes.ts` the notes' view overlay; move them to `src/utils/`, where
   they can be tested without the database's mocks.
2. **Coverage (done):** `jest.config.ts` leaves `campaign-index.tsx` out of the coverage count.
3. **Test tooling (done):** a chapter line's test can race the clock, about once in 200 runs: its
   "just added" case reads the time twice (`note-lines.test.tsx`, and the same case in
   `chapter-pane.test.tsx`); the `@test-utils` path alias in `tsconfig.json` has no match in
   `jest.config.ts`, so a suite importing the kit by it fails in Jest only; and unicorn's
   `prefer-native-coercion-functions` autofix turns a type-guard filter into `.filter(Boolean)`,
   which no longer typechecks.
4. **The Beast list blames the game (done)** when its forms read is taken with no id to follow: no
   forms come back, and the list says the game failed (`use-table-rolls.ts`, `readWildShapeForms`).
5. **A hit die told as made that may not be (done):** in a one-at-a-time hit-dice run (a module
   before 0.20.0), a die taken with no id to follow counts as made when a later die is not.
6. **Focus left on End Turn (done):** after an End Turn taken with no id to follow, keyboard focus
   stays on the End Turn button when the panel moves to another of the seat's turns.
7. **The dice tray's accessibility (done):** keyboard focus kept when the last die of a size is
   removed (today it's lost with that chip); the formula announced as dice are added and removed;
   and the open tray's height capped by the chat pane, not the screen, on short landscape screens.
8. **e2e's known races (done),** written into `e2e/README.md`: transfers under dnd5e 6 ("the module
   fetches for moves with rolls off"), companions under dnd5e 6 (a broken portrait shown for two
   frames), toasts T7 (a toast pushed out by the three-toast cap pops back when the game answers
   late), and alone's Fire Breath recharge at 768 and its spell picker's first focus under dnd5e 6.
   Each has failed only under three lanes' load and passed alone.
9. **e2e coverage gaps (done):** runs against module 0.42.0 (`SKEW=042`); the dice tray at 768
   pixels, with the campaign's rolls turned off, and against an older module; and hit points under
   dnd5e 6 and Midi-QOL.
10. **Questions to settle (done)** (decisions, then any work they lead to):
    - a companion's refusals for its own-switch kinds: 409 or 422 (decided: all answer 409
      'unavailable'; done);
    - whether a list in the module's settings is cut to its limit before or after its malformed
      entries are dropped (the two readers differ) (decided: both drop what they can't read, then
      cut, in one shared helper; done);
    - where the turn's refusal line clears (decided: in both layouts it stays until the turn moves
      on or End Turn is pressed again; done);
    - "the seat's own turn" for an empty companion key (decided: one shared rule in all three
      places, an empty key meaning no companion, as End Turn has it; done);
    - the hand-written types that differ from their schemas (decided: each schema checked against
      its hand-written type, not derived from it, and those that differ corrected or explained;
      the three real mismatches found are fixed as bugs; done);
    - the double reads on the table, party and module polls (measured: while a table is open, the
      module's command wait makes about 636 queries a minute per campaign, half of the ~223,000 in
      a 3-hour session with four players; decided: the campaign read once per command check and
      the notes' old changes pruned once in 10 minutes, measured at 252 fewer queries a minute,
      40% of the command wait, and about 45,000 fewer in a session, 20%; the table and party
      double reads, about 3%, left as they are; done);
    - the overlapping route and table tests (decided: the notes routes' repeats trimmed, one table
      checking 401 and 404 for all 16 routes and each route's file keeping its wiring check, done;
      the other three overlaps trimmed when those areas next change);
    - the five `console.error` logs (decided: kept as they are; error tracking revisited after
      v1.0 if failures go unnoticed);
    - whether the favorites' resource and check rows should draw the sheet's own uses chips and
      row names, which would change their markup (decided: kept as they are; revisited if players
      ask for a Recharge button in Favorites).

**Batch 2, last: typed dice and Help**

11. **Typed dice for every roll an item makes:** when typing in dice, the dice an item rolls after
    its first roll (Ice Knife's 2d6 splash after its d10) are asked for too, not rolled by Foundry,
    as Foundry's Manual Dice does. One general way that follows whatever the item's workflow rolls,
    homebrew and custom ones included, never a handler per spell. (Still being built for module
    0.45.0, for dnd5e 5 and its Midi-QOL line; dnd5e 6 later. Not landed yet: v1.x item 8, built
    beside it, landed first. Decided: every roll of the item's run that the typed dice don't cover
    is paused and asked for, Midi-QOL's bonus damage of that item included (Sneak Attack, Hunter's
    Mark, homebrew); a die that explodes or is rerolled is asked for too, one at a time; after 60
    seconds the computer rolls, and the Gamemaster's Foundry shows the wait with a "Roll it now"
    button; the dice dialog opens by itself on the device the roll came from, a banner on the
    player's others; no new switch; a player rolling the app's 3D dice keeps Foundry's later dice.)
12. **Help:** a question mark at the top opens a side panel explaining how to roll (an attack, hit
    dice), what each long press offers (damage, attack and other rolls), the settings, how manual
    dice work (item 11 included), and that the Gamemaster applies short and long rests. (Planned;
    held for a prototype first.)

**Found in Batch 1's item 10 work**

13. **A chat line's roll label can name a function:** the table view looks up a message's ability
    and skill, and a sheet skill's id, in plain objects (`rollLabel` and `toTableSheet` in
    `src/utils/table-view.ts`), so a key every object inherits, such as `constructor`, is found,
    and the chat line reads "function Object() { [native code] } save". dnd5e only sends its own
    keys, so only a broken or hand-made message shows it; the lookup should check the key is the
    table's own, as the schemas' `abilityId` does.
14. **Clear said twice in the dice tray:** with dice and a modifier other than +0 in the tray,
    Clear is announced twice, "No dice" and then "+0": `@lambersond/3d-dice-core`'s tray reducer
    resets the modifier with the dice (its `clear`, in `dist/tray-reducer.js`), and the modifier's
    own live output speaks as well as the tray's formula. A clear should be said once, as
    `useDiceSaid` already keeps a modifier's step from being said twice.
15. **A notes test that depends on the tests' order:** recordNoteResult's "changes nothing for a
    result for an earlier hand-over, the change since moved on" (`src/db/note-sync.test.ts`)
    passes only while no earlier test has left `journalOrder.findUnique` finding an order, as the
    order results' tests do (Jest's `clearMocks` keeps what a mock returns), so under
    `--randomize` it fails. The test should say that no order has the id, as its name does.
16. **e2e's feedback race against module 0.42.0:** "and the app pills it 'Hit'" under Hide AC
    (`e2e/feedback-e2e.mjs`), one of the known load races in `e2e/README.md`, failed under three
    lanes' load in both of Batch 1's full passes, at the same check, and passed alone each time:
    not a one-off, so its wait should be looked at rather than left to the retry.

**After Batch 2: feedback from the table**

17. **Long names overflow:** a very long character name on the campaign page pushes the second
    pane to the right, squeezing its text until it overflows.
    - The same long text on a character's Biography tab, in the journal's container, pushes the
      rest around: buttons shrink instead of wrapping, leaving a lot of empty space.
18. **Companions and sidekicks wherever they are:** a companion or sidekick has its own tab and can
    be rolled with even when it isn't on its player's scene or level, with a warning that it isn't
    there. Today the module lists a linked NPC wherever its tokens are, but an unlinked token and a
    summoned creature only while they're visible on the active scene, and never looks at levels
    (`scripts/creatures.mjs`).
19. **Initiative only in an active combat:** no initiative order is shown when there's no active
    combat.
    - With two Sending Stone campaigns on one Foundry server, one campaign sees the other's combat
      and initiative even when none of its characters are in it. A campaign should get only the
      combats its characters are in (`PROTOCOL.md`, the hello's `combats`), so this is a bug to
      find.

**Found while planning Batch 2**

20. **The game's save and check prompts are never pruned:** `RollPrompt` rows are only found,
    updated and upserted (`src/db/table.ts`, `src/db/campaign-events.ts`,
    `src/db/roll-requests.ts`), never deleted, so a campaign keeps every prompt it was ever asked
    until the campaign itself is deleted. They should be pruned once answered or old, as the dishes
    and notes are.

**Found while building item 11 and the Tidy journal**

21. **The hello's order told wrongly (done, in module 0.45.0's `PROTOCOL.md`):** the module's
    `PROTOCOL.md`, after the hello's table, read as if each companion the hello lists followed the
    books in its `companion.updated`, but the module sends the companions before the books
    (`helloDelivered` in `scripts/character-sync.mjs` calls `companionsDelivered` before
    `sendBooks`). Nothing in the app depends on that order; the paragraph now says what the module
    does.
22. **A use's cost check asks the Gamemaster for dice:** before an item is used from the app, the
    module works out what the use would spend with dnd5e's `_prepareUsageUpdates` and throws the
    result away (`prepareUse` in `scripts/command-uses.mjs`, and twice in
    `scripts/command-alone.mjs` for damage on its own). A cost that is a dice formula, such as
    `1d4` charges, is rolled there with the Gamemaster's dice settings, so under Manual Dice Foundry
    asks the Gamemaster for a roll nobody uses, once per use from the app, typed or not; one that
    explodes, such as `1d4x`, asks again for each highest face typed. The check's rolls should be
    made without asking anyone (`allowInteractive: false`); item 11's later dice need the same, as
    a check made while another player's use waits for its own cost could otherwise take its place.

Then module v0.44.0 is tagged, and v0.44 is the release candidate for v1.0: it runs at the table
for a while before v1.0 is tagged.

## v1.0

The major release of the app and the module, once the v0.44 release candidate holds up, before
work starts on v1.x.

The module keeps its id, `sending-stone`, though its title changed in v0.37: Foundry keeps the
campaigns, their secrets and every flag under it, and installs follow its manifest URL.

## v1.x

1. **Critical hit options.** App criticals double only the dice; choices such as dnd5e's Critical
   Damage Modifiers or Midi-QOL's critical options could come back as a per-campaign setting.
2. **Non-allies' health:** permission to show it in the app, with an optional setting to show the
   actual hit points (off by default, as it gives information away).
3. **Summon activities** used from the app.
4. **Favorites reordered** from the app.
5. **Known forms from anywhere:** a form put on a druid's Wild Shape in Foundry from outside the
   campaign's compendiums, such as another compendium or a world actor, used from the app too,
   where its player could use it in Foundry.
6. **Effects carried back from Wild Shape:** effects put on or taken off the beast, such as a Bless
   cast on the wolf, kept on the character when Wild Shape ends, not only conditions and
   concentration.
7. **Quieter polling:** if the Gamemaster isn't in Foundry and nobody is in the app, there's no need
   to poll constantly. Nothing polls while Foundry is closed, since Foundry does the asking, so the
   case to handle is Foundry open with nobody in the app; Foundry must still pick up notes made
   offline as it connects.
8. **Tidy 5e Sheets' journal:** the character-specific journal notes Tidy 5e Sheets adds to a
   character, which aren't part of dnd5e's own character data (its
   [`documentJournal` flag](https://kgar.github.io/foundry-vtt-tidy-5e-sheets/classes/TidyFlags.html#documentjournal)),
   merged with the app's own journal. Tidy 5e Sheets is listed among the modules the app works
   with in the campaign's settings, as the others are. Where entries can be deconflicted by when
   each was created, the app shows a chip on the journal pages that come from Tidy 5e Sheets.
   (Done, module 0.45.0, for dnd5e 5 with Tidy 13, and for dnd5e 6 with Tidy 14, which keeps the
   same flags; tested against stand-ins, not yet at a table. Tidy keeps no times for its entries,
   so: read only in the app, edited in Foundry; shown side by side, in a "From Tidy 5e Sheets"
   section at the end of the character's journal, in Tidy's order, each with its chip and the date
   the app first saw it and last saw it change; the Classic sheet's five boxes too, chipped "Tidy
   5e Classic"; secrets left out where no player owns the character, as in the app's own journal;
   still shown, read only, while Tidy is off or uninstalled, with a line saying so. To check at
   the table, with dnd5e 5.3.3 and Tidy 13.10.5: an entry added, changed, dragged and deleted on
   the Journal tab reaches the app within seconds, a first one dated "First seen"; the Classic
   sheet's boxes; secrets on a character no player owns; Tidy turned off, then uninstalled,
   leaving the entries readable and the campaign card saying "(not enabled)"; and an entry written
   on a Wild Shape form's Journal tab lost when the form ends, as the app's line says.)
9. **Fewer sign-in reads:** every table and party sheet poll, once each 3 seconds, reads the
   player's session and user from the database: 2 of its 5 or 6 queries, about 13% of a session's
   (v0.44's measurement). Better Auth's session cookie cache would answer most polls from the
   signed cookie instead. The trade-off: a signed-out device or a revoked session keeps working
   until the cache expires, so its lifetime is chosen with that in mind.
10. Bug fixes and polish.

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
- An exploding die typed in still has Foundry throw its extra die.
- Midi-QOL's optional bonuses, its Bardic Inspiration among them, are offered on the Gamemaster's
  screen after the roll, with Foundry's dice.
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
- Favorites are added and removed from the app, not reordered: a new one goes last; reorder them in
  Foundry (reordering from the app is planned for v1.x).
- Skills, tools and spell slots are made favorites in Foundry, with no plan to change that unless
  it's asked for.
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
- Effects gained or ended in Wild Shape, other than conditions and concentration, aren't carried
  back: dnd5e's return keeps the character's own effects as they were at the change, so a Bless
  cast on the wolf ends with the form. Conditions gained in form are put on the character, and
  conditions and concentration that ended in form are taken off (other effects are planned for
  v1.x).
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
