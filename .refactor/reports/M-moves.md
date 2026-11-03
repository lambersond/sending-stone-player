# Report: builder M, WS3 Moves, fix round 1 (v0.43, Phase 2a): commits 5 and 6

This is fix round 1 for the moves landing. The landing L1 at 08e5a87 failed gates 9 and 10.

- **Status:** gate 10 is fixed on the branch, by commit 8e12352. Gate 9 is not fixable by any commit on the branch (READ FIRST).
- **This round returns ok: false,** because the L1 with APP's tools is not all green (gate 9 alone). The branch is ready to land as soon as APP has ratchet-moved.json: with that file in place, every L1 check and gate is green on 8e12352 (next build was not run this round; see "next build").
- **Nothing pushed.** In APP, the only write was one line appended to R/bugs-found.md, under bugs.lock.
- **The earlier report** for this workstream (commits 5 and 6, the ratchet re-take, the no-null removal) is kept below this round's part. Its SHAs are updated to their names after the landing rebase, and three short notes mark what this round changed.

## READ FIRST, orchestrator and lander: one step in APP before the landing L1

**Gate 9 cannot go green from this branch.** No commit on local/043-M can fix it. It needs one file in APP.

- **Why:** gate-lib.mjs:17 sets `ANALYSIS = <the tools' folder>/../analysis`. With APP's l1.sh that is APP's R/analysis, never the checkout's. Gate 9 reads `ratchet-moved.json` from there as soon as the tree has src/features.
- **Where the file is now:** only in this branch's chore(refactor) commit 718fee6. It reaches APP only when the branch lands, which needs a green L1 first.
- **The step, under `flock X/git.lock`, before the L1:**
  1. `git -C /home/user/sending-stone-player checkout local/043-M -- .refactor/analysis/ratchet-moved.json`
  2. Commit it by pathspec, as "chore(refactor): the moved lint ratchet in APP for gate 9", with the trailers. Push.
  3. Then the usual rebase. 718fee6 adds the same file with the same bytes, so the rebase applies it cleanly.
- **Justification:** round.md §3.4, gate 9: "Base: ratchet-base.json, then ratchet-moved.json taken after commit 5". The file is gate 9's ratchet, taken on commit 5 under gate 9's conditions (earlier report below). It is not product code and not an allowlist.
- **Proof that this is the only thing left:** with that file beside a scratch copy of APP's tools, gate 9 is ok on this branch's head (see "L1" below).

This failure is not an allowlist row, so the lander's step (1) as written cannot apply it. The orchestrator must make this step, or widen the lander's step (1) to cover it.

## Commit (fix round 1)

| SHA | subject |
|---|---|
| 8e12352 | chore(lint): the node test kit's no-null directive restored; the rule on for it alone |

The branch now holds, in order:
- 7682f9b refactor: features layout, a folder per component, barrels gone (moves only)
- 718fee6 chore(refactor): the lint ratchet re-taken after the moves; commit 5's moves recorded
- 08e5a87 chore(lint): unicorn/no-null off with its reason; its 250 disables gone
- 8e12352 chore(lint): the node test kit's no-null directive restored; the rule on for it alone (this round)

The base is APP's 6b3c581. The rebase at the start was a no-op ("up to date").

## Gate 10: fixed on the branch

### What was wrong

Commit 6 removed the node test kit's line directive, src/utils/test-utils-node.ts:83:

```
// eslint-disable-next-line unicorn/no-null -- Prisma answers null where no row matches
```

- The kit is frozen from commit 2 (round.md §2.2.6). Gate 10 holds it to 4e7b8ec's text, except for import lines and jest paths.
- That directive is not one of R1.0.2's 250. Those were counted at 24f808b, and the kit came later, in commit 2.
- So removing it broke §2.2.6. The fix is to put it back.

### The fix

1. **The line is restored, byte for byte.** `git diff 4e7b8ec -- src/utils/test-utils-node.ts` is now empty.
2. **The rule stays on for that one file.** With unicorn/no-null off, the restored directive would suppress nothing. ESLint 9 reports such a directive as unused by default, and that warning (`(no rule)` in src/utils) would fail gate 9 against ratchet-moved.json. So one config block in eslint.config.mjs, after the `**/*.ts` block, keeps the rule on for that file alone:

```
  // The node test kit is held unchanged through the v0.43 refactor, its one unicorn/no-null
  // line directive included, so the rule stays on for that file alone (else the directive
  // would be reported as unused):
  {
    files: ['src/utils/test-utils-node.ts'],
    rules: { 'unicorn/no-null': 'error' },
  },
```

- `error` is the severity the rule had before commit 6 (unicorn's recommended set).
- The file lints exactly as it did at commit 5: the directive is used, and there are 0 problems.
- This silences nothing. It turns a rule *on* for one file, with the reason beside it (CLAUDE.md §9).

### Why not the gate-10 patch proposed earlier

The earlier report asked for a tools patch (X/handoff/m-gate10-no-null.diff) so gate 10 would drop no-null directives. That is an APP change, which the lander may not make. The branch fix above:
- keeps the kit literally frozen (§2.2.6);
- needs nothing in APP;
- leaves the lint totals unchanged.

The patch is no longer needed for commit 6.

### Left for Phase 4

- Once the kit may change, the directive and this config block can go together. That is a kit change, so per §2.2.6 it is a Phase 4 item, and gate 10 would need an allowance for it.
- Until then, the directive counts as one of Q2's "about 30" line-level disables. It has a reason.

## L1

### With APP's tools

Outdir: X/l1/M/fix1, 10:48:06-10:53:55 UTC. The run was on the working tree, before the commit; the commit holds exactly that tree (status clean after it).

- **Checks:**
  - jest ok: 301 suites, 9,664 tests, 0 red, 0 flaky, 0 suites that did not run;
  - typegen ok;
  - tsc 0 errors;
  - eslint 0 errors, 981 warnings, the same as at commit 6.
- **Gates ok:**
  - 1, 1b, 2, 3, 4, 4b, 5, 6, 7, 8;
  - 10: 991 golden tests, 24 frozen files held (it FAILed at the landing);
  - 11: 351 modules, 146 server modules (base 161), 17 client boundaries;
  - 12: 4 cycle groups, the same as the base.
- **Gate FAIL:** 9 only: "no /home/user/sending-stone-player/.refactor/analysis/ratchet-moved.json (taken after commit 5)". See READ FIRST.

### Gate 9 with the ratchet in place

- **Setup:** a scratch copy of APP's R/tools and R/analysis at /tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/m2/fix1-next. The only difference from APP (`diff -rq`) is the added `analysis/ratchet-moved.json`, taken from 718fee6. node_modules and tsconfig.json are symlinked from the worktree.
- **Input:** the same L1's eslint.json, in outdir X/l1/M/fix1-next.
- **Result:** `gate 9 ok (981 warnings, 0 errors, against ratchet-moved.json (981 warnings))`.

### The block is needed

`npx eslint --rule 'unicorn/no-null: off' src/utils/test-utils-node.ts` (under the L0 locks) reports:

```
83 Unused eslint-disable directive (no problems were reported from 'unicorn/no-null')
```

That is a warning with no rule, which gate 9 would count against src/utils. With the block, the two changed files lint with 0 problems.

## next build

Not run in this round. Neither changed file reaches the build:
- `next build` no longer runs linting in Next 16 (node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:1084);
- src/utils/test-utils-node.ts is imported only by tests (62 test files, no product file).

The lander runs `next build` at the landing, as its step (3) says. The last build, on commit 6 in the earlier round, exited 0 (below).

## Deviations from round.md (this round)

1. **One kit file keeps unicorn/no-null on.** Q2 (a) turns the rule off everywhere. The frozen kit (§2.2.6) keeps its one line directive, so the rule stays on for that one file. The reason is in the config.
2. **Commit 6's count:** 253 directives are now gone, not 254. That is R1.0.2's 250, plus the three goldens' whole-file directives. Those three are leading comments of each golden's first import, which gate 10 cuts with that import, so gate 10 is ok on them, and Q2 allows no whole-file directive. The kit's line directive is back.

## Bugs

- **App:** none found.
- **Tooling:** one follow-up line was appended to R/bugs-found.md, under bugs.lock, in the "[M] Moves and no-null" section. It says that the gate-10 note there is now settled on the branch. The gate-9 note there still stands, and the step above resolves it.

## For later workstreams

- **WS4 (M, commits 7 and 8):** start from APP's head after landing. Gate 9 needs ratchet-moved.json in APP for every L1 from here on.
- **Phase 3 lanes, and G in commit 23:** eslint.config.mjs has one file-scoped block that keeps unicorn/no-null on for src/utils/test-utils-node.ts. Leave it while the kit is frozen.

---

# Earlier round: builder M, WS3 Moves (v0.43, Phase 2a): commits 5 and 6

This is the report of the first round, as written then, with the SHAs updated to their names after the landing rebase onto 6b3c581:
- 35e65ee is now 7682f9b;
- d57e010 is now 718fee6;
- 1e6612d is now 08e5a87.

What happened to its READ FIRST items:
- **Item 1** (gate1b.allow rows): done in APP, 6b3c581.
- **Item 2** (ratchet-moved.json in APP): still needed. It is this round's READ FIRST.
- **Item 3** (gate-10 patch): no longer needed. This round's commit fixes gate 10 on the branch.

- **Worktree:** /home/user/w043/M/sending-stone-player, on local branch `local/043-M`. It was rebased onto APP's head 75e9303 before any work.
- **Nothing pushed.** Nothing was written in APP except the append to bugs-found.md, made under bugs.lock.
- **Scratch:** /tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/m2/ holds:
  - logs: move.out, move.err, l1-c5.out, l1-c6b.out, build.log, runsh.out;
  - scripts: no-null.cjs, rule-totals.mjs, warn-diff.mjs;
  - the proof run: eslint-proof.json, unused-lines.txt, directive-lines.txt;
  - next/: a copy of APP's R/tools and R/analysis with the three planned additions below.

## Commits on local/043-M (to land in this order)

| SHA | subject |
|---|---|
| 7682f9b | refactor: features layout, a folder per component, barrels gone (moves only) |
| 718fee6 | chore(refactor): the lint ratchet re-taken after the moves; commit 5's moves recorded |
| 08e5a87 | chore(lint): unicorn/no-null off with its reason; its 250 disables gone |

## READ FIRST, lander: three things APP needs before the landing L1

With APP's tools as they stand, the landing L1 cannot be all green: gates 1b, 9 and 10 fail for planning reasons, not code. I ran the same gates with all three additions applied, in a scratch copy of APP's R/tools and R/analysis (scratchpad m2/next/). At commit 5 and at commit 6, gates 1b, 9 and 10 are all **ok**. Every other check and gate is already ok with APP's tools.

### 1. gate1b.allow: two rows (amendment 1 (d), planned)

These are ready to append, in X/handoff/m-gate1b-rows-commit5.tsv:

```
src/components/character-sheet/prompt-banner.test.tsx	file	-	R1.0.1 (commit 5): line 151 reads its unit's source by repo path (readFileSync); move.cjs set the path to the moved file (amendment 1 (d))
src/utils/end-turn.test.ts	file	-	R1.0.1 (commit 5): line 255 reads its unit's source by repo path (readFileSync); move.cjs set the path to the moved file (amendment 1 (d))
```

- Reason: each test reads its unit's source by repo path, and that path string follows the move.
- Without these rows, gate 1b reports exactly these two lines and nothing else.

### 2. R/analysis/ratchet-moved.json must be in APP (gate 9)

- **Why:** gate-lib.mjs's `ANALYSIS` is APP's R/analysis, not the checkout's. Gate 9 therefore reads `ratchet-moved.json` from APP. That file arrives only with my chore(refactor) commit 718fee6, so any L1 with APP's tools on a moved tree fails gate 9 with "no …/ratchet-moved.json".
- **Do this:** `git -C /home/user/sending-stone-player checkout local/043-M -- .refactor/analysis/ratchet-moved.json`, then commit it with the allowlist rows.
- The rebase then merges 718fee6's identical add cleanly.
- **Justification:** round.md §3.4, gate 9: "ratchet-moved.json taken after commit 5".

### 3. gate-10.mjs: a 4-line patch (X/handoff/m-gate10-no-null.diff; `git apply --check` passes in APP)

- **What fails:** R1.0.2 removes every unicorn/no-null directive. One of them is a line in the frozen kit, src/utils/test-utils-node.ts:83.
- **Why gate 10 fails:** its `frozenText` drops only import declarations and jest paths. The three goldens' whole-file directives pass only because they are leading trivia of the first import, which is cut with it.
- **What the patch does:** it drops `unicorn/no-null` directives (and nothing else) from both sides.
- **Justification:**
  - round.md §3.4, gate 10: "no change but gate 1b's dropped lines", and gate 1b drops comments.
  - §3.1.2 lists "a removed eslint directive" as a setup change.
  - R1.0.2: the directives removed.
  - Q2 (a): none covering a whole file.
- **Why the directive cannot just stay:** a directive left in place becomes an "Unused eslint-disable directive" warning once the rule is off. ESLint 9 reports unused directives by default. That warning would fail gate 9 in every later L1.
- **The patch:**

```
+  // R1.0.2 (commit 6): a unicorn/no-null directive removed is a setup line (round.md §3.1.2).
+  out = out
+    .replace(/^[ \t]*(?:\/\*|\/\/) eslint-disable(?:-next-line)? unicorn\/no-null\b.*(?:\n|$)/gm, '')
+    .replace(/[ \t]*\/\/ eslint-disable-next-line unicorn\/no-null\b.*$/gm, '')
```

- **Effect on the replay:** none for commits 2-5. Their frozen files still hold the directive, so it is dropped from both sides.

**Note:** ratchet-moved.json's `commit` field says 35e65ee, commit 5's SHA before landing. The landing rebase will give commit 5 a new SHA. Gate 9 does not read that field.

## Commit 5 (R1.0.1): the moves

### How

- I ran `node APP/.refactor/tools/move.cjs --root <worktree> --owners APP/.refactor/owners.tsv --check-ts 3`. It took 446 s, the eslint import-format fix under the locks included.
- **Barrels:** NotesPlace went first to src/features/notes/types.ts. Then the 27 barrels were removed, and 102 import lines and mocks were pointed at their modules.
- **Moves:** 325 files moved, with 926 specifiers rewritten in 282 files.
- **Path strings:** two path strings followed their files: prompt-banner.test.tsx:151 and end-turn.test.ts:255.
- **Lint fix:** 303 files, 0 errors left.
- **`--check-ts 3`:** on all 3 sampled moves, TypeScript's getEditsForFileRename gave the same edits.
- **`--verify`:** 405 files compared, **0 differ** beyond imports and paths. Every @jest-environment docblock is still first.

### `git show -M --stat`

- 431 files.
- **326 renames:** all 325 moves, plus notes/index.ts detected as renamed to features/notes/types.ts. Similarity runs from R087 to R100; 102 are at R100 and 80 at R099.
- **26 deletions:** the other barrels.
- **79 modified:** importers that stay where they are.
- Nothing outside src. moves.tsv went to 718fee6.

### L1 with APP's tools

Outdir: X/l1/M/c5, 09:57-10:04 UTC.

- **Checks:**
  - jest ok: 301 suites, 9,664 tests, 0 red, 0 flaky;
  - typegen ok;
  - tsc 0 errors;
  - eslint 0 errors, 981 warnings.
- **Gates ok:**
  - 1, 2, 3, 4, 4b, 5, 6, 7, 8, 10;
  - 11: 351 modules, 146 server modules (base 161), 17 client boundaries;
  - 12: 4 cycle groups, the same as the base.
- **Gates FAIL:**
  - 1b: only the two path strings (row 1 above);
  - 9: no ratchet-moved.json in APP (item 2 above).
- **With the additions** (scratch m2/next, outdir X/l1/M/c5-next): gates 1b, 9 and 10 ok.

## The ratchet re-take (718fee6, chore(refactor))

### Tool change

- `run.sh` writes the ratchet with `lib.mjs`'s `folderOf`, which gave `src/<top folder>` only.
- Gate 9 looks up `src/features/<feature>` per feature. `run.sh moved` would therefore have written a single `src/features` unit that gate 9 never reads.
- I changed `folderOf` to split features exactly as gate-9.mjs's `unitOf` does, and updated metrics.mjs's note text to match.
- On a tree without src/features this changes nothing, so ratchet-base.json stands.

### How

- `flock l1-wait sh .refactor/analysis/metrics/run.sh moved HEAD <worktree>`. run.sh takes checks.lock itself.
- It wrote R/analysis/ratchet-moved.json and metrics-moved.md.
- Totals: 657 files, 0 errors, 981 warnings. The units are the 10 features plus the src folders.

### Gate 9's acceptance conditions

I compared rule totals with ratchet-base.json, and then every warning with the base's, matched by file (followed through moves.tsv), rule and first message line.

- **New warnings:** none.
- **Unchanged:** 981.
- **Gone:** 18:
  - **import/no-restricted-paths 29 → 12 (allowed delta):** 17 importers whose target moved under src/features, which the zones do not name yet. src/hooks went 4 → 0 and src/utils 16 → 3.
  - **no-restricted-syntax 796 → 795 (−1):** the one ts-type-export warning of the deleted notes barrel (`NotesPlace`), which now sits in features/notes/types.ts, a types.ts. Every other check is equal: one-export 303, hook-export 39, utility-export 128, tsx-type 205.
- **unicorn/filename-case:** 0 → 0.
- **Every other rule:** equal, including import/no-cycle 10, sonarjs 63 and react-hooks 101 (the 8 react-hooks rules each equal).
- **Deviation:** round.md says every total equals the base's but two rules. no-restricted-syntax is one lower, never higher. The one warning that went is named above, and no warning was created anywhere.

### Also in 718fee6

move.cjs's moves.tsv records: 325 `file` rows, 27 `delete` rows and NotesPlace's `name` row. They are in my branch's R/tools/moves.tsv.

## Commit 6 (R1.0.2): unicorn/no-null off

### The config line

In eslint.config.mjs, after `unicorn/no-lonely-if`:

```
      // The protocol, Prisma and React use null for an absent value (decisions Q2):
      'unicorn/no-null': 'off',
```

### Directives removed: 254 in 216 files

(Fix round 1 restored one of them, test-utils-node.ts:83, so 253 are gone now.)

- **Counts:** 174 whole-file, 5 ranges with their 5 `eslint-enable` lines, and 75 line-level.
- **Against round.md:** that is round.md's 250 (171, 5, 74; jest.setup.ts's one included, as its owners.tsv row says), plus 4 added by commits 2-4:
  - the whole-file directives of refusals.golden.test.ts, routes.golden.test.ts and wire.golden.test.tsx;
  - test-utils-node.ts:83.
- **Combined directives:** none existed. Every directive named only unicorn/no-null; the script errors on anything else.
- **The list:** X/handoff/m-no-null-removed.tsv.

### The proof (reportUnusedDisableDirectives, ESLint 9's default "warn")

- I turned the rule off and left the directives in place, then ran `eslint .` under the locks.
- ESLint reported exactly 254 "Unused eslint-disable directive (no problems were reported from 'unicorn/no-null')" warnings. Their file:line list equals the directive list.
- The other 981 warnings were commit 5's, matched by file, rule and message.
- So no directive suppressed anything but no-null.
- After the removal, eslint reports the same 981 warnings, with no unused directive.

### Comments only

- Three line directives sat inside a statement that prettier breaks only around a comment:
  - use-table-rolls.ts, the `target ?? null` ternary;
  - description-link.tsx, the `part.types[0] ?? null` ternary;
  - characters/[id]/party/[group]/page.test.tsx's `jest.mocked(…).mockResolvedValue` chain.
- Each keeps its reason as a plain comment, so no code line re-wraps.
- I tried letting prettier re-wrap them first. Gate 1b then flagged the test, because the TS printer keeps the chain's line breaks.
- **Resulting diff:** comment lines, the one config line, and the blank line after src/mocks/fullscreen.ts's whole-file directive (maxBOF 0). That is 5 lines added and 260 removed in 217 files.
- With comments and whitespace dropped, all 216 source files print the same AST as before.

### L1 with APP's tools

Outdir: X/l1/M/c6b, 10:21-10:27 UTC, on the committed tree.

- **Checks:** jest ok (301 suites, 9,664 tests, 0 red, 0 flaky); typegen ok; tsc 0 errors; eslint 0 errors, 981 warnings.
- **Gates ok:** 1, 2, 3, 4, 4b, 5, 6, 7, 8, 11, 12.
- **Gates FAIL:**
  - 1b: the same two rows (item 1);
  - 9: ratchet-moved.json (item 2);
  - 10: test-utils-node.ts (item 3).
- **With the additions** (outdir X/l1/M/c6b-next): gates 1b, 9 and 10 ok.
- **An earlier L1** (X/l1/M/c6, before the plain-comment change) showed the gate 1b re-wrap problem described above.

### `next build` on 08e5a87

- Run in the worktree under both locks: exit 0, compiled, TypeScript ok, all routes listed.
- The log has Better Auth and Prisma env warnings (no DB_URL or BETTER_AUTH_SECRET: the worktree has no .env). These come from page-data collection, not from the build itself.

## Deviations from round.md

1. **ratchet-moved's acceptance:** no-restricted-syntax is 1 under the base (the NotesPlace barrel warning), not equal. Per-warning comparison shows no new warning.
2. **The metrics' ratchet unit** was changed to gate 9's, so the re-take can be used at all.
3. **254 directives, not 250.** The extra 4 come from the goldens and the kit, and one of them makes gate 10 fail until it is patched (item 3). Fix round 1 restored the kit's.
4. **Three directives became plain comments** that keep their reason, instead of being deleted outright. This avoids a code re-wrap and a gate 1b difference.
5. **Separate ratchet commit:** the ratchet is in its own chore(refactor) commit after commit 5. round.md has it "taken after commit 5", and run.sh refuses a tree that differs from a commit.
6. **getEditsForFileRename was only a check** (`--check-ts 3`) in move.cjs, as in Phase 1. Phase 1 report, deviation 1.

## Bugs

- **App:** none found.
- **Tooling:** three notes appended to R/bugs-found.md under bugs.lock, in a "[M] Moves and no-null" section:
  - the metrics unit (fixed in 718fee6);
  - gate 10's frozenText;
  - gate 9 reading APP's analysis.

## For later workstreams

- **WS4 (M, commit 7):**
  - Start from APP's head after landing.
  - export-move.cjs reads moves.tsv from the checkout's R/tools. After landing, that file holds commit 5's `file` rows, which map each source to its moved path.
  - Gate 12 is still 4 groups at commit 6, with base group 1 of 12 files unchanged. Commit 7 should shrink it to the 4 src/types files.
- **Every L1 from commit 5 on** needs ratchet-moved.json in APP's R/analysis (item 2). Gate 9 compares each feature's warnings with its own unit.
- **Phase 3 lanes:** unicorn/no-null is off. Three plain comments mark where a directive used to hold a statement's layout: use-table-rolls.ts toRollRequest, description-link.tsx DamageButton, and characters/[id]/party/[group]/page.test.tsx. The owner may simplify the two product sites; the test's comment must stay, or gate 1b sees the chain re-wrap.
- **react-hooks findings:** unchanged by commits 5 and 6. All 101 are base findings, matched by file.
