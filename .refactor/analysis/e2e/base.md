# E2E baseline on commit 1

The full lane regression (`BUILD=1 npm run e2e`, `e2e/lanes/checks-lanes.sh`) on the app at commit 1
(1dff83f) plus `.refactor/` files only: the pass printed app `95d227d`; `a527cfc` (`.refactor/` only)
landed during it, and `git diff --name-only 1dff83f HEAD` lists nothing outside `.refactor/`. Module
`/home/user/fvtt-sending-stone` on main `94773cb` (v0.42.1), dnd5e 5.3.3 and 6.0.5 from its `.cache`
(DND5E5_DIR and DND5E6_DIR unset), Postgres 16.15 on localhost:5432, 4 cores. Held
`flock -o X/checks.lock` and `flock -o e2e/.out/e2e.lock` for the whole pass; RETRY off.

**Result: 104 of 104 runs exit=0 with oks=want, 0 failed, `exit 0`. No rerun was needed.**
`build errors: 0`. Wall time 3542 s (59m02s).

## Longest lane

| lane | runs | seconds | note |
|---|---|---|---|
| 0 (:3000) | 35 | 3541 (59m01s) | includes the solo toasts after the lanes (479 s); 3062 s without it |
| 1 (:3001) | 33 | 3061 | |
| 2 (:3002) | 36 | 3061 | |

Longest runs: toasts 479 s (solo), endturn 338 s, companions 312 s, companions DND5E61 307 s.

## Environment set up on the rebuilt machine (no app or module file changed)

1. Playwright 1.56.1 wants Chromium build 1194; `/opt/pw-browsers` (PLAYWRIGHT_BROWSERS_PATH) held only
   1243, so `chromium.launch()` failed. Ran `npm run e2e:browsers`, which put 1194 there.
2. Postgres had only the `postgres` role, so the first try stopped at `LANES NOT UP` (password
   authentication failed for `admin`). Created the role as `local/docker-compose.yaml` makes it:
   `create role admin with login superuser createdb password 'password'`.
3. The second try's build ran before the lane databases existed (`lanes-up.sh` builds, then
   `make_db`): `build errors: 6`, all Prisma P1003 "Database `sending_stone_e2e_0` does not exist"
   while collecting page data. Stopped it about a minute after the lanes came up, before any run finished, and started again;
   the databases existed by then and the build had 0 errors. This happens only on the first pass of a
   machine with no e2e databases; it is the environment, not the product.

## Runs (regress.sh's order)

`want`/`oks`/`exit` from `e2e/.out/logs/regress-lanes.out`; `lane` and `s` from `logs/times.tsv`.

| suite | variant | want | oks | exit | rerun | lane | s |
|---|---|---|---|---|---|---|---|
| organize | base | 43 | 43 | 0 | - | 1 | 24 |
| step3 | base | 39 | 39 | 0 | - | 2 | 53 |
| step2 | base | 66 | 66 | 0 | - | 0 | 15 |
| step1 | base | 36 | 36 | 0 | - | 2 | 20 |
| sheet | base | 60 | 60 | 0 | - | 0 | 49 |
| gm | base | 65 | 65 | 0 | - | 0 | 24 |
| gm | SKEW1 | 65 | 65 | 0 | - | 0 | 23 |
| conditions | base | 22 | 22 | 0 | - | 0 | 12 |
| late-setup | base | 4 | 4 | 0 | - | 2 | 6 |
| late-setup | SKEW1 | 4 | 4 | 0 | - | 2 | 5 |
| layout | base | 12 | 12 | 0 | - | 1 | 13 |
| favorites | base | 52 | 52 | 0 | - | 2 | 37 |
| rolls | base | 74 | 74 | 0 | - | 1 | 113 |
| attacks | base | 84 | 84 | 0 | - | 0 | 129 |
| attacks | MIDI1 | 86 | 86 | 0 | - | 0 | 128 |
| uses | base | 146 | 146 | 0 | - | 0 | 178 |
| uses | MIDI1 | 149 | 149 | 0 | - | 0 | 183 |
| prompts | base | 23 | 23 | 0 | - | 1 | 46 |
| prompts | MIDI1 | 25 | 25 | 0 | - | 1 | 55 |
| midi | MIDI1 | 65 | 65 | 0 | - | 2 | 163 |
| midi | SKEW026 | 10 | 10 | 0 | - | 2 | 42 |
| links | base | 119 | 119 | 0 | - | 0 | 152 |
| links | MIDI1 | 143 | 143 | 0 | - | 0 | 191 |
| activities | base | 100 | 100 | 0 | - | 2 | 95 |
| activities | MIDI1 | 105 | 105 | 0 | - | 2 | 91 |
| phone | base | 95 | 95 | 0 | - | 0 | 69 |
| rolling | base | 45 | 45 | 0 | - | 2 | 68 |
| rolling | MIDI1 | 47 | 47 | 0 | - | 2 | 66 |
| sync | base | 62 | 62 | 0 | - | 2 | 112 |
| favres | base | 21 | 21 | 0 | - | 0 | 9 |
| toasts | base | 149 | 149 | 0 | - | 0 | 479 |
| gmerr | base | 58 | 58 | 0 | - | 1 | 47 |
| gmroll | base | 70 | 70 | 0 | - | 1 | 101 |
| gmroll | SKEW1 | 6 | 6 | 0 | - | 1 | 18 |
| gmroll | SKEW024 | 70 | 70 | 0 | - | 1 | 97 |
| manualdice | base | 29 | 29 | 0 | - | 2 | 29 |
| manualdice | SKEW031 | 18 | 18 | 0 | - | 2 | 18 |
| typed | base | 159 | 159 | 0 | - | 2 | 278 |
| typed | DND5E61 | 61 | 61 | 0 | - | 2 | 102 |
| typed | MIDI1 | 163 | 163 | 0 | - | 2 | 294 |
| typed | SKEW031 | 7 | 7 | 0 | - | 2 | 16 |
| typed | SKEW041 | 15 | 15 | 0 | - | 2 | 32 |
| theme | base | 15 | 15 | 0 | - | 2 | 5 |
| damagecard | base | 31 | 31 | 0 | - | 0 | 43 |
| damagecard | MIDI1 | 44 | 44 | 0 | - | 0 | 56 |
| damagecard | SKEW027 | 42 | 42 | 0 | - | 0 | 58 |
| feedback | base | 144 | 144 | 0 | - | 1 | 179 |
| feedback | MIDI1 | 153 | 153 | 0 | - | 1 | 202 |
| feedback | SKEW028 | 48 | 48 | 0 | - | 1 | 78 |
| party | base | 64 | 64 | 0 | - | 2 | 62 |
| party | SKEW029 | 8 | 8 | 0 | - | 2 | 13 |
| fullscreen | base | 30 | 30 | 0 | - | 1 | 24 |
| settings | base | 22 | 22 | 0 | - | 1 | 31 |
| settings | MIDI1 | 24 | 24 | 0 | - | 1 | 35 |
| settings | SKEW029 | 11 | 11 | 0 | - | 1 | 11 |
| results | base | 29 | 29 | 0 | - | 1 | 63 |
| results | MIDI1 | 44 | 44 | 0 | - | 1 | 83 |
| results | DND5E61 | 12 | 12 | 0 | - | 1 | 24 |
| results | SKEW029 | 17 | 17 | 0 | - | 1 | 39 |
| transfers | base | 74 | 74 | 0 | - | 0 | 87 |
| transfers | DND5E61 | 78 | 78 | 0 | - | 0 | 90 |
| transfers | SKEW030 | 10 | 10 | 0 | - | 0 | 14 |
| givetake | base | 67 | 67 | 0 | - | 2 | 102 |
| givetake | DND5E61 | 68 | 68 | 0 | - | 2 | 103 |
| givetake | SKEW031 | 19 | 19 | 0 | - | 2 | 37 |
| removals | base | 81 | 81 | 0 | - | 0 | 76 |
| removals | DND5E61 | 47 | 47 | 0 | - | 0 | 28 |
| removals | SKEW032 | 9 | 9 | 0 | - | 0 | 13 |
| notes | base | 123 | 123 | 0 | - | 1 | 117 |
| notes | SKEW033 | 9 | 9 | 0 | - | 1 | 26 |
| partynotes | base | 58 | 58 | 0 | - | 0 | 103 |
| notesoffline | base | 47 | 47 | 0 | - | 1 | 294 |
| notesorder | base | 66 | 66 | 0 | - | 0 | 100 |
| notesorder | SKEW034 | 9 | 9 | 0 | - | 0 | 79 |
| companions | base | 138 | 138 | 0 | - | 0 | 312 |
| companions | MIDI1 | 139 | 139 | 0 | - | 0 | 304 |
| companions | DND5E61 | 138 | 138 | 0 | - | 0 | 307 |
| companions | SKEW035 | 9 | 9 | 0 | - | 0 | 15 |
| alone | base | 122 | 122 | 0 | - | 2 | 248 |
| alone | MIDI1 | 127 | 127 | 0 | - | 2 | 260 |
| alone | DND5E61 | 122 | 122 | 0 | - | 2 | 253 |
| alone | SKEW035 | 7 | 7 | 0 | - | 2 | 13 |
| alone | SKEW040 | 7 | 7 | 0 | - | 2 | 16 |
| endturn | base | 73 | 73 | 0 | - | 1 | 338 |
| endturn | MIDI1 | 77 | 77 | 0 | - | 1 | 258 |
| endturn | DND5E61 | 73 | 73 | 0 | - | 1 | 243 |
| endturn | SKEW035 | 5 | 5 | 0 | - | 1 | 13 |
| favoriting | base | 84 | 84 | 0 | - | 1 | 138 |
| favoriting | DND5E61 | 51 | 51 | 0 | - | 1 | 98 |
| favoriting | SKEW036 | 8 | 8 | 0 | - | 1 | 12 |
| cookbook | base | 92 | 92 | 0 | - | 1 | 170 |
| cookbook | DND5E61 | 10 | 10 | 0 | - | 1 | 16 |
| cookbook | SKEW037 | 10 | 10 | 0 | - | 1 | 55 |
| effects | base | 38 | 38 | 0 | - | 2 | 68 |
| effects | DND5E61 | 18 | 18 | 0 | - | 2 | 22 |
| effects | SKEW038 | 7 | 7 | 0 | - | 2 | 54 |
| campaigns | base | 52 | 52 | 0 | - | 0 | 47 |
| wildshape | base | 93 | 93 | 0 | - | 2 | 184 |
| wildshape | DND5E61 | 32 | 32 | 0 | - | 2 | 39 |
| wildshape | SKEW039 | 8 | 8 | 0 | - | 2 | 55 |
| companionsaves | base | 44 | 44 | 0 | - | 0 | 55 |
| companionsaves | MIDI1 | 46 | 46 | 0 | - | 0 | 61 |
| companionsaves | DND5E61 | 38 | 38 | 0 | - | 0 | 40 |
| companionsaves | SKEW040 | 7 | 7 | 0 | - | 0 | 12 |

Logs: `e2e/.out/logs/` (each run's log, `regress-lanes.out`, `times.tsv`), `e2e/.out/build.out`; the
pass's log and copies of the two small files in `X/e2e/base/` (X = the v043 scratch folder).
