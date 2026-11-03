# v0.43: dispositions of the critique (2026-11-03 ~1:30 AM EST)

Builders: you need round.md, not this file (its first paragraph says how to read it). This file says,
for each finding of the three critiques of the draft (a527cfc), whether the planner accepted it, in
part or not, why, and where round.md and owners.tsv changed. Every finding was re-checked in the code at
HEAD cc228fc (src equal to 24f808b's); the checks that matter are round.md §0.5 facts 24-36.

**Totals:** 35 findings (safety 6 major + 8 minor, value 4 + 6, completeness 2 + 9): 30 accepted, 5 in
part, 0 rejected. No finding argued against the plan's shape, and none needed a decision the user had
not made; the one question left (the value critic's) is round.md §9. owners.tsv: 886 → 905 rows (22
added, 3 removed), 244 `-` rows.

## Safety (critique-safety.md)

| id | sev. | disposition | why | where the plan changed |
|---|---|---|---|---|
| SA F1 | major | accepted | Confirmed: roll-modifiers.test.ts:41-55's `.each` table holds the expected message outside the `expect`; expectRefusal and UNAVAILABLE (commands/route.test.ts:63-79) live outside any test; tests read POLL_INTERVAL 113× and CHECK_EVERY 95×. Gate 1 and gate 2 see none of it. | gate 1b (the whole test file, normalized, its docblock first): §3.4, §0.2.2, §3.1.1-2. C9 values and fixtures golden (T, commit 2): §3.2, owners.tsv row. C9 is retired in commit 26 with C1 under Q4's rule (it only proves nothing changed): §0.6.17. §5 #27. |
| SA F2 | major | accepted | Confirmed (fact 36): the src/types cycle runs through TableMoves, TableRoll, GroupEntry, GroupSheet, TransferMoved, RemovedItem, which every lane imports; R1.4.8's `z.output` in src/types would break zone 2. | The 8 crossing types move in 2b with destinations chosen now (R1.9.1 rule (3)); R1.4.9 keeps only ParsedContainer and NOTE_ID; R1.4.8 annotates schemas and moves nothing; gate 7 also flags a re-export of any moved name; §1.0 rule 5; owners.tsv's src/types rows; §5 #28. |
| SA F3 | major | accepted | Confirmed: counts.conf and moves.tsv were shared, lane-blind inputs, and gate 10 failed commits 2-3 in the replay by construction. | Gate 3 derived from the checkout; per-lane `moves.d/<lane>.tsv` applied only when its target exists; gates apply from the commit that makes them meaningful (`n/a` before) and always come from APP's current R/tools; the PR names every commit red alone: §3.4, §2.6 L3, §2.5 heading, §0.2.7, §0.6.15, §7.3; owners.tsv moves.d row; §5 #29. |
| SA F4 | major | accepted | Confirmed: jest's `ci` is ci-info's `isCI`, false here (fact 27), so an L0 without `--ci` writes missing snapshots; Phase 1 had five builders and Phase 4 three in APP's one tree. | A worktree per builder in every phase; hand-offs as uncommitted copies; the orchestrator lands each commit (rebase, L1 at the rebased commit, ff, push): §0.2.8, §0.6.16, §2.3.3-4; `--ci` on every jest run: §2.6, §3.1.6; §2.1, §8; §5 #30. brief.md needs the matching lines (below). |
| SA F5 | major | accepted | Confirmed: gate 10 saw only snapshots, and sheet-providers.tsx was U1's in Phase 3 with its type in W-b's file. | Gate 10 freezes the kit, dice-renderer.ts, sheet-providers/ and the golden files from the commit that adds each, imports aside; SheetProviders and its type in src/mocks/sheet-providers/ (T, frozen); a lane keeps the sheet hooks' signatures SheetProviders composes: §2.2.6, R3.5, owners.tsv rows; R1.2.12 split (see CO F2); §5 #31. |
| SA F6 | major | accepted | Confirmed (fact 24): a test file's `process.env` is jest's copy, so `TZ` set there does nothing; this machine is UTC, the user's Eastern, so C4 would fail on the user's `npm test`. | `process.env.TZ = 'UTC'` at the top of jest.config.ts with its reason (T, commit 2; B19 in the same file untouched): §0.6.18, §1.7.2, owners.tsv jest.config.ts row; normalizeTimes also over text, noteTime at mid-day: R3.1, R3.6, C4; §5 #17. |
| SA F7 | minor | in part | Confirmed: TS's Move to file copies `'use client'` into a new target (fact 26); header-account.tsx imports `@/lib/session` (fact 34); 63 node suites start with their docblock. Accepted: the directives gate, export-move stripping copies, a build at every lane's end, rule 6 corrected, docblocks in gate 1b. Not taken: adding lib/session to zone 1 with header-account as the exception, because a path zone cannot tell a Server Component from a client one; instead gate 11 checks header-account keeps its side. Checking this found zone 6 itself would have failed on header-account at commit 23: it gets a file-scoped override with its reason. | §1.0 rules 6 and 9, R1.9.1, gate 11, §2.1 (every lane builds), §3.1.2, §1.7.4 zone 6, R1.5.21; §5 #32. |
| SA F8 | minor | accepted | Confirmed: R3.3's `requireActual('@/mocks/dice-renderer')` names a module no test imports; the use-notes mocks leave out `draftChanged`; turn-toast.test.tsx:11 is a full mock. | Gate 4 exempts `requireActual` targets from its closure clause; gate 4b (a full-replacement factory must define every value name the closure imports from it; base cases allowlisted); turn-toast retargeted with a spread: §3.4, R1.9.3, §1.8.3; §5 #33. |
| SA F9 | minor | in part | Confirmed: the module reads JSON only with `application/json` (fact 35); the e2e reads data-leaving, data-gm, data-accent, data-kind, data-key, data-mode, child structure and classes. Accepted: all of it into §1.8.1, C5 snapshots every header, e2e-surface.mjs extended (C-a, Phase 1). Not taken: pasting its output into the PR body, which would bury the body; RV3 reviews against it instead. | §1.8.1, R1.3.5, R1.3.10, C5, §2.4 WS2. |
| SA F10 | minor | accepted | Confirmed (fact 25): pretty-format sorts keys unless `compareKeys` is null. | `ordered()` in the kit; storage values as raw strings; C3, C5, C7 use it; risk 1 and §1.8.2 restated (row key order is not observable: jsonb). |
| SA F11 | minor | accepted | Confirmed (fact 30): `metadata` ×5, `viewport`, `generateMetadata` ×4 have no importer; route-exports.txt lists only route.ts; the 15 Server Actions had no gate. | R1.9.27 skips src/app special files and `'use server'` modules; gate 6 covers pages, layouts, not-found, manifest and both actions modules; §5 #34. |
| SA F12 | minor | accepted | Confirmed: reruns took only e2e.lock; L0 ran unlocked beside L1s on 4 CPUs. One change to the fix: flock gives no writer priority, so a stream of shared L0s could starve an L1; a wait lock held by every L1 keeps new L0s out. | Lock recipes (wait, checks, e2e, in that order), reruns under all three, a red test rerun once alone before it is called a regression: §2.3.6, §2.3.8, §2.6; §5 #35. |
| SA F13 | minor | in part | Confirmed: the re-take after commit 5 absorbs new warnings, and `src/<top>` makes all features one bucket. Accepted: the re-take is accepted only with equal rule totals (but no-restricted-paths and filename-case, deltas in commit 5's message), and the unit becomes `src/features/<feature>`. Not taken: a per-file ratchet, because a split moves a file's warnings into new files with no base; each lane's report maps its react-hooks findings to base or new instead. | Gate 9, §1.7.1, §2.4 WS3; §5 #36. |
| SA F14 | minor | accepted | Confirmed (fact 26): TS exports a shared helper from the old file and imports it into the target, the opposite of what R1.9.1 said, which makes a runtime cycle with the source's imports of the moved names. | export-move computes closures itself; gate 12 (no new cycle group, type-only included) in every L1: R1.9.1, §3.4, §1.0.1; §5 #37. |

## Value (critique-value.md)

| id | sev. | disposition | why | where the plan changed |
|---|---|---|---|---|
| VA F1 | major | accepted | Re-checked with the critic's probes A and B (fact 29): `ref={refs.setFloating}` reports `react-hooks/refs`, the destructured setter doesn't; a ref object is stable, so no timing changes. | usePopover returns `setReference`/`setFloating` (R1.1.16, R1.9.20); Wild Shape's components destructure `heading`/`body` (R1.1.5); HoldFill destructures `fill` (R1.5.11); one target for every disable, ≤ 30 in all (≤ 23 of today's kinds, ≤ 7 react-hooks): §0.3, §0.4, §0.6.7, §1.7.2-3, §7.5; §5 #26. |
| VA F2 | major | accepted | Q4 keeps the wire, words, route, refusal, storage and dice-draw goldens; composition is none of them and reads React's fiber. | C3 retired in commit 26 with C1; its view JSON cases written in C2: §0.6.17, C2, C3, R3.10, §2.5 row 26, §2.4 Phase 6, owners.tsv golden rows; §5 #16. |
| VA F3 | major | accepted | Confirmed (fact 31): the 42 test findings are in 7 suites. | The three rules off only for those suites by a `files:` list with its reason (and roll-requests.test's `useRequest` pieces after R1.4.6): §0.6.6, §1.7.3, §0.4. |
| VA F4 | major | accepted | Confirmed: NOTHING_READ, SIDE_BY_SIDE, MOST_PANES, NO_KINDS, NO_ROW have one reader each; NO_KEYS has 5 reads in one file. CLAUDE.md §3 and §4 say keep one-use values local. | §1.0 rule 8 (constants go with their readers; to constants.ts only with two readers or as domain configuration); the lists in R1.1.4, R1.1.17, R1.2.1, R1.2.8, R1.5.2, R1.5.8, R1.5.16 now defer to it; §0.3; §0.6.19. |
| VA F5 | minor | accepted | Confirmed (fact 32): the 14 send* differ in gate, body field and order, kept fields and label; only the 9 gates are copies. One refinement: `takes` is a module-level pure function of `latest.current`, so no callback's deps change. | PLAIN_KINDS and sendPlain dropped; `takes({ kinds, on }, kind)`: R1.2.3 (3 h → 2 h), §0.6.3, §0.6.20, §1.6, §0.8, §1.10. |
| VA F6 | minor | accepted (drop) | Confirmed (fact 33): the four save titles differ in input, DC, fallbacks and words; the shared part is a two-branch ternary over different label sources. Of the critic's two options the planner took "drop": a no-option helper would still need each caller's label logic. | R1.1.19 and R1.9.21 not done, §1.10 near copies; C4 still pins the four outputs; save-title rows removed from owners.tsv; §2.5 rows 18 and 22; §1.11; F-b 2 h → 1.5 h; U2 16 h → 15.25 h. |
| VA F7 | minor | accepted | CLAUDE.md §4 colocates; `__tests__` is a private folder; gate 6 reads only route files. | `<route folder>/__tests__/route.integration.test.ts`: §0.6.9, §1.0 tree, §3.3, the 12 owners.tsv rows. |
| VA F8 | minor | accepted | The two class constants cover about 10 of the 34 icon-only buttons (the critic's count, not re-counted). | §0.8 item 3; §7.5 lists the 34 for v0.44 item 3. |
| VA F9 | minor | accepted | Confirmed (fact 28): import-x's no-cycle skips `import type`; graph.mjs goes with .refactor/ in commit 28. | src/__tests__/import-cycles.test.ts (G, commit 23): R1.9.28, §0.3, §0.4, §1.7.3, §3.1.3, gate 12, owners.tsv row; G 3.5 h → 4 h. |
| VA F10 | minor | accepted, extended | M's day held R1.6, the gate scripts and both codemods, the codemods being the least tested estimate on the critical path. The gates then grew by SA F1, F3, F7, F8, F11, F13, F14, so W-a takes both R1.6 and the gate scripts (≈ 7 h), and M only the codemods (≈ 6.5 h). | §2.1 (WS1b W-a, WS1c M), §2.4, §1.6 heading, §0.6.3, §3.4 heading, §5 #25, owners.tsv tools and roll-kinds rows, §8. |
| VA "to the user" | — | carried to round.md §9 | Whether work may start before the user's review is the user's call; the decisions don't cover it. Default: wait for the go. | §9, §8's last paragraph. |

## Completeness (critique-completeness.md)

| id | sev. | disposition | why | where the plan changed |
|---|---|---|---|---|
| CO F1 | major | accepted | Confirmed against maps U1 (G-U1b, G-U1d), U2 (G1-G5), V1 (the C1 state list) and V2 (C-route). Placement by §0.6.17: markup and timing-in-markup cases to C1 (retired); bodies to C2 and page answers to C5 (kept). U2's G1-G3 are pinned as the requests they make, not as callback JSON, so what stays tests behaviour, not an internal interface. | C1, C2, C5 in §3.2; the pins of R1.1.1, R1.1.2, R1.1.12-R1.1.16, R1.5.5-R1.5.8; §5 #6-#8, #41, #42; C-a and C-b 5 h → 8.5 h each. |
| CO F2 | major | accepted | Confirmed: R1.2.12 was R-b's item over R-a's use-table-rolls.ts:843 and 11 R-a rows. | R1.2.12a (R-a, commit 15) and R1.2.12b (R-b, commit 16); §2.4 sequences; §1.11; owners.tsv rows by lane (R-a and R-b product rows with hook findings cite their part). |
| CO F3 | minor | accepted | Confirmed: db/cookbook.ts:305-308 and db/note-sync.ts:606-609, :635-638 were in no sequence. | R1.3.14 takes R1.9.6's server sites (commit 9); R1.9.6; §2.4 S; owners.tsv rows for both files and the party page (R1.5.19); S 18.25 h → 18.5 h. |
| CO F4 | minor | accepted | Confirmed for rolling; while fixing it the planner found U1's, U2's and V2's split folders also only partly covered. | 15 rolling rows (incl. use-follow.test, use-send-choice.test), U1's two glob rows, U2's glob extended to its other split folders, V2's glob row: owners.tsv; R1.9.4. |
| CO F5 | minor | accepted | Confirmed: avatar.tsx:3, copy-button.tsx:7, sign-in-buttons.tsx:17 `type Props`; four S rows lacked R1.3.12. | R1.5.21 and R1.3.12 name them; owners.tsv rows. |
| CO F6 | minor | accepted | Confirmed: no `4` rows, six phases short, seven duplicate groups, :667's R1.4.9. | Phase 4 rows with the builder in the item (`R1.9.20(F-a)` …); phases fixed; duplicates merged (the "moved in 2b" rows kept, the glob rows narrowed to Phase 3's new files); src/mocks/types.ts R1.4.10 only; §2.2.5. |
| CO F7 | minor | accepted | Confirmed: use-sheet-roller.ts:86's CHECKS had no adopting item. | R1.2.7; §1.6 `check` row and readers line. |
| CO F8 | minor | accepted (as §1.10 lines) | Both maps called them optional and low value; the seat pair is two one-line hook calls each site reads its own way, and the latest-value ref's copies differ in timing across four lanes. | §1.10 "small copies a hook would only hide". |
| CO F9 | minor | accepted | The eleven map risks were dropped in the draft. | §5 #38-#48. |
| CO F10 | minor | in part | Q2 belongs in ROADMAP's questions: added. B20 does not: R1.9.3's move removes its cause (a harness change, gate-2 neutral), so nothing is left for v0.44; it is named in the PR's bug list as found and removed, and gate 4b keeps the kind out. | §4.5's questions line, §4.4, §4 intro, §7.4. |
| CO F11 | minor | in part | Moved as the map says: party-sheet.test (page, panel, sheet together) and journal-modal.test (card, modal, store). Kept, with the reason written: use-transfers.test is one hook under renderHook, a unit suite (T.8's call was wrong); give-controls.test stays under transfers, whose controls are its subject, though it renders GameTable. | §0.6.9, §3.3 (41 → 43 integration suites), R1.5.12, owners.tsv rows. |

## Other changes made while revising (not from a finding)

- **The e2e baseline is done** (2d84cfa: 104 of 104, 59 min, no rerun): §0.1, §0.4, fact 22, §2.1, §2.3.1,
  §2.6, §8; pass results now go to R/analysis/e2e/<pass>.md as the baseline's did (owners.tsv row).
- **Zone 6 and header-account.tsx** (found while checking SA F7): zone 6 as drafted (`src/components` not
  from `src/lib`) would have errored on src/components/site-header/header-account.tsx:5 at commit 23; it
  is the only such edge, and it gets a file-scoped override with its reason (§1.7.4).
- **R1.2.1** said R-a moves R-b's component types: now R-b does in its own items (§1.2).
- **Gate 1b's allowlist** names R3.3's 18 dice-renderer factories and R1.9.3's retarget, which change a
  factory body (§3.4).
- **§2.3 renumbered** (2.3.1-2.3.8) and references updated; the timeline re-made from now (§8): the PR at
  about Thu Nov 5, 11:00 PM EST, 2 h later than the draft's, or about Thu 3:30 PM if §9's answer is yes.

## brief.md lines the orchestrator should change (this commit touches only the three planning files)

1. "before Phase 3 everyone works in APP" → every builder works in its own worktree from Phase 1 on; only
   the orchestrator writes in APP and lands commits (round.md §2.3.3-4).
2. "In APP, push each green commit at once" → builders push nothing; the orchestrator lands (rebase, L1 at
   the rebased commit if the base moved, ff, push) in §2.5's order.
3. Locks: L0 is `flock X/l1-wait.lock true && flock -s X/checks.lock npx jest --ci --findRelatedTests
   <files> --maxWorkers=2`; every full jest, tsc, eslint and build is `flock X/l1-wait.lock flock
   X/checks.lock …`; an e2e pass and every rerun take wait, checks and e2e locks in that order (§2.3.6).
4. Every jest run passes `--ci`; a golden's author writes its snapshots once with `--ci=false` over its
   own files only (§3.1.6).
5. A test red in an L1 is rerun once alone before it is called a regression; flakes go in the report.
