# W-a report: WS1b, the request-kind table and the gates (Phase 1, 2026-11-03)

Builder W-a, worktree /home/user/w043/W-a/sending-stone-player, branch `local/043-W-a` (from
dd3a2ad, the branch head when made). Times in Eastern.

## 1. R1.6, the request-kind table (round.md §1.6): done, handed to T, not committed by W-a

Files (copied untracked into /home/user/w043/T/sending-stone-player at the same paths at 00:38 EST,
listed in X/handoff/r16-ready; T commits them in commit 2):

- `src/constants/roll-kinds.ts` (new): `ROLL_KIND_INFO`, one row per kind in ROLL_KINDS order (30),
  `as const satisfies Record<RollKind, RollKindInfo>`, with the fields of §1.6's table: `gmLabel`,
  `dice` ('d20' | 'hitDice' | 'recharge' | 'free' | 'none'), and where set `damage`, `summed`,
  `check` ('skill' | 'tool' | 'check'), `keyed`, `fromText`, `answers`, `gm: false`,
  `companion: false`, `own` (the campaign switch's field name) and `shaped`.
  `kindsWhere(pred)` = `ROLL_KINDS.filter(kind => pred(kind))`, the predicate taking the kind as
  R1.2.7 writes it (`kindsWhere(k => ROLL_KIND_INFO[k].check)`; it returns `unknown`, as `filter`'s
  does). `ANSWER_KINDS = ['save', 'ability', 'skill'] as const` (the Prisma `in` order, a literal:
  ROLL_KINDS order would be skill, ability, save). `OWN_KINDS: readonly RollKind[]` = the kinds with
  `own`, in ROLL_KINDS order = transfer, remove, favorite, effect, wildShape (the withheld/notOwn
  order). `NO_DICE`, declared exactly as use-table-rolls.ts:1011's PLAIN (`mode: 0, explicit: false,
  extras: [], dice: []`, `as const satisfies Pick<RollRequestInput, …>`).
- `src/constants/roll-kinds.test.ts` (new, node): 22 tests, table-driven: the rows' keys equal
  ROLL_KINDS in order; the ordered lists (EFFECT_DICE_KINDS' order from the d20 rows, ANSWER_KINDS,
  OWN_KINDS); every `.has`/`.includes`-only list as a Set (D20_KINDS, the schema's four dice
  branches with OWN_FIELDS' kinds, DAMAGE_KINDS ×3 sites, SUMMED, the check kinds ×5 sites, keyed and
  LINKABLE, FROM_TEXT, ANSWERS, GM_UNSENT, COMPANION_UNTAKEN, the shaped kinds); GM_ROLL_KINDS' 30
  words, CHECK_TYPES and the own-switch fields by kind; NO_DICE's JSON key order. Each literal is
  copied once from 24f808b and names its file:line. Green on today's code (L0 22/22); a planted wrong
  flag (`tool` shaped) fails one named test.
- `src/types/roll.ts` (tracked, modified): `RollKindInfo` appended at the end (44 lines, documented
  fields; nothing else changed). Its `check` is the literal union of CheckOption['type'] (CheckOption
  lives in utils/description-links.ts, which src/types may not import: zone 2).

Checks with the files in W-a's worktree: L1 with the gates below, 0 failed (jest 291 suites, 8,629
tests = 8,607 + 22; tsc 0; eslint 0 errors, 999 warnings: the 3 warnings in types/roll.ts are the
base's own `import/no-restricted-paths` ones; gate 3: 22 new tests, all in the new file).

T's commit 2 on local/043-T (850ceed) holds the three byte-identical to W-a's copies (checked with
`cmp` against X/handoff/r16/). After the gates commit, W-a's worktree was cleaned of them (roll.ts restored, the two new files
removed) so its branch rebases cleanly; the master copies are in X/handoff/r16/ (same paths, plus
roll.ts.diff). T's copies are byte-identical to them.

## 2. The gate scripts (round.md §3.4): commit 714c532 on local/043-W-a

`714c532 chore(refactor): the gate scripts (round.md §3.4)` — 29 files in .refactor/tools/, planning
files only (the R1.6 files left out).

| file | what |
|---|---|
| l1.sh `<outdir> <checkout>` | base.sh first (outside the locks), then under `flock l1-wait flock checks`: full `jest --ci --json --maxWorkers=3`, each red test rerun once alone (rerun.mjs → reruns.tsv), `next typegen`, `tsc --noEmit`, `eslint . -f json`, gates.sh. Prints `check jest/typegen/tsc/eslint ok/FAIL` and every gate line; exit = failed checks + failed gates |
| gates.sh `<outdir> <checkout> [ids…]` | runs gate-1 … gate-12 (with 1b, 4b), 3 at a time; a crash is a FAIL; exit = failed gates |
| gate-lib.mjs | the shared parts: the checkout and base, paths followed (moves.tsv `file` rows, git's `diff -M50% --name-status 24f808b` against the working tree, the checkout's moves.d), test structure (describe/it title paths, `.each`), expect lists, imports, jest mocks and factories, exports, TS module resolution (tsconfig paths, `@/`, src modulePaths, relative, packages; a virtual host over 24f808b's git objects for the base), closures, the import graph's strongly connected groups, the server graph |
| base.sh, base-tsv.mjs | X/base/: jest-base.json (seeded from WS0's X/jest-base.json; else a detached worktree at 24f808b runs jest under the locks), jest-base.tsv (file, fullName escaped, status, numPassingAsserts, occurrence), expects/, files/, base.json (4 cycle groups, 161 server modules, 20 client boundaries, 129 directives), all from git objects (no worktree needed) |
| gate-1 … gate-12, gate-1b, gate-4b | §3.4's gates, each writing `<outdir>/gate-N.txt` |
| framework-exports.txt | gate 6's baseline from 24f808b: 57 framework files (41 routes, equal to analysis/T/route-exports.txt, plus pages, layouts, not-found, manifest) and the two 'use server' modules' 15 names |
| gate4b.allow | 104 base cases (from the dry run), each with its reason: route suites whose db mocks leave out functions seat-routes.ts / notes-routes.ts / cookbook-routes.ts / campaign-events.ts import (never called there), the four GameTable suites' use-notes mocks without `draftChanged`, game-table.test and .party without `POLL_INTERVAL` (B20) |
| gate1.allow, gate1b.allow, shims.allow, counts.conf, moves.tsv, moves.d/.keep | formats only (no row is needed at the base) |
| rerun.mjs, replay.sh | the red-test rerun; L3 (`replay.sh [after] [until]`, REPLAY_OUT overrides X/replay) |

### Dry runs

- **Base** (a clean detached worktree at dd3a2ad, src = 24f808b's; node_modules symlinked): every
  check and gate green — jest 290 suites / 8,607 tests, typegen ok, tsc 0, eslint 0 errors and 999
  warnings (= ratchet-base.json), gates 1, 1b, 2, 3, 4, 4b, 5, 6, 7, 9, 10, 11, 12 ok, 8 n/a (no
  node kit before commit 2); 6.5 min under the locks (jest 189 s).
- **With the R1.6 files** (W-a's worktree): 0 failed, as in §1.
- **Replay** (`replay.sh 24f808b 1dff83f`, i.e. commit 1 alone, the chore(refactor) commits
  skipped, in a detached worktree removed after): 0 failed, every check and gate as on the base,
  5.4 min (X/l1/W-a/replay-dry/summary.tsv).
- **Mutations** (a scratch worktree and a scratch `git clone --shared`, both discarded; fabricated
  jest.json and eslint.json for gates 2, 3, 9, 10): each gate failed on its planted fault and named
  it — an expect changed (1, 1b); a fixture value changed outside any expect (1b); an import above
  a node suite's docblock (1b); a mock of nothing and a mocked key the module lacks (4); a full mock
  leaving out a name the route imports (4b); a constant copied into its reader (5); a route export
  added (6); a re-export-only module (7); 'use client' lost (11, twice: the directive and the server
  graph reaching use-hydrated.ts); a type-only cycle (12); a red test, fewer asserts, a missing test
  (2); a test added to a base file (3); a new warning over the ratchet and a lint error (9);
  snapshot.added = 1, a golden's body, its .snap and a kit file changed, a golden's .snap deleted
  (10); gate 8 with a node kit and no guardNoDb(). And each passed what must pass: a whole-file move
  with its import rewritten (git mv) and a split by describe block recorded in moves.d (1, 1b, 2,
  3), an import-only change to a committed golden (10), a red test green alone (2, as a flake).
- **T's tree as it was at ~01:15 EST** (static gates only, read-only): all ok but gate 1b, which
  FAILs on exactly the 18 files whose 3d-dice-react factory R3.3 replaces. With 18 gate1b.allow rows
  (X/handoff/gate1b-rows-commit2.tsv) gate 1b is ok there.

## 3. Deviations from round.md and why

1. **Two extra files**, gate-lib.mjs (what the 14 gates share) and rerun.mjs (the rerun alone of
   §2.3.6 inside l1.sh), beyond owners.tsv's list for R/tools; and **framework-exports.txt**, gate 6's
   baseline ("W-a adds the pages', layouts' and actions' lists to the baseline"): a file of its own
   rather than an edit of analysis/T/route-exports.txt (its routes are equal to that list).
2. **l1.sh's exit counts failed checks too** (jest, typegen, tsc, eslint), not only gates: a red new
   test or a tsc error must fail L1, and no gate sees them.
3. **Red tests are rerun alone by l1.sh itself** (≤ 20), and a base test red in jest.json but green
   alone passes gate 2 as a flake, listed in gate-2.txt (the brief's "rerun once alone before it is
   called a regression"). `check jest` counts such a test as flaky, not red.
4. **Paths are followed against the working tree**, `git diff -M50% --name-status 24f808b` (no
   `HEAD`), so a builder's L1 before its commit sees its own `git mv`s; at a clean commit (landing,
   replay) it is the same as `24f808b HEAD`.
5. **R3.3's replaced helpers are found, not listed**: gate 1b drops a base top-level helper the head
   no longer declares and imports (under any local name) from test-utils, test-utils-node or
   dice-renderer, instead of reading them from moves.tsv. It notes (does not fail) a helper whose
   JavaScript differs from the kit's under the same name: on T's tree only `respond` → `responding`
   in game-table.cookbook/notes/party (`Promise.resolve({...})` vs `Promise.resolve(respond(...))`,
   the same value).
6. **Gate 1 also holds the goldens' tests** (from the commit that added each), so gate1.allow's
   commit-26 rows mean something; gate 10 holds their whole text too.
7. **Moved names in mock factories** (gate 1b): instead of dropping a moved name's key, its
   `key: value` is compared apart as a multiset across the file's factories, so a value cannot change
   while the key moves to another module's mock; a factory left with only a requireActual spread
   goes.
8. **Gate 4 checks no package mock's keys** (50 at the base): a package's exports would need its
   .d.ts; its path must still resolve and be in the closure.
9. **Gate 11's "split from a 'use client' file"** is approximated: a new 'use client' module must be
   a component .tsx (JSX inside; not types, constants, utils or use-*), and each is listed in
   gate-11.txt for review; provenance is not traced.
10. **The allowlists hold base cases only**, as the task says: gate1b.allow has no rows, though
    §3.4 plans R3.3's 18 and R1.9.3's turn-toast rows; the 18 are ready in
    X/handoff/gate1b-rows-commit2.tsv for the orchestrator.
11. **W-a's worktree no longer holds the R1.6 files** (see §1), so the landing's rebase is not
    blocked by a modified roll.ts.

Scratch worktrees /home/user/w043/W-a-dry and W-a-mut and the scratch clone were removed after the
dry runs (`git worktree remove --force` on those two only); X/base/ stays (the gates' base).

## 4. Bugs logged (bugs-found.md, under the lock)

- (tooling, low) WS0's X/jest-base.tsv writes 12 fullNames holding line breaks raw, spilling them
  over 72 lines (8,668 lines for 8,607 tests); a hand check against it miscounts. The gates' own
  X/base/jest-base.tsv escapes them. (The first entry said 60 tests; a correction line follows it.)
- (note for R1.4.4) COMPANION_UNTAKEN's order is not ROLL_KINDS': only `.includes` reads it, but C9
  pins it as ordered text, so deriving it "under its name" from `kindsWhere` would change C9.

## 5. What later workstreams must know

- **Use**: `R/tools/l1.sh <outdir> <checkout>` (do not wrap it in flock: it takes the locks), and
  `R/tools/gates.sh <outdir> <checkout> 1 1b 4 4b 5 6 7 11 12` for the gates that need no jest run
  (read-only on the checkout; ~1 min). Details per gate in `<outdir>/gate-N.txt`. Until the commit
  lands, W-a's worktree path works (X/handoff/gates-ready).
- **T (commit 2)**: gate 1b FAILs on the 18 dice factories until the orchestrator adds their rows;
  new tests only in new files (gate 3); gate 8 starts once src/utils/test-utils-node.ts exists and
  wants `guardNoDb()` as a top-level statement in all 25 suites; gate 10 holds the kit and goldens
  from the commit that adds them (until then they are listed as not committed yet).
- **M (commits 5-8)**: moves.tsv lands with this commit (comments only); move.cjs and
  export-move.cjs append rows in M's format (handoff/moves-format.txt, acknowledged in
  moves-format-ack.txt). Gate 9 needs R/analysis/ratchet-moved.json as soon as src/features exists.
  A barrel's jest.mock split into several module mocks changes gate 1b's text (keys stay but the
  statements differ): it needs a gate1b.allow `mock` row per file, or the keys kept in one mock.
  R1.9.3's POLL_INTERVAL: the two gate4b.allow rows go unused after it (gate 4b notes them), and
  adding `POLL_INTERVAL: 3000` to those mocks changes gate 1b (an allow row).
- **Phase 3 lanes**: a split test file needs its rows in the worktree's
  `.refactor/tools/moves.d/<lane>.tsv` (`<base path>\t<describe prefix (a fullName prefix)>\t<path>`);
  gate 1b then holds each test's statement in the file its prefix names, every other statement of
  a piece to one of the base's at the same describe path, and every base statement to some piece.
- **R1.4.4 (W-a, Phase 3)**: S needs `[...ANSWER_KINDS]` / `[...OWN_KINDS]` where Prisma wants a
  mutable `string[]`; keep COMPANION_UNTAKEN's literal order (C9).
- **Replay (L3)**: `R/tools/replay.sh [after] [until]` skips chore(refactor) commits; summary in
  X/replay/summary.tsv.
