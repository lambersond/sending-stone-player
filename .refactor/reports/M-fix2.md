# Report: builder M, repair round 2 for commits 5-8 (v0.43), with its landing fix

This report has two parts:
- **Part A, the landing fix** (newest, 2026-11-03 ~9:30-9:50 AM EST): the landing L1 of 064a76b was red on one test. It is a timing flake in a frozen base test, not a regression of 064a76b, and no edit open to me removes it. I made no new commit. The L1 at the same head in my worktree is green.
- **Part B, repair round 2 itself** (the report I wrote for 064a76b, unchanged but for its "Bugs" line, which now points to Part A).

# Part A: the landing fix

- **Worktree:** /home/user/w043/M/sending-stone-player, local branch `local/043-M`. `git rebase claude/dazzling-dirac-m8cq54`: "Current branch local/043-M is up to date". The branch is APP's head f3a9b2a plus 064a76b, as at the landing.
- **Input:** the landing L1 of 064a76b (X/l1/M/landing-fix2, 14:22:50-14:28:35 UTC) failed `check jest` and gate 2 on one test, `src/features/notes/components/note-lines/note-lines.test.tsx`, "components/notes/note-lines ChapterLine says who added or renamed a chapter: 0". It expected "Added by Thorin, just now" and got "Renamed by Thorin, just now". l1.sh's one rerun alone was red too.
- **Outcome:** no new commit. The commit to land is still 064a76b. Details below.
- **Nothing was pushed.** In APP I wrote only the one entry appended to R/bugs-found.md, under `flock X/bugs.lock`.

## Why the test goes red

The table row (note-lines.test.tsx:59; 24f808b's src/components/notes/note-lines.test.tsx:62):

```ts
[{ createdAt: ago(0), modifiedAt: ago(0) }, 'Added by Thorin, just now'],
```

- `ago(0)` is `new Date(Date.now() - 0).toISOString()`. The two calls run at module load, one after the other.
- `ChapterLine` (note-lines.tsx:60) says "Added by" only when `modifiedAt === createdAt`, and "Renamed by" otherwise.
- **So the row passes only when both calls read the same millisecond.** When the clock ticks between them, the strings differ and the row fails. That is what the landing L1 saw.
- **The first call in a fresh context is slow.** In a cold node process, the first `ago(0)` takes about 0.2-0.33 ms and the second about 0.003-0.006 ms (X/m-fix2/landing/cold2.cjs, 8 runs). That puts the tick inside the window often:
  - 257 of 1,000 cold node processes got two different strings (X/m-fix2/landing/cold.cjs);
  - 67 of 20,000 fresh vm contexts in a warm process did (0.34 %, race.cjs);
  - 193 of 200,000 back-to-back pairs in a hot loop inside jest did (0.1 %).
- **A suite run alone is cold, so l1.sh's rerun is the likeliest run to go red.** The exact rerun command (`npx jest --ci --runInBand -t '^…chapter: 0$' <file>`) was red in **6 of 40** runs at 064a76b (X/m-fix2/landing/alone.txt).
- **In a full run it is rarer:** case 0 was red in 1 of the 33 L1 jest.json files under X/l1 (this landing's). An L1 goes red only when the full run and the rerun are both red. At about 3 % × 15 %, that is roughly 1 L1 in 200.

## Why it is not a regression of 064a76b

- **064a76b's one change is outside the suite's import closure.** It touches only src/hooks/use-turn-toast-foot.ts. `jest --findRelatedTests src/hooks/use-turn-toast-foot.ts --listTests` lists 33 suites, and note-lines.test.tsx is not one of them (X/l1/M/fix2-related.txt).
- **The flake is the same at base.** I ran two scratch copies of the table (outside the repo, X/m-fix2/landing/{kit,local}/, alternating, each alone, 30 runs each):
  - the kit's `minutesAgo` (as now): red in 6 of 30;
  - the base's local `ago` (as at 24f808b): red in 5 of 30.
  
  So commit 2's kit adoption did not change it either.
- **The orchestrator's probe agrees:** X/l1/M/landing-fix2-probe/m-head.txt has 8 runs alone, all green.

## Why there is no new commit

Every place the race could be removed is closed to this round:

| where | why not |
|---|---|
| the test's `.each` row | frozen: round.md §3.1.1 holds `.each` tables, and gate 1b checks them. The task forbids editing an existing assertion. The suite is also V2's (owners.tsv:341) |
| the kit's `minutesAgo` | frozen (T(frozen), owners.tsv:667; gate 10). Changing it would not help anyway: the two calls stay two reads of the clock |
| `ChapterLine`'s `modifiedAt === createdAt` | it is the behaviour the case pins (§0.2.1) |
| src/mocks/notes-server.ts `noteChapter` | W-b's (owners.tsv:540). It would not help: the row's own fields win the spread |
| jest.setup.ts (for example a warm-up `Date` call) | G's, in Phase 4 (owners.tsv:806). It would only mask the race, and some of it would remain |

By §3.1.5 a test red alone is called a regression. Here the measurement shows the rerun itself is red about 1 time in 6 at base. So I logged it as a base test defect (bugs-found.md, "[M] Landing of fix round 2"), with the fix for v0.44: read the time once for case 0.

## L1 at 064a76b in my worktree (APP's tools; outdir X/l1/M/fix2-l1)

The run was 14:39:30-14:45:14 UTC, at HEAD 064a76b with a clean worktree. Every check and every gate is ok, with the same counts as round 2's own L1 (X/l1/M/c58-fix2):

- **Checks:**
  - jest: 304 suites, 9,674 tests, 0 red, 0 flaky, 0 suites that did not run. note-lines case 0 passed;
  - typegen ok;
  - tsc: 0 errors;
  - eslint: 783 files, 0 errors, 661 warnings.
- **Gates:** 1, 1b, 2 (8,607 base tests), 3, 4, 4b, 5, 6, 7, 8 and 10 are ok.
  - 9: 661 warnings, against 981;
  - 11: 474 modules, 156 server modules, 17 client boundaries;
  - 12: 3 cycle groups, against 4 at the base.
- **Total:** `l1: 0 failed (0 checks, 0 gates)`, exit 0.

- **`next build`:** not re-run. The tree is byte-identical to the one round 2 built (X/l1/M/c58-fix2/build.log, exit 0, 58 route lines). The landing script builds after its own L1.

## For the orchestrator

- **Land 064a76b as it is.** Its subject and message are §2.5's and the brief's (`fix: v0.43 moves and seams, round 2`).
- **If the landing L1 goes red on this test again, it is this flake.** It does not depend on what lands, so any branch's L1 can hit it, about 1 in 200. The suite's reruns in X/m-fix2/landing/alone.txt show the rate.
- **Gate allowlist rows:** none.
- **A decision that is yours, not mine:** whether to fix the row in v0.43 rather than v0.44. The fix is one `ago(0)` read once, used for both fields. It is a frozen `.each` row (§3.1.1), so it would need a gate 1b allowlist row and a contract amendment. Otherwise, a red L1 whose only red test is this one, and whose diff is outside the suite's closure, can be re-run.

## Bugs (Part A)

One logged, appended to R/bugs-found.md under `flock X/bugs.lock`: the note-lines ChapterLine case 0 timing flake, present at base (test defect, not a product bug; for v0.44).


# Part B: repair round 2 (064a76b), as reported then

- **Worktree:** /home/user/w043/M/sending-stone-player, local branch `local/043-M`. I rebased it onto APP's head f3a9b2a (`chore(refactor): M fix1 report`) before starting. The branch held nothing that had not landed.
- **Input:** no e2e failures. One review finding, RV58b-1 (major).
- **Outcome:** RV58b-1 is correct. I took the finding's option 1 and added `useTurnToastFoot()` beside `TurnToastContext` in Phase 2b. That is one file and 5 added lines; nothing imports the hook yet, so nothing changes at runtime.
- **Nothing was pushed, and I wrote nothing in APP.** I logged no bugs, so I did not touch bugs-found.md.

### Commit (on local/043-M, to land after f3a9b2a)

| SHA | subject |
|---|---|
| 064a76b | fix: v0.43 moves and seams, round 2 |

The commit changes one file, `src/hooks/use-turn-toast-foot.ts` (+6 −1).

### RV58b-1: the finding is upheld

I checked the finding against APP's head:

- **Commit 7 moved only the context.** At HEAD, src/hooks/use-turn-toast-foot.ts has one export, `TurnToastContext`. No `useTurnToastFoot` exists anywhere in src, and the base had none either.
- **The contract names both, in four places:**
  - R1.9.1's homes (round.md:1139): "src/hooks/use-turn-toast-foot (TurnToastContext + useTurnToastFoot)";
  - §0.6.10 (round.md:327-329): "a context and its use-hook in a `use-*.ts` (TurnToastContext → src/hooks/use-turn-toast-foot.ts)";
  - owners.tsv:725: `V1 2b R1.9.1 … TurnToastContext + useTurnToastFoot`;
  - R1.2.9 (round.md:655), R-b's item: "useToastTop (the turn foot from useTurnToastFoot)".
- **No Phase 3 lane could add it.** Row 725 gives the file phase `2b` only. So the hook belongs to 2b, which is mine. M-seams.md did not list this as a deviation; it was a miss on my part. export-move.cjs only moves names that already exist, and the spec (`--print-spec` over owners.tsv) listed only TurnToastContext for this destination.

### Why option 1

- **It needs no planning change.** Options 2 and 3 change owners.tsv or the contract. R1.9.1, §0.6.10, row 725 and R1.2.9 already describe the result of option 1.
- **It is in my lane and phase.** Row 725's phase is `2b`, and 2b is M's.
- **KISS (§0.2.4) does not argue against it.** The contract names this hook itself, through §0.6.10's convention. That convention is the one use-creature.ts, use-rolls-locked.ts and use-table-api.ts already follow.

### The change

```ts
import { createContext, useContext } from 'react'
…
export const TurnToastContext = createContext<number | undefined>(undefined)

/** Where the turn's toast ends while one shows; undefined while none does. */
export function useTurnToastFoot(): number | undefined {
  return useContext(TurnToastContext)
}
```

- **`useContext`, not the finding's `use(…)`.** The convention files call `useContext`: use-creature.ts:15, use-rolls-locked.ts:12 and use-table-api.ts:17/:22. roll-toasts.tsx:91 reads the context the same way today. With `useContext`, R-b's adoption swaps one call for the hook and nothing else. Called unconditionally, the two read the same value.
- **No `'use client'`.** By §1.0 rule 9, a hooks module carries none. The file had none before, and gate 11 is ok.
- **Adoption is left to R-b, as the finding's option 1 says.** roll-toasts.tsx is R-b's file (row 220, `R1.2.9`). game-table.tsx still provides the context, unchanged.

### Tests

**No new test, for two reasons:**
- The hook is a one-line context read. CLAUDE.md §8 says "Avoid testing trivial pass-through code", and §3.1.3's list of new tests does not name it.
- roll-toasts.test.tsx's 'starts below the turn’s toast while one shows, from module 0.36.0' already pins the turn foot through the provider: 64px, then 128px, 64px and 64px. Once R-b adopts the hook, that test runs through it.

**Probe (not committed):**
- I swapped roll-toasts.tsx's read for the hook: the import became `{ useTurnToastFoot }` and the call became `const turnFoot = useTurnToastFoot()`.
- That test then passed under the L0 locks.
- I restored the file byte for byte, from a copy in X/m-fix2/. After that, `git status` in the worktree was clean.
- **For R-b:** after the swap, `useContext` is no longer used in roll-toasts.tsx, so its `react` import must drop it (line 3: `import { useContext, useState } from 'react'`).

### The same cause elsewhere (sweep)

Cause: a 2b home named as holding a name that 2b never made, with no Phase 3 lane on the row to add it.

- **The script:** X/m-fix2/homes.mjs. For every owners.tsv row with phase `2b` whose `path_after` exists, it lists each identifier the row's note names before "; moved in 2b" that the file does not declare.
- **Hits:** 10 rows. TurnToast's hook was the only real gap. The other nine:

| row | file | named, not declared | verdict |
|---|---|---|---|
| 686 | src/constants/dice.ts | DieSize; HIT_DIE_SIZES, HIT_DIE | DieSize went to src/types/roll.ts:1252, by R1.9.1 rule (2): a shared layer's types go to src/types. moves.tsv records it. The row's note is loose wording, not a gap. The HIT_DIE ones are "derived in Phase 3": W-a, phases `2b 3` |
| 691, 708, 709 | polling.test, use-follow.test, use-send-choice.test | retryDelay, useFollow, useSendChoice | the name each test imports, not a declaration |
| 699 | FR/utils/gm-rolls.ts | gmRollsOf, namesOf, heardOf | "in Phase 3": R-a, `2b 3` |
| 703 | FR/utils/damage-words.ts | labelsFor, criticalHint | "in Phase 3": R-b, `2b 3` |
| 724 | src/utils/ask-words.ts | checkName | the note itself says it stays in utils/description-links.ts |
| 729 | src/db/types.ts | RollSeat, RollRejection | "in Phase 3": S, `2b 3` |
| 747 | src/utils/requests/checks.ts | CHECKS | "in Phase 3": W-b, `2b 3` |
| 759 | FS/utils/class-line.ts | modeText | R1.1.7 (round.md:506), U1's item: U1, `2b 3` |

**owners.tsv is not changed.** Row 725 already says "TurnToastContext + useTurnToastFoot", which is now true.

### L1 (APP's tools; outdir X/l1/M/c58-fix2)

The run was 14:14-14:20 UTC, on the tree that was committed as 064a76b. Every check and every gate is ok. The counts are the same as fix round 1's L1 (X/l1/M/c58-fix1):

- **Checks:**
  - jest: 304 suites, 9,674 tests, 0 red, 0 flaky;
  - typegen ok;
  - tsc: 0 errors;
  - eslint: 783 files, 0 errors, 661 warnings. The new function adds no warning.
- **Gates:** 1, 1b, 2, 3, 4, 4b, 5, 6, 7, 8 and 10 are ok.
  - 9: 661 warnings, against 981;
  - 11: 474 modules, 156 server modules, 17 client boundaries;
  - 12: 3 cycle groups, against 4 at the base.
- **Total:** `l1: 0 failed`.
- **L0 before the L1:** `--findRelatedTests src/hooks/use-turn-toast-foot.ts` ran 33 suites with 1,877 tests, all passing; the file lints clean.

### `next build` (commit 064a76b's tree; under both locks; X/l1/M/c58-fix2/build.log)

- **Exit 0:** compiled, TypeScript finished, and 58 route lines.
- **Same as commit 8's landing build** (X/l1/M/landing-seams/build.log):
  - the route list is the same; only the timing lines differ;
  - the env messages are the same: 6 Better Auth default-secret messages and 12 Prisma `DB_URL` lines during page-data collection. The worktree has no .env.

### Deviations

- **None from round.md.** The commit does what R1.9.1 and §0.6.10 already describe.
- **The finding said `use(TurnToastContext)`; I used `useContext`.** That follows the convention files, and it matches the read roll-toasts makes today. Behaviour is the same.

### For the orchestrator

- **Gate allowlist rows:** none (gates 1b, 4b and shims are untouched).
- **Landing:** 064a76b sits on f3a9b2a. It touches only src/hooks/use-turn-toast-foot.ts, so a rebase onto a newer planning-only head applies cleanly.

### For later workstreams

- **R-b (R1.2.9):**
  - useToastTop, or roll-toasts.tsx until then, reads the turn foot with `useTurnToastFoot()` from `@/hooks/use-turn-toast-foot`.
  - Drop `useContext` from roll-toasts.tsx's react import when you do. The `TurnToastContext` import there then goes too.
  - roll-toasts.test.tsx keeps importing `TurnToastContext` to provide the value. That is a setup line, unchanged.
- **V1:** use-turn-toast-foot.ts needs no Phase 3 edit (row 725: `2b`).
  - game-table.tsx:28 imports the context by a relative path (`'../../../../hooks/use-turn-toast-foot'`). export-move kept the relative style of the base's `'./turn-toast'`.
  - It is style only and does not affect behaviour. An `@/hooks/use-turn-toast-foot` specifier would read like the file's other imports, if V1 touches that line in R1.5.x.

### Bugs (Part B)

None found in round 2. The landing fix logged one (Part A).
