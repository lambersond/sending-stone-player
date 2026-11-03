# Safety critique of the v0.43 draft (round.md a527cfc, owners.tsv)

Critic: safety. Question asked: can this plan change behaviour without anyone noticing, or break the
build? Every finding below was checked in the code at HEAD c94fe3f. round.md and owners.tsv are
unchanged since a527cfc, and src is the same as at 24f808b: `git diff --stat 24f808b HEAD -- src
jest.config.ts jest.setup.ts tsconfig.json` is empty.
Scripts I wrote for the counts are in X/critic-safety/: expects.cjs, own.py, servergraph.py.

Summary: 6 major, 8 minor. The majors fall into two kinds:

- Holes in the safety net that let a change pass unnoticed: F1, F5, F6.
- Logistics that make the gates unusable or misleading as written: F2, F3, F4.

None of them argues against the plan's shape. Each one has a cheap fix.

## Findings

### SA F1 (major): gate 1 checks the text of `expect` statements, but most expected values live elsewhere

**What the plan says.** §3.1.1-2 freeze the assertions, and a test file may change only in setup.
Gate 1 (round.md:1331-1334) enforces this by comparing, per test, the list of `expect(...)`
statements, with whitespace collapsed. Gate 2 compares `fullName` and `numPassingAsserts`.
Neither gate looks at the data an `expect` compares against.

**Evidence.**

- **`.each` tables.** There are 638 `it/test/describe.each` uses in 151 test files.
  - In src/utils/roll-modifiers.test.ts:41-55 the table row `['1d7', "There's no d7. Use d4, d6,
    d8, d10, d12, d20 or d100."]` (:46) feeds `expect(!result.ok && result.error).toContain(error)`
    (:55).
  - The test's fullName is `utils/roll-modifiers parseExtraTerms refuses "1d7"` (X/jest-base.tsv),
    so the title carries only the input.
  - Editing the expected message changes neither the `expect` text nor the fullName. Both gates
    stay green.
  - R1.2.13 splits exactly this parser.
- **Helper functions.** 55 `expect` calls in 20 files sit outside any `it`/`test` callback. Gate 1
  lists expects per test, so these are not in any list. Examples:
  - `expectRefusal`, the module's view of a refusal: bridge/commands/route.test.ts:63-74 and
    events/route.test.ts:131-141. Together with expects in hooks, this accounts for all 16,468.
  - Module-level expected bodies: `UNAVAILABLE` (commands/route.test.ts:76-79) and `NOT_SET_UP`
    (events/route.test.ts:143), which S's R1.3.6/R1.3.10 work touches.
- **Product constants.** 15 test files compute their expectations from product constants:
  - POLL_INTERVAL is read 113 times and CHECK_EVERY 95 times. Others include TOAST_FOR,
    BUSY_WAIT and FAVORITE_SETTLE; for example favoriting.test.tsx:159 calls
    `advanceTimersByTime(FAVORITE_SETTLE - 1)`.
  - If a constant's value drifts while it moves (2b moves CHECK_EVERY, FOLLOW_FOR, LATE_FOLLOW,
    BUSY_* into src/constants/lifecycle.ts; R1.9.3 merges three MAX_DELAYs into POLL_MOST_DELAY;
    R1.5.2 renames SETTLE_FOR/OVER_FOR), the tests follow the drift.
  - Goldens C1-C8 pin no constant values.
- **Fixtures.** W-b's mock base (R1.4.10) rewrites the fixtures in src/mocks that 140 suites read.
  Where a test's expected value comes from the same fixture as its input, both change together.
  "Fixture outputs byte-identical" has no check of its own.

**Fix.**

1. **Gate 1b, whole test file.** For each base test file (renames and moves.tsv followed), parse
   the base and head versions and drop these from both:
   - import declarations;
   - the module strings and factory keys of `jest.mock`/`requireActual`/`requireMock`/`doMock`;
   - `guardNoDb()` statements;
   - the R3.3 helper declarations named in moves.tsv;
   - comments, and type-only declarations.

   Then print both with the TS printer and require them to be equal. A test file split by describe
   block is compared per describe block. This makes §3.1.2 a check rather than a rule.
2. **A values golden (commit 2, T).** One JSON snapshot of every exported primitive, array, Set and
   plain-object constant in src/constants plus the timing constants that 2b moves, keyed by name and
   followed through moves.
3. **A fixtures snapshot.** `JSON.stringify` of every src/mocks export (factories called with no
   arguments), taken at commit 8 and again after R1.4.10, must be byte-equal.

### SA F2 (major): R1.4.9 (and R1.4.8's derived types) move names other lanes import, inside Phase 3

**What the plan says.** §2.2.2 (round.md:1044-1046) says no lane moves a name another lane imports
in Phase 3: those all moved in 2b. Yet R1.4.9 (round.md:640-643, W-a, commit 12) breaks "the
type-only cycles among types/{party,roll,sending-stone,table} by moving the shared types to the
module both sides import".

**Evidence.** The cycle edges (metrics-base.md §5 group 1; src/types/party.ts:1-6, table.ts:1-3,
roll.ts:1-19, sending-stone.ts:6-9) run through types that every lane imports. Lanes are from
owners.tsv:

| type | imported outside src/types by |
|---|---|
| TableMoves | U1, U2, V2, S, W-b |
| TableGroup | V1, V2, U1, S |
| GmRollView | U1, R-a, R-b, W-b |
| GroupEntry / GroupSheet | S, W-b |
| EndedTurn | V1, W-b |
| TableRoll | V1, S |

Whichever side moves, files in other lanes need new import lines. That is a cross-lane edit
(§2.2.1). The only way to stay inside W-a's lane is to leave a re-export behind (for example
`export type { TableMoves } from './party'` in table.ts). Gate 7 (round.md:1351-1352) does not see
that, because it flags only re-export-only modules and the shim comment.

R1.4.8 has the same problem. NoteChange, NoteResolve, NoteOrder and NoteOrderResolve live in
src/types/notes.ts:166-187.

- If they become `z.output<…>` there, src/types imports src/schemas. That breaks zone 2 (§1.7.4:
  src/types only from types/constants) when it becomes an error in commit 23.
- If they move to src/schemas, the importers move with them: V2's notes feature and S's
  db/notes.ts and lib/notes-routes.

**Fix.**

- Make R1.4.9's type moves part of R1.9.1. The 2b codemod already rewrites every importer. Choose
  the destinations now: put each crossing type in the module whose other imports it already
  shares, so no new edge appears.
- Make R1.4.8 a compile-time equality check that moves nothing. Keep the hand types and add, in
  schemas/notes.ts or its test, a `type _ = Assert<Equal<NoteChange, z.output<typeof …>>>` line
  per pair.
- Extend gate 7 to flag any `export … from` re-export of a name that moved after 24f808b, in any
  module.

### SA F3 (major): gate inputs are shared files that can't be right for 9 parallel worktrees or for the replay

**What the plan says.**

- Gate 3 (round.md:1337-1338) requires suites and tests to equal base + added − retired, "per
  R/tools/counts.conf (one line per commit that adds tests)".
- Gates 1-2 follow paths through R/tools/moves.tsv (round.md:1328-1330).
- R is APP's folder (brief.md:8), so every lane's L1 reads the same files.
- Both files belong to M in Phase 1 (owners.tsv row `.refactor/tools/{…}`), so no lane owns a line
  in them.

**Evidence.**

- **Phase 3 adds tests in five lanes.** §3.1.3 lists use-settle (U1), save-title (U2), seen-query
  (V2), schemas/utils and dice (W-a), and hello-features (S).
- **Two lanes split test files**, which changes suite counts: W-b splits roll-requests.test by
  describe block (R1.4.6) and S splits bridge-http.test (R1.3.13).
- **Counts break in other lanes.** Once W-b's line is in counts.conf, U1's gate 3 fails in U1's
  worktree, which lacks W-b's suites. Lane SHAs also change at the integration rebase, so a line
  "per commit" cannot be keyed by SHA.
- **Splits break path-following in other lanes.** A moves.tsv entry for W-b's split points other
  lanes' gate 1/2 at files that don't exist in their trees.
- **The replay goes red by construction.** In the L3 replay (round.md:1160), gate 10's
  `git diff --quiet <commit 4> -- snapshots` (round.md:1357-1359) fails for commits 2-3, where no
  snapshot exists yet.
- **The claim can turn false.** "A red commit is fixed forward in commit 25", while the §2.5
  heading (round.md:1117) and the PR claim "each green alone".
- **What a gate like this invites.** A gate that fails for reasons outside the lane gets edited to
  match what is observed, which makes it vacuous.

**Fix.**

- **Gate 3.** Derive it from the checkout:
  - head suites ≥ base suites − retired;
  - every head test not in base sits in a file absent at base, or in a split target in moves.tsv;
  - counts.conf keeps only C1's retirement.
- **moves.tsv.** Key each entry by its source file and apply it only when the target exists. Give
  each lane its own append-only file, R/tools/moves.d/<lane>.tsv, that it owns.
- **Make the gates commit-aware for the replay:**
  - gate 10 from commit 4 on;
  - ratchet-moved from commit 5 on;
  - gate 8 from commit 2 on.
- **Honest reporting.** The PR names every commit that was red alone in the replay. It never
  claims "each green alone" for those commits.

### SA F4 (major): in Phases 1 and 4 several builders share APP's working tree, so L1 doesn't test the commit

**What the plan says.** brief.md:15 says "before Phase 3 everyone works in APP". §8 runs T, C-a,
C-b and M at the same time in Phase 1, and F-a and F-b in parallel in Phase 4. Neither phase is
given worktrees. L1 (`l1.sh <outdir> [checkout]`, default APP) runs the full suite over the working
tree.

**Evidence.**

- **T's commit 2.** T's gate 3/10 run sees C-a's and C-b's half-written golden suites, which are
  new files in the same tree: red for reasons that aren't T's, or green because of files that
  aren't in the commit. Pathspec commits keep the content right, but the gate result that
  justified the commit was taken on a different tree.
- **Snapshots written by the wrong builder.** L0 (brief.md:27) runs without `--ci`. Jest's `ci`
  defaults to `isCI` (node_modules/jest-config/build/Defaults.js:60), and here `CI` is unset and
  `ci-info` reports false. So any L0 by T or M whose `--findRelatedTests` reaches a golden **writes
  that golden's missing snapshots** from the other builder's code in progress.
- **Why that matters.** §3.1.6 counts on the goldens being written once, on purpose, by their
  author.

**Fix.**

- Give each Phase 1 and Phase 4 builder its own worktree from APP's HEAD, as in Phase 3. The
  orchestrator fast-forwards APP and pushes.
- At minimum, have l1.sh always run in `git worktree add --detach X/l1/<n> <the commit>` (the
  replay's mechanism), on the commit about to be pushed.
- Add `--ci` to L0's command in brief.md. C-a and C-b write their snapshots with an explicit
  `--ci=false` run over their own files only.

### SA F5 (major): the "frozen" kit and goldens are not gated; one piece is owned by a lane in Phase 3

**What the plan says.** §2.2.6 (round.md:1057-1058) freezes the kit and the goldens after commits
2-4.

**Evidence.**

- **Gate 10** (round.md:1357-1359) checks only `src/__tests__/**/__snapshots__/**`.
- **Gates 1-2** take their base from 24f808b (base.sh), where neither the golden test files nor
  the kit exist. So no gate covers edits to:
  - `src/__tests__/golden/*.golden.test.ts(x)`;
  - `src/utils/test-utils.ts` (normalizeIds, normalizeTimes, markup, sent);
  - `src/utils/test-utils-node.ts` (prismaFake, routeCall).
- **How a lane could hide a change.** A lane whose change makes a golden fail could teach a
  normalizer to drop the new attribute, or filter a header in routeCall. The stored snapshot would
  then match again, and every gate would be green.
- **SheetProviders, the goldens' provider harness.** owners.tsv gives
  `src/mocks/sheet-providers.tsx` to U1 in Phase 3 ("created by T in commit 2, U1 owns it in Phase
  3"), and §2.1's U1 row repeats it.
  - Its options type sits in W-b's `src/mocks/types.ts` (owners.tsv row R3.5/R1.4.9/R1.4.10).
  - If U1 recomposes SheetProviders along with the pane (R1.1.4), the goldens' setup moves with
    the code they are meant to characterize.
  - Any change to the options type is a cross-lane edit.
- **A smaller ownership slip.** owners.tsv attaches R1.2.12 to 11 R-a rows, while §2.4 gives R1.2.12
  to R-b.

**Fix.**

- Gate 10 adds `git diff --quiet <commit 4> -- src/__tests__/golden src/utils/test-utils.ts
  src/utils/test-utils-node.ts src/utils/test-utils.test.ts src/mocks/dice-renderer.ts
  src/mocks/sheet-providers.tsx`. Allowed exceptions: C1's removal in commit 26, and import-line
  changes, checked as in F1's gate 1b.
- Make sheet-providers.tsx T(frozen) except for import lines, and move its options type beside it
  in a file of its own.
- Fix the R1.2.12 rows.

### SA F6 (major): the goldens' time zone pin does nothing, and C2-C8 stay in the repo for the user's Eastern machine

**What the plan says.** R3.6 (round.md:1230) puts `process.env.TZ = 'UTC'` at the top of each
golden file ("Node re-reads it"). Risk 17 (round.md:1505) relies on it.

**Evidence that the pin does nothing.**

- Inside a test file, `process.env` is Jest's own copy: node_modules/jest-util/build/index.js:170-219,
  `createProcessEnv` → `Object.assign(proxy, process.env)`, installed at :244.
- Assigning TZ there never reaches the worker's real environment, which is what makes Node reset
  its time zone. The goldens therefore take whatever zone the process started with.
- Here that zone is UTC (/etc/timezone `Etc/UTC`, `TZ` unset), so they pass on this machine
  without ever being pinned.

**Why it breaks the user's tests.**

- Q4 keeps C2-C8 in the repo. Only C1 is retired.
- C4 (round.md:1263-1269) takes `textContent` and accessible names of chat lines and toasts. Those
  include LocalTime's `toLocaleTimeString` (local-time.tsx:23-24), which reads "7:30 PM" for
  `atFixedTime('2026-10-04T19:30:00.000Z')` in UTC and "3:30 PM" in Eastern time.
- normalizeTimes acts on `<time>` elements in markup, not on `textContent`.
- C4 also covers `noteTime`, which uses local `getDate`/`getMonth` (src/utils/note-time.ts:41-48).
- Result: after the PR, the user's own `npm test` in Eastern time (request.md: "Times in Eastern")
  is red.

**Fix.**

- Pin TZ where the worker inherits it: `process.env.TZ = 'UTC'` in jest.config.ts or a
  `globalSetup` file. Both run in the parent process before workers fork, and they also cover
  in-band runs.
- This is a commit-2 line, with its reason beside it. Existing suites already pass in UTC here, so
  gate 2 is unaffected.
- Also run normalizeTimes over C4's `textContent`, and keep noteTime's golden away from date
  boundaries.

### SA F7 (minor): nothing checks the `'use client'` and `@jest-environment` directives, and the codemods move them

**Evidence.**

- **How TS copies directives.** TS 5.9.3's "Move to file" copies prologue directives only into a
  *new* target file (node_modules/typescript/lib/typescript.js:147313-147315,
  `!isFullSourceFile(targetFile)`). So:
  - 2b's new modules created from `'use client'` sources become `'use client'`, values included.
    Examples: src/constants/lifecycle.ts and src/utils/lifecycle.ts (from use-table-rolls.ts:1),
    src/hooks/use-turn-toast-foot.ts (turn-toast.tsx:1), F/cookbook/constants.ts
    (cookbook-entry.tsx:1), and FR/constants.ts and FR/types.ts when the first move into them comes
    from roll-button.tsx, roll-menu.tsx or use-table-rolls.ts (all `'use client'`).
  - Moves into an existing file never gain the directive.
- **Why that matters.** A Server Component that imports from a `'use client'` module "receives a
  client reference instead of the function"
  (node_modules/next/dist/docs/01-app/02-guides/server-and-client-boundary.md:267).
  - The zones let server code import src/constants and src/utils.
  - Jest ignores directives.
  - The e2e runs browser and server in one time zone and locale, so a component that moves across
    the boundary renders the same there.
- **Server-graph findings** (my walk from every page, layout, not-found and manifest, re-exports
  followed; X/critic-safety/servergraph.py):
  - Today no server module imports a value that moves out of a `'use client'` file, so there is no
    live instance.
  - 20 `'use client'` entry points are imported straight from Server Components:
    campaign-buttons, campaign-controls, campaign-index, campaigns-head, secret-form,
    character-chooser, remove-character-button, fullscreen-guard, game-table, local-time,
    invite-form, party-page, party-panel, party-sheet, sign-in-buttons, sign-out-button,
    campaigns-link, not-on-character-page, theme-provider and theme-toggle.
  - V2 splits several of these (R1.5.16, R1.5.18, R1.5.21). remove-character-button.tsx and
    theme-provider.tsx use no hooks, so a piece that loses its directive would compile as a Server
    Component without an error.
  - Only S, V1 and V2 end Phase 3 with `next build`.
- **Rule 6 versus the code.** Rule 6 (round.md:282-283) says src/lib is imported only by src/app.
  But src/components/site-header/header-account.tsx:5 imports `@/lib/session`, and that file stays.
  Zone 1 (round.md:851-852) doesn't list lib/session.
- **Jest docblocks.** All 63 node suites put `/** @jest-environment node */` at line 1. An import
  that a kit adoption (R3.3/R3.4) inserts above it silently switches the suite to jsdom.

**Fix.**

- A "directives" gate: every base file keeps its directive (paths followed); no `'use client'` in
  types.ts, constants.ts or utils .ts files; every module a server-graph module imports keeps its
  base side. The script is ~60 lines; servergraph.py is a start.
- export-move.cjs strips copied `'use client'` from non-component targets.
- Every lane ends with `next build`.
- Correct rule 6 for header-account.tsx and add `src/lib/session` to zone 1, with header-account
  as the one exception.
- Gate 1b (F1) also compares each file's leading docblock.

### SA F8 (minor): gate 4 would fail on R3.3's own lines, and it misses the B20 kind of mock

**Evidence: the closure clause.** Gate 4 (round.md:1339-1342) requires that the module a
`requireActual` names be "in the import closure of the test's own imports". R3.3's 18 new lines,
`jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER` (round.md:1213), name a module that
no test imports, so gate 4 fails commit 2 by design.

**Evidence: the reverse case is not checked.** A full-replacement factory (no `requireActual`
spread) that leaves out a name the code under test imports makes that name `undefined`. For a
function the result is loud. For a constant it is silent (NaN timers, B20).

- B20 itself: game-table.test.tsx:19 and game-table.party.test.tsx:20 mock use-table-view without
  POLL_INTERVAL.
- The four GameTable suites' use-notes mocks (game-table.test.tsx:23, .party:24, .endturn:27,
  .companions:33) define hasDraft, journalOpen and useNotes. They leave out `draftChanged`, which
  chapter-form.tsx:16 and note-editor.tsx:23, both in GameTable's import closure, import.
- R1.9.3 retargets turn-toast.test.tsx:11's `({ POLL_INTERVAL: 3000 })` to `@/constants/polling`.
  Commit 8 also gives that module POLL_MOST_DELAY.

**Fix.**

- Exempt `requireActual` targets from the closure clause.
- Add gate 4b: for a factory without a spread, any value name that a module in the test's closure
  imports from the mocked path must be a factory key. Base cases are allowlisted (B20's two;
  `draftChanged` ×4).
- Write the turn-toast retarget as `({ ...jest.requireActual('@/constants/polling'),
  POLL_INTERVAL: 3000 })`, a setup line.

### SA F9 (minor): §1.8.1's surface omits things the module and the e2e read

**What the plan says.** §1.8.1 (round.md:867-880) is the byte-identical list, and Phase 5 reviews
against it. map T §5 / analysis/T/e2e-surface.mjs collected CSS selectors only.

**Evidence: what is missing.**

- **Content-Type.** The module reads a refusal or answer only when `content-type` includes
  `application/json` (MOD scripts/transport.mjs:412 and :479). Without it the module silently drops
  `{resend, features}`, which matters for R1.3.5's `bare()`/textAnswer and R1.3.10's `eventAnswer`.
- **Attributes read through `getAttribute` or `dataset`:**
  - `data-leaving`: attacks-e2e.mjs:807, from roll-toasts.tsx:175;
  - `data-kind` (×14), `data-key`, `data-mode`: companions-e2e.mjs:264, :270, :358, from
    creature-switcher.tsx:242, :265-266;
  - `data-gm` and `data-accent`: gmroll-e2e.mjs:796 and toasts-e2e.mjs:509, from
    roll-toasts.tsx:172-173.
- **DOM structure and styles:**
  - child structure: damagecard-e2e.mjs:353, `[...left.children].find(child => child.tagName ===
    'SPAN' …)`;
  - computed colours: damagecard-e2e.mjs:415-425, :712;
  - class names: campaigns-e2e.mjs:130 `sr-only` and :413 `border-danger/40`.

C1 pins all of these until commit 26; after that only e2e pass 5 does.

**Fix.**

- Add these to §1.8.1.
- Have C5 snapshot every response header, Content-Type included. The plan already says "sorted
  headers"; say "all".
- Extend e2e-surface.mjs to `getAttribute`, `dataset`, `classList` and `children` reads, and paste
  its output into the PR body for reviewers.

### SA F10 (minor): snapshots sort object keys, so C5 and C7 don't pin the key order §5 says they do

**Evidence.**

- jest-snapshot 30.5.2 uses pretty-format 30.5.1. With no `compareKeys` set, that sorts keys:
  `compareKeys === null ? rawKeys : rawKeys.sort(compareKeys)`
  (node_modules/jest-snapshot/node_modules/pretty-format/build/index.js:33-35).
- So snapshotting C5's `fake.calls` args or C7's create/update `data` loses key order. §5 risk 1
  (round.md:1489) says C5 and C7 "compare strings".
- For stored rows this is harmless: Prisma `Json` columns map to `jsonb` on PostgreSQL
  (prisma/schema.prisma:6, :320, :438, :680), and jsonb doesn't keep key order.
- But it overstates what pins `commandPayload` (R1.3.2, "spread then delete: key order kept").

**Fix.**

- Add an `ordered(x)` helper (`JSON.stringify(x, null, 1)`) to the kit. Use it wherever order is
  claimed, C3 included (which already says JSON.stringify).
- Snapshot storage values as raw strings.
- Restate risk 1: request bodies and response text are pinned (C2, C5); row key order is not
  observable.

### SA F11 (minor): G's export sweep would strip exports Next.js reads; gate 6's input lacks pages and actions

**Evidence.**

- R1.9.27 (round.md:958) takes `export` off every export that has no importer outside its file.
  These framework-read exports are imported by nothing:
  - `metadata`: layout.tsx:20, characters/page.tsx:11, login/page.tsx:9, campaigns/page.tsx:24,
    join/[code]/page.tsx:11;
  - `viewport`: layout.tsx:29, with the themeColor pair.
- No e2e and no jest test reads titles or theme colour. A grep of e2e for `page.title`,
  `toHaveTitle` and `document.title` finds nothing.
- Gate 6 (round.md:1349-1350) is meant to cover page.tsx and layout.tsx. But its baseline,
  analysis/T/route-exports.txt, lists only the 41 route.ts files.
- The two `'use server'` modules, with their 15 actions (campaigns/actions.ts,
  characters/actions.ts), are covered by no gate. Exporting a new async function from them creates
  a callable endpoint.

**Fix.**

- R1.9.27 skips every src/app special file and every `'use server'` module.
- Gate 6's baseline adds:
  - page.tsx, layout.tsx and not-found.tsx ×3, plus manifest.ts;
  - both actions.ts files, with their 15 names, each an async function;
  - a count of `'use server'` files, which stays at 2.

### SA F12 (minor): e2e reruns skip the checks lock, and L0 is unbounded on 4 CPUs

**Evidence: reruns.** §2.3.7 (round.md:1083-1085) reruns failed runs with
`ONLY=<suite> BUILD=0 flock -o e2e/.out/e2e.lock npm run e2e`, which takes no checks.lock. The brief
says an e2e pass holds both locks. e2e/lanes/lanes.conf:7-11 runs `toasts` solo because "timers
trip under three lanes' load" (#245). A rerun beside an L1 can misread a flake as a regression, or
the reverse.

**Evidence: L0.**

- This machine has 4 CPUs (`nproc`) and 15 GB RAM.
- Up to 8 agents run L0 unlocked, each with 2 workers, beside an L1 (jest, tsc, eslint).
- Testing Library's `waitFor` (246 calls) waits 1000 ms by default, and Jest's test timeout is 5 s.
- §3.1.5 treats any red existing test as a regression, to be fixed or reverted.

**Fix.**

- Reruns take checks.lock, then e2e.lock, always in that order.
- L0 takes `flock -s X/checks.lock` (shared) and L1 takes it exclusively. L0s then run beside each
  other but never during an L1.
- A red test in L1 is rerun once alone (`--runInBand -t`) before it is classified. Flakes are
  recorded in the lane's report.

### SA F13 (minor): the ratchet re-take and its folder unit can hide new warnings

**Evidence.**

- Gate 9's base is "re-taken after commit 5" (round.md:825, :1355). Any warning that commit 5's
  moves create, such as a new no-cycle or no-restricted-paths warning, becomes base.
- The ratchet's unit is `src/<top folder>` (analysis/metrics/lib.mjs:29), so after commit 5 every
  feature shares one `src/features` bucket.
- Inside a lane, fixing 5 `react-hooks/refs` findings in one file hides 2 new ones in another. A
  new refs-in-render finding is exactly the kind of timing change §1.7.3 worries about.

**Fix.**

- Accept ratchet-moved.json only if each rule's total equals base's. The exceptions are
  import/no-restricted-paths and filename-case, with their deltas listed in commit 5's message.
- Ratchet per (feature folder, rule), or per (file mapped through moves, rule).

### SA F14 (minor): export-move's default handling of shared helpers creates cycles, which Jest reads as `undefined`

**Evidence.**

- R1.9.1 (round.md:899-902) says a helper shared with a name that stays "moves too and the source
  imports it back". TS's Move-to-file does the opposite: it exports the helper from the old file
  and imports it into the target (`addExportsInOldFile` and `addTargetFileImports`,
  typescript.js:147311-147312).
- Combined with the source importing the moved names, that is a runtime cycle.
- next/jest compiles to CommonJS. There, a cycle reads `undefined` at module scope rather than
  throwing; for example a `new Set(MOVED_LIST)` silently empty. Turbopack's ESM would throw a TDZ
  ReferenceError instead.

**Fix.**

- export-move.cjs computes each moved name's file-private closure itself and moves it whole.
- After commits 5, 7 and 8, the metrics' cycle report is a hard gate: no new strongly connected
  group, runtime or type-only. The folder ratchet is not enough.

## Checked and sound (no finding)

- **Gate 2's `numPassingAsserts` is stable.**
  - It counts passing matcher calls only (node_modules/expect/build/index.js:2188 counts calls,
    :2221 counts passes).
  - No `waitFor` callback in the tests has a block body (0 of 246), so retries never add counts.
  - WS0's rerun gave identical counts.
- **Gate 6 and R1.3.10 agree.** events/route.ts exports only OPTIONS and POST (:52, :56), so
  FEATURES leaving it changes no export.
- **The overrides survive moves.** EFFECT_SETTLE and WILD_SHAPE_SETTLE are overridden by a
  `jest.mock` spread of the whole module (effect-controls.test.tsx:28-31, wild-shape.test.tsx:33-36).
  Any import of them, a module-scope copy included, gets 7000.
- **needs-player's retarget changes nothing.** use-table-rolls.ts calls `damageDue` only inside
  `needsPlayer` (:1583-1600), so which calls the spies see stays the same after the move to
  damage-due.ts.
- **`__tests__` under src/app/api is a private folder** (node_modules/next/dist/docs/01-app/
  01-getting-started/02-project-structure.md:257-259). No Cache Components and no proxy/middleware
  are in use (next.config.ts), so GET handlers stay dynamic.
- **The codemods have no string path they would miss.** Tests contain no bare `require('…')` or
  dynamic `import('…')` path, only `typeof import` types, which getEditsForFileRename rewrites.
- **The module reads little.** Of the app's answers it reads only the status, `content-type` and
  JSON keys (scripts/transport.mjs:373-427, :479, commands.mjs:489-492). CORS, statuses and bodies
  are in C5/C6.
- **owners.tsv is consistent otherwise.** Apart from F2 and F5, it has no Phase 3 row whose items
  belong to another lane (X/critic-safety/own.py).

## For the user

Nothing. The decisions cover every choice above:

- Q4 keeps C2-C8 in the repo, which is why F6 matters.
- Pinning TZ in jest.config.ts is test setup inside the refactor's scope.
- The other fixes are planner or orchestrator changes.
