# Report: builder M, repair round 3 for commits 5-8 (v0.43; round.md amendment 4)

- **Worktree:** /home/user/w043/M/sending-stone-player, local branch `local/043-M`. I ran `git rebase claude/dazzling-dirac-m8cq54` first. That put the branch on APP's head, 1b7512e (`chore(refactor): amendment 4 (Phase 2 review); …`). The branch held nothing that had not landed.
- **Input:** the Phase 2 review's two findings: RV58c-1 (major) and RV58c-2 (minor).
- **Outcome:** both are fixed in one commit. The diff adds a new util with its test and restores comments. It changes no existing line of code.
- **What I wrote:** nothing was pushed, and nothing was written in APP. I found no bugs, so bugs-found.md is untouched.

## Commit (on local/043-M, to land after 1b7512e)

| SHA | subject |
|---|---|
| 299d979 | fix: v0.43 moves and seams, round 3 (isDieSides home; module comments restored) |

The commit changes 9 files, +77 −0. The message has the brief's two trailers and names no model.

## RV58c-1: src/utils/dice.ts (`isDieSides`) and its table test

**The five copies.** Line numbers are at HEAD:
- src/schemas/roll-request.ts: lines 78, 424 and 909;
- src/utils/roll-modifiers.ts: line 33 (round.md's :56 is at 24f808b);
- src/utils/formulas.ts: line 47.

Each one is `(DIE_SIDES as readonly number[]).includes(x)`, with `DIE_SIDES` from `@lambersond/3d-dice-core`. That is the dice package's list: d4, d6, d8, d10, d12, d20 and d100.
- It is **not** `DIE_SIZES` (src/constants/dice.ts, damage dice only, 4 to 12).
- schemas/roll-request.ts:104's `DIE_SIZES` `.includes` is a different rule. It is not one of the five, and I left it alone.

**src/utils/dice.ts** (new, 6 lines, no directive):

```ts
import { DIE_SIDES, type DieSides } from '@lambersond/3d-dice-core'

/** Whether a die of so many faces is one the dice throw: a d4, d6, d8, d10, d12, d20 or d100. */
export function isDieSides(faces: number): faces is DieSides {
  return (DIE_SIDES as readonly number[]).includes(faces)
}
```

- **Why the type guard:** both R sites cast `die as DieSides` right after the check (roll-modifiers.ts:45, formulas.ts:54). With the guard, R-a can drop those casts when it adopts the helper.
- **Placement:** src/utils/dice.ts as owners.tsv:687 gives it (W-a, phases `2b 3`). round.md R1.9.1 also lists src/utils/dice as a 2b home. It imports only the package, so no cycle forms (gate 12: 3 groups, as before).

**src/utils/dice.test.ts** (new, node environment, owners.tsv:688):
- One `it.each` table of 15 rows: the seven sizes are true, and 0, 1, 3, 7, 16, −4, 4.5 and NaN are false.
- NaN is what `Number(sides)` gives for unreadable text. 7 is the "There's no d7" case.

**No adoption.** Nothing imports `isDieSides` yet, and no existing file changed for it. W-a adopts it at the three schema sites (R1.4.2) and R-a at the two parser sites (R1.2.13), both in Phase 3, each in its own files.

## RV58c-2: the module-header comments restored

**What commit 7 dropped.** I checked with a TS comment scan (X/m-fix3/comments.cjs) of every non-test source commit 7 deleted, renamed or modified (151 files) at `3255abf^`, against HEAD's src. Exactly the review's 12 comments in 7 sources were missing:
- six one-paragraph `/* … */` blocks;
- effect-controls' six `//` lines.

That is 38 comment lines. The same scan over commit 5's and commit 8's sources finds nothing else missing; the only other differences are the no-null directives commit 6 removed on purpose.

**What I restored.** Each comment is copied line for line from `git show 3255abf^:<source>`, by script (X/m-fix3/restore.cjs), not retyped. Each goes where it sat before: after the import block, with a blank line on each side. Every `/*` module-header block in src's non-test files (56 with these) sits after the imports, none above them. The added lines are only comment lines and those blank lines (the scan of the diff finds no other line).

| source at 3255abf^ (lines) | restored in | why that file |
|---|---|---|
| conditions/conditions-panel.tsx:9-12 | conditions/use-conditions-panel.tsx | its subject is "The conditions panel"; the review's file |
| description-actions/description-actions.tsx:21-27 | description-actions/use-description-actions.ts | the review's first choice; see the note below |
| effect-controls/effect-controls.tsx:30-35 | effect-controls/use-effect-controls.ts | it documents the open state and focus kept "here", which is this hook; it is also most of the old code (195 lines) |
| enchantments/enchantments.tsx:19-23 | enchantments/use-enchanting.ts | most of the declarations went here (EndEnchantment, EnchantActions, Actions, useEnchanting); the review's file |
| sheet-tiles/sheet-tiles.tsx:16-19 | sheet-tiles/stat.tsx | see the note below |
| transfers/components/give-controls/give-controls.tsx:26-33 | transfers/hooks/use-give-controls.tsx | the source's rename (R084) |
| transfers/components/remove-controls/remove-controls.tsx:20-23 | transfers/hooks/use-remove-controls.tsx | the source's rename (R085) |

The sheet paths are under src/features/sheet/components/; the transfers paths are under src/features/.

**Two choices of mine, in case the orchestrator wants them elsewhere:**
- **description-actions:** by count of declarations, types.ts holds the most (4 types). But the comment is one paragraph about what the links do and that "the sheet gives them once, for every tab, favorite and dialog in it". That is the context and the hook in use-description-actions.ts, the file named for the old module. As the header of types.ts it would sit over `DescriptionOrigin`. I followed the review.
- **sheet-tiles:** the declarations went to nine files equally, and no sheet-tiles.tsx remains. I chose stat.tsx because:
  - `Stat` is the tile itself ("its vital numbers, each in a tile"), and InitiativeStat and DeathSavesStat are built on it;
  - the vital-number tiles are 6 of the 9 files.

## Ownership

Every file I touched has an owners.tsv row whose phases include `2b`:
- rows 843, 848, 855 and 863: U1, 2b;
- row 770, sheet-tiles glob: U2, 2b 3;
- rows 907 and 908: V2, 2b 3;
- rows 687 and 688: W-a, 2b 3.

No planning file changed.

## L1 at the commit's tree, in my worktree (APP's tools)

- **Outdir:** X/l1/M/fix3-l1, 15:23:16 to 15:28:44 UTC.
- **Tree:** HEAD 1b7512e plus exactly the 9 files above. After the commit, `git diff --quiet HEAD` is clean, so the tested tree is 299d979's.

**Checks**
- jest: 305 suites, 9,689 tests, 0 red, 0 flaky, 0 suites that did not run. That is the round 2 L1's numbers plus dice.test.ts (+1 suite, +15 tests).
- typegen ok.
- tsc: 0 errors.
- eslint: 785 files, 0 errors, 661 warnings (unchanged).

**Gates**
- 1, 1b, 2 (8,607 base tests), 3 (1,082 new tests, all in new files), 4, 4b, 5, 6, 7, 8 and 10: ok.
- 9: 661 warnings against 981; the new files add none.
- 11: 475 modules, 156 server modules, 17 client boundaries. The one new module, dice.ts, has no directive.
- 12: 3 cycle groups against 4 at the base.

**Total:** `l1: 0 failed (0 checks, 0 gates)`, exit 0.

**L0** (before the L1): `--findRelatedTests` over the 9 files ran 54 suites and 1,883 tests, all green.

**`next build`:** not run. The change adds comments and a module nothing imports yet, so the build graph is unchanged. The landing builds after its own L1.

## For the orchestrator

- **Land 299d979.** It is meant to land before the Phase 3 worktrees are made (amendment 4 (a), (b)).
- **Allowlist rows** (gate 1b, 4b, shims): none needed.
- **Bugs:** none found.
- **Flakes:** none. The note-lines `ago(0)` case passed in this L1. If it goes red in the landing L1, it is the known flake in Part A of M-fix2.md (amendment 4 (e)).

## What later workstreams must know

- **W-a (R1.4.2), at schemas/roll-request.ts:78, :424 and :909:**
  - import `isDieSides` from `@/utils/dice`;
  - write `.refine(isDieSides)` or `.refine(faces => isDieSides(faces))`;
  - inside `.every(…)`: `isDieSides(faces) && …`.
  - The three refines must keep their issue text (C6 pins it), and `isDieSides` gives the same boolean.
- **R-a (R1.2.13), at roll-modifiers.ts:33 and formulas.ts:47:** `if (!isDieSides(die)) …`. After the guard, `die` is a `DieSides`, so the `as DieSides` casts at roll-modifiers.ts:45 and formulas.ts:54 can go.
- **The `DIE_SIDES` import:** it stays in each adopter only while another line there still reads it. After adoption, none of the five sites does.
- **U1, U2 and V2:** the restored headers sit at the top of files your lanes may split further in Phase 3 (use-give-controls.tsx and use-remove-controls.tsx become `.ts` plus dialogs, R1.5.19). Carry each header with what it documents, as these were carried here.
