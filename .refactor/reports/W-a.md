# W-a report: Phase 3, wire and checks (schemas, types, constants, utils/dice)

Builder W-a, worktree /home/user/w043/W-a/sending-stone-player, branch `local/043-W-a`, made at
a2332a2 (the task's base). Nothing pushed. Times UTC unless said.

## 0. Fix round 1 (the review of commits 12 and 13: W-a-1, W-a-2, W-a-3)

### 0.1 Findings and what was done

| id | severity | disposition |
|---|---|---|
| W-a-1 | minor | **Fixed in-lane** (commit b6245a7) by the review's alternative, which moves no name: src/types' last cycle group {party, roll, sending-stone, table} is gone. The Phase 4 item from round 0 (move FavoriteTarget and TableAsk, retarget 20 import lines) is **withdrawn**. |
| W-a-2 | minor | **Not fixed: Phase 4/5 item** (below). It needs a new test file in src/constants, and owners.tsv has no row for one (round.md §2.2.1: a lane creates files only where a row gives them). |
| W-a-3 | minor | **Fixed** (commit b6245a7): typedRules reads the kind table, `infoOf(request.kind).dice === 'd20'`; the schema no longer imports EFFECT_DICE_KINDS. |

**W-a-1, how.** The two edges that closed the loop are gone; no exported name changed module, so no
importer in any lane changes:
- src/types/sending-stone.ts no longer imports src/types/roll.ts: FavoriteEntry's `target` is written
  out (`{ type: 'item' | 'effect' | 'skill' | 'tool' | 'slots'; id: string } | { type: 'activity';
  id: string; item: string } | null`), and src/types/roll.ts declares `export type FavoriteTarget =
  NonNullable<FavoriteEntry['target']>` (FavoriteEntry added to its existing import from
  sending-stone; its doc comment kept, plus a line on why).
- src/types/roll.ts no longer imports src/types/table.ts: `EffectAsk = { type: 'save' |
  'concentration' | 'check' }` instead of `Pick<TableAsk, 'type'>` (doc comment says it is a table
  ask's types, written out to avoid the cycle). Its one producer builds `{ type: 'concentration' }`
  (description-link.tsx:325) and its one reader compares to 'concentration' (effect-dice.ts:47).
- The graph left is acyclic: party → sending-stone, roll → sending-stone, table → {party, roll,
  sending-stone}; sending-stone → {constants, foundry-settings, notes} only.
- **tsc probe** (outside the repo: X/W-a/probe/probe.ts with a tsconfig extending the worktree's,
  an exact-equality `Eq<A, B>` over the old literal types): FavoriteTarget, FavoriteEntry['target'],
  FavoriteInput and EffectAsk are each identical to before (vs the old union and `Pick<TableAsk,
  'type'>`); a deliberate miss (`EffectAsk` vs `{ type: 'save' | 'concentration' }`) fails, so the
  probe tells. The full tsc in L1 then checked every importer (0 errors).
- **Gate 12**: 2 cycle groups (base 4): src/db's 6-file group (S's, R1.3.1) and
  transfers' move-dialog ↔ recipient-list (V2's). Base group 1 (12 files from
  src/hooks/use-sheet-roller.ts) is now wholly gone; in round 0 the src/types group still counted
  as its remnant.
- Cost (the review named it): one derived alias and the three ask types written twice (TableSaveAsk
  and TableCheckAsk's `type` in table.ts, EffectAsk in roll.ts). Accepted as the simplest way with no
  cross-lane edits; Phase 4 may still take the round-0 plan (one home in types/sending-stone.ts) if G
  prefers it, but commit 23's zero-cycle target no longer needs it.

**W-a-3, why it is the same.** For every kind, `EFFECT_DICE_KINDS.includes(kind)` ⟺
`ROLL_KIND_INFO[kind].dice === 'd20'` (both are skill, tool, ability, save, death, initiative,
attack: roll-kinds.test.ts's "the d20 rolls" row and C9's values snapshot). infoOf is already called
for every request at the end of the same superRefine (`DICE_RULES[infoOf(request.kind).dice]`), so
no new kind can reach it. L0 (40 suites, 1,420 tests related to roll-request.ts) and the full L1 are
green, issue order unchanged (roll-request.test, C6).

### 0.2 Commit (new; nothing amended)

| SHA | subject |
|---|---|
| b6245a7 | fix: v0.43 wire and checks, round 1 (src/types' last cycle gone; typedRules reads the kind table) |

Pathspec commit of W-a's files only: src/schemas/roll-request.ts, src/types/roll.ts,
src/types/sending-stone.ts (owners.tsv rows with lane W-a, phase 3, items R1.4.4/R1.4.9b). Its tree
(af94616) is byte-equal to the tree the L1 ran on (checked with `git write-tree` before and after).
One line of the message body runs past 100 columns (a sed of mine); left as is, since nothing is
amended.

### 0.3 L0, L1, gates, build (fix round)

- **L0** (flock wait, shared checks): `jest --ci --findRelatedTests src/schemas/roll-request.ts`:
  40 suites, 1,420 tests, 383 snapshots, all green (X/l1/W-a/fix1.l0.txt). The two type files have
  no runtime; the probe and L1's tsc cover them.
- **L1** `R/tools/l1.sh X/l1/W-a/fix1 <worktree>` on the worktree itself (21:59:10-22:02:59 UTC):
  jest 306 suites, 9,700 tests, 0 red, 0 flaky, 0 suites not run; typegen ok; tsc 0 errors; eslint
  788 files, 0 errors, 659 warnings; gates 1 ok (5,665 tests in 290 base files and 10 frozen), 1b ok
  (288 files, 474 moved names), 2 ok (8,607), 3 ok (306 suites, 9,700 tests, 1,093 new), 4 ok, 4b ok,
  5 ok (5 overrides), 6 ok (57 framework files, 15 actions), 7 ok (783 modules, 0 barrels), 8 ok (25
  suites), 9 ok (659 against 981), 10 ok (991 golden tests, 24 frozen files), 11 ok, 12 ok (2 groups,
  base 4). **0 failed.** No gate-9 folder rose, so no gate-9 keys to report.
- **next build** in the worktree at b6245a7 (tree af94616), under the wait and checks locks
  (22:14:03-22:14:39 UTC): exit 0, "Compiled successfully", TypeScript finished, 12 static pages
  generated, every route listed; the same env messages as round 0 (12 DB_URL, 6 default-secret
  lines: the worktree has no .env, by design). Log X/l1/W-a/build-fix1.log.

### 0.4 Metrics the fix moved

| metric | after commit 13 | after b6245a7 |
|---|---|---|
| import cycle groups (gate 12, whole src) | 3 (base 4) | 2 (base 4); none in W-a's files |
| src/types cycle group | 1 (4 files) | 0 |
| rule (a) / rule (b) violations in W-a's files | 0 / 0 | 0 / 0 |
| cognitive complexity > 15 in W-a's files | 0 | 0 |
| eslint-disable comments in W-a's files | 2 | 2 |
| eslint over the tree | 0 errors, 659 warnings | 0 errors, 659 warnings |
| tests | 9,700 | 9,700 (no test file touched) |
| product readers of EFFECT_DICE_KINDS | 1 (schemas/roll-request.ts) | 0 (only C9 reads it) |

### 0.5 Phase 4 items after the fix round (replaces round 0's §7)

1. **W-a-2: HIT_DIE's `.source` test beside its unit.** Add an owners.tsv row (`-`,
   `src/constants/sending-stone.test.ts`, W-a, phase 4, R1.4.2) and move `describe('HIT_DIE', …)`
   (src/utils/dice.test.ts:29-34, and its `HIT_DIE` import at :5) there unchanged. Both files are new
   since 24f808b, so gates 1, 1b and 3 are unaffected.
2. **EFFECT_DICE_KINDS (src/constants/sending-stone.ts:214) is now dead in product code**: its only
   importer is the values golden (C9, frozen until commit 26). Delete it with C9's retirement in commit
   26 (or G decides); roll-kinds.test.ts's "the d20 rolls, as EFFECT_DICE_KINDS …" title only names
   it (a string), so nothing else breaks.
3. **(optional, unchanged from round 0) COMPANION_UNTAKEN from the table**: only by moving it into
   src/constants/roll-kinds.ts as `kindsWhere(…)` (in place it would close a constants cycle); its
   order would become ROLL_KINDS' (read only by `.includes`; C9 pins it until commit 26). Low value:
   roll-kinds.test.ts holds it equal to the table.
4. **(optional) one home for the favorite target and the ask types**: round 0's plan (FavoriteTarget,
   TableAsk, TableSaveAsk, TableCheckAsk into src/types/sending-stone.ts, 20 import lines retargeted)
   would remove fix 1's derived alias and repeated literals. Not needed for zero cycles any more.

### 0.6 What integration must know (fix round)

- b6245a7 lands after commit 13 (c7e36bf), same lane order (W-a first). It touches only W-a rows;
  no exported name changes module or meaning, so no other lane's import or mock is affected.
- Other lanes that import FavoriteTarget (16 files), EffectAsk (2) or TableAsk (4) see identical
  types (tsc probe), so their L1s at integration should not move.
- Commit 23's zero-cycle check now depends only on the db group (S) and the transfers pair (V2).
- No bugs found in the fix round (nothing appended to bugs-found.md).

---

# Round 0 (commits 12 and 13), as first reported

## 1. Items done (round.md §2.4's order: R1.4.1 → .2 → .3 → .8 → .9 (commit 12) → .4 → .7 (commit 13))

| item | what changed | files |
|---|---|---|
| R1.4.1 | `leftOut(s)` = `s.optional().catch(undefined)` and `orNull(s)` = `s.nullable().catch(null)` in src/schemas/utils.ts (+ table test, 10 cases); 67 leftOut sites (66 sending-stone, 1 foundry-settings; the 4 `.nullable().optional()` chains as `leftOut(x.nullable())`) and 59 orNull sites (58 + 1, only where the chain was exactly `.nullable().catch(null)`); every inner chain kept; the 67 `unicorn/no-useless-undefined` line directives become the helper's one (line-level, with its reason) | schemas/utils.ts, utils.test.ts (new); sending-stone.ts, foundry-settings.ts |
| R1.4.2 | `HIT_DIE = new RegExp(`^d(${DIE_SIZES.join('|')})$`)` (stays in constants/sending-stone.ts, its importers' path; same `.source` and flags, asserted); `HIT_DIE_SIZES = DIE_SIZES.length` (file-private in roll-request.ts, its one reader); `isDieSides` at the three schema sites (`faces => isDieSides(faces)`, so no refine narrows a type) | constants/sending-stone.ts, schemas/roll-request.ts, utils/dice.test.ts |
| R1.4.3 | hello, texts (`transform` → `{ texts }` only), cleared (`z.unknown().transform(() => ({}))`) and chat schemas hoisted; `EVENT_SCHEMAS` keyed by EVENTS, typed `{ [K in GameEvent['type']]: z.ZodType<(GameEvent & { type: K })['data']> }` so tsc checks every pair; `parseGameEvent` = `actsOn(type)` (`Object.hasOwn`) + one commented `as GameEvent`; stays exported from `@/schemas/sending-stone` | schemas/sending-stone.ts |
| R1.4.8 | annotated `: z.ZodType<Hand>`: Envelope, SheetCounter, DamagePreview, JournalPage, BeastEntry (sending-stone.ts), NoteChange, NoteResolve, NoteOrder, NoteOrderResolve (notes.ts); CookbookDishBody was already; RollRequestInput in R1.4.7. None reads its schema's `.shape`/`.extend`/`.pick`, so no `const _` checks were needed. Nothing moves | schemas/sending-stone.ts, notes.ts |
| R1.4.9 | ParsedContainer → src/schemas/types.ts as `ParsedContainer<Item>` (generic over the item, so the new file imports no schema: a non-generic one would need `typeof itemSchema` and make schemas/types.ts ↔ sending-stone.ts a type cycle); notes.ts's unread `export { NOTE_ID }` dropped | schemas/types.ts (new), sending-stone.ts, notes.ts |
| R1.4.9b | **not done: a Phase 4 item** (see §7) | — |
| R1.4.4 | rollRequestSchema reads ROLL_KIND_INFO (via `infoOf(kind): RollKindInfo`): `check` for ACTIVITY_CHECKS, `fromText` for FROM_TEXT, `keyed` for LINKABLE and keyed, `answers` for ANSWERS, `damage` for damaging, `dice` for the four dice branches; the four Sets gone | schemas/roll-request.ts |
| R1.4.7 | superRefine (cc 84) → `typedRules, namingRules, hitDiceRules, targetRules, castingRules, damageRules, linkRules, keyRules, enchantRules, ownFieldRules` in today's order, then `DICE_RULES[infoOf(kind).dice]` (`plainRules, hitDiceThrownRules, rechargeRules, ownDiceRules, d20Rules`); transfer superRefine (cc 17) → `shareRules, moveRules`; `issuesTo(context)` for the 44 addIssue copies, `inFaces(results, faces)` for the 4 results-in-faces checks; `as unknown as z.ZodType<RollRequestInput>` → annotation (needed the modifiers' size refine written as the type guard it is, see §4.3); `Issue`, `RequestRule` in schemas/types.ts | schemas/roll-request.ts, schemas/types.ts |

## 2. Commits on local/043-W-a (to land in this order; nothing pushed)

| SHA | subject |
|---|---|
| 52851b2 | refactor(wire): lenient helpers, die sizes, event schemas table, hand types checked, types home |
| c7e36bf | refactor(wire): the request-kind table read by schemas and constants; rollRequestSchema's rules by group |

No chore(refactor) commit: no test file was split (no moves.d/W-a.tsv). Each commit is a pathspec
commit of W-a's files only (owners.tsv rows with lane W-a): commit 12 = src/constants/sending-stone.ts,
src/schemas/{foundry-settings,notes,roll-request,sending-stone}.ts, src/utils/dice.test.ts and the
new src/schemas/{types,utils,utils.test}.ts; commit 13 = src/schemas/{roll-request,types}.ts. Each
commit's tree is byte-equal to the snapshot its L1 ran on (checked with `git write-tree`).

## 3. L1 and gate results (R/tools/l1.sh, APP's tools, on a detached snapshot of the worktree)

Outdirs X/l1/W-a/<item>/ with the summary in X/l1/W-a/<item>.txt.

| item | snapshot | ran (UTC) | jest | tsc | eslint | gates | L1 |
|---|---|---|---|---|---|---|---|
| R1.4.1 | 57ccdc0 | 16:25-16:33 | 306 suites, 9,699 tests, 0 red, 0 flaky | 0 | 0 err, 661 warn | 1-12 ok | 0 failed |
| R1.4.2 | 921027f | 18:39-18:45 | 306, 9,700, 0 red | 0 | 0 / 661 | 1-12 ok | 0 failed |
| R1.4.3 | f05a3be | 18:45-18:52 | 306, 9,700, 0 red | 0 | 0 / 661 | 1-12 ok | 0 failed |
| R1.4.8 | af32f33 | 18:52-18:58 | 306, 9,700, 0 red | 0 | 0 / 661 | 1-12 ok | 0 failed |
| R1.4.9 (= commit 12) | 72c7b5c | 18:58-19:04 | 306, 9,700, 0 red | 0 | 0 / 661 | 1-12 ok | 0 failed |
| R1.4.4 | d43961c | 19:04-19:11 | 306, 9,700, 0 red | 0 | 0 / 661 | 1-12 ok | 0 failed |
| R1.4.7, first | fe87035 | 19:11-19:18 | 306, 9,700, 0 red | **12 errors** | **2 errors**, 659 warn | 9 FAIL (the 2 errors), rest ok | **3 failed** |
| R1.4.7b (= commit 13) | f649927 | 20:33-20:39 | 306, 9,700, 0 red | 0 | 0 / 659 | 1-12 ok | 0 failed |

Every gate line, each run: gate 1 ok (5,665 tests in 290 base files and 10 frozen), 1b ok (288
files, 474 moved names), 2 ok (8,607 base tests), 3 ok (1,092/1,093 new, all in new files), 4 ok,
4b ok, 5 ok (5 overrides), 6 ok (57 framework files, 15 actions), 7 ok, 8 ok (25 suites), 9 ok
(but R1.4.7 first), 10 ok (991 golden tests, 24 frozen files), 11 ok, 12 ok (3 cycle groups, base 4).
No gate-9 folder rose at any point, so there are no gate-9 keys to report.

Extra evidence for R1.4.4 and R1.4.7 (not a gate): a seeded node comparison (jiti, outside the
repo: /tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/wa3/fuzz/fuzz.cjs) of rollRequestSchema at commit 12, after R1.4.4 and after R1.4.7,
over 200,000 generated requests (all 30 kinds and a bad one, every optional field, good and bad
dice): 196,215 reached the rules and every field path the rules name was among their issues;
0 differences in `safeParse(...).error.issues` (code, path, message, order), nor in the data of
the 164 accepted.

## 4. Deviations from round.md and why

1. **L0 per edit was not run as a separate step for R1.4.2-R1.4.7.** L0s wait for `flock
   l1-wait true`, which every queued L1 holds while it waits; with 12-20 L1s queued all
   afternoon an L0 never got through (one waited 40 min). Each item's L1 (a full jest, a superset
   of its L0) ran on a snapshot of exactly that item's tree instead. R1.4.1 had its L0 (54
   suites, 2,670 tests, green) and R1.4.2 one (163 suites, 7,583 tests, green), each before
   its L1.
2. **R1.4.9b is not done** (amendment 1 (c)): both of its ways move names other lanes import
   (FavoriteTarget: 16 files outside src/types; TableAsk: 4, a frozen golden among them), which
   §2.2.2 and this task forbid in Phase 3; M-fix1 asked the orchestrator to rule and no ruling is
   in round.md. It is a Phase 4 item (§7). src/types/{party,roll,sending-stone,table}
   are still one cycle group (gate 12: 3 groups, base 4).
3. **R1.4.7's annotation needed one type-level change outside the superRefine.** The planner's
   probe called RollRequestInput "exact", but it never stripped the cast (its sed wants `^})`,
   the line is indented): the schema's `modifiers.faces` read as `number` against DamageModifiers'
   `DieSize`, so the first R1.4.7 L1 had 12 tsc errors. The refine is now written as the type
   guard it is, `(faces): faces is DieSize => (DIE_SIZES as readonly number[]).includes(faces)`
   (the same expression, so the same behaviour). Logged in bugs-found.md (tooling).
4. **R1.4.4: EFFECT_DICE_KINDS and COMPANION_UNTAKEN stay literals** in constants/sending-stone.ts,
   not "derived under their names": roll-kinds.ts reads ROLL_KINDS from constants/sending-stone.ts
   at load, so a derivation there would make the two constants modules import each other (a
   run-time cycle, read as `undefined` under jest's CommonJS, and a new gate-12 group); and C9
   pins COMPANION_UNTAKEN's own order until commit 26. roll-kinds.test.ts already asserts both
   equal the table. The schema keeps reading EFFECT_DICE_KINDS (one reader, its own domain words).
5. **HIT_DIE stays in constants/sending-stone.ts** (map W wanted it in constants/dice.ts with a
   re-export): moving it would move a name R-a's utils/formulas.ts and the C9 golden import, and a
   re-export is a shim (gate 7). It is built from DIE_SIZES there. **Its `.source` test lives in
   src/utils/dice.test.ts** (W-a's, new since 24f808b, row item R1.4.2): no owners row gives W-a a
   new test file in src/constants, and constants/sending-stone.ts has no test of its own.
6. **ParsedContainer is generic** (`ParsedContainer<Item>`), see R1.4.9 above.
7. **The four `.nullable().optional().catch(undefined)` chains** (round.md said 2) are all
   `leftOut(x.nullable())`.
8. **Where the L1s ran**: each on a detached snapshot worktree of exactly the item's tree
   (/home/user/w043/W-a/snap-<item>, node_modules symlinked, removed after; scripts in
   X/W-a/bin), so editing went on while they queued; each commit's tree equals its last L1's.
9. **Formatting**: prettier was run with the repo's own config (package.json) instead of
   `eslint --fix`, which needs the checks lock; eslint in each L1 confirms it.

## 5. Metrics my items moved (W-a's files: src/schemas, src/types, src/constants, src/utils/dice*)

| metric | before (a2332a2) | after (commit 13) |
|---|---|---|
| rule (a) .tsx violations | 0 (no .tsx in W-a's files) | 0 |
| rule (b) exported types outside types.ts / src/types | 0 | 0 (new types in src/schemas/types.ts) |
| named types in a .ts outside types.ts (file-private) | 1 (ParsedContainer, sending-stone.ts) | 0 |
| cognitive complexity > 15 | 2 (roll-request.ts superRefine 84, transfer superRefine 17) | 0 |
| eslint-disable comments | 68 (67 no-useless-undefined in sending-stone.ts and foundry-settings.ts, 1 in sending-stone.test.ts) | 2 (schemas/utils.ts:10, line-level, with its reason; the frozen test's one) |
| eslint warnings in W-a's files | 6 (2 complexity, 4 import/no-restricted-paths in src/types from src/constants: the old zones', G's §1.7.4 zones allow them) | 4 (the same 4) |
| eslint over the tree | 0 errors, 661 warnings | 0 errors, 659 warnings |
| import cycles (gate 12) | 3 groups | 3 groups (no new one; src/types' 4-file group left, R1.4.9b) |
| react-hooks findings | 0 | 0 |
| tests | — | +11 (schemas/utils.test.ts 10, utils/dice.test.ts 1), all in files new since 24f808b |

## 6. Bugs logged

One, tooling (R/bugs-found.md, "[W-a] Wire and checks"): analysis/W/types-probe.sh's sed never
strips rollRequestSchema's indented cast, so "RollRequestInput exact" was the cast's type, not the
schema's. No product bug found in W-a's files.

## 7. Phase 4 items (not made) — superseded by §0.5: item 1 was fixed in-lane by b6245a7

1. **R1.4.9b, src/types' last cycle group** {party, roll, sending-stone, table} (gate 12; G expects 0
   in commit 23). The two loop-closing edges are sending-stone.ts → roll.ts (`FavoriteTarget`, used
   at types/sending-stone.ts FavoriteEntry) and roll.ts → table.ts (`TableAsk`, in `EffectAsk =
   Pick<TableAsk, 'type'>`). Fix: move `FavoriteTarget` (types/roll.ts:179-181) into
   types/sending-stone.ts beside FavoriteEntry (roll.ts imports it back for FavoriteInput), and
   `TableAsk`, `TableSaveAsk`, `TableCheckAsk` (types/table.ts:146-167) into types/sending-stone.ts
   beside AskedCheck (table.ts and roll.ts import them); then sending-stone imports none of the four,
   roll only sending-stone, and the group is gone. Type-only, no behaviour. Import lines to retarget
   (other lanes' files, so Phase 4): FavoriteTarget in 12 sheet files (favoriting/{use-favorite-choice.ts,
   favoriting.tsx, favoriting.test.tsx, constants.ts}, feature-entry.tsx, spell-entry.tsx,
   effect-entry.tsx, character-pane.tsx, sheet-entry.tsx, item-entry.tsx, favorites.tsx,
   action-entry.tsx: U1/U2; re-grep after their splits), src/utils/favorites.ts (U2),
   src/utils/favorite-commands.ts and its test (S), src/mocks/sending-stone.ts (W-b); TableAsk in
   features/table/components/chat-log/chat-log.tsx and src/utils/ask-words.ts (V1),
   src/utils/table-view.ts (S, TableCheckAsk too), src/__tests__/golden/words.golden.test.tsx
   (frozen golden: its import line only, which gate 10 allows). Why not now: §2.2.2 (a Phase 3 lane
   moves no name another lane imports) and this task; M-fix1's question to the orchestrator has no
   ruling in round.md.
2. **(optional) EFFECT_DICE_KINDS and COMPANION_UNTAKEN from the table**: only by moving them into
   src/constants/roll-kinds.ts as `kindsWhere(…)` (in place they would close a constants cycle);
   importers to retarget: schemas/roll-request.ts (W-a), db/campaign-events.ts (S),
   features/sheet/__tests__/charges.integration.test.tsx (U1), values.golden.test.ts (frozen, until
   commit 26); COMPANION_UNTAKEN's order would become ROLL_KINDS' (read only by `.includes`; C9 pins
   it until commit 26, so after it). Low value: roll-kinds.test.ts already holds both equal to the
   table.

## 8. What integration must know

- Commit 12 changes src/constants/sending-stone.ts: it now imports DIE_SIZES from
  `@/constants/dice` and builds HIT_DIE from it (same value; C9 green). Every exported name of the
  file is unchanged. Mocks of `@/constants/sending-stone` with `requireActual` keep working (gate 5 ok).
- src/schemas/types.ts and src/schemas/utils.ts (+ test) are new; owners.tsv already has their
  rows. src/schemas/types.ts imports `@/types/roll` (type-only) and nothing imports it but
  src/schemas.
- `parseGameEvent` keeps its name, signature and module (mocked there); `rollRequestSchema`,
  `envelopeSchema` and the notes schemas keep their names; the annotated schemas' `z.output` types
  are now their hand types, and tsc is clean everywhere they are read (S's notes-routes,
  seat-routes, events route).
- Conflicts: W-a touched only W-a rows. W-b's, S's and R-a's lanes import from these files
  (HIT_DIE, isDieSides, the schemas), whose names and values are unchanged.
- The build: `next build` in the worktree at commit 13's tree (under the wait and checks locks,
  20:39:47-20:40:40 UTC): exit 0, "Compiled successfully", TypeScript finished, every route listed;
  log X/l1/W-a/build.log. It prints the same env messages as M's commit-8 builds (12 DB_URL and 6
  default-secret lines: the worktree has no .env, by design).
