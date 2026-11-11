# Roadmap

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). Each version below ships as
one app release and one module release, the app deployed first.

The further out a version is, the less settled it is, and that's expected: each one is planned in
full when work on it starts. Open questions stay with their version until then. Any version may
gain items from feedback or bugs.

Released: module v0.42.1 and its app.

## v0.44 (release candidate)

From the table's first session with v0.42.1, after the refactor.

What's left. Pick from the list by number.

**To check at the table before module v0.44.0 is tagged** (built and tested against stand-ins
only), with dnd5e 5.3.3, Midi-QOL v14.0.x and Tidy 5e Sheets 13.10.5:

- **The dice an item rolls later**, when typing in dice:
  - **What's asked:** Ice Knife's 2d6 after its 1d10, a critical's and an upcast's too, and
    another activity's damage and dice cost that Midi rolls once saves are checked. D20s are never
    asked, and nothing is asked under dnd5e 6.
  - **Explosions and timing:** a typed die that explodes is asked again, one die at a time, never
    told as timed out when the asks run past a minute. The ask opens by itself on the device the
    roll came from, not the one the exploding die was typed on.
  - **The dialog:** never over a focused text field, with a banner on the other devices, and focus
    back where it was. A skip, an expiry, a failed send offered again, two devices answering at
    once.
  - **The Gamemaster:** their window counts down, with Roll it now, leaving their chat typing
    alone; two players' Hunter's Mark at once, and a homebrew bonus macro; the Gamemaster using
    the same item meanwhile.
- **A use's cost check:** with the Gamemaster's Manual Dice on, a use from the app of an item with
  a `1d4` cost, with Midi-QOL too, asks them once, for the cost spent, or nothing where the player
  typed.
- **Tidy 5e Sheets' journal:**
  - an entry added, changed, dragged and deleted on the Journal tab reaches the app within
    seconds, a first one dated "First seen";
  - the Classic sheet's boxes;
  - secrets on a character no player owns;
  - Tidy turned off, then uninstalled, leaving the entries readable and the campaign card saying
    "(not enabled)";
  - an entry written on a Wild Shape form's Journal tab lost when the form ends, as the app's line
    says.

**Help**

12. **Help:** a question mark at the top opens a side panel explaining how to roll (an attack, hit
    dice), what each long press offers (damage, attack and other rolls), the settings, how manual
    dice work (the dice an item rolls later included), and that the Gamemaster applies short and
    long rests. (Planned; held for a prototype first.)

**Found while building Batch 1**

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

**Feedback from the table**

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

**Found while building Batch 2**

23. **Midi-QOL's reaction checks ask the Gamemaster for dice:** as it looks for the reactions an
    attack's targets could take, Midi-QOL works out what each would spend and throws that away
    (`doReactions` in its `utils.ts`), so a reaction whose cost is a dice formula is rolled there
    with the Gamemaster's dice settings, and under Manual Dice Foundry asks them for a roll nobody
    uses, for an attack from the app or not. It's Midi's own, unchanged by module 0.44.0, whose
    `PROTOCOL.md` and README say so; the module could roll those checks with Foundry's computer
    dice, as it now does Midi's check as a use from the app begins.
24. **The module's import cycle:** 44 of the module's `scripts/` files (`bridge.mjs`,
    `commands.mjs`, `transport.mjs`, `chat-data.mjs`, `creatures.mjs`, `midi-prompts.mjs`,
    `command-rolls.mjs` and others) already imported one another in one loop before the later dice,
    and `later-dice.mjs` joins it through them, though `bridge.mjs` no longer imports it. No
    top-level code depends on the loop; untangling it is a refactor of modules older than the later
    dice.
25. **Two copies of one countdown:** the dice dialog
    (`src/features/rolling/components/dice-entry/dice-entry-dialog.tsx`, since v0.42) keeps its own
    `secondsLeft`, `useSecondsLeft` and `clock`, line for line the prompt banner's
    (`src/features/sheet/components/prompt-banner/use-seconds-left.ts` and `utils.ts`), which item
    11's dice ask banner reuses. One shared home, their lowest common ancestor, would remove the
    copy.
26. **A die asked again named by its activity, not its roll:** the chip and the tray call Wild
    Sparks' formula "Wild Sparks: Burst", its roll's name, but the ask for its exploded die, in the
    dialog's title, the banner, the tray's answer line and the Gamemaster's window, says "Wild
    Sparks: Use", the item and its activity, as the module's `PROTOCOL.md` defines an ask's `label`,
    so a player sees two names for one roll within seconds. A wording choice, for the module (a
    formula's die named by its roll's name where it has one) or the app (`askName` in
    `src/features/rolling/utils/dice-ask-entry.ts`). Under real dnd5e an unnamed utility activity is
    named by its type, so the words at a table may differ.
27. **A die asked again shows its whole roll's total in the tray:** with 6 typed on Wild Sparks'
    `1d6x` and 3 typed for its die more, the tray reads "Wild Sparks: Use 3 = 3 · table 9" above
    "Wild Sparks: Burst 6 = 6 · table 9", and while it's the newest roll its big total says 9, "At
    the table: 9", as if a typed 3 came to 9. The answer's line takes the game's total of the roll
    its ask lists (`answeredRoll` in `src/features/rolling/utils/dice-ask-entry.ts`, shown by
    `MadeMark` in `src/features/rolling/components/roll-tray/table-mark.tsx`), and for a die thrown
    again that's the whole exploding formula. Code and `PROTOCOL.md` agree; such an answer could say
    it's added to its roll's total instead. The e2e doesn't check these words.

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
8. **Fewer sign-in reads:** every table and party sheet poll, once each 3 seconds, reads the
   player's session and user from the database: 2 of its 5 or 6 queries, about 13% of a session's
   (v0.44's measurement). Better Auth's session cookie cache would answer most polls from the
   signed cookie instead. The trade-off: a signed-out device or a revoked session keeps working
   until the cache expires, so its lifetime is chosen with that in mind.
9. Bug fixes and polish.

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
