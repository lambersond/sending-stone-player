# Phase 5 fixer: table-ui (v0.43, commit 25)

Worktree /home/user/w043/fix-table-ui/sending-stone-player, branch local/043-fix-table-ui, from
claude/dazzling-dirac-m8cq54 at 6e92666. Nothing pushed.

## Commit

- **24a687b** `fix: review findings (v0.43, table-ui)` (11 files, +38 -40)

## Fixed

- **RV1-2 and RV3-3 (minor; the same finding):** the table's helpers in
  src/features/table/utils/party-urls.ts were renamed `partyApi`/`partyPage` →
  **`seatPartyApi`/`seatPartyPage`**, named after the seat they take. This meets RV1-2's "named
  after what they take" and is RV3-3's spelling. The `partyApi as playerPartyApi` alias is gone,
  so seat-urls.ts's `partyApi(characterId, groupId)` is now the only `partyApi`. The one caller,
  table-party-panel.tsx (its import and both calls), follows. No test or mock names either
  module's pair. The URL strings are unchanged, and C1/C2 are green (L1 gate 10).
- **RV3-2 (minor):** four helpers were moved verbatim to a new utils.ts beside each component and
  imported back. Only `export` was added; eslint --fix reordered the import lines.
  - `formatTime` → src/components/local-time/utils.ts (B7's site)
  - `initial` → src/components/avatar/utils.ts (one of B8's sites)
  - `countWords` → src/features/campaigns/components/campaign-index/utils.ts
  - `randomSecret` → src/features/campaigns/components/campaign-setup-form/utils.ts

  No new tests: the component suites already pin all four (CLAUDE.md §8: no overlapping coverage;
  §3.1.3). Gate 11 counts avatar/utils.ts as a new server-graph module with no component, which
  it allows (173 server modules). bugs-found.md can only be appended to from a fixer, so its B7 and
  B8 entries got a path note appended (APP, under bugs.lock). ROADMAP.md names neither path.
- **RV3-5 (minor):** src/__tests__/import-cycles.test.ts:11 sets
  `ROOT = path.resolve(path.dirname(expect.getState().testPath!), '../..')`, with a two-line
  comment. Jest sets `testPath` in jest-circus's `initialize` before it requires the test file
  (node_modules/jest-circus/build/jestAdapterInit.js, `jestExpect.setState({ snapshotState,
  testPath })`).
  - The reviewer's `path.resolve(__dirname, '../..')` fails lint with `unicorn/prefer-module`
    ("Do not use "__dirname""), and an eslint-disable would break CLAUDE.md §9.
  - Before: in APP at 6e92666, from src/, the test failed with `ENOENT … scandir
    '/home/user/sending-stone-player/src/src'`. After: run from src/, it passes (1/1).
  - The assertion is unchanged. This is G's new test, not a base suite, so gates 1 and 1b do not
    hold it.

## Answered (no code change)

- **RV3-1 (major, confirmed): the deletion is left to commit 26, as the finding's first route
  says. It needs two orchestrator rows in R/tools/counts.conf.**
  - **Why not in this commit:** gate 10 (R/tools/gate-10.mjs:84-86) fails a frozen file that is
    gone unless counts.conf has a `retire` row for it. A fixer may not write APP's R/tools.
    counts.conf's header and §3.1.1 say only commit 26 adds retirements.
  - **Dry run** in this worktree, with the files moved aside and two rows appended to the
    worktree's own counts.conf (both restored afterwards), against this L1's jest.json:
    - gates 1, 2, 3 and 10 all ok (gate 10: 991 golden tests, 24 frozen files held; gate 3:
      unchanged counts, since retired() only removes base test files from the counts)
    - without the rows, gate 10 FAILs with 2 problems
  - **Importers:** none. `grep -rn "SheetProviders\|sheet-providers"` over src, jest.setup.ts,
    jest.config.ts, eslint.config.mjs, e2e, tsconfig.json and package.json, outside the folder,
    prints nothing. owners.tsv rows 670-671 are the two files.
  - **Rows for commit 26:**
    `retire<TAB>src/mocks/sheet-providers/sheet-providers.tsx<TAB>…` and
    `retire<TAB>src/mocks/sheet-providers/types.ts<TAB>…`
  - **The rest of the hand-off:** delete both files, mark owners.tsv rows 670-671 deleted, name
    the deletion in the PR, and an amendment for §3.1.1, §3.4 gate 10 and counts.conf's header.
  - **Also for commit 26:** decide whether the kit's `markup()` and `normalizeIds()` stay once C1
    retires (test-utils.test.ts is then their only user), and say which in the PR.
  - The duplicate PaneTable/PaneRoller in src/mocks/sheet-providers/types.ts:57,60 go with that
    file. character-pane/types.ts:32-35 keeps its own.
- **RV3-4 (minor): commit 28's job, not commit 25's.** While .refactor/ exists (until commit 28),
  `.refactor/**` must stay ignored. Otherwise `eslint .` (L1, gate 9) lints its 77 .js/.mjs/.cjs
  scripts, written in another style, under the app's rules at error. Commit 28 should drop the
  ignore line and its comment from eslint.config.mjs with the folder and rerun `npx eslint .`.
  §2.5 row 28's check would read ".refactor/ and its eslint ignore". That contract amendment is
  the orchestrator's.
- **RV3-6 (minor): no code change, per the finding.** The goldens are frozen (gate 10) and C1
  retires in commit 26.
  - **The record:** the markup snapshot has only `3 data-mode="tabs"` and no avatars mode.
  - **What holds avatars mode:**
    - creature-switcher.test.tsx:356-419 (`data-mode` 'tabs' at :356, :407, :419; 'avatars' at
      :363, :389, :392, :400)
    - e2e companions part "2b. tabs or avatars" (companions-e2e.mjs:380-405), green in pass 4
  - **Text for the PR's goldens note:** "C1 (commit 4) pins CreatureSwitcher's tabs mode only,
    not avatars mode (a deviation from §3.2's C1 list for V2). creature-switcher.test.tsx and
    e2e companions hold avatars mode."

## Checks

- **L0:** `npx jest --ci --findRelatedTests` over the 11 files: 35 suites, 915 tests, 449
  snapshots, all passed.
- **L1:** `R/tools/l1.sh X/l1/fix-table-ui <worktree>`, 07:01:25 to 07:05:07 UTC, on the tree
  committed as 24a687b. 0 failed.
  - jest: 318 suites, 9,727 tests, 0 red, 0 flaky
  - typegen ok; tsc 0 errors
  - eslint: 1,165 files, 0 errors, 0 warnings
  - gates 1-12 ok: gate 2 has 8,607 base tests; gate 10 has 991 golden tests and 24 frozen files
    held; gate 12 has 0 cycle groups
- **`next build`:** under both locks, exit 0 (07:06:27 UTC).
  - The route table equals F-b's build log (only the timing lines differ).
  - It prints the same environment-only messages as before: 6 Better Auth "Base URL is not set",
    6 default-secret and 6 Prisma "DB_URL not found".

## Bugs logged

None new. The B7/B8 path note was appended to R/bugs-found.md (APP, uncommitted, for the
orchestrator to commit).

## For later workstreams

- **Commit 26:**
  - RV3-1's two retire rows and the deletion (above)
  - the markup()/normalizeIds() decision
  - RV3-6's sentence in the PR's goldens note
- **Commit 28:** RV3-4's eslint ignore line and its comment.
