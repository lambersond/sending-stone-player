# Roadmap

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). Each version below ships as
one app release and one module release, the app deployed first.

The further out a version is, the less settled it is, and that's expected: each one is planned in
full when work on it starts. Open questions stay with their version until then. Any version may
gain items from feedback or bugs.

Released: module v0.35.0 and its app.

## v0.36 (in progress)

1. **Companions, sidekicks and familiars:** the creatures a character summons in Foundry, such as
   a familiar, while they're on the active scene, and the NPCs its player owns there, show beside
   the character in the app, a tab each, with their own sheets. Their attacks, spells, checks,
   saves and recharges are made in Foundry from the app, as the character's are. Summoning,
   dismissing and changing them stay in Foundry. The Gamemaster chooses whether each rolls its
   own initiative or acts right after its character.
   - Wild Shape comes later: the creature view is built to show the form a character takes.
   - Polymorph transformations are not on the roadmap.
2. **Damage on its own:** a setting sends damage rolls to Foundry with no attack roll or saving
   throw made there, as dnd5e's damage card with no targets, for the Gamemaster to select tokens
   and apply as normal; with Midi-QOL too, outside its workflow.
3. **Recharges:** a spent "Recharge 5–6" is rolled from the app.
4. **End Turn:** a player ends their turn, or a companion's, from the app: the turn panel's End
   Turn button, or the Combat tab held for a second and a half. It's Foundry's own Next Turn.

Patch releases (0.36.x) are expected as beta use turns up things to tweak.

## v1.0

1. Standardize names for the Foundry modules.
2. Add bug and feature templates to the code repositories.
3. Redesign the campaign page in the app.
4. Refactor existing code to best practices.
5. **Quieter polling:** if the Gamemaster isn't in Foundry and nobody is in the app, there's no need
   to poll constantly.

Open questions:
- Repository names or titles are low risk. Changing the module's id (`sending-stone`) is breaking:
  Foundry keeps the campaigns, their secrets and every flag under it, and installs follow its
  manifest URL, so it would need a migration.
- The refactor: write down what it should fix first, and go area by area, before the campaign page
  redesign, with the test harness and end-to-end suites as its safety net.
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
- Notes deleted or reordered in Foundry while no Gamemaster is connected don't move the journal's
  "Last changed by" line.
