# E2E pass 3: after integration (all nine Phase 3 lanes, commits 9-20 and their fixes)

The full lane regression (`BUILD=1 npm run e2e`, `e2e/lanes/checks-lanes.sh`) from APP at `680d60e`
(chore(refactor): owners.tsv and the Phase 4 list after integration; amendment 5), whose src is the
integrated Phase 3 tree. Module /home/user/fvtt-sending-stone on main 94773cb (v0.42.1), dnd5e 5.3.3 and
6.0.5 from its .cache, Postgres 16 on localhost:5432, 4 cores. Held `flock -o` on X/l1-wait.lock,
X/checks.lock and e2e/.out/e2e.lock for the whole pass and for the rerun. RETRY off. Run directly by the
orchestrator (a container restart had stopped the integration workflow's pass mid-run).

**Result: 103 of 104 runs exit=0 with oks=want on the first try; 1 failed, `endturn` (base): exit=1,
oks 23 of 73. Run again alone (`ONLY=endturn BUILD=0 npm run e2e`, same three locks): every endturn run
green (base 73/73, DND5E61 77/77, MIDI1 73/73, SKEW035 5/5). So all 104 runs are green, one on its rerun.**
`build errors: 0` (99 s). Wall time 3442 s (57m22s), against the baseline's 3542 s and pass 2's 3660 s.

## The failure: environment (dropped animation frames under load), not the product

- **What failed:** part 8 ("768"), endturn-e2e.mjs:686, "the rail's Combat tab held 1.1 s → the turn ends;
  at 600 ms the fill's drawn box starts at the tab's left edge" with an empty sample list `()`:
  `fillLook` (endturn-e2e.mjs:392) found no animation frame at all between 560 and 640 ms of the press.
- **Why it is not the product:** the turn did end from the rail's hold (the `until` for cbBrakka at :685
  passed before the check), every earlier hold check at phone width passed in the same run (parts 5-7),
  and alone the same check passed with the fill sampled at 563:0.47 580:0.50 596:0.51 613:0.53 630:0.55.
  An 80 ms window with no requestAnimationFrame sample at all is a frame drop: three lanes ran at once on
  4 cores during the pass.

## Results (first try), in regress.sh's order

```
organize exit=0 oks=43 want=43
step3 exit=0 oks=39 want=39
step2 exit=0 oks=66 want=66
step1 exit=0 oks=36 want=36
sheet exit=0 oks=60 want=60
gm exit=0 oks=65 want=65
gm exit=0 oks=65 want=65
conditions exit=0 oks=22 want=22
late-setup exit=0 oks=4 want=4
late-setup exit=0 oks=4 want=4
layout exit=0 oks=12 want=12
favorites exit=0 oks=52 want=52
rolls exit=0 oks=74 want=74
attacks exit=0 oks=84 want=84
attacks exit=0 oks=86 want=86
uses exit=0 oks=146 want=146
uses exit=0 oks=149 want=149
prompts exit=0 oks=23 want=23
prompts exit=0 oks=25 want=25
midi exit=0 oks=65 want=65
midi exit=0 oks=10 want=10
links exit=0 oks=119 want=119
links exit=0 oks=143 want=143
activities exit=0 oks=100 want=100
activities exit=0 oks=105 want=105
phone exit=0 oks=95 want=95
rolling exit=0 oks=45 want=45
rolling exit=0 oks=47 want=47
sync exit=0 oks=62 want=62
favres exit=0 oks=21 want=21
toasts exit=0 oks=149 want=149
gmerr exit=0 oks=58 want=58
gmroll exit=0 oks=70 want=70
gmroll exit=0 oks=6 want=6
gmroll exit=0 oks=70 want=70
manualdice exit=0 oks=29 want=29
manualdice exit=0 oks=18 want=18
typed exit=0 oks=159 want=159
typed exit=0 oks=61 want=61
typed exit=0 oks=163 want=163
typed exit=0 oks=7 want=7
typed exit=0 oks=15 want=15
theme exit=0 oks=15 want=15
damagecard exit=0 oks=31 want=31
damagecard exit=0 oks=44 want=44
damagecard exit=0 oks=42 want=42
feedback exit=0 oks=144 want=144
feedback exit=0 oks=153 want=153
feedback exit=0 oks=48 want=48
party exit=0 oks=64 want=64
party exit=0 oks=8 want=8
fullscreen exit=0 oks=30 want=30
settings exit=0 oks=22 want=22
settings exit=0 oks=24 want=24
settings exit=0 oks=11 want=11
results exit=0 oks=29 want=29
results exit=0 oks=44 want=44
results exit=0 oks=12 want=12
results exit=0 oks=17 want=17
transfers exit=0 oks=74 want=74
transfers exit=0 oks=78 want=78
transfers exit=0 oks=10 want=10
givetake exit=0 oks=67 want=67
givetake exit=0 oks=68 want=68
givetake exit=0 oks=19 want=19
removals exit=0 oks=81 want=81
removals exit=0 oks=47 want=47
removals exit=0 oks=9 want=9
notes exit=0 oks=123 want=123
notes exit=0 oks=9 want=9
partynotes exit=0 oks=58 want=58
notesoffline exit=0 oks=47 want=47
notesorder exit=0 oks=66 want=66
notesorder exit=0 oks=9 want=9
companions exit=0 oks=138 want=138
companions exit=0 oks=139 want=139
companions exit=0 oks=138 want=138
companions exit=0 oks=9 want=9
alone exit=0 oks=122 want=122
alone exit=0 oks=127 want=127
alone exit=0 oks=122 want=122
alone exit=0 oks=7 want=7
alone exit=0 oks=7 want=7
endturn exit=1 oks=23 want=73
endturn exit=0 oks=77 want=77
endturn exit=0 oks=73 want=73
endturn exit=0 oks=5 want=5
favoriting exit=0 oks=84 want=84
favoriting exit=0 oks=51 want=51
favoriting exit=0 oks=8 want=8
cookbook exit=0 oks=92 want=92
cookbook exit=0 oks=10 want=10
cookbook exit=0 oks=10 want=10
effects exit=0 oks=38 want=38
effects exit=0 oks=18 want=18
effects exit=0 oks=7 want=7
campaigns exit=0 oks=52 want=52
wildshape exit=0 oks=93 want=93
wildshape exit=0 oks=32 want=32
wildshape exit=0 oks=8 want=8
companionsaves exit=0 oks=44 want=44
companionsaves exit=0 oks=46 want=46
companionsaves exit=0 oks=38 want=38
companionsaves exit=0 oks=7 want=7
```

Rerun alone of the failed suite:

```
endturn exit=0 oks=73 want=73
endturn exit=0 oks=77 want=77
endturn exit=0 oks=73 want=73
endturn exit=0 oks=5 want=5
```
