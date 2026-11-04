# RESUME: v0.43, Phase 5 complete (checkpoint before Phase 6)

Updated 2026-11-04, about 2:50 AM EST, after Phase 5 (the three reviews and commit 25) landed.
Checked head: **0f32d24** (`chore(refactor): Phase 5 rolling-sheet fix report`) on
`claude/dazzling-dirac-m8cq54`; its src is commit 24's tree with G's fix 153834e and the three
commit 25 fixes (ca30667, 8fa4150, eaef5ba). This checkpoint's own commit changes only .refactor/.
(Earlier checkpoints: 1545a40 after Phase 4.1, 2026-11-03 ~10:45 PM EST; 66d5f4a/6e92666 after
Phase 4, 2026-11-04 ~1:25 AM EST.)

R = /home/user/sending-stone-player/.refactor. X = the scratchpad's v043 folder (brief.md). APP = the
checkout on the branch.

To resume: read R/brief.md, then R/round.md (amendments 1-6 at the top first), then this file.
After a container reset, rebuild the machine first (below). Then run the first step under "Left".

## Done

### Commits 1-25 (§2.5's numbers)

After commit 8 the commits sit on the branch in landing order: 12, 13, 14, 9, 10, 11, then 15-25
(amendment 5 (a)). Fix and follow-up commits sit beside their commit. Planning commits
(`chore(refactor): …`) are left out here.

| # | SHA | by | subject, short | beside it |
|---|---|---|---|---|
| 1 | 1dff83f | WS0 | lint: import resolver, CLAUDE.md's rules as warnings | |
| 2 | 4e7b8ec | T, with W-a's table | test kit, no-db guard, TZ, values golden (C9), request-kind table | |
| 3 | eb533bd | C-b | goldens: wire, composition, routes, refusals | |
| 4 | 929c797 | C-a | goldens: markup, words, storage, dice draws | |
| 5 | f7eb1a5 | M | features layout, a folder per component, no barrels (moves only) | |
| 6 | fd2c34d | M | unicorn/no-null off, its 250 disables gone | 51e82f8 restores the node kit's directive (fd2c34d is red alone on gate 10; amendment 2 (b)) |
| 7 | 3255abf | M | export moves | |
| 8 | 63c5cc3 | M | seams (onItsWay, polling, useFollow, useSendChoice, NOT_MADE) | Phase 2 review fixes 9c694f1, 064a76b, 299d979 |
| 9 | d264d9a | S | server: db cycle, one command creator, kind-table switches, throttles | |
| 10 | e88b05a | S | server: seat resolver, NO_STORE, body reader, result router, types | |
| 11 | f7d3890 | S | server: event table, hello split, roll path in stages | fix 8088279 |
| 12 | a3b222f | W-a | wire: lenient helpers, die sizes, event schemas table, types home | |
| 13 | 2365911 | W-a | wire: the kind table read; rollRequestSchema's rules by group | fix 410051c |
| 14 | 38a17b5 | W-b | checks by kind group, views, mock base | 5ec922f (its moves.d), fix f1bde09 |
| 15 | e173ffc | R-a | rolling core: one lifecycle, builders, reducer, GM rolls, roller split | fix 71cef6c |
| 16 | ef3507a | R-b | rolling tray: one export per file, words, toasts, dice entry | fix ac31d37 |
| 17 | 4114094 | U1 | sheet: the pane as composition, command(), settle hook, Wild Shape split | aae075d (type-only), fix c9b5be3 |
| 18 | 64172b6 | U2 | sheet parts: one export per file, picker rules, chips, usePopover | fix bba5753 |
| 19 | 61de31a | V1 | table: GameTable as composition, TurnToast, tracker, End Turn hooks | fix c2ca691 |
| 20 | 983b4b4 | V2 | other UI: seen query, icon buttons, journal, party, companions … | fix f4b17f1 |
| 21 | 2abfc20 | F-a | popovers, roll labels and chips adopted across areas | report a7831f8 |
| 22 | 5c56ff7 | F-b | seat URLs, the table's seen query and header button adopted | report 711a5bc |
| 23 | 00709e2 | G | lint: CLAUDE.md's rules as errors, layered imports, an import-cycle test; dead code and unused exports gone | tools 938efea (gate 10/11 allowances), 6b8aff8; fix 153834e |
| 24 | a8377ca | G | docs(roadmap): v0.43 done; bugs and checks for v0.44 (metrics after: R/analysis/metrics-after.md) | metrics re-taken 00d330c; report b40b6f0 |
| 25 | ca30667, 8fa4150, eaef5ba | Phase 5 fixers | `fix: review findings (v0.43, server / table-ui / rolling-sheet)`, one per area (§2.5 row 25) | reports 99c31c9, 72befcc, 0f32d24 |

- **Phase 3 (amendment 5).** The nine lanes (S, W-a, W-b, R-a, R-b, U1, U2, V1, V2) were built,
  reviewed and fixed, then integrated in §2.3.7's order with no rebase conflict and no integration
  fix commit. L1 and `next build` were green after each landing. The integrated head ac01b2c had
  316 suites, 9,726 tests, 114 eslint warnings and 0 cycle groups.
- **Phase 4.1 (F-a, F-b).** Both built in parallel from 680d60e, reviewed, and landed with L1 and
  build green at each rebased commit. FA-1, FA-2, FB-1 and FB-2 done; FA-3 "listed" (no file
  changed). eslint 114 → 108 warnings.
- **Phase 4.2 (G).** Commits 23-24 were built, reviewed (RV-G-1 major, fixed in 6b8aff8; four minor)
  and landed at b40b6f0: L1 green on every check and gates 1-12 (318 suites, 9,727 tests; eslint 0
  warnings, every CLAUDE.md rule at error; 0 cycle groups), `next build` green. Amendment 6 accepts
  the gate 10/11 allowances and the disable totals (34 in all, 13 react-hooks, each with its
  reason; the PR states both).

### Phase 5: the review and commit 25 (R/tools/wf-phase5.js, ~1:30 to ~2:45 AM EST)

- **Three reviewers** (round.md §2.4's Phase 5 row) read the branch at 6e92666 (src = commit 24 +
  153834e), edited nothing, and ran the goldens and their area's suites in APP under the shared
  lock. Every run was green, with 1,001 snapshots matched and 0 written. None found a behaviour
  change, a blocker or a bug the refactor introduced, and none added to bugs-found.md. Their
  reports are R/reports/RV1.md, RV2.md and RV3.md (copied from X in this checkpoint).

  | reviewer | read (§2.5 numbers) | its runs | findings |
  |---|---|---|---|
  | RV1 | server, wire, checks: 9-14 and 22 | 166 suites, 5,955 tests; eslint over the area clean | 4: RV1-1 major (documentation only); RV1-2, RV1-3, RV1-4 minor |
  | RV2 | rolling, sheet: 15-18 and 21 | 124 suites, 5,214 tests; the cycle test; eslint clean | 3: RV2-1 major; RV2-2, RV2-3 minor |
  | RV3 | table, other UI, tests, guards: 2-8, 19-20, 23-24 | 212 suites, 4,765 tests (goldens 991); `eslint .` clean; G's sweep and zone probes ok | 6: RV3-1 major; RV3-2 to RV3-6 minor |

- **The skeptics** (one per review) tried to refute each major finding. All three held as real:
  - **RV1-1: real, lowered to minor.** The deviation was already recorded in
    R/reports/phase3-S-W-a.json (8c4c2e0, the builder's deviation 1 and its reviewer) and in
    e88b05a's message. What was missing was S.md's final deviations list and metrics-after.md:278,
    which feeds the PR's metrics table.
  - **RV2-1: real, lowered to minor.** None of the eight helpers is exported (CLAUDE.md §2 holds),
    map U2 §2 names only effectDetail, and each is one to seven lines with one reader.
  - **RV3-1: real, major kept.** src/mocks/sheet-providers/ (R3.5's SheetProviders, about 400
    lines) has had no importer at any commit from 2 to the head. G's sweep skipped it because it is
    frozen. It is unused code (CLAUDE.md §9, §1), and commit 23's subject says dead code is gone.
- **The fixes:** one fixer per area, each in its own worktree from 6e92666, landed in the order
  server, table-ui, rolling-sheet. Each rebase was clean and left the diff byte-identical, and
  L1 and `next build` were green at each rebased commit. No landing fix round was needed.

  | area | fixer SHA → branch SHA | fixed | answered, no code change | landing L1 (0 red, 0 flaky; gates 1-12 ok; 0 cycle groups) | report |
  |---|---|---|---|---|---|
  | server | ca30667 → ca30667 (the base had not moved) | RV1-3 in code; RV1-1 in R/ docs; RV1-4 by its option (b), a ROADMAP line | RV1-1's round.md amendment line (the orchestrator's) | 317 suites, 9,727 tests; eslint 1,159 files, 0 errors, 0 warnings | 99c31c9 |
  | table-ui | 24a687b → 8fa4150 | RV1-2 = RV3-3, RV3-2, RV3-5 | RV3-1, RV3-4, RV3-6 | 317, 9,727; 1,163 files, 0, 0 | 72befcc |
  | rolling-sheet | 443530b → eaef5ba | RV2-1, RV2-2, RV2-3 | none | 317, 9,727; 1,165 files, 0, 0 | 0f32d24 |

  Suites went 318 → 317 because RV1-3 deleted src/utils/roll-requests.test.ts after moving its two
  tests, titles and describe paths kept, into src/utils/requests/ (gate 2 still finds all 8,607
  base tests). No test file changed otherwise, and no golden, assertion or mocked path changed.
  The build route table was the same at every landing.
- **bugs-found.md.** No new bug. The table-ui and rolling-sheet fixers appended path updates for
  B7 and B8 (their helpers moved verbatim to utils.ts files). These were uncommitted in APP and are
  committed with this checkpoint. ROADMAP names no path for either.
- **Results files committed with this checkpoint:** R/reports/RV1.md, RV2.md, RV3.md (copied from
  X), R/reports/phase5.json (the workflow's summary: the skeptics' verdicts, the fixers' answers,
  the landings, and the fixer → branch SHA map), and R/bugs-found.md's two notes.

### e2e passes (R/analysis/e2e/)

All four ran 104 runs over 49 suites, `BUILD=1`, with RETRY off. No pass ran after Phase 5: the
final pass is Phase 6's (pass 5).

| pass | at | first try | rerun alone | wall | record |
|---|---|---|---|---|---|
| 1, baseline | commit 1's tree (1dff83f) | 104/104 | none needed | 59m02s | base.md (2d84cfa) |
| 2, after commits 5-8 | 9589546 (src = 63c5cc3) | 103/104: notesoffline (base) 43/47 | 47/47 | 61m00s | pass2.md (15e82cb) |
| 3, after integration | 680d60e (src = the integrated Phase 3 tree) | 103/104: endturn (base) 23/73 | all 4 endturn runs green | 57m22s | pass3.md (89f6884) |
| 4, after commits 21-24 | 66d5f4a (src = commit 24 + 153834e) | **104/104** | none needed | 59m29s | pass4.md |

Both failures were the environment, not the product. Pass 2: a `bridgePolledAt` race under three
lanes' load. Pass 3: no animation frame was sampled in the 560-640 ms window of part 8, at 768 px.

### The checkpoint at 0f32d24: green

- **L1:** `R/tools/l1.sh X/l1/checkpoint-5 APP`, 07:43:30 to 07:47:23 UTC. 0 failed.
  - jest: 317 suites, 9,727 tests, 0 red, 0 flaky, 0 suites that did not run.
  - typegen ok. tsc ok, 0 errors.
  - eslint: 1,165 files, 0 errors, 0 warnings.
  - Gates 1, 1b, 2-12 all ok. Gate 1: 5,665 tests in 290 base test files and 10 frozen ones.
    Gate 2: all 8,607 base tests. Gate 3: 317 suites (base 290), 9,727 tests (base 8,607), 1,120
    new. Gate 9: 0 warnings against ratchet-moved.json. Gate 10: 991 golden tests, 24 frozen files
    held. Gate 11: 843 modules, 172 server modules (base 161), 21 client boundaries. Gate 12: 0
    cycle groups (4 at base).
  - The tree it ran on is 0f32d24's plus this checkpoint's .refactor/ files (eslint ignores
    `.refactor/**`, and no gate reads them).
- **`next build`:** in APP under `flock X/l1-wait.lock flock X/checks.lock`, at 0f32d24, 07:47:24
  to 07:47:53 UTC. Exit 0. Its route table equals F-b's landing build and the rolling-sheet
  landing build, timings aside. It prints the same environment-only messages as every earlier
  build: 6 each of Better Auth's "Base URL is not set" and default-secret messages, and 6 Prisma
  "Environment variable not found: DB_URL". No DB_URL or auth secret is set in this environment.

## Phase 5 findings

All 13 findings, with what became of each. "Fixed" SHAs are the branch's.

| id | severity (reviewer → skeptic) | area | what | outcome |
|---|---|---|---|---|
| RV1-1 | major → minor | server | R1.3.4's resolver is `seatAnswer` alone (getPlayerSeat beside getGmSeat in db/seats.ts, partyAt in party-routes.ts); the four companion finders stay because the frozen companion-routes.integration.test calls them. S.md's deviation list left it out, and metrics-after.md:278 said the helpers went. | Documented in ca30667: S.md deviation 5 and :109, metrics-after.md:278, phase4-items.md P-5. No round.md amendment line: that is the orchestrator's (below). |
| RV1-2 | minor | table-ui | two exported `partyApi`s with different signatures; F-b imported one as `playerPartyApi` | Fixed in 8fa4150 with RV3-3: FT/utils/party-urls.ts's pair is `seatPartyApi`/`seatPartyPage`; the alias is gone. |
| RV1-3 | minor | server | src/utils/roll-requests.ts kept three helpers only src/utils/requests/ used (G-24, WB-2) | Fixed in ca30667: checkDamageDice → check-damage.ts; isSeatCombatant, sheetUses → checks.ts; the two tests moved with them; moves.d/W-b.tsv follows; the file and its test deleted. G-24 is done. |
| RV1-4 | minor | server | the roll path's pure rules (rollGate, lacksFeature, combatOf, rollPayload, with companionRefusal and namesAloneChoices) sit in db/roll-requests.ts; db/table.ts and db/notes.ts likewise | Answered by the finding's option (b): a ROADMAP v0.44 item 9 bullet, "Rules in the database modules" (ca30667). Option (a) would also move RollRejection (src/db/types.ts, 8 importers) and the Prisma-derived RollCampaign out of src/db (zone 4), and R1.3.9/R1.3.11 put the stages there. |
| RV2-1 | major → minor | rolling-sheet | eight pure helpers file-private in sheet .tsx: effectDetail, foundOf, preparedCount, fromNote, factsOf, originName, initials, keyTarget | Fixed in eaef5ba: each moved verbatim to the utils.ts beside its component (new: spells-tab/utils.ts, sheet-entry/utils.ts, no directive). `initials` keeps B8's first-code-unit behaviour and is not src/utils/initials.ts. |
| RV2-2 | minor | rolling-sheet | file-private type `Effecting` in use-spent-removals.ts | Fixed in eaef5ba: FS/hooks/types.ts, beside Spending (type-only). |
| RV2-3 | minor | rolling-sheet | GM_WORDS and GM_WORDS_AFTER in FR/utils/gm-words.ts, read by three files | Fixed in eaef5ba: FR/constants.ts (§1.0 rule 8). |
| RV3-1 | major (kept) | table-ui | src/mocks/sheet-providers/sheet-providers.tsx and types.ts (frozen, commit 2) are imported by nothing; types.ts repeats PaneTable and PaneRoller | Answered: deleted in commit 26. Gate 10 fails when a frozen file is gone without a counts.conf `retire` row, and R/tools is the orchestrator's. The fixer's dry run with two retire rows had gates 1, 2, 3 and 10 ok and no count change. |
| RV3-2 | minor | table-ui | four pure helpers in V1/V2 components: formatTime (local-time, B7), initial (avatar, B8), countWords (campaign-index), randomSecret (campaign-setup-form) | Fixed in 8fa4150: moved verbatim to a utils.ts beside each. |
| RV3-3 | minor | table-ui | = RV1-2 | Fixed in 8fa4150. |
| RV3-4 | minor | table-ui | eslint.config.mjs's `'.refactor/**'` ignore outlives commit 28 | Answered: commit 28's job. Until then the ignore must stay, or `eslint .` (L1, gate 9) lints R/'s 77 scripts at error. |
| RV3-5 | minor | table-ui | src/__tests__/import-cycles.test.ts found the repo from `process.cwd()` (ENOENT when run from src/) | Fixed in 8fa4150: `expect.getState().testPath`. `__dirname` fails unicorn/prefer-module. The assertion is unchanged. |
| RV3-6 | minor | table-ui | C1 pins CreatureSwitcher's tabs mode only, not avatars mode, though §3.2's C1 list for V2 names both | Answered: no code change (C1 is frozen and retires in commit 26). A PR note (below). |

**Answered instead of fixed** (5): RV1-4 (a ROADMAP line, not the move), RV1-1's amendment line
(left to the orchestrator; the docs were fixed), RV3-1 (commit 26), RV3-4 (commit 28), RV3-6 (a PR
note).

**For the orchestrator, before Phase 6's commits** (none of these is written yet):
- **Amendment 7** recording Phase 5: commit 25 is three commits, one per area; RV1-1's R1.3.4
  deviation accepted (S.md's deviation 5 can be pasted); RV3-1's two files join commit 26's
  deletion (amend §3.1.1, §3.4 gate 10 and counts.conf's header, which say C1, C3 and C9 are the
  only deletion); RV3-4's ignore line joins commit 28 (§2.5 row 28's check becomes ".refactor/ and
  its eslint ignore").

**Minor findings and notes left for the PR** (§7; phase4-items.md's P-1 to P-5 hold the rest):
- **The goldens note (RV3-6):** "C1 (commit 4) pins CreatureSwitcher's tabs mode only, not avatars
  mode (a deviation from §3.2's C1 list for V2). creature-switcher.test.tsx (:356-419) and e2e
  companions (part 2b) hold avatars mode."
- **RV3-1:** commit 26 also deletes the unused SheetProviders kit (src/mocks/sheet-providers/, two
  files), which no golden or test ever imported; its PaneTable/PaneRoller copies go with it, and
  character-pane/types.ts keeps its own. Name the deletion and say whether the kit's `markup()` and
  `normalizeIds()` stay once C1 retires (test-utils.test.ts is then their only user).
- **RV1-1:** P-5 already carries "Commit 10 (R1.3.4; Phase 5, RV1-1)".
- **RV1-4:** the ROADMAP v0.44 line belongs in the PR's follow-ups (§7 item 5).
- **Commit 25's SHAs:** the fixers' reports cite their own SHAs: server ca30667 (unchanged),
  table-ui 24a687b → 8fa4150, rolling-sheet 443530b → eaef5ba (as P-1 maps the lanes').
- **Left as they are (no finding raised, by design):** file-private helpers in dice-entry-dialog.tsx
  (R1.2.11 moved it only), the DOM helper keepFocusIn (recharge-chip.tsx), description-html.tsx's
  draw/cellProps/attributesOf and entry-icon's isSvg (U2's), and damage-modifiers.ts's file-private
  Part and FormulaGroup (G-23, optional).
- **eslint.config.mjs** keeps one warn-level rule from the base, `react/jsx-max-props-per-line`
  (not a CLAUDE.md rule; prettier makes it moot; 0 warnings). RV3 suggested raising it to error
  only if commit 25 touched the config, which it did not.
- **owners.tsv** is a record, not a gate (amendment 6 (c)). The six new utils.ts files of commit 25
  have no row, and rows 634-635 (src/utils/roll-requests{,.test}.ts) are history. No action:
  commit 28 removes it.

## Left, in order

1. **Phases 4 and 5: done** (commits 21-25, e2e pass 4 green, this checkpoint green).
2. **Phase 6: final**, commits 26-28 and the PR. **No workflow script exists for it yet**: write
   R/tools/wf-phase6.js from round.md §2.4's Phase 6 row, as wf-phase5.js was written.
   - **Contract:** round.md §2.4 (its Phase 6 row), §2.5 rows 26-28, §2.6 (L3 and pass 5) and §7
     (the PR). Amendment 7 first (above).
   - **The L3 replay:** `R/tools/replay.sh` (no args: after 1dff83f, up to the branch head), which
     takes the L1 locks per commit itself. It walks every commit that is not `chore(refactor)`: 41
     at 0f32d24 (commits 2-24, their fix commits, and the three commit 25 fixes). At 4-5 minutes
     an L1 that is about 3 h (§2.6 said 2.5 h for fewer commits). It writes X/replay/<n>-<sha>/ and
     X/replay/summary.tsv; copy the summary into R/ (X is scratch). A commit red alone is fixed
     forward in a new `fix: review findings (v0.43, …)` commit, and the replay runs again from it
     (`replay.sh <the commit before it>`); history is never rewritten. The PR names every commit
     red alone and what fixed it. Expected: fd2c34d, red alone on gate 10 when it landed, is ok
     under today's tools (gate 10's allowance, 6b8aff8; G's note for amendment 4 (d)).
   - **Commit 26** (`test: refactor-only goldens retired (markup, composition, values)`): C1
     (markup.golden.test.tsx and its .snap), C3 (composition) and C9 (values.golden.test.ts and its
     .snap) deleted, with counts.conf's `retire` rows. With amendment 7, also RV3-1's two
     sheet-providers files (two more retire rows; owners.tsv rows 670-671 marked deleted). G-19:
     EFFECT_DICE_KINDS (src/constants/sending-stone.ts) is read only by C9 and goes with it. G-25
     (COMPANION_UNTAKEN through `kindsWhere`) may follow (optional). Decide markup() and
     normalizeIds(). L1 and `next build`.
   - **e2e pass 5, the final:** `RETRY=1` (the PR says so), `BUILD=1`, under the three locks in the
     background, then a round of reruns alone (`ONLY=<suite> BUILD=0 npm run e2e`, same locks) for
     any failure. Record it as R/analysis/e2e/pass5.md, diffed against base.md.
   - **Commit 27** (`e2e: v0.43 timings and counts (bookkeeping)`): e2e/README.md's timings and
     counts, and lanes.conf's seconds from times.tsv. Those two files only.
   - **Commit 28** (`chore(refactor): the planning folder removed`): .refactor/ removed, and with
     amendment 7 the `'.refactor/**'` ignore and its comment in eslint.config.mjs (RV3-4), then
     `npx eslint .` again. Before it, have in hand everything the PR body needs from R/: the
     reports, metrics-after.md, phase4-items.md's P-1 to P-5, this file's Phase 5 findings, the
     replay summary and pass5.md.
   - **The PR** (§7): the title, and the body's six items, with P-1 to P-5 and the Phase 5 notes
     above.

## Rebuilding the machine after a reset

These are brief.md's steps and base.md's "Environment set up". None of them changes an app or
module file.

1. **The checkout.** APP on `claude/dazzling-dirac-m8cq54`, fetched and at
   `origin/claude/dazzling-dirac-m8cq54`. Run `git worktree prune`, since the old worktrees are gone.
2. **Postgres 16.** Start it with `service postgresql start` (/etc/postgresql/16/main, port 5432).
   Make the role local/docker-compose.yaml makes, if it is missing:
   `create role admin with login superuser createdb password 'password'`, as the `postgres` user.
3. **The module.** /home/user/fvtt-sending-stone, main 94773cb (v0.42.1), clean. Never edit it. In
   it, run `npm ci` and `npm run test:setup`, which fetches dnd5e 5.3.3 and 6.0.5 into .cache/dnd5e/.
4. **The app.** In APP, run `npm ci` and `npx prisma generate`.
5. **Chromium 1194.** Run `npm run e2e:browsers` in APP. Playwright 1.56.1 wants build 1194 in
   /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH).
6. **The scratch folder and the jest base.** `mkdir -p X`, then run `R/tools/base.sh`. It
   regenerates X/base from 24f808b: X/jest-base.json is gone, so it runs jest in a detached
   worktree at 24f808b (with `npm ci`, since package-lock changed in commit 1) under the L1 locks,
   then removes the worktree. l1.sh also calls base.sh first, so the first L1 does this itself if
   it was skipped.
7. **For e2e only.** From APP, `export
   E2E_DATABASE_URL=postgresql://admin:password@localhost:5432/postgres
   SENDING_STONE_MODULE=/home/user/fvtt-sending-stone`, with DND5E5_DIR and DND5E6_DIR unset, then
   `mkdir -p e2e/.out`. On a machine with no e2e databases yet, the first pass's build can fail
   with Prisma P1003. Stop it once the lanes are up, and start it again.

## Open decisions and known flakes

- **Amendments 1-6 (round.md's head) are binding.** Amendment 7 (Phase 5) is to be written (above).
- **phase4-items.md.** F-a's and F-b's items are done (FA-3 listed). G did G-1 to G-22 but G-19,
  which waits for commit 26 (EFFECT_DICE_KINDS goes with C9). G-12 and G-13 were decided "not
  done" (the PR notes the decisions). G-24 was done in commit 25 (RV1-3). G-23 and G-25 to G-30
  are optional and not done; G-25 can follow commit 26. FA-R1 is done, and FA-R2 is in ROADMAP's
  questions. P-1 to P-5 are text for the PR.
- **Disables:** 34 in all, 13 react-hooks line disables, each with its reason (amendment 6 (b)).
  The PR states both totals and lists them (metrics-after.md §7).
- **bugs-found.md has 34 entries** and, from Phase 5, two path-update notes (B7, B8; no new bug).
  20 entries are §4's from planning; the other 14 are tooling, process and test notes. No product
  bug was fixed. G wrote them into ROADMAP in commit 24 (R1.9.29); B20 is the exception (§4.4).
- **Known flakes.** Each was red once and green on its rerun alone. A red test or run is rerun once
  alone before it is called a regression.
  - jest: note-lines.test.tsx's ChapterLine `ago(0)` case races the clock, about once in 200 L1s
    (at base; amendment 4 (e)).
  - jest: character-pane.integration.test.tsx's "Bardic Inspiration … refused" `waitFor`. It was
    red once in V2's fix L1 and green on its rerun.
  - e2e: notesoffline (pass 2), its `bridgePolledAt` race.
  - e2e: endturn part 8 at 768 px (pass 3), the fill's frame sampling.

## Nothing lives outside the branch

- **On the branch.** Every result and tool is on `origin/claude/dazzling-dirac-m8cq54` under R/: the
  contract, owners.tsv, phase4-items.md, the reports (the Phase 5 reviews and fixes included), the
  e2e records, the gate scripts and the workflow scripts.
- **X is scratch.** It holds the locks, the L1 output folders and the jest base. A reset loses it,
  and it is regenerated (step 6 above), so nothing in X is the only copy of a result.
- **R/patches/ is history.** It holds snapshots of builder work that has since landed. Nothing in
  it is unlanded.
- **Local worktrees are disposable.** The three Phase 5 fixer worktrees,
  /home/user/w043/fix-{server,table-ui,rolling-sheet}/sending-stone-player (branches
  `local/043-fix-<area>`), are clean and landed, as ca30667, 8fa4150 and eaef5ba. Remove them
  before Phase 6 makes its own: `git -C APP worktree remove /home/user/w043/fix-<area>/sending-stone-player`,
  then `git -C APP branch -D local/043-fix-<area>`. After a reset, `git worktree prune` is enough.
  The replay makes and removes its own detached worktrees under /home/user/w043/replay/.
