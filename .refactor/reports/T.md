# Report: builder T, WS1 Kit (v0.43, Phase 1)

Worktree /home/user/w043/T/sending-stone-player, branch `local/043-T` from dd3a2ad. Nothing pushed.

## Commit

| SHA | subject |
|---|---|
| 850ceed | test: a small test kit, byte-identical helpers adopted, the no-db guard, TZ pinned, a values golden; the request-kind table (setup and new files) |

110 files: 17,396 lines added, 417 removed (most of the added lines are C9's .snap, 275 KB).

## Files

New (T(frozen) rows of owners.tsv):
- src/utils/test-utils.ts (R3.1): respond, responding, advance, posts, sent, rollServer, minutesAgo, brokenImages, normalizeIds, normalizeTimes, atFixedTime, markup, ordered.
- src/utils/test-utils.test.ts (R3.1): the kit's own table test, 44 tests. It runs in `@jest-environment node` so it can cover both halves (routeCall needs Node's Request). markup and brokenImages need jsdom, so this file leaves them out: markup is just the two normalizers applied to `document.body.innerHTML`, and brokenImages is the copy that 4 suites already pin.
- src/utils/test-utils-node.ts (R3.2): prismaMock (re-exported from jest.setup), prismaFake(rows) → {tables, calls}, resetPrisma, guardNoDb, routeCall.
- src/mocks/dice-renderer.ts (R3.3): NO_DICE_RENDERER.
- src/mocks/sheet-providers/sheet-providers.tsx and types.ts (R3.5): SheetProviders, SheetProvidersProps, PaneTable, PaneRoller.
- src/__tests__/golden/values.golden.test.ts and `__snapshots__/values.golden.test.ts.snap` (C9). The snapshots were written once with `--ci=false` over this file only, then checked with `--ci`.

W-a's part (R1.6, copied in by W-a; hashes match X/handoff/r16-ready): src/constants/roll-kinds.ts, src/constants/roll-kinds.test.ts (22 tests), src/types/roll.ts (RollKindInfo appended).

Config:
- jest.config.ts: `process.env.TZ = 'UTC'` at the top, with its reason (§0.6.18). I checked it from an Eastern shell (`TZ=America/New_York`), with 2 workers and with `--runInBand`: both run in UTC. B19's coverage pattern is untouched.
- eslint.config.mjs: `unicorn/filename-case` now also ignores `^__snapshots__$`, with its reason.

Setup lines in 97 base test files (R3.3 and R3.4). Only import lines, deleted helper declarations (with their doc comments) and `guardNoDb()` lines changed:
- respond ×15. responding ×3 (`import { responding as respond }`). advance ×11. posts ×3. ago ×5 (`minutesAgo as ago`). brokenBeforeMount ×4 (`brokenImages as brokenBeforeMount`). That is 41 helpers, all checked byte-identical by the script before it deleted them.
- 18 3d-dice-react factories became `jest.mock('@lambersond/3d-dice-react', () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER)`.
- 33 `import { prismaMock } from '<../…>/jest.setup'` lines now import from `@/utils/test-utils-node`.
- give-controls.test.tsx and take-controls.test.tsx: `act` dropped from their RTL import, because advance was its only user.
- R3.4: `guardNoDb()` (plus its import) after the imports of the 25 "noprisma" route suites in analysis/T/route-suites.txt.
- `eslint --fix` on these files only re-sorted the new import lines and re-wrapped the new dice mock. I diffed its output to confirm nothing else changed.
- The scripts are in X/T/tools/ (adopt.py, guard.py, gen-c9.py). Logs: X/T/adopt-log.json, X/T/guarded.txt.

## Checks (L1: W-a's l1.sh on my worktree, 06:13-06:19 UTC; outdir X/T/l1a)

- **jest:** 293 suites and 8,954 tests, 0 red, 0 flaky.
  - Base: 290 suites and 8,607 tests, all passed. Gate 2 confirms every base test is still there and passing, with at least its base assert count.
  - New: 347 tests (44 kit, 281 C9, 22 roll-kinds).
- **typegen, tsc:** clean.
- **eslint:** 0 errors and 999 warnings, the same count as the base (gate 9 ok). My new files have 0 warnings.
- **Gates:** 1, 2, 3, 4, 4b, 5, 6, 7, 8 (25 suites), 9, 10 (281 golden tests), 11 and 12 are ok.
- **Gate 1b: FAIL**, and the failures are exactly the 18 replaced 3d-dice-react factories, which are its planned allowlist rows. I did not add the rows: only the orchestrator adds them. **Asked of the orchestrator:** add the 18 rows in X/T/gate1b-allow-rows.tsv to R/tools/gate1b.allow. They use the format `<file>\tmock\t@lambersond/3d-dice-react\t<reason>`.
- **Gate 1b, review notes (not failures):** the three `responding` adoptions are flagged "JavaScript differs". The copies wrote `Promise.resolve({status, ok, json} as Response)`. The kit's `responding` is `Promise.resolve(respond(status, body))`, as R3.1 defines it. The result has the same three fields and is resolved, and the 3 suites' tests pass with equal asserts.
- **Before L1:** L0 over the 99 changed suites passed (2,685 tests).

## Deviations from round.md and why

1. **C9 leaves some constants out:**
   - SETTLE_FOR (turn-toast.tsx:57), OVER_FOR (use-end-turn.ts:28) and the three MAX_DELAYs (use-notes.ts:22, use-table-view.ts:12, use-party-sheet.ts:7) are module-private at the base. C9 cannot read them without a product change. The timings that test them still pin them.
   - The exported timings it does hold: CHECK_EVERY, FOLLOW_FOR, LATE_FOLLOW, BUSY_WAIT, BUSY_FOR, POLL_INTERVAL, the four `*_SETTLE`s, and both TOAST_FORs, held as PAGE_TOAST_FOR (page-toast.tsx) and ROLL_TOAST_FOR (utils/roll-toasts.ts) because the name is taken twice.
   - Also left out: src/constants/roll-kinds.ts (new in this commit, held by its own literal-equality test, and W-a's to extend in Phase 3) and T's own new mocks (dice-renderer, sheet-providers; gate 10 freezes them).
2. **C9 is keyed by name, with explicit named imports.** A value moved by 2a/2b/3 then changes only import lines: its `CONSTANTS`/`FIXTURES` tables stay byte-identical. A factory is called with no arguments. One that throws ("needs arguments": combatant, knownForm …) or is not a value factory (fakeDevice, fakeFullscreen, serveNotes) is snapshotted as skipped, so the skip list is pinned too. Fixed clock 2026-10-04T19:30Z and LCG Math.random (seed 43).
3. **SheetProviders** builds these with the real hooks, as the pane does:
   - favoriting (useFavorites), preparing, effecting, wildShaping, marks, the conditions panel, enchanting, concentrating, charging (spend, inspire) and the descriptions' actions;
   - all over useTableRolls and useSheetRoller, inside TableApiContext(seat) and its own DiceRendererProvider.

   It leaves out what only the pane's private state decides: the attack/use picker, the descriptions' `askBlocked`/`useBlocked` words (file-private functions in character-pane.tsx), and `charging.slot`/`slotWaiting` (the pane's private useSlotWaits). A golden that needs those renders CharacterPane, or passes that context as a prop (each of the 10 contexts can be overridden; a prop that is given wins, even `undefined`). `name` is required, as on CharacterPane. A smoke render of ActionsTab on fullerSheet inside it worked (not committed).
4. **The kit's file-private type aliases** (Row in test-utils-node.ts) stay in the .ts. Exported types went to sheet-providers/types.ts; the kit itself exports no named type.
5. **routeCall loads `next/server` with `jest.requireActual` only when it is called.** A top-level import breaks the 10 jsdom db suites that import prismaMock from the node kit (jsdom has no `Request`). I tried it, and it failed.
6. **One new line-level disable,** in test-utils-node.ts: `// eslint-disable-next-line unicorn/no-null -- Prisma answers null where no row matches` on `const NO_ROW = null`. Commit 6 removes it with the other no-null directives (gate 10 drops comments).

## Bugs logged (bugs-found.md, [T] section)

- tsconfig.json:23 defines `@test-utils` (→ src/utils/test-utils) with no jest moduleNameMapper entry, so an import of it typechecks but fails in jest. This is a tooling issue, low. The kit is imported as `@/utils/test-utils`.

## What later workstreams must know

- **Mocks:** each of the 18 suites now mocks the dice with `jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER`. The `@/mocks/dice-renderer` path must follow any move of that file (gate 4 exempts requireActual targets from its closure clause).
- **prismaMock:** every suite now imports it from `@/utils/test-utils-node`, so moves no longer touch those lines.
- **The kit, SheetProviders and C9 are frozen** (gate 10): only import lines and mock paths may change. SheetProviders imports these hooks with their present signatures, which Phase 3 lanes must keep:
  - useFavorites, usePreparing, useEffectControls, useWildShape, useConditionsPanel;
  - useTableRolls (send, sendDamage, sendFormula, sendRecharge, sendFavorite, sendPrepare, sendEffect, sendWildShape, sendEnd, sendEndConcentration, sendSpend, sendInspiration, sendAsk, readWildShapeForms, takes, lists, latestFor, states, modifiesText, signsText, available, sending, setSending);
  - useSheetRoller (roll, rollDamage, rollFormula, logFavorite, logPrepare, logEffect, logWildShape, logEnd, logCharge, logAsk);
  - sheetTools, belongingsOf, favoriteEntries, favoriteKeys.

  It also imports the context components Favoriting, Preparing, Effecting, WildShaping, FavoriteMarks, ConditionsOpener, DescriptionLinks, Enchanting, Concentrating and Charging, and the contexts RollsLocked, SheetIdPrefix, TableApiContext, CreatureContext and useTableRole.
- **C9** pins every src/mocks fixture's output and every src/constants value by name. W-b's mock base (R1.4.10) must leave each one's JSON equal. A constant that moves keeps its name, or is imported under its old name.
- **For C-a and C-b:**
  - sent() records `{url, method ('GET' when none), headers (one object sorted by name, as given: a Headers instance gives lowercase names), body (raw string or undefined), the other init keys sorted (cache …), signal: true when given}`.
  - rollServer keeps action-entry.alone's semantics exactly: a POST's `json()` is read lazily, so it says `req-<posts so far>`.
  - prismaFake answers from rows (no select/include/orderBy; skip/take kept). It records every call made of the mock in invocation order, for any model, including `$transaction` (`method: ''`, `args: 'callback'` or the list).
  - normalizeTimes leaves "just now", "N minutes ago" and "yesterday" as they are. It replaces clock times, LocalTime's dated form, fullNoteTime's form and noteTime's "4 Oct[ 2025]".
- **Copies placed** (untracked, same paths) in /home/user/w043/C-a/sending-stone-player and /home/user/w043/C-b/sending-stone-player: the five kit files, each hash equal to commit 850ceed's. Logged in X/handoff/kit-ready.
