# Phase 5 fixer: rolling-sheet (v0.43, commit 25)

Worktree /home/user/w043/fix-rolling-sheet/sending-stone-player, branch local/043-fix-rolling-sheet,
from claude/dazzling-dirac-m8cq54 at 6e92666 (`npm ci`, `npx prisma generate`). Nothing pushed.

## Commit

- **443530b** `fix: review findings (v0.43, rolling-sheet)` (18 files, +107 -97; two new files)

## Fixed

- **RV2-1 (minor):** eight file-private helpers were moved verbatim, each with its doc comment,
  into the utils.ts beside its component. Each gained `export` and is imported back by its one
  caller.
  - `effectDetail`: effects-tab/effect-entry.tsx → effects-tab/utils.ts (map U2 §2's placement)
  - `foundOf`, `preparedCount`: spells-tab/spells-tab.tsx → **new** spells-tab/utils.ts
  - `fromNote`, `factsOf`: spells-tab/spell-entry.tsx → spells-tab/utils.ts
    (spell-entry's `SheetCastFrom` type import went with them)
  - `originName`: features-tab/features-tab.tsx → features-tab/utils.ts
  - `initials`: sheet-tiles/portrait.tsx → sheet-tiles/utils.ts. portrait.tsx imports it from
    `./utils`, not from src/utils/initials.ts. It keeps `word[0]` (first UTF-16 unit, B8) and its
    empty result for a name with no words. It had no doc comment, so it got one saying how it
    differs from `@/utils/initials`.
  - `keyTarget`: sheet-entry/sheet-entry.tsx → **new** sheet-entry/utils.ts
  - The two new utils.ts files carry no directive (§1.0 rule 9). Gate 11 found the same 172
    server-graph modules as APP's head; a gate-lib `serverGraph` run over both trees diffs empty.
  - Nine lowercase top-level functions remain in rolling/sheet product .tsx: eight in
    dice-entry-dialog.tsx (R1.2.11: moved only) and `keepFocusIn` in recharge-chip.tsx (a DOM
    helper). Both are outside the finding.
- **RV2-2 (minor):** `Effecting` moved from use-spent-removals.ts:6 to
  src/features/sheet/hooks/types.ts as `export type Effecting = Pick<Effects, 'effectOf' |
  'choiceFor' | 'send'>`, with a one-line doc comment, beside `Spending`. The `Effects` type import
  went with it. use-spent-removals.ts reads `import type { Effecting, Spending } from './types'`.
  The change is type-only and forms no cycle: effect-controls/types.ts imports only
  @/types/sending-stone and react.
- **RV2-3 (minor):** `GM_WORDS` and `GM_WORDS_AFTER`, with their doc comments, moved from
  src/features/rolling/utils/gm-words.ts to src/features/rolling/constants.ts (appended). The
  three readers now import them from `@/features/rolling/constants`, the path roll-button.tsx and
  roll-menu.tsx use: roll-tray/gm-result.tsx, roll-tray/gm-pill.tsx and utils/brief.ts. brief.ts's
  remaining gm-words import fits on one line, as prettier asks. gm-words.ts itself never read
  either constant. constants.ts still has only type imports, so no cycle forms. No test, mock or
  golden names either constant.

## Answered (no code change)

None. All three findings were fixed as written.

## Checks

- **Byte check:** every line removed from the 16 changed files and 2 new ones comes back unchanged
  (after removing `export`), with the `·` in effectDetail included. The only exceptions are import
  lines, the `initials` and `Effecting` doc comments, and `export type Effecting`.
- **No test file changed.** §1.8: goldens, assertions and mocked paths are untouched.
- **eslint** over the 18 files, under both locks: one prettier finding in brief.ts's import, fixed.
  Clean after the fix.
- **L0:** `--findRelatedTests` over the 18 files, under the shared lock: 67 suites, 2,890 tests,
  478 snapshots, all green. The run included C1 (markup) and C4 (words), plus C2, C3, C5, C7 and
  C8.
- **L1:** `R/tools/l1.sh X/l1/fix-rolling-sheet <worktree>`, 07:16:32 to 07:20:26 UTC, 0 failed.
  - jest: 318 suites, 9,727 tests, 0 red, 0 flaky, 0 suites that did not run
  - typegen ok; tsc 0 errors
  - eslint: 1,163 files, 0 errors, 0 warnings
  - gates 1-12 ok:
    - gate 2: 8,607 base tests
    - gate 3: 1,120 new
    - gate 9: 0 warnings
    - gate 10: 991 golden tests, 24 frozen files held
    - gate 11: 840 modules, 172 server modules, 21 client boundaries
    - gate 12: 0 cycle groups
- **`next build`:** under `flock X/l1-wait.lock flock X/checks.lock`, 07:20:34 to 07:21:27 UTC.
  Exit 0. Its route table equals G's fix build (X/G/fix-build.log), apart from the timing lines.
  It prints the usual environment-only messages: 6 Better Auth "Base URL is not set" and 6 Prisma
  "Environment variable not found: DB_URL", because no DB_URL or auth secret is set here.

## Bugs logged

No new bug. I appended one path update to APP's .refactor/bugs-found.md, under bugs.lock, in a
new "[fix-rolling-sheet] Paths moved by Phase 5" section. B8's sheet site (the [V2] entry names
`src/components/character-sheet/sheet-tiles.tsx:445` at 24f808b; commit 7 moved it to
sheet-tiles/portrait.tsx) is now `initials` in
`src/features/sheet/components/sheet-tiles/utils.ts:19-26`, with `word[0]` at :24, called from
portrait.tsx:24. ROADMAP.md names no path for B8, so it needs no change. ROADMAP's
`src/features/rolling/utils/gm-words.ts`, `gmLine` reference still holds, since `gmLine` stays in
that file.

## For later workstreams

- owners.tsv is a record (amendment 6 (c)). The two new files,
  src/features/sheet/components/spells-tab/utils.ts and
  src/features/sheet/components/sheet-entry/utils.ts, have no row yet. They belong to U2's lane:
  sheet parts.
- Rebasing onto the other fixers' commits: this commit touches no file that fix-server or
  fix-table-ui changed. fix-table-ui moved `initial` into src/components/avatar/utils.ts, a
  different file from sheet-tiles/utils.ts.
