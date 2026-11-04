# E2E pass 5: the final pass (after commits 25 and 26 and the exports cleanup)

The full lane regression (`BUILD=1 RETRY=1 npm run e2e`, `e2e/lanes/checks-lanes.sh`) from APP at
`ae00002` (refactor: exports only the retired goldens read, removed or made file-private): the PR's
code, before commits 27-28 touch only e2e/README.md, lanes.conf and .refactor/. Module
/home/user/fvtt-sending-stone on main 94773cb (v0.42.1), dnd5e 5.3.3 and 6.0.5 from its .cache,
Postgres 16 on localhost:5432, 4 cores. Held `flock -o` on X/l1-wait.lock, X/checks.lock and
e2e/.out/e2e.lock for the whole pass, 5:45:26 to 6:49:47 AM EST on Nov 4. **RETRY=1** (round.md §2.6:
the final pass only, and the PR says so).

**Result: 104 of 104 runs exit=0 with oks=want; 1 retried.** `build errors: 0`. Wall time 3828 s
(63m48s, the retry included).

## The retried run: environment (load), not the product

- **What failed first:** `alone` (MIDI1), lane 2, exit=1 at 70 of 127: part 15 ("widths and themes"),
  alone-e2e.mjs:1066, `Timed out waiting for Fire Breath's failed recharge at 768 to be sent`.
- **The retry:** alone on lane 0 (the lanes idle), exit=0, 127 of 127, every part 15 check included.
- **Why it is not the product:** the same suite passed this path in passes 1 to 4 and in the retry;
  every earlier check of the run passed, the recharge ones at phone width (part 12) included; the
  timeout is a wait for the request under three lanes' load on 4 cores.

## Results, in regress.sh's order (after the retry)

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
endturn exit=0 oks=73 want=73
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
