# WS0 Base: report (2026-11-02, ~10:15 PM EST)

## Baseline on the unchanged code (HEAD 54d8128: 51b8916 plus .refactor/ files only)

Each under `flock X/checks.lock`, in APP:

| check | result |
|---|---|
| `npx jest --json` | 290 suites, 8,607 tests, all passed (0 failed, 0 skipped, 0 todo); 25,284 passing assertions; 128 s |
| `npx next typegen && npx tsc --noEmit` | exit 0 |
| `npx eslint .` | exit 0: 666 files, 0 errors, 0 warnings |
| `npx next build` | exit 0 (53 routes). The log carries this machine's noise while collecting page data: Better Auth's "Base URL is not set" and "default secret", and Prisma's "Environment variable not found: DB_URL" |

X/jest-base.json and X/jest-base.tsv (fullName, status, numPassingAsserts, suite; 8,607 rows) are
in the scratchpad only. They are regenerable: commit 1's jest run gives the same per-test results.
Four (suite, fullName) pairs occur twice, so gate 2 must match tests by occurrence, not by name
alone: rolls/route.test.ts "answers 422 when the roll is refused, saying why", game-table.test.tsx
"describes the encounter", use-notes.test.ts "answers a refusal, 409, with why",
schemas/campaign.test.ts "toForgeGameUrl reduces https://my-game.forge-vtt.com to its game origin".

## Commits

| SHA | subject |
|---|---|
| 1dff83f | chore(lint): import resolver and CLAUDE.md's rules, as warnings for now |
| (next) | chore(refactor): metrics base on commit 1 |

Commit 1 touches eslint.config.mjs, package.json and package-lock.json only. Six rules added:

1. (a) no-restricted-syntax on `**/*.tsx`: a second export statement, several names in one
   statement, `export *`, an exported `use*` name, an exported name that is not PascalCase
   (utilities and constants), and type exports (`export type {…}`, `export { type … }`,
   `export type *`). Next.js route files (`**/app/**/{page,layout,template,loading,error,
   global-error,not-found,global-not-found,forbidden,unauthorized,default,opengraph-image,
   twitter-image,icon,apple-icon}.tsx`) may also export metadata, generateMetadata, viewport,
   generateViewport, generateStaticParams, dynamic, dynamicParams, revalidate, fetchCache,
   runtime, preferredRegion, maxDuration, instant, prefetch, alt, size, contentType and
   generateImageMetadata (Next 16's docs), which neither count toward the one export nor read as
   utilities.
2. (b) no-restricted-syntax: any type alias or interface in a .tsx; in a .ts, an exported type
   alias or interface or a local `export type { X }` / `export { type X }`, except in `types.ts`,
   under a `types/` folder (src/types/, CLAUDE.md §4) and in `.d.ts` files.
3. (c) eslint-plugin-react-hooks 7.1.1's `configs.flat.recommended` (16 rules), each at warn.
4. (d) import/no-cycle at warn with no depth limit, the TypeScript resolver wired in.
5. (e) sonarjs/cognitive-complexity at 15 (eslint-plugin-sonarjs 4.2.2, published 2026-09-28,
   the latest; 4.2.1 was 2026-09-15).
6. (f) unicorn/filename-case ignores `^__tests__$` path segments.

The fixtures (outside src, made, linted and deleted under the checks lock) showed every selector
firing where it should and nowhere else: one component, `export default function Card`,
`export { Card as default }`, a route page.tsx with seven framework names and a default, the
`types.ts`, `types/` and `.d.ts` homes, a non-exported type in a .ts and a type re-export with a
source drew nothing; a page.tsx outside app/ exporting metadata was flagged; a layout.tsx's extra
helper, a not-found.tsx's hook and an error.tsx's second component were flagged; `__tests__/`
skipped filename-case while `lib/BadName.ts` still failed it.

## Gates on commit 1's tree (L1, under the checks lock)

- `npx eslint .`: exit 0, 666 files, 0 errors, 999 warnings (about 1 min 52 s).
- `npx next typegen && npx tsc --noEmit`: exit 0.
- jest: 290 suites, 8,607 tests passed; every test's suite, fullName, status and
  numPassingAsserts equal to the base (the sorted lists are identical).
- `npx prettier --check eslint.config.mjs`: clean. `next build` was not rerun: commit 1 changes no
  file the build reads (Next 16's build does not lint).

## Deviations and why

- **unicorn/filename-case stays at `error`.** It was an error rule already and nothing breaks it;
  only the `ignore` is new. Lowering it to warn would loosen a guard the code meets today.
- **`import` is eslint-plugin-import-x 4.17.1**, the plugin the config already registers under
  that key. eslint-plugin-import 2.32.0 is present only as eslint-config-next's dependency, and
  eslint.config.mjs does not use eslint-config-next, so react-hooks has no duplicate plugin key
  either. The resolver goes in through `import-x/resolver-next` with `import-x/extensions` and
  `import-x/parsers`: without those two, no-cycle reads no TypeScript file and finds nothing.
- **import/no-cycle was `['error', { maxDepth: 1 }]` but blind** (no resolver for `@/`, no
  TypeScript parser), so it passed. Now `warn`, unlimited depth. It skips type-only imports (the
  plugin's behaviour), so it reports only the runtime cycle (10 warnings in 6 src/db files); the
  three type-only cycle groups are in the metrics.
- **The resolver wakes two existing rules.** import/no-restricted-paths (the layer zones, already
  at warn) now resolves `@/` and gives 29 warnings (it gave 0, blind). import/order would rank `@/`
  as internal, ahead of relative imports, making errors across the tree: a pathGroup
  `{ pattern: '@/**', group: 'unknown' }` keeps today's order (0 new errors).
- **Rule (b) exempts src/types/** (CLAUDE.md §4 names it the home of application-wide types): 216
  exported types in its 10 files are not flagged. To flag them, drop `'**/types/**'` from that
  block's ignores (121 warnings become 337).
- **Rule (b) leaves `export type { X } from '…'` alone**: a re-export declares no type; barrels
  are counted on their own.

## Metrics (R/analysis/metrics-base.md, ratchet-base.json; scripts in R/analysis/metrics/)

`sh .refactor/analysis/metrics/run.sh <label> [commit]` runs eslint under the lock and writes
metrics-<label>.md and ratchet-<label>.json; it refuses a tree that differs from the commit outside
.refactor/. The ratchet holds warnings per top-level folder per rule, with no-restricted-syntax also
split by check (one-export, hook-export, utility-export, type-export, tsx-type, ts-type-export); a
missing folder or rule means 0.

- Rule (a): 74 of 155 product .tsx files break it, 70 export more than one thing (the first plan's
  numbers exactly); no test .tsx breaks it. The AST list and lint agree file for file.
- Rule (b): 171 named types in 94 product .tsx files (205 in 125 with tests); 121 exported named
  types in 48 .ts files outside types.ts and src/types/.
- Cognitive complexity over 15: 63 functions, all outside tests (the first plan's 86-87 was an
  approximation; sonarjs adds a nested function's complexity to the function around it). Top:
  GameTable 96, roll-request.ts's superRefine 84, campaign-events.ts's apply 70, roll-tray's
  usedWords 56, createRollRequest 53.
- Import cycles: 4 groups counting type-only imports, 1 runtime (src/db: effects, favorites,
  removals, roll-requests, transfers, wild-shape); 2 groups span folders (types/utils/hooks around
  use-sheet-roller; use-table-rolls and move-words).
- Barrels: 27 index.ts files, 94 importing files (modal/index.ts alone 37).
- eslint-disable: 430 comments; 175 whole-file and 6 ranges (181); 35 give no reason and 12 more
  only a comment above (47); unicorn/no-null 250, unicorn/no-useless-undefined 152.
- Files over 500 lines: 120, 38 outside tests.
- react-hooks: 43 refs, 29 rules-of-hooks, 11 set-state-in-effect, 8 exhaustive-deps and 10 others.
  The rules-of-hooks ones sampled are names, not hook-order bugs: `useTargetsOf` (use-picker.tsx) is
  a plain function called from a callback and under a condition, character-pane.tsx's local `use`
  callback, roll-requests.test.ts's `useRequest` helper. Renames for the lanes; not logged as bugs.

## Bugs logged

None.

## What later workstreams must know

- New lint warnings are expected until commit 19 (CLAUDE.md's rules as errors); gate 9 compares
  each folder's count per rule (and per syntax check) with ratchet-base.json.
- A file named `use*.ts(x)` whose functions are not hooks, or a non-hook named `use*`, draws
  rules-of-hooks warnings; rename rather than disable.
- Moving types into src/types/ or any `types/` folder satisfies rule (b) as configured.
- The e2e full baseline (prior plan §2.4 WS0) was not part of this step and was not run.
