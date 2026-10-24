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
run step2 66 X=1
run step1 36 X=1
run sheet 60 X=1
run gm 62 X=1 SHOTS=$O/shots-gm
run gm 62 X=1 SKEW=1 MODULE_DIR=$O/module-0.22.0 SHOTS=$O/shots-gm
run conditions 22 X=1
run late-setup 4 EXPECT_FIX=1
run late-setup 4 EXPECT_FIX=1 SKEW=1 MODULE_DIR=$O/module-0.22.0
run layout 12 EXPECT=fixed
run favorites 52 X=1
run rolls 74 SHOTS=$O/shots-rolls
run attacks 84 SHOTS=$O/shots-attacks
run attacks 86 MIDI=1 SHOTS=$O/shots-attacks
run uses 123 SHOTS=$O/shots-uses
run uses 126 MIDI=1 SHOTS=$O/shots-uses
run prompts 23 SHOTS=$O/shots-prompts
run prompts 25 MIDI=1 SHOTS=$O/shots-prompts
run midi 65 MIDI=1 TIMEOUT=600 SHOTS=$O/shots-027
run midi 10 SKEW=026 MODULE=$O/module-0.26.0 SHOTS=$O/shots-027
run links 119 SHOTS=$O/shots-links
run links 143 MIDI=1 SHOTS=$O/shots-links
run activities 100 SHOTS=$O/shots-activities
run activities 105 MIDI=1 SHOTS=$O/shots-activities
run phone 95 SHOTS=$O/shots-phone
run rolling 45 SHOTS=$O/shots-022
run rolling 47 MIDI=1 SHOTS=$O/shots-022
run sync 62 SHOTS=$O/shots-022
run favres 21 SHOTS=$O/shots-023
run toasts 149 TIMEOUT=900 SHOTS=$O/shots-026
run gmerr 53 SHOTS=$O/shots-025
run gmroll 70 SHOTS=$O/shots-026
run gmroll 6 SKEW=1 MODULE=$O/module-0.22.0 SHOTS=$O/shots-026
run gmroll 70 SKEW=024 MODULE=$O/module-0.24.0 SHOTS=$O/shots-026
# Module 0.32.0: players type in what their own dice show, and module 0.31.0 (no gate).
run manualdice 29 SHOTS=$O/shots-032
run manualdice 18 SKEW=031 MODULE=$O/module-0.31.0 SHOTS=$O/shots-032
run typed 89 SHOTS=$O/shots-032
run typed 47 DND5E6=1 SHOTS=$O/shots-032
run typed 90 MIDI=1 SHOTS=$O/shots-032
run typed 7 SKEW=031 MODULE=$O/module-0.31.0 SHOTS=$O/shots-032
run theme 15 SHOTS=$O/shots-026
# One damage card (module 0.28.0): plain dnd5e, Midi-QOL's card, and module 0.27.0 under Midi.
run damagecard 31 SHOTS=$O/shots-028
run damagecard 44 MIDI=1 SHOTS=$O/shots-028
run damagecard 42 SKEW=027 MODULE=$O/module-0.27.0 SHOTS=$O/shots-028
# The feedback round (module 0.29.0): ending concentration, spending charges, Heroic Inspiration,
# allies and search in the target picker, the tracker's colours, and hits, misses and saves on chat
# cards; plain dnd5e, Midi-QOL, and module 0.28.0 (no new controls, no new pills).
run feedback 113 SHOTS=$O/shots-029
run feedback 122 MIDI=1 SHOTS=$O/shots-029
run feedback 46 SKEW=028 MODULE=$O/module-0.28.0 SHOTS=$O/shots-029
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
run transfers 74 SHOTS=$O/shots-031
run transfers 78 DND5E6=1 SHOTS=$O/shots-031
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
# Module 0.36.0: companions (the creatures a character summons, and the NPCs its player owns),
# shown beside the character and acting from the app; damage on its own and recharges; and
# module 0.35.0 (neither).
run companions 124 SHOTS=$O/shots-036
run companions 125 MIDI=1 SHOTS=$O/shots-036
run companions 124 DND5E6=1 SHOTS=$O/shots-036
run companions 9 SKEW=035 MODULE=$O/module-0.35.0 SHOTS=$O/shots-036
run alone 71 SHOTS=$O/shots-036
run alone 72 MIDI=1 SHOTS=$O/shots-036
run alone 71 DND5E6=1 SHOTS=$O/shots-036
run alone 7 SKEW=035 MODULE=$O/module-0.35.0 SHOTS=$O/shots-036
# Module 0.36.0: ending a turn from the app, the character's or a companion's: the turn panel's
# End Turn and the Combat tab held; and module 0.35.0 (neither). For now the steps that need no End
# Turn screen; its button, hold and toast wait for the user's prototype (decisions Q 13).
run endturn 11 SHOTS=$O/shots-036
run endturn 11 MIDI=1 SHOTS=$O/shots-036
run endturn 11 DND5E6=1 SHOTS=$O/shots-036
run endturn 3 SKEW=035 MODULE=$O/module-0.35.0 SHOTS=$O/shots-036
