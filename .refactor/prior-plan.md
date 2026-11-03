# What survived of the first plan (round.v2.md, 2026-11-02 ~12:40 PM EST)

The first contract (round.v2.md, 126 KB) and its maps, analysis, critiques and tools were in the
scratchpad and were lost in the container reset at ~9:35 PM EST. What survives, from the session
transcript:

1. **The planner's measurements on main 81a8278** (its summary):
   - One component per `.tsx`, nothing else exported: 74 of 155 files break it (70 export more than one thing).
   - Named types in `.tsx`: 171 in 94 files; 167 more in `.ts` files that aren't `types.ts`.
   - `eslint-disable`: 429 lines; 181 cover a whole file; 47 give no reason. 401 of them silence
     `unicorn/no-null` (249) or `unicorn/no-useless-undefined` (152).
   - Import cycles: one runtime cycle (6 files in `src/db`), four counting type-only imports, three
     between folders. 27 barrel files.
   - Cognitive complexity over 15: 86-87 functions (approximation).
   - `import type`: already complete.
   - Of 16,468 `expect` statements, 6,347 span several lines (why gate 2 compares `jest --json`'s
     per-test `fullName` and `numPassingAsserts`, not grep).
   - React 19.3 ids are `_r_<n>_` from a per-file counter (why goldens normalize ids).
   - `react/no-multi-comp` would flag 238 in 63 files; CLAUDE.md needs 75 extra exported components
     in 33 files split: enforce "at most one export per .tsx" with `no-restricted-syntax`.
2. **v2's targets:** .tsx files breaking CLAUDE.md 74→0; types in .tsx 171→0; complexity > 15 86→0
   except 6 held for bug #440 (the dice entry); import cycles and barrels →0; eslint-disables
   429→≤35; copied request/settle/command code →1 each; e2e runs unchanged. Cut from v1: route
   groups, dice rework (held for #440), the single sheet context, the shared poller, two-copy merges,
   size caps. 19 bugs were logged for ROADMAP (11 seen in code, 5 to confirm, 3 in the e2e harness):
   the list is lost and must be found again.
3. **v2's outline** (headings): §0 Summary, principles and metrics (§0.1 what v0.43 is, §0.2
   principles, §0.3 CLAUDE.md rule by rule, §0.4 metrics before/targets, §0.5 facts, §0.6 choices
   pinned without a question, §0.7 counts, §0.8 what v0.44's items get); §1 Target shape (§1.0 the
   tree and placement rules, §1.1 sheet UI, §1.2 rolling core, §1.3 server, §1.4 wire and checks,
   §1.5 other UI, §1.6 kinds, §1.7 guard rails, §1.8 what stays byte-identical, §1.9 seams and
   cross-area follow-ups, §1.10 what v1 planned that v2 does not do); §2 Order of work; §3 Test
   policy (§3.1 rules, §3.2 goldens C1-C8, §3.3 where tests live, §3.4 gates per commit); §4 Bug log
   (§4.1 seen in code, §4.2 to check, §4.3 behaviour questions for v0.44, §4.4 tooling defects, §4.5
   the ROADMAP edit); §5 Risks; §6 Out of scope; §7 The PR; §8 Timeline.
4. **The gates (§3.4, from the scripts' usage notes):** `l1.sh <outdir> [checkout]`: under the checks
   lock, full `jest --json`, `next typegen`, `tsc --noEmit`, `eslint . -f json`, then `gates.sh`.
   Gates: 1 assertions (no existing `expect` changed), 2 per-test `fullName` and `numPassingAsserts`
   against the base (equal or more), 3 counts (suites, tests), 4 stale mocks (a `jest.mock` path
   that no longer resolves), 5 overridden constants, 6 route exports, 7 shims (`v0.43-shim` imports
   only where allowed; none after commit 19), 8 prisma (route suites touch no real db: `guardNoDb`),
   9 the lint ratchet per folder (no folder's warning count rises), 10 goldens (green, unchanged
   snapshots).
5. **Lessons from the first run:** `unicorn/filename-case` (eslint-plugin-unicorn 65) checks folder
   names too, so `__tests__` needs `ignore: ['^__tests__$']` (a separate commit, before the goldens);
   a merge commit needs the trailers; write files with the Write tool, not python heredocs; clear the
   jest cache when the disk runs low (it reached 7.9 GB).

Below, **§2 verbatim** (the order of work). Paths: `S/next24/` is now `.refactor/`; the R1.x.y item
numbers refer to the lost §1 and are re-made by the re-plan; the module needs no detach (its main
94773cb is v0.42.1); the branch is merged, not rebased (24f808b).

---

## §2 Order of work

### §2.1 Phases and workstreams

Each phase ends green on L1 (§2.6) and `next build`; the e2e column says which end with a full lane pass. Writing hours are estimates for one builder.

| phase | workstream (builder) | owns | depends on | ends with | commits | writing |
|---|---|---|---|---|---|---|
| 0 | **WS0 Base** (orchestrator) | the branch, eslint.config.mjs, package.json devDependencies | answers | L1, build, `jest --json` base, metrics base, ratchet base, **e2e full baseline** | 1 | 0.75 h + 62 min pass |
| 1 | **WS1 Kit and gates** (T) | src/utils/test-utils*.ts, src/mocks/sheet-providers.tsx, the 24 route suites' setup lines, S/next24/tools/ | WS0 | L1; counts equal | 2 | 3 h |
| 1 | **WS2 Goldens** (C-a: C1, C4, C7, C8; C-b: C2, C3, C5, C6) | src/__tests__/** (new) | WS0; T's helpers (new files, shared at h+1) | L1; goldens green on old code | 3 | 5 h each |
| 1 | (M writes the move codemod in S/next24/tools/, runs nothing) | — | — | — | — | 2 h |
| 2a | **WS3 Moves** (M) | every file it moves; every `jest.mock` path | WS1, WS2 | L1, build | 4, 5 | 1.5 h + 0.5 h |
| 2b | **WS4 Seams** (M) | the files R1.9.1-.4 name | WS3 | L1, build, **e2e full** | 6 | 6 h + 62 min |
| 3 | **WS5 Server** (S) | src/app/api/**, src/app/**/actions.ts, src/lib/**, src/db/**, src/utils that only the server imports (table-view, transfers, removals, favorite-commands, effect-commands, wild-shape, prompts, companions, slim-sheet, campaign-secret (new)), src/constants/features.ts (new) | WS4 | L1, build | 7, 8, 9 | 13 h |
| 3 | **WS6 Wire and checks** (W) | src/schemas/**, src/types/**, src/constants/** (but features.ts, polling.ts), src/mocks/** (but sheet-providers.tsx), src/utils/roll-requests.ts → src/utils/requests/** | WS4 | L1 | 10, 11 | 13 h |
| 3 | **WS7 Rolling** (R) | src/features/rolling/**, src/utils of rolling (effect-dice, typed-dice, faces, formulas, damage-modifiers, dice-modifiers, roll-modifiers, damage-alone, move-words), new src/hooks/use-follow.ts, src/utils/{lifecycle,pause}.ts | WS4 | L1 | 12, 13 | 14 h |
| 3 | **WS8 Sheet wiring** (U1) | features/sheet/components/{character-pane, sheet-tabs, favoriting, preparing, effect-controls, enchantments, concentration, charging, conditions-panel, description-actions, favorite-mark, wild-shape*}/**, features/sheet/hooks/**, features/sheet/{types,constants}.ts, src/mocks/sheet-providers.tsx | WS4 | L1 | 14 | 12 h |
| 3 | **WS9 Sheet parts** (U2) | the rest of features/sheet/** (rows, tabs' content, chips, menus, links, picker, tiles, prompt banner), features/sheet/utils/**, src/utils that only the sheet imports (sheet-actions, action-groups, casts, favorites, description-links, sheet commands' words, roll-mode, slot-words, uses, enchantments), new src/hooks/use-popover.ts | WS4 | L1 | 15 | 14 h |
| 3 | **WS10 Table** (V1) | features/table/** | WS4 | L1, build | 16 | 8 h |
| 3 | **WS11 Other UI** (V2) | features/{notes, party, companions, campaigns, characters, transfers, cookbook}/**, src/components/**, src/hooks/** (but use-follow, use-popover), src/constants/polling.ts, the remaining src/utils (seat-urls, initials (new), search, format-*, game-host, note-headings, …), src/app pages and layouts | WS4 | L1, build | 17 | 11 h |
| 3 | **integration** (orchestrator) | — | all of phase 3 | L1, build, **e2e full** | — | 2 h + 62 min |
| 4 | **WS12 Follow-ups** (F-a, F-b in parallel; then G) | by R1.9.5-.7 | integration green | L1, build, **e2e full**, metrics after | 18, 19, 20 | 3.5 h + 3.5 h |
| 5 | **Review** (RV1 server, wire, checks; RV2 rolling and sheet; RV3 table, other UI, tests, guards) and fixes (owners) | — | WS12 | L1, build | 21 | 3 h + 3 h |
| 6 | **Final** (orchestrator) | AE/README.md timings and counts, AE/lanes/lanes.conf seconds | review | `rebase -x`, C1 retired (Q4 (a)), **e2e full**, rerun round | 22, 23 | 3.5 h + repairs |

A src/utils file not named above goes to the lane whose features import it (RB placement.txt): server only → S, sheet only → U2, rolling → R, otherwise V2.

### §2.2 Ownership rules (R2.2.x)

1. **A lane edits only the files it owns** (the table above) and creates new files only under folders it owns, or as new files in a shared folder (`src/components`, `src/hooks`, `src/utils`, `src/constants`) named in its commit.
2. **Tests belong to their unit's owner.** A test that imports another lane's moved name keeps compiling through that lane's shim (§0.6.10); mocked modules don't move after Phase 2 (§0.6.11).
3. **A file → lane matrix before Phase 3.** The orchestrator lists every file §1 plans to edit with its lane (S/next24/owners.tsv); an edit a lane would make to another lane's file is a Phase 4 item (R1.9.5), never an ask across lanes. There are no hand-offs inside Phase 3: no cherry-picks, no "after h+2" dependencies.
4. **Conflicts are found early.** At h+4 and h+8 of Phase 3 the orchestrator runs `git merge-tree --write-tree` on every pair of lane branches; any conflict outside a shim's import line means the matrix was wrong: the edit leaves the lane and goes to Phase 4.
5. **Phase 4 builders own across folders**, split so F-a and F-b never touch the same file (R1.9.5); G owns everything after them.

### §2.3 Worktrees, locks, integration

1. **WS0 (orchestrator):** `git -C APP fetch origin && git -C APP rebase origin/main` on `claude/dazzling-dirac-m8cq54` (9ae1c44 over 81a8278, no conflict, fact 1); `npm ci`, `npx prisma generate`; L1 + `next build`; `npx jest --json --outputFile=S/next24/jest-base.json` (per test: `fullName`, `status`, `numPassingAsserts`; per suite: time); A's metric scripts and RB2 into S/next24/after-base/; commit 1 (§1.7 at `warn`; devDependencies at Q3 (a): `eslint-plugin-sonarjs` at an exact version two or more weeks old, `eslint-plugin-react-hooks@7.1.1`, `eslint-import-resolver-typescript@3.10.1`); the ratchet's base per folder into S/next24/ratchet-base.json.
2. **MOD for the e2e:** `git -C MOD fetch --tags` then `git -C MOD diff --stat 733e2a3 v0.42.1`; if it prints anything, `git -C MOD checkout --detach v0.42.1` for the life of the build. This is the only MOD command in v0.43 and changes no file the module ships.
3. **Worktrees (Phase 3):** `git -C APP worktree add -b local/043-<lane> /home/user/w043/<lane>/sending-stone-player <commit 6>` for S, W, R, U1, U2, V1, V2, each with `npm ci` and `npx prisma generate` (7 × 1.1 GB of 22 GB free). The old /home/user/w0421 worktree may be removed first (`git worktree remove`). Builders run no e2e and no server.
4. **Locks:** `flock S/next24/checks.lock` around every full jest, `tsc`, eslint or build anywhere (standing rule 16); L0 runs without it; nothing runs during a lane pass.
5. **Integration (end of Phase 3):** the orchestrator rebases the seven branches onto the integration branch in the order **W, S, R, U1, U2, V1, V2** (data and checks, server, rolling, the sheet, the table, the rest); L1 + build after each (≈ 6 min each). A conflict can only be a shim's import line (R2.2.4 found the rest earlier).
6. **The e2e runs from APP** (the integration checkout, so AE/env.sh finds MOD beside it): full lanes with AE/lanes/regress-lanes.sh as in past rounds, `BUILD=1` the first time after code changes; failed runs alone with `ONLY=<suite> flock -o e2e/.out/e2e.lock npm run e2e`. Each pass's oks per run are kept in S/next24/e2e/<pass>/ so a regression is attributed to a phase.

### §2.4 Workstream steps

**WS0 Base.** §2.3.1-.2, then the e2e full baseline (Mon, while T, C-a, C-b and M write).

**WS1 Kit and gates (T).**
1. `src/utils/test-utils.ts` (jsdom): `respond`, `advance`, `posted` (captures each `fetch(url, init)` whole), `normalizeIds(html)` (each distinct `_r_…_`, `_R_…_`, `«r…»` or `:r…:` id → `id-1`, `id-2` … by first appearance, references kept consistent), `atFixedTime()` (fake timers at a fixed date, for relative note times). `src/utils/test-utils-node.ts` (node): `prismaFake(rows)` (answers `prismaMock`'s model methods by model and `where` through `mockImplementation`, so read count and order are free), `guardNoDb()` (an `afterEach` that fails if any `prismaMock` model method was called), `routeCall(handler, { method, url, body, params })`. `src/mocks/sheet-providers.tsx`: `SheetProviders`, composing the real hooks by default (T11).
2. `guardNoDb()` as one setup line in the 24 route suites that don't use `prismaMock` (T12). A suite that fails it on today's code is reaching real db code now: it is left without the guard and listed in commit 2 and §4.4.
3. The gate scripts of §3.4 in S/next24/tools/ (not in the PR).
4. Gate: suites 290, tests 8,607, every base test with equal `numPassingAsserts` or more. Commit 2.

**WS2 Goldens (C-a, C-b).** §3.2's C1-C8 in src/__tests__/, using the kit. Each suite green on the unchanged code; a mutation spot-check per suite (a class inside a portal, a body key's order, a word, a Prisma write, a refusal header, an issue text, a stored string, a draw's pool): a named test fails, then reverted. Commit 3.

**WS3 Moves (M).**
1. The codemod (S/next24/tools/move.cjs, written during Phase 1): the TS LanguageService's `getEditsForFileRename` rewrites import, export, `require` and `import()` specifiers; **a second pass** rewrites the string arguments of `jest.mock`, `jest.requireActual`, `jest.requireMock` and `jest.doMock`, re-resolving relative ones (e.g. character-pane.test.tsx's `./dice-entry-dialog`) from each test's new folder (CS F18); then `git mv` keeps history.
2. Placement by §1.0 and RB placement.txt, the cycle-breaking moves of §1.0.3, the 27 barrels deleted, `needsPlayer`/`damageDue` moved with needs-player.test's mock (§0.6.11).
3. No content change but import lines and those two declarations; `git diff -M --stat` shows renames ≥ 90 %; gates; L1, build. Commit 4.
4. At Q2 (a): `unicorn/no-null` off with its reason and the 249 `unicorn/no-null` disable lines removed (comment lines only; `reportUnusedDisableDirectives` proves none still served another rule). L1. Commit 5.

**WS4 Seams (M).** R1.9.1 → .2 → .3 → .4, L1 after each; build. Commit 6. Then the e2e full pass on commits 4-6, while the lanes set up their worktrees and start writing (no checks until it ends).

**WS5 Server (S).** R1.3.1 → .2 → .10 → .8 → .6 → .5 with .9 → .7 → .3 → .4 → .11 (db/notes.ts last); L1 after each. Commits 7 (limits, command creator, switches), 8 (resolver, `NO_STORE`, readers, views, claim, router, reads), 9 (events, hello, roll path, complexity).

**WS6 Wire and checks (W).** R1.4.1 → .6 → .7 → .2 → .5 → .4 → .8 → .3 (commit 10; mock round-trip after .8) → .9 a kind group at a time with the full jest after each → .10 (commit 11).

**WS7 Rolling (R).** R1.2.1 → .5 → .2 → .3 → .6 → .7 → .9 (commit 12) → .4 → .10 → .8 → .11 (commit 13). Shims in roll-tray and use-table-rolls for every name another lane imports.

**WS8 Sheet wiring (U1).** R1.1.3 → .4 → .1 with .2 → .5 (the pane's names) → .6 for wild-shape.tsx and its own files → .9 for its functions. Commit 14.

**WS9 Sheet parts (U2).** R1.1.5 (`targetsFor`) → .6 file by file (action-entry, description-link, use-picker, action-info, then the rest of the 40) → .7 → .8 → .9. Commit 15.

**WS10 Table (V1).** R1.5.3 (verbatim moves first, then simplify) → .4. Commit 16.

**WS11 Other UI (V2).** R1.5.1 → .2 → .9 (primitives) → .5 → .6 → .7 → .8. Commit 17.

**WS12 Follow-ups and guards.**
1. F-a and F-b in parallel: R1.9.5-.6. L1, build. Commit 18.
2. G: the shim codemod (every `v0.43-shim` import rewritten to its target, shims deleted; gate 0).
3. G: unused exports (M15: 0), the 5 dead names, `export`s used only in their own file dropped (tests' imports kept, §0.6.5).
4. G: every §1.7 rule to `error`; `ban-ts-comment` on; use-notes.test.ts:254 rewritten without its directive (setup); lint exit 0 with no output. Commit 19.
5. G: A's scripts and RB2 rerun → S/next24/after/ and the PR's §0.4 table; the ROADMAP edit (§4.5). Commit 20.
6. Orchestrator, in parallel with 2-5: **the M17 replay**. On a scratch branch `local/043-m17` from commit 18 (never pushed, deleted after), re-make `prepare` as 4f5a73b + 79240fc made it, on the new tree; count production files and lines; the number and the file list go into the PR.

**Phase 5 Review.** RV1 commits 7-11 and 18's server part; RV2 12-15; RV3 1-6, 16-20. Findings fixed by the lane's builder. Commit 21.

**Phase 6 Final.** L3 (§2.6): `rebase -x` over commits 1-21; at Q4 (a) commit 22 deletes C1's suite and its snapshots; final e2e full and a rerun round of failed runs alone; commit 23 (bookkeeping); the PR (§7).

### §2.5 Commits in the PR (in order; each green alone)

| # | commit | workstream | what a reviewer checks |
|---|---|---|---|
| — | `ROADMAP: v0.42.1 released; v0.43 refactor and supported versions; v0.44 the table's feedback` (9ae1c44, rebased) | — | already reviewed |
| 1 | `chore(lint): import resolver and CLAUDE.md's rules, as warnings for now` | WS0 | config and devDependencies only; lint exit 0 |
| 2 | `test: a small test kit, the no-db guard in route suites (setup only)` | WS1 | no `expect` statement changed (gate 1); counts equal |
| 3 | `test: characterization goldens (markup, wire, composition, words, routes, refusals, storage, dice draws)` | WS2 | new files only; snapshots read as today's pages, bodies and headers |
| 4 | `refactor: features layout, component folders, cycle-breaking moves, barrels gone (moves only)` | WS3 | `git show -M --stat`: renames; import lines only |
| 5 | `chore(lint): unicorn/no-null off with its reason; its 249 disables gone` (Q2 (a)) | WS3 | comment lines and one config line |
| 6 | `refactor: cross-area seams (toast layout context, the pane's seat, onItsWay, ROLL_KIND_INFO)` | WS4 | C1 unchanged; derived lists equal the hand lists |
| 7 | `refactor(server): request limits and the db cycle gone, one command creator, feature switches` | WS5 | statuses, order, strip lists per kind |
| 8 | `refactor(server): one seat resolver, NO_STORE, body readers, views, claim read once, result router` | WS5 | 401 before 404; C5 unchanged; read-shape assertions listed |
| 9 | `refactor(server): event table, hello split, roll-path stages, complexity` | WS5 | same writes in the same transaction order |
| 10 | `refactor(wire): lenient helpers, die sizes, event schemas table, feature switches, ids, mock base, hand types checked` | WS6 | C6 unchanged; issue lists equal; mock round-trip |
| 11 | `refactor(checks): CHECKS by kind group, superRefine by kind, request views` | WS6 | refusal order per kind |
| 12 | `refactor(rolling): types and pure code out of the hooks, request builders, one lifecycle, state reducer, GM rolls, toasts` | WS7 | C2 unchanged; the hooks' API |
| 13 | `refactor(rolling): the tray one export per file, words per kind, dice entry moved` | WS7 | C4 unchanged; the #440 hold moved only |
| 14 | `refactor(sheet): the pane as composition, one command(), one actions object, one settle hook, Wild Shape split` | WS8 | `acts: false` for the two silent commands; ids |
| 15 | `refactor(sheet): one export per file; picker rules, link pills, one chip cluster, usePopover` | WS9 | classes and elements per row (C1) |
| 16 | `refactor(table): GameTable as composition, End Turn hooks, chat by kind` | WS10 | render-time state moved verbatim first |
| 17 | `refactor(ui): polling constants, seen query, shared primitives, journal, party, companions, campaigns, transfers, cookbook` | WS11 | query strings; URLs |
| 18 | `refactor: cross-area adoptions; the party's sheet context; strict input types from their schemas` | WS12 | tsc; C1, C2 unchanged |
| 19 | `chore(lint): CLAUDE.md's rules as errors; shims, unused exports and dead code gone` | WS12 | lint output empty; `git grep v0.43-shim` empty |
| 20 | `docs(roadmap): v0.43 done; bugs and checks for v0.44` | WS12 | §4.5's text |
| 21 | `fix: review findings (v0.43)` (one per area if more than a few) | review | each finding's id |
| 22 | `test: whole-page markup goldens retired` (Q4 (a)) | final | C1's files only |
| 23 | `e2e: v0.43 timings and counts (bookkeeping)` | final | AE/README.md and AE/lanes/lanes.conf only |

### §2.6 Checkpoint ladder and e2e passes

| level | when | what | cost |
|---|---|---|---|
| L0 | every edit | `npx jest --findRelatedTests <files> --maxWorkers=2` | s to ~1 min |
| L1 | every commit (under the lock) | full `jest --json` + §3.4's gates + `next typegen && tsc --noEmit` + `eslint .` (exit 0; ratchet) | ≈ 5 min |
| L2 | each phase end | L1 + `next build` + the phase's e2e pass where §2.1 names one | 10-70 min |
| L3 | before the PR | `git rebase -x '<L1>'` over commits 1-21 (each green alone, ≈ 1.8 h), final e2e full, failed runs alone | ≈ 3.2 h |

Five full passes (104 runs, ≈ 62 min each, `toasts` solo inside): the baseline (Phase 0), after the moves and seams (Phase 2), after integration (Phase 3), after the follow-ups and guards (Phase 4), and the final. No partial sets: every phase that changes code across areas ends with all 49 suites (CS F8). `RETRY=1` only on the final pass, and said in the PR.

---