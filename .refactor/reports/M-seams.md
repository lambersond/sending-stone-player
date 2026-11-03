# Report: builder M, WS4 export moves and seams (v0.43, Phase 2b): commits 7 and 8

- **Worktree:** /home/user/w043/M/sending-stone-player, on local branch `local/043-M`. I rebased it onto APP's head b6dbe49 before starting.
- **Status:** commits 7 and 8 are made, plus one chore(refactor) commit that records their moves. The worktree is clean.
- **This round returns ok: false.** The L1 with APP's tools as they are now is not all green. Gates 9 and 11 fail at commits 7 and 8, and gate 1b fails at commit 8. In each case the cause is a planning file in APP, not code on the branch. With the three additions below (all in X/handoff), every check and gate is ok at commit 8, and gates 9 and 11 are ok at commit 7.
- **Nothing was pushed.** My only write in APP was an append to R/bugs-found.md, made under bugs.lock. Because of it, `git -C APP status` shows ` M .refactor/bugs-found.md`. A landing script that needs a clean APP must commit that first.
- **Scratch:** /tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/m3/ holds:
  - the codemod logs: em-c7.out/.err/.time and em-c8.out/.err;
  - the spec: spec-c7.tsv;
  - the commit messages;
  - the drafts;
  - next/: a copy of APP's tools with all three additions.

## Commits on local/043-M (to land in this order)

| SHA | subject |
|---|---|
| 14b2ab4 | refactor: names other areas import, moved to their homes (export moves only) |
| 24d2c43 | refactor: cross-area seams (onItsWay, polling constants, useFollow, useSendChoice, NOT_MADE) |
| c2ed41f | chore(refactor): commits 7 and 8's export moves recorded in moves.tsv |

## READ FIRST, orchestrator and lander: three things APP needs before the landing L1

The gates read these files from APP's R/tools and R/analysis (gate-lib.mjs:16-17, `TOOLS`/`ANALYSIS`), not from the checkout. That is why no commit on the branch can turn these gates green. It is the same situation as commit 5's ratchet (492f51b).

### 1. R/tools/moves.tsv: this branch's records (gates 11, 1b, 7)

- **Step:** `git -C /home/user/sending-stone-player checkout c2ed41f -- .refactor/tools/moves.tsv`, then commit it by pathspec. The rebase then applies c2ed41f's identical change cleanly.
- **Why gate 11 needs it:** export-move removed 13 component files that were left empty. Their `delete` rows are what tell gate-lib.mjs:252 that the base file is gone. Without them, git's -M50% matches 5 of those files to their largest piece. Gate 11 then reports "'use client' at the base, none now" for use-cookbook-entry.tsx, use-d20-rolls.tsx, description-actions/types.ts, use-give-controls.tsx and use-remove-controls.tsx. By §1.0 rule 9, those 5 modules must carry no directive.
- **Gates 1b and 7** use the `name` rows (483).
- **Justification:** round.md §3.4: "Paths are followed through … R/tools/moves.tsv (the codemods' own record)". Amendment 1 (b): "gate-lib honours moves.tsv's `delete` rows".

### 2. R/analysis/ratchet-moved.json: two keys raised (gate 9)

The diff is in X/handoff/m-ratchet-moved-commit7.diff, and `git apply --check` passes in APP. The whole file is in X/handoff/m-ratchet-moved-commit7.json.

```
byFolder["src/utils"]["sonarjs/cognitive-complexity"]                  18 → 19
noRestrictedSyntaxByCheck["src/features/sheet"]["ts-type-export"]       5 → 14
```

Each raise matches a fall elsewhere, caused by a move round.md requires:

- **CC +1 in src/utils:**
  - `follow` (cognitive complexity 25) moves from FR/hooks/use-table-rolls.ts to src/utils/lifecycle.ts. This is R1.9.1's own list.
  - src/features/rolling's count falls by the same amount, 11 → 10.
  - R-a's Phase 3 work on the lifecycle is where it shrinks.
- **ts-type-export +9 in src/features/sheet:**
  - 10 exported types left .tsx files for a use-*.ts or constants.ts and are now reported as ts-type-export: Layout, ConcentrationActions, ShowConditions, EndEnchantment, EnchantActions, Favorites, Preparations, Op, View and WildShapeValue.
  - Each one either went with the hook that uses it (the tool's "carried" names) or was exported back from it (helpers both sides use).
  - One base finding left the sheet: Belonging, which moved to FS/types.ts. So the net rise is 9.
  - In the same unit, tsx-type fell 80 → 40, one-export 173 → 77 and utility-export 69 → 49.
  - The U1 and U2 lanes' type placements in Phase 3 settle them.
- **Every rule's total falls or stays:** 981 → 661 warnings, 0 errors. Commit 8 adds no warning.
- **Why a max-merge, not a re-take:** a ratchet re-taken at commit 7 would fail the replay of commits 5 and 6, whose sheet counts are higher. Raising only these two keys keeps commits 5 and 6 under the ratchet, and makes commits 7 and 8 pass.
- **The alternative:** a third ratchet that gate 9 picks from commit 7 on. That is a gate-9.mjs change, so it is the orchestrator's call.
- **round.md has no planned row for this.** §3.4 gate 9 foresees only the commit-5 re-take. That gap is logged in bugs-found.md.

### 3. R/tools/gate1b.allow: six rows for R1.9.3 (commit 8)

The rows are ready to append, in X/handoff/m-gate1b-rows-commit8.tsv. Each row has its reason.

| file at base | mock path | why |
|---|---|---|
| src/components/game-table/game-table.endturn.test.tsx | `@/hooks/use-table-view` and `@/features/table/hooks/use-table-view` | R1.9.3 drops the stale `POLL_INTERVAL: 3000` key of this use-table-view mock. Gate 4 fails on it once the constant has moved. `useTableView: jest.fn()` is kept. Fact 14: the same value, gate 2 equal. |
| src/components/game-table/game-table.companions.test.tsx | the same two paths | the same reason |
| src/components/game-table/turn-toast.test.tsx | `@/hooks/use-table-view` and `@/constants/polling` | round.md §3.4's planned "R1.9.3's turn-toast retarget": the full mock now targets `@/constants/polling`, with a `requireActual` spread, and `POLL_INTERVAL: 3000` kept |

- **Why two rows per file:** a `mock` row drops the jest.mock with that path text from both sides, and the path text differs between the base and the head.
- **The turn-toast rows** are needed only while APP's moves.tsv lacks the POLL_INTERVAL name row. With item 1 in place, gate 1b already passes that file through its moved-key rule.
- **Checked both ways:** with these rows, gate 1b is ok against APP's moves.tsv as it is (X/l1/M/c8-rows), and also with item 1 applied.

### Proof

I made a scratch copy of APP's R/tools and R/analysis. Per `diff -rq`, it differs from APP only by items 1-3. Running it against commit 8's L1 outputs (outdir X/l1/M/c8-final), every gate is ok:

- 1, 1b, 2, 3, 4, 4b, 5, 6, 7, 8;
- 9: 661 warnings against 981;
- 10: 991 golden tests, 24 frozen files;
- 11: 474 modules, 156 server modules, 17 client boundaries;
- 12: 3 groups, against 4 at the base.

At commit 7 (X/l1/M/c7-next), with items 1 and 2 applied, gates 9 and 11 are ok and every other gate is as in the L1.

## Commit 7 (R1.9.1 + R1.9.5): export moves only

### How

`node APP/.refactor/tools/export-move.cjs --root <worktree> --spec m3/spec-c7.tsv` took 16 min 54 s, including 4 lint-fix rounds under the locks, with 0 errors left.

The spec is `--print-spec` over APP's owners.tsv (170 rows), minus one row:

- **The row removed:** POLL_INTERVAL. It moves in commit 8 instead (deviation 1).
- **C-a's names are already in the list:** `briefOf` (→ FR/utils/brief.ts) and `reasons`, `REASONS`, `listed` (→ src/utils/roll-reasons.ts), all from roll-tray.tsx. The goldens' imports of them now point there.
- **The other names C-a lists do not leave their modules in v0.43:** useSheetRoller, TableApiContext, turnRefusedLine, TURN_REFUSALS, toTableSheet, the db functions and parseGameEvent. Their paths are final after 2b. The *types* of useSheetRoller moved to src/types/roll.ts, and the goldens import them there.
- **T, W-a and C-b** asked for no names.
- **Amendment 1 (a) holds through owners.tsv:**
  - AttackSource, OfferSpend, SheetOffer and EffectAsk went to src/types/roll.ts;
  - SocialProviderId stays in auth-providers.ts;
  - LINK_CLASSES went to src/constants/sending-stone.ts.

### Totals

- **Rows:** 169 run, 2 skipped. NotesPlace moved in commit 5, and use-dice-entry is already at its destination.
- **Names:** 482 moved to 138 destination modules from 70 sources.
- **Carried:** 15 groups (listed below).
- **Exported back:** helpers in 28 destinations.
- **Stale mock keys:** 0.
- **Re-exports dropped:** 1. damage-alone.ts's four Alone* types now come from src/types/roll.
- **Empty sources removed:** 13 (listed below).
- **Commit 7's message is slightly off.** It says "140 destination modules" (round.md's figure). The actual count is 138: round.md's 140 includes the homes of the two skipped rows.

### The diff

- 363 files: 126 added, 7 deleted, 224 modified, 6 renamed.
- **Verbatim check** (m3/bin/verbatim.mjs): every added src line that is not an import or a path is a line of b6dbe49's src, or that line with `export ` in front. The 13 exceptions are:
  - needs-player's 3 mock-path lines;
  - prettier's re-wrap of five `export ` lines (savedAt, verdictWord, thrownAgainThere, PortalRoot, aloneChoicesOf);
  - 3 lines of the useTargetsOf → targetsFor rename. Tests keep the old local name (§0.6.5).
- **R1.9.5:** needs-player.integration.test.tsx's mock, with the requireActual and `typeof import()` inside it, follows damageDue and needsPlayer to `@/features/rolling/utils/damage-due`. The keys are unchanged.
  - Every module that read them from the mocked use-table-rolls now reads them from damage-due, among them brief.ts (cut out of roll-tray), roll-toasts and roll-tray.
  - use-table-rolls no longer uses them.
  - So the mock reaches the same callers as before.
- **Directives:** every new module with `'use client'` is a component .tsx moved out of a `'use client'` file. Gate 11 lists them. Hooks, types, constants and utils carry none.
- **The 13 empty files removed:**
  - d20-rolls.tsx, cookbook-entry.tsx, give-controls.tsx, remove-controls.tsx;
  - in FS/components: actions-layout, conditions-panel, description-actions, effect-controls, enchantments, favorite-mark, hit-dice, party-sheets, sheet-tiles.
- **Goldens:** only their import lines changed. The C1-C9 snapshots are unchanged: `git diff 929c797 HEAD -- '**/__snapshots__/**'` is empty.

### The cycle report (gate 12)

- **3 groups, against 4 at the base.**
- **Group 1 (base: 12 files)** is down to 4 files: src/types/party.ts, roll.ts, sending-stone.ts and table.ts. That is what amendment 1 (c) expects; W-a breaks it in Phase 3 (R1.4.9b).
- **The use-table-rolls ↔ move-words pair is gone.**
- **Left for the lanes:**
  - the transfers pair: move-dialog ↔ recipient-list (R1.5.19);
  - the db group of 6 (R1.3.1).

### L1 (APP's tools; outdir X/l1/M/c7, 11:26-11:33 UTC)

- **Checks:**
  - jest: 301 suites, 9,664 tests, 0 red, 0 flaky;
  - typegen ok;
  - tsc: 0 errors;
  - eslint: 0 errors, 661 warnings (981 at commit 6).
- **Gates ok:** 1, 1b, 2, 3, 4, 4b, 5, 6, 7, 8, 10, 12.
- **Gates FAIL:**
  - 9 (READ FIRST item 2);
  - 11 (item 1).

## Commit 8 (R1.9.2 → R1.9.3 → R1.9.4): the seams

### R1.9.2: onItsWay

- **The helper:** `onItsWay(state?: Pick<TableRollState, 'status'>): boolean`, which is `status === 'sending' || status === 'rolling'`, in src/utils/lifecycle.ts.
- **Adopted at fact 8's 13 sites,** each keeping its other conditions:
  - use-wild-shape, character-pane, use-effect-controls: `if (onItsWay(state)) return true`;
  - favoriting, use-preparing: `(onItsWay(state) || (state.status === 'done' && …))`;
  - action-entry: `const pending = onItsWay(latest)`;
  - end-turn-button: `onItsWay(way) || way?.status === 'done'`;
  - use-end-turn: `onItsWay(way) || isOver(way)`;
  - use-transfers: `if (!onItsWay(state)) continue`;
  - use-give-controls and use-remove-controls: `onItsWay({ status })`, so their loops' destructuring stays;
  - move-status and roll-tray.
- **Import alias at two sites.** roll-tray already imports brief.ts's own `onItsWay(state, role, doing)`, which builds the words for a roll on its way. move-status has a local flag named `onItsWay`. So those two sites import the helper as `isOnItsWay`.

### R1.9.3: polling

- **The move:** POLL_INTERVAL moved by the codemod, as a single row: `--source src/features/table/hooks/use-table-view.ts --dest src/constants/polling.ts --names POLL_INTERVAL`.
  - It touched 21 files. The six product importers and the tests now import it from src/constants/polling.
  - The golden values and wire tests changed only in their import lines.
- **Beside it:** `POLL_MOST_DELAY = 30_000`, the value of the three MAX_DELAYs.
- **New utility:** src/utils/polling.ts `retryDelay(every, failures, most)` = `failures ? Math.min(every * 2 ** failures, most) : every`, the copies' expression. Its table test is src/utils/polling.test.ts (node, 6 cases).
- **Mocks:**
  - turn-toast.test.tsx: `jest.mock('@/constants/polling', () => ({ ...jest.requireActual('@/constants/polling'), POLL_INTERVAL: 3000 }))`;
  - game-table.endturn and .companions: their use-table-view mocks' `POLL_INTERVAL: 3000` keys are dropped. The codemod listed both as stale.
- **Left for the lanes** (§1.9.3 says "retryDelay's adoption is the lanes'"):
  - retryDelay itself, and the three `MAX_DELAY`s → POLL_MOST_DELAY;
  - use-table-view is V1's file; use-notes and use-party-sheet are V2's.
- **B20 loses its cause.** game-table.test and .party now read the real POLL_INTERVAL. Gate 2 is equal, every base test passing with at least its base asserts, as fact 14's probe said. Their gate4b.allow POLL_INTERVAL rows now match nothing and can go.

### R1.9.4: useFollow, useSendChoice, NOT_MADE

- **src/hooks/use-follow.ts:** `useFollow()` returns `follow(api, input, onState, onTaken?)`. It is stable across renders.
  - It owns what the four copies share: the controllers set, the abort on unmount and the aborted guard.
  - A caller that told `{ status: 'sending' }` first still does so itself.
  - It carries no directive.
- **src/hooks/use-follow.test.ts:** two tests.
  - Test 1 covers the send, the follow, onTaken, and the same function across renders.
  - Test 2 checks that an unmount aborts the request's signal, and that an answer arriving after it is told to no one.
  - **Mutation check:** I removed the guard, and separately the abort. Each makes one test fail. Both edits were reverted.
- **FR/hooks/use-send-choice.ts:** `useSendChoice(gm)` = `useStoredChoice(gm ? GM_SEND_KEY : SEND_KEY, SEND_CHOICES, 'on')`.
  - Its test is FR/hooks/use-send-choice.test.ts, table-driven. It checks the player's and the Gamemaster's keys, read raw (`sending-stone:send-rolls`, `…:gm`), with the value on until turned off.
- **NOT_MADE:** it already sits beside SETTLED in src/constants/lifecycle.ts. It moved there from turn-toast in commit 7 (owners.tsv's 2b list), so commit 8 had nothing more to do for it.
- **Not adopted yet** (§1.9.4: "adopted in Phase 3"): the four follow copies (use-table-rolls :290, use-transfers, use-end-turn, use-turn-undo) and the three choice copies.

### L1 (APP's tools; outdir X/l1/M/c8, 11:39-11:45 UTC)

- **Checks:**
  - jest: 304 suites, 9,674 tests, 0 red, 0 flaky;
  - typegen ok;
  - tsc: 0 errors;
  - eslint: 0 errors, 661 warnings. Against commit 7 there is no change in any unit, rule or check, and the new files have no findings.
- **Gates ok:** 1, 2, 3, 4, 4b, 5, 6, 7, 8, 10, 12.
- **Gates FAIL:**
  - 1b: exactly the three R1.9.3 mocks (READ FIRST item 3);
  - 9 (item 2);
  - 11 (item 1).
- **With items 1-3:** all gates ok (Proof, above).

### `next build` (commit 8's tree; under both locks; X/l1/M/c8/build.log)

- Exit 0: compiled, TypeScript finished, every route listed.
- The log has the same Better Auth and Prisma env messages as commit 6's build: no .env in the worktree, during page-data collection.

## react-hooks findings in the files I touched

- **None new.**
- **Gone:** sheet's rules-of-hooks count fell 7 → 5. The two that went are use-picker.tsx's `useTargetsOf` findings, fixed by the rename to targetsFor (fact 18).
- **Still there, a base finding:** use-end-turn.ts's preserve-manual-memoization, mapped from owners.tsv's `@175`.

## Deviations from round.md, and why

1. **POLL_INTERVAL moves in commit 8, not commit 7.**
   - **Why:** owners.tsv's 2b list would move it in commit 7. But two use-table-view mocks keep a `POLL_INTERVAL` key that R1.9.3 drops in commit 8, so commit 7 alone would fail gate 4 (stale keys).
   - **Effect:** moving it with R1.9.3, by the same codemod, keeps commit 7 green alone with its "one mock path" (needs-player). All of §1.8.3's polling mock changes are now in commit 8, as §1.8.3 places them.
   - **What it means for the replay:** commit 7 replays green, apart from APP's planning files, which must be in place.
2. **Gate 9 needs two ratchet keys raised** (READ FIRST item 2). round.md plans no re-take after commit 7.
3. **No owners.tsv change.** The 13 removed sources still have rows, with a `path_after` that is gone. The owners check after commit 8 (§2.2.3) should drop or redirect those rows. I did not edit owners.tsv: it is not my file.
4. **The moves.tsv records are in their own chore(refactor) commit** (c2ed41f) after commit 8, as for commit 5. One hand edit: the codemod's single-row mode recorded the POLL_INTERVAL row's `base` as its current path. I set it to `src/hooks/use-table-view.ts` (logged as a tooling note).
5. **Commit 7's message says 140 destination modules; the actual is 138** (see Totals).

## Bugs

- **App:** none found.
- **Tooling:** I appended notes to R/bugs-found.md under bugs.lock, in a new "[M] Export moves and seams" section:
  - the gate-9 ratchet gap after commit 7;
  - export-move's `--source` mode `base` field;
  - a line-number correction to the second note.

## For later workstreams

- **The orchestrator:**
  - READ FIRST items 1-3 before the landing L1.
  - The e2e pass 2 (commits 5-8) is yours; I ran none.
  - Two of gate4b.allow's base rows now match nothing: game-table.test and .party, POLL_INTERVAL on use-table-view.
- **R-a:** adopts useFollow at use-table-rolls's `start`. startEach and readWildShapeForms await `follow` directly, so they keep their own controllers. R-a also adopts useSendChoice at use-table-rolls's `useStoredChoice(gm ? GM_SEND_KEY : SEND_KEY, …)` call.
  - src/utils/lifecycle.ts holds follow, labelled, refusal, pause and onItsWay.
  - src/constants/lifecycle.ts holds the timings, SETTLED and NOT_MADE.
  - `follow`'s cognitive complexity (25) now counts in src/utils.
- **R-b:**
  - brief.ts (FR/utils) holds briefOf, plus roll-tray's helpers that were exported back. That includes a words function also named `onItsWay`, which roll-tray imports beside lifecycle's `onItsWay as isOnItsWay`; renaming brief's function would remove the alias.
  - brief.ts also keeps its own private NOT_MADE set (fact 16; §1.10 leaves that two-copy merge out).
  - src/utils/roll-reasons.ts holds reasons, REASONS, listed, reasonsOf and REASONS_BY_ROLE.
- **V1:**
  - use-end-turn and use-turn-undo adopt useFollow and useSendChoice.
  - use-table-view adopts retryDelay and POLL_MOST_DELAY.
  - turn-toast's NOT_MADE now comes from src/constants/lifecycle.
- **V2:**
  - use-transfers adopts useFollow.
  - use-notes and use-party-sheet adopt retryDelay and POLL_MOST_DELAY.
  - src/constants/polling.ts and src/utils/polling.ts are yours from Phase 3 on (owners.tsv).
- **U1 and U2:** the carried and exported-back types in sheet hooks and constants (the list in READ FIRST item 2) are where your type placements find them.
- **Every lane:** a name that 2b moved has its final path now (§2.2.2). The carried names sit beside the hook that uses them:
  - RollDue → FR/types;
  - DamageActions, UseActions, DamageTarget, DamageUse → action-entry/types;
  - Asking → description-actions/types;
  - Layout → actions-layout/constants;
  - LAYOUT_KEY → use-actions-layout;
  - refusal → utils/lifecycle;
  - gmRollsOf → use-gm-rolls;
  - RollBrief, rechargeTitle, shownTotal, GM_WORDS → FR/utils/brief;
  - selfTarget, targetsOf, SELF → use-picker/utils;
  - ConcentrationActions → use-concentrating;
  - ShowConditions → use-show-conditions;
  - EnchantActions, EndEnchantment → use-enchanting;
  - NO_PREPARING → use-prepare-choice;
  - WildShapeValue, LAST_FORM_KEY → use-wild-shape;
  - NONE_LEFT, FULL_HP → hit-die-use.tsx.
