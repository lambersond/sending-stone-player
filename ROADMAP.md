# Roadmap

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). Each version below ships as
one app release and one module release, the app deployed first.

The further out a version is, the less settled it is, and that's expected: each one is planned in
full when work on it starts. Open questions stay with their version until then. Any version may
gain items from feedback or bugs.

Released: module v0.38.1 and its app.

## v0.39 (in progress)

1. **Players' own effects:** with **Allow Players to disable & remove their own active effects** on
   for the campaign in Foundry, a player turns off and deletes, from the app's Effects tab, the
   effects their party put on their own character, turns off an item's temporary effect such as
   Rage, and turns back on what they turned off there: never a monster's effect, one made on the
   sheet, a condition or a concentration.
2. **The Magical Recipe Book in the cog:** **Configure Magical Cookbook** opens the link code and the
   dishes sent in a modal. In Foundry a dish's card shows to the campaign's players too, with no
   buttons for them, and **Apply to others…** serves whoever is ticked. (0.38.x's dialog served
   only those ticked as it opened: check who ate each dish served then.)
3. **Report a bug or request a feature:** links to each project's issue forms, in the app's cog and
   footer, and in Sending Stone's settings in Foundry.
4. **The campaign page:** the Gamemaster's campaigns as a list, what needs them first, the chosen one
   beside it on a wide screen and opened from the list on a phone, with search from seven campaigns.

Patch releases (0.39.x) are expected as beta use turns up things to tweak.

## v1.0

1. Refactor existing code to best practices.
2. **Quieter polling:** if the Gamemaster isn't in Foundry and nobody is in the app, there's no need
   to poll constantly.

Open questions:
- The module's title changed in v0.37; its id (`sending-stone`) didn't. Changing the id is
  breaking: Foundry keeps the campaigns, their secrets and every flag under it, and installs follow
  its manifest URL, so it would need a migration.
- The refactor: write down what it should fix first, and go area by area, with the test harness and
  end-to-end suites as its safety net.
- Polling: nothing polls while Foundry is closed, since Foundry does the asking, so the case to
  handle is Foundry open with nobody in the app. Foundry must still pick up notes made offline as
  it connects.
- Perhaps state which module versions each app version supports.

## v1.x

1. **Critical hit options.** App criticals double only the dice; choices such as dnd5e's Critical
   Damage Modifiers or Midi-QOL's critical options could come back as a per-campaign setting.
2. **Non-allies' health:** permission to show it in the app, with an optional setting to show the
   actual hit points (off by default, as it gives information away).
3. Bug fixes and polish.
4. Wild Shape.
5. **Basic transformation indicators,** such as "You've been transformed into a boot!"

## v2.0

1. **dnd5e system 6.x support.** Much already runs on dnd5e 6.0.5: critical damage, moving items,
   typed dice, removing items and party sheets. A known gap: the Gamemaster's "ask the table" save
   and check cards aren't read under dnd5e 6. If dnd5e 6 becomes the stable release sooner, this
   may move up.

## Known limits

- When typing in dice, dice Foundry adds itself (Bless's d4, rerolls) are still rolled by Foundry,
  and Elven Accuracy's third d20 is asked for only on attacks the sheet marks.
- Moving several items at once, and summon activities, aren't scheduled.
- The saves the game asks of a companion are rolled in Foundry.
- Companions show while on the active scene; a linked NPC its player owns shows always.
- Damage on its own is rolled at a spell's own level, in a weapon's first mode, without ammunition;
  Cast it, or attack, for the rest.
- End Turn isn't offered while a character is transformed, as by Wild Shape: end the turn in
  Foundry then.
- Undo takes a turn back only from the app that ended it, for a few seconds, while Foundry's
  tracker is where it left it; what happened as the turn changed stays done (uses recovered, a
  recharge rolled, effects that ended with the turn, Midi-QOL's saves and damage over time,
  initiative Midi-QOL rerolled at a new round), and so does whatever the next to act did meanwhile.
- Undo isn't offered when the next to act is hidden from players.
- Notes deleted or reordered in Foundry while no Gamemaster is connected don't move the journal's
  "Last changed by" line.
- Favorites are added and removed from the app, not reordered: a new one goes last; reorder them in
  Foundry.
- Skills, tools and spell slots are made favorites in Foundry.
- Dishes from the Magical Recipe Book need dnd5e 5 for now.
- A dish's effect ends with world time: a table that never advances time keeps it until the next
  dish replaces it or the Gamemaster deletes it.
- Players change only the effects their party put on their own character and their items' temporary
  ones: never a monster's, one made on the sheet, a condition, a concentration (End ends that) or a
  companion's.
- A dish's card is whispered to the campaign's players as it's posted: a player who joins later
  doesn't see earlier ones.
- The campaign page says what was so when it loaded; reload it for the latest.
- A party sheet has no Report a bug or Request a feature link.
