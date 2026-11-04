# G (Phase 4.2): commits 23 and 24

## Fix round 1 (after the independent review of local/043-G; 2026-11-04, about 04:45-05:10 UTC)

Worktree /home/user/w043/G/sending-stone-player, branch `local/043-G`, continued from 9986f99.
New commits only: nothing was amended, and no golden, existing assertion or mocked path changed.
Nothing pushed.

| SHA | subject | finding |
|---|---|---|
| 9cc94f9 | chore(refactor): gate 10's allowance applies to both sides (G, RV-G-1) | RV-G-1 |
| 5d2ac00 | fix: v0.43 lint, round 1 (two directives say what timing they keep; the companions mock's range made line-level) | RV-G-2, RV-G-3 |
| 3acf5f6 | chore(refactor): metrics after re-taken at the lint fix (G, round 1) | RV-G-2, RV-G-3 (R1.9.30 follows the tree) |
| (the commit after 3acf5f6) | chore(refactor): G report (Phase 4.2, with fix round 1) | RV-G-5 (b) |

### RV-G-1 (major): fixed in 9cc94f9

- **The fix:** gate-10.mjs drops gate10.allow's line from both texts before it compares them:
  `frozenText(file, allowedText(file, then)) !== frozenText(file, allowedText(file, now))`. So
  the line may stay or go, and every other line stays held. The .snap branch is unchanged. The
  header comments of gate-10.mjs and gate10.allow say so.
- **Reproduced first.** bc80be7's gate, on commit 22's jest.json (X/l1/F-b/landing) against APP
  (src = commit 22, since 5555b87 changed only R/): `gate 10 FAIL`, `src/utils/test-utils-node.ts:
  changed since 4e7b8ec`, exactly as the review found.
- **Gate 10 with the fixed tools, same jest.json** (X/l1/G/fix-g10/):
  - ok (991 golden tests, 24 frozen files) at APP's head (src = commit 22) and at 6fee233.
  - Replayed at every state of the node kit, in a `git clone --shared` in X (nothing written in
    APP): ok at 4e7b8ec (8 frozen files then), fd2c34d, 51e82f8, bc80be7, 6fee233 and 9986f99.
    The kit changed only in those commits, so commits 2-22 all hold.
  - Mutation: one other line of the kit changed in that clone → FAIL; restored → ok.
- **APP's head stays green** with the branch's tools: gates 10 and 11 at APP's head, on commit
  22's jest.json and eslint.json, are both ok (X/l1/G/fix-g10/app-head). Gate 11's allowance only
  turns a FAIL into a note when last-heard.tsx exists, so it cannot fail an earlier commit.
- **One side effect, for the PR's history note (amendment 4 (d)):** fd2c34d, the commit 6 that
  was red alone on gate 10, is now ok under today's tools, since its only gate 10 change was this
  line.
- **For the landing:** land bc80be7 and 9cc94f9 (R/tools only) into APP before commit 23's
  landing L1. From then on the gates are green before and after commit 23.

### RV-G-2 (minor): reasons reworded in 5d2ac00; the totals are for the orchestrator

- **The two reasons now say what timing they keep** (comment changes only). Both are two-line
  block `eslint-disable-next-line` directives, since ESLint 9.39 rejects multi-line comments only
  for `eslint-disable-line`. That keeps every directive line in src within 100 columns.
  - use-ordering.ts:12: `-- the Reorder closes a commit after its group goes, and for that commit
    the contents stay locked (lockedBy)`. lockedBy (notes/utils/reader.ts:170) reads `ordering`.
  - use-journal-layout.ts:42: `-- the drawer closes in the commit after the one in which
    `narrow` turns false (the modal grown wide)`.
- **eslint holds them:** with `reportUnusedDisableDirectives: 'error'`, each still covers its
  finding. metrics-after.md counts both as line-level with a reason.
- **The totals are unchanged:** 13 react-hooks disables against §1.7.3's ≤ 7, and 34 in all
  against Q2's "about 30". The review agrees each one keeps a commit the UI goes through today.
  The acceptance is the orchestrator's (an amendment). metrics-after.md §0.4 now says so
  (3acf5f6), and the PR should state both totals (`later`).

### RV-G-3 (minor): fixed in 5d2ac00

- game-table.companions.integration.test.tsx's disable/enable range is gone. One
  `// eslint-disable-next-line unicorn/no-this-outside-of-class -- the element focused` now sits
  above the `if (!this.closest('[hidden]')) …` line. The `this:` parameter is a type annotation,
  which the rule does not report, so lint is clean with no unused directive.
- **The tree now has 1 range directive:** creature-switcher.test.tsx's, kept under G-10 (`this` is
  read on 9 lines in 6 mocks). §0.4's row and metrics-after.md §7 say 1 range.

### RV-G-4 (minor): agreed; the orchestrator adopts or rewrites the gate commits

- bc80be7 (gate 10 and 11 allowances) and 9cc94f9 (gate 10 both sides) are chore(refactor)
  commits that touch only R/tools. They can be adopted, rewritten or dropped without touching
  commits 23 and 24.
- The gate 10 part is G's by amendment 2 (b). The gate 11 part (gate11.allow, and the notes
  branch in gate-11.mjs) is the orchestrator's by amendment 3 (a) and G-9. G wrote it so commit
  23's L1 could be read, and it is flagged here and in `later`.

### RV-G-5 (minor): (b) fixed; (a) is the orchestrator's

- **(a)** owners.tsv:669 (src/utils/test-utils-node.ts) needs phase 4 and R1.9.28(G), like rows
  670 and 682. owners.tsv is the orchestrator's file, so this is in `later`, with the other rows.
- **(b)** This report is committed as R/reports/G.md on local/043-G. X/reports/G.md is a copy.

### Later (the orchestrator's, from this round and the first)

- Land bc80be7 and 9cc94f9 (R/tools) into APP before commit 23's landing L1, after reviewing
  them. Adopt or rewrite gate11.allow and gate-11.mjs's notes branch as the orchestrator's own
  (RV-G-4).
- An amendment that accepts 13 react-hooks disables (≤ 7) and 34 in all (about 30), or rejects
  them. The PR states both totals and lists the 34 (metrics-after.md §7) (RV-G-2).
- owners.tsv:
  - row 669 (src/utils/test-utils-node.ts): phase 4 and R1.9.28(G) (RV-G-5 (a))
  - new rows: src/types/auth.ts (G-8), .refactor/tools/gate10.allow, gate11.allow,
    .refactor/tools/g/*
  - the conditional rows: last-heard.tsx made, src/utils/throttle.ts not made (G-13)
- The PR's history note (amendment 4 (d)): fd2c34d is green on gate 10 under today's tools.
- Commit 26: EFFECT_DICE_KINDS goes with C9 (G-19), then G-25.
- e2e pass 4 after the landing.

### Checks (fix round)

- **L0** (5d2ac00's three files, `--findRelatedTests`): 42 suites, 1,467 tests, all green.
  `eslint` on the three files: clean.
- **L1 at 5d2ac00's tree** (X/l1/G/fix-c23, 04:54:16 → 04:57:56 UTC, APP's tools):
  - jest 318 suites, 9,727 tests, 0 red, 0 flaky
  - typegen ok, tsc 0 errors
  - eslint 1,161 files, 0 errors, 0 warnings
  - gates 1, 1b, 2-9 and 12 ok (gate 2: 8,607 base tests; gate 12: 0 cycle groups)
  - Gates 10 and 11 FAIL under APP's tools on the two allowed lines only (the kit's directive;
    last-heard.tsx). Both are ok with the branch's tools (X/l1/G/fix-c23-wt-gates.out).
- **Metrics after** (R1.9.30): `run.sh after 5d2ac00` in the worktree, under the wait lock (3acf5f6).
  Only the range count changed (2 → 1), plus the companions test's line count.
- **`next build`** at 3acf5f6 (src = 5d2ac00), under `flock X/l1-wait.lock flock X/checks.lock`,
  05:02:18 → 05:02:33 UTC: exit 0.
  - Its route table equals G's first build's (X/G/build.log), timings aside.
  - It printed the same environment-only messages, in the same counts: Better Auth's "Base URL is
    not set" ×6, its default-secret message ×6, and Prisma's DB_URL P1012 ×6.
- **e2e:** not run (pass 4 is the orchestrator's).

### Bugs logged

None in this round. bugs-found.md is unchanged.

---

## The first round (commits 23 and 24), as reported, with the fix round's changes marked

Builder G, 2026-11-04 (about 03:55-04:35 UTC). Worktree /home/user/w043/G/sending-stone-player,
branch `local/043-G`, made from `claude/dazzling-dirac-m8cq54` at e5ecdc2. Nothing pushed.

## Commits (on local/043-G, in order)

| SHA | subject | what |
|---|---|---|
| bc80be7 | chore(refactor): gate 10 and 11 allowances for commit 23 (G) | R/tools only: gate-10.mjs reads gate10.allow, gate-11.mjs reads gate11.allow, and the two allowlists |
| 6fee233 | chore(lint): CLAUDE.md's rules as errors, layered imports, an import-cycle test; dead code and unused exports gone | **commit 23**, 186 files |
| fe2087e | docs(roadmap): v0.43 done; bugs and checks for v0.44 | **commit 24**: ROADMAP.md, R/analysis/metrics-after.md, ratchet-after.json |
| 9986f99 | chore(refactor): G's codemod, export sweep and zone probes (R/tools/g/) | R/tools/g: the three scripts commit 23 ran, and their outputs |
| 9cc94f9, 5d2ac00, 3acf5f6 and the report commit | fix round 1 | see above |

**The landing needs bc80be7 and 9cc94f9 in APP's R/tools first** (fix round: 9cc94f9 makes the
gate 10 allowance work both ways, so APP's head and commits 2-22 stay green with it). Gates 10 and 11 run from APP's R/tools. With
APP's tools as they are now, the L1 at commit 23 shows exactly two FAILs:
- gate 10: `src/utils/test-utils-node.ts: changed since 4e7b8ec`. This is the one directive line
  that amendment 2 (b) removes.
- gate 11: `last-heard.tsx: a new component module in the server graph`. This is G-9's split.

With bc80be7's allowances (the worktree's gates.sh over the same L1 outdir), both are ok. So the
lander must do one of these before the landing L1:
- copy bc80be7's four files into APP (or fast-forward APP to bc80be7 first); or
- run the landing L1's gates 10 and 11 with the branch's R/tools.

## What commit 23 does

### R1.9.28: eslint.config.mjs (§1.7.2-§1.7.4)

- **Rules at `error`:**
  - every rule that was `warn`: tsxRules, TS_TYPE_EXPORT, react-hooks recommended (the React
    Compiler diagnostics included), `import/no-cycle`, `sonarjs/cognitive-complexity` 15
  - `@typescript-eslint/ban-ts-comment` with `'ts-expect-error': 'allow-with-description'`
  - `unicorn/no-useless-undefined: ['error', { checkArguments: false, checkArrowFunctionBody: false }]`
    and `camelcase` with `allow` of the six names, each with its reason
  - `linterOptions.reportUnusedDisableDirectives: 'error'`, so no directive outlives its finding
- **Test overrides (§0.6.6):**
  - TSX_TYPE is off for `**/*.test.tsx`: a block that rebuilds tsxRules without that selector.
  - `react-hooks/rules-of-hooks` is off for five suites: use-picker.test.tsx,
    utils/requests/checks.test.ts and check-damage.test.ts (G-14: R1.4.6's split moved the
    findings there), utils/sheet-actions.test.ts and utils/uses.test.ts.
  - `refs` and `globals` are off for three suites: chapter-form.test.tsx, note-editor.test.tsx and
    hooks/use-image-fallback.test.tsx.
  - Each rule is off only where a suite holds it. This is narrower than §0.6.6's three rules for
    all seven suites.
- **The layered zones (§1.7.4)** replace the 7 old zones. Each zone is written as in §1.7.4. Two
  file-scoped exceptions, each with its reason:
  - header-account.tsx and its test site-header.test.tsx may import src/lib/session.ts. The test
    mocks the session the Server Component reads.
  - utils/note-headings.test.ts may import src/lib/note-markdown.ts. It checks the scanner against
    the server's own showdown options.

  Proof that each zone fires: R/tools/g/zone-probes.mjs uses eslint's `lintText` with probe paths
  in each zone, so no file is written. 35 probes, 0 wrong (R/tools/g/zone-probes.txt). They ran
  under the shared checks lock.
- **Amendment 2 (b):** the node kit's directive (src/utils/test-utils-node.ts:83) and the config
  block that kept `unicorn/no-null` on for that file are removed together. The gate 10 allowance
  for that one line is in bc80be7.
- **Unused directives removed: 98 (three of them whole-file camelcase ones).**
  - unicorn/no-useless-undefined: 86. They were all `mockResolvedValue(undefined)`-style arguments,
    and the constants files' ones.
  - camelcase: 10, including layout.tsx's and manifest.ts's whole-file directives and
    manifest.test.ts's.
  - import/no-restricted-paths: use-popover.ts's two (G-15). Zone 5 lets src/hooks import the
    modal's `use-*` hooks.
  - They were removed line by line by a script, not by `eslint --fix`. ESLint's own directive fix,
    combined with prettier, left stray blank lines inside arrays and dropped blank lines before
    comments, so that run was discarded.
- **src/__tests__/import-cycles.test.ts** (`@jest-environment node`, about 120 lines):
  - It builds src's import graph with the TypeScript compiler API: imports, re-exports, `import()`
    and `import('…')` types, resolved with tsconfig's paths, type-only edges included.
  - It runs Tarjan's algorithm and expects `[]`.
  - Mutation check: a temporary type-only import from src/types/auth.ts back to auth-providers.ts
    made it fail, naming both files. The change was reverted.
- **Result:** `npx eslint .` prints nothing. 1,161 files, 0 errors, 0 warnings.

### Amendment 4 (c): `@/` paths

R/tools/g/at-imports.mjs rewrites a relative import or re-export to an `@/` path when it leaves
its feature (`src/features/<f>`) or its top folder of src.
- It touches import lines only, not jest.mock paths, and skips the frozen goldens and kit.
- It made 77 specifier changes in 48 files (R/tools/g/at-imports.tsv).
- Afterwards, `eslint --fix` ran on the flagged files only, for import/order and prettier. Imports
  in the `@/` group sort after relative ones.

### R1.9.26: phase4-items.md's G rows

- G-1: useToastSetting and useToastTop now live in FR/hooks/use-toast-setting.ts and
  use-toast-top.ts, with no directive (§1.0 rule 9). The three importers are retargeted.
- G-2: gmRollsOf is in FR/utils/gm-rolls.ts.
  - NO_GM_ROLLS went to FR/constants.ts, because both files read it (§1.0 rule 8).
  - The import lines of the three tests are retargeted.
- G-3: useFavorites is in favoriting/use-favorites.ts. The frozen kit's import line follows; gate 10
  allows that.
- G-4: SpellSlotPool is in FS/utils/types.ts. Its six importers use `@/features/sheet/utils/types`,
  or `./types` beside it.
- G-5: RollBrief, Creature, RollToast and ToastBook are in FR/types.ts. `ToastDraft` (four
  `ReturnType<typeof draftOf>`) and `WayWords` are named there.
- G-6: TOAST_FOR is in src/features/campaigns/constants.ts, done now. The values golden's import
  line follows (gate 10 ok). Commit 26 does not need it.
- G-7: ChoiceProblem is in src/db/types.ts. actions.ts's import line is retargeted.
- G-8: SocialProviderId takes the "home" option.
  - It is a literal union `'google' | 'discord'` in a new src/types/auth.ts.
  - The providers' object is checked against it: `satisfies Required<Pick<SocialProviders,
    SocialProviderId>>`. A missing provider, an extra one, or a wrong config fails tsc.
  - This adds no directive and no cycle.
  - The new file needs an owners.tsv row (`later`).
- G-9: LastHeard is split into last-heard.tsx. The gate 11 allowance is in bc80be7.
- G-10: kept as is: creature-switcher.test.tsx's range plus one next-line directive (`this` is
  read on 9 lines in 6 mocks). (Fix round: the companions test's range is a next-line directive
  since 5d2ac00, RV-G-3.)
- G-11: the react-hooks findings left:
  - use-draft-focus's exhaustive-deps is fixed. The mount-only effect reads `draft`, `setDraft`,
    `form` and `fields` from its mount ref (`useRef({ … })`), which are the values its closure had.
  - The other six V2 base findings keep a line disable with a reason, because each one is render
    timing (see Deviations).
- G-12: decided not to do it. useFollow stays as it is.
  - use-table-rolls' two sites (startEach's multi-step run and readWildShapeForms' GET) keep their
    own controllers.
  - Moving them would change useFollow's API, which five lanes adopted, for two sites in one file.
    §1.10 leaves out two-copy merges.
- G-13: decided not to do it. `due` stays in src/db/commands.ts.
  - Its importers are all in src/db, so src/db is their lowest common ancestor.
  - src/utils/throttle.ts would hoist it further than needed (CLAUDE.md §4). The conditional row is
    not made.
- G-14: done in the config above.
- G-15: done. The directives became unused and were removed.
- G-16: entry-icon's directive now carries `-- the game's image, not Next's`. The longer
  explanation stays on the comment line above, so the line fits in 100 columns.
- G-17: `COOKBOOK_MOST_DELAY = 120_000` is in constants/cookbook.ts and is read by
  use-cookbook-view.ts. Both cookbook mocks spread `requireActual`.
- G-18: `describe('HIT_DIE')` and its import moved unchanged into src/constants/sending-stone.test.ts.
- G-19: left for commit 26. Only C9 reads EFFECT_DICE_KINDS, so it goes with C9 (`later`).
- G-20: the sweep ran (R1.9.27 below).
- G-21 and G-22: done. G-21 is in ROADMAP. G-22: 0 cycle groups, held by the new test.
- G-23 to G-30 (optional) are not done:
  - G-23: Part and FormulaGroup are file-private. lint does not flag them.
  - G-24: emptying roll-requests.ts would also move moves.d rows, which are the orchestrator's.
  - G-25: it waits for commit 26.
  - G-26: it is no longer needed for zero cycles, and it would touch about 20 import lines in five
    areas.
  - G-27: it is new adoption across S pages.
  - G-28: it is a two-copy merge (§1.10).
  - G-29 and G-30: they are design changes the lane builders declined.
- FA-R1: done. usePopover's `onOpenChange` is
  `NonNullable<UseFloatingOptions['onOpenChange']>`, and RollsButton's handler infers its
  parameters again (`(next, _, reason) => …`, with the OpenChangeReason import gone). This is
  type-only.
- FA-R2: it is in ROADMAP's questions (commit 24).

### R1.9.27: dead code and unused exports

- jest.setup.ts: mockFetch and mockManyFetch are gone. Nothing imported them. `globalThis.fetch =
  jest.fn()` and `prismaMock` stay.
- R/tools/g/unused-exports.mjs lists exports with no importer outside their module.
  - It counts imports, re-exports, `import()`, `typeof import()`, the names a jest.mock factory
    defines, and `requireActual` and `requireMock` reads.
  - It skips Next.js special files, the two 'use server' modules, the frozen files and tests.
  - It found 47 rows (R/tools/g/unused-exports.tsv).
- 44 exports used only in their own module lose `export`: 36 types in src/types and FS, and 8
  functions.
- 3 declarations used nowhere are deleted: useWildShaping (wild-shape/context.ts),
  EndConcentrationSource (types/roll.ts) and TransferFeature (types/sending-stone.ts), with the
  imports only they used.
- A second run of the sweep found nothing.

## Checks

- **L0:** the import-cycle test alone, green; and red under the mutation, as expected.
  `tsc --noEmit` was run alone under the locks before the L1: 0 errors.
- **L1 for commit 23** (X/l1/G/c23-try1, 04:17:20 → 04:20:43 UTC, APP's tools, the tree that
  became 6fee233):
  - jest 318 suites, 9,727 tests, 0 red, 0 flaky
  - typegen ok
  - tsc 0 errors
  - eslint 1,161 files, 0 errors, 0 warnings
  - gates 1, 1b, 2-9 and 12 ok: all 8,607 base tests (gate 2), 0 warnings against
    ratchet-moved.json (gate 9), 0 cycle groups (gate 12)
  - gates 10 and 11 FAIL on exactly the two allowed lines; both ok with bc80be7's tools
- **L1 for commit 24** (X/l1/G/c24, 04:26:26 → 04:29:51 UTC): the same results. Gates 10 and 11 are
  ok with the branch's tools (X/l1/G/c24-wt-gates.out).
- **`next build`:** in the worktree at fe2087e's tree, under `flock X/l1-wait.lock flock
  X/checks.lock`, 04:29:52 → 04:30:38 UTC, exit 0.
  - Its route table equals checkpoint 4.1's; only the timing lines differ.
  - It printed the same environment-only messages as before, 6 of each: Better Auth's "Base URL is
    not set", its default-secret message, and Prisma's "Environment variable not found: DB_URL".
- **Metrics after (R1.9.30):** `run.sh after 6fee233` in the worktree, under the wait lock (run.sh
  takes the checks lock).
  - This writes R/analysis/metrics-after.md and ratchet-after.json.
  - §0.4's table, filled for the PR, is appended to metrics-after.md.
  - The metrics are from commit 23 because run.sh needs the tree outside .refactor/ to equal the
    commit. Commit 24's only change outside it is ROADMAP.md.
- **e2e:** not run. Builders run none; pass 4 is the orchestrator's.

## Deviations from round.md, and why

1. **The disables: 13 react-hooks against §1.7.3's ≤ 7, and 34 in all against Q2's "about 30".**
   - There are 21 of today's kinds, under §1.7.2's ≤ 23. The other 13 are react-hooks: Phase 3's 7,
     plus 6 that G decided under §1.7.3 ("A lane that needs more says so … G decides; the PR then
     says the total").
   - The 6 are V2's base findings in the notes hooks. Each is the journal's current render timing:
     - journal-modal's `shown` is set a commit after the dialog opens, so its transition runs
     - use-focus-to clears its request after the commit that drew the target
     - use-journal-layout closes the drawer a commit after the modal grows wide
     - use-keyboard-inset clears its style after the commit that closes the dialog
     - use-ordering closes a Reorder a commit after its group goes. For that commit the contents
       are still locked (`lockedBy` reads `ordering`).
     - use-reader-pick reads the order the last commit drew. Its 2 refs findings are on one line,
       so one directive covers them.
   - Fixing any of them means setting state during render, or deriving it, which removes a commit
     the UI goes through today. Under §1.8 G did not make that change.
   - Each directive is line-level and has a reason. The full list is in metrics-after.md §7, for
     the PR. (Fix round: use-ordering's and use-journal-layout's reasons now say what timing they
     keep, 5d2ac00, RV-G-2. The acceptance is the orchestrator's.)
2. **Fact 31's three hook rules are off per rule, not all three for every suite.** This is narrower
   than §0.6.6.
3. **Two zone exceptions beyond §1.7.4's one** (site-header.test.tsx and note-headings.test.ts).
   Both are tests reading a server module, and both are named by file with their reasons.
4. **G-8 creates src/types/auth.ts**, against amendment 1 (a)'s "no src/types/auth.ts", which was a
   2b decision to avoid a cycle. A literal union imports nothing, so no cycle forms. This is G-8's
   "home" option.
5. **The ROADMAP text is §4.5's, with three changes:**
   - It is re-wrapped to the file's 100 columns (§4.5 as written runs to 104).
   - A blank line puts "Questions from it" in its own paragraph.
   - Three lines are added: the bug log's later tooling notes (the note-lines clock race,
     amendment 4 (e); the `@test-utils` alias; unicorn's type-guard autofix) as one "Tooling"
     bullet, and FA-R2's favorites question among the questions.

   The paths §4.5 names were re-checked at this head and are all current:
   - `bind` from `findEventCampaign`, src/db/campaigns.ts:495 and :357
   - `sendDamage`, use-table-rolls.ts:233
   - `gmLine`, gm-words.ts:80
   - `follow`, utils/lifecycle.ts:35
   - `leadFor`, use-picker/utils.ts:409
   - jest.config.ts's `'index.ts'` pattern, which still drops
     campaign-index/campaign-index.tsx
   - the five `console.error` sites

   Each of B1-B19 was re-read at its current place:
   - B2: sheet-tabs.tsx:80
   - B5: db/roll-requests.ts:819 and :842, db/cookbook.ts:208
   - B6: table/utils/combat.ts `hpBar`
   - B8: portrait.tsx:45, utils/initials.ts:7, avatar.tsx:35
   - B15: wild-shape-ended.tsx:59
   - B17: lib/app-origin.ts:9

   All still hold, since no product bug was fixed. B20 stays out (§4.4).

   The bug log's notes about .refactor/ tooling are not ROADMAP material: the gate 9 and 10 notes,
   the TSV escapes, export-move's `base` field and types-probe. Those files go in commit 28, and
   most of the notes are settled. COMPANION_UNTAKEN's order note is G-25's (after commit 26).
6. **Metrics after are taken on commit 23, not 24** (see Checks). (Fix round: re-taken at 5d2ac00,
   commit 23 with the comment-only fix, in 3acf5f6.)
7. **One extra chore(refactor) commit after commit 24 (9986f99)** holds G's scripts for the review.

## Bugs logged

None. bugs-found.md is unchanged, and no product bug was found or fixed.

A tooling note for the report only: ESLint's own fix for unused disable directives, run with
prettier/prettier, leaves an empty line where a directive sat inside an array, and drops the blank
line before a directive that follows one. G removed the directives itself.

## What later workstreams must know

- The landing: bc80be7 and 9cc94f9 must be in APP's R/tools before commit 23's landing L1 (above).
- owners.tsv (orchestrator):
  - Add rows for src/types/auth.ts (G-8, new), .refactor/tools/gate10.allow, gate11.allow and
    .refactor/tools/g/*.
  - Row 669 (src/utils/test-utils-node.ts): phase 4 and R1.9.28(G), as rows 670 and 682 have
    (fix round, RV-G-5 (a)).
  - The conditional rows src/utils/throttle.ts (G-13) and phase4's last-heard.tsx: last-heard.tsx
    was made, and throttle.ts was not.
  - NO_GM_ROLLS is new in src/features/rolling/constants.ts.
- Commit 26 (final): EFFECT_DICE_KINDS is read only by C9 (G-19), so it can go with C9. TOAST_FOR
  is already moved (G-6). G-25 can follow.
- The PR (§7):
  - List the 34 directives (metrics-after.md §7) and say the totals: 13 react-hooks against ≤ 7,
    and 34 against about 30.
  - Note G-12's and G-13's decisions.
- Phase 5 (RV3 reads 23-24):
  - R/tools/g/ has the scripts and their outputs.
  - The riskiest diffs:
    - the import reorders that import/order made after the `@/` codemod (48 files; jest and the
      build are green)
    - use-draft-focus's mount ref
    - auth-providers' `satisfies` check
- e2e pass 4: the orchestrator runs it after the landing.
