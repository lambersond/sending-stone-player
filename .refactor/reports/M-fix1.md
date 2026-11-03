# Report: builder M, repair round 1 for commits 5-8 (v0.43)

- **Worktree:** /home/user/w043/M/sending-stone-player, local branch `local/043-M`. Before starting I rebased it onto APP's head 15e82cb (`chore(refactor): e2e pass2`). The branch held nothing that had not landed.
- **Input:** no e2e failures. One review finding, RV58-1 (major).
- **Outcome:** RV58-1 is correct. The fix is to the planning matrix, R/owners.tsv; no product or test line changes. A sweep for the same cause found two more rows that commit 7's moves left without the phase their items need, plus amendment 1 (c)'s R1.4.9b, which no row names. All of them are fixed in one commit.
- **Nothing was pushed, and I wrote nothing in APP.** I logged no bugs, so I did not touch bugs-found.md.

## Commit (on local/043-M, to land after 15e82cb)

| SHA | subject |
|---|---|
| 9c694f1 | fix: v0.43 moves and seams, round 1 |

The commit changes one file, `.refactor/owners.tsv`: 9 rows changed and 1 row added. Gates do not read owners.tsv (no gate script references it), so the L1 is the same as at the landing.

## RV58-1: the src/utils/lifecycle.ts row (finding upheld)

I checked the finding against the tree at APP's head:

- **`follow` is in src/utils/lifecycle.ts:35.** ESLint gives it cognitive complexity 25. That is the warning amendment 3 (b) accepted into src/utils' ratchet.
- **R1.2.2 (round.md:610-614) has R-a split it** "into post, poll and late stages". §0.6.8 lets only `roll` and `rollDamage` stay over 15.
- **owners.tsv:693 gave the file phase `2b` only.** Read as written, R-a could not touch it in Phase 3.
- **The orchestrator's owners check (9589546) did not cover this.** Its check E covers only the names of *deleted* files. use-table-rolls.ts was not deleted, so the move of `follow` out of it fell through.

**Fix (owners.tsv:693):**
- phases `2b` → `2b 3`;
- items `R1.9.1 R1.9.2` → `R1.9.1 R1.9.2 R1.2.2`;
- breaks `cc:35=25→R1.2.2`.

**Where I differ from the finding: R1.2.12a is not added.** R1.2.12a covers two things in R-a's files: tests that follow their unit, and react-hooks findings. lifecycle.ts has neither:
- It has no test beside it. `follow` is tested through use-table-rolls.test.
- It is a pure module with no hooks, so it has no react-hooks finding. Its only lint finding is the cognitive complexity one.

If R-a writes a lifecycle.test.ts while splitting `follow`, that file needs a row of its own. The orchestrator can add R1.2.12a to row 693 if it wants that latitude.

**The src/constants/lifecycle.ts row (692) stays `2b`. No R-a item edits it:**
- R1.2.2's split keeps "the same awaits and timers". It reads CHECK_EVERY, FOLLOW_FOR and LATE_FOLLOW from it.
- BUSY_WAIT and BUSY_FOR are read by startEach, which stays in use-table-rolls.ts.
- NOT_MADE's adopters only import it: R1.1.8 (U1, UNSPENT in use-spent-offers) and R1.2.8 (R-b, roll-tray/brief).
- The file has no lint finding.

## The same cause in other rows (the sweep)

**Method:**
1. I re-created check.mjs's row matching: concrete rows, globs and braces, with a file's phases as the union over its rows.
2. Against it I ran two checks on the commit-8 tree:
   - **(a) lint findings:** every file with an ESLint finding in the landing L1's eslint.json (X/l1/M/landing-seams) whose lane has no phase 3 or 4 on it;
   - **(b) 2b homes:** every 2b destination in moves.tsv (140 of them) whose lane has no phase 3 or 4.
3. I read each hit against round.md §1's items.

The scripts are in X/m-fix1/ (sweep.mjs, dest.mjs).

### Before the fix, check (a) found 4 files

| file (row) | finding | verdict |
|---|---|---|
| src/utils/lifecycle.ts (693) | cc 25 | RV58-1 (above) |
| src/features/rolling/components/roll-menu/choice-menu.tsx (704) | tsx-type 1, one-export 1, react-hooks/refs at :109 | **gap from commit 7**, fixed |
| src/types/sending-stone.ts (565) | import/no-restricted-paths | base finding (`layer:1→§1.7.4`). §1.7.4 zone 2 (types may import constants) clears it in G's commit 23, with no edit |
| src/types/cookbook.ts (559) | import/no-restricted-paths | new in commit 7: CookbookRefusalReason moved here and reads `@/constants/cookbook`. Zone 2 clears it the same way. I recorded `layer:1→§1.7.4` in its breaks column |

### Gaps found and fixed

- **choice-menu.tsx (row 704).** Commit 7 moved ChoiceMenu, with MenuPlace, out of roll-menu.tsx.
  - That includes base roll-menu.tsx:160-198 and the refs read at :215, which R1.9.20 names ("usePopover at … roll-menu :160-198", F-a). That code is now at choice-menu.tsx:54-91, with the refs read at :109.
  - It also carries the .tsx type and second export that R1.2.10 and R1.2.12b clear for roll-menu.
  - Row 704 was `2b` only. Row 218 (roll-menu.tsx) has `2a 2b 3 4` with `R1.2.10 R1.2.12b R1.9.20(F-a)`, so I gave row 704 the same:
    - phases `2b 3 4`;
    - items `R1.9.1 R1.2.10 R1.2.12b R1.9.20(F-a)`;
    - breaks `a:1 types:1 hooks:refs@109`.
- **src/utils/requests/commands.ts (row 745).** Commit 7 moved GM_UNSENT here from utils/roll-requests.ts:233.
  - R1.4.4 (W-b part) has it "derived" from the kind table; §1.6's `gm: false` row names ":233 GM_UNSENT".
  - Row 745 was `2b` only. It is now phases `2b 3`, items `R1.9.1 R1.4.4`.
  - The other R1.4.4 names W-b derives already sit in rows with phase 3: GM_ROLL_KINDS, D20_KINDS, SUMMED and DAMAGE_KINDS in views.ts; CHECK_TYPES in check-linked.ts.
- **R1.4.9b (amendment 1 (c)) was in no row.** The four src/types files it works on are party, roll, sending-stone and table. Of those, only roll.ts had phase 3. With the old rows, W-a could not do the item.
  - Rows 563, 565 and 566 (party, sending-stone, table) are now `2b 3` with `R1.9.1 R1.4.9b`.
  - Row 564 (roll) names R1.4.9b.
  - A new `-` row, `src/types/base.ts  W-a  3  R1.4.9b`, sits after src/types/prompts.ts and covers the amendment's second way.
  - This gap comes from the amendment not being carried into the matrix, not from a line of commits 5-8. It is the same mismatch between an item and the matrix, so I fixed it in the same pass. If you would rather word these rows yourself, drop them from the commit.

### Check (b): 2b homes left without phase 3 or 4 (20, all read, none needs one)

| file | why no Phase 3/4 edit is needed |
|---|---|
| chevron, entry-icon | R1.1.18 moves them in 2b and does nothing more |
| description/read-description.ts | R1.1.18 works on draw-description, which has `2b 3` |
| live-status/types.ts | holds only LiveState |
| src/constants/lifecycle.ts | see above |
| src/constants/polling.ts | retryDelay and POLL_MOST_DELAY are adopted by importing them only (R1.9.3) |
| FS charging/{charging.tsx, types.ts, use-charging.ts} | no item edits them (R1.1.2 builds the charging object in the pane); no lint finding |
| FS/utils/join-parts.ts | no item edits it |
| transfers/hooks/use-transferring.ts | no item edits it |
| src/hooks/use-turn-toast-foot.ts | R1.2.9 and R1.5.6 import it only |
| src/types/{cookbook, prompts, seats}.ts | no item edits them (cookbook: see above) |
| src/utils/initials.ts | no item edits it |
| src/utils/requests/{check-damage, check-turns, status, types}.ts | not among R1.4.6's split targets; no lint finding |

### After the fix

- Check (a) leaves only src/types/cookbook.ts, which needs no edit (zone 2).
- check.mjs over my draft (`node R/analysis/owners-check/check.mjs <worktree> HEAD`) gives the same findings as APP's committed check.txt:
  - A: 2. These are the src/utils/dice.ts and dice.test.ts rows, as before.
  - A2, B, C, D, E, F: 0.
  - Rows: 909, one more than before (src/types/base.ts).

## L1 (APP's tools; outdir X/l1/M/c58-fix1)

Run 13:34-13:40 UTC. Every check and every gate is ok, with the same counts as the landing L1 of commit 8 (X/l1/M/landing-seams):

- **Checks:**
  - jest: 304 suites, 9,674 tests, 0 red, 0 flaky;
  - typegen ok;
  - tsc: 0 errors;
  - eslint: 783 files, 0 errors, 661 warnings.
- **Gates:** 1, 1b, 2, 3, 4, 4b, 5, 6, 7, 8 and 10 are ok.
  - 9: 661 warnings, against 981;
  - 11: 474 modules, 156 server modules, 17 client boundaries;
  - 12: 3 cycle groups, against 4 at the base.
- **Total:** `l1: 0 failed`.

`next build` was not run. src is byte-identical to the landed commit 8 (`git diff 63c5cc3 HEAD -- src eslint.config.mjs package.json jest.config.ts` is empty), whose build passed at the landing (X/l1/M/landing-seams/build.log).

## Deviations

- **The fix commit changes a planning file only.** The finding's cause is the matrix, not commits 5-8's code. The finding addresses its fix to the orchestrator. I made the change in my worktree, as brief.md allows ("Planning files under R/ that a builder writes go in its own commit"), so it can land by fast-forward.
- **If the orchestrator makes the same correction in APP itself, drop my commit.** Otherwise the rebase conflicts on these lines.
- **R1.2.12a is not added to row 693** (see RV58-1).

## For the orchestrator (not changed: outside this round's cause)

### R1.4.9b moves names other lanes import, either way

The loop-closing edges are:
- sending-stone.ts → roll.ts, for `FavoriteTarget`;
- roll.ts → table.ts, for `TableAsk`.

Moving either type changes its importers:
- **`FavoriteTarget`: 16 files outside src/types.**
  - U1 and U2 sheet files: action-entry, character-pane, effect-entry, favorites, favoriting (constants, test, tsx, use-favorite-choice), feature-entry, item-entry, sheet-entry, spell-entry;
  - src/mocks/sending-stone.ts;
  - src/utils/{favorites, favorite-commands(.test)}.ts.
- **`TableAsk`: 4 files outside src/types.** These are chat-log.tsx, utils/ask-words.ts, utils/table-view.ts, and the frozen golden words.golden.test.tsx.

§2.2.2 forbids a Phase 3 lane from moving a name another lane imports. You need to rule on it before W-a starts. Two options:
- a type re-export left at the old home, which is a shim row in shims.allow;
- the importers retargeted in Phase 4.

### R-b folders have no types.ts rows

R1.2.1 sends R-b's component types to "their folder's types.ts" (R1.2.8-R1.2.11). Today one .tsx type finding each sits in modify-roll.tsx, roll-button.tsx, roll-menu.tsx and choice-menu.tsx. Only dice-entry/ has a types.ts row (row 722).

This gap existed before commits 5-8. R2.2.1 lets R-b create files under its own folders, so it is not blocked. But check B will want rows for those files after Phase 3.

### Gate allowlist rows

None needed this round (gates 1b, 4b and shims are untouched).

## Bugs

None found. bugs-found.md is unchanged.
