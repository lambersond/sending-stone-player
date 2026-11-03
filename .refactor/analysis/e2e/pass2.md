# E2E pass 2: after the moves, export moves and seams (commits 5-8)

The full lane regression (`BUILD=1 npm run e2e`, `e2e/lanes/checks-lanes.sh`) from APP at its head,
`9589546` (chore(refactor): owners.tsv checked against commit 8). src there equals commit 8's
(`63c5cc3`): `git diff --name-only 63c5cc3 9589546` lists only `.refactor/` files, and no file under
`e2e/`, `prisma/`, `package.json` or `package-lock.json` changed since the baseline. Module
`/home/user/fvtt-sending-stone` on main `94773cb` (v0.42.1, clean), dnd5e 5.3.3 and 6.0.5 from its
`.cache` (DND5E5_DIR and DND5E6_DIR unset), Postgres 16.15 on localhost:5432, 4 cores. Held
`flock -o X/l1-wait.lock`, `flock -o X/checks.lock` and `flock -o e2e/.out/e2e.lock`, in that order,
for the whole pass and for the rerun (7:16:22 to 8:18:23 AM EST, then 8:18:32 to 8:23:37 AM EST).
RETRY off.

**Result: 103 of 104 runs exit=0 with oks=want on the first try. 1 failed, `notesoffline` (base):
exit=1, oks 43 of 47. Run again alone (`ONLY=notesoffline BUILD=0 npm run e2e`, same three locks):
exit=0, oks 47 of 47, 294 s. So all 104 runs are green, one of them on its rerun.** The failure is the
environment, not the product (below). `build errors: 0` (49 s). Wall time 3660 s (61m00s), against
the baseline's 3542 s.

## Against the baseline (base.md)

- **The same 104 runs in the same order.** Suites, variants and every `want` are equal to the
  baseline's, row by row.
- **Results.** Every run but `notesoffline` (base) has exit=0 and oks=want on the first try, as in
  the baseline. `notesoffline` (base) was 47 of 47 in the baseline, 43 of 47 here, and 47 of 47 alone.
- **Times.** The 104 runs took 9994 s in all, against the baseline's 9663 s (+331 s, +3.4 %).
  - The most any one run grew was 21 s: alone DND5E61 253 → 274 s, sync 112 → 131 s, typed 278 → 295 s,
    companions MIDI1 304 → 321 s.
  - The most any one run shrank was 5 s (gmroll 101 → 96 s).
  - The lanes' load stayed between 7 and 10 on 4 cores while all three ran. No jest, tsc, eslint or
    build ran beside the pass (the locks).

## Longest lane

| lane | runs | seconds | note |
|---|---|---|---|
| 0 (:3000) | 34 | 3655 (60m55s) | includes the solo toasts after the lanes (488 s); 3167 s without it |
| 1 (:3001) | 34 | 3171 | |
| 2 (:3002) | 36 | 3168 | |

Longest runs: toasts 488 s (solo), endturn 342 s, companions MIDI1 321 s, companions 317 s,
companions DND5E61 312 s, typed MIDI1 310 s.

## The failure: notesoffline (base), environment

- **Where it stopped.** Lane 0, +1346 to +1644 s, beside companions, links and typed on the other
  lanes. Part 13 ("both places") calls `orderMeanwhile` twice. The first call passed all four checks
  up to "Use yours: Foundry in her order, the panel gone". The second call threw
  `Timed out waiting for the game closed` (notesoffline-e2e.mjs:541 → world-030.mjs:107). That wait
  is 15 s, for the notes book's `live` to turn false after `stopFetching({ age: A })`.
- **What that wait races.**
  - `stopFetching` aborts the stand-in's in-flight command fetches in the browser. It then ages
    `campaign."bridgePolledAt"` by 10 minutes in SQL.
  - If a fetch the browser gave up on had already reached the server, the route can still write a
    fresh `bridgePolledAt` (`markBridgePolled`) after the SQL ran. The book then stays live until
    `BRIDGE_POLLED_WITHIN` (45 s) has passed, which is longer than the 15 s wait.
  - The server answers more slowly under three lanes' load, so the race is more likely to land
    there.
- **Rerun alone.** All 47 checks passed in 294 s, the baseline's own time. That includes the four
  the first try never reached: part 13's "again, Keep Foundry’s" and its note added meanwhile, part
  14's gone chapter, and the closing "no page errors, and the app took everything the module sent".
- **Product diff, commits 2-8 since the baseline, in the files on that path.** Nothing changed
  behaviour.
  - src/db/notes.ts (the `live` test `Date.now() - polled < BRIDGE_POLLED_WITHIN` at :238 and :820):
    only its file-wide no-null directive is gone.
  - src/constants/sending-stone.ts: `BRIDGE_POLLED_WITHIN` is still `45_000`. Only type aliases
    moved out (to src/types), and `LINK_CLASSES` came in.
  - src/db/roll-requests.ts (`markBridgePolled`): only its import lines changed, and three no-null
    directive comments are gone.
  - src/app/api/bridge/commands/route.ts, the notes routes, and src/lib/routes/{bridge-http,
    notes-routes}.ts (moved from src/lib): only import paths changed.
  - src/db/note-sync.ts: its directive is gone, and the `NotePageCommand` type moved to
    src/db/types.ts.
  - src/features/notes/hooks/use-notes.ts: `POLL_INTERVAL` is now imported from
    src/constants/polling.ts, still 3000.
- **Logged.** No bug is logged. The race is in the suite's timing under load (a 15 s wait against a
  45 s window that one late poll restarts). It is not in the app. It is noted here for the final
  pass's rerun round.

## Runs (regress.sh's order)

`want`/`oks`/`exit` from `e2e/.out/logs/regress-lanes.out`; `lane` and `s` from `logs/times.tsv`
(the first try's); `rerun` is the run alone (`ONLY=<suite> BUILD=0`).

| suite | variant | want | oks | exit | rerun | lane | s |
|---|---|---|---|---|---|---|---|
| organize | base | 43 | 43 | 0 | - | 2 | 26 |
| step3 | base | 39 | 39 | 0 | - | 0 | 50 |
| step2 | base | 66 | 66 | 0 | - | 0 | 16 |
| step1 | base | 36 | 36 | 0 | - | 2 | 24 |
| sheet | base | 60 | 60 | 0 | - | 1 | 48 |
| gm | base | 65 | 65 | 0 | - | 1 | 24 |
| gm | SKEW1 | 65 | 65 | 0 | - | 1 | 25 |
| conditions | base | 22 | 22 | 0 | - | 1 | 14 |
| late-setup | base | 4 | 4 | 0 | - | 2 | 7 |
| late-setup | SKEW1 | 4 | 4 | 0 | - | 2 | 5 |
| layout | base | 12 | 12 | 0 | - | 0 | 15 |
| favorites | base | 52 | 52 | 0 | - | 0 | 40 |
| rolls | base | 74 | 74 | 0 | - | 1 | 112 |
| attacks | base | 84 | 84 | 0 | - | 1 | 132 |
| attacks | MIDI1 | 86 | 86 | 0 | - | 1 | 131 |
| uses | base | 146 | 146 | 0 | - | 1 | 187 |
| uses | MIDI1 | 149 | 149 | 0 | - | 1 | 191 |
| prompts | base | 23 | 23 | 0 | - | 1 | 47 |
| prompts | MIDI1 | 25 | 25 | 0 | - | 1 | 53 |
| midi | MIDI1 | 65 | 65 | 0 | - | 0 | 165 |
| midi | SKEW026 | 10 | 10 | 0 | - | 0 | 42 |
| links | base | 119 | 119 | 0 | - | 1 | 157 |
| links | MIDI1 | 143 | 143 | 0 | - | 1 | 190 |
| activities | base | 100 | 100 | 0 | - | 2 | 97 |
| activities | MIDI1 | 105 | 105 | 0 | - | 2 | 97 |
| phone | base | 95 | 95 | 0 | - | 0 | 68 |
| rolling | base | 45 | 45 | 0 | - | 2 | 64 |
| rolling | MIDI1 | 47 | 47 | 0 | - | 2 | 67 |
| sync | base | 62 | 62 | 0 | - | 2 | 131 |
| favres | base | 21 | 21 | 0 | - | 1 | 9 |
| toasts | base | 149 | 149 | 0 | - | 0 | 488 |
| gmerr | base | 58 | 58 | 0 | - | 2 | 49 |
| gmroll | base | 70 | 70 | 0 | - | 1 | 96 |
| gmroll | SKEW1 | 6 | 6 | 0 | - | 1 | 20 |
| gmroll | SKEW024 | 70 | 70 | 0 | - | 1 | 95 |
| manualdice | base | 29 | 29 | 0 | - | 2 | 30 |
| manualdice | SKEW031 | 18 | 18 | 0 | - | 2 | 19 |
| typed | base | 159 | 159 | 0 | - | 2 | 295 |
| typed | DND5E61 | 61 | 61 | 0 | - | 2 | 103 |
| typed | MIDI1 | 163 | 163 | 0 | - | 2 | 310 |
| typed | SKEW031 | 7 | 7 | 0 | - | 2 | 16 |
| typed | SKEW041 | 15 | 15 | 0 | - | 2 | 31 |
| theme | base | 15 | 15 | 0 | - | 2 | 6 |
| damagecard | base | 31 | 31 | 0 | - | 0 | 49 |
| damagecard | MIDI1 | 44 | 44 | 0 | - | 0 | 56 |
| damagecard | SKEW027 | 42 | 42 | 0 | - | 0 | 60 |
| feedback | base | 144 | 144 | 0 | - | 0 | 190 |
| feedback | MIDI1 | 153 | 153 | 0 | - | 0 | 203 |
| feedback | SKEW028 | 48 | 48 | 0 | - | 0 | 85 |
| party | base | 64 | 64 | 0 | - | 2 | 63 |
| party | SKEW029 | 8 | 8 | 0 | - | 2 | 13 |
| fullscreen | base | 30 | 30 | 0 | - | 1 | 25 |
| settings | base | 22 | 22 | 0 | - | 1 | 31 |
| settings | MIDI1 | 24 | 24 | 0 | - | 1 | 36 |
| settings | SKEW029 | 11 | 11 | 0 | - | 1 | 10 |
| results | base | 29 | 29 | 0 | - | 1 | 70 |
| results | MIDI1 | 44 | 44 | 0 | - | 1 | 84 |
| results | DND5E61 | 12 | 12 | 0 | - | 1 | 24 |
| results | SKEW029 | 17 | 17 | 0 | - | 1 | 44 |
| transfers | base | 74 | 74 | 0 | - | 1 | 95 |
| transfers | DND5E61 | 78 | 78 | 0 | - | 1 | 95 |
| transfers | SKEW030 | 10 | 10 | 0 | - | 1 | 15 |
| givetake | base | 67 | 67 | 0 | - | 2 | 111 |
| givetake | DND5E61 | 68 | 68 | 0 | - | 2 | 110 |
| givetake | SKEW031 | 19 | 19 | 0 | - | 2 | 37 |
| removals | base | 81 | 81 | 0 | - | 0 | 84 |
| removals | DND5E61 | 47 | 47 | 0 | - | 0 | 36 |
| removals | SKEW032 | 9 | 9 | 0 | - | 0 | 13 |
| notes | base | 123 | 123 | 0 | - | 1 | 118 |
| notes | SKEW033 | 9 | 9 | 0 | - | 1 | 27 |
| partynotes | base | 58 | 58 | 0 | - | 0 | 109 |
| notesoffline | base | 47 | 43 | 1 | 0: 47/47 alone (lane 1, 294 s) | 0 | 298 |
| notesorder | base | 66 | 66 | 0 | - | 2 | 101 |
| notesorder | SKEW034 | 9 | 9 | 0 | - | 2 | 80 |
| companions | base | 138 | 138 | 0 | - | 1 | 317 |
| companions | MIDI1 | 139 | 139 | 0 | - | 1 | 321 |
| companions | DND5E61 | 138 | 138 | 0 | - | 1 | 312 |
| companions | SKEW035 | 9 | 9 | 0 | - | 1 | 16 |
| alone | base | 122 | 122 | 0 | - | 2 | 262 |
| alone | MIDI1 | 127 | 127 | 0 | - | 2 | 276 |
| alone | DND5E61 | 122 | 122 | 0 | - | 2 | 274 |
| alone | SKEW035 | 7 | 7 | 0 | - | 2 | 13 |
| alone | SKEW040 | 7 | 7 | 0 | - | 2 | 15 |
| endturn | base | 73 | 73 | 0 | - | 0 | 342 |
| endturn | MIDI1 | 77 | 77 | 0 | - | 0 | 259 |
| endturn | DND5E61 | 73 | 73 | 0 | - | 0 | 252 |
| endturn | SKEW035 | 5 | 5 | 0 | - | 0 | 14 |
| favoriting | base | 84 | 84 | 0 | - | 0 | 139 |
| favoriting | DND5E61 | 51 | 51 | 0 | - | 0 | 96 |
| favoriting | SKEW036 | 8 | 8 | 0 | - | 0 | 12 |
| cookbook | base | 92 | 92 | 0 | - | 0 | 174 |
| cookbook | DND5E61 | 10 | 10 | 0 | - | 0 | 18 |
| cookbook | SKEW037 | 10 | 10 | 0 | - | 0 | 56 |
| effects | base | 38 | 38 | 0 | - | 2 | 69 |
| effects | DND5E61 | 18 | 18 | 0 | - | 2 | 26 |
| effects | SKEW038 | 7 | 7 | 0 | - | 2 | 55 |
| campaigns | base | 52 | 52 | 0 | - | 0 | 47 |
| wildshape | base | 93 | 93 | 0 | - | 2 | 186 |
| wildshape | DND5E61 | 32 | 32 | 0 | - | 2 | 44 |
| wildshape | SKEW039 | 8 | 8 | 0 | - | 2 | 56 |
| companionsaves | base | 44 | 44 | 0 | - | 0 | 58 |
| companionsaves | MIDI1 | 46 | 46 | 0 | - | 0 | 69 |
| companionsaves | DND5E61 | 38 | 38 | 0 | - | 0 | 39 |
| companionsaves | SKEW040 | 7 | 7 | 0 | - | 0 | 13 |

Logs: `e2e/.out/logs/` (each run's log; `regress-lanes.out` and `times.tsv` now hold the rerun's one
line), `e2e/.out/build.out`. Copies are in `X/e2e/pass2/` (X = the v043 scratch folder): the pass's log
(`pass.log`), the rerun's log (`rerun-notesoffline.log`), the first try's `regress-lanes.out` and
`times.tsv`, `build.out`, and notesoffline's log from each try (`notesoffline.pass.out`,
`notesoffline.rerun.out`).
