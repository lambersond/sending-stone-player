# Roadmap

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). Each version below ships as
one app release and one module release, the app deployed first.

The further out a version is, the less settled it is, and that's expected: each one is planned in
full when work on it starts. Open questions stay with their version until then. Any version may
gain items from feedback or bugs.

Released: module v0.41.0 and its app.

## v0.42 (in progress)

1. **Typed dice for what effects add:** when typing in dice, a die an effect adds to a d20 roll or
   takes from it, such as Bless's, Bane's or Guidance's, is asked for by the spell's name, or
   skipped for Foundry to roll it.
2. **Rerolls stay at the table:** the die typed in is the one kept after any reroll, such as Great
   Weapon Fighting's or a Halfling's reroll of a 1: Foundry no longer rerolls it.

Next, 0.42.1, before Friday's session: Elven Accuracy's third d20 on its own line, with Skip, and
the Bardic Inspiration a bard gave the character offered in the dice dialog, with a few more items
to come. Patch releases (0.42.x) are expected as the session turns up things to tweak.

## v0.42.1 (in progress)

1. **Elven Accuracy's third d20 on its own line:** when typing in dice, typed in, or skipped for
   Foundry to roll it.

Patch releases (0.42.x) are expected as Friday's session turns up things to tweak.

## v0.43 (release candidate)

1. Refactor existing code to best practices.
2. **Supported versions:** a breakdown of which module versions each app version supports.

v0.43 is the release candidate for v1.0: it runs at the table for a while before v1.0 is tagged.

Open question:
- The refactor: write down what it should fix first, and go area by area, with the test harness and
  end-to-end suites as its safety net.

## v1.0

The major release of the app and the module, once the v0.43 release candidate holds up, before
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
8. Bug fixes and polish.

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
- Bardic Inspiration is added with Modify Roll's extra dice until 0.42.1, which offers the 2024
  one; the 2014 one, which leaves no effect, stays so.
- An exploding die typed in still has Foundry throw its extra die.
- Midi-QOL's optional bonuses, its Bardic Inspiration among them, are offered on the Gamemaster's
  screen after the roll, with Foundry's dice.
- Moving several items at once isn't planned unless it's asked for.
- Summon activities are used in Foundry (planned for v1.x).
- A companion shared by several characters is asked a save card's save only where every one of
  their players can read the card.
- A Gamemaster's request for a save posted in chat asks the campaign's characters, not their
  companions.
- Companions show while on the active scene; a linked NPC its player owns shows always.
- Damage on its own from a spell an item casts, such as a wand's Magic Missile, isn't offered: Cast
  it for its damage.
- Damage on its own never spends the action itself, and with Spend off it counts nothing.
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
