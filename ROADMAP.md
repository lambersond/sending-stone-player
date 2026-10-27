# Roadmap

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). Each version below ships as
one app release and one module release, the app deployed first.

The further out a version is, the less settled it is, and that's expected: each one is planned in
full when work on it starts. Open questions stay with their version until then. Any version may
gain items from feedback or bugs.

Released: module v0.39.0 and its app.

## v0.40 (in progress)

1. **Wild Shape:** with **Allow Players to use Wild Shape from the app** on for the campaign in
   Foundry, a 2024 druid's player chooses the Beasts their druid knows, within the rules, one
   replaced after each Long Rest, and changes into one from the app and back: the sheet becomes the
   beast's, with a strip to return and the time left, and the druid's own mind and hit points carry
   over.
   Wild Shape ends when its hours run out, at 0 hit points or Incapacitated. Known forms are kept on
   the druid's own Wild Shape, so dnd5e's sheet offers the same ones.
2. **Transformations followed:** a character transformed in Foundry, by Wild Shape, Polymorph or the
   Gamemaster, shows as the form in the app, and its turns, chat and saves stay the character's, so
   End Turn works while transformed.

Patch releases (0.40.x) are expected as beta use turns up things to tweak.

## Before v1.0

1. **Companions' saves:** the saves the game asks of a companion, answered from the app as a
   character's are, rather than rolled in Foundry.

## v1.0

1. Refactor existing code to best practices.
2. **Quieter polling:** if the Gamemaster isn't in Foundry and nobody is in the app, there's no need
   to poll constantly.
3. **Supported versions:** a breakdown of which module versions each app version supports.

The module keeps its id, `sending-stone`, though its title changed in v0.37: Foundry keeps the
campaigns, their secrets and every flag under it, and installs follow its manifest URL.

Open questions:
- The refactor: write down what it should fix first, and go area by area, with the test harness and
  end-to-end suites as its safety net.
- Polling: nothing polls while Foundry is closed, since Foundry does the asking, so the case to
  handle is Foundry open with nobody in the app. Foundry must still pick up notes made offline as
  it connects.

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
6. Bug fixes and polish.

## v2.0

1. **dnd5e system 6.x support.** Much already runs on dnd5e 6.0.5: critical damage, moving items,
   typed dice, removing items and party sheets. A known gap: the Gamemaster's "ask the table" save
   and check cards aren't read under dnd5e 6. If dnd5e 6 becomes the stable release sooner, this
   may move up.
2. **Dishes under dnd5e 6:** the Magical Recipe Book's dishes, which need dnd5e 5 for now.

## Known limits

- When typing in dice, dice Foundry adds itself (Bless's d4, rerolls) are still rolled by Foundry,
  and Elven Accuracy's third d20 is asked for only on attacks the sheet marks.
- Moving several items at once isn't planned unless it's asked for.
- Summon activities are used in Foundry (planned for v1.x).
- The saves the game asks of a companion are rolled in Foundry (planned before v1.0).
- Companions show while on the active scene; a linked NPC its player owns shows always.
- Damage on its own is rolled at a spell's own level, in a weapon's first mode, without ammunition;
  Cast it, or attack, for the rest.
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
  conditions and concentration that ended in form are taken off.
- Bonus Actions aren't counted: Change and Return say they take one.
- A dish served while a character is in Wild Shape goes on the character's own actor: its effect
  waits for the return; its healing, and any other change to the character's own hit points
  meanwhile, is kept on the return, added to what the form took.
- Uses spent by a module's consumption hooks, such as Midi-QOL's, aren't run for a change from the
  app, which spends the use itself.
- A known form put on a druid's Wild Shape in Foundry from outside the campaign's compendiums, or
  outside the rules, is listed by name and used only in Foundry, where dnd5e's own Allow
  Polymorphing and the source's permissions apply (from outside the compendiums: planned for v1.x).
