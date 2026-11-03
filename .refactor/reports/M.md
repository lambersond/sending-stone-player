# Report: builder M, WS1c Codemods (v0.43, Phase 1)

- **Worktree:** /home/user/w043/M/sending-stone-player, on branch `local/043-M`. It was created from dd3a2ad and fast-forwarded to APP's 569674b before the commit. It is kept for Phase 2.
- **Nothing pushed.**
- **Scratch worktree:** the dry run ran in /home/user/w043/M-trial, now removed (`git worktree remove --force`).
- **Logs and scripts:** /tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/m/:
  - trial.sh: the dry run.
  - spec-trial.tsv: the spec with the proposed changes.
  - wa/: the gate scripts copy.
  - trial-final-logs/: the last run's logs (L1 outdir trial-final-logs/l1).
  - The proposed spec and gate patch are also in X/handoff/: m-export-moves-proposed.tsv, m-export-moves-proposed.diff and m-gate-lib-delete-rows.diff.

## Commit

| SHA | subject |
|---|---|
| c635c6a | chore(refactor): the move codemods (round.md §1.0, §1.9.1) |

Files: `.refactor/tools/move.cjs` (new) and `.refactor/tools/export-move.cjs` (new). Planning files only. The commit does not include `moves.tsv`: W-a's commit created it, and the codemods append to it (handoff/moves-format-ack.txt).

## The tools

### move.cjs (commit 5, R1.0.1)

```
node .refactor/tools/move.cjs --root <checkout> [--owners <owners.tsv>] [--check-ts N]
node .refactor/tools/move.cjs --root <checkout> --verify
```

1. **Reads owners.tsv.** It takes 325 moves: the rows whose `path_after` is another path. The two `src/utils/roll-requests*` rows keep their path, so round.md's "354" is 325 moves plus 27 barrels plus those 2. The 27 barrels are the `DELETED (barrel…)` rows.
2. **The one barrel with a declaration.** `components/notes/index.ts` declares NotesPlace. NotesPlace goes first to its 2b home, `src/features/notes/types.ts`, using export-move's code, so the barrel holds only re-exports (deviation 3).
3. **Unbarrel.** Every import or `export … from` through a barrel points at the declaring module, in the old specifier's style:
   - A line that took names from several modules is split, one line per module.
   - Import types are followed too.
   - The seven barrel jest.mock factories follow their keys' module, with the requireActual and `typeof import()` inside them. A requireActual whose destructured names all come from one module follows too.
   - The barrels are then `git rm`ed.
4. **Re-specify, in one pass for all moves at once.** This covers every module specifier: import, export-from, `import()`, `typeof import()`, `jest.mock`, `doMock`, `unmock`, `requireActual`, `requireMock` and `require`.
   - A relative specifier stays relative, recomputed from the file's new folder. An `@/` one stays `@/`.
   - A string that is a moved file's repo path is set to the new path. Two tests read their unit's source this way: prompt-banner.test.tsx:151 and end-turn.test.ts:255.
5. **Write.**
   - `git mv` for each file, so history follows. `git rm` for each barrel.
   - Then eslint's own fixers, for the import-format rules only: prettier, import/order, import/no-duplicates, import/newline-after-import, no-multiple-empty-lines.
   - eslint runs under `flock X/l1-wait.lock flock X/checks.lock`, for up to 5 rounds.
   - A test's leading `@jest-environment` docblock is checked to still be first.
6. **Record.** moves.tsv gets a `file` row per move, a `delete` row per barrel and the NotesPlace `name` row.
7. **Checks.**
   - `--verify` compares every staged rename or modification with HEAD. It cuts imports and blanks module paths and moved-file path strings. It then ignores whitespace and trailing commas, because prettier re-wraps a line that a longer path pushes past 80 columns.
   - `--check-ts N` checks the specifiers against TypeScript's getEditsForFileRename on N of the moves.

### export-move.cjs (commit 7, R1.9.1)

```
node .refactor/tools/export-move.cjs --root <checkout> [--owners <owners.tsv> | --spec <tsv>]
node .refactor/tools/export-move.cjs --root <checkout> --source <path> --dest <path> --names 'a b old=new'
node .refactor/tools/export-move.cjs --print-spec --owners <owners.tsv>
```

**The spec.**
- It is read from owners.tsv's "moved in 2b: … ← …" and "receives in 2b: … ← …" notes, giving 169 rows.
- One row is added: `useTargetsOf=targetsFor` on the use-picker/utils.ts row, as §1.9.1 says. owners.tsv has no note for it.
- A `*` means every exported type of the source. use-sheet-roller has 13 exported types.
- Each source is mapped through moves.tsv's `file` rows to where commit 5 put it.
- **Order:** rows run by tier: src/types, then types.ts files, constants, utils, hooks, then components. A row waits while its names use those of a later row of the same source. So, for example, a hook moves after the components it renders, and nothing is carried into the wrong home.

**Per row:**
1. **Rename.** A rename is done first, inside the source, with the LanguageService's rename locations. Importers keep their local name: `import { targetsFor as useTargetsOf }`.
2. **Closure.** It is built with TypeScript's own `getUsageInfo`, the analysis of its "Move to file" refactor.
   - Every file-private top-level declaration the moved code uses moves too. One that staying code also uses is exported from the destination and imported back by the source.
   - TypeScript's default is never taken (fact 26). That default exports the helper from the source and imports it into the destination.
   - **Carried names.** An *exported* name that stays, which the moved code uses, is carried along when the source still needs the destination after the move. Otherwise source and destination import each other (gate 12). It is reported.
   - Values are never carried into a types module. A value read with `typeof` is imported with `import type` instead.
3. **Text cut and paste.**
   - Statements move as text, with their attached comments. No line inside a moved declaration changes, except `export ` before a helper the source imports back.
   - Prettier may re-wrap such a line if `export ` pushes it past 80 columns.
   - The destination gets the source's own import lines that the moved code needs, re-specified.
   - **Directives:** the destination gets `'use client'` only if it is a component .tsx moved out of a `'use client'` file (§1.0 rule 9).
   - The source drops the import bindings that only moved code used, and imports back what it still uses.
   - A source left with nothing but directives and imports is `git rm`ed and recorded as `delete`.
4. **Importers.** Every importer imports the moved names from the destination, in its old specifier's style. This includes tests, `export … from`, `import()` and `typeof import()` qualifiers.
   - There is one declaration per module, with inline `type` (no-duplicate-imports).
   - A re-export of a moved name is dropped, and its importers import the name from the destination (gate 7). Example: damage-alone.ts re-exported the four Alone* types.
   - A jest.mock or doMock whose factory keys all moved to one destination follows them, with the requireActual and `typeof import()` inside it. Example: needs-player → damage-due, R1.9.5.
   - A factory whose keys moved only in part is listed as stale, not changed.
   - A requireActual whose names all moved follows them. The names are the destructured ones, or the `actual.x` reads, found by symbol.
5. **Lint, as in move.cjs.** Then `name` rows go to moves.tsv, one per moved name: those asked, carried and helpers.

## Dry run: a scratch worktree at 569674b (commit 2 in, with the kit and C9)

All in /home/user/w043/M-trial, with node_modules symlinked from M's worktree, at APP's head 569674b.

**Gates.** The gates are W-a's scripts, copied from APP's R/tools into /tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/m/wa/.refactor/tools/. The copy differs in two ways:
- its moves.tsv holds the trial's rows, because the gates read moves.tsv beside themselves;
- it has a 2-line patch so `delete` rows count (see "For the orchestrator / W-a" below).

**Final run.** One fresh run, end to end. The worktree was created at 08:59 UTC, and the L1 ended at 09:31:46 UTC.

### After move.cjs (commit 5)

- **Totals:** 325 file moves and 27 barrels. 883 specifiers changed in 276 files, and 102 barrel import lines and mocks. The lint fix touched 297 files and left 0 errors.
- **Timing:** 10 s of compute, plus the eslint fix under the locks (274 s with the lock waits).
- `--verify`: 399 files compared, **0 differ** beyond imports and paths. 326 renames (all 325 moves are detected as renames), 26 deletions (27 barrels; notes/index.ts is detected as renamed to features/notes/types.ts).
- `--check-ts 3`: on the unmoved program, TypeScript's getEditsForFileRename and move.cjs give the **same** specifiers for all 3 sampled moves.
- **An earlier run on dd3a2ad,** with a full L1 using W-a's l1.sh:
  - **Clean:** tsc 0 errors, eslint 0 errors, gates 11 and 12 ok, gates 1-8 and 10 ok.
  - **Jest:** 290 of 290 suites ran; 2 tests were red. They are the two tests that read their source by path, which move.cjs now follows.
  - **Gate 9 FAIL:** there is no ratchet-moved.json yet. It is taken in Phase 2, after commit 5.
- **The second run on 569674b:** one L1 overlapped by mistake with export-move's write. Its jest ran 07:40-07:44 UTC on the moved tree, before export-move wrote at about 07:45: 293 suites and 8,954 tests, 0 red. Its later steps saw half-written files, so they are not counted.

### After export-move.cjs (commit 7)

This run used owners.tsv's list plus the three changes proposed below (X/handoff/m-export-moves-proposed.tsv, and .diff against owners).

- **Totals:** 170 rows (2 skipped: NotesPlace, done in commit 5, and use-dice-entry, whose source is already its destination). 496 `name` records. 361 files written (133 added, 39 deleted, 125 modified, 313 renamed against 569674b).
- **Timing:** about 6.5 min of compute, plus the eslint fix: 4 rounds, 0 errors left.
- **Verbatim check:** every new or changed line in src that is not an import, a mock path or a path string is a line of 569674b's src, except these:
  - 61 lines that are a base line with `export ` in front (helpers the source imports back);
  - 16 others:
    - prettier's re-wrap of a few of those `export ` lines past 80 columns (brief.ts savedAt, verdictWord, thrownAgainThere; use-portal-root's PortalRoot);
    - the join page test's re-wrapped barrel mock;
    - the prompt-banner path string;
    - the `targetsFor(` call in use-picker.tsx.
- **The report's lists:**
  - carried: 15 groups (see deviation 4);
  - exportedBack: 28 destinations;
  - stale mock keys: 2 (POLL_INTERVAL, see below);
  - emptied sources removed: 13;
  - re-exports dropped: 1 (damage-alone.ts's four Alone* types; their importers now import src/types/roll);
  - cycles left: types/table ↔ types/roll, and types/roll ↔ types/sending-stone.
- **L1** with W-a's l1.sh (copy), 09:26-09:31 UTC:
  - **jest ok:** 293 suites and 8,954 tests, 0 red, 0 flaky. Gate 2 ok: every one of the 8,607 base tests passed, with ≥ base asserts.
  - **tsc:** 0 errors (typegen ok).
  - **eslint:** 0 errors, 661 warnings (999 at the base).
  - **Gates ok:** 1, 2, 3, 4b, 5, 6, 7, 8, 10, **11** and **12**.
    - Gate 11: 471 modules, 156 server modules (base 161), 17 client boundaries. It needs the gate-lib `delete` patch below; without it, it FAILs on the 5 hook and types modules named there.
    - Gate 12: 3 cycle groups (base 4). Group 1 shrinks from 12 files to 4, the src/types files only. The use-table-rolls ↔ move-words group is gone.
  - **Gates FAIL, all known:**
    - gate 1b: 2, the two path strings (gate1b.allow rows asked below).
    - gate 4: 2, POLL_INTERVAL keys on use-table-view mocks, which R1.9.3 drops in commit 8.
    - gate 9: ratchet-moved.json is not taken yet.
- **Earlier runs, which shaped the tool:**
  - Without the three spec changes, gate 12 FAILed with two new groups: (a)'s 10-file group, and auth-providers ↔ types/auth.
  - Before the type-only fix (deviation 2), jest had 168 red and 21 suites did not run.

I did not run a separate L1 on the commit-5-only tree at 569674b. `--verify` was clean, and the full L1 above covers commit 5's edits too. The earlier commit-5-only L1 at dd3a2ad is described above.

## Deviations from round.md, and why

1. **move.cjs does not call getEditsForFileRename per rename.** That call took 54 s per rename on this program, measured twice: 327 renames would take about 5 h. move.cjs makes the same edit in one pass: TS module resolution for each specifier, then the specifier recomputed in the old one's style. `--check-ts` shows the edits are the same as TypeScript's. It also covers jest paths in the same pass.
2. **export-move.cjs does not use TypeScript's "Move to file" for the edit itself.** That refactor takes one contiguous range, reprints the moved nodes rather than copying their text, and takes fact 26's default. It uses TypeScript's `getUsageInfo` (the refactor's own analysis) for the closure and the imports, and moves text.
   - **A TypeScript 5.9 bug found here:** getUsageInfo's type-only flags keep the *last* reference's answer. Its oldImportsNeededByTargetFile even ANDs with the stored `[flag, declaration]` pair, which is always truthy.
   - So a value whose last use was `typeof X` became `import type { X }`. tsc refused it, and jest's transform dropped it: `LAYOUTS is not defined` and `CHECK_TYPES is not defined` in 23 suites in an early run.
   - The tool now ANDs every reference itself (`typeOnlyUses`).
3. **NotesPlace moves in commit 5, not commit 7.** Its barrel (components/notes/index.ts) is deleted in commit 5, and NotesPlace is the barrel's only declaration. export-move skips that row in commit 7, because moves.tsv shows it done.
4. **Carried names.** 15 groups of exported names are not in owners.tsv, but must move with the names that are, or the source and destination import each other. The tool reports them:
   - **roll-tray → FR/types:** RollDue.
   - **action-entry → action-entry/types:** DamageActions, UseActions, DamageTarget, DamageUse.
   - **description-actions → description-actions/types:** Asking.
   - **actions-layout:**
     - → constants: Layout.
     - → use-actions-layout: LAYOUT_KEY.
   - **use-table-rolls:**
     - → utils/lifecycle: refusal.
     - → use-gm-rolls: gmRollsOf.
   - **roll-tray → FR/utils/brief:** RollBrief, rechargeTitle, shownTotal, GM_WORDS.
   - **use-picker → use-picker/utils:** selfTarget, targetsOf, SELF.
   - **concentration → use-concentrating:** ConcentrationActions.
   - **conditions-panel → use-show-conditions:** ShowConditions.
   - **enchantments → use-enchanting:** EnchantActions, EndEnchantment.
   - **preparing → use-prepare-choice:** NO_PREPARING.
   - **wild-shape → use-wild-shape:** WildShapeValue, LAST_FORM_KEY.
   - **hit-dice → hit-die-use.tsx:** NONE_LEFT, FULL_HP.

   Their new homes are where the lanes find them in Phase 3. Some are types or constants in a hook or component file, which the lanes' own splits then place.
5. **Sources emptied by owners.tsv's 2b list are deleted in commit 7.** An empty file is a `unicorn/no-empty-file` error. There are 13, all under src/features:
   - **rolling:** d20-rolls/d20-rolls.tsx.
   - **cookbook:** cookbook-entry/cookbook-entry.tsx.
   - **transfers:** give-controls/give-controls.tsx, remove-controls/remove-controls.tsx.
   - **sheet/components:** actions-layout.tsx, conditions-panel.tsx, description-actions.tsx, effect-controls.tsx, enchantments.tsx, favorite-mark.tsx, hit-dice.tsx, party-sheets.tsx, sheet-tiles.tsx.

   Each one's owners.tsv `path_after` names a file that will not exist after commit 7.
6. **checkName** is listed under `utils/table-view.ts`, but it is declared in `utils/description-links.ts`; table-view only imports it. It stays where it is declared, and ask-words.ts imports it from there.
7. **Two test lines change outside setup.** These are the repo-path strings in prompt-banner.test.tsx:151 and end-turn.test.ts:255 (see "For the orchestrator / W-a").

## For the orchestrator / W-a (asked, not done)

- **Proposed owners.tsv changes:** three changes for gate 12, found by the dry run. With them, gate 12 is ok; without them, it FAILs.
  - (a) **AttackSource** (use-table-rolls) and **OfferSpend, SheetOffer, EffectAsk** (FR/utils/effect-dice) go to `src/types/roll.ts`, not FR/types.ts.
    - Why: use-sheet-roller's Local* types go to src/types/roll.ts and use these four. Otherwise src/types/roll.ts imports two feature modules (zone 4).
    - Without it, a new cycle group of 10 forms: FR/types.ts, FR/utils/effect-dice.ts, types/{party,roll,sending-stone,table}, utils/{description-links,dice-modifiers,formulas,roll-modifiers}.
  - (b) **SocialProviderId** stays in `src/auth-providers.ts`, so drop its 2b row.
    - Why: it is `keyof ReturnType<typeof socialProviders>`. In src/types/auth.ts it makes a type cycle with auth-providers.ts, which uses it.
  - (c) **LINK_CLASSES** (utils/description-links.ts) goes to `src/constants/sending-stone.ts` before LinkClass (`(typeof LINK_CLASSES)[number]`) goes to types/sending-stone.ts.
    - Why: otherwise src/types imports src/utils (zone 4), and group 1's description-links leg stays.
  - The dry run used these three as spec-trial.tsv. export-move takes the same rows from owners.tsv once they are there.
- **Group 1 is not gone after commit 7,** even with (a)-(c). src/types/{party,roll,sending-stone,table} stay a 4-file cycle:
  - roll.ts needs table.ts and sending-stone.ts types for the Local* family;
  - table.ts needs roll.ts types.
  - Gate 12 passes, because the group shrank (12 → 4) inside base group 1. But §3.4's "group 1 is gone after commit 7" and §1.9.1 (3)'s "sending-stone imports neither party nor roll" do not hold: someone must still break it, W-a in Phase 3 or a Phase 4 item.
- **gate-lib.mjs: follow `delete` rows.**
  - Without it, a source that export-move deleted is matched by git's -M50% to its largest piece. Gate 11 then reports "'use client' at the base, none now" for 5 hook and types modules, which by §1.0 rule 9 must carry no directive: use-cookbook-entry.tsx, use-d20-rolls.tsx, description-actions/types.ts, use-give-controls.tsx, use-remove-controls.tsx.
  - The 2-line patch I used, in `head()`: `if (row.kind === 'delete') map.set(row.base, null)` in the forward map, and `if (forward.get(basePath) === null) return undefined` before the candidates.
- **gate1b.allow rows for commit 5:**
  - `src/components/character-sheet/prompt-banner.test.tsx` (now src/features/sheet/components/prompt-banner/prompt-banner.test.tsx:151): reason "reads its unit's source by repo path; the path follows the move".
  - `src/utils/end-turn.test.ts` (now src/features/table/utils/end-turn.test.ts:255): same reason.
- **Gate 4, expected after commit 7:** game-table.companions:24 and game-table.endturn:24 still mock `POLL_INTERVAL` on use-table-view, which no longer exports it. R1.9.3 drops both keys in commit 8. turn-toast.test's whole mock follows POLL_INTERVAL to `@/constants/polling` in commit 7; R1.9.3 then adds the spread.
- **Gate 9** needs ratchet-moved.json, taken after commit 5 (`run.sh moved`, my Phase 2 step).

## For later workstreams (Phase 2, M)

- **Commit 5:**
  1. `node .refactor/tools/move.cjs --root <M worktree> --owners /home/user/sending-stone-player/.refactor/owners.tsv`. It takes the locks itself for eslint.
  2. Then `--verify` and L1.
  3. The diff is all renames plus import, mock-path and the two path-string lines.
- **Commit 7:**
  1. `node .refactor/tools/export-move.cjs --root <M worktree> --owners <APP owners.tsv>`, after the orchestrator updates owners.tsv for (a)-(c) above. About 7 min of compute, plus the eslint fix.
  2. Read its JSON report:
     - `carried`: names moved beyond the list;
     - `exportedBack`: helpers exported from their new home;
     - `stale`: mock keys left;
     - `notes`: emptied sources removed, cycles left, re-exports dropped.
- **Re-running:** neither tool is idempotent on a moved tree, so start again from a clean checkout. export-move skips rows that moves.tsv shows done, and rows whose source already is the destination.

## Bugs

None found in the app. I did not append to bugs-found.md.

Tooling notes, not app bugs:
- TypeScript 5.9's getUsageInfo type-only flags (deviation 2).
- getEditsForFileRename takes about 55 s per call on this 770-file program.
