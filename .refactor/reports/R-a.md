# Report: builder R-a, Phase 3 lane (v0.43): commit 15 and fix round 1

- **Worktree:** /home/user/w043/R-a/sending-stone-player, local branch `local/043-R-a`, made from a2332a2 (`npm ci`, `npx prisma generate`). Nothing pushed; nothing written in APP.
- **Status:** done. Every R-a item of round.md §2.4 is in commit 15 (896cf1e). Fix round 1 answers the review's four findings (RA-1 to RA-4, all minor) with one new commit, e95fdf3, and no amend. The fix tree's L1 is green, and so is `next build` of the fix commit. The worktree is clean.
- **No test file was split**, so there is no moves.d/R-a.tsv and no chore(refactor) commit. **No bug was found**, so bugs-found.md is untouched.

## Fix round 1 (after the independent review of local/043-R-a; 2026-11-03, about 4:35-4:57 PM EST)

| id | what I did |
|---|---|
| RA-1 | **Fixed** (e95fdf3). The finding is right. `post` in src/utils/lifecycle.ts now returns `Promise<{ id: string } \| undefined>`, and `follow` reads `const sent = await post(…); if (!sent) return; const { id } = sent`. So `undefined` means only "not taken". A 202 with no id is followed as the base followed it: `taken(undefined)`, GET `/rolls/undefined`, then `lost` after FOLLOW_FOR. `{ id }` is built fresh, so a falsy body such as `0` or `''` can't stop it either. **Evidence:** I used a copy of the reviewer's differential harness (X/ra-fix1/fz/diff.cjs), with five 202 answers added to POSTS: `{}`, `0`, `5`, `''` and `{ id: '' }`. Against a2332a2's follow it gives 4,000 scenarios and **0 diffs**. The same harness against commit 15's follow (X/ra-fix1/fzhead) gives 1,026 diffs, all from those id-less 202s, so it can see the change. No test was added: §3.1.3 allows new tests only for new helpers, and gate 1b holds the existing lifecycle suites' lines. |
| RA-2 | **Fixed** (e95fdf3). The finding is right. logAsk now goes through the private `keep`, so all nine log* share it, as R1.2.7 says. The signature is `keep(kind, fields, at?)`, with `kind` (`'use' \| 'ask'`) as the type argument's inference site. Its fields are `Omit<Extract<LocalUse \| LocalAsk, { kind }>, 'kind' \| 'id' \| 'at'>`, and it returns that same Extract, so logUse … logWildShape still return `LocalUse` and logAsk still returns `LocalAsk`. The hook's API types are unchanged. `kind` starts the id, so ids are still `use-…` and `ask-…`. The reads come in the same order as before: the id's `Date.now()`, then `++uses`, then `at ?? Date.now()`. Key order is unchanged too: kind, id, the fields, at. logAsk's object was `{ kind, id, label, at }`, and it still is. One `as Extract<…>` sits on the built object, because TS can't check a spread against a generic Extract. An isolated type check passed (X/ra-fix1/tscheck/snippet.ts): the right kinds compile, and three `@ts-expect-error` cases are refused (a use with no `spell`, an ask with `spell`, an ask taken as a use). **History is not amended:** commit 15's message says "nine", and at that commit it was 8 of 9. The PR text should say so. The report's "63 → 54" was wrong: commit 15's own final L1 shows 53 (corrected below). |
| RA-3 | **Fixed** (e95fdf3), the second way the finding offers. The named `FormulaScan` that commit 15 added is gone. groupsOf's scan is an inferred object literal, with the old type's doc comment kept above it. readBracket's parameter names only what it reads and writes (`{ group; depth; inner }`), and so does readSign's (`{ group; groups; before }`). The reads, writes and branch order are unchanged, C8 is green, and so are the dice suites. `grep -nE "^(export )?(type\|interface) [A-Z]"` over src/utils/damage-modifiers.ts now finds only the base's file-private Part (:39) and FormulaGroup (:231). Those go to Phase 4 (phase4 3). |
| RA-4 | Agreed. No code change: both remainders need another lane's file or a 2b file. They are in phase4 1 and 2 with the evidence: the three gmRollsOf importers, and useFollow's void return. |

**The fix commit** e95fdf3 `fix: v0.43 rolling core, round 1 (an id-less answer followed as before; logAsk on keep; no new named type)`: 3 files, all R-a rows of owners.tsv with phase 3 (src/utils/lifecycle.ts, src/features/rolling/hooks/use-sheet-roller.ts, src/utils/damage-modifiers.ts). No test file, golden, kit file, mock path or other lane's name is touched.

- **L0:** eslint on the three files has 0 problems (one max-len error in my first comment wording was fixed before any check ran), and prettier is clean. `jest --ci --findRelatedTests` over the three files: **124 suites, 5,720 tests, all green** (271 s).
- **L1** (X/l1/R-a/fix1, on the tree that was committed, with no edit between the L1 and the commit): **all ok**, 21:45-21:49 UTC. jest: 305 suites, 9,689 tests, 0 red, 0 flaky. typegen and tsc ok (0 errors). eslint: 789 files, 0 errors, 647 warnings, the same count for every rule as commit 15's final L1 (sonarjs/cognitive-complexity 53). Gates 1-12 ok: gate 1b compared 288 base test files; gate 2 held 8,607 base tests; gate 3 found 1,082 new tests; gate 9 had 647 warnings against 981; gate 10 held 991 golden tests and 24 frozen files; gate 11 counted 479 modules, 157 server modules and 17 client boundaries; gate 12 found 3 cycle groups against 4 at the base. The files were last written at 21:40 UTC, before the L1 started, and the commit was made from that tree.
- **`next build`** (the lane worktree at e95fdf3, under both locks): exit 0. It compiled successfully with 58 route lines, as at 896cf1e. The log is X/l1/R-a/fix1/build.log. It has the same env messages as round 0's build (6 Better Auth default-secret errors, 6 Prisma `DB_URL` errors during page-data collection), because the worktree has no .env.

**Metrics the fix moved:** none of the counted ones. Commit 15's numbers hold: cognitive complexity over 15 is 0 warnings in R-a's files (2 held by line disables); rule (a) and (b) violations in R-a's files are 0; 2 eslint-disable comments; cycles 3 groups as at a2332a2. FormulaScan was file-private, so no rule counted it; there is now one named type fewer outside a types.ts. Gate 9: ok, and no folder's key rose, so I have no key to report.

## Commits on local/043-R-a

| SHA | subject |
|---|---|
| 896cf1e | refactor(rolling): types out, one lifecycle, request builders, state reducer, GM rolls, roller split, dice parsers |
| e95fdf3 | fix: v0.43 rolling core, round 1 (an id-less answer followed as before; logAsk on keep; no new named type) |

Both messages carry the brief's two trailers and name no model.

## Items (round 0, commit 15; corrections from fix round 1 marked)

**R1.2.1 Types and constants out.** Into FR/types.ts: RechargeRoll (from use-table-rolls.ts), TypedEffect, TypedOffer, More (from use-sheet-roller.ts), EffectPrompt, EffectRoll (from effect-dice.ts); and the two new types later items needed, RollStateAction (R1.2.4) and GmRolls (R1.2.5, in place of `ReturnType<typeof gmRollsOf>`). ROLL_HISTORY moved to FR/constants.ts in R1.2.7, when `keeping`, its reader, left the hook (§1.0 rule 8: the test reads it too). None of these names had an importer outside R-a's own files. No type cycle in R's files (gate 12: 3 groups, as at a2332a2; the report notes "base group gone: 2 files from src/hooks/use-table-rolls.ts").

**R1.2.2 One lifecycle.** use-table-rolls' `start` follows its roll through `useFollow()` (`followRoll`); the send switch comes from `useSendChoice(gm)`. PLAIN is gone: NO_DICE (src/constants/roll-kinds.ts) is spread where PLAIN was, and in place at the three written-out copies (sendUse, sendEnd, sendAsk), at the same key position. src/utils/lifecycle.ts's `follow` (cc 25) is split into `post` (the POST, `taken`, refusal or network) and `look` (one GET, its update, and `settled | gone | late | again`); the loop, the late extension and the `lost` update stay in `follow`. The same fetches, awaits, timers and update order; `update` still runs inside the same try blocks.

**R1.2.3 Builders.** FR/utils/request-bodies.ts: toRollRequest, toFormulaRequest, toHitDiceRequest, toHitDieRequests, activityCheck (now `'check' in ROLL_KIND_INFO[kind]`), formulaOrigin, damageDice, modeOf, and the four bodies that were inline in callbacks: toAloneRequest, toTextDamageRequest, toDamageRequest (sendDamage's three branches) and toRechargeRequest. `typedFields` replaces the 7 identical typed/rerolls tails; toRollRequest keeps its own order (typed, effectDice, rerolls). `damageTail` replaces the three damage tails (types, critical, modifiers, typed, rerolls); the `use` branch passes no critical, as before. The 9 identical gates read one module-level `takes({ kinds, on }, kind)`, called on `latest.current` at call time, so no callback's deps changed. sendDamage: cc 30 → under 15. C2 and use-table-rolls.test's JSON.stringify bodies are unchanged.

**R1.2.4 State reducer.** FR/utils/roll-states.ts: `rollStates(held, action)` with `way` (kept + state + partly), `together`, `damaged` and `offer`; plus partly, answeringOf, dueOf, busy (exported) and together, known, added (private). The four setStates calls stay functional, and each builds its action inside the updater, so `kept` and the mutable `each` are still read when React runs it. gmRollsOf uses `partly` too, at the same key position (map R.4's "(also gmRollsOf:1071)").

**R1.2.5 GM rolls.** namesOf and heardOf moved to FR/utils/gm-rolls.ts beside withGmRolls; useGmRolls keeps its render-time setState. gm-rolls.ts no longer imports the hook's type (GmRolls instead), so no cycle forms between the two. **gmRollsOf stays in hooks/use-gm-rolls.ts**: R-b's roll-toasts.test.tsx:13 and roll-tray.test.tsx:10 import it from there (§2.2.2). Phase 4 item 1.

**R1.2.6 Damage due.** Nothing left to do: typesFor, chosenLabel and termsOf already moved to FR/utils/damage-due.ts in commit 7, as damageRollOf's private closure.

**R1.2.7 Sheet roller split.** FR/utils/local-rolls.ts: the 16 pure helpers (withEffects, offerTerms, withOffers, toLocalRoll, toLocalFormula, formulaTotals, noRethrows, rethrows, landTerm, rerolls, rethrown, toLocalDamage, setTerms, damageTerm, keeping, within), moved verbatim. FR/utils/entry-terms.ts: typedSoFar, damageEntryTerms, formulaEntryTerms, moved only. At commit 15 the 8 `kind: 'use'` log* functions shared one private `keep(fields, at?)`, and logAsk kept its own body (so 8 of 9, though commit 15's message says nine). **Fix round 1 (RA-2):** all nine share `keep(kind, fields, at?)`: the id's Date.now() and ++uses, then `at`, in the same order; logEffect's `at = Date.now()` default is still read first. CHECKS is `new Set(kindsWhere(kind => 'check' in ROLL_KIND_INFO[kind]))` (skill, tool, ability; read with `.has` only). `roll` and `rollDamage` are unchanged, each with a line-level `sonarjs/cognitive-complexity` disable (§0.6.8; Deviations, 3). The hook goes from 1,166 lines to 645.

**R1.2.13 The dice parsers (C8 green).** Each split is extract-function, with reads in the same order:
- readModifier (43): one helper per command family: readRethrow → rethrowOf, readKeepOrDrop, readLimit, readCount.
- throwTerm (29): the modifier switch moved to `apply`, and count's loop to `countMatches`.
- rethrow (26): the walk of one die moved to `rethrowDie` (`thrown | left | stop`), with the same `most` and recursion checks.
- formulaTerms (30) → `formulaTerm`; parseExtraTerms (22) → `extraTerm`. Both now use `isDieSides` (src/utils/dice.ts), so the `DIE_SIDES` imports and the `as DieSides` casts are gone. The refusal texts are unchanged.
- groupTakesAway (20): `groupsOf` scans with `readBracket` and `readSign` over a private FormulaScan, and the branch order is unchanged.

No hold was needed.

**R1.2.12a.** sendAsk's `[]` is now `[start]`. `start` is stable (useFollow's function, itself `useCallback([])`), so nothing changes at run time. That was the only react-hooks finding in R-a's files, before and after. The tests follow their units by import lines only: use-table-rolls.test.tsx and use-sheet-roller.typed.integration.test.tsx import the builders from ../utils/request-bodies, and use-sheet-roller.integration.test.tsx imports ROLL_HISTORY from ../constants. No assertion, helper or mock changed.

## L1 and gates (APP's R/tools)

The lock queue was long: up to 18 exclusive waiters, and shared-lock L0s waited 20+ min on the wait lock. So each item's L1 ran on a **snapshot**: a detached worktree of the lane's HEAD, node_modules symlinked, the lane's changed and new files copied in. The snapshots were queued in order while the next item was applied in the lane worktree. All snapshots were removed afterwards. The **final L1 ran on the lane worktree itself**, the tree that was committed.

| L1 (outdir X/l1/R-a/…) | tree | result |
|---|---|---|
| r121 | R1.2.1 | jest, tsc and gates 1-8, 10-12 ok; **eslint red with 3 errors** (unused DieSides import, a prettier wrap, import/order in FR/types.ts), hence gate 9 too. My slip, fixed at once |
| r122 | + fixes, R1.2.2 | **all ok**; 657 warnings |
| r123 | + R1.2.3 | jest, tsc and every other gate ok; **eslint red with 2 errors** (import/order of `@/hooks/use-follow`; a 101-char header comment in request-bodies.ts), fixed at once |
| r124 | + R1.2.4 | the same 2 errors (its snapshot had started before the fix); all else ok |
| r125 | + fixes, R1.2.5, R1.2.6 | **all ok** |
| r127 | + R1.2.7 | **all ok**; 654 warnings (CHECKS typed `ReadonlySet<RollKind>`, and the held disables' reason shortened, before its run) |
| r1213 | + R1.2.13, R1.2.12a | **all ok**; 648 warnings. One new cc 16 in the extracted `apply`, fixed by `countMatches` |
| **final** | the commit's tree | **all ok** (19:24-19:31 UTC): jest 305 suites, 9,689 tests, 0 red, 0 flaky; typegen and tsc ok; eslint 789 files, 0 errors, 647 warnings; gates 1-12 ok (gate 2: 8,607 base tests; gate 3: 1,082 new tests, all in new files; gate 9: 647 against 981; gate 10: 991 golden tests, 24 frozen files; gate 11: 479 modules, 157 server modules, 17 client boundaries; gate 12: 3 groups against 4 at the base). The worktree did not change while it ran, and the commit was made from it. |

**L0:** the first L0 waited 20+ min on the wait lock behind the queue, and I stopped it. Each item's full jest in its L1 stood in for it. No test was red in any L1: 0 red, 0 flaky, 0 reruns.

**`next build`** (lane worktree, under both locks): exit 0 at 896cf1e: compiled successfully, with 58 route lines, as at commit 8. The log (X/l1/R-a/final/build.log) has the same env messages as M's builds: 6 Better Auth default-secret lines and 12 Prisma `DB_URL` lines during page-data collection. The worktree has no .env.

## Metrics my items moved (R-a's files; eslint at a2332a2, M's fix3 L1 → final)

| metric | before | after |
|---|---|---|
| cognitive complexity > 15 | 10 (sendDamage 30, follow 25, readModifier 43, throwTerm 29, rethrow 26, formulaTerms 30, parseExtraTerms 22, groupTakesAway 20, roll 32, rollDamage 19) | 0 warnings: 8 split, 2 held by line disables (roll, rollDamage; §0.6.8) |
| rule (b): exported named types in .ts outside types.ts | 3 (RechargeRoll, EffectPrompt, EffectRoll) | 0 |
| rule (a): .tsx | none in the lane | none |
| react-hooks findings | 1 (exhaustive-deps, sendAsk) | 0 |
| eslint-disable comments | 0 | 2, line-level with `-- reason` (Deviations, 3) |
| import cycles | none in R's files | none; 3 groups in src, as at a2332a2 |
| whole-tree eslint (L1) | 661 warnings, 0 errors | 647 warnings, 0 errors |

By rule over the tree:
- sonarjs/cognitive-complexity: 63 → 53 (8 split, 2 disabled, 1 new one fixed). **Corrected in fix round 1:** round 0's report said 54; its own final eslint.json and commit 15's message say 53.
- ts-type-export: 56 → 53.
- react-hooks/exhaustive-deps: 8 → 7.

Gate 9 rose in no folder, so I have no gate 9 key to report.

## Deviations from round.md, and why

1. **gmRollsOf is not moved (R1.2.5).** Two of R-b's tests import it from hooks/use-gm-rolls, and §2.2.2 forbids moving a name another lane imports. Its private helpers moved instead, and the type cycle a half-move would have made is avoided with GmRolls. Phase 4 item 1.
2. **startEach and readWildShapeForms keep their own controller set (R1.2.2).** Both await `follow` directly: startEach shares one signal across a sequence of follows and `pause(BUSY_WAIT)`, and readWildShapeForms awaits the last state. `useFollow()` returns void, and use-follow.ts is a phase-2b file, so its API is not mine to change. So use-table-rolls keeps one `running` set for these two, and `start` uses useFollow (M-seams.md foresaw this). Phase 4 item 2.
3. **The held disables' reason text.** §0.6.8 gives `-- held for v0.44 item 1, which rewrites it`. At the callbacks' indentation that line is 104 chars, and `@stylistic/max-len` (100, comments included) errors on it. The comment is `// eslint-disable-next-line sonarjs/cognitive-complexity -- held: v0.44 item 1 rewrites it`. I added them in the lane, since the roller is R-a's file and §0.6.8 says each function gets one. G can drop them if it prefers to add them itself in commit 23.
4. **Private types in src/utils/damage-modifiers.ts.** Part and FormulaGroup stay private there, as at the base. (Commit 15 added a third, FormulaScan; fix round 1 removed it, RA-3.) FR/types.ts would break zone 4 (a shared module importing a feature's types), and src/types/roll.ts is W-a's. They are file-private, so no lint rule reports them. Phase 4 item 3, if G wants every named type in a types.ts.
5. **No test file split.** toRollRequest's and toFormulaRequest's tests sit in `describe('hooks/use-table-rolls')` and share 12 fixtures with the hook's tests. A split would copy those fixtures into a second file and keep the hook's describe title there. So the tests import the builders from their new module (import lines only, gate 1b ok), and there is no moves.d.
6. **Per-item L1s ran on snapshots** (see L1 and gates), because of the lock queue. Item L1s r121, r123 and r124 were red on lint only, and later L1s that include those items are green.

## Bugs logged

None.

## Phase 4 items (R1.9.26)

1. **src/features/rolling/hooks/use-gm-rolls.ts → src/features/rolling/utils/gm-rolls.ts** (RA-4 (a), R1.2.5's remainder). Move `gmRollsOf`, which is pure, from the hook module to sit beside namesOf and heardOf. Then retarget the import lines only: roll-toasts.test.tsx:13 and roll-tray.test.tsx:10 (both R-b's), and use-table-rolls.test.tsx:22 (R-a's). Why it waits: §2.2.2 forbids a Phase 3 lane moving a name another lane's tests import.
2. **src/hooks/use-follow.ts** (R-a's in phase 2b only; RA-4 (b), R1.2.2's remainder). Have `useFollow` return the follow promise and take an external signal, or hand out its controller. Then adopt it in use-table-rolls' startEach (:147-198) and readWildShapeForms (:538-560), and remove the hook's own `running` set (:104-111). Until then useTableRolls aborts two controller sets on unmount, useFollow's and `running`. Why it waits: useFollow's callback returns void (use-follow.ts:20-37), and its file is not R-a's in phase 3. A caller can't build an awaitable from onState alone, because the base's follow can end with no state at all (late, then time runs out). G may instead record a decision not to do it.
3. **src/utils/damage-modifiers.ts** Part (:39) and FormulaGroup (:231) (RA-3's remainder; CLAUDE.md §3). If G wants every named type in a types.ts, move these two file-private base types to src/types/roll.ts (W-a's). Why it waits: FR/types.ts would break zone 4, because a src/utils module can't import a feature's types, and src/types is W-a's.
4. **The PR text** (Phase 6, not a code edit): commit 15's message says "its nine log* share one `keep`". At that commit only 8 did. The fix commit makes it 9. Cognitive complexity over the tree after commit 15 is 53, not the 54 that round 0's report said.

## What integration must know

- **Names removed from modules.** None of them has an importer outside R-a's files (checked in every lane worktree in round 0):
  - toRollRequest, toFormulaRequest, toHitDiceRequest and toHitDieRequests moved from hooks/use-table-rolls.ts to FR/utils/request-bodies.ts.
  - The RechargeRoll type moved from use-table-rolls.ts to FR/types.ts. EffectPrompt and EffectRoll moved from effect-dice.ts to FR/types.ts.
  - ROLL_HISTORY moved from hooks/use-sheet-roller.ts to FR/constants.ts.
- **Fix round 1 changes no export.** `post`, `look` and `keep` are private. The parameter types of readBracket and readSign are private too.
- **Unchanged:** the signatures and returned objects of useTableRolls and useSheetRoller (SheetProviders composes them), the paths 2b gave, and every mocked surface.
- **No new directive.** The four new files from commit 15 are plain modules, and gate 11 is ok.
- **New imports from shared modules (commit 15):**
  - `NO_DICE`, `ROLL_KIND_INFO` and `kindsWhere` from src/constants/roll-kinds.ts (W-a's).
  - `isDieSides` from src/utils/dice.ts (W-a's).
  If W-a renames any of them, my files follow.
- **Landing order:** the fix commit sits on 896cf1e, and the two land together as commits 15 and its fix.
