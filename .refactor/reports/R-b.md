# Report: builder R-b, Phase 3 (v0.43): commit 16, and fix round 1

- **Worktree:** /home/user/w043/R-b/sending-stone-player, local branch `local/043-R-b`, made from a2332a2.
  The fix round continued on the branch as it stood (be4a367, clean tree).
- **Status: ok.** Commit 16 (be4a367) is unchanged. The review's findings RB-1 to RB-6 (all minor) are
  handled in one new commit, f338ea5. No amend. No golden, kit, test file or existing assertion
  changed. The L1 on the fixed tree is green on every check and gate. `next build` is green.
- **No moves.d file and no chore(refactor) commit.** No test file was split.
- **Nothing pushed. Nothing written in APP.** I logged no bug, so bugs-found.md is untouched.
  Scratch files are in X/rb3/ (fix round: L0 log, commit message, the report before this round),
  X/rb2/ (earlier edit scripts and L0 logs) and X/l1/R-b/ (each L1, the gates rerun on each commit,
  and the build logs).

## Commits on local/043-R-b (after a2332a2)

| SHA | subject |
|---|---|
| be4a367 | refactor(rolling): the tray one export per file, words per kind, toasts, small components, dice entry |
| f338ea5 | fix: v0.43 rolling tray, round 1 (scrollDown's reason; UsedResult; commandWords' return spelled out) |

f338ea5's tree is the tree of the fix1 L1. I reran gates 1-12 on the committed checkout with that
L1's jest.json and eslint.json, so that the rename is followed through HEAD: all ok
(X/l1/R-b/fix1-gates).

## Fix round 1: the review's findings

| id | severity | outcome |
|---|---|---|
| RB-1 | minor | **Fixed** (f338ea5), the finding's first way. `scrollDown` stays a module function. Its doc comment now says why it is one: it is an imperative scroll of a DOM node from an event or effect-event handler (keepClear, from focusBox, the boxes' onFocus and the focusFirst effect event). react-hooks/immutability can't tell that node, found through the `form` ref prop, from a render value being mutated. Written inline, the rule flags it again, and the react-hooks line disables are at their budget (7 of 7). |
| RB-2 | minor | **Orchestrator's, no code change.** owners.tsv is APP's planning file, and I don't write in APP. The rows to add or point at current paths are listed under "What integration must know". |
| RB-3 | minor | **Phase 4 item 1 rewritten** (below). It now names FR/hooks/ as the home, as the finding prefers, says that owners.tsv:717 plans components/roll-toasts/ instead (so G or F-a records one), and finds the import lines by name, not line number. |
| RB-4 | minor | **Fixed** (f338ea5). roll-tray/use-result.tsx is now used-result.tsx (`git mv`; git shows R, 6 lines changed). UseResult is now UsedResult, and the private UseStatus is now UsedStatus. latest-result.tsx's import and JSX follow. All of these are new in commit 16 and private to the tray. No test, golden or other lane names them (`git grep 'use-result\|UseResult'` on APP's head and on U1, U2, V1 and V2 finds only the base roll-tray.tsx's own private function). owners.tsv's glob row 716 (roll-tray/*.ts(x)) covers the new name. |
| RB-5 | minor (optional) | **In part.** commandWords (tray-words.ts:348) now spells out its return, `{ doing: string; done: string; not: string } \| undefined`, in place of `Parameters<typeof wayWords>[2]`. **Not done: the two file-private named types.** CLAUDE.md §3 puts named types in a types.ts. In this same round, RA-3 removed exactly such a type (FormulaScan, file-private in R-a's src/utils/damage-modifiers.ts) and counted "one named type fewer outside a types.ts" (R/reports/R-a.md:13, :22). The narrowest types.ts for FR/utils is FR/types.ts, which is R-a's file. A component folder's types.ts would have FR/utils import from a component, which is upward. So ToastDraft and WayWords join Phase 4 item 2, which already moves RollToast and ToastBook from roll-toasts.ts to FR/types.ts. `ReturnType<typeof draftOf>` stays until then. That is the spelling the rolling feature already uses for gmShape (gm-words.ts:99, :111, :132) and gmRollsOf. |
| RB-6 | minor | **No code change. The two placements are now in the deviations** (8 and 9 below), for the PR's list for commit 16. |

**Behaviour:** names and comments only, with no statement changes. The markup and words goldens
(C1, C4) and the tray's suites are green.

## Items (commit 16, as built)

- **R1.2.8, the tray (first builder; L1 green).**
  - RollTray stays in roll-tray.tsx. Its 20 components each have a file under
    FR/components/roll-tray/: roll-history, latest-result, status-line, table-status, partly-made,
    area-outcomes, damage-due, damage-button, table-mark, check-result, dice, spent-lines,
    damage-result, formula-result, terms, used-result (use-result until f338ea5), ask-result,
    gm-result, gm-pill, only-you.
  - BADGES and BADGE_ICONS are in the folder's constants.ts. They have three readers:
    roll-toasts/badge.tsx, damage-result.tsx and gm-result.tsx.
  - The folder's pure helpers are in its utils.ts: movesAlone, offersDamage, dcOf, madeWord,
    earlierTotal.
  - The words are split three ways:
    - FR/utils/tray-words.ts has reasonOf, outcomeOf, wayWords, usedWords, askedWords, toneOf,
      reachOf and the rest.
    - FR/utils/gm-words.ts has GM_WORDS, gmShape, gmLine, gmBadge and gmOutcomeOf.
    - FR/utils/brief.ts keeps briefOf with accentOf, madeIt, checkDice and tableLine, plus
      breakdown and shownTotal.
  - wayWords serves the seven way-word copies, and StatusLine the four status lines.
  - breakdown now goes by kind (checkBreakdown, damageBreakdown, formulaBreakdown).
  - usedWords, TableMark, gmLine, tableLine and briefOf are each 15 or less.
  - gmShape reads ROLL_KIND_INFO, and DAMAGE_KINDS is gone into `info.damage`.
  - NOT_MADE comes from @/constants/lifecycle.
  - The rolling → sheet edge (useSpent in spent-lines.tsx) is still there, as listed.
- **R1.2.9, toasts (first builder; L1 green).**
  - popToasts is split into draftOf, pop, meet, meetNew and capped. Reads and writes happen in the
    same order. Its complexity fell from 40 to 15 or less.
  - Toast and Badge have their own files in roll-toasts/.
  - RollToasts reads the turn foot through useTurnToastFoot, and `belowTurn` (utils/roll-toasts.ts)
    does the max.
  - Not done: useToastSetting and useToastTop stay in hooks/use-roll-toasts.ts (deviation 1).
- **R1.2.10, small components (first builder's edits, verified by me; L0 63 suites green; L1 green).**
  - ModifyDamage moved to modify-roll/modify-damage.tsx, with its private STEP and Toggle.
  - criticalHint and labelsFor moved to FR/utils/damage-words.ts.
  - useD20Rolls and useDamageMenu became .ts hooks, following §0.6.4: each returns
    `createElement(D20Dialogs | DamageDialogs, props)`, with the JSX copied into d20-dialogs.tsx and
    damage-dialogs.tsx. Their menu-state types are in each folder's types.ts.
  - MenuPlace moved to roll-menu/types.ts.
  - rollOf is in FR/utils/sheet-rolls.ts. It builds the d20-rolls tap and choose bodies and
    ModifyRoll's body with the same keys in the same order (label, modifier, advantage, extras?,
    source, explicit, dc?, ask?).
  - The prop types of ModifyRoll, RollButton and RollMenu are inlined into their parameters.
- **R1.2.11, dice entry (L0 32 suites green; L1 green).**
  - DiceKey and Asked are in dice-entry/types.ts.
  - use-dice-entry.tsx became use-dice-entry.ts (`git mv`; 'use client' kept, since it is a base
    file).
  - Its JSX is in dice-entry-dialogs.tsx (`DiceEntryDialogs`, 'use client', split from a 'use client'
    file). The hook keeps `useHydrated` and returns
    `hydrated ? createElement(DiceEntryDialogs, { current }) : undefined`, so `dialog` is still
    undefined before hydration.
  - dice-keypad.tsx exports only DiceKeypad.
  - use-dice-entry.test's `./dice-entry-dialog` mock and character-pane.test's mock path are
    unchanged and still intercept, so gates 4 and 4b are ok.
- **R1.2.12b, hooks findings (L0 64 suites green; L1 green).**
  - choice-menu.tsx: `const { setFloating } = refs`, then `ref={setFloating}`.
  - rolls-button.tsx: `const { setReference } = refs`, then `ref={setReference}` (fact 29: the ref
    object is stable).
  - dice-entry-dialog.tsx: `scroller.scrollTop += hidden` moved into a module-level
    `scrollDown(scroller, by)`, whose comment (since f338ea5) says why (RB-1).
  - use-roll-toasts.ts:54: one line disable,
    `// eslint-disable-next-line react-hooks/set-state-in-effect -- reads the clock after commit`.
    It is the same reason V1 gives for its two. A render-time update would read Date.now() in render
    (react-hooks/purity) and pop the toasts a render sooner.
  - Tests follow their units. No unit of mine with a test changed its file stem. roll-tray.test.tsx
    stays the tray's (map R §7), and its one change is the RollBrief type import line (now from
    tray-words).

## L1 and gate results (X/l1/R-b/<item>; times EST)

| item | when | jest | tsc | eslint | gates 1-12 |
|---|---|---|---|---|---|
| R1.2.8 | Nov 3, 5:46-5:50 PM | 305 suites, 9,689 tests, 0 red | ok | 0 errors, 640 warnings | all ok |
| R1.2.9 | 5:57-6:00 PM | same, 0 red | ok | 0 errors, 639 | all ok |
| R1.2.10 | 6:24-6:28 PM | same, 0 red, 0 flaky | ok | 0 errors, 632 | all ok |
| R1.2.11 | 6:31-6:34 PM | same, 0 red, 0 flaky | ok | 0 errors, 628 | all ok |
| R1.2.12b | 6:37-6:41 PM | same, 0 red, 0 flaky | ok | 0 errors, 624 | all ok |
| commit be4a367 | gates rerun | (R1.2.12b's) | | | all ok |
| next build | ~6:43 PM | | | | green (X/l1/R-b/build.log) |
| **fix1** (L0: 38 related suites, 2,045 tests, green) | 7:04-7:07 PM | 305 suites, 9,689 tests, 0 red, 0 flaky | ok (typegen ok) | 0 errors, 624 | all ok |
| commit f338ea5 | gates rerun | (fix1's) | | | all ok (X/l1/R-b/fix1-gates) |
| next build (fix1) | ~7:08 PM | | | | green, rc 0 (X/l1/R-b/build-fix1.log) |

- Gate 2 passed on every L1: the 8,607 base tests are present, passed, with asserts ≥ base.
- Gate 10 passed on every L1: 991 golden tests green, the 24 frozen files held.
- Gate 12: 3 cycle groups (base 4), the same as at commit 16, none of them in rolling.
- Gate 11 lists four new 'use client' components in my folders. dice-entry-dialogs.tsx, badge.tsx
  and toast.tsx are split from 'use client' files; choice-menu.tsx dates from 2b. The rename to
  used-result.tsx adds no directive.
- Gate 9 was ok on every L1, so I have no folder key to report.
- Both `next build` logs have the same environment lines as S's and V1's builds: no
  BETTER_AUTH_SECRET, and no DB_URL during page-data collection (6 of each, the same in both).

## Metrics (this lane's files; a2332a2 → be4a367 → f338ea5)

| metric | a2332a2 | be4a367 | f338ea5 |
|---|---|---|---|
| eslint warnings in R-b's files | 41 | 4 | 4 |
| .tsx files breaking rule (a) | 6 (roll-tray, choice-menu, dice-keypad, use-dice-entry, use-d20-rolls, use-damage-menu) | 0 | 0 |
| named types in .tsx (rule (b)) | 6 | 0 | 0 |
| exported named types in .ts outside a types.ts (rule (b)) | 4 (brief.ts 2, roll-toasts.ts 2) | 4 (tray-words.ts 2, roll-toasts.ts 2): Phase 4 item 2 | 4, the same |
| file-private named types added outside a types.ts | | 0 | 0 |
| cognitive complexity over 15 | 7 (roll-tray/brief: 56, 36, 27, 27, 17, 16; popToasts 40) | 0 | 0 |
| react-hooks findings | 4 (refs ×2, immutability, set-state-in-effect) | 0, with 1 line disable | 0, with 1 line disable |
| eslint-disable comments | 1 (use-dice-entry's no-useless-undefined, reasoned) | 2 (+ the react-hooks one above) | 2 |
| import cycles | none in R-b's files (3 groups in src at commit 8) | none (3 groups in src) | none (3 groups in src) |

The 4 warnings left are all no-restricted-syntax for exported types outside a types.ts:
roll-toasts.ts:63, :66 and tray-words.ts:27, :502. Over the whole tree, eslint warnings went 640 → 624
across my items, and the fix round holds 624.

## Deviations from round.md, and why

1. **R1.2.9: useToastSetting and useToastTop are not in their own files.** character-pane.tsx (U1)
   imports useToastSetting and turn-toast.tsx (V1) imports useToastTop, both from
   FR/hooks/use-roll-toasts. §2.2.2 says no Phase 3 lane moves a name another lane imports, so this
   is Phase 4 item 1. useToastTop does not read the turn foot itself: turn-toast.tsx calls it to
   measure its own top, so RollToasts reads the foot (useTurnToastFoot) and combines the two with
   `belowTurn`.
2. **Four exported types are still outside a types.ts:** RollBrief and Creature in
   FR/utils/tray-words.ts (at a2332a2 they were in brief.ts), and RollToast and ToastBook in
   FR/utils/roll-toasts.ts. Their narrowest shared home is FR/types.ts, which is R-a's file. A
   component folder's types.ts would have FR/utils import a type from a component, which is upward
   (CLAUDE.md §7). This is Phase 4 item 2.
3. **gmVerbs keeps its own words.** R1.2.8 says "gmShape, gmVerbs read ROLL_KIND_INFO", but the kind
   table has no verb field (RollKindInfo: gmLabel, dice, damage, summed, check, …). gmShape reads it.
4. **The word function `onItsWay` (brief.ts at a2332a2) is now `onItsWayWords` in tray-words.ts.**
   The first builder renamed it so that it no longer shares a name with @/utils/lifecycle's
   `onItsWay`, which the tray had to import as `isOnItsWay`. Only R-b's files used it (checked
   against every lane branch).
5. **damage-menu/damage-menu.tsx is gone.** Its one component, ModifyDamage, is now
   modify-roll/modify-damage.tsx (owners.tsv's R1.2.10 row). So the row
   `src/components/character-sheet/damage-menu.tsx → …/damage-menu/damage-menu.tsx` now ends at
   modify-roll/modify-damage.tsx (git: R088; use-dice-entry.tsx → .ts is R077). The damage-menu folder holds use-damage-menu.ts,
   damage-dialogs.tsx and types.ts.
6. **New types.ts files in my own folders** (d20-rolls/, damage-menu/, roll-menu/) have no row of
   their own. §1.0 rule 2 and R2.2.1 allow them: these folders are wholly R-b's. dice-entry/types.ts
   has its own row. (RB-2: the orchestrator adds the rows.)
7. **dice-entry-dialog's immutability finding is fixed by a module-level helper, not a disable.**
   It is a false positive (a DOM node's scroll position). The helper keeps the react-hooks disables
   at the §1.7.3 budget, and since f338ea5 its comment says so (RB-1).
8. **toneOf is in tray-words.ts, not brief.ts** (RB-6). R1.2.8 lists toneOf among the functions
   brief.ts keeps. gm-words.ts reads toneOf, and brief.ts imports gm-words.ts (brief.ts:3-9), so
   toneOf in brief.ts would close a brief.ts → gm-words.ts → brief.ts cycle. The tray's status
   components (ask-result, table-status, used-result) read it too. tray-words.ts is the module
   both already import, so it lives there (tray-words.ts:531).
9. **reachOf left roll-tray.tsx for tray-words.ts, with RollHistory's branch folded into it**
   (RB-6). At a2332a2, RollHistory decided `table?.available ? reachOf(table, role) :
   seatWords(role).notSent` (roll-tray.tsx@a2332a2 :214-223). Now reachOf takes
   `table: TableRolls | undefined`, and its first line is
   `if (!table?.available) return seatWords(role).notSent` (tray-words.ts:553). The output is the
   same, and the markup and words goldens (C1, C4) pass. This takes a decision out of the JSX
   (CLAUDE.md §2).
10. **Fix round, RB-5 in part:** the two file-private named types the review suggested are not
    added (see RB-5 above). They join Phase 4 item 2.

## Bugs logged

None. I found no new defect. Map R §8's three are already in bugs-found.md under [R].

## Phase 4 items (R1.9.26)

1. **useToastSetting and useToastTop to their own files** (R1.2.9's "own files"; RB-3).
   - Files: src/features/rolling/hooks/use-roll-toasts.ts (R-b), its importers
     src/features/rolling/components/roll-toasts/roll-toasts.tsx (R-b),
     src/features/sheet/components/character-pane/character-pane.tsx (U1) and
     src/features/table/components/turn-toast/turn-toast.tsx (V1).
   - What: move useToastSetting to src/features/rolling/hooks/use-toast-setting.ts and useToastTop
     to src/features/rolling/hooks/use-toast-top.ts. Then retarget their import lines. Find them by
     name, not number: `git grep -n "useToastSetting }"` and `git grep -n "useToastTop }"`, plus
     roll-toasts.tsx's multi-line import of useToastTop. On local/043-U1 character-pane's line is :39, and on
     local/043-V1 turn-toast's is :9; both move again as lanes land. No jest.mock names
     use-roll-toasts.
   - Where: FR/hooks/, because the importers are the sheet and table features as well as
     roll-toasts.tsx, not one component. owners.tsv:717 (glob roll-toasts/*.ts(x)) plans them under
     components/roll-toasts/ instead, so G or F-a records the chosen home in owners.tsv.
   - Why it waits: other lanes import both names, so §2.2.2 forbids the move in Phase 3.
2. **Named types to src/features/rolling/types.ts (R-a's file)** (CLAUDE.md §3 rule (b); RB-5).
   - What: move RollBrief and Creature from src/features/rolling/utils/tray-words.ts, and RollToast
     and ToastBook from src/features/rolling/utils/roll-toasts.ts, into it. Name two more there:
     `ToastDraft = ToastBook & { popped: Set<RollToast> }`, in place of roll-toasts.ts's four
     `ReturnType<typeof draftOf>` (pop, meet, meetNew, capped; draftOf's return), and
     `WayWords = { doing: string; done: string; not: string }`, for wayWords' `words` parameter and
     commandWords' return in tray-words.ts. Then retarget the importers:
     - brief.ts, gm-words.ts, tray-words.ts and roll-toasts.ts in FR/utils/
     - roll-tray/constants.ts and roll-tray/status-line.tsx
     - roll-toasts/badge.tsx and roll-toasts/toast.tsx
     - hooks/use-roll-toasts.ts
     - the import lines of roll-tray.test.tsx and utils/roll-toasts.test.ts (by name: RollBrief,
       RollToast)
   - Why: these are the last 4 warnings in R-b's files, and FR/types.ts is R-a's. A file-private
     named type in a utils module would be a named type outside a types.ts, which RA-3 removed from
     R-a's files in this round.
3. **(Already planned, for F-a.)**
   - R1.9.20's usePopover in rolls-button.tsx and roll-menu/choice-menu.tsx replaces the
     `const { setReference } = refs` and `const { setFloating } = refs` lines R1.2.12b added.
   - R1.9.24 can adopt rollOf in description-link's `rollAgainst`:
     `rollOf(target, chosen ?? toAdvantage(target.mode), chosen !== undefined, { dc, ask: target.ask })`
     gives its keys in its order.

## What integration must know

- **Two commits, be4a367 then f338ea5, on a2332a2.** They touch only src/features/rolling/ files
  of R-b's rows. f338ea5 changes 4 files: dice-entry-dialog.tsx (a comment), latest-result.tsx,
  use-result.tsx → used-result.tsx and tray-words.ts (one return type).
- **No conflicts.** `git merge-tree --write-tree` of local/043-R-b finds none against APP's head
  (7b8eb5d) or against local/043-U1, -U2, -V1 and -V2.
- **No other lane's imports break.**
  - Removed or moved exports: roll-tray.tsx's 10 non-RollTray exports, brief.ts's word functions
    and types, DiceKey, MenuPlace, ModifyDamage's old path, and the three hooks' .tsx paths, plus
    (f338ea5) roll-tray/use-result's UseResult, which is new in commit 16. None is imported by any
    non-R-b file on APP's head or on the four lane branches.
  - The three hooks moved .tsx → .ts, but import specifiers carry no extension, so no importer
    changes.
- **Names other lanes import keep their path and name:** RollTray, RollToasts, RollsButton,
  RollButton, ChoiceMenu, ModifyRoll, useD20Rolls, useDamageMenu, useDiceEntry, useToastSetting,
  useToastTop, briefOf, shownTotal, formulaOf, choiceItem, placing, pointOn, pointWithin, TOASTS_KEY,
  TOAST_FOR, reasons, REASONS and listed.
- **react-hooks line disables:** this lane adds 1 (use-roll-toasts.ts:54). With U1's 2 and V1's 4 on
  their branches, that makes 7, the §1.7.3 budget.
- **owners.tsv bookkeeping (RB-2; the orchestrator's, before check B):**
  - Add rows (lane R-b, phase 3) for src/features/rolling/components/d20-rolls/types.ts (R1.2.10),
    damage-menu/types.ts and roll-menu/types.ts. R1.2.10 made all three (the review suggests R1.2.10 / R1.2.8 / R1.2.12b; either serves).
  - Point at current paths: row 174 (damage-menu/damage-menu.tsx → now
    modify-roll/modify-damage.tsx, git R088), row 273 (use-dice-entry.tsx → .ts), rows 705-706
    (use-d20-rolls.tsx and use-damage-menu.tsx → .ts).
  - roll-tray/used-result.tsx is covered by glob row 716. Nothing to add for it.
  - Row 717's plan for use-toast-setting.ts and use-toast-top.ts: see Phase 4 item 1 (FR/hooks/
    preferred).
- **R-a's Phase 4 item 1** retargets the gmRollsOf import lines in my roll-toasts.test.tsx and
  roll-tray.test.tsx. That is fine by me.
- **Gate 9 keys:** none. No folder's warnings moved in this round (624 before and after).
- **Bookkeeping:** no moves.d/R-b.tsv. No gate allowlist rows or ratchet keys are needed.
