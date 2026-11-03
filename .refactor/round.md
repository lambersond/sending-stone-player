# v0.43 contract: the app refactor (draft, 2026-11-02 ~11:25 PM EST)

R = /home/user/sending-stone-player/.refactor · X = the scratchpad's v043 folder (brief.md) · APP = the
integration checkout · MOD = /home/user/fvtt-sending-stone (never edited) · FS = src/features/sheet ·
FR = src/features/rolling · FT = src/features/table · F = src/features · cs = src/components/character-sheet.
Line numbers are at 24f808b (src there equals HEAD 95d227d: only eslint.config.mjs, package.json and
package-lock.json changed since, in commit 1). Every file the plan edits, moves or creates is a row of
R/owners.tsv (path at base, path after, Phase 3 lane, phases, items, what it breaks, its disables).

## §0 Summary, principles, metrics

### §0.1 What v0.43 is

One PR in lambersond/sending-stone-player that reduces complexity so later work goes faster, without
changing what the app does: every request, response, status, header, stored row, visible string,
accessible name, id, data attribute and route stays byte-identical (§1.8), and the module
(lambersond/fvtt-sending-stone, main 94773cb = v0.42.1, PROTOCOL.md the wire contract) is not touched.
The scope is decisions Q1 (a): CLAUDE.md compliance plus merging code copied three or more times (one
request-kind table, one command pipeline, one request lifecycle, one settle hook, one seat resolver; the
sheet pane and the game table split into hooks), and not a shared poller and stores, an End Turn state
machine, a journal context or sheet rows fed from context. Bugs found are logged, never fixed (§4), and go
to ROADMAP under v0.44 in the roadmap commit (§4.5).

The shape (§1.0): `src/features/{sheet,rolling,table,notes,party,companions,campaigns,characters,
transfers,cookbook}/` with a folder per component, shared code at the lowest common ancestor of its real
importers, no barrels, no import cycles (type-only included), every .tsx exporting one component and
nothing else, named types in types.ts (or src/types/), business rules in utils, React behaviour in
localized hooks, integration suites in `__tests__/`. The work runs in six phases (§2): Phase 1 writes the
safety net (a test kit, eight golden suites, the gate scripts, the request-kind table as a new file);
Phase 2a moves files (one codemod, moves only) and turns `unicorn/no-null` off; Phase 2b moves, in one
commit and by one builder, every exported name another area imports to its final module, then adds the
few cross-area seams; Phase 3 runs nine builder lanes in parallel worktrees, each owning disjoint files;
Phase 4 does the few cross-area adoptions left, turns every CLAUDE.md lint rule to `error` with layered
imports, and writes ROADMAP; Phases 5-6 review, retire the whole-page goldens (Q4), replay every commit
green alone, run the final e2e and open the PR. 28 commits (commit 1 is already in: 1dff83f).

### §0.2 Principles (binding on every builder)

1. **Behaviour-preserving.** No product behaviour changes, visible or on the wire. A found bug goes to
   R/bugs-found.md (file:line, what, why, how to reproduce), never into the work.
2. **Tests are frozen.** No existing `expect` statement changes; a test file changes only in setup lines
   (imports, mocks' paths and keys, a guard line, a helper replaced by a byte-identical kit import) or
   moves with its unit (§3.1). Counts never fall (gate 3).
3. **Verbatim first.** A move or split first moves code unchanged (strings with ’ and · and class strings
   copied, never retyped; hook and effect order kept), proves L0/L1 green, then simplifies.
4. **KISS.** No new abstraction unless it removes three or more copies or a CLAUDE.md violation; every
   new helper in §1 names the copies it removes. Two-copy merges are out (Q1).
5. **One owner per file per phase** (owners.tsv). No edits to another lane's file in Phase 3; what two
   lanes need is a Phase 2b seam or a Phase 4 item (§2.2).
6. **Mocked surfaces stay.** Every name a `jest.mock` factory defines stays exported from the mocked
   module (§1.8.3), unless the mock is retargeted in the same commit; overridden constants stay read
   from their module at use time (gate 5).
7. **Honest checks.** L0/L1/L2 as §2.6; a check that didn't run is reported as not run. Locks per the
   brief. Every green commit in APP is pushed at once.

### §0.3 CLAUDE.md, rule by rule (where it stands and what v0.43 does)

| CLAUDE.md | at 1dff83f (metrics-base.md) | v0.43 |
|---|---|---|
| §1 SOLID/KISS/DRY with judgment | the five Q1 consolidations copied 5-21× (§0.5) | one each (§1.6, R1.1.1, R1.1.2, R1.3.2, R1.3.4, R1.9.2-4); two-copy merges out |
| §2 one exported component per .tsx, nothing else | 74 of 155 product .tsx break it, 70 export several things (303 one-export, 128 utility, 39 hook warnings) | 0: names other areas import move in 2b (R1.9.1), the rest in each lane; JSX-returning hooks become `use-*.ts` + one `*-dialogs.tsx` (§0.6.4) |
| §2 private helper components | allowed | stay beside their one exported user unless reused (U2's local components) |
| §3 types in types.ts | 171 named types in 94 product .tsx; 121 exported types in 48 .ts outside types.ts/src/types | 0 and 0; test files' file-private fixture types stay (not reusable, §0.6.6) |
| §3 shared constants in constants.ts | ~40 in .tsx/hooks (maps §2) | in the feature's or folder's constants.ts |
| §3 rules in utilities | ~120 pure functions inside components (roll-tray ~46, game-table 17, wild-shape 9 …) | moved verbatim to utils.ts beside their component, or src/utils when shared |
| §3 behaviour in localized hooks | RollingSheet ~1,050 lines, GameTable, Journal, useWildShape | split into named hooks in source order (R1.1.4, R1.5.5, R1.5.15, R1.1.5) |
| §4 colocate; LCA; features/ | flat src/components and src/hooks | §1.0 tree, by real importers (owners.tsv) |
| §5 server/client | clean; but sheet-tiles.tsx:11 and uses-button.tsx:7 pull utils/roll-requests (table-view, sheet-actions …) into the client for two small functions | isDying, sameCounter in utils/requests/status.ts (R1.9.1); zone 1 (§1.7.4) |
| §6 DB efficiency | indexes cover every hot filter (map S §9); double reads listed | report only (§1.10): no query change |
| §7 no cycles, `import type`, no barrels | 4 cyclic groups (1 runtime in src/db, 3 type-only); 27 barrels, 94 importers; `import type` complete | 0 cycles (import/no-cycle at error plus the metrics' type-only check), 0 barrels |
| §8 Jest: colocated units, integration in `__tests__/`, no overlap | 290 suites colocated, none in `__tests__/`, 0 snapshots | 41 integration suites into `__tests__/` (§3.3); goldens in src/__tests__/golden; overlap reported, not removed (assertions frozen) |
| §9 Sonar (sonarjs stands in, Q3), no silencing | 63 functions over 15; 430 disables (181 whole-file or range, 35 with no reason) | 2 functions held with a written reason (§0.6.8); ≤ 25 disables, all line-level with `-- reason`, none whole-file |
| §10 definition of done | | typecheck, lint (exit 0, no output), jest, build, e2e reported per commit and phase (§2.6) |

### §0.4 Metrics before and targets after

Before: metrics-base.md on 1dff83f (eslint with commit 1's rules at warn) and WS0's jest run.
After: `sh R/analysis/metrics/run.sh after <commit 24>` in commit 24's checkout (G, R1.9.30), into the PR.

| metric | before | after |
|---|---|---|
| eslint (666 files) | 0 errors, 999 warnings | 0 errors, 0 warnings, rules at `error` (§1.7) |
| .tsx breaking rule (a) | 74 of 155 product (0 tests) | 0 |
| named types in .tsx | 171 in 94 product files (+34 in 31 tests) | 0 product (tests' 34 file-private stay, §0.6.6) |
| exported named types in .ts outside types.ts and src/types | 121 in 48 files | 0 |
| cognitive complexity > 15 (sonarjs 4.2.2) | 63 functions in 41 files (top: GameTable 96, superRefine 84, apply 70, usedWords 56, createRollRequest 53) | 2, held with a reason: use-sheet-roller.ts:591 `roll` 32, :815 `rollDamage` 19 (§0.6.8) |
| import cycles | 4 groups (12, 6 runtime, 2, 2 files) | 0 |
| barrels | 27 index.ts, 94 importing files | 0 |
| eslint-disable comments | 430: 249 line, 6 range, 175 whole-file; no-null 250, no-useless-undefined 152 | ≤ 25 of today's kinds, all line-level with `-- reason` (§1.7.2); plus the react-hooks line disables a lane cannot fix without a timing change, each with its reason and listed in the PR (59 product findings today, 18 in wild-shape.tsx; expected ≤ 25 after the splits) |
| react-hooks findings | 101 (59 product, 42 in tests) | 0: product ones fixed (renames, splits) or line-disabled with a reason; the tests' harness rules off (§0.6.6) |
| import/no-restricted-paths | 29 (15 in tests) under the old zones | 0 under the new zones (§1.7.4) |
| request-lifecycle copies | 6 lifecycles, 4 controller sets | 1 `follow` + 1 `useFollow` |
| server command pipelines | 5 creators + the roll path's copy | 1 `createCommand` (+ transfer's own gates) |
| pane command senders | 10 in character-pane.tsx | 1 `command()` |
| settle hooks | 5 | 1 `useSettle` |
| seat resolution | 21 route files, 4 companion helpers, `notesSeat` | 1 seat-resolver.ts |
| request-kind facts by hand | 14 files (141 kind-keyed rows) | 1 ROLL_KIND_INFO, derived lists |
| `'sending' \|\| 'rolling'` | 13 sites in 13 files | 1 `onItsWay` |
| no-dice body tail | 11 sites in 9 files (+1 mock) | 1 `NO_DICE` |
| popover set-ups | 9 | 1 `usePopover` |
| `{'Cache-Control':'no-store'}` | 25 files | 1 `NO_STORE` |
| files over 500 lines | 120 (38 product) | reported, no target (Q3: no size caps) |
| jest | 290 suites, 8,607 tests, 25,284 passing asserts | 290 + 8 golden suites + new unit tests of new helpers; every base test present, passed, asserts ≥ base (gate 2); C1's tests retired in commit 26 |
| e2e | 104 runs over 49 suites, ~62 min on this machine | the same 104 runs, `oks=want` each, five passes (§2.6) |


**§0.4.1 The 63 functions over 15** are in owners.tsv's `breaks` column as `cc:<line>=<score>→<item>` (all 63 have an item; by lane: S 18, R-a 10, R-b 7, W-b 7, U2 6, V1 5, U1 4, V2 4, W-a 2; the two holds are `→held`).

**§0.4.2 Rule (a) files per lane** (74; owners.tsv `breaks` column `a:`): U1 12, U2 18, R-b 7 (use-dice-entry.tsx among them), V1 4, V2 33 (notes 6, campaigns 5, companions 4, modal 2, icons, page-toast, cookbook-entry, character-list, party-sheet; transfers 11); each fixed by the lane's one-export item (R1.1.6/7, R1.1.17, R1.2.8/10/11, R1.5.3, R1.5.15-21) after 2b's moves.

### §0.5 Facts (each re-read in the code at 24f808b; file:line)

1. Branch claude/dazzling-dirac-m8cq54 = 9ae1c44 + merge 24f808b + .refactor commits + 1dff83f (commit 1:
   eslint.config.mjs, package.json, package-lock.json only). HEAD 95d227d.
2. Base jest (WS0, X/jest-base.json at 54d8128, src = 24f808b's): 290 suites, 8,607 tests passed, 25,284
   passing asserts, 0 snapshots; 63 suites `@jest-environment node`; four (suite, fullName) pairs repeat.
3. Commit 1's rules (eslint.config.mjs): `tsxRules` (ONE_EXPORT, NO_HOOK, NO_UTILITY, NO_TYPE_EXPORT,
   TSX_TYPE; Next route files may add 18 framework names); TS_TYPE_EXPORT on `**/*.ts` but types.ts,
   `**/types/**`, .d.ts; react-hooks 7.1.1 recommended at warn; `import/no-cycle: 'warn'` with the
   TypeScript resolver; `sonarjs/cognitive-complexity: ['warn', 15]` (4.2.2); `unicorn/filename-case`
   ignores `^__tests__$` (not yet `^__snapshots__$`); `import/no-restricted-paths` (7 zones) warn;
   `@typescript-eslint/ban-ts-comment` off; `no-console` allows warn and error.
4. Cycles: one runtime, db/roll-requests.ts:18-23 → the five creators → back (`ago, madeBy,
   RollRejection`, transfers' `onItsWay`); type-only: 12 files around hooks/use-sheet-roller.ts and
   types/{party,roll,sending-stone,table} (types/roll.ts:20-21 import DamageModifiers, ExtraTerm from
   utils; formulas.ts:10 imports SheetFormulaRoll from the hook), use-table-rolls.ts ↔ move-words.ts:2-3,
   transfers/move-dialog.tsx ↔ recipient-list.tsx:9.
5. 27 barrels (modal/index.ts 37 importers, transfers/index.ts 0); seven are jest.mock targets in app and
   header tests.
6. The request lifecycle (POST `${api}/rolls` → 202 `{id}` → poll `no-store`): pure `follow`
   use-table-rolls.ts:1251; callers :303, :341, :800, use-transfers.ts:51, use-end-turn.ts:176,
   use-turn-undo.ts:156; the controller set + unmount abort 4× identical (:290, use-transfers :43,
   use-end-turn :163, use-turn-undo :140).
7. PLAIN (use-table-rolls.ts:1011, not exported) and its copies :545 :605 :836, use-transfers.ts:58,
   use-end-turn.ts:204, use-turn-undo.ts:177, characters/[id]/party/[group]/page.tsx:18, db/cookbook.ts:306,
   db/note-sync.ts:607 :636, mocks/sending-stone.ts:4028.
8. `'sending' || 'rolling'` at 13 sites: roll-tray.tsx:1059, action-entry.tsx:1413, effect-controls.tsx:201,
   wild-shape.tsx:337, character-pane.tsx:1528, give-controls.tsx:82, remove-controls.tsx:56,
   move-status.tsx:40, use-end-turn.ts:69, preparing.tsx:121, favoriting.tsx:120, end-turn-button.tsx:37,
   use-transfers.ts:87 (negated).
9. Settle copies: useFavorites favoriting.tsx:83 (timer :134), usePreparing preparing.tsx:77 (:135),
   useEffectControls effect-controls.tsx:159 (:227), useSlotWaits character-pane.tsx:1505 (:1541),
   useWildShape wild-shape.tsx:257 (:348); effect-controls.test.tsx:28 and wild-shape.test.tsx:33 override
   EFFECT_SETTLE, WILD_SHAPE_SETTLE in `@/constants/sending-stone`.
10. character-pane.tsx: 7 `setActed(true)`, 9 `if (lockedNow.current) return`; `inspire` (:1103) and the
    enchantment `end` (:1070) send without setActed.
11. 21 route files repeat session → 401 → lookup → 404; the two texts/[hash] routes answer 401 (and the
    player's both 404s) with no headers (characters/[id]/texts/[hash]/route.ts:18, 21, 23;
    campaigns/…/texts/[hash]/route.ts:15).
12. Body readers: seat-routes.ts:126 and notes-routes.ts:183 read before checking size; cookbook-routes.ts:159,
    events/route.ts:99, bridge/commands/route.ts:113 refuse a declared content-length first.
13. Request-kind facts by hand: §1.6's "replaces" column (utils/roll-requests.ts, schemas/roll-request.ts,
    constants/sending-stone.ts, roll-tray.tsx, db/roll-requests.ts, campaign-events.ts, use-sheet-roller.ts,
    use-table-rolls.ts); ROLL_KINDS has 30 (constants/sending-stone.ts:127).
14. POLL_INTERVAL = 3000 (use-table-view.ts:9), imported by game-table.tsx:60, turn-toast.tsx:16 (SETTLE_FOR
    :57), use-end-turn.ts:12 (OVER_FOR :28), use-notes.ts:8, use-party-sheet.ts:3, use-companion-view.ts:4.
    Of the suites mocking use-table-view only game-table.test.tsx:19 and game-table.party.test.tsx:20 omit
    it. **Probe** (this planner, a scratch worktree at HEAD, removed after): with `POLL_INTERVAL: 3000` added to those two mocks all 86 of
    their tests pass with identical numPassingAsserts, so moving the constant (R1.9.3) keeps gate 2 equal.
15. TurnToastContext (turn-toast.tsx:38) is read by roll-toasts.tsx:89 (rolling → table) and provided by
    game-table.tsx:904; `initials` (chat-log.tsx:783) is imported by creature-switcher.tsx:12.
16. NOT_MADE-like sets: turn-toast.tsx:46, roll-tray.tsx:548, use-spent-offers.ts:13 (UNSPENT): the same four
    statuses, read with `.has` only.
17. Hooks returning JSX (a `dialogs`/`dialog`/`menu`/`panel`/`modal: ReactNode` field): useLinkMenus,
    useD20Rolls, useDamageMenu, useConditionsPanel, useItemMenu, useActionInfo, useDiceEntry,
    useCookbookEntry, useGiveControls, useRemoveControls, useActionRows, useDamageRolls, useActivityMenu;
    functions returning JSX: concentrationLead, enchantedEntry, drawDescription, takeControls, partyControls.
18. `useTargetsOf` (use-picker.tsx:260) is a plain function called from a callback (:480) and in a branch
    (:777); use-picker.test.tsx calls it in 7 expect statements.
19. Product console output: use-sheet-roller.ts:581 (test-pinned), events/route.ts:209,
    campaigns/actions.ts:39, seat-routes.ts:107, bridge-http.ts:68, all `console.error`. One ts directive:
    use-notes.test.ts:254 `@ts-expect-error -- a browser with no fetch`. No NOSONAR.
20. jest.config.ts:16's `'index.ts'` pattern also matches campaigns/campaign-index.tsx; :20-21 already
    ignore the kit's two files.
21. Cross-lane surface (the planner's import graph of src with names, barrels resolved; owners.tsv's 2b notes): 218 names in 66 modules
    are imported by another lane and leave their module (529 import edges, 415 in product files).
22. e2e: 49 suites, 104 runs (e2e/README.md:5); `npm run e2e` = lanes/checks-lanes.sh; `RETRY=1` reruns
    failures alone; e2e/phone-e2e.mjs:330 reads `/^Effects, 1 conditions$/`.
23. ROADMAP.md v0.43: the refactor and "Supported versions"; v0.44 item 1: typed dice for every roll an item
    makes (the dice entry and the sheet roller's typed paths).

### §0.6 Choices pinned without a question

1. **Export moves before the lanes (Phase 2b).** Every name another lane imports that leaves its module
   moves once, verbatim, to its final module, by one builder with a codemod (R1.9.1); no
   `v0.43-shim` re-exports are planned (gate 7 keeps the list empty; a lane that cannot avoid one lists
   it in R/tools/shims.allow and G removes it in commit 23). Maps R, U1 and U2 asked for this
   (R.1, U1.7, ~45 shims each).
2. **W and R have two builders each** (W-a schemas/types/constants, W-b requests/mocks; R-a lifecycle,
   builders, roller and dice utils, R-b tray, toasts, menus, dice entry), disjoint files and worktrees:
   map W's 25 h and R's 21 h would otherwise be the critical path.
3. **The request-kind table is one file** (src/constants/roll-kinds.ts) written in Phase 1 as a new
   file with its equality test; the server's switch map is derived from it (OWN_KINDS), so S keeps only
   BRIDGE_SWITCHES and the hello maps in src/constants/features.ts. R's send* table (PLAIN_KINDS) reads
   its facts from it.
4. **JSX-returning hooks** (fact 17): 2b gives each its own `use-x.tsx` at its final path; its lane then
   renames it to `use-x.ts`, moves the JSX verbatim into one `x-dialogs.tsx` (one component), and the
   hook returns `createElement(XDialogs, props)` with the same field name. Import specifiers carry no
   extension, so no importer changes; the DOM is identical (one more component level, no DOM node).
   Functions returning JSX or `undefined` (concentrationLead, enchantedEntry, drawDescription,
   takeControls, partyControls) get the same shape: the function in a .ts returns `undefined` or
   `createElement(X, props)`, X in its own .tsx. Commit 1's lint enforces it (NO_HOOK, NO_UTILITY).
5. **Renamed exports keep tests' text.** A test imports a renamed export under its old local name
   (`import { targetsFor as useTargetsOf }`), so no expect changes (fact 18).
6. **Lint in tests:** test files keep every rule but these three, turned off for `**/*.test.{ts,tsx}`
   with the reason beside them: TSX_TYPE (file-private fixture types are not reusable, CLAUDE.md §3
   says reusable), `react-hooks/{rules-of-hooks,refs,globals}` (harness components and helper names
   such as `use`, `useRequest` inside frozen expects). 42 + 34 findings.
7. **`unicorn/no-useless-undefined: ['error', { checkArguments: false, checkArrowFunctionBody: false }]`**
   with its reason (an explicit `undefined` argument says "resolves to nothing", `.catch(undefined)`
   "left out"): with Q2's no-null off this leaves ≤ 25 disables, Q2's "about 30". `camelcase` gets an
   `allow` for the exact external names (`short_name`, `start_url`, `background_color`, `theme_color`,
   `Geist_Mono`, `bookId_noteId`): the Web App Manifest's, next/font's and Prisma's compound key.
8. **Two functions stay over 15:** useSheetRoller's `roll` (use-sheet-roller.ts:591, 32) and
   `rollDamage` (:815, 19), the typed-dice paths ROADMAP v0.44 item 1 rewrites, each with
   `// eslint-disable-next-line sonarjs/cognitive-complexity -- held for v0.44 item 1, which rewrites
   it`. Everything else over 15 is split (the dice parsers only with C8 green).
9. **Integration suites** go to `__tests__/` of the owning feature (41 files, §3.3); the 12 route suites
   over real db modules to src/app/api/__tests__/<route-path-dashed>.integration.test.ts; the GM
   routes.test.ts (db mocked) stays a unit suite.
10. **Contexts follow the existing convention** (hooks/use-creature.ts): a context and its use-hook in a
    `use-*.ts` (TurnToastContext → src/hooks/use-turn-toast-foot.ts).
11. **use-notes keeps its store** (hasDraft, journalOpen, useNotes are what four GameTable suites mock):
    V2 extracts pure helpers and the poll body only (map V2.4's store split is not done).
12. **POLL_INTERVAL and retryDelay are a 2b seam** (V1 S3 over V2.1): six product importers in three
    lanes; the probe (fact 14) shows the move is gate-2 neutral.
13. **CreatureHeader stays in companions**; the sheet imports it as a public component (folder edge
    sheet ↔ companions with no module cycle).
14. **ROADMAP v0.43 item 2 (Supported versions)** is not in this PR; the roadmap commit marks item 1 done.
15. **No rebase of pushed history.** "Each commit green alone" is proven by replaying L1 on each
    commit in a detached worktree (§2.6 L3), never by `rebase -x` on the branch.

### §0.7 Counts

28 commits (1 in, 27 to make; plus chore(refactor) report commits). 9 Phase 3 builder lanes in 4
workflows of 2 agents (W-b then R-b share a slot). 661 files at base (371 product, 290 tests): 354 move
(27 barrels deleted), 225 owners.tsv `-` rows (new files, file groups, files outside src). 218 names in 66 modules move
in 2b. 63 complexity functions (61 split), 74 rule-(a) files, 142 files with named types to move,
430 disables. 92 map items (T 10, S 14, W 11, R 12, U1 10, U2 12, V1 11, V2 12), each in the index of §1.11. 20 bugs logged (12 seen in code, 6 to confirm, 2 tooling) and 9 behaviour questions for v0.44 (§4).

### §0.8 What v0.44's items get from the new shape

Typed dice for every roll (item 1): the roller's pure parts in FR/utils/{local-rolls, entry-terms}, the dice
entry in its own folder, C8 pinning today's draws, the two held functions as the place to rewrite. Favorites
on the Character tab (2): FS/components/favorites split, checkLabel. Larger icon buttons (3): two class
constants. Hit points from the app (4): one ROLL_KIND_INFO row, a createCommand spec, a sendPlain row,
command() and useSettle. Manual dice in the dialog (5): DiceEntryDialog's folder. Help (6): side-panel,
usePopover, help-links. A plain die roll (7): a kind row, a schema group, a request-bodies builder. GM
clears chat (8): EVENT_HANDLERS and chat by kind. Remaining bugs (9): §4 in ROADMAP.

## §1 Target shape

### §1.0 The tree and placement rules

```
src/app/            routes, layouts, pages (V2); api/** and actions.ts (S); api/__tests__/ (12 route integration suites)
src/features/sheet/ (U1, U2)    components/<a folder per component>/ hooks/ utils/ types.ts constants.ts __tests__/
src/features/rolling/ (R-a, R-b) components/{roll-tray,roll-toasts,rolls-button,roll-button,roll-menu,modify-roll,d20-rolls,damage-menu,dice-entry}/ hooks/ utils/ types.ts constants.ts __tests__/
src/features/table/ (V1)        components/{game-table,chat-log,combat-tracker,turn-toast,end-turn-button,…}/ hooks/ utils/ types.ts constants.ts __tests__/
src/features/{notes,party,companions,campaigns,characters,transfers,cookbook}/ (V2)
src/components/     shared UI (V2; empty-state, live-status, local-time, fullscreen-* V1; chevron, entry-icon, description U2)
src/hooks/          app-wide hooks (use-stored … V2; use-table-api, use-waiting-prompts, use-turn-toast-foot V1; use-creature, use-rolls-locked U1; use-follow R-a; use-popover U2)
src/utils/          app-wide utils; requests/ (W-b); lifecycle, polling, initials, ask-words, roll-reasons, dice, save-title, seen-query, seat-urls
src/constants/ src/types/ src/schemas/ (W-a) · src/mocks/ (W-b; sheet-providers.tsx U1) · src/db/ src/lib/ src/lib/routes/ src/clients/ (S)
src/__tests__/golden/  C1-C8 (frozen)
```

Rules (binding on the codemods and the lanes):
1. **Real importers decide** (tests excluded): one feature's files only → that feature (the component's
   folder when one component uses it); several features, or a feature and a shared layer →
   src/{components,hooks,utils,constants,types}. owners.tsv `path_after` is that decision per file.
2. **A folder per component**; pieces split out of a file stay in its folder (types.ts, constants.ts,
   utils.ts, use-*.ts, one .tsx per component); a piece other features import goes to
   src/components/<name>/.
3. **Types:** the narrowest folder's types.ts; a type a shared layer or several features import →
   src/types/<domain>.ts (roll, sending-stone, table, party, notes, campaign, cookbook, seats, auth,
   prompts); db and lib types → src/db/types.ts, src/lib/types.ts, src/lib/routes/types.ts. A shared
   module never imports a feature's types (zone 4, §1.7.4).
4. **No barrels:** the 27 index.ts go in commit 5; importers point at the declaring module.
5. **No cycles, type-only included:** the metrics' cycle report runs after commits 5 and 7; a cycle left
   inside one lane's files is that lane's (R1.2.1, R1.4.9, R1.5.19); one across lanes is broken in commit 7.
6. **Server-only stays server-only:** src/db, src/lib (but app-origin and campaign-secret, which pages
   use), src/clients/prisma, src/auth.ts are imported by src/app server files and each other only.
7. **Next.js files** keep names and exports; `__tests__`, `__snapshots__` are private folders
   (node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md).

**R1.0.1 Whole-file moves (commit 5; M; Phase 2a; maps T.8, U1.1, U1.9, V1.1, R.11-12, W.11, S.13, V2 §4,
U2 §4).** Files: owners.tsv rows whose `path_after` differs (354, 27 barrels deleted). Steps: R/tools/
move.cjs (Phase 1): TS LanguageService `getEditsForFileRename` per rename (import, export, `require`,
`import()`, `typeof import()` specifiers); a second pass rewrites `jest.mock`/`requireActual`/
`requireMock`/`doMock` arguments, re-resolving relative ones from the new folder (use-dice-entry.test:7,
characters/[id]/page.test:25, characters/page.test:8, campaigns/page.test:9) and turning the seven barrel
mocks into module mocks; `git mv` per row; imports through a barrel point at the declaring module. No other
content change. Check: `git diff -M --stat` renames ≥ 90 %; gates 1-10; L1, build. Risk low. 1.5 h.

**R1.0.2 `unicorn/no-null` off (commit 6; M; Q2 (a)).** `'unicorn/no-null': 'off'` with its reason (the
protocol, Prisma and React use null for an absent value); the 250 directives removed (171 whole-file, 5
range, 74 line; a combined directive keeps its other rule); reportUnusedDisableDirectives proves none
served another rule. L1. 0.5 h.

### §1.1 Sheet UI (FS; U1 wiring, U2 parts)

The names other lanes import from these files moved in 2b (R1.9.1); what follows is lane-local. Line
numbers, split lists and words are the maps' (U1 §3-§5, U2 §2-§5).

**R1.1.1 (U1.2) One settle hook.** FS/hooks/use-settle.ts `useSettle({ states, settleMs, missing:
'waiting' | 'idle', agrees })` → `{ sent, last, waitingOf, settleNow, unsettle }`, timers and unmount
clean-up inside, settleMs read from `@/constants/sending-stone` at call time (gate 5). Steps: hook + unit
test (in flight; done-but-disagreeing until settleMs; missing state; refused/failed stop); then
useSlotWaits (→ character-pane/use-slot-waits.ts), usePreparing and useFavorites ('idle'),
useEffectControls ('waiting', send guard and focus kept), Wild Shape in R1.1.5; in-flight by onItsWay
(R1.9.2); the unread `at` fields go. L0 each. Pins: favoriting, preparing, effect-controls, wild-shape,
charges, use-spent-offers suites; C2, C4; e2e favoriting, favorites, favres, effects, wildshape, uses.
Medium (the missing-state difference). 2 h.

**R1.1.2 (U1.3) One `command()`.** character-pane/use-pane-commands.ts `command(log, send, { acts = true
})` → local id, order kept (setActed, log, send); `acts: false` for `inspire` and the enchantment `end`
(fact 10, bug B14 kept), ask marks `described`; builds the `…Of` senders and the enchanting,
concentrating, charging objects. Pins: character-pane, charges, enchantments, favorites, effect-controls,
wild-shape suites; C2, C7; e2e uses, favoriting, effects, wildshape, links, prompts. 1.5 h.

**R1.1.3 (U1.4) One actions object.** `useRollActions({ table, roller, picking, lock })` → `{ onRoll,
onRollDamage, onRollFormula, onUse, tableDamage }` once (the `favorites` and `handlers` copies);
`useDescriptionLinks` builds `descriptions` with `blockedReason` in utils.ts (words exact); the 9 lock
guards → `unlessLocked(fn)` checked at call time. Pins: character-pane, description-link, favorites,
action-entry.alone suites; e2e links, attacks, activities, alone. 1 h.

**R1.1.4 (U1.5) The pane as composition.** Hooks in call order (effects keep their order): usePaneLock,
usePromptAnswers, useTrayTriggers, useTypedRolls, useGiveRemove (V2's hooks unchanged), usePaneStatus,
usePicking (its render-time `setPicking(undefined)` stays render-time), useSheetTabs, useFavoritesLayout,
useDueDamage, usePaneCommands, useSlotWaits; components SheetTabs, SheetPanel, SheetContext, PaneContext
one per file; types → types.ts, TABS … FAVORITES_COLUMN → constants.ts; the local `use` callback
(rules-of-hooks :729, :846) renamed. Target ≈ 200 lines; RollingSheet (42) and `pick` (:825, 17) ≤ 15; no
new memo. Pins: the six CharacterPane integration suites; C1-C3; e2e sheet, step1-3, phone, layout,
toasts, typed, manualdice, companions, prompts. Medium-high. 3 h.

**R1.1.5 (U1.6) Wild Shape split.** wild-shape/: types.ts, constants.ts, context.ts, utils.ts (agrees,
rowOf, isRow, titleOf, formStats, cardName, nextOffered, backButton, reasonWords, arrows), use-wild-shape.ts
composing useWildShapeCommands (with the settle effect :445-493 on useSettle), useWildShapeDialog,
useWildShapeFocus, useBeasts, useReturnConfirm; use-wild-shape-row.ts; one .tsx per component (map U1.6's
list, BeastCard split from BeastList). Effect order settle → focus → return-confirm; the returned object
stays unmemoized; :445 (17) ≤ 15. Pins: wild-shape (58), wild-shape-ended (8), the tabs' Wild Shape cases;
C1, C2, C7; e2e wildshape. Medium. 3 h.

**R1.1.6 (U1.7, lane part) Context modules one export per file** (favoriting, preparing, effect-controls,
enchantments, concentration, conditions-panel, description-actions, favorite-mark): what 2b left, into
their folders; NO_* → constants.ts. No logic change. Low. 0.75 h.

**R1.1.7 (U1.8) The other files.** character-sheet.tsx: ModeChip → mode-chip/, PROFICIENCY →
FS/constants.ts, modeText → FS/utils/class-line.ts, Props → types.ts; the four roll-button labels
(character-sheet.tsx:443, :478, :539, favorites.tsx:488) → FS/utils/roll-labels.ts `checkLabel`, strings
exact. favorites.tsx → strip, column, list, row + types/constants. sheet-settings: Props, RESULTS,
aloneHint out. conditions/constants.ts (from constants/conditions.ts): its 2 types → conditions/types.ts.
conditions-reference split only if over 15. Pins: character-sheet (34), favorites (40), party-sheets,
sheet-settings (20), conditions-reference suites; C1, C4; e2e settings, conditions, favorites. 1.5 h.

**R1.1.8 (U1.9) Sheet hooks.** Moves in commit 5 (use-sheet-ids, use-spent-offers, use-width → FS/hooks;
use-creature, use-rolls-locked stay in src/hooks: rolling imports them; use-creature-choice → FT/hooks).
useSpentOffers' layout effect (:92, 18) → useSpentSet + useSpentRemovals, order kept; UNSPENT → NOT_MADE
(R1.9.4). Pins: use-spent-offers, use-width suites; e2e typed. 0.5 h.

**R1.1.9 (U1.10) Recheck.** sonarjs over U1's files to 0 (expected: useEffectControls' focus effect →
useDeleteFocus, BeastList, ConditionsReference); react-hooks findings cleared without timing change or a
reasoned line disable (§1.7.2). 1 h.

**R1.1.10 Bridges for U1's JSX returners** (§0.6.4): use-conditions-panel, concentration-lead,
enchanted-entry → `.ts` + one component each. Callers untouched. Pins: their suites; C1. 0.5 h.

**R1.1.11 (U2 S.1) Picker rules out.** use-picker/utils.ts: the ~22 pure functions of map U2 S.1 (pillOf …
enchantPicks; asks, enchantPicks, selfPick moved in 2b), `targetsFor` (was useTargetsOf, renamed in 2b,
§0.6.5), defaultSlot (:504, :634), movedOff (:952-964); constants.ts, types.ts. Pins: use-picker(.alone),
action-entry.alone, slot-words, character-pane suites; e2e attacks, uses, alone, activities, feedback.
Low. 1.5 h.

**R1.1.12 (U2 S.2) The picker one file per component** (use-picker, choices, alone-choices, spend-switch,
chip-row, chip, profile-choice, enchant-what, who, sections, target-list, tick-list, go; use-choices.ts,
use-alone-choices.ts); `whomOf()` returns a tagged step (Choices :605, 29 → ≤ 15). Pins: as R1.1.11 + C1.
Medium (first-chip focus ref, aria-live text). 2 h.

**R1.1.13 (U2 S.3) action-entry split** per map U2 §2 (action-entry, activity-entry, activity-info-button,
action-details, chip-uses; use-action-rows and use-damage-rolls as bridges; use-activity-menu.ts; the 9
types, KINDS, FROM_APP, the 19 utilities + local helpers); `damageMenuChoices`, `aloneKindMenu`,
`entryDetail()` pure; onMenu (:477, 20) and roll (:391, 16) ≤ 15. Pins: action-entry(.alone), actions-tab,
charges, recharge-chip, favorites, character-pane suites; C1, C2; e2e damagecard, alone, attacks,
activities, uses, rolling, typed. Medium. 2.5 h.

**R1.1.14 (U2 S.4) One chip cluster.** action-chips/: `ActionChips({…, damage: 'inline' | 'none'})` for the
three chip rows (action-entry:1251-1293, actions-tab:552-583, :700-731; each keeps its span/td wrapper),
`UsesChips` for the three uses clusters (UsesCell keeps `data-uses`); row-name/ for the name block ×3;
action-entry/use-action-menu.ts for the two identical useItemMenu calls. Pins: actions-tab (3,441 lines),
action-entry suites; C1; e2e layout, organize. Medium. 1 h.

**R1.1.15 (U2 S.5) Description links** split per map U2 §2 with link-pill.tsx (the PILL/LOCKED class of
the save, check, formula and damage pills, `disabled={locked}`), use-link-menus as a bridge, utils,
constants, types; `damageRequest()` (rollDamage's key order kept). Pins: description-link (2,345),
sheet-text, description-html suites; C1, C2; e2e links, conditions, prompts. Medium. 1.5 h.

**R1.1.16 (U2 S.6) usePopover.** src/hooks/use-popover.ts `usePopover({ open, onOpenChange, anchor?,
point?, placement?, gap?, across?, fit?, escape? })` → `{ refs, floatingStyles, context, root }` owning
usePortalRoot, useTopmostEscape, `useFloating` (autoUpdate, middleware in today's order) and the point
reference; interactions stay at each call site. U2's four adopt (uses-menu:55-77, hit-dice-menu:97-121,
ExactAmount :303-315, ConditionTip :970-987); the other five are R1.9.20. Pins: charges, press-menu,
hit-dice, inventory-tab, description-link suites; C1 (portals); e2e step2, conditions, uses. Medium. 1.5 h.

**R1.1.17 (U2 S.7) The rest one export per file** per map U2 §2: action-info, actions-layout, effects-tab,
features-tab (plainAction → utils), hit-dice (+ use-hit-dice-choice.ts), inventory-tab, prompt-banner,
recharge-chip (→ action-chips/), sheet-entry, sheet-tiles (one file per tile), spell-slots, spells-tab,
uses-button (uses-left, uses-menu, useUsesStep), item-menu (bridge; its 10 MenuItem consts →
constants.ts), press-menu.ts (PressProps, DRIFT, CONTROLS); local components stay beside their user
unless reused; the types of FS/utils/{slot-words, enchantments, damage-alone} → FS/utils/types.ts (the
shared utils' types went to src/types in 2b); damage-alone's alone-choices re-export removed; the three
no-img-element reasons onto their directives. Pins: each file's suite + character-sheet, party-sheet,
creature-header suites; C1. Low. 2 h.

**R1.1.18 (U2 S.8) Shared pieces.** Chevron, EntryIcon, read/drawDescription moved in 2b; here
description/types.ts and drawDescription as a bridge whose component holds the recursive `draw` as a
tag → props table (draw :152, 41 → ≤ 15). Pins: chat-log, party-sheet, notes, description-html suites;
C1. Medium. 1 h.

**R1.1.19 (U2 S.9) Save title.** src/utils/save-title.ts for the four wordings (description-link:272,
prompt-banner:199, utils/table-view.ts:392-402, db/table.ts:384-396) with an option per difference; a
table test pins today's four outputs first; U2 adopts its two, S's are R1.9.21. Pins: description-link,
prompt-banner, seat-words suites; C4; e2e prompts, links, companionsaves. 0.75 h.

**R1.1.20 (U2 S.10) Complexity and hooks.** What R1.1.12-18 leave: ItemEntry (:411, 20), useItemMenu
(:131, 17) by a menu-items table, SheetEntry and HitDiceMenu in parts; react-hooks findings in U2's files.
2 h.

**R1.1.21 (U2 S.11) Switch track: not done** (§1.10). **R1.1.22 (U2 S.12, U1 §7) Tests follow:** units
beside their unit, the sheet's integration suites in FS/__tests__ (§3.3), import lines only. 0.5 h.

U1 ≈ 14.5 h (commit 17). U2 ≈ 16 h (commit 18).

### §1.2 Rolling core (FR; R-a lifecycle, builders, roller, dice utils; R-b tray, toasts, menus, dice entry)

What 2b moved out of rolling's files (owners.tsv's 2b notes; map R §6's shim list, all of it) is not
repeated here.

**R1.2.1 (R.1) Types and constants out (R-a).** The area's remaining named types (TypedEffect, TypedOffer,
More, Press, Part, FormulaGroup …) → FR/types.ts, R-b's component types → their folder's types.ts;
shared constants → FR/constants.ts; the rolling legs of fact 4's type cycles end (formulas.ts:10,
move-words.ts:2-3 read src/types/roll.ts since 2b): the cycle report shows none in R's files. Pins: tsc;
MOST_EXTRAS = MAX_EXTRAS (.typed). Low. 1 h.

**R1.2.2 (R.2) One lifecycle (R-a).** use-table-rolls' start (:303), startEach (:341, its busy loop kept)
and readWildShapeForms (:800) on useFollow (R1.9.4); PLAIN (:1011) and its copies (:545, :605, :836) →
`...NO_DICE` in place; `follow` (25) split into post, poll and late stages with the same awaits and timers.
Pins: use-table-rolls.test (polling, expiry, late, busy, abort), use-transfers, use-end-turn, use-turn-undo
suites; C2; e2e rolling, rolls, endturn, givetake, typed. Risk: fake-timer order. 2 h.

**R1.2.3 (R.3) Builders and the send table (R-a).** toRollRequest, toFormulaRequest, toHitDiceRequest,
toHitDieRequests, activityCheck (reads ROLL_KIND_INFO[kind].check), formulaOrigin, damageDice, modeOf, the
damage and recharge bodies → FR/utils/request-bodies.ts with `typedFields` (7 identical tails; :1389-1395
keeps its order) and `damageTail`; FR/utils/request-kinds.ts `PLAIN_KINDS {gate, body, kept, label}` + one
`sendPlain` for the 14 switch- or log-gated send* (names kept); sendDamage (:423, 30) ≤ 15. Pins: C2 (every
body as a string), use-table-rolls.test's JSON.stringify bodies. Risk: key order. 3 h.

**R1.2.4 (R.4) State reducer (R-a).** FR/utils/roll-states.ts `rollStates(held, action)` (way, together,
damaged, offer) + together, answeringOf, dueOf, busy, known, added, partly; functional setStates kept.
Pins: use-table-rolls, needs-player suites. 1.5 h.

**R1.2.5 (R.5) GM rolls (R-a).** gmRollsOf, namesOf, heardOf → FR/utils/gm-rolls.ts; useGmRolls keeps its
render-time setState. Pins: the GM block of use-table-rolls.test; e2e gm, gmroll, gmerr. 1 h.

**R1.2.6 (R.6) Damage due (R-a).** typesFor, chosenLabel, termsOf join damage-due.ts (moved in 2b with
damageRollOf, choicesOf, damageDue, needsPlayer, missed). 0.5 h.

**R1.2.7 (R.7) Sheet roller split (R-a).** The ~16 pure helpers of map R.7 → FR/utils/local-rolls.ts;
damageEntryTerms, formulaEntryTerms, typedSoFar → FR/utils/entry-terms.ts (moved only); the nine log*
share one private `keep(fields)` (same counter order and Date.now() calls); roll and rollDamage unchanged
(§0.6.8). Pins: the three roller suites (the elven-off mock follows typed-dice in commit 5), C8; e2e
manualdice, typed. 2 h.

**R1.2.8 (R.8) The tray one export per file, words per kind (R-b).** Verbatim first: words → tray-words.ts,
gm* (:1663-1803) → gm-words.ts, accentOf, madeIt, checkDice, tableLine, toneOf → brief.ts, one .tsx per
component under FR/components/roll-tray/ (map R §4's 20), BADGES, BADGE_ICONS, GM_WORDS → constants.ts.
Then `wayWords(state, role, words, reason)` for the 7 way-word copies (usedWords' favorite, effect,
prepare, wildShape, use; askedWords; gmLine), StatusLine for the 4 status lines (span wrapping and EyeOff by
prop), breakdown (:1986, 36) by a table; usedWords (56), TableMark (27), gmLine (27), tableLine (17), briefOf
(16) ≤ 15; DAMAGE_KINDS (:1652), gmShape, gmVerbs read ROLL_KIND_INFO; NOT_MADE (:548) → R1.9.4's. The
rolling → sheet edge (useSpent, Spent) stays listed (§1.7.4). Pins: roll-tray (5,152), .critical,
seat-words, charges, needs-player; C1, C4; e2e results, rolls, damagecard, alone, uses, favoriting,
effects, wildshape. Risk: spans, class order, useId order (DamageBehind). 4 h.

**R1.2.9 (R.9) Toasts (R-b).** popToasts (FR/utils/roll-toasts.ts:102, 40) ≤ 15; useToastSetting,
useToastTop (the turn foot from useTurnToastFoot), Toast, Badge own files. Pins: roll-toasts (2,055),
utils/roll-toasts, turn-toast suites; C1, C4, C7; e2e toasts. 1 h.

**R1.2.10 (R.10) Small components (R-b).** ModifyDamage own file; labelsFor, criticalHint → damage-words.ts;
use-d20-rolls, use-damage-menu bridges (d20-dialogs.tsx, damage-dialogs.tsx); `rollOf` in
FR/utils/sheet-rolls.ts for d20-rolls :37-43, :54-60, modify-roll :47-55 (description-link:1108 is
R1.9.24); usePopover in roll-menu, rolls-button is R1.9.20. Pins: roll-button, roll-menu, modify-roll,
rolls-button, description-link, action-entry suites; C1; e2e rolling, sheet, phone. 2.5 h.

**R1.2.11 (R.11) Dice entry (R-b; v0.44 item 1: moved only).** dice-entry/ moved whole in commit 5 (barrel
gone, faces.ts beside the dialog); DiceKey, Asked → types.ts; use-dice-entry.tsx → bridge; Entry is under
15 by sonarjs. Pins: dice-entry suites (use-dice-entry.test's `./dice-entry-dialog` mock re-resolved),
character-pane.test:79's mock path, C8; e2e manualdice, typed. 0.75 h.

**R1.2.12 (R.12, R §7) Tests follow; use-hold; hook findings.** use-hold moved to FT/hooks in commit 5 (V1's);
the react-hooks findings in R-a's and R-b's files (use-table-rolls.ts:843's `[]`, where adding `start`
changes nothing; the tray's refs) fixed without timing change or given a reasoned line disable. 0.5 h.

**R1.2.13 (R §9) The dice parsers (R-a), only with C8 green.** readModifier (dice-modifiers.ts:95, 43),
throwTerm (:183, 29), rethrow (:251, 26), formulaTerms (formulas.ts:32, 30), parseExtraTerms
(roll-modifiers.ts:40, 22), groupTakesAway (damage-modifiers.ts:270, 20): extract-function, reads in the
same order; isDieSides at roll-modifiers.ts:56, formulas.ts:46. Pins: their suites, C8, C2. Medium. 2 h. A
split that cannot keep C8 and the suites green in that time is held with a reason and named in the PR.

R-a ≈ 13 h (commit 15), R-b ≈ 8.5 h (commit 16).

### §1.3 Server (S)

**R1.3.1 (S.1) The db cycle gone.** ago, madeBy, onItsWay → src/db/commands.ts; RollSeat, RollRejection →
src/db/types.ts; importers rewritten (no suite imports or mocks them). The cycle report shows 0 in src/db.
Pins: the 6 creator suites, route suites. Low. 0.5 h.

**R1.3.2 (S.2) One command pipeline.** commands.ts: seatBusy (same `where` objects and Promise.all order),
inRoster, commandPayload (spread then delete: key order kept), holdCommand, `createCommand(seat, input,
spec)` for effect, favorite, wildShape, remove (spec: kind, field, playerOnly, switchField, available,
waiting {kinds, select, skip?}, check, clashes, keepGmLabel); transfer keeps its own gates and uses seatBusy
and holdCommand. One creator at a time, L0 each. Pins: the creator suites (every prisma arg),
roll-requests.test; C5, C7; e2e favorites, favoriting, effects, wildshape, removals, transfers, givetake.
Medium (ladder order; the `forms` skip). 2.5 h.

**R1.3.3 (S.3) The kind table's switches.** Own-switch kinds and fields from ROLL_KIND_INFO (OWN_KINDS,
ROLL_KINDS order = the pinned withheld/notOwn order); BRIDGE_SWITCHES (markBridgePolled's 8, in order) in
src/constants/features.ts; db/roll-requests.ts:152-172 (dispatch by a local map), :562-582, :706-744, :154,
:160, :225, :323 (the Prisma `in` keeps its order); commands route :173-182; campaign-events.ts:155-162,
:251-256; the GM refusals favorites.ts:45, effects.ts:42, wild-shape.ts:49; the five `*Available` bodies →
`switchOn(campaign, field, now)` (names kept). Pins: roll-requests, commands route, campaign-events,
table, charges suites; C5, C6; e2e all lanes. Low-medium. 1.25 h.

**R1.3.4 (S.4) One seat resolver.** src/lib/routes/seat-resolver.ts: playerAt, gmAt, companionAt,
companionRollAt, partyAt, `seatAnswer(params, find, answer, {headers})` (getCurrentUser → 401, `await
params`, find → 404, answer), calling the mocked paths (§1.8.3); the four companion-routes helpers go; the
two texts/[hash] routes keep their header quirks (fact 11, bug B16) and the companions' texts their hash
check; notesSeat on playerAt/gmAt with its stricter player check; route files stay `export async function
GET(…, context: RouteContext<'…'>)`, 5-10 lines. Pins: the 34 route suites, notes-routes, companion-routes;
C5; e2e gm, companions, notes, partynotes, party, sheet. Medium (per-route headers). 2 h.

**R1.3.5 (S.5) NO_STORE and the answers.** src/lib/routes/http.ts: NO_STORE (25 files), `bare(status,
headers = NO_STORE)`, textAnswer (3), `seenAs(known, current)` for the five 204 checks (keys in today's
order), notePresent (4); notePlayersSeen stays in db/roll-requests (mocked there). Pins: route suites' 204
cases, notes-routes, cookbook route; C5. Low. 1.25 h.

**R1.3.6 (S.6) One body reader.** src/lib/routes/body.ts `readBody(request, {limit, type?, declared?,
reviver?})` → `{ok, text, value}` | `{ok: false, why}`; each of the five callers maps `why` to today's
answer; the two without a declared check keep none (bug B4). Pins: rolls, notes, dishes, events, commands
suites; C5, C6. Low. 1 h.

**R1.3.7 (S.7) Result router.** recordCommandResult (mocked by the events suite) stays the entry and
routes dish-, roll (split into markGmMessages, closeAnsweredPrompt, version bump) and note results; same
writes in the same order. Pins: roll-requests, cookbook, note-sync, events suites; C5, C7. Low. 0.5 h.

**R1.3.8 (S.8) Event table, hello split.** apply (campaign-events.ts:106, 70): hello → applyHello (writes in
order); its data → pure helloCampaignData in src/utils/hello-features.ts with HELLO_ROLL_FLAGS in stored
order (map S.8's 14) and kindOn for the 7 `enabled === true && kinds.includes(x)`; the other cases →
EVENT_HANDLERS; VERSION_SILENT. Pins: campaign-events{,.groups,.settings}, events suites; C5, C7 (a full
0.42 hello and a pre-0.10 one); every e2e lane opens with a hello. Medium. 2 h.

**R1.3.9 (S.9) The roll path in stages.** createRollRequest (:142, 53) → rollGate (pure, :175-229),
readRollContext (the 11 reads, same order and args), rollRefusal (:371-401), rollPayload (:408-430),
holdCommand. Pins: roll-requests.test (5,247 lines), rolls suites; C5, C7; e2e rolling, rolls, typed,
manualdice, gmroll, alone, prompts, companionsaves, endturn, attacks, activities, links. Medium-high. 2 h.

**R1.3.10 (S.10) Module routes under 15.** events POST (:56, 30) → pingAnswer, takeEvent, eventAnswer;
FEATURES, ANSWERED_WITH_FEATURES → src/constants/features.ts (key order kept); commands POST (:52, 28) →
holdForCommands, claimAll; route files export only methods, OPTIONS, maxDuration (gate 6). Pins: events
(1,178 lines), commands (810) suites; C5, C6; e2e all. Low-medium. 1 h.

**R1.3.11 (S.11) Remaining complexity**, extract-function only: getTableView (db/table.ts:408, 33),
messageLabel (utils/table-view.ts:892, 32), expand (slim-sheet.ts:219, 30), checkWildShape (26),
findEventCampaign (20), applyJournalUpdated (20), the recordNoteResult transaction (19), getGroupView (20),
checkEnds (20), claimRollRequests (18), and db/notes.ts last (overlay 27, fits 23, viewOf 21, changeNote
17). Pins: each file's suite (analysis/S/tests-per-file.txt), table-view's 42 suites, notes (3,068),
note-sync (1,720); C5, C7. Medium for notes and slim-sheet. 3.5 h.

**R1.3.12 (S.12) Types and constants.** S's exported types → src/db/types.ts, src/lib/routes/types.ts,
src/lib/types.ts (SessionUser); `Tx` once (3 copies); the three util `*Refusal` un-exported (in-file
only); the shared ones went to src/types in 2b. Pins: tsc. Low. 0.75 h.

**R1.3.13 (S.13) Layering.** The responders and bridge-http moved to src/lib/routes/ in commit 5; `attempt`
→ src/lib/attempt.ts (its cases out of bridge-http.test, split by describe); db/companions.ts:48's unused
re-export dropped. Low. 0.25 h.

**R1.3.14 (S.14) Small shared.** `due(map, key, every, now)` for the three throttles (bug B5 kept); FOUNDRY_ID
(×3) → src/db/constants.ts. Pins: roll-requests, cookbook suites (fake time). Low. 0.5 h.

S ≈ 18.25 h. Commits 9 (R1.3.1, .2, .3, .14), 10 (.4, .5, .6, .7, .12), 11 (.8, .9, .10, .11, .13).

### §1.4 Wire and checks (W-a schemas, types, constants; W-b requests, mocks)

2b split utils/roll-requests.ts verbatim into src/utils/requests/* and moved DIE_SIZES, isDieSides and the
constants' types (owners.tsv).

**R1.4.1 (W.1) Lenient helpers (W-a; Q2).** src/schemas/utils.ts `leftOut(s) = s.optional().catch(
undefined)` and `orNull` (= `.nullable().catch(null)`, only where the chain is exactly that); the 67 sites
keep their inner chain (2 `.nullable().optional()` → `leftOut(x.nullable())`). Helper test. Pins:
schemas/sending-stone*, foundry-settings, campaign-events, events suites; C6; e2e sync, settings,
wildshape. Low. 1.5 h.

**R1.4.2 (W.2) Die sizes (W-a).** HIT_DIE built from DIE_SIZES (a test asserts today's `.source`);
HIT_DIE_SIZES = DIE_SIZES.length; isDieSides at schemas/roll-request.ts:77, :423, :908 (R's two in
R1.2.13). Pins: roll-request, damage-modifiers, formulas, roll-modifiers suites. Low. 0.5 h.

**R1.4.3 (W.3) Event schemas table (W-a).** hello, texts (transform returns `{ texts }`), cleared schemas
hoisted; `EVENT_SCHEMAS` keyed by type; parseGameEvent = `Object.hasOwn` lookup, one commented cast, stays
exported from `@/schemas/sending-stone` (mocked there); same ZodError and prettifyError text. Pins:
sending-stone (6,012), events, campaign-events suites; C6. Medium (map typing). 2 h.

**R1.4.4 (W.4) The request-kind table read (W-a: schemas, constants 1.5 h; W-b: requests 1 h).** W-a:
ACTIVITY_CHECKS, FROM_TEXT, LINKABLE, ANSWERS, keyed, damaging, the dice groups; EFFECT_DICE_KINDS and
COMPANION_UNTAKEN derived under their names. W-b: GM_ROLL_KINDS (the `gmLabel` words), D20_KINDS,
DAMAGE_KINDS, SUMMED, CHECK_TYPES, GM_UNSENT derived. Local stays local (§1.6). Pins: roll-kinds.test,
roll-requests, roll-request, db/roll-requests, campaign-events, charges, roll-tray suites; C6; e2e gmroll,
companions, rolls, alone, typed. Medium (the equality test landed in Phase 1).

**R1.4.5 (W.5) NO_DICE in the mocks (W-b):** mocks/sending-stone.ts:4028. 0.25 h.

**R1.4.6 (W.6) Request checks by kind group (W-b).** checkRoll (26) → a CHECKS map by kind group (the
activity-check pre-dispatch first; kinds absent from today's switch still undefined); checkLinked (49) →
one function per link kind; toRollRequestView (23) → branch functions with the six trailing spreads built
once, always last, same order; toGmRollView (20), checkAloneChoices (18), checkEnchant (16) → helpers;
roll-requests.test.ts split by describe block into the modules' tests (titles kept; R/tools/moves.tsv maps
them). Pins: roll-requests.test (7,066), db/roll-requests*, table, companions, route suites; C2, C3, C5;
e2e rolls, damagecard, endturn, uses, alone, gmroll, prompts. Medium-high (key order). 4 h.

**R1.4.7 (W.7) rollRequestSchema's rules by group (W-a).** The superRefine (:567, 84) → ordered rule
functions (map W.7's 13 groups, then the dice branch by `ROLL_KIND_INFO[kind].dice`), identical issue
list and order; `issue()` (44 addIssue copies) and `inFaces()` (4); the transfer superRefine (:164, 17)
likewise; `as unknown as z.ZodType<RollRequestInput>` → an annotation. Pins: roll-request.test (3,029);
seat routes' 400; C6. 4 h.

**R1.4.8 (W.8) Hand types vs schemas (W-a).** Of 51 pairs, the 11 exact: NoteChange, NoteResolve,
NoteOrder, NoteOrderResolve become `z.output<…>`; RollRequestInput, Envelope, BeastEntry, DamagePreview,
JournalPage, SheetCounter, CookbookDishBody keep their hand types with the schema annotated `:
z.ZodType<Hand>` (aliasing would close a type cycle through GameEvent); 40 stay (Q6). Pins: tsc. 1.5 h.

**R1.4.9 (W.9) Types home; src/types' own cycles (W-a).** ParsedContainer → src/schemas/types.ts;
schemas/notes.ts:9's unread NOTE_ID re-export dropped; the type-only cycles among
types/{party,roll,sending-stone,table} broken by moving the shared types to the module both sides import
(cycle report: 0). Low. 1 h.

**R1.4.10 (W.10) Mock base (W-b).** src/mocks/results.ts DONE_HEAD for the 9 CommandResult heads (today's
key order), src/mocks/switches.ts switchedOn, SWITCHED_OFF, OTHER_SYSTEM (the 14 names stay one line each),
tableViewOf for the 4 table-view heads, notes-server's fetch fake (:103, 32) split into handlers;
ChosenFavorite and the 3 local types → src/mocks/types.ts. Fixture outputs byte-identical. Pins: every
suite using them (gate 2), C1-C8. Low-medium. 3 h.

**R1.4.11 (W.11, W §7) Placement and tests.** constants/links.ts → help-links/constants.ts and
constants/conditions.ts → FS conditions folder (commit 5); new tests: roll-kinds, schemas/utils, dice.
0.25 h.

W-a ≈ 13 h (commits 12, 13). W-b ≈ 8.5 h (commit 14), then the same agent runs R-b.

### §1.5 Other UI (FT: V1; notes, party, companions, campaigns, characters, transfers, cookbook, shared: V2)

What 2b moved out of these files (TurnToastContext, initials, askTitle, the polling constants, the
shared types, the transfers', cookbook's and modal's exported pieces) is in owners.tsv. Line numbers and
lists are maps V1 and V2's.

**R1.5.1 (V1.1) Placement** is R1.0.1 (the FT tree, the nine GameTable suites and chat-log.results into
FT/__tests__, 13 jest.mock paths). 0 h for V1.

**R1.5.2 (V1.2) Types and constants out.** FT/types.ts: Tab, Aside, GameTableProps, TabHold, RowState,
PaneMarks, PaneReporters, PanelEnding, CardBody, Card, Ending, Undoing, Sent, Shown, Followed, and the two
hooks' return types named EndTurnState and UndoState (replacing `ReturnType<…>`); FT/constants.ts:
NOTHING_READ, SIDE_BY_SIDE, MOST_PANES, NO_KEYS, NO_KINDS, NO_ROW, SETTLE_FOR and OVER_FOR (both `2 *
POLL_INTERVAL`, two names: a two-copy merge is out); class maps to their component folders. Low. 1 h.

**R1.5.3 (V1.3) One export per .tsx.** formatInitiative → combat-tracker/utils.ts; turnFragment,
refusalKey, newlyNotMade → FT/utils/end-turn.ts; statesOf → live-status/utils.ts. Low. 0.5 h.

**R1.5.4 (V1.4) Pure rules to utils, verbatim.** FT/utils/header.ts (subtitle … badgeCount, liveState,
GmNote's and NoSheet's sentences), unread.ts, combat.ts (`currentCombatant` for the 5 copies:
end-turn.ts:68, use-turn-undo.ts:35, turn-toast.tsx:111, combat-tracker.tsx:252, game-table.tsx:1498;
isTurnOf, isMyTurn, nextUp, hpBar; callers keep their `started` guard), companion-row-state.ts,
creatures.ts, party-urls.ts; turn-toast/utils.ts (showsTurn … nextCard); the turn shown (D6) in end-turn.ts.
Strings with ’ and · moved, never retyped. Pins: suites, C4. Low-medium. 2 h.

**R1.5.5 (V1.5) GameTable as composition.** Render-time state moved verbatim first, hooks called in source
order: useTableTabs, usePartyOpen, useChatRead, useTypedDice, useTurnEnding (composes useEndTurn,
useTurnUndo, useHold; not one state machine, Q1), useCompanionRow, useChatScroll (map V1.5's line ranges);
then TableHeader, TableNav, AsideColumn, CreatureSheets, NoSheet and the private components to files
(PaneTab and TabButton share hold-tab/); the DiceRendererProvider choice stays at its tree position.
GameTable (96) and each hook ≤ 15. Pins: the nine GameTable suites (renderer counts in .companions), C1,
C3; e2e endturn, toasts, companions, layout, phone, fullscreen, gm, sheet, notes, party. Medium-high. 3.5 h.

**R1.5.6 (V1.6) TurnToast split.** useTurnToastCard (the every-render effect :271, 22, kept without deps,
its body via nextCard), useToastFoot, UndoButton (focus hand-off on unmount kept). Pins: turn-toast (33),
.endturn; C1, C4; e2e endturn, toasts. Medium (timer order). 1.5 h.

**R1.5.7 (V1.7) Chat by kind.** ChatMessage keeps its frame and renders `message.ask ? AskBubble :
BODIES[kind]` (text, card, roll; sibling order kept: ask, body, alone note, text targets); cards to files;
bubble, edgeOf, a/an → chat-log/utils.ts; CHIPS joins askTitle in src/utils/ask-words.ts; the
no-img-element reason (:758) onto its directive. Pins: chat-log (39), chat-results; C1, C4; e2e damagecard,
results, alone, gm. Low-medium. 1.5 h.

**R1.5.8 (V1.8) Combat tracker split.** TurnPanel (:234, 22) + useTurnFocus; CombatantRow, HitPoints
(rounding kept, bug B6) to files; maps to constants.ts. Pins: combat-tracker (28); C1; e2e endturn,
companions. Low. 1 h.

**R1.5.9 (V1.9) End Turn hooks (two, Q1).** APIs unchanged; useFollow and useSendChoice adopted (the
`sends` counter and Undo's `for` kept); bodies `{ kind, turn|undo, turn, ...NO_DICE }` in today's key
order; use-turn-undo.ts:101-119 → pure nextFollowed; useTurnUndo (:73, 22) ≤ 15. Pins: use-end-turn (19),
use-turn-undo (22), .endturn (35); C2; e2e endturn. Medium. 1.5 h.

**R1.5.10 (V1.10) The table poll tidied, not shared (Q1).** seenOf + query → pure tableQuery (order is the
wire) in FT/utils/table-query.ts; retryDelay; poll (:61, 17) ≤ 15; seenQuery is R1.9.22. Pins:
use-table-view.test (URLs to the byte); C2. Low. 0.75 h.

**R1.5.11 (V1.11) Q3's rules here.** use-hold rechecked; the react-hooks findings of V1's files
(game-table.tsx:245, :1126, :1129; use-end-turn.ts:175; use-waiting-prompts.ts:63; turn-toast.tsx:271, :335,
intended) fixed without timing change or given a reasoned line disable; rerun after R1.5.5 (the compiler
rules stop at a function's first error). 0.75 h.

V1 ≈ 13 h (commit 19).

**R1.5.12 (V2 §7) Tests follow:** V2's 100 test files beside their units (commit 5); give-, party-,
take-controls and companion-pane into F/<feature>/__tests__ (§3.3). 0 h.

**R1.5.13 (V2.1, V2.2) Polling and the seen query.** use-notes, use-party-sheet, use-cookbook-view (15 000 /
120 000; COOKBOOK_MOST_DELAY beside COOKBOOK_POLL_EVERY) adopt retryDelay; src/utils/seen-query.ts
`seenQuery(fields)` → URLSearchParams in the table's order with a table test of names and order; party,
companion, notes, cookbook adopt (each hook maps its view as today, map V2 D2); use-companion-view keeps no
backoff (bug B9). Pins: the four hooks' suites (delays 3000 → … → 30 000), C2. Medium (an order change only
turns 204s into 200s: C2 first). 1.5 h.

**R1.5.14 (V2.3) Icon-button classes.** JOURNAL_ICON_BUTTON (F/notes/constants.ts; 6 sites) and
HEADER_ICON_BUTTON (src/constants/buttons.ts; modal, side-panel, party-page; game-table.tsx:823 is
R1.9.23), callers composing `` `-mr-1.5 shrink-0 ${HEADER_ICON_BUTTON}` `` so every string is unchanged;
campaigns' and cookbook's button consts to their constants.ts. Pins: C1, modal, side-panel suites. Low. 0.75 h.

**R1.5.15 (V2.4) Journal.** The six files split per map V2 §2; use-notes' four types → F/notes/types.ts,
REFUSALS, bodyOf, answerOf, idsOf, madeFrom → F/notes/utils/answers.ts, the poll body → a local
useBookReads, the store and hasDraft, journalOpen, useNotes, draftChanged stay (§0.6.11); Journal (:174, 25)
→ useJournalLayout, useSaid, useFocusTo, useReaderPick, useOrdering + utils/reader.ts; Sortable →
useSortableDrag; NoteEditor's two hooks out. Pins: the 15 notes suites, use-notes (757); C1, C2; e2e notes,
notesoffline, notesorder, partynotes. High (focus order, drafts across unmounts, beforeunload; one store
instance). 3 h.

**R1.5.16 (V2.5) Party.** PartySheetFor own file; PartyState → F/party/types.ts; queryOf → seenQuery;
NO_ACTIONS, TABS → constants. Pins: party-sheet (951), use-party-sheet, both party page suites; e2e party.
Low. 0.5 h.

**R1.5.17 (V2.6) Companions.** companion-pane, creature-header (otherSpeeds moved in 2b), creature-switcher
split; useSwitcherLayout (layout effects verbatim), shownName, describe → utils. Pins: creature-switcher
(573), companion-pane (649), creature-header, use-companion-view suites; C1; e2e companions,
companionsaves. Medium (scroll and reveal timing). 1.25 h.

**R1.5.18 (V2.7) Campaigns.** campaign-buttons, -controls, -status, -row, -index split; feature-words.ts;
useCampaignChoice, useCampaignIndexNav; TOAST_FOR and useToast out of page-toast; the campaigns page's query
parse → utils. CampaignCard stays a Server Component passed as `details`; campaign-styles (→ F/campaigns/
constants.ts) and campaign-ids stay non-client. Pins: campaign-card (1,272), campaign-index (901),
campaign-row, foundry-settings, campaigns page suites; C1; e2e campaigns, late-setup. Medium. 1.5 h.

**R1.5.19 (V2.8) Transfers.** types → F/transfers/types.ts (MoveEnd moves, so the move-dialog ↔
recipient-list cycle ends); anyCoins (party's superset), PENDING_COINS ('coins' ×3), mayHold →
utils/constants; MoveForm (:117, 43) → pure form state + useMoveForm; the JSX hooks and factories as bridges
(use-give-controls, use-remove-controls, takeControls, partyControls, TransferControls' callbacks);
use-transfers on useFollow, its body and the party page's (:15-18) on `...NO_DICE` in today's order. Pins:
the 12 transfers suites, use-transfers; C1, C2; e2e transfers, givetake. Medium (take-controls.test mocks
move-dialog: follow its file). 1.5 h.

**R1.5.20 (V2.9) Cookbook.** useCookbookEntry as a bridge; the card store → F/cookbook/hooks/
cookbook-store.ts; dish-list helpers → utils; DISH_ATTEMPTS read from `@/constants/cookbook` (gate 5).
Pins: cookbook-card (723), cookbook-entry, cookbook-dish-list, use-cookbook-view suites; e2e cookbook.
Low. 0.75 h.

**R1.5.21 (V2.10) Shared components and hooks.** confirm-dialog, portal-root (useDialogRoot to its file),
remove-character-button, icons/die split (their exported pieces moved in 2b); the characters feature in
F/characters (commit 5). Pins: modal (465), side-panel, confirm-dialog, small component suites. Low. 0.75 h.

**R1.5.22 (V2.11) App pages.** `type Props = PageProps<'…'>` inlined (4 pages); src/utils/seat-urls.ts for
the encoded seat paths (take-controls.tsx:45, the GM and two party pages; game-table's are R1.9.23;
game-table.tsx:172 and campaign-parties.tsx:26 are unencoded and keep their own); layout.tsx:1 and
manifest.ts:1 camelcase directives go with §0.6.7's allow list. Pins: the 10 page suites, manifest,
globals; e2e. Low. 0.5 h.

**R1.5.23 (V2.12) Disables and complexity sweep.** V2's reasonless directives (creature-switcher.tsx:446,
logo.tsx:22, companion-row.ts:106 given reasons; creature-switcher.test.tsx:1 to line-level; the
`mockResolvedValue(undefined)` ones go with §0.6.7); lists (note-headings.ts:342, 21) and numberedNames
(companion-row.ts:54, 17) by extract-function; react-hooks findings in V2's product files. Medium. 1.5 h.

V2 ≈ 13.5 h (commit 20).

### §1.6 The request-kind table (R1.6; M in Phase 1, new files only; W-a owns it after)

src/constants/roll-kinds.ts, pure data, client-safe: `ROLL_KIND_INFO = {…30 rows…} as const satisfies
Record<RollKind, RollKindInfo>` (RollKindInfo appended to src/types/roll.ts), `kindsWhere(pred)` =
`ROLL_KINDS.filter`, the ordered lists whose order is observable (`ANSWER_KINDS = ['save', 'ability',
'skill']`, db/roll-requests.ts:323's Prisma `in`, asserted at db/roll-requests.test.ts:685, :2507;
`OWN_KINDS` in ROLL_KINDS order = the withheld/notOwn order), and `NO_DICE` (declared exactly as
use-table-rolls.ts:1011's PLAIN: mode 0, explicit false, extras [], dice []). roll-kinds.test.ts asserts
every derived list equals today's literal (copied once; ordered where order is read, as a Set where only
`.has` reads it), green on today's code before any reader changes.

| field | rows (ROLL_KINDS order: skill tool ability save death initiative attack use damage hitDie hitDice formula ask textDamage textRoll itemDamage recharge endEnchantment endConcentration endTurn undoEndTurn spend inspiration spellSlot transfer remove favorite effect wildShape prepare) | replaces |
|---|---|---|
| gmLabel | the 30 words of GM_ROLL_KINDS | utils/roll-requests.ts:1473 |
| dice | 'd20' skill…attack · 'hitDice' · 'recharge' · 'free' damage hitDie formula textDamage textRoll itemDamage · 'none' the rest | :1507 D20_KINDS; constants :215 EFFECT_DICE_KINDS; schemas :847 :862 :876 :896 |
| damage | damage textDamage itemDamage | :1594; roll-tray.tsx:1652; schemas :733 |
| summed | the damage kinds + hitDice | :1591 SUMMED |
| check | skill → 'skill', tool → 'tool', ability → 'check' | :1186 CHECK_TYPES; schemas :60; db/roll-requests.ts:225; use-sheet-roller.ts:86; use-table-rolls.ts:1402-1405 |
| keyed | skill tool ability save | schemas :793, :54 LINKABLE |
| fromText | ask textDamage textRoll | schemas :48 |
| answers | save ability skill (ANSWER_KINDS keeps the order) | schemas :66; db/roll-requests.ts:323 |
| gm: false | endEnchantment endConcentration endTurn undoEndTurn favorite effect wildShape prepare | :233 GM_UNSENT; db/favorites.ts:45, effects.ts:42, wild-shape.ts:49 |
| companion: false | inspiration hitDie hitDice spend spellSlot transfer remove favorite effect wildShape prepare endTurn undoEndTurn | constants :460 (includes only); db/roll-requests.ts:154 (OWN_KINDS → 422) |
| own | transfer 'transfersEnabled', remove 'removalsEnabled', favorite 'favoritesEnabled', effect 'effectsEnabled', wildShape 'wildShapeEnabled' | campaign-events.ts:157-161; db/roll-requests.ts:164-168, :572-581 |
| shaped | transfer remove favorite effect (wait while transformed) | db/roll-requests.ts:160 |

Readers adopt in their own lanes: W-a (R1.4.4), W-b (R1.4.4), S (R1.3.3), R-a (R1.2.3), R-b (R1.2.8). Stays
local: checkRoll's and checkLinked's cases (by kind group, R1.4.6), the schema's per-kind words
(OWN_FIELDS, PLAIN_WORDS), roll-tray's result kinds (BADGES, briefOf: not request kinds), the send*
bodies, the 48 call-site `kinds.includes('x')` gates. Not request kinds (grep hits that stay):
table-view.ts:342/437/903, prompts.ts:145, favorites.ts:221/265, favorite-commands.ts:77, wild-shape*.ts
form.kind, item-menu.tsx:210, sheet-entry.tsx:148, description-link.tsx:214, cookbook BONUS_ROLLS, the chat
message kind. ROLL_KINDS stays in constants/sending-stone.ts. 2 h.

### §1.7 Guard rails

**§1.7.1 Now (commit 1, all warn but filename-case):** §0.5 fact 3. Gate 9 holds each folder's warnings per
rule (and syntax check) at or below ratchet-base.json, re-taken after commit 5.

**§1.7.2 Config changes before and in Phase 4** (each with its reason beside it):
- commit 2 (T): `unicorn/filename-case` ignore `['^__tests__$', '^__snapshots__$']`.
- commit 6 (M): `unicorn/no-null: 'off'`.
- commit 23 (G): `unicorn/no-useless-undefined: ['error', { checkArguments: false,
  checkArrowFunctionBody: false }]` and `camelcase: ['error', { allow: [six names] }]` (§0.6.7); the
  directives they make unused removed. Left of the 430: 8 no-img-element (reasons onto the directive), 4
  no-this-outside-of-class (creature-switcher.test.tsx:1 and the companions test's range to line-level),
  ≤ 3 test no-useless-undefined that are not arguments, 2 prefer-structured-clone (notes-server.ts:121
  given a reason), 1 jsx-key, 1 prefer-query-selector, 1 prefer-code-point (companion-row.ts:106 given a
  reason), 1 no-console (note-headings.test.ts:116), 2 complexity holds: ≤ 25, line-level, `-- reason` each.

**§1.7.3 Commit 23 (G): every CLAUDE.md rule at `error`**, `npx eslint .` exits 0 and prints nothing: (a),
(b) (tests: TSX_TYPE off); react-hooks recommended (tests: rules-of-hooks, refs, globals off; §0.6.6);
`import/no-cycle`; `sonarjs/cognitive-complexity: ['error', 15]`; `@typescript-eslint/ban-ts-comment`
on with `'ts-expect-error': 'allow-with-description'` (use-notes.test.ts:254 already describes itself);
the metrics' type-only cycle report must list 0 groups (no rule sees type-only cycles). The React
Compiler diagnostics in the recommended set (refs, set-state-in-effect, purity, immutability, globals,
preserve-manual-memoization …) go to error with the two hook rules: a product finding a lane cannot fix
without changing render timing (floating-ui's `refs` object read in render, wild-shape.tsx's 13; the
intended dep-less effects) keeps a line-level disable with its reason (CLAUDE.md §9), counted apart
from Q2's and listed in the PR.

**§1.7.4 Layered imports (commit 23): `import/no-restricted-paths: 'error'`**, replacing today's 7 zones
(their "db must not import schemas" contradicts db/notes.ts:24 by design):
1. client trees (`src/{features,components,hooks}/**`) not from `src/{db,lib/routes}/**`,
   `src/clients/prisma*`, `src/auth.ts` (pages are Server Components and may);
2. `src/types/**` only from `src/{types,constants}/**` (type-only);
3. `src/constants/**` only from `src/{types,constants}/**`;
4. `src/{utils,schemas}/**` not from `src/{features,components,hooks,app,db,lib}/**`;
5. `src/hooks/**` not from `src/{features,app,db,lib}/**` and from src/components only its modal hooks;
6. `src/components/**` not from `src/{features,app,db,lib}/**`;
7. `src/features/**` not from `src/app/**`; `src/db/**` not from `src/{lib/routes,app}/**`;
   `src/lib/routes/**` imported only by `src/app/api/**`.
Feature-to-feature edges are allowed (table → sheet, rolling, notes, party, companions, cookbook,
transfers; sheet → rolling, transfers, notes, cookbook, companions; companions → sheet, rolling; party →
sheet, transfers; rolling → sheet only roll-tray's useSpent, listed); their rule is no module cycle. G
proves each zone fires on a fixture outside src (made, linted, deleted under the checks lock).

### §1.8 What stays byte-identical, and what checks it

**§1.8.1 The surface** (PROTOCOL.md and the e2e suites read it; maps S, W, R, U1, U2, V1, V2 and T §5
list it in full; T §5 counts what e2e reads): the 41 route files and their exports; statuses per case and
their order (auth before body, 401 before 404, seat bodies 415 → 413 → 400, declared size first where it is
today); headers (no-store but the texts quirks, texts' `private, max-age=86400`, CORS on events and
commands, cookbook Retry-After); bodies with key order (refusals, `{commands, open}`, `{resend?,
features?}`, `{id}`, notes, cookbook, `{version, ...view}` whose version hashes the view's key order);
every request the app sends, whole; stored rows (RollRequest data and payload per kind, the hello's
campaign update and its array orders, version bumps, refusal columns, claim writes); localStorage and
sessionStorage keys and values (the `sending-stone:*` keys of maps R, U1, U2 §5); visible strings (’, ·),
accessible names and roles, named ids (#character-pane, #sheet-panel, #creature-panel-<id>,
#creature-tab-<id>, `${idPrefix}sheet-tab-${id}`, #turn-heading, #sending-stone-settings,
#prompts-heading, #chat-log, #initiative-heading), data attributes (T §5's list + data-uses, data-sending,
data-ws-*, data-wild-note, LINK_ATTRIBUTES), class strings in clsx order, portals, timings, the Server
Actions (15 names, states, redirects, `refresh()`).

**§1.8.2 Checked by** C2 (requests), C5 (routes, prisma calls in order), C6 (refusals), C7 (storage and
rows), C4 (words, names), C1 (markup; retired at the end, Q4), C3 (area composition), C8 (dice draws),
gates 1-10, and the five e2e passes against the real module (v0.42.1) and the Foundry stand-in.

**§1.8.3 Mocked surfaces stay at their paths** (every name a `jest.mock` factory defines): `@/lib/session`
(getCurrentUser ×38, requireUser ×9), `@/db/{characters, roll-requests, seats, party, notes, campaigns,
cookbook, table, sheet-texts, note-sync, campaign-events, wild-shape}` (notePlayersSeen ×25, the notes
writers ×17 …), `@/schemas/sending-stone` parseGameEvent, `@/constants/sending-stone` EFFECT_SETTLE and
WILD_SHAPE_SETTLE, `@/constants/cookbook` DISH_ATTEMPTS and MOST_DISHES_WAITING, `@/lib/{app-origin,
campaign-secret, note-html}`, the app actions; typed-dice ELVEN_LINE, use-notes (hasDraft, journalOpen,
useNotes), use-table-view (useTableView), use-keyboard-inset, dice-entry-dialog, rolls-button, move-dialog
follow their files in commit 5; use-table-rolls' damageDue and needsPlayer are retargeted with them in
commit 7; use-table-view's POLL_INTERVAL keys in commit 8; the seven barrel mocks become module mocks in
commit 5.

### §1.9 Seams (Phase 2b, one builder, M) and cross-area follow-ups (Phase 4)

**R1.9.1 Export moves (commit 7).** R/tools/export-move.cjs (Phase 1): per (source, names, destination), the
TS LanguageService's "Move to file" refactor moves the declarations with the file-private helpers only
they use (a helper shared with a name that stays moves too and the source imports it back), creates the
destination, rewrites every importer (tests and `typeof import()` included); then a pass retargets mock
paths whose factory keys moved (needs-player.test.tsx:18 → FR/utils/damage-due) and lists stale mock keys
(gate 4). Verbatim: no line inside a moved declaration changes; a JSX-returning hook moves whole to
`use-x.tsx` (§0.6.4); `useTargetsOf` is renamed `targetsFor` as it moves. After: tsc, L1, the cycle report.

What moves, by one rule for every lane: **(1)** every name another lane imports that leaves its module in
v0.43 (218 names in 66 modules, fact 21); **(2)** every exported named type of a module that stays in a
shared layer (src/utils, src/constants), to src/types (src/types is W-a's in Phase 3, and a shared module
may not import a feature's types). Destinations follow §1.0 rules 2-3 (a component → `<folder>/<kebab>.tsx` in its source's folder, a hook →
`use-*.ts(x)`, constants → constants.ts, utilities → utils.ts, types → types.ts) except the maps' homes:
src/components/{chevron, entry-icon, description}; FS/utils/{join-parts, class-line}; FS/components/
charging (from uses-button); src/utils/{roll-reasons, lifecycle, initials, ask-words (askTitle with
isAbility, checkOptionOf, checkName), dice}; src/constants/{lifecycle (SETTLED, NOT_MADE, the timings),
polling, dice}; src/hooks/use-turn-toast-foot (TurnToastContext + useTurnToastFoot); FR/{constants,
types, utils/{damage-due, gm-rolls, menu-points, damage-words, brief}, hooks/use-gm-rolls}; src/types/roll
(use-sheet-roller's 13 types, TableRollState, the dice utils' types), src/types/{table, seats, auth,
prompts, sending-stone, cookbook}; src/db/types; F/{notes, companions, transfers, cookbook}/… ;
src/utils/requests/* (utils/roll-requests' exports). **The full list, name by name with source and
destination, is owners.tsv** (the `-` rows' "moved in 2b" notes and the "receives in 2b" notes of existing
files: 140 destination modules). 3.5 h.

**R1.9.2 `onItsWay` (commit 8).** `onItsWay(state?)` = `status === 'sending' || status === 'rolling'` in
src/utils/lifecycle.ts, adopted at fact 8's 13 sites, each keeping its other conditions. Low. 0.75 h.

**R1.9.3 Polling constants (commit 8).** src/constants/polling.ts POLL_INTERVAL = 3000, POLL_MOST_DELAY =
30_000 (MAX_DELAY ×3); src/utils/polling.ts `retryDelay(every, failures, most)` + its test; the six product
and the test importers point at constants/polling; turn-toast.test.tsx:11's mock retargeted to
`@/constants/polling` (same value), the two `POLL_INTERVAL: 3000` keys in use-table-view mocks dropped
(fact 14's probe: gate-2 neutral). retryDelay's adoption is the lanes'. Low. 0.5 h.

**R1.9.4 The lifecycle's shared pieces (commit 8).** src/hooks/use-follow.ts `useFollow()` → `follow(api,
input, onState, onTaken?)` owning the controllers set, unmount abort and aborted guard (fact 6's 4
identical copies); FR/hooks/use-send-choice.ts `useSendChoice(gm)` (the 3 `useStoredChoice(gm ?
GM_SEND_KEY : SEND_KEY, SEND_CHOICES, 'on')` copies: use-end-turn.ts:107, use-turn-undo.ts:91,
use-table-rolls.ts:272); NOT_MADE beside SETTLED (fact 16). New code with small tests; adopted in Phase 3
by R-a, V1, V2, U1, R-b. 1 h.

**R1.9.5 needs-player's mock follows damage-due (in commit 7):** the group moves together and the mock's
path changes, keys unchanged. **R1.9.6 NO_DICE's adopters (Phase 3, each lane):** use-table-rolls (R-a),
use-transfers and the party page (V2), use-end-turn, use-turn-undo (V1), db/cookbook, db/note-sync (S), the
mocks (W-b): `...NO_DICE` where the four keys sit (JSON key order unchanged); a site that mutates a body's
arrays is not adopted and is listed.

M's 2b ≈ 6.5 h (export moves 3.5 h with the codemod from Phase 1; seams 2.75 h; L1s, build).

**Phase 4 follow-ups** (F-a and F-b in parallel, disjoint files; then G):

| id | what | files (Phase 3 lane) | builder |
|---|---|---|---|
| R1.9.20 | usePopover at the other five popovers: roll-menu :160-198, rolls-button :55-97 (its Escape quirk kept), ReturnPopover (wild-shape :765-778), sheet-settings :100-122, notes/move-menu :55-80 | R-b, U1, U1, V2 | F-a |
| R1.9.21 | saveTitle at utils/table-view.ts:392-402 and db/table.ts:384-396 | S | F-b |
| R1.9.22 | seenQuery in use-table-view (twelve keys) | V1 | F-b |
| R1.9.23 | seat-urls at game-table.tsx:1017-1030 (encoded ones); HEADER_ICON_BUTTON at game-table.tsx:823 | V1 | F-b |
| R1.9.24 | rollOf at description-link.tsx:1108 | U2 | F-a |
| R1.9.25 | favorites.tsx's chips on ActionChips/UsesChips where the markup equals (else listed) | U1 | F-a |
| R1.9.26 | whatever a lane listed for Phase 4 (shims.allow, kit changes; expected empty) | any | G |
| R1.9.27 | dead code: jest.setup.ts:3-70 mockFetch, mockManyFetch; exports with no importer outside their file lose `export` (tests' imports kept) | many | G |
| R1.9.28 | §1.7.2-§1.7.4 in eslint.config.mjs; zones' fixtures; lint prints nothing | eslint.config.mjs | G |
| R1.9.29 | ROADMAP (§4.5) | ROADMAP.md | G |
| R1.9.30 | metrics after: `run.sh after` → R/analysis/metrics-after.md; §0.4 filled for the PR | R/ | G |

F-a ≈ 3 h, F-b ≈ 2 h, G ≈ 3.5 h.

### §1.10 What is deliberately not done (and why)

- **Q1's exclusions:** a shared poller and stores (the five visibility-paused loops, the notes and
  cookbook stores, use-creature-choice, use-stored), an End Turn state machine, a journal context, sheet
  rows fed from context (`rows: ActionRows` through every row; U1 D5's 13 context + provider + hook trios).
- **Two-copy merges** (Q1 says three or more): the events/commands module gate; `noting` vs `attempt`;
  GAMEMASTER ×2; liveState ×2; reasonSentence ×2; askBlocked/useBlocked; FavoritesStrip/Column headings;
  slotWords ×2 (apart by its comment); the damage kind menu ×2; Choices vs AloneChoices; the activity rows
  list vs table; press-menu vs roll-button long-press; `/ (damage|healing)$/` ×2; WARNS, Waiting, BUTTON,
  OUTLINE, the two primary buttons; randomSecret vs generateSecret; NOT_MADE vs SETTLED; OVER_FOR vs
  SETTLE_FOR; the tests' `posted` ×2, cookbook `reads`, `settle`, `wait`, the 2 notes-route mock variants.
- **Near copies that differ in meaning:** the six sheet `answering` fakes, `given` ×7, `held` ×22, route
  callers; initials in sheet-tiles and avatar (bug B8); capitalize ×5 (two add a period); the switch track
  ×4 (R1.1.21); the seat's own turn ×3 (Q5); the 6 ResizeObserver measures.
- give/remove-controls keep their own send (threading command() adds a prop for two copies); V2's pages
  keep requireUser/notFound; mocks/sending-stone.ts and constants/sending-stone.ts are not split (120
  importers, mocked paths, no rule needs it); the 40 inexact hand types (Q6), DB double reads (Q7),
  overlapping tests (Q8), the console.error sites (Q9), the bridge route's own `pause`, file-size caps (Q3),
  the e2e suites, map V2.4's notes-store split (§0.6.11) and map R §2's option (b) (commit 1's lint forbids a
  hook exported from a .tsx).

### §1.11 Map item index (every map item → contract item)

T.1 R3.1 · T.2 R3.2 · T.3 R3.3 · T.4 R3.4 · T.5 R3.5 · T.6 R3.6 · T.7 R3.7 · T.8 R1.0.1 + §3.3 · T.9 R3.9 ·
T.10 R3.10. S.1 R1.3.1 · S.2 R1.3.2 · S.3 R1.3.3 + R1.6 · S.4 R1.3.4 · S.5 R1.3.5 · S.6 R1.3.6 · S.7 R1.3.7 ·
S.8 R1.3.8 · S.9 R1.3.9 · S.10 R1.3.10 · S.11 R1.3.11 · S.12 R1.3.12 + R1.9.1 · S.13 R1.0.1 + R1.3.13 · S.14
R1.3.14. W.1 R1.4.1 · W.2 R1.9.1 + R1.4.2 · W.3 R1.4.3 · W.4 R1.6 + R1.4.4 · W.5 R1.9.6 + R1.4.5 · W.6 R1.9.1 +
R1.4.6 · W.7 R1.4.7 · W.8 R1.4.8 · W.9 R1.9.1 + R1.4.9 · W.10 R1.4.10 · W.11 R1.0.1 + R1.4.11. R.1 R1.9.1 +
R1.2.1 · R.2 R1.9.1 + R1.9.4 + R1.2.2 · R.3 R1.2.3 · R.4 R1.2.4 · R.5 R1.2.5 · R.6 R1.9.5 + R1.2.6 · R.7
R1.2.7 · R.8 R1.2.8 · R.9 R1.2.9 · R.10 R1.2.10 · R.11 R1.0.1 + R1.2.11 · R.12 R1.0.1 + R1.2.12. U1.1 R1.0.1 ·
U1.2 R1.1.1 · U1.3 R1.1.2 · U1.4 R1.1.3 · U1.5 R1.1.4 · U1.6 R1.1.5 · U1.7 R1.9.1 + R1.1.6 · U1.8 R1.1.7 · U1.9
R1.0.1 + R1.1.8 · U1.10 R1.1.9. U2 S.1 R1.1.11 · S.2 R1.1.12 · S.3 R1.1.13 · S.4 R1.1.14 · S.5 R1.1.15 · S.6
R1.1.16 + R1.9.20 · S.7 R1.1.17 · S.8 R1.9.1 + R1.1.18 · S.9 R1.1.19 + R1.9.21 · S.10 R1.1.20 · S.11 not done
(R1.1.21) · S.12 R1.1.22. V1.1 R1.0.1 · V1.2 R1.5.2 · V1.3 R1.9.1 + R1.5.3 · V1.4 R1.5.4 · V1.5 R1.5.5 · V1.6
R1.5.6 · V1.7 R1.9.1 + R1.5.7 · V1.8 R1.5.8 · V1.9 R1.9.4 + R1.5.9 · V1.10 R1.5.10 + R1.9.22 · V1.11 R1.5.11.
V2.1 R1.9.3 + R1.5.13 · V2.2 R1.5.13 + R1.9.22 · V2.3 R1.5.14 + R1.9.23 · V2.4 R1.5.15 · V2.5 R1.5.16 · V2.6
R1.5.17 · V2.7 R1.5.18 · V2.8 R1.9.1 + R1.5.19 · V2.9 R1.9.1 + R1.5.20 · V2.10 R1.9.1 + R1.5.21 · V2.11
R1.5.22 + R1.9.23 · V2.12 R1.5.23. Seams the maps named: S (a) R1.6, (b)-(c) R1.9.1, (d) §1.10, (e) R3.4; W
(a) R1.6, (b) R1.9.1; R S-1, S-2 R1.9.1, S-3 not needed (the edge is listed), S-4 not needed (§0.6.4); U1
onItsWay R1.9.2, U1.7 R1.9.1; U2 onItsWay R1.9.2; V1 S1-S5 R1.9.1, R1.9.3, S6 R1.9.2; V2 polling R1.9.3,
seats and transfers' types R1.9.1.

## §2 Order of work

### §2.1 Phases and workstreams

Each phase ends green on L1 (§2.6) and `next build`; the e2e column says which end with a full pass.
Writing hours are estimates for one builder; wall time in §8.

| phase | workstream (builder) | owns (files: owners.tsv) | depends on | ends with | commits | writing |
|---|---|---|---|---|---|---|
| 0 | **WS0 Base** (orchestrator): commit 1 **in** (1dff83f), metrics and ratchet base, WS0 report | branch, lint config, devDependencies | answers | **e2e baseline** (not yet run) | 1 | 62 min |
| 1 | **WS1 Kit** (T) | the kit files, the adopting suites' setup lines, filename-case | WS0 | L1; counts equal | 2 | 6.25 h |
| 1 | **WS2 Goldens** C-b (C2, C3, C5, C6), C-a (C1, C4, C7, C8) | src/__tests__/golden/** | the kit as files (~h+2.5) | goldens green on today's code; mutation checks | 3, 4 | 5 h each |
| 1 | **WS1b Tools and table** (M) | R/tools/**, roll-kinds.ts + test, RollKindInfo in types/roll.ts | WS0 | dry runs; roll-kinds.test green | (in 2) | 8 h |
| 2a | **WS3 Moves** (M) | every moved file and mock path | WS1, WS2 | L1, build | 5, 6 | 2 h |
| 2b | **WS4 Export moves, seams** (M) | importers of moved names; R1.9.2-4's files | WS3 | L1, build, **e2e** | 7, 8 | 6.5 h |
| 3 | **S** | api, actions, lib, db, clients, auth, the server utils, features.ts, hello-features.ts | WS4 | L1, build | 9-11 | 18.25 h |
| 3 | **W-a** | schemas, types, constants (but features, polling, lifecycle, buttons), utils/dice | WS4 | L1 | 12, 13 | 13 h |
| 3 | **W-b**, then **R-b** (one agent) | W-b: utils/requests, mocks (but sheet-providers); R-b: FR tray, toasts, menus, dice entry, their utils, utils/roll-reasons | WS4 | L1 | 14, 16 | 8.5 + 8.5 h |
| 3 | **R-a** | FR hooks (table-rolls, sheet-roller, gm-rolls, send-choice), FR types/constants, FR core utils, the dice utils, lifecycle, use-follow | WS4 | L1 | 15 | 13 h |
| 3 | **U1** | FS wiring (character-pane … wild-shape, charging), FS hooks, FS types/constants, class-line, roll-labels, use-creature, use-rolls-locked, sheet-providers | WS4 | L1 | 17 | 14.5 h |
| 3 | **U2** | FS parts (action-entry … uses-button, action-chips, row-name), FS/utils, the sheet's src/utils, chevron, entry-icon, description, use-popover, save-title | WS4 | L1 | 18 | 16 h |
| 3 | **V1** | FT, empty-state, live-status, local-time, fullscreen-*, use-table-api, use-waiting-prompts, use-turn-toast-foot, table-pages, ask-words | WS4 | L1, build | 19 | 13 h |
| 3 | **V2** | notes, party, companions, campaigns, characters, transfers, cookbook, the other shared components and hooks, polling, buttons, the remaining utils, pages, layouts | WS4 | L1, build | 20 | 13.5 h |
| 3 | **integration** (orchestrator) | — | all of Phase 3 | L1 + build per branch, **e2e** | — | 1.5 h |
| 4 | **WS12** F-a, F-b in parallel; then G | R1.9.20-30 | integration | L1, build, **e2e**, metrics after | 21-24 | 3 + 2, then 3.5 h |
| 5 | **Review** RV1 server, wire, checks; RV2 rolling, sheet; RV3 table, UI, tests, guards; fixes by owners | — | WS12 | L1, build | 25 | 3 + 2 h |
| 6 | **Final** (orchestrator) | R/ bookkeeping, e2e/README.md, lanes.conf | review | L3 replay, C1 retired, **e2e** + reruns, PR | 26-28 | 3.5 h |

A src file not named above belongs to the lane owners.tsv gives it (by real importers: server only → S,
sheet only → U2, rolling → R-a, else V2).

### §2.2 Ownership rules (R2.2.x)

1. **A lane edits only the files it owns** (owners.tsv's `lane`) and creates new files only under the
   folders it owns, or as a new file in a shared folder (src/components, src/hooks, src/utils,
   src/constants, src/types) named in its commit and added to owners.tsv by the orchestrator before
   Phase 3 (the `-` rows).
2. **Tests belong to their unit's owner**; a test that imports another lane's name imports it from the
   path 2b gave it, which does not change in Phase 3 (no lane moves a name another lane imports: those
   all moved in 2b). If a lane finds it must, it stops and the move becomes a Phase 4 item.
3. **The file → lane matrix is owners.tsv** (written now and binding; after commit 8 the orchestrator checks it
   against the tree, every `path_after` present and every file with a row, and commits any correction
   before the worktrees are made). An edit a lane would
   make to another lane's file is a Phase 4 item (R1.9.26), never an ask across lanes; no cherry-picks,
   no hand-offs inside Phase 3. Mocked paths (§1.8.3) and overridden constants are changed by no lane.
4. **Conflicts are found early.** At h+4 and h+8 of Phase 3 the orchestrator runs
   `git merge-tree --write-tree` on every pair of lane branches; a conflict means the matrix was wrong:
   that edit leaves the lane and goes to Phase 4.
5. **Phase 4 builders own across folders**, split so F-a and F-b never touch the same file (R1.9.20,
   .24, .25 → F-a; .21, .22, .23 → F-b); G owns everything after them.
6. **The kit and the goldens are frozen** after commits 2-4 (T(frozen) in owners.tsv); a lane that needs
   a kit change writes it in its report for Phase 4.

### §2.3 Worktrees, locks, integration

1. **WS0 (done):** branch merged with main (24f808b, no rebase); `npm ci`, `npx prisma generate`; L1,
   build; jest base (X/jest-base.json, .tsv); metrics base (R/analysis/metrics-base.md, ratchet-base.json);
   commit 1 (§1.7.1). **Left: the e2e full baseline** (§2.6), run by the orchestrator after this draft's
   commit, under both locks, before Phase 1.
2. **MOD:** main 94773cb = v0.42.1, the e2e's module; no MOD command is needed (`git -C MOD status` and
   `git -C MOD log -1` are read-only checks the orchestrator may run before each pass).
3. **Worktrees (Phase 3):** after commit 8 and the refreshed owners.tsv, `git -C APP worktree add -b
   local/043-<lane> /home/user/w043/<lane>/sending-stone-player <commit 8's SHA>` for S, W-a, W-b, R-a,
   R-b, U1, U2, V1, V2 (R-b's made when W-b finishes, from the same base), each with `npm ci` and `npx
   prisma generate` (9 × ~1.1 GB of 28 GB free; `df -h /` before each). Builders run no e2e and no server.
   Lane branches are local, never pushed.
4. **Saving lane work:** lane branches are never pushed (brief); at h+4, h+8, h+12 and h+16 the orchestrator writes each lane's commits since commit 8 as `git format-patch` text into R/patches/<lane>/ and pushes them in a chore(refactor) commit, so a container reset loses at most four hours.
5. **Locks:** `flock X/checks.lock` around every full jest, `tsc`, eslint or build anywhere; L0 without
   it; nothing heavy during an e2e pass (which holds X/checks.lock and APP/e2e/.out/e2e.lock).
   `flock X/git.lock` around git writes in APP.
6. **Integration (end of Phase 3):** the orchestrator rebases each local lane branch onto the
   integration branch in the order **W-a, W-b, S, R-a, R-b, U1, U2, V1, V2** (data and checks, server,
   rolling, the sheet, the table, the rest), fast-forwards APP's branch and pushes (no force); L1 + build
   after each (≈ 7 min each). Lane branches are local, so rebasing them rewrites nothing pushed. A
   conflict outside an import line means the matrix was wrong: the hunk is reverted from the later lane
   and goes to Phase 4.
7. **The e2e runs from APP** (so e2e/env.sh finds MOD beside it): `BUILD=1 npm run e2e` under both locks
   in the background, waiting on its log; failed runs alone with `ONLY=<suite> BUILD=0 flock -o
   e2e/.out/e2e.lock npm run e2e`. Each pass's result lines are kept in R/e2e/<pass>.out (committed with
   the next chore(refactor) commit) and diffed against the baseline's.

### §2.4 Workstream steps (items in this order; L0 per edit, L1 per item in Phase 3, per commit elsewhere)

- **WS0:** the e2e baseline now (after this draft is pushed, under both locks).
- **WS1 (T):** R3.1 → R3.2 → R3.5 (the kit's files handed to C-a, C-b as files) → R3.3 → R3.4 → the
  filename-case line → gate: 290 suites, 8,607 + the kit's tests, every base test equal → commit 2 (with M's
  R1.6 files).
- **WS2 (C-b, C-a):** §3.2's goldens on the unchanged code; a mutation spot-check per suite (a class in a
  portal, a body key's order, a word, a Prisma write, a refusal header, an issue text, a stored string, a
  draw's pool: a named test fails, then reverted) → commits 3, 4.
- **WS1b (M):** R1.6 first (h+0-2), the gate scripts (R3.7), then move.cjs and export-move.cjs dry-run on
  a scratch worktree (§1.9.1's moves applied, tsc clean, discarded).
- **WS3 (M):** R1.0.1 (commit 5), the ratchet re-taken (`run.sh moved`), R1.0.2 (commit 6).
- **WS4 (M):** R1.9.1 + R1.9.5 (commit 7), the cycle report; R1.9.2 → .3 → .4 (commit 8); build; owners.tsv
  checked against commit 8's tree; the e2e pass while lanes read their items.
- **S:** R1.3.1 → .2 → .3 → .14 (9) → .4 → .5 → .6 → .7 → .12 (10) → .8 → .9 → .10 → .11 (db/notes.ts last) →
  .13 (11). **W-a:** R1.4.1 → .2 → .3 → .8 → .9 (12) → .4 → .7 (13). **W-b:** R1.4.4 → .6 → .5 → .10 (14), then
  **R-b:** R1.2.8 → .9 → .10 → .11 → .12 (16). **R-a:** R1.2.1 → .2 → .3 → .4 → .5 → .6 → .7 → .13 (15).
  **U1:** R1.1.1 → .2 → .3 → .4 → .5 → .6 → .7 → .8 → .10 → .9 → .22 (17). **U2:** R1.1.11 → … → .20 → .22
  (18). **V1:** R1.5.2 → .3 → .4 → .5 (verbatim first) → .6 → .7 → .8 → .9 → .10 → .11 (19). **V2:** R1.5.13 →
  .14 → .21 → .16 → .17 → .18 → .19 → .20 → .15 → .22 → .23 (20). Full jest after each of R1.4.4, .6, .7.
- **WS12:** F-a (R1.9.20, .24, .25; commit 21) and F-b (R1.9.21, .22, .23; commit 22) in parallel; G: R1.9.26
  → .27 → .28 (commit 23) → .29 + .30 (commit 24); then the e2e pass.
- **Phase 5:** RV1 reads commits 9-14 and 22; RV2 15-18, 21; RV3 2-8, 19-20, 23-24, against this contract
  (surface, test policy, ownership), running the goldens; findings fixed by the lane's builder (a worktree
  from the branch head) or G for cross-area ones → commit 25.
- **Phase 6:** L3 over commits 2-25; commit 26 (C1 retired, counts.conf lowered); the final e2e and a rerun
  round alone; commit 27 (e2e/README.md timings and counts, lanes.conf seconds from times.tsv); commit 28
  (.refactor/ removed); the PR (§7).

### §2.5 Commits in the PR (in order; each green alone)

| # | commit (subject) | by | a reviewer checks |
|---|---|---|---|
| 1 | `chore(lint): import resolver and CLAUDE.md's rules, as warnings for now` (**1dff83f, in**) | WS0 | config only; lint exit 0 |
| 2 | `test: a small test kit, byte-identical helpers adopted, the no-db guard; the request-kind table (setup and new files)` | T, M | gate 1; counts; derived = literal |
| 3 | `test: characterization goldens for wire, composition, routes and refusals` | C-b | new files; snapshots read as today |
| 4 | `test: characterization goldens for markup, words, storage and dice draws` | C-a | new files; snapshots read as today |
| 5 | `refactor: features layout, a folder per component, barrels gone (moves only)` | M | renames; import and mock-path lines |
| 6 | `chore(lint): unicorn/no-null off with its reason; its 250 disables gone` | M | comments and one config line |
| 7 | `refactor: names other areas import, moved to their homes (export moves only)` | M | `--color-moved`; imports; one mock path |
| 8 | `refactor: cross-area seams (onItsWay, polling constants, useFollow, useSendChoice, NOT_MADE)` | M | C1-C8 unchanged |
| 9 | `refactor(server): the db cycle gone, one command creator, the kind table's switches, throttles` | S | prisma args, orders |
| 10 | `refactor(server): one seat resolver, NO_STORE and the answers, one body reader, the result router, types` | S | 401 before 404; header quirks; C5 |
| 11 | `refactor(server): event table and hello split, the roll path in stages, route and db complexity` | S | writes and their order; C5, C7 |
| 12 | `refactor(wire): lenient helpers, die sizes, event schemas table, hand types checked, types home` | W-a | C6; prettifyError text |
| 13 | `refactor(wire): the request-kind table read by schemas and constants; rollRequestSchema's rules by group` | W-a | issue order per kind |
| 14 | `refactor(checks): request checks by kind group, views in branches, the kind table read; mock base` | W-b | view key order; fixtures equal |
| 15 | `refactor(rolling): types out, one lifecycle, request builders, state reducer, GM rolls, roller split, dice parsers` | R-a | C2, C8; the hooks' API |
| 16 | `refactor(rolling): the tray one export per file, words per kind, toasts, small components, dice entry` | R-b | C1, C4; dice entry moved only |
| 17 | `refactor(sheet): the pane as composition, one command(), one actions object, one settle hook, Wild Shape split` | U1 | the two silent commands; C1-C3 |
| 18 | `refactor(sheet): one export per file; picker rules, link pills, one chip cluster, usePopover, save title` | U2 | classes and elements (C1) |
| 19 | `refactor(table): GameTable as composition, TurnToast and the tracker split, End Turn hooks, chat by kind` | V1 | render-time state; C1, C3 |
| 20 | `refactor(ui): seen query, icon-button classes, journal, party, companions, campaigns, transfers, cookbook` | V2 | query strings, URLs; C2 |
| 21 | `refactor: popovers, roll labels and chips adopted across areas` | F-a | C1 |
| 22 | `refactor: save titles, seat URLs, the table's seen query and header button adopted` | F-b | C2, C4, C5 |
| 23 | `chore(lint): CLAUDE.md's rules as errors, layered imports; dead code and unused exports gone` | G | eslint prints nothing |
| 24 | `docs(roadmap): v0.43 done; bugs and checks for v0.44` (+ metrics after in R/) | G | §4.5's text |
| 25 | `fix: review findings (v0.43)` (one per area if more than a few) | review | each finding's id |
| 26 | `test: whole-page markup goldens retired` (Q4 (a)) | final | C1's files only |
| 27 | `e2e: v0.43 timings and counts (bookkeeping)` | final | e2e/README.md, lanes.conf only |
| 28 | `chore(refactor): the planning folder removed` | final | .refactor/ only |

Before 1: 9ae1c44 (ROADMAP), 24f808b (merge of main), the chore(refactor) planning commits. Each message: subject, blank line, a few short paragraphs (what moved, what the gates showed), then the
two trailer lines of the brief. No model name in a commit.

### §2.6 Checkpoint ladder and e2e passes

| level | when | what | cost |
|---|---|---|---|
| L0 | every edit | `npx jest --findRelatedTests <files> --maxWorkers=2` (no lock) | s to ~1 min |
| L1 | every commit, every item in Phase 3 (under the checks lock) | `R/tools/l1.sh <outdir> [checkout]`: full `jest --json` + `next typegen && tsc --noEmit` + `eslint . -f json` + gates 1-10 | ≈ 5-6 min |
| L2 | each phase end | L1 + `next build` + the phase's e2e pass where §2.1 names one | 10-75 min |
| L3 | before the PR | `R/tools/replay.sh`: for each commit 2-25 in order, a detached worktree at that commit (node_modules symlinked while package-lock and prisma/ are unchanged) runs L1; a red commit is fixed forward in commit 25 and the replay repeated from it (history is never rewritten) | ≈ 2.5 h |

**Five full passes** (104 runs, ≈ 62 min each on this machine, `toasts` solo inside): (1) the baseline on
commit 1's tree (Phase 0, still to run), (2) after the moves, export moves and seams (commits 5-8,
Phase 2b), (3) after integration (Phase 3), (4) after the follow-ups and guards (commits 21-24, Phase 4),
(5) the final (Phase 6). No partial sets as phase gates: every phase that changes code across areas ends
with all 49 suites. `RETRY=1` only on the final pass, and said in the PR. A run red in pass N and green
in the baseline blocks the phase: its owner fixes it (or the commit is reverted) before the next phase.

## §3 Test policy

### §3.1 Rules (binding)

1. **Existing assertions are frozen.** No `expect(...)` statement of the 290 base suites changes, is
   removed or is skipped (gate 1), except C1's deletion in commit 26. A test's title and describe path
   (its `fullName`) stay (gate 2 matches on them); a file split keeps describe titles.
2. **A test file changes only in setup**: import lines (paths, names, an alias that keeps the old local
   name, §0.6.5), `jest.mock`/`requireActual`/`requireMock`/`doMock` paths and factory keys that follow a
   move (gate 4), a `guardNoDb()` line (R3.4), a local helper replaced by a byte-identical kit import
   (R3.3), a file-private type line, a removed eslint directive; or it **moves with its unit** (`git mv`,
   same name, or `<name>.integration.test.tsx` into `__tests__/`).
3. **New tests** only for new helpers (use-settle, roll-kinds, retryDelay, seenQuery, save-title,
   schemas/utils, dice, hello-features, the kit, useFollow, useSendChoice) and the goldens; each covers a
   behaviour no existing suite pins (CLAUDE.md §8: no overlapping coverage), table-driven where several
   inputs show one rule.
4. **Counts never fall:** suites and tests = base + added − retired (R/tools/counts.conf, gate 3).
5. **A failing existing test is a regression of the change, never of the test.** Fix the code; a test
   that cannot pass without editing its assertion means the change is not behaviour-preserving: revert.
6. **Goldens run with `--ci`** (no snapshot is written by accident); snapshots are written once in
   commits 3-4 and never updated (gate 10).

### §3.2 The kit (R3.1-R3.5; T; commit 2) and the goldens C1-C8 (R3.6; C-b commit 3, C-a commit 4)

**R3.1 (T.1) jsdom kit** src/utils/test-utils.ts: `respond(status, body?)`, `responding` (= Promise.resolve
of it), `advance(ms)`, `posts()`, `sent()` (every fetch call whole: url, method, headers as a sorted object,
raw body string; for C2), `rollServer(answers?)` → `posted` (action-entry.alone's semantics; goldens),
`minutesAgo`, `brokenImages()`, `normalizeIds(html)` (each distinct `_r_…_`, `_R_…_`, `«r…»`, `:r…:` token,
alone or inside a value such as `_r_3_-panel`, → `id-1`, `id-2` by first appearance, references
consistent; SheetIdPrefix ids untouched), `normalizeTimes` (`<time>` text → `⟨time⟩`, dateTime kept),
`atFixedTime(iso)`, `markup()` (both normalizers over `document.body.innerHTML`, portals included); its own
table test. 1.5 h.

**R3.2 (T.2) node kit** src/utils/test-utils-node.ts: `prismaMock` (re-export of jest.setup's),
`prismaFake(rows)` (installs `mockImplementation` on each model method named in `rows`: answers by model
and `where` match, records `{model, method, args}` in call order in `fake.calls`), `resetPrisma()`
(`mockReset(prismaMock)` + `$extends` re-pointed; clearMocks keeps implementations across tests),
`guardNoDb()` (an `afterEach` that fails naming every called model method: a walk of `Object.keys
(prismaMock)` and each model's keys, skipping `$extends`; prototype analysis/T/guard-probe.js),
`routeCall(handler, {method, url, body, headers, params})` → `{status, headers (sorted object), body
(text), json?}`. 1.5 h.

**R3.3 (T.3) Byte-identical copies adopted** (map T §3 lists each file:line): respond ×15 (variant A),
responding ×3, advance ×11, posts ×3, the 18 identical 3d-dice-react mocks via src/mocks/dice-renderer.ts
(`jest.mock('@lambersond/3d-dice-react', () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER)`),
minutesAgo ×5, brokenImages ×4, and the 33 relative `jest.setup` imports of prismaMock (→
`@/utils/test-utils-node`). Each deletes the local definition and adds an import; no call site and no expect
changes. Near copies stay. 1.5 h.

**R3.4 (T.4) No-db guard:** `guardNoDb()` after the imports of the 25 route suites that use no prismaMock
(analysis/T/route-suites.txt "noprisma"; all 25 pass a no-db probe today: guard-probe.txt, 281 tests, 0
prisma calls). Gate 8 checks the line and the pass. 0.5 h.

**R3.5 (T.5) SheetProviders** src/mocks/sheet-providers.tsx (one component): Favoriting, Charging,
Effecting, FavoriteMarks, RollsLocked, WildShaping, DescriptionLinks, Preparing, Enchanting,
Concentrating, ConditionsOpener, SheetIdPrefix, TableApiContext, CreatureContext as CharacterPane gives
them (the real hooks over a sheet and a seat; `NO_*` where the pane gives none); a prop overrides one;
its options type in src/mocks/types.ts. Goldens only. 1 h.

**R3.6 (T.6) The goldens** in src/__tests__/golden/ (new files only; `__snapshots__/` beside; helpers live
in the kit, never as a non-test .ts under `__tests__/`, which jest would run). Common: `atFixedTime(
'2026-10-04T19:30:00.000Z')`; `process.env.TZ = 'UTC'` at the top of each file; `Math.random` spied with a
fixed LCG (seed 43, a = 1664525, c = 1013904223, m = 2^32, value / m) in every golden that may throw
dice; `resetPrisma()` and `localStorage.clear()`/`sessionStorage.clear()` in `beforeEach`; `matchMedia`
narrow by default, wide spied; fixtures from src/mocks only; ids by normalizeIds, times by
normalizeTimes; snapshot names are fixed strings; one `describe` per surface. Each suite gets a
mutation spot-check (WS2 step) recorded in its commit message.

- **C1 markup** (`markup.golden.test.tsx`, C-a; ~45 snapshots; retired in commit 26, Q4): GameTable
  player seat (`toTableSheet(characterSheet())`, a message, a combat) narrow (Character/Chat/Combat tabs)
  and wide; GM seat with GM roll toasts; companion seat; CharacterPane on fullerSheet per tab (Actions,
  Spells, Inventory, Features, Effects, Biography); druidSheet/shapedSheet (Wild Shape ribbon, Return
  popover); mockCompanionSheet's creature tabs; open menus (item menu with moves, an action's roll menu,
  the press menu); open dialogs (Settings, dice entry, Modify damage, Longsword attack picker, Your rolls,
  move/distribute/remove/confirm, Journal modal empty and with chapters, 'The Iron Company', cookbook);
  roll toasts pending/done/refused, the turn toast `taking`, a page toast; CampaignIndex per campaign
  state and refusal; the character list, join, login and home pages. Each `markup()` after the gesture.
- **C2 wire** (`wire.golden.test.tsx`, C-b; ~80 cases): `sent()` whole for each request: the 30
  ROLL_KINDS from their UI gesture (analysis/T/kinds-where.txt names the building file per kind) with the
  body-changing variants (advantage, typed dice, effect dice, aloneChoices, self target, companion seat
  `…/companions/<c>/rolls`, GM seat `/api/campaigns/<id>/characters/<actor>/rolls`) and the poll after
  (`/rolls/<id>`, `no-store`); every send* of useTableRolls at both seats, typed and kept rerolls on and
  off (25 kinds, 3 damage branches, the hitDie sequence, a busy retry, readWildShapeForms); the pane's
  command bodies (map U1 G-U1a); End Turn and Undo; the table poll per seat with every flag and none,
  party, companion, cookbook, sheet texts, notes GET/POST/PATCH/DELETE/preview/order for first read,
  every optional field, 204, 401, 404, 500 and the backoff delays; markChatRead's calls. All roll POSTs
  pass `follow()` (one choke point).
- **C3 composition** (`composition.golden.test.tsx`, C-b): for GameTable (player, GM, companion),
  CharacterPane, CompanionPane, PartySheet, JournalCard: the tree of area-root components (GameTable,
  CharacterPane, CharacterSheet, RollTray, ChatLog, CombatTracker, TurnToast, JournalCard, PartySheet,
  CompanionPane, CookbookCard, PageToasts) read from the fiber (`__reactFiber$` key, walking `.return`,
  `type.name`), each root's props keys and serializable values (functions → `fn`, elements → `el`); plus
  `JSON.stringify` of toCommand, toRollRequestView (each status branch), toGmRollView over fixed inputs.
  Area-root names are frozen in v0.43.
- **C4 words** (`words.golden.test.tsx`, C-a; ~60 cases): visible strings and accessible names
  (`textContent` and role + name lists via `getAllByRole`) per kind's toast in each state (pending,
  waiting for player, done, refused per reason), `reasons('player'|'gm')` and briefOf over a table of
  states × kinds (GM shapes, partly made), tray rows, chat lines per message kind, turn toast states,
  turnRefusedLine per refusal key, subtitle/combatSummary/badgeCount, move/transfer words (move-words.ts),
  slot words, the four save titles (G7), noteTime at a fixed now and TZ, note-words and order-words
  outputs.
- **C5 routes** (`routes.golden.test.ts`, C-b, node; ~120 cases): every route method of
  analysis/T/route-exports.txt (40 files, 52 handlers; auth excluded) by `routeCall` over the real db
  modules on `prismaFake` rows: signed out, another user's sheet (404), bad hash, unchanged (204), GM
  seat, player seat, happy path; the recorded `fake.calls` (model, method, args, in order: transaction
  order counts) and the response (status, sorted headers incl. `Cache-Control`, `Retry-After`, CORS, body
  text). Includes G-S2 (events and commands: no secret, not Forge, declared/undeclared oversize, bad
  envelope, protocol, ping ok/unknown/refused, malformed with recordRefusal's args, hello/heartbeat
  answer text, texts 204, OPTIONS ± private network; commands off, cold, held, aborted, open changed)
  and G-S5 (the dish ladder and a fixed view's version).
- **C6 refusals** (`refusals.golden.test.ts`, C-b, node; ~150 cases): `safeParse(...).error.issues`
  (code, path, message) for rollRequestSchema per kind (one wrong field each, one unknown key each), the
  sending-stone event schemas (per EVENTS type a good and a malformed payload → parseGameEvent's output
  and `z.prettifyError` text), notes, cookbook, campaign, foundry-settings; per route the status and body
  for malformed JSON, wrong content type, too large (MAX_ROLL_BYTES 16,384; MAX_NOTE_BYTES; 4,096 for
  commands), wrong secret, not set up (`data-refusal` wrongSecret, malformed, notSetUp).
- **C7 storage** (`storage.golden.test.tsx`, C-a): localStorage and sessionStorage keys and values after
  each gesture (§1.8.1's keys: SEND_KEY, GM_SEND_KEY, ALONE_KEY, GM_ALONE_KEY, TOASTS_KEY, LAST_FORM_KEY,
  ENDED_KEY, favorites-shown, actions-layout, actions-closed, alone-spend, creature) (G-U1e, G6); db rows
  written (create/update `data` args) per command kind via prismaFake: createRollRequest per kind (G-S3:
  roll typed + effectDice + kept rerolls, GM roll with label, transfer with GM label, remove, favorite,
  effect, wildShape change and `forms`) and each ladder's first refusal, notes create/change/order,
  cookbook dishes, the hello's `campaign.update` data for a full 0.42 hello and a pre-0.10 one (G-S4).
- **C8 dice draws** (`dice.golden.test.tsx`, C-a): useSheetRoller with the fixed `Math.random`, per roll
  shape (d20 normal/advantage/disadvantage, Elven Accuracy 3d20 with ELVEN_LINE as today, damage normal
  and critical (EVERY_DIE_TWICE), with modifiers, hit die minimum, hit dice, formula, effect dice Bless d4
  / Bane, typed dice kept rerolls): the number of `Math.random` calls, the pools and totals, and the body
  posted; no 3D renderer (NO_DICE_RENDERER).

What keeps them stable: fixed clock, TZ, random sequence, cleared storage, prisma reset per test;
normalized ids and times; fixtures from src/mocks only (W-b's mock base must keep their outputs, R1.4.10).

### §3.3 Where tests live after v0.43

- Unit suites beside their unit, moved with it in commit 5 (owners.tsv `path_after`), split with it in
  Phase 3 by describe block when a lane splits a module (roll-requests.test → requests/*.test,
  bridge-http.test → attempt.test + routes/bridge-http.test).
- **41 integration suites in `__tests__/`** (owners.tsv `path_after`): FT/__tests__/ the nine
  game-table*.integration.test.tsx + chat-results.integration.test.tsx (V1); FS/__tests__/
  character-pane{,.creature,.notes}, charges, enchantments, favorites (U1), action-entry.alone, item-menu,
  recharge-chip (U2), seat-words (R-b); FR/__tests__/ use-sheet-roller{,.typed,.elven-off} (R-a),
  needs-player (R-b); F/companions/__tests__/companion-pane; F/transfers/__tests__/ give-controls,
  party-controls, take-controls (V2); src/app/api/__tests__/<route-path-dashed>.integration.test.ts for
  the 12 route suites over real db modules (S); src/lib/routes/__tests__/companion-routes.integration
  .test.ts (S). The goldens in src/__tests__/golden/ (cross-feature).
- jest's default testMatch already runs `__tests__/**` and `*.test.*`; no config change.

### §3.4 Gates (scripts in R/tools/, written by M in Phase 1, not in the PR)

`R/tools/base.sh`: if X/base/jest-base.tsv is missing, `git -C APP worktree add --detach X/base/wt
24f808b`; node_modules symlinked from APP when `git diff --quiet 24f808b HEAD -- package-lock.json
prisma/` (else `npm ci && npx prisma generate` in the worktree); under `flock X/checks.lock`: `npx jest
--json --outputFile=X/base/jest-base.json --maxWorkers=3`; `node R/tools/base-tsv.mjs` → jest-base.tsv
(`file\tfullName\tstatus\tnumPassingAsserts\toccurrence`, 8,607 rows) and X/base/expects/ (gate 1's per-test
expect lists, from the TS AST of 24f808b's test files); `git worktree remove --force X/base/wt`. X/jest-base.json
from WS0 (54d8128, same src) may seed it.
`R/tools/l1.sh <outdir> [checkout]`: under the checks lock, full `jest --json --outputFile=<outdir>/jest.json`,
`next typegen`, `tsc --noEmit`, `eslint . -f json -o <outdir>/eslint.json`, then `R/tools/gates.sh <outdir>`;
each gate prints `gate N ok|FAIL` and writes `<outdir>/gate-N.txt`; exit = the number of failed gates.
Paths are followed through `git diff -M50% --name-status 24f808b HEAD` plus R/tools/moves.tsv (the
codemods' own record: base path → path, and for split files base path + describe prefix → path).

1. **assertions** (gate-1.mjs): the TS compiler API lists, per test (describe/it title path, occurrence),
   the ordered `expect(...)` statements with whitespace collapsed outside strings, at base and head; every
   base list equals the head's for the same test (paths followed). Allowlist R/tools/gate1.allow: C1's
   deletion (commit 26) only.
2. **per test** (gate-2.mjs): each base test is present at head (file mapped, fullName, occurrence),
   `status: passed`, `numPassingAsserts` ≥ base.
3. **counts** (gate-3.mjs): suites and tests = base + added − retired per R/tools/counts.conf (one line per
   commit that adds tests: the kit test, goldens, the new helpers' tests).
4. **stale mocks** (gate-4.mjs): each `jest.mock`/`requireActual`/`requireMock`/`doMock` path resolves (TS
   module resolution with tsconfig paths, `@/`, src modulePaths, relative from the test's folder), the
   resolved module is in the import closure of the test's own imports, and every key of a mock factory's
   object literal is an export of the resolved module (a key the module no longer has mocks nothing).
5. **overridden constants** (gate-5.mjs): the five overrides (effect-controls.test.tsx:28 EFFECT_SETTLE,
   wild-shape.test.tsx:33 WILD_SHAPE_SETTLE in `@/constants/sending-stone`; cookbook-dish-list.test.tsx:8
   DISH_ATTEMPTS, cookbook/dishes/route.test.ts:17 MOST_DISHES_WAITING in `@/constants/cookbook`;
   use-sheet-roller.elven-off.test.tsx:19 ELVEN_LINE in typed-dice): the name is still declared in the
   resolved module and the subject's closure reads it from there at use time (an import of the name, not
   a copied value at module scope in another file).
6. **route exports** (gate-6.mjs): per route.ts, page.tsx, layout.tsx the exported names equal the base's
   (analysis/T/route-exports.txt + the pages').
7. **shims** (gate-7.mjs): no `v0.43-shim` comment and no re-export-only module (`export … from` and
   nothing else) except files in R/tools/shims.allow (expected empty; empty again after commit 23).
8. **prisma** (gate-8.mjs): each of the 25 suites has `guardNoDb()` and passed.
9. **lint ratchet** (gate-9.mjs): `eslint -f json` warnings per (folder, rule, syntax check) ≤ the
   ratchet base (R/analysis/ratchet-base.json, re-taken after commit 5 as ratchet-moved.json; after
   commit 23 every count is 0 and errors are 0).
10. **goldens** (gate-10.mjs): src/__tests__/golden/** green; jest.json `snapshot.added == 0`,
    `unchecked == 0`, `updated == 0`; `git diff --quiet <commit 4> -- 'src/__tests__/**/__snapshots__/**'`
    (C1's removal allowed in commit 26 only).

Also in R/tools/: `move.cjs`, `export-move.cjs` (§1.0, R1.9.1), `replay.sh` (L3), `counts.conf`,
`gate1.allow`, `shims.allow`, `moves.tsv`. 3 h (M, Phase 1).

**R3.7 (T.7)** is the above. **R3.8 (T.8)** is §3.3 with commit 5. **R3.9 (T.9)** the test-lint lines
(§1.7.2, §0.6.6). **R3.10 (T.10)** commit 26: delete markup.golden.test.tsx and its .snap; counts.conf
lowered by its tests; gate1.allow names it. 0.25 h.

## §4 The bug log (bugs-found.md, deduplicated; each re-read in the code at 24f808b)

20 entries in bugs-found.md, none duplicated across mappers; one corrected on re-reading (B20). None is
fixed in v0.43.

### §4.1 Seen in code (12)

| id | where (at 24f808b) | what | sev. |
|---|---|---|---|
| B1 [U2] | use-picker.tsx:701 (leadFor :1141), cap :695 (MAX_USE_TARGETS 20, constants :514) | "Up to N." with N uncapped while ticking stops at 20; "any number" ticks 20 and says no limit | low |
| B2 [U1] | character-pane.tsx:1186 | "Effects, 1 conditions": no singular (e2e/phone-e2e.mjs:330 pins it) | low |
| B3 [S] | db/campaigns.ts:437 via events/route.ts:127 | a `bridge.ping` (record: false) matching an unbound campaign's title and secret binds it (PROTOCOL.md:1513: "Store nothing"); a Test from another campaign binds the wrong module id and the real campaign is then refused 404 notSetUp | medium |
| B4 [S] | seat-routes.ts:126, notes-routes.ts:183 | bodies read whole before the size check, no declared Content-Length check (the other three readers have one) | low |
| B5 [S] | db/roll-requests.ts:748, :773, db/cookbook.ts:223 | process-wide throttle Maps never pruned | low |
| B6 [V1] | combat-tracker.tsx:203-208 | the HP bar tests the rounded percent for 0: 1 of 250 HP draws an empty red bar | low |
| B7 [V1] | local-time.tsx:20-21 | "today" decided at render: an idle chat keeps yesterday's times without their date | low |
| B8 [V2] | sheet-tiles.tsx:445, chat-log.tsx:788, avatar.tsx:40 (campaign-order.ts:105 is right) | initials from the first UTF-16 unit: 🐉 Ember → a lone surrogate | low |
| B9 [V2] | use-companion-view.ts:84-93 | the companion poll never backs off or says it is reconnecting (3 s during an outage) | low |
| B10 [R] | use-table-rolls.ts:496-502 (read :1180, :1584) | sendDamage marks `damaged: true` on send and nothing clears it: after a refused or failed damage request the Roll damage button is gone | medium |
| B11 [R] | roll-tray.tsx:1761-1763 vs :2286-2288, :668-673 | the GM's partly-made hit dice line omits "· N HP regained" though gmRollsOf keeps `healed` (use-table-rolls.ts:1065) | low |
| B12 [R] | use-table-rolls.ts:1270-1276 | a 202 whose body isn't JSON is told as refused `network` | low |

### §4.2 To confirm (the code reads so; the effect needs the module or a browser) (6)

| id | where | what |
|---|---|---|
| B13 [U2] | actions-tab.tsx:730 vs :580, action-entry.tsx:867 | the table layout names an activity's uses `actionTitle`, the list layout `usesName`: two names, if the module sends such an activity |
| B14 [U1] | character-pane.tsx:1066-1073 | ending an enchantment never `setActed`: no line on the Effects tab when no favorite rolls |
| B15 [U1] | wild-shape.tsx:1621 | Dismiss focuses `#sheet-panel`, hidden with a companion's pane or another phone tab (focus lost) |
| B16 [S] | characters/[id]/texts/[hash]/route.ts:18, 21, 23; campaigns/…/texts/[hash]/route.ts:15 | 401 (and 404s) with no Cache-Control where siblings send no-store |
| B17 [S] | lib/app-origin.ts:9 | `x-forwarded-host` taken whole (a comma list gives a wrong origin; latent on Vercel) |
| B18 [V2] | use-notes.ts:337-357 | a 401 counts as a failure: the journal shows 'failed' where the table and party polls send to sign-in |

### §4.3 Behaviour questions for v0.44 (9)

Q1 [W] a companion's prepare/spellSlot is refused 409 `unavailable`, its own-switch kinds 422 `unknown`
(db/roll-requests.ts:154): one answer? · Q2 [W] foundry-settings.ts:19 `listOf` cuts before dropping
malformed entries, sending-stone.ts:2277 `mostOf` after · Q3 [V1] the bottom bar's tabs clear the turn's
refusal line (game-table.tsx:916, :933, :950), the wide column's (:736, :752) don't · Q4 [U1] Heroic
Inspiration (character-pane.tsx:1103) also sends without setActed: intended? · Q5 [U1/V1] "the seat's own
turn" is tested three ways that disagree on an empty companion key (game-table.tsx:1357-1362,
combat-tracker.tsx:256-258, end-turn.ts:75-76) · Q6 [W] 40 hand types are not exact to their schemas
(analysis/W/types-probe.txt): which derive? · Q7 [S] double reads (a table poll reads the campaign and GM
rolls twice, a party poll the campaign 3×, each held claim pass 3×; one scrypt per event post): measure ·
Q8 [T] overlapping coverage (map T §7) · Q9 [R] the five `console.error` sites (fact 19): logs or a logger?

### §4.4 Tooling defects (2)

B19 [T] jest.config.ts:16: the `'index.ts'` coverage pattern also drops campaign-index.tsx (and
`'types.ts'`, `'auth.ts'` would drop `*types.tsx`, `*auth.ts(x)`). · B20 [V1] game-table.test.tsx:19 and
game-table.party.test.tsx:20 mock use-table-view without POLL_INTERVAL (OVER_FOR, SETTLE_FOR NaN under them;
the typed-dice "later" rule never holds); re-checked: not the six suites the mapper named (four spread
`requireActual`); after R1.9.3 they run real timings, equal by fact 14's probe. Notes (no ROADMAP entry):
import/no-cycle was blind before commit 1; rules-of-hooks flags test helper names (§0.6.6); the old
"db must not import schemas" zone (§1.7.4); e2e/README.md's "about 31 minutes" is ~62 here (commit 27).

### §4.5 The ROADMAP edit (commit 24; G pastes it, updating only paths G finds moved further)

In `## v0.43`, item 1 becomes:

```
1. **Refactor (done in v0.43's PR):** the app's code laid out by feature under `src/features/`, each
   `.tsx` exporting one component, named types in `types.ts`, rules in utilities and behaviour in hooks;
   one request-kind table, one command pipeline on the server, one request lifecycle, one settle hook
   and one seat resolver; no import cycles or barrels; CLAUDE.md's rules enforced by the linter. No
   behaviour changed: the module and its protocol are untouched, and the bugs found are below, under
   v0.44.
```

and its "Open question" bullet about the refactor is removed. In `## v0.44 (release candidate)`, item 9
becomes:

```
9. Remaining bugs, and the known limits chosen to close before v1.0. Found in the v0.43 refactor (not
   fixed there):
   - **A connection test binds a campaign:** a Test from the module (`bridge.ping`) whose typed title
     and secret match a campaign waiting for Foundry binds it to the tester's module campaign, though
     the protocol says a ping stores nothing; a Test from another campaign of the same game then leaves
     the real campaign refused as not set up (`src/db/campaigns.ts`, `bind` from `findEventCampaign`).
   - **Damage not offered again after a failed send:** an attack's or use's damage that the app
     couldn't send (offline, busy, refused) is marked as sent, so its Roll damage button is gone
     (`src/features/rolling/hooks/use-table-rolls.ts`, `sendDamage`).
   - **The Gamemaster's partly-made hit dice** don't say the hit points regained, as the player's do
     (`src/features/rolling/utils/gm-words.ts`, `gmLine`).
   - **A roll the app took told as unreached** when its 202 answer isn't JSON (`src/utils/lifecycle.ts`,
     `follow`; unlikely).
   - **"Effects, 1 conditions":** the Effects tab's hidden count has no singular (the phone suite's
     check changes with it).
   - **The target list promises more than it takes:** "Up to 24." where at most 20 can be ticked, and
     nothing said for "any number" (`use-picker`'s `leadFor`).
   - **The same uses named two ways:** an activity's uses in the table layout are named after the
     activity, in the list layout after the item (to confirm with the module).
   - **Ending an enchantment says nothing** on the Effects tab when no favorite rolls (to confirm), and
     Heroic Inspiration likewise: intended?
   - **Dismissing "Wild Shape ended"** sends keyboard focus to a hidden panel when a companion's pane or
     another phone tab is shown.
   - **Health bars:** a living combatant under half a percent of its hit points shows an empty red bar.
   - **Chat times after midnight:** an idle table keeps showing yesterday's times without their date.
   - **Initials of a name starting with an emoji** show a broken glyph on the sheet and in the chat
     (the campaigns page gets them right).
   - **A companion pane's reads** never back off or say they are reconnecting while the server is
     down.
   - **The journal after signing out elsewhere** says it failed instead of asking to sign in (to
     confirm).
   - **Large bodies:** a roll's or a note's body is read whole before its size is checked; the module's
     and the cookbook's routes refuse a declared oversize first.
   - **Two sheet-text routes** answer 401/404 without `Cache-Control: no-store` (to confirm it matters).
   - **Chained proxies:** the app's own address takes a comma-separated `X-Forwarded-Host` whole (latent
     on Vercel).
   - **Throttle memory:** three per-server throttles keep one entry per campaign or character forever.
   - **Coverage:** `jest.config.ts` leaves `campaign-index.tsx` out of the coverage count.
   Questions from it: a companion's refusals for its own-switch kinds (409 or 422); where the turn's
   refusal line clears; "the seat's own turn" for an empty companion key; the hand-written types that
   differ from their schemas; the double reads on the table, party and module polls; the overlapping
   route and table tests; the five `console.error` logs.
```

## §5 Risks and how each is caught

| # | risk | caught by |
|---|---|---|
| 1 | body or view key order drifts (NO_DICE spreads, request-bodies, toRollRequestView, commandPayload) | C2, C3, C5, C7 compare strings; the suites' JSON.stringify assertions |
| 2 | a wrong ROLL_KIND_INFO flag changes a refusal | roll-kinds.test (derived = literal) green on today's code in Phase 1; C6; the db suites' `in` orders |
| 3 | superRefine issue order or prettifyError text changes | roll-request.test, sending-stone.test, C6 |
| 4 | a jest.mock on an old path or a moved name mocks nothing (real prisma, real timers) | gate 4 (resolves, in the closure, every key exported), gate 8 (guardNoDb), §0.2.6 |
| 5 | an overridden constant copied instead of read | gate 5 |
| 6 | render-time setState, effect or hook order changes (pane, GameTable, Wild Shape, TurnToast) | verbatim first, source order, L0 per hook; the 6 pane and 9 table integration suites; C1, C3; e2e |
| 7 | memo identities shift dep-less layout effects (useEffectChoice, useEffectControls, useSpentOffers) | "no new memo" (R1.1.4); their suites; C1; e2e effects, typed |
| 8 | markup drifts (spans, class order, portals, useId order) in the tray, picker, popovers, bridges | C1 (ids normalized, portals in), C4; the components' suites; e2e role/name queries |
| 9 | fake-timer order in follow, pause, useFollow | use-table-rolls, use-end-turn, use-turn-undo, use-transfers suites |
| 10 | seen-query param order turns 204s into 200s silently | C2 (URLs whole), seen-query's table test |
| 11 | a server module in a client bundle | zone 1 (§1.7.4); `next build` |
| 12 | a move or export move creates a cycle or a stale import | import/no-cycle per L1; the cycle report after commits 5, 7, integration, 23; tsc; `git diff --color-moved` |
| 13 | two lanes edit one file | owners.tsv; merge-tree at h+4, h+8; a conflict outside import lines goes to Phase 4 |
| 14 | a route file gains a non-route export | gate 6; typegen + tsc |
| 15 | goldens order-dependent (per-file id counter; clearMocks keeps prisma implementations) | normalizeIds, resetPrisma, storage cleared, `--ci`; each golden file green alone and in the full run before its commit |
| 16 | C3's fiber walk relies on React dev internals | React pinned at 19.3.0; C3 only regenerated by the orchestrator with a reason (not in v0.43) |
| 17 | locale and time zone in LocalTime and note times | normalizeTimes, TZ = UTC |
| 18 | fixture outputs change under the mock base | the goldens read fixtures from src/mocks; R1.4.10 is byte-neutral by rule |
| 19 | real timings in game-table.test and .party after R1.9.3 | fact 14's probe; gate 2 at commit 8 |
| 20 | a dice parser split changes a draw | C8 green or the function is held and named (R1.2.13) |
| 21 | R and W are the long poles; 9 lanes share one checks lock on 4 CPUs | two builders each (§0.6.2); L0 between items; ~20 % lock time in §8 |
| 22 | a container reset loses work | every green APP commit pushed; lane commits saved as format-patch text in R/patches every 4 h (§2.3.4); the base regenerable (base.sh) |
| 23 | the disk fills (9 worktrees; the jest cache reached 7.9 GB) | `df -h /` before each worktree and pass; `npx jest --clearCache`, old X scratch |
| 24 | an e2e flake read as a regression, or a regression hidden by RETRY | no RETRY before the final pass; red runs rerun alone; result lines diffed against the baseline |
| 25 | Phase 2b's single builder is the bottleneck | its codemods written and dry-run in Phase 1; lanes read their items during 2b's e2e pass |
| 26 | Q3's react-hooks rules invite rewrites that change render timing | a reasoned line disable over a rewrite (§1.7.2 counts them) |

## §6 Out of scope

The module (lambersond/fvtt-sending-stone) and PROTOCOL.md; any behaviour change, bug fix or new
feature (bugs → §4); the e2e suites (but commit 27's bookkeeping); ROADMAP v0.43 item 2 (supported
versions); database schema, migrations, queries' shape and indexes; dependencies beyond commit 1's three
dev dependencies; Q1's exclusions and the two-copy merges (§1.10); file-size caps; a shared IconButton
component (v0.44 item 3's call); SonarQube itself (eslint-plugin-sonarjs stands in, Q3); deployment.

## §7 The PR

**Title:** `v0.43: the app refactor (features layout, CLAUDE.md rules enforced, no behaviour change)`

**Body outline** (written by the orchestrator in Phase 6 from the commit messages, R/reports and the
metrics; .refactor/ is gone by then, so the body carries what reviewers need):
1. **What changed:** the tree (§1.0 in a few lines); the five Q1 consolidations with before/after copy
   counts; the pane and the game table as composition; the request-kind table; the export moves and why
   there are no shims; the JSX hooks' bridge shape; what was deliberately not done (§1.10, short).
2. **Metrics before and after:** §0.4's table filled from metrics-base.md and metrics-after.md (lint
   warnings, rule (a) files, types, complexity, cycles, barrels, disables, react-hooks, copies), with the
   two held complexity functions named.
3. **How it was verified:** per commit L1 (jest --json gates 1-10, typegen + tsc, eslint), `next build`
   per phase, the L3 replay (every commit green alone), the goldens C1-C8 (C1 retired at the end, Q4), the
   five e2e passes (104 runs each; RETRY only on the final, said), the jest counts (290 → N suites, 8,607 →
   M tests, every base test passing with equal or more asserts).
4. **Bugs found (not fixed):** §4's table, pointing at ROADMAP v0.44 item 9.
5. **Follow-ups:** the behaviour questions (§4.3), the overlap and efficiency reports, the 40 hand types,
   IconButton.
6. The trailer the reminder asks for: `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and
   the session link.

## §8 Timeline (Eastern time; EST since Nov 1)

Assumptions: a workflow runs 2 agents; the machine has 4 CPUs, so at most 4 workflows (8 agents) run at
once and every full jest, tsc, eslint or build queues on X/checks.lock (L1 ≈ 6 min; ~20 % of lane time is
allowed for lock waits and L1s); an e2e pass takes ≈ 62-75 min (BUILD=1) and stops everything heavy;
hours are §1's estimates. Slots in Phase 3: WF-A S + U2, WF-B R-a + U1, WF-C W-a + V1, WF-D W-b → R-b + V2.

| when (EST) | what | who | ends with |
|---|---|---|---|
| Mon Nov 2 10:15 PM → 11:30 PM | this draft (round.md, owners.tsv) | planner | commit, push |
| Mon 11:35 PM → Tue 12:50 AM | **e2e pass 1: the baseline** on commit 1's tree (the critics read only) | orchestrator | R/e2e/1-baseline.out |
| Mon 11:35 PM → Tue 1:20 AM | safety, value, completeness critics (2 at a time) | critics | critique-*.md |
| Tue 1:20 AM → 2:45 AM | revision, dispositions | planner | round.md revised, pushed |
| Tue Nov 3 ~8:00 → 9:00 AM | **the user reviews**; answers if any (none asked) | user | go |
| Tue 9:00 AM → 5:00 PM | **Phase 1**: T kit (→ commit 2 ~3:30 PM, with M's roll-kinds files), C-b and C-a goldens (kit files from ~11:30 AM; commits 3, 4 ~4:30 PM), M: roll-kinds (9-11), gate scripts (11-2), codemods + dry run (2-5) | T, C-a, C-b, M (3 workflows) | commits 2-4, tools |
| Tue 5:00 PM → 7:30 PM | **Phase 2a**: commit 5 (moves), ratchet re-taken, commit 6 (no-null) | M | L1, build |
| Tue 7:30 PM → Wed 2:00 AM | **Phase 2b**: commit 7 (export moves), commit 8 (seams); owners.tsv checked | M | L1, build |
| Wed Nov 4 2:00 AM → 3:15 AM | **e2e pass 2** (commits 5-8); lanes read their items | orchestrator | R/e2e/2-moved.out |
| Wed 3:15 AM → 3:45 AM | 9 worktrees (`npm ci`, `prisma generate`) | orchestrator | worktrees |
| Wed 3:45 AM → Thu Nov 5 ~3:00 AM | **Phase 3** (S ≈ 18.25 h is the long pole; W-b then R-b ≈ 17 h; U2 16 h; U1 14.5 h; V2 13.5 h; R-a, W-a, V1 13 h); merge-tree checks at h+4, h+8 (Wed ~7:45 AM, ~11:45 AM); lane patches saved to R/patches/ at h+4, h+8, h+12, h+16 | 9 builders | commits 9-20 (local) |
| Thu 3:00 AM → 4:15 AM | **integration** W-a, W-b, S, R-a, R-b, U1, U2, V1, V2 (L1 + build each), pushed | orchestrator | branch at commit 20 |
| Thu 4:15 AM → 5:30 AM | **e2e pass 3** | orchestrator | R/e2e/3-lanes.out |
| Thu 5:30 AM → 8:45 AM | **Phase 4**: F-a (commit 21), F-b (commit 22) | F-a, F-b | L1, build |
| Thu 8:45 AM → 12:30 PM | G: commit 23 (rules to error, zones, dead code), commit 24 (ROADMAP, metrics after) | G | lint prints nothing |
| Thu 12:30 PM → 1:45 PM | **e2e pass 4** | orchestrator | R/e2e/4-guards.out |
| Thu 1:45 PM → 4:45 PM | **Phase 5** review (RV1, RV2, RV3) while the L3 replay of commits 2-24 runs under the lock (~2.4 h) | reviewers, orchestrator | findings |
| Thu 4:45 PM → 6:45 PM | fixes (commit 25), L3 for commit 25 | lane builders | L1, build |
| Thu 6:45 PM → 7:00 PM | commit 26 (C1 retired) | orchestrator | L1 |
| Thu 7:00 PM → 8:15 PM | **e2e pass 5, the final** (`RETRY=1`, said in the PR), rerun round of any failure alone | orchestrator | R/e2e/5-final.out |
| Thu 8:15 PM → 9:00 PM | commit 27 (e2e bookkeeping), commit 28 (.refactor/ removed), PR body | orchestrator | **PR opened ≈ Thu Nov 5, 9:00 PM EST** |

Slack: Phase 3's estimates are the largest uncertainty (±30 %); a lane that runs long delays only
integration (the others wait finished). A red e2e pass adds about 2 h (rerun alone, fix, pass again).
If the user allows Phase 1 to start right after the revision (Tue ~3:00 AM), everything moves ~6 h
earlier; the plan does not assume it.

## §9 Questions for the user

None. The decisions (Q1-Q4, the planning folder), CLAUDE.md and the code settle every choice above; the
choices the planner made without a question are §0.6's, each with its reason.
