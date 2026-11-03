# Report: builder W-b, Phase 3 (v0.43): fix round 1 (review of commit 14)

- **Status: ok.** Every finding was minor. WB-1 and WB-3 are fixed in one new commit. WB-2 is answered
  below and stays a Phase 4 item. Nothing was amended. No golden, kit file or existing assertion was
  edited. Nothing was pushed, and I wrote nothing in APP.
- **Branch:** `local/043-W-b` in /home/user/w043/W-b/sending-stone-player. Land the commits in this order:

| SHA | subject |
|---|---|
| 22dfe58 | refactor(checks): request checks by kind group, views in branches, the kind table read; mock base |
| 1c11a9c | chore(refactor): W-b's split of roll-requests.test.ts recorded in moves.d |
| 506ce72 | fix: v0.43 checks and mocks, round 1 (off fixtures make their own arrays; checkText gone) |

506ce72 changes 3 files, all W-b rows with phase 3: src/mocks/switches.ts, src/mocks/sending-stone.ts
and src/utils/requests/checks.ts. Its message ends with the brief's two trailers and names no model.
No other lane branch changes any of these files (I checked `git diff --name-only a2332a2 <branch>` on all
8 lane branches). No branch imports `@/mocks/switches`.

## Findings

### WB-1 (minor): fixtures sharing nested arrays. Fixed for the switch fixtures; NO_DICE kept, with the reason
- src/mocks/switches.ts: the two constants SWITCHED_OFF and OTHER_SYSTEM are replaced by one builder,
  `switchedOff(reason, more?)`. It is built like `switchedOn`: `{ enabled: false, kinds: [], reason,
  ...more } as const`, and `reason` is typed `'off' | 'system'`. Each call makes its own object and its
  own `kinds` array.
- src/mocks/sending-stone.ts: the 8 fixtures that shared an array now call the builder. Six of them were
  in the review: NOT_REMOVING, NOT_FAVORITING, EFFECTS_SWITCHED_OFF, EFFECTS_OTHER_SYSTEM,
  WILD_SHAPE_SWITCHED_OFF and WILD_SHAPE_OTHER_SYSTEM. The review missed two that had the same problem:
  DISHES_SWITCHED_OFF and DISHES_OTHER_SYSTEM (`{ ...SWITCHED_OFF, versions: [] }`), which shared
  `kinds` too. So, as at base, every fixture holds arrays of its own.
- Values and key order are unchanged (enabled, kinds, reason, then versions). C9 is green, and so is
  schemas/sending-stone.test.ts, which runs `toEqual` on these fixtures. Nothing outside src/mocks
  imported SWITCHED_OFF or OTHER_SYSTEM.
- I kept the NO_DICE spread in mockNoteCommand. R1.4.5 asks for it ("NO_DICE in the mocks"). Undoing
  it, or writing `...NO_DICE, extras: [], dice: []`, would undo that item. Nothing mutates these arrays or
  compares them by identity (the reviewer's grep, and mine: no push, splice, sort and so on, and no
  `toBe` on them). NO_DICE is a frozen-shape `as const` value that product code reads only.

### WB-2 (minor): src/utils/roll-requests.ts not emptied. Not changed in Phase 3; it stays a Phase 4 item
The finding agrees that the deviation is justified. src/utils/requests/check-damage.ts imports
`checkDamageDice` from `@/utils/roll-requests`, and its owners.tsv row lists phase `2b` only, so W-b
cannot retarget that import in Phase 3 (§2.2.1). Moving only isSeatCombatant and sheetUses would leave
roll-requests.ts half-emptied, and would add churn for G to redo. The Phase 4 item below now carries the
reviewer's full fix.

### WB-3 (minor): the CHECKS map built unevenly. Fixed inside checks.ts
- CHECKS' function type now takes `(input, sheet, links, features, combats, actorId)`. The links and
  features come first, in `checkLinked`'s own order, and checkRoll calls `check?.(input, sheet, links,
  features, combats, actorId)`.
- `checkText`, which only passed its arguments on, is gone. ask, textDamage and textRoll map straight to
  `checkLinked`.
- checkAbility and checkTool take `(input, sheet, links, features)`, without the two unused parameters.
  checkInitiative takes `(input, combats, actorId)`, without `_sheet`.
- The rule is now one sentence in the map's comment: a function named in the map takes CHECKS' parameters
  as they come, and an arrow picks out what its check reads (skill, death, initiative, attack, use,
  formula, itemDamage).
- Unused `_`-parameters across the map and its functions went from 14 to 8. Only arrows declare them now.
- I did not take the reviewer's other option, one encounter object: it needs a named type, which belongs
  in src/utils/requests/types.ts, and that file's row lists phase `2b` only. LINKED in check-linked.ts is
  unchanged: each function there needs only its leading parameters, and only linkedAsk and linkedSave
  have one unused leading `_input`, which their position requires.
- checkRoll's signature, exports and results are unchanged. Evaluation order is unchanged too: skill
  still checks `known(...)` first, then `linked(...)`, and every kind missing from the map still gets
  undefined. Its 264 checks.test cases are green.

## Checks (APP's tools, my worktree, on the tree committed as 506ce72)

| step | result |
|---|---|
| typecheck of the 3 files and their test readers (X/W-b/tscheck.cjs, under the shared lock) | 0 diagnostics over 1,155 files |
| eslint on the 3 files | exit 0, no output (no warnings) |
| L0 `--findRelatedTests` on the 3 files (X/l1/W-b/fix1/l0.log) | 157 suites, 5,817 tests, 1,001 snapshots, all passed |
| L1 (X/l1/W-b/fix1, X/l1/W-b/fix1.txt; 22:02-22:06Z) | jest 312 suites / 9,689 tests, 0 red, 0 flaky; typegen ok; tsc 0 errors; eslint 795 files, 0 errors, 653 warnings; gates 1 (5,665), 1b (288 files), 2 (8,607), 3 (312 / 9,689), 4, 4b, 5, 6, 7, 8, 9 (653 vs 981), 10 (991 golden tests, 24 frozen files held), 11, 12 (3 groups, base 4): all ok, `l1: 0 failed` |
| `next build` at 506ce72, clean tree, under wait and checks locks (X/l1/W-b/fix1-build.log) | exit 0; route list identical to the commit-14 build (X/l1/W-b/final-build.log); the usual Better Auth messages about a missing .env during page data |

The working tree had the same `git status` and diff checksum after the L1 as before it, so the
committed tree is the one the L1 tested. There were no reds, no reruns and no flakes. Gate 9 has no
folder-move key.

## Metrics this round moved
- eslint findings: identical to commit 14's L1 for every (file, rule) pair (0 keys differ), and still 653
  warnings. Cognitive complexity over 15 in my files: still 0. My lane's only findings are the base
  react-hooks findings and the 1 no-restricted-paths finding, which moved into checks.test.ts and
  check-damage.test.ts with their tests.
- Rule (a): no .tsx files in my lane. Rule (b): no exported type was added; switches.ts exports a
  function in place of two constants.
- Disables in my files: still 4, all line-level and each with a reason (fullscreen.ts:25,
  notes-server.ts:141, checks.test.ts:4006 and :4100).
- Cycles: none added (gate 12: 3 groups, base 4).
- Exports: the mock exports `SWITCHED_OFF` and `OTHER_SYSTEM` (src/mocks/switches.ts, new in commit 14,
  with no importer outside src/mocks) became `switchedOff`.

## Deviations from round.md
None in this round. The commit-14 deviations stand as reported below; WB-2 is deviation 4.

## Bugs logged
None this round. bugs-found.md is unchanged.

## Phase 4 items (unchanged in substance; item 2 now carries WB-2's fix)
1. eslint.config.mjs (G, commit 23, §0.6.6): the `files:` list that turns react-hooks off for
   roll-requests.test's pieces must name src/utils/requests/checks.test.ts and
   src/utils/requests/check-damage.test.ts. src/utils/roll-requests.test.ts carries no finding any more.
2. src/utils/requests/check-damage.ts (its row lists phase 2b only), WB-2: move isSeatCombatant,
   sheetUses and checkDamageDice from src/utils/roll-requests.ts into src/utils/requests/ (checkDamageDice
   beside check-damage.ts), and retarget the imports in check-damage.ts and checks.ts. Then delete
   roll-requests.ts and its 2-test remainder, roll-requests.test.ts, and point moves.d/W-b.tsv's rows for
   those 2 tests at their new files. Why: W.6 and owners.tsv meant the file to be emptied, and its name
   is easily confused with the requests/ folder.

## What integration must know
- 506ce72 lands after 1c11a9c and touches only W-b files. src/mocks/switches.ts's exports are now
  switchedOn, switchedOff and tableViewOf. Every name another lane imports keeps its path, name and
  value: the fixture exports, checkRoll and the rest.
- The rest of the commit-14 report below still holds: exports, the roll-kinds reads, moves.d, and no
  gate allowlist rows or ratchet keys.

---

# Report: builder W-b, Phase 3 (v0.43): commit 14

- **Worktree:** /home/user/w043/W-b/sending-stone-player, local branch `local/043-W-b`, made from a2332a2
  (`git worktree add` under X/git.lock, `df -h /` 26 GB free, then `npm ci` and `npx prisma generate`).
- **Status: ok.** Items R1.4.4 → R1.4.6 → R1.4.5 → R1.4.10 (round.md §2.4's order for W-b), each with an
  L0 and an L1 of its own, all green in the end; commit 14; the moves.d chore commit; `next build` green.
- **Nothing pushed.** My one write in APP: the [W-b] entry appended to R/bugs-found.md under X/bugs.lock.
  Scratch: X/W-b/ (split.cjs, routes.tsv, snapshot scripts, commit messages), X/l1/W-b/ (every L0/L1/build).

## Commits on local/043-W-b (after a2332a2; land in this order)

| SHA | subject |
|---|---|
| 22dfe58 | refactor(checks): request checks by kind group, views in branches, the kind table read; mock base |
| 1c11a9c | chore(refactor): W-b's split of roll-requests.test.ts recorded in moves.d |

HEAD 1c11a9c's tree is c7d18eb, the tree of the last green L1 (X/l1/W-b/R1.4.10b.snapshot). Both messages
carry the brief's two trailers and no model name. Files: src/utils/requests/{checks,check-linked,views,
commands}.ts, src/utils/requests/{availability,checks,check-damage,check-turns,status,views,commands}.test.ts
(new), src/utils/roll-requests.test.ts, src/mocks/{sending-stone,notes-server,slim-sheet}.ts,
src/mocks/{results,switches,types}.ts (new); .refactor/tools/moves.d/W-b.tsv (chore). All W-b rows of
owners.tsv with phase 3 (or the glob/`-` rows naming them); no other lane's file touched.

## Items

### R1.4.4 the request-kind table read (src/utils/requests)
- views.ts: D20_KINDS, DAMAGE_KINDS, SUMMED derived from ROLL_KIND_INFO with kindsWhere under their names
  (module-private sets, read only with `.has`). GM_ROLL_KINDS is gone: toGmRollView reads
  `ROLL_KIND_INFO[kind]?.gmLabel ?? 'A roll'` (§1.6: gmLabel "replaces" it); unknown kinds still get 'A roll'.
- commands.ts: GM_UNSENT = `new Set(kindsWhere(kind => 'gm' in ROLL_KIND_INFO[kind]))`: same export, type
  and iteration order (S's db/table.ts and db/roll-requests.ts import it unchanged).
- check-linked.ts: CHECK_TYPES became `checkTypeOf(kind)` (the table's `check`; `Object.hasOwn` first, as
  the old gate `Object.hasOwn(CHECK_TYPES, kind)` was). Only checks.ts (mine) imported CHECK_TYPES.

### R1.4.6 request checks by kind group; the test split
- checkRoll (cc 26): the activity-check pre-dispatch first, then a CHECKS map by kind group
  (`Object.hasOwn` before the lookup, so kinds absent from the old switch, and non-kinds, still get
  undefined). Case bodies moved verbatim into entries or small functions (checkAbility for ability and
  save, checkTool, checkText, checkInitiative, checkConcentration, checkInspiration, `linked`); existing
  checks keep their signatures.
- checkLinked (cc 49): same guards, then LINKED, one function per link kind: linkedAsk, linkedSave,
  linkedCheck, linkedDamage (+ linkedDamageDice), linkedRoll; any other kind 'link' as before.
- toRollRequestView (cc 23): outcomesOf builds the six trailing spreads once (transfer, removed,
  favorited, effect, wildShape, alone, that order), spread last in every branch; failedView and doneView
  hold the branches. Key order per branch unchanged (C2's view cases green).
- toGmRollView (20): d20Of, toldOf. checkAloneChoices (18): checkAloneSlot. checkEnchant (16):
  atProfileLevel.
- roll-requests.test.ts split verbatim by describe block (and inside feature blocks that test several
  modules, by test), describe titles kept, each piece carrying only the helpers its tests reach (X/W-b/
  split.cjs resolves them with the TypeScript checker). Tests per piece: checks 264, views 51,
  check-damage 28, check-turns 24, status 14, commands 12, availability 6, and roll-requests.test.ts keeps
  2 (isSeatCombatant, checkDamageDice: roll-requests.ts's own) = 401 as at base. moves.d/W-b.tsv: 41 rows.

### R1.4.5 NO_DICE in the mocks
- mockNoteCommand spreads `...NO_DICE` where mode/explicit/extras/dice sat (same key order). Its two
  arrays are now NO_DICE's shared ones; nothing mutates them (route.test.ts reads it, C9 serializes it).

### R1.4.10 the mock base
- src/mocks/results.ts DONE_HEAD: the eight CommandResult heads (moved, distributed, removed, favorited,
  dish, effect, wildShape, alone; beastsResult goes through wildShapeResult, so map W's "9" is 8 heads).
- src/mocks/switches.ts switchedOn, SWITCHED_OFF, OTHER_SYSTEM, tableViewOf (owners.tsv puts tableViewOf
  there). The fourteen switch constants stay in sending-stone.ts, one line each, each its own object
  (`{ ...OTHER_SYSTEM }`); the four table-view heads use tableViewOf (mockTableView passes its own title).
- notes-server.ts: the fetch fake (cc 32) split into read, order, add and change handlers, same order of
  checks (`made` stays the closure's counter; the id decode stays before the POST branch); its
  prefer-structured-clone directive now carries its reason (the line §1.7.2 lists for G).
- src/mocks/types.ts: ChosenFavorite (no importer outside sending-stone.ts), Sent, Answer, Json.
- C9 (every src/mocks export as ordered text) green: fixture outputs byte-equal.

## L0, L1 and build (APP's tools)

| step | result |
|---|---|
| L0 R1.4.4 | 56 suites, 1,962 tests ok; eslint: only the base cc warnings |
| L1 R1.4.4 (X/l1/W-b/R1.4.4) | jest 305 suites / 9,689 tests, 0 red, 0 flaky; typegen, tsc 0; eslint 0 errors 661 warnings; gates 1-12 ok |
| L0 R1.4.6 | eslint --fix: 0 errors (16 base warnings carried by the test pieces); 63 suites, 1,962 tests ok |
| L1 R1.4.6 | jest 312 / 9,689, 0 red, 0 flaky; tsc 0; eslint 655; gates 1-12 ok (gate 1b: 288 files; gate 3: 312 suites) |
| L1 R1.4.5 | as R1.4.6: all ok, 655 warnings |
| L0 R1.4.10 | eslint --fix 0; 148 suites, 5,969 tests ok |
| L1 R1.4.10 | **red**: tsc 1 error (src/mocks/notes-server.ts:159, TS2322); everything else ok. Cause: eslint --fix (unicorn/prefer-native-coercion-functions) rewrote my type-guard filter to `.filter(Boolean)` after my own typecheck; fixed with `note !== undefined` |
| L1 R1.4.10b (X/l1/W-b/R1.4.10b) | jest 312 / 9,689, 0 red, 0 flaky; typegen ok; tsc 0; eslint 795 files, 0 errors, 653 warnings; gates 1, 1b, 2, 3, 4, 4b, 5, 6, 7, 8, 9 (653 vs 981), 10 (991 golden tests), 11, 12 (3 groups, base 4) ok |
| `next build` (worktree at 1c11a9c, clean; X/l1/W-b/final-build.log) | exit 0; route list equal to Phase 2's build (X/l1/M/c58-fix2/build.log); the usual no-.env Better Auth/Prisma messages during page data |

No flakes, no red test reruns. Gate 9 had no folder-move key: every (unit, rule) change was a fall.

## Metrics my items moved
- Cognitive complexity > 15: my lane's 7 → 0 (checkRoll 26, checkLinked 49, toRollRequestView 23,
  toGmRollView 20, checkAloneChoices 18, checkEnchant 16, notes-server fetch fake 32). eslint: src/utils
  sonarjs/cognitive-complexity 19 → 13, src/mocks 1 → 0.
- Rule (a): no .tsx in my files. Rule (b): exported named types in .ts outside types.ts −1 (ChosenFavorite;
  src/mocks no-restricted-syntax 1 → 0); the three file-private mock types moved to src/mocks/types.ts too.
- Disables in my files: 4 before, 4 after, all line-level with a reason now (notes-server's gained one;
  the two test `no-useless-undefined -- found nowhere` moved into checks.test.ts; fullscreen.ts's stays).
- Cycles: none added (gate 12: 3 groups, base 4).
- Totals: eslint 661 → 653 warnings, 0 errors; jest 305 → 312 suites (7 pieces), tests unchanged.
- react-hooks findings in my files: base only, none new. roll-requests.test.ts's 15 rules-of-hooks moved
  with their tests: 14 to src/utils/requests/checks.test.ts (`useRequest`), 1 to check-damage.test.ts (`use`
  in `withering`); its base import/no-restricted-paths finding is in checks.test.ts.

## Deviations from round.md, and why
1. L1s ran on snapshot worktrees of my worktree (a dangling commit of its tracked and untracked files,
   detached worktree, node_modules symlinked; added and removed under X/git.lock), so work could go on
   while they queued for the locks (queues of 30-90 min). The committed tree equals the last green L1's.
2. R1.4.5's own L0 never ran: it was still waiting for the lock when R1.4.10's L0 (all six mock files,
   sending-stone.ts included, on a tree holding R1.4.5) was queued, so I stopped it; R1.4.5 had its own L1.
   The L0 for R1.4.10's one-line fix was stopped too once its L1 (a superset) had run green.
3. GM_ROLL_KINDS is removed (gmLabel read directly) and CHECK_TYPES became checkTypeOf(), rather than
   two constants "derived under their names"; the four sets are derived under their names.
4. src/utils/roll-requests.ts is not emptied: isSeatCombatant, sheetUses and checkDamageDice stay (only
   requests/ files import them, but check-damage.ts, whose row is phase 2b only, imports checkDamageDice).
5. The test split goes below describe level inside feature blocks (moves.d prefixes can be full test
   names), so each piece tests its own module; feature describe titles appear in several pieces.
6. notes-server's directive was given its reason now (§1.7.2 had G do it in commit 23).

## Bugs logged
One, tooling (R/bugs-found.md, "[W-b]"): eslint-plugin-unicorn 65.0.1's prefer-native-coercion-functions
autofix drops a type predicate (`(x): x is T => Boolean(x)` → `Boolean`), so `eslint --fix` can turn a
typechecking file into a TS2322. No product bug found in the checks, views, commands or mocks.

## Phase 4 items
1. eslint.config.mjs (G, commit 23, §0.6.6): the react-hooks-off `files:` list for roll-requests.test's
   pieces must name src/utils/requests/checks.test.ts and src/utils/requests/check-damage.test.ts;
   src/utils/roll-requests.test.ts no longer carries any finding. Why: R1.4.6's split moved them.
2. (optional) src/utils/requests/check-damage.ts (row phase 2b only): move roll-requests.ts's three
   remaining names into src/utils/requests/ and retarget check-damage.ts's import; roll-requests.ts and
   its 2-test remainder could then go (moves.d rows to update). Why: W.6 meant to empty it; no metric needs it.

## What integration must know
- Exports: CHECK_TYPES (check-linked.ts) is gone, checkTypeOf added (only checks.ts used it); ChosenFavorite
  moved from @/mocks/sending-stone to @/mocks/types (no other importer). Every other export another lane
  imports (GM_UNSENT, toCommand, toRollRequestView, toGmRollView, checkRoll, checkDamage, checkEndTurn,
  checkUndoTurn, availability, status, every mock name) keeps its path, name, type and output.
- My reads of src/constants/roll-kinds.ts (W-a's): ROLL_KIND_INFO's gmLabel, dice, damage, summed, gm and
  check, and kindsWhere. W-a lands first; the landing L1 after rebasing re-checks them with tsc.
- moves.d/W-b.tsv is in 1c11a9c (gates 1, 1b, 2, 3 read it from the checkout).
- No gate allowlist rows or ratchet keys are needed for this lane.
