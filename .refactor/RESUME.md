# RESUME: v0.43, checkpoint after Phase 4.1

Written 2026-11-03, about 10:45 PM EST (03:45 UTC on Nov 4). Checked head: **1545a40**
(`chore(refactor): builders work in progress (snapshot)`) on `claude/dazzling-dirac-m8cq54`. Its
tree outside .refactor/ equals commit 22's (5c56ff7). The commit that adds this file sits on
1545a40 and changes only `.refactor/RESUME.md`.

R = /home/user/sending-stone-player/.refactor. X = the scratchpad's v043 folder (brief.md). APP = the
checkout on the branch.

To resume: read R/brief.md, then R/round.md (amendments 1-5 at the top first), then this file.
After a container reset, rebuild the machine first (below). Then run the first step under "Left".

## Done

### Commits 1-22 (§2.5's numbers)

After commit 8 the commits sit on the branch in landing order: 12, 13, 14, 9, 10, 11, then 15-22
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

- **Phase 3 (amendment 5).** The nine lanes (S, W-a, W-b, R-a, R-b, U1, U2, V1, V2) were built,
  reviewed and fixed, then integrated in §2.3.7's order (W-a, W-b, S, R-a, R-b, U1, U2, V1, V2). No
  rebase conflict, no integration fix commit. L1 and `next build` were green after each landing.
  The integrated head ac01b2c had 316 suites, 9,726 tests, 114 eslint warnings and 0 cycle groups.
  680d60e then brought owners.tsv up to the tree and added phase4-items.md and amendment 5.
- **Phase 4.1 (F-a, F-b).** Both were built in parallel from 680d60e, reviewed, and landed with L1
  and build green at each rebased commit.
  - F-a: FA-1 (usePopover at five popovers) and FA-2 (rollOf in rollAgainst) are done. FA-3 is
    "listed": no favorites site has byte-equal markup, so no file changed. The review found two
    minor items and no fix commit was made. Both items went to G (FA-R1, FA-R2 below).
  - F-b: FB-1 (seenQuery in tableQuery) and FB-2 (seat URLs, HEADER_ICON_BUTTON) are done.
  - eslint went from 114 to 108 warnings: the six react-hooks/refs findings in move-menu,
    sheet-settings and return-popover are gone.

### e2e passes (R/analysis/e2e/)

All three ran 104 runs over 49 suites, `BUILD=1`, with RETRY off.

| pass | at | first try | rerun alone | wall | record |
|---|---|---|---|---|---|
| 1, baseline | commit 1's tree (1dff83f) | 104/104 | none needed | 59m02s | base.md (2d84cfa) |
| 2, after commits 5-8 | 9589546 (src = 63c5cc3) | 103/104: notesoffline (base) 43/47 | 47/47 | 61m00s | pass2.md (15e82cb) |
| 3, after integration | 680d60e (src = the integrated Phase 3 tree) | 103/104: endturn (base) 23/73 | all 4 endturn runs green | 57m22s | pass3.md (89f6884) |

Both failures were the environment, not the product. Pass 2: a `bridgePolledAt` race under three
lanes' load. Pass 3: no animation frame was sampled in the 560-640 ms window of part 8, at 768 px.

### The checkpoint at 1545a40: green

- **L1:** `R/tools/l1.sh X/l1/checkpoint-4.1 APP`, 03:42:05 to 03:45:23 UTC. 0 failed.
  - jest: 316 suites, 9,726 tests, 0 red, 0 flaky, 0 suites that did not run.
  - typegen ok. tsc ok, 0 errors.
  - eslint: 1,154 files, 0 errors, 108 warnings. By rule: 46 no-restricted-syntax, 25
    react-hooks/rules-of-hooks (all in tests), 16 react-hooks/refs, 12 import/no-restricted-paths,
    5 react-hooks/set-state-in-effect, 3 react-hooks/globals and 1 react-hooks/exhaustive-deps.
  - Gates 1, 1b, 2-12 all ok. Gate 2: all 8,607 base tests. Gate 9: 108 against
    ratchet-moved.json. Gate 10: 991 golden tests, 24 frozen files held. Gate 12: 0 cycle groups
    (4 at base).
  - The same L1 first ran at 711a5bc (03:37:27 to 03:41:02 UTC) with the same result. The snapshot
    commit 1545a40 landed during that run. It changes only R/patches/ and R/analysis/conflicts.md,
    which no gate reads, so the L1 was run again at 1545a40.
- **`next build`:** in APP under `flock X/l1-wait.lock flock X/checks.lock`, at 1545a40, 03:41:11
  to 03:41:25 UTC. Exit 0. Its 53 route-table lines equal F-b's landing build. It prints the same
  environment-only messages as the lane and landing builds: 6 each of Better Auth's "Base URL is
  not set" and default-secret messages, and 6 Prisma "Environment variable not found: DB_URL". No
  DB_URL or auth secret is set in this environment.

## Left, in order

1. **Phase 4.2: G**, commits 23 and 24, then e2e pass 4.
   - **Contract:** round.md §1.9 R1.9.26-.30, the WS12 row of §2.4, and §2.5 rows 23-24. G's items
     are phase4-items.md's G-1 to G-30, plus the G items in amendments 1 (c), 2 (b) and 4 (c), plus
     FA-R1 and FA-R2.
   - **Commit 23:** `chore(lint): CLAUDE.md's rules as errors, layered imports, an import-cycle test;
     dead code and unused exports gone`. This covers R1.9.26-.28.
   - **Commit 24:** `docs(roadmap): v0.43 done; bugs and checks for v0.44`, with R1.9.29 (ROADMAP,
     §4.5) and R1.9.30 (`sh R/analysis/metrics/run.sh after` into R/analysis/metrics-after.md, and
     §0.4 filled).
   - **e2e pass 4:** §2.6 and §2.3.8, recorded in R/analysis/e2e/pass4.md.
   - **Run:** the workflow R/tools/wf-phase4.js with args `{"stage":"g"}`. It builds G in
     /home/user/w043/G/sending-stone-player from the branch head, runs a review and one fix round,
     lands the commits (L1, build, fast-forward, push), then runs e2e pass 4 and updates this file's
     "Done" and "Left". With `{"stage":"g","noE2E":true}` the workflow stops after the landing, and
     the orchestrator runs pass 4 (brief.md's E2E environment).
   - **Before it starts,** remove the F-a and F-b worktrees (§2.3.3; see the last section).
2. **Phase 5: review**, commit 25.
   - **Contract:** round.md §2.1 (the Phase 5 row), §2.4 (its Phase 5 row) and §2.5 row 25.
   - **The work:** RV1 reads commits 9-14 and 22. RV2 reads 15-18 and 21. RV3 reads 2-8, 19-20 and
     23-24. Each checks against the contract (surface, test policy, ownership) and runs the goldens.
     The lane's builder fixes each finding in a worktree from the branch head, or G fixes it when it
     crosses areas. The fixes are commit 25, `fix: review findings (v0.43)`, one per area if there
     are more than a few.
   - **Script:** not written yet. Write R/tools/wf-phase5.js from §2.4's Phase 5 row, in
     wf-phase4.js's shape (build, review, fix, land). §8 runs the L3 replay under the lock while the
     review reads.
3. **Phase 6: final**, commits 26-28 and the PR.
   - **Contract:** round.md §2.4 (its Phase 6 row), §2.5 rows 26-28, §2.6 (L3 and pass 5) and §7
     (the PR).
   - **The L3 replay:** `R/tools/replay.sh` over commits 2-25, about 2.5 h, writing
     X/replay/summary.tsv. A commit that is red alone is fixed forward in commit 25, and the replay
     runs again from it. The PR names every such commit.
   - **Commit 26:** C1, C3 and C9 retired, with counts.conf's retirement line. G-6, G-19 and G-25
     go here if G left them.
   - **e2e pass 5:** the final pass, `RETRY=1` (the PR says so), then a round of reruns alone for
     any failure.
   - **Commit 27:** e2e/README.md's timings and counts, and lanes.conf's seconds from times.tsv.
   - **Commit 28:** .refactor/ removed.
   - **The PR:** §7's body, with phase4-items.md's P-1 to P-5.
   - **Script:** not written yet. Write R/tools/wf-phase6.js from §2.4's Phase 6 row.

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

- **Amendments 1-5 (round.md's head) are binding.** These G items come from them:
  - 1 (c): commit 23 checks for zero cycle groups. Gate 12 already finds 0.
  - 2 (b): the node kit's no-null directive (src/utils/test-utils-node.ts:83) and its
    eslint.config.mjs block are removed together, with a gate 10 allowance in R/tools for that one
    comment line. wf-phase4.js's G task names all three.
  - 4 (c): imports that leave their feature or reach a shared layer use `@/` paths. This is a
    codemod over import lines only.
  - 4 (e): note-lines' `ago(0)` row goes into ROADMAP as a v0.44 tooling line (§4.4).
- **phase4-items.md.** FA-1, FA-2, FA-3 (listed), FB-1 and FB-2 are done. Still open:
  - G-1 to G-7: moves of names other lanes import.
  - G-8 to G-13: decisions G makes before commit 23.
    - G-8: SocialProviderId.
    - G-9: CampaignStatus and LastHeard. If G splits them, the orchestrator must first give gate 11
      an allowance.
    - G-10: creature-switcher's directives.
    - G-12: useFollow.
    - G-13: `due`.
  - G-14 to G-22: config, directives, small moves, dead code, ROADMAP and zero cycles.
  - G-23 to G-30: optional.
  - P-1 to P-5: text for the PR.
  - From F-a's report:
    - FA-R1: type usePopover's onOpenChange as floating-ui's `UseFloatingOptions['onOpenChange']`,
      so RollsButton's parameters can be inferred again. This is type-only.
    - FA-R2: one line for ROADMAP or the PR: "favorites' resource and check rows not on
      UsesChips/RowName: would change markup".
- **The react-hooks disable budget is full**: 7 of the ≤ 7 that §1.7.3 allows. G-11's findings must
  be fixed, not disabled.
- **bugs-found.md has 34 entries.** 20 are §4's from planning. The other 14 are tooling, process
  and test notes from Phases 1-3. No product bug was fixed. G re-checks each one at the head and
  writes them into ROADMAP in commit 24 (R1.9.29). B20 is the exception (§4.4).
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
  contract, owners.tsv, phase4-items.md, the reports, the e2e records, the gate scripts and the
  workflow scripts.
- **X is scratch.** It holds the locks, the L1 output folders and the jest base. A reset loses it,
  and it is regenerated (step 6 above), so nothing in X is the only copy of a result.
- **R/patches/ is history.** It holds snapshots of builder work that has since landed. Nothing in
  it is unlanded.
- **Local worktrees are disposable.** /home/user/w043/F-a and /home/user/w043/F-b (branches
  `local/043-F-a` and `local/043-F-b`) are clean and already landed, as 2abfc20 and 5c56ff7.
  Remove them before G's worktree is made:
  `git -C APP worktree remove /home/user/w043/<label>/sending-stone-player`, then
  `git -C APP branch -D local/043-<label>`. After a reset, `git worktree prune` is enough.
