#!/bin/sh
# Every end-to-end suite against the running app, each on fresh data: "name expected-oks".
# Run through checks-cycle.sh (serially) or lanes/checks-lanes.sh (on the lanes), which set the
# database, the secret and the module checkout (README.md). Logs go to $LOGS: this pass's E2E_LOGS, else
# .out/serial; screenshots to .out/shots-*; a SKEW run's older module is skew.sh's extract in .out.
E=${E2E_DIR:-$(cd "$(dirname "$0")" && pwd)}
O=$E/.out
LOGS=${E2E_LOGS:-$O/serial}
mkdir -p "$LOGS"
cd "$E"
run() {
  name=$1; want=$2; shift 2
  sh $E/reset-db.sh > /dev/null 2>&1
  # Each variant keeps its own log, so a later one doesn't overwrite an earlier failure.
  variant=$(echo "$@" | grep -oE 'MIDI=1|SKEW=[0-9]+|DND5E6=1' | tr -d '=')
  out=$LOGS/$name${variant:+.$variant}.rolls-regress.out
  # A suite may take longer than the usual 400 seconds: TIMEOUT=seconds among its variables.
  limit=$(echo "$@" | grep -oE 'TIMEOUT=[0-9]+' | cut -d= -f2)
  env "$@" timeout ${limit:-400} node --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs $name-e2e.mjs > $out 2>&1
  code=$?
  got=$(grep -c '^ok' $out)
  echo "$name exit=$code oks=$got want=$want"
}
run organize 43 X=1
run step3 39 X=1
run step2 69 X=1
run step1 36 X=1
run sheet 60 X=1
run gm 66 X=1 SHOTS=$O/shots-gm
run gm 66 X=1 SKEW=1 MODULE_DIR=$O/module-0.22.0 SHOTS=$O/shots-gm
run conditions 22 X=1
run late-setup 4 EXPECT_FIX=1
run late-setup 4 EXPECT_FIX=1 SKEW=1 MODULE_DIR=$O/module-0.22.0
# Item 17: a very long character name on the campaigns page, the journal's card and the join page,
# at 360, 390, 768, 1024 and 1280; item 33: a long name after the turn panel's "Next:" at the same.
run layout 32 EXPECT=fixed
# Item 17 in world-030: a long party name on the campaigns page, a long word in Personality and
# Appearance, and long names in Give coins' and Distribute coins' lists, at the same five widths.
run names 21 SHOTS=$O/shots-names
run favorites 59 X=1
# v0.44: the hello's hit points (module 0.44.0) and a plain roll through the rolls' gate. Item 19:
# the tracker's encounter not begun shows no turn nor order, but the line to roll initiative; begun,
# both; begun but no longer the tracker's, "No combat right now" alone, even with Thorin's
# initiative cleared (v0.45, the owner's decision 1), and the sheet's Initiative tile not offering
# to roll for it (v0.46).
run rolls 83 SHOTS=$O/shots-rolls
# v0.44: the dice tray under the chat (module 0.44.0's plain roll): at 390, 1280, 1024 and on a
# 768 tablet, a d100 and a modifier, 20 dice the most, Send to the table off, typed in, the
# Gamemaster's page, and the campaign's rolls off; and module 0.42.0 (no plain rolls in the game).
run dice 25 SHOTS=$O/shots-dice
run dice 25 DND5E6=1 SHOTS=$O/shots-dice
run dice 5 SKEW=042 MODULE=$O/module-0.42.0 SHOTS=$O/shots-dice
run attacks 84 SHOTS=$O/shots-attacks
run attacks 86 MIDI=1 SHOTS=$O/shots-attacks
# Round 0.42.1: spells prepared from the row menus (§P).
run uses 146 SHOTS=$O/shots-uses
run uses 149 MIDI=1 SHOTS=$O/shots-uses
# Module 0.42.0: all but the spells prepared from the menus, none offered and one posted turned down.
run uses 126 SKEW=042 MODULE=$O/module-0.42.0 SHOTS=$O/shots-uses
run prompts 23 SHOTS=$O/shots-prompts
run prompts 25 MIDI=1 SHOTS=$O/shots-prompts
run midi 65 MIDI=1 TIMEOUT=600 SHOTS=$O/shots-027
run midi 10 SKEW=026 MODULE=$O/module-0.26.0 SHOTS=$O/shots-027
run links 119 SHOTS=$O/shots-links
run links 143 MIDI=1 SHOTS=$O/shots-links
run activities 100 SHOTS=$O/shots-activities
run activities 105 MIDI=1 SHOTS=$O/shots-activities
run phone 97 SHOTS=$O/shots-phone
run rolling 45 SHOTS=$O/shots-022
run rolling 47 MIDI=1 SHOTS=$O/shots-022
run sync 62 SHOTS=$O/shots-022
run favres 21 SHOTS=$O/shots-023
run toasts 149 TIMEOUT=900 SHOTS=$O/shots-026
run gmerr 58 SHOTS=$O/shots-025
run gmroll 70 SHOTS=$O/shots-026
run gmroll 6 SKEW=1 MODULE=$O/module-0.22.0 SHOTS=$O/shots-026
run gmroll 70 SKEW=024 MODULE=$O/module-0.24.0 SHOTS=$O/shots-026
# Module 0.32.0: players type in what their own dice show, and module 0.31.0 (no gate).
run manualdice 29 SHOTS=$O/shots-032
run manualdice 18 SKEW=031 MODULE=$O/module-0.31.0 SHOTS=$O/shots-032
# Round 0.42.1: Elven Accuracy's third d20 on its own line, with Skip, and module 0.42.1's Bardic
# Inspiration offered, spent and its Inspired removed (step 5c, its pictures in shots-0421), which
# bring the plain and Midi-QOL runs to 260-330 seconds alone, near the usual limit of 400.
# Module 0.44.0 (item 11): step 7b's exploding 1d6x has its die more asked under dnd5e 5, one check
# more in the plain and Midi-QOL runs; under dnd5e 6 it's Foundry's, as before.
run typed 160 TIMEOUT=600 SHOTS=$O/shots-032
run typed 61 DND5E6=1 SHOTS=$O/shots-032
run typed 164 MIDI=1 TIMEOUT=600 SHOTS=$O/shots-032
run typed 7 SKEW=031 MODULE=$O/module-0.31.0 SHOTS=$O/shots-032
# Module 0.42.0: the dice effects add, typed or skipped, and rerolls kept at the table;
# and module 0.41.0 (none of it; since app 0.42.1, Elven Accuracy's Skip, and no offer).
run typed 15 SKEW=041 MODULE=$O/module-0.41.0 SHOTS=$O/shots-042
# And module 0.42.0: Bless's die typed, the greatsword's typed 1 kept, and no Bardic Inspiration offered.
run typed 12 SKEW=042 MODULE=$O/module-0.42.0 SHOTS=$O/shots-042
# Module 0.44.0 (item 11): the dice the game rolls later, asked of a player typing theirs, on a
# phone and a wide page: an exploding die's die more, named by its roll (module 0.45.0) and added
# to its roll in the tray, Let the game roll, the dialog only where the
# roll came from and not over a focused text field, the banner on the other device, the
# Gamemaster's Roll it now, the die more typed 6 at 40 s asked again, then a minute's wait, the roll
# held past its own minute and never timed out (the plain and Midi-QOL runs about 45 s longer),
# nothing for a 3D player or the Gamemaster's own roll; Midi-QOL's copy of Ice Knife's activities
# and a Sneak Attack bonus; dnd5e 6.0.5 (off, said so); and module 0.42.0.
run laterdice 27 SHOTS=$O/shots-044
run laterdice 33 MIDI=1 SHOTS=$O/shots-044
run laterdice 9 DND5E6=1 SHOTS=$O/shots-044
run laterdice 9 SKEW=042 MODULE=$O/module-0.42.0 SHOTS=$O/shots-044
run theme 15 SHOTS=$O/shots-026
# One damage card (module 0.28.0): plain dnd5e, Midi-QOL's card, and module 0.27.0 under Midi.
run damagecard 31 SHOTS=$O/shots-028
run damagecard 44 MIDI=1 SHOTS=$O/shots-028
run damagecard 42 SKEW=027 MODULE=$O/module-0.27.0 SHOTS=$O/shots-028
# The feedback round (module 0.29.0): ending concentration, spending charges, Heroic Inspiration,
# allies and search in the target picker, the tracker's colours, and hits, misses and saves on chat
# cards; plain dnd5e, Midi-QOL, and module 0.28.0 (no new controls, no new pills).
# Round 0.42.1: spell slots spent and restored from the dots (§U), its pictures in shots-029.
run feedback 144 SHOTS=$O/shots-029
run feedback 153 MIDI=1 SHOTS=$O/shots-029
run feedback 48 SKEW=028 MODULE=$O/module-0.28.0 SHOTS=$O/shots-029
# And module 0.42.0: all but the spell slots from the dots, pictures as before.
run feedback 115 SKEW=042 MODULE=$O/module-0.42.0 SHOTS=$O/shots-029
# Module 0.30.0: party sheets, full screen, the Foundry settings section and chat results matching
# Foundry; plain dnd5e, Midi-QOL, dnd5e 6.0.5, and module 0.29.0 (no Party list on Inventory, no settings, 0.29.0 results).
run party 64 SHOTS=$O/shots-030
run party 8 SKEW=029 MODULE=$O/module-0.29.0 SHOTS=$O/shots-030
run fullscreen 30 SHOTS=$O/shots-030
run settings 22 SHOTS=$O/shots-030
run settings 24 MIDI=1 SHOTS=$O/shots-030
run settings 11 SKEW=029 MODULE=$O/module-0.29.0 SHOTS=$O/shots-030
run results 29 SHOTS=$O/shots-030
run results 44 MIDI=1 SHOTS=$O/shots-030
run results 12 DND5E6=1 SHOTS=$O/shots-030
run results 17 SKEW=029 MODULE=$O/module-0.29.0 SHOTS=$O/shots-030
# Module 0.31.0: moving items and coins (party ↔ character, character → character), dnd5e 6.0.5's
# fractional coins, and module 0.30.0 (no moves); and Hit/miss and save results in the app.
run transfers 76 SHOTS=$O/shots-031
run transfers 80 DND5E6=1 SHOTS=$O/shots-031
run transfers 10 SKEW=030 MODULE=$O/module-0.30.0 SHOTS=$O/shots-031
# Module 0.32.0, the give/take feedback: Send to in an item's menu; the Currency rows (the character's Send
# to; the party's Take, Send to, Give and Distribute); a party's things sent by its Owner, party to party,
# and its coin distributed; dnd5e 6.0.5's fractions; and module 0.31.0 (none of the party's new ones).
run givetake 67 SHOTS=$O/shots-032
run givetake 68 DND5E6=1 SHOTS=$O/shots-032
run givetake 19 SKEW=031 MODULE=$O/module-0.31.0 SHOTS=$O/shots-032
# Module 0.33.0: an item removed from a character (its menu, the confirmation, stacks, containers,
# the Gamemaster's, races with moves), dnd5e 6.0.5, and module 0.32.0 (no Remove).
run removals 81 SHOTS=$O/shots-033
run removals 47 DND5E6=1 SHOTS=$O/shots-033
run removals 9 SKEW=032 MODULE=$O/module-0.32.0 SHOTS=$O/shots-033
# Module 0.35.0: the journal (its card, modal, contents, reader and editor), notes moved and
# reordered by anyone in the party, Foundry's order kept, and who changed the journal; and modules
# 0.33.0 (no notes) and 0.34.0 (orders kept and waiting).
run notes 123 SHOTS=$O/shots-035
run notes 9 SKEW=033 MODULE=$O/module-0.33.0 SHOTS=$O/shots-035
run partynotes 58 SHOTS=$O/shots-035
run notesoffline 47 TIMEOUT=600 SHOTS=$O/shots-035
run notesorder 66 SHOTS=$O/shots-035
run notesorder 9 SKEW=034 MODULE=$O/module-0.34.0 SHOTS=$O/shots-035
# Module 0.44.0: Tidy 5e Sheets' journal, read only, last in the character's journal: the hello and
# the settings card, its section, chips and dates, Tidy's edits in Foundry, the Gamemaster and another
# player, Tidy off and uninstalled; dnd5e 6.0.5 with Tidy 14 (its _del, the Classic boxes it no longer
# shows); and module 0.42.0 (nothing new).
run tidy 38 SHOTS=$O/shots-044
run tidy 38 DND5E6=1 SHOTS=$O/shots-044
run tidy 6 SKEW=042 MODULE=$O/module-0.42.0 SHOTS=$O/shots-044
# Module 0.36.0: companions (the creatures a character summons, and the NPCs its player owns),
# shown beside the character and acting from the app; damage on its own and recharges; and
# module 0.35.0 (neither).
run companions 138 SHOTS=$O/shots-036f
run companions 139 MIDI=1 SHOTS=$O/shots-036f
run companions 138 DND5E6=1 SHOTS=$O/shots-036f
run companions 9 SKEW=035 MODULE=$O/module-0.35.0 SHOTS=$O/shots-036f
# v0.46 (item 39): at 768 and 1280, part 15's Recharge chip gone within 2 s of the tray's
# "recharged", and the page reading the table as the game answers the recharge and again a moment
# after that read.
run alone 126 SHOTS=$O/shots-036
run alone 131 MIDI=1 SHOTS=$O/shots-036
run alone 126 DND5E6=1 SHOTS=$O/shots-036
run alone 7 SKEW=035 MODULE=$O/module-0.35.0 SHOTS=$O/shots-036
# Module 0.41.0: the runs above add part 17, damage on its own with its choices, a spell's level, a
# weapon's mode and ammunition and the Spend switch (its pictures in shots-041); and module 0.40.0
# (none).
run alone 7 SKEW=040 MODULE=$O/module-0.40.0 SHOTS=$O/shots-041
# Module 0.36.0: ending a turn from the app, the character's or a companion's: the turn panel's
# End turn and the Combat tab held, as the user's End Turn prototype draws them, with Undo; and
# module 0.35.0 (neither). Its screenshots from the first run only.
run endturn 73 TIMEOUT=900 SHOTS=$O/shots-036f
run endturn 77 MIDI=1 TIMEOUT=900
run endturn 73 DND5E6=1 TIMEOUT=900
run endturn 5 SKEW=035 MODULE=$O/module-0.35.0 SHOTS=$O/shots-036f
# Module 0.37.0: favorites added and removed from the app by a right-click or long-press, as
# dnd5e's own favorites; and module 0.36.0 (none). Since module 0.47.0 (item 28), part 14: put in
# order by Reorder's drag and keys and by Move up and Move down at 390, under dnd5e 5 and 6, Foundry's
# actor keeping each order, and (item 48) one made a favorite in Foundry while an order is on its way
# moved up; module 0.36.0 offering none; and module 0.46.0, favorites never put in order.
run favoriting 104 SHOTS=$O/shots-037
run favoriting 71 DND5E6=1 SHOTS=$O/shots-037
run favoriting 9 SKEW=036 MODULE=$O/module-0.36.0 SHOTS=$O/shots-037
run favoriting 5 SKEW=046 MODULE=$O/module-0.46.0 SHOTS=$O/shots-037
# Module 0.38.0: dishes from the Magical Recipe Book, posted by the cookbook's server with a link
# code, a card for the Gamemaster in Foundry and an effect on each character chosen; dnd5e 6.0.5
# (off); and module 0.37.0 (none).
run cookbook 102 TIMEOUT=600 SHOTS=$O/shots-038
run cookbook 10 DND5E6=1 SHOTS=$O/shots-038
run cookbook 10 SKEW=037 MODULE=$O/module-0.37.0 SHOTS=$O/shots-038
# Module 0.39.0: a player's own effects turned off, on and deleted from the app, by the campaign's
# switch; dnd5e 6.0.5; and module 0.38.1 (none).
run effects 38 SHOTS=$O/shots-039
run effects 18 DND5E6=1 SHOTS=$O/shots-039
run effects 7 SKEW=038 MODULE=$O/module-0.38.1 SHOTS=$O/shots-039
# The campaign page, option A (v0.39): the Gamemaster's campaigns as a list and the chosen one.
run campaigns 54 SHOTS=$O/shots-039
# Module 0.40.0: Wild Shape from the app, a 2024 druid's known forms, the shaped seat; dnd5e 6.0.5;
# and module 0.39.0 (none).
run wildshape 93 TIMEOUT=900 SHOTS=$O/shots-040
run wildshape 32 DND5E6=1 SHOTS=$O/shots-040
run wildshape 8 SKEW=039 MODULE=$O/module-0.39.0 SHOTS=$O/shots-040
# Module 0.41.0: the saves the game asks of companions, on their own panes; Midi-QOL's; dnd5e 6.0.5;
# and module 0.40.0 (none).
run companionsaves 44 SHOTS=$O/shots-041
run companionsaves 46 MIDI=1 SHOTS=$O/shots-041
run companionsaves 38 DND5E6=1 SHOTS=$O/shots-041
run companionsaves 7 SKEW=040 MODULE=$O/module-0.40.0 SHOTS=$O/shots-041
# Module 0.44.0: hit points and temporary hit points set from the app, the character's and a
# companion's, the rolls off; the editor reset as the game changes them; a stale view refused; never
# the Gamemaster's page nor another seat; the campaign card, and the switch off; dnd5e 6.0.5 and
# Midi-QOL.
run hitpoints 36 SHOTS=$O/shots-044
run hitpoints 36 DND5E6=1 SHOTS=$O/shots-044
run hitpoints 36 MIDI=1 SHOTS=$O/shots-044
# Item 12: Help, from the header's ? and the cog's How to use Sending Stone, at 360 and 1280, for a
# player and the Gamemaster: the box reading the campaign, typing off, allowed and on, and with this
# device's Send to the table off; the paragraph on the dice an item rolls later by the module's
# version, typing allowed or not; the panel's layout, the chips and reduced motion, focus going back;
# the Gamemaster's long name at 360. Module 0.42.0, and dnd5e 6.0.5: no row nor paragraph for them.
run help 28 SHOTS=$O/shots-help
run help 4 SKEW=042 MODULE=$O/module-0.42.0 SHOTS=$O/shots-help
run help 4 DND5E6=1 SHOTS=$O/shots-help
