# Roadmap

Sending Stone is two projects released together: this app and the Foundry module
[fvtt-sending-stone](https://github.com/lambersond/fvtt-sending-stone). Each version below ships as
one app release and one module release, the app deployed first.

The further out a version is, the less settled it is, and that's expected: each one is planned in
full when work on it starts. Open questions stay with their version until then. Any version may
gain items from feedback or bugs.

Released: module v0.33.0 and its app.

## v0.34 (in progress)

1. **Personal journal notes:** players add and edit journal notes from the app, visible only to
   them: no other player sees them. The Gamemaster can, as Foundry's Gamemaster always can.
   Visibility follows Owner access on the Foundry character.
2. **Party journal notes:** players add and edit notes attached to their party.
   - **Who:** the members who can view the party in the app. In Foundry the Gamemaster may give
     the journal to more players, such as table players who don't use the app.
   - **Editing:** a party member updates and deletes their own notes.
   - **Listing:** sorted by when they were created, each showing who last changed it and when.
   - **Chapters:** a chapter is a level 1 heading and an entry a level 2 heading; an entry's text is
     anything Foundry's journal Markdown supports, apart from those two heading levels. Chapters
     can be added and edited from the app, and deleted only in Foundry.
   - **Edits made in Foundry:** a change made to the journal in Foundry can upset this layout.
     Basic safeguards only.
3. **Notes while Foundry is offline:** players add or update notes while Foundry is closed, and the
   notes reach Foundry once it's running again.
   - Notes are kept in the app first and synced to Foundry, with a rule for a note changed in both
     places while Foundry was closed. Notes written in Foundry show in the app.
4. **Tests in the repositories:** the module's test harness and the end-to-end suites move into the
   repositories.

Patch releases (0.34.x) are expected as beta use turns up things to tweak.

## v0.35

1. **Companions, sidekicks and familiars:** show them and trigger their actions.
   - Wild Shape comes later because of its complexity. Built well, the companions view could be
     reused for the creature a character wild-shapes into.
   - Polymorph transformations are not on the roadmap: they're too complex and open-ended.
2. **Damage rolls to the table:** a setting that sends damage rolls without an attack roll or
   saving throw. The Gamemaster selects targets in Foundry and applies the damage as normal.

Open questions:
- Find Familiar and Summon Beast are dnd5e summon activities, which the app leaves to Foundry today.
  Companions likely need them, and a way to tell owned companions from summoned creatures.
- Wild Shape uses a transform activity that swaps the actor, so one creature view could serve both.
- Under Midi-QOL, a damage roll with no attack may start Midi's workflow with the player's targets.

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
