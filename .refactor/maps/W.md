# Map W: wire and checks (re-plan, 2026-11-03)

Area: src/schemas/**, src/types/**, src/constants/**, src/mocks/**, src/utils/roll-requests.ts (+test). Scripts and
outputs: `.refactor/analysis/W/` (edges.cjs → edges-summary.txt, kinds.cjs → kinds.txt + kinds-grouped.txt,
fallbacks.cjs, cycles.cjs, placement.cjs, types-probe.sh, complexity.config.mjs, each with its .txt). Full edge
dump: X/W/edges.txt. Measured on 51b8916 (src as at 24f808b).

## 1. Inventory (lines; exports; importers outside the area, prod by folder + tests)

| file | lines | exports | outside importers |
|---|---|---|---|
| schemas/sending-stone.ts | 2549 | envelopeSchema, TEXT_HASH, LONGEST_TEXT, inventorySchema, rollSchema, combatantSchema, parseGameEvent | app 4 (events, bridge/commands, texts routes), lib 3; 5 tests (events route.test **jest.mocks** it) |
| schemas/roll-request.ts | 1007 | MAX_EXTRAS, rollRequestSchema, commandsPollSchema | lib/seat-routes, app bridge/commands; 1 test |
| schemas/notes.ts 105 · cookbook.ts 218 · campaign.ts 94 · foundry-settings.ts 69 | | 6 schemas + checkChange + re-export NOTE_ID · KNOWN_CHANGES, cookbookDishSchema · 4 schemas, toForgeGameUrl, toInviteCode · foundrySettingsSchema | lib/notes-routes, db/notes · lib/cookbook-routes · app 4 · area only |
| types/sending-stone.ts | 2036 | 108 types | ≥66 prod (character-sheet 28, utils 17, db 11, transfers 7, hooks 2), ≥52 tests |
| types/roll.ts 525 · table.ts 449 · notes 214 · campaign 144 · party 109 · cookbook 105 · dice-entry 66 · character 53 · foundry-settings 41 | | 31 · 27 · 18 · 9 · 7 · 7 · 4 · 3 · 2 types | ≥27 · ≥25 · 17 (notes UI 12) · 14 (campaigns UI 7) · 12 · 8 · 4 · 5 · 3 prod |
| constants/sending-stone.ts | 605 | 85 consts, 6 types | 47 prod (db 14, utils 14, character-sheet 10, transfers 3, hooks 3, app 2, lib), 15 tests (**2 jest.mock overrides**) |
| constants/conditions.ts 285 · cookbook.ts 71 · dnd5e.ts 103 · campaign.ts 27 · notes.ts 19 · links.ts 10 | | 3+2 types · 15+1 type · 4 · 10 · 11 · 1 | character-sheet only · db, lib, cookbook-card, hooks (**2 jest.mock overrides**) · utils 2, db, sheet · app 4, campaigns UI 3, site-header, utils · notes UI, db, lib · help-links only |
| mocks/sending-stone.ts | 4350 | 72 builders, 42 consts, 1 type | tests only, 120 files |
| mocks/slim-sheet 1058 · notes-server 215 · cookbook 217 · alone 202 · fullscreen 99 | | builders | tests only: 1 · 14 · 3 · 5 (sheet) · 5 |
| utils/roll-requests.ts | 1629 | 16 fns, GM_UNSENT, 4 types | 14 prod: db 4, utils 3 (prompts, removals, transfers), hooks 2, lib 2, **components 2 (sheet-tiles isDying, uses-button sameCounter)** |

Upward edges from the area: types/roll.ts:20-21 `type DamageModifiers` (utils/damage-modifiers), `type ExtraTerm`
(utils/roll-modifiers); schemas import values from utils (DIE_SIZES, MOST_DICE, MAX_LINKS, MAX_CHECKS, MAX_DICE,
MAX_FLAT, NOTE_ID, expandSheet). The two client components that import utils/roll-requests.ts pull table-view,
sheet-actions, casts, damage-modifiers… into the client bundle for two 5-line functions.

## 2. CLAUDE.md rule by rule

- **§2** no .tsx in the area.
- **§3 named types outside types files** (14 exported, 4 local): constants/sending-stone.ts:53 RefusalReason, :283
  TransferFeature, :344 EffectOp, :357 PrepareOp, :372 WildShapeOp, :536 SpellSlotOp; conditions.ts:8 ConditionRule,
  :11 ConditionRules; cookbook.ts:70 CookbookRefusalReason; utils/roll-requests.ts:124 RollRefusal, :179
  HeldRollRequest, :200 RollCommand, :470 HeldEndTurn; mocks/sending-stone.ts:2459 ChosenFavorite; local:
  schemas/sending-stone.ts:679 ParsedContainer, mocks/notes-server.ts:11-12 Sent, Answer, mocks/slim-sheet.ts:10
  Json. src/types/*.ts are the guide's app-wide `types/` folder: compliant.
- **§3 constants/rules**: kind facts are hand-copied in 14 files (3.1); DIE_SIZES lives in a util (W.2). No rules in
  components here.
- **§4 placement** (placement.txt): constants/links.ts → src/components/help-links/constants.ts (one consumer);
  constants/conditions.ts → the sheet's conditions folder (constants.ts + types.ts). The rest has server+client or
  multi-feature importers: stays in src/schemas, src/types, src/constants, src/mocks. utils/roll-requests.ts →
  src/utils/requests/ (db, lib, utils, hooks, components import it).
- **§5** sheet-tiles.tsx:11 and uses-button.tsx:7 (client) import a server-weight module (W.6).
- **§7** cycles.txt: runtime 1 (src/db, 6 files, S's). With type-only imports 4; **[W] 12 files**:
  types/{party,roll,sending-stone,table} ↔ utils/{damage-modifiers,description-links,effect-dice,formulas,
  creature-words,wild-shape,wild-shape-words} ↔ hooks/use-sheet-roller, tied to the area by types/roll.ts:20-21
  (W.9). No index.ts barrel in the area; schemas/notes.ts:9 re-exports NOTE_ID, which no importer takes from there.
  `import type`: complete.
- **§9 eslint-disable** (disables.txt, 89): schemas/sending-stone.ts file-scope `unicorn/no-null` + **66** next-line
  `unicorn/no-useless-undefined -- left out, as junk`, each over `.optional().catch(undefined)`; foundry-settings.ts
  file no-null + :44 (same 67th); notes.ts:50 line no-null; file-scope no-null in 8 tests and 5 mocks;
  mocks/notes-server.ts:121 `prefer-structured-clone` **no reason**; mocks/fullscreen.ts:27 no-this-outside-of-class
  (reason); tests' `no-useless-undefined -- found nowhere` sending-stone.test.ts:4742, roll-requests.test.ts:5705,
  :5818. Q2: the 17 no-null go with the rule off (commit 5); W.1 folds the 67 into one helper. **After: 6, all
  line-level** (helper 1, notes-server:121 given a reason, fullscreen:27, 3 test lines).
- **§9 complexity > 15** (sonarjs 4.2.2 run on these files, exact): schemas/roll-request.ts:567 superRefine **84**,
  :164 transfer superRefine 17; utils/roll-requests.ts:1065 checkLinked **49**, :305 checkRoll 26, :1347
  toRollRequestView 23, :1529 toGmRollView 20, :815 checkAloneChoices 18, :881 checkEnchant 16;
  mocks/notes-server.ts:103 fetch fake 32. (S's neighbours: campaign-events.ts:106 apply 70, db/roll-requests.ts:142
  createRollRequest 53, :538 claimRollRequests 18.) parseGameEvent scores <15 (a switch counts once).

## 3. Duplication

### 3.1 The request-kind table (Q1): sites keyed on request kind (kinds-grouped.txt, 141 rows, whole app)

| fact | copies (file:line; exact difference) | field |
|---|---|---|
| GM roll words | roll-requests.ts:1473 GM_ROLL_KINDS (30 visible strings) | `gmLabel` |
| d20 kinds (7) | roll-requests.ts:1507 D20_KINDS (Set); constants/sending-stone.ts:215 EFFECT_DICE_KINDS (array in ROLL_KINDS order, read by includes); effect-dice.ts:42 rollTokens (7 cases, per-kind token logic: stays) | `dice:'d20'` |
| damage kinds (3) | roll-requests.ts:1594 DAMAGE_KINDS; roll-tray.tsx:1652 DAMAGE_KINDS (same 3); schemas:733 `damaging` | `damage` |
| summed totals (4) | roll-requests.ts:1591 SUMMED = damage kinds + hitDice | `summed` |
| activity checks (3) + option type | roll-requests.ts:1186 CHECK_TYPES {skill:'skill', tool:'tool', ability:'check'}; schemas:60 ACTIVITY_CHECKS; db/roll-requests.ts:225 includes; use-sheet-roller.ts:86 CHECKS; use-table-rolls.ts:1402-1405 activityCheck — 5 copies, same set | `check` |
| keyed (4) | schemas:793 skill/tool/ability/save; schemas:54 LINKABLE (same set) | `keyed` |
| from a description only (3) | schemas:48 FROM_TEXT | `fromText` |
| answers a prompt (3) | schemas:66 ANSWERS; db/roll-requests.ts:323 Prisma `kind:{in:['save','ability','skill']}` (**order asserted**, db/roll-requests.test.ts:685, :2507) | ordered `ANSWER_KINDS`, flag derived |
| GM never sends (8) | roll-requests.ts:233 GM_UNSENT; GM refusal again in db/favorites.ts:45, effects.ts:42, wild-shape.ts:49 | `gm:false` |
| never a companion's (13) | constants/sending-stone.ts:460 COMPANION_UNTAKEN (read by includes only: campaign-events.ts:255, charges.test.tsx:1477: order free); db/roll-requests.ts:154 (5 own-switch kinds, 422 `unknown`) | `companion:false` |
| own campaign switch, never a roll kind (5) | campaign-events.ts:157-161; db/roll-requests.ts:154, :164-168 (dispatch), :572-579 `withheld` (+ switch names), :581 notOwn — all ROLL_KINDS order | `own:'transfersEnabled'…'wildShapeEnabled'` |
| waits while shaped (4) | db/roll-requests.ts:160 | `shaped` |
| dice check group | schemas:334 OWN_FIELDS keys (12) + use/ask/endEnchantment (:847); :862 hitDice; :876 recharge; :896 damage kinds, hitDie, formula, textRoll; else d20 | `dice:'none'·'hitDice'·'recharge'·'free'·'d20'` (15/1/1/6/7) |

**Design.** `src/constants/roll-kinds.ts`, pure data, client-safe: `ROLL_KIND_INFO = {…30 rows…} as const satisfies
Record<RollKind, RollKindInfo>` (type in types/roll.ts), `kindsWhere(pred)` = `ROLL_KINDS.filter`, the ordered lists
whose order is observable (`ANSWER_KINDS`, `OWN_KINDS`), and `NO_DICE` (3.2.1). ROLL_KINDS stays in
constants/sending-stone.ts (z.enum, availableRollKinds' order into `rollsToTable`). Name kept from the prior plan's
commit-6 seam. **Readers**: utils/requests/* and schemas/roll-request.ts (W); EFFECT_DICE_KINDS, COMPANION_UNTAKEN
derived under the same names (W); db/roll-requests.ts, campaign-events.ts, the 3 GM refusals (S); roll-tray.tsx:1652,
use-sheet-roller.ts:86, use-table-rolls.ts:1402 (R). **Stays local**: checkRoll's 23 cases (W.6 makes them a `CHECKS`
map), checkLinked's 7, the schema's per-kind words (OWN_FIELDS, PLAIN_WORDS: test-pinned), roll-tray
gmShape/gmVerbs/briefOf/breakdown (R; gmShape reads `damage`), use-table-rolls send* builders, and the 48
`kinds.includes('x')`/`takes('x')`/`lists('x')` gates (character-pane 20, use-table-rolls 20, campaign-events 5, …:
each asks "does this game take X now" at its call site). **Not request kinds** (grep hits): table-view.ts:342/437/903
(dnd5e roll.type), prompts.ts:145, favorites.ts:221/265, favorite-commands.ts:77, wild-shape*.ts (form.kind),
item-menu.tsx:210, sheet-entry.tsx:148, description-link.tsx:214, cookbook BONUS_ROLLS, and roll-tray's own
`roll.kind` ('damage'|'formula'|'ask'|'use'…, the result kind, keyed in BADGES :1816, briefOf :2107: R's). The chat
message kind (types/table.ts:67) is set once (table-view.ts:165).

### 3.2 Other 3+ copies

1. **No-dice body** `{mode:0, explicit:false, extras:[], dice:[]}`: use-table-rolls.ts:1011 PLAIN + exact inline
   :545 :605 :836; use-transfers.ts:58, use-end-turn.ts:204, use-turn-undo.ts:177, app/characters/[id]/party/[group]/
   page.tsx:18, db/cookbook.ts:306, db/note-sync.ts:607 :636, mocks/sending-stone.ts:4028. (7 more in use-table-rolls
   carry their own dice: stay.) **Key order differs** (party page: kind, mode…, transfer; use-transfers: kind,
   transfer, mode…): each adopter spreads `...NO_DICE` where its keys sit now (JSON bodies).
2. **`.optional().catch(undefined)`** ×67 (one disable each) → `leftOut()`; `.nullable().catch(null)` ×59 and
   `.nullable().optional().catch(null)` ×41 (fallbacks.txt) → optional `orNull()`.
3. **`(DIE_SIDES as readonly number[]).includes`** ×5: schemas/roll-request.ts:77 :423 :908, roll-modifiers.ts:56,
   formulas.ts:46 → `isDieSides()`. **[4,6,8,10,12]** ×3: damage-modifiers.ts:43 DIE_SIZES, constants HIT_DIE
   `/^d(4|6|8|10|12)$/` (:520), schemas HIT_DIE_SIZES = 5 (:115). hit-die-icon.tsx:17 (+20) and EFFECT_DIE_FACES
   (+100) differ: stay.
4. **`{ type, data: X.parse(data) }`** ×22 cases in parseGameEvent (schemas/sending-stone.ts:2352-2548).
5. In schemas/roll-request.ts: `results.every(r => r >= 1 && r <= faces)` ×4 (:595 :909 :942 :974) and
   `context.addIssue({code:'custom', path, message})` ×44: local helpers in W.7.
6. **Mocks** (mocks/sending-stone.ts): CommandResult head `status:'done', reason:null, error:null` ×9 (movedResult
   2221, distributedResult 2359, removedResult 2398, favoritedResult 2507, dishResult 2550, effectResult 2588,
   wildShapeResult 3119, beastsResult 3166, aloneResult 3505; differ in id, messageId, visible, own field); switch
   trios on/off/other ×5 groups, 14 consts (REMOVING 2384, FAVORITING 2430, TAKING_DISHES 2526 +versions,
   TAKING_EFFECTS 2567, TAKING_WILD_SHAPE 2607); table-view head (version 7, live, campaign, connected, messages) ×4.
7. Seen for other owners (Q1): GM refusal ×3 in db creators (S's command creator); settle constants ×4 (U1's settle
   hook: they **stay exports of '@/constants/sending-stone'**, two tests jest.mock them there).

## 4. Target shape (behaviour-preserving; hours for one builder)

```
src/constants/roll-kinds.ts   ROLL_KIND_INFO, kindsWhere, ANSWER_KINDS, OWN_KINDS, NO_DICE (+ .test.ts)
src/constants/dice.ts         DIE_SIZES, HIT_DIE_SIZES, HIT_DIE (derived)      src/utils/dice.ts  isDieSides
src/schemas/utils.ts          leftOut, orNull (+ .test.ts)                     src/schemas/types.ts  ParsedContainer
src/utils/requests/           types, availability, checks, check-linked, check-actions, check-sheet, check-turns,
                              check-damage, status, views, commands (.ts + .test.ts each)
src/utils/roll-requests.ts    v0.43-shim re-exports until Phase 4
src/mocks/                    types.ts, results.ts, switches.ts (+ sending-stone.ts using them)
```

- **W.1 Lenient helpers (Q2).** `leftOut = <T extends z.ZodType>(s: T) => s.optional().catch(undefined)` with the
  one disable and its reason; the 67 sites keep their inner chain verbatim (2 `.nullable().optional()` →
  `leftOut(x.nullable())`); optional `orNull` (= `.nullable().catch(null)`). Helper test: junk → undefined, good kept,
  absent absent. Pins: schemas/sending-stone*.test.ts, foundry-settings.test.ts, campaign-events*.test.ts, events
  route.test.ts; e2e sync, settings, wildshape. Risk low. **1.5 h**.
- **W.2 Die sizes.** constants/dice.ts (damage-modifiers.ts re-exports DIE_SIZES/DieSize as R's shim); HIT_DIE =
  `new RegExp(`^d(${DIE_SIZES.join('|')})$`)` re-exported from constants/sending-stone.ts (test: same `.source`);
  HIT_DIE_SIZES = DIE_SIZES.length; isDieSides adopted by the 3 schema sites (R's 2 in Phase 4). Pins:
  roll-request.test.ts, damage-modifiers/formulas/roll-modifiers tests. Risk low. **1 h**.
- **W.3 Event schemas table.** Hoist helloSchema, textsSchema (transform returns `{ texts }` only, as now),
  clearedSchema (`z.unknown().transform(() => ({}))`); `EVENT_SCHEMAS: {[K in GameEvent['type']]:
  z.ZodType<Extract<GameEvent,{type:K}>['data']>}`; parseGameEvent = `Object.hasOwn` lookup, one commented cast,
  else undefined. Same schemas → same ZodError and `z.prettifyError` text (it reaches the 400 body and the stored
  refusal). parseGameEvent stays exported from '@/schemas/sending-stone' (jest.mocked there). Pins:
  sending-stone.test.ts, events route.test.ts, campaign-events tests, C6. Risk medium (map typing). **2 h**.
- **W.4 The request-kind table.** (1) `RollKindInfo` in types/roll.ts; (2) roll-kinds.ts, 30 rows, with a test that
  every derived list equals today's literal (copied once; ordered where order is observable); (3) W's readers:
  GM_ROLL_KINDS, D20_KINDS, DAMAGE_KINDS, SUMMED, CHECK_TYPES, GM_UNSENT, FROM_TEXT, LINKABLE, ACTIVITY_CHECKS,
  ANSWERS, keyed, damaging, the dice groups, EFFECT_DICE_KINDS, COMPANION_UNTAKEN; (4) the seams of §6. Pins:
  roll-requests.test.ts, roll-request.test.ts, db/roll-requests.test.ts, campaign-events.test.ts, charges.test.tsx,
  roll-tray tests; e2e gmroll, companions, rolls, alone, typed. Risk medium (a wrong flag changes a refusal
  silently: the equality test lands first). **4 h**.
- **W.5 NO_DICE.** The constant (`as const satisfies Pick<RollRequestInput,'mode'|'explicit'|'extras'|'dice'>`),
  adopted in mocks; the 7 product files (11 sites) keep key order and are a Phase 4 follow-up. Pins: C3 posted bodies.
  **0.5 h** (+1 h follow-up).
- **W.6 utils/roll-requests.ts → src/utils/requests/.** Split per the tree; checkRoll → `CHECKS` map by kind group
  (activity-check pre-dispatch first, `damage` → undefined, kinds absent from today's switch still undefined);
  checkLinked → one function per link kind; toRollRequestView → branch functions, the six trailing spreads (moved,
  removed, favorited, effect, wildShape, alone: always last, same order) built once, so key order holds;
  toGmRollView, checkAloneChoices, checkEnchant → small helpers. isDying, sameCounter in status.ts (light imports:
  the client bundle sheds table-view & co). roll-requests.ts becomes the shim; its test splits by describe block.
  Pins: roll-requests.test.ts, db/roll-requests*, table, companions, route suites; e2e rolls, damagecard, endturn,
  uses, alone, gmroll, prompts. Risk medium-high (largest file; key order). **6 h**.
- **W.7 rollRequestSchema rules by group.** The 84 superRefine → ordered rule functions (effect dice, rerolls,
  naming, hit dice, targets/self, slot/weapon/consume, damage choices, prompt/link/text, key/combat/use,
  enchant/ending, own fields, count, then the dice branch by `ROLL_KIND_INFO[kind].dice`), each `(request, issue)`,
  in today's order: **identical issue list and order**; `issue()`, `inFaces()` helpers; transfer superRefine (17)
  likewise. `as unknown as z.ZodType<RollRequestInput>` → annotation `: z.ZodType<RollRequestInput>` (probe: exact;
  cookbook/foundry schemas already annotate). Pins: roll-request.test.ts (issue paths/messages per kind); seat
  routes (400, empty body: messages never reach the wire). **4 h**.
- **W.8 Hand types vs schemas** (types-probe.txt, 51 pairs). **Exact 11**: RollRequestInput, Envelope, BeastEntry,
  DamagePreview, JournalPage, SheetCounter, CookbookDishBody, NoteChange, NoteResolve, NoteOrder, NoteOrderResolve.
  The 4 Note* become `z.output<typeof …Schema>` (schemas/notes.ts imports nothing from types/notes); the other 7 keep
  their documented hand types and get the schema annotated `: z.ZodType<Hand>` where it is only parsed (aliasing
  would make types/sending-stone ↔ schemas/sending-stone a type cycle through GameEvent). 20 one-way, 17 mutual and 3
  differing pairs stay hand-written (loose objects add an index signature; transforms narrow): v0.44 list. **1.5 h**.
- **W.9 Types home; the type cycle.** The 14 exported types of §2 go to: types/sending-stone.ts (the six op/feature
  types, `(typeof X)[number]` by `import type`), types/cookbook.ts, src/utils/requests/types.ts (the 4), the
  conditions folder's types.ts (with W.11), src/mocks/types.ts (ChosenFavorite + the 3 local), src/schemas/types.ts.
  Old homes re-export (shims). DamageModifiers and ExtraTerm move into types/roll.ts (utils re-import them: seam);
  rerun cycles.cjs. Drop schemas/notes.ts:9. Pins: tsc. Risk low. **1.5 h**.
- **W.10 Mock base.** results.ts `DONE_HEAD` used as `{ id, ...DONE_HEAD, messageId, visible, rolls: [], <own>,
  ...fields }` (today's order); switches.ts `switchedOn(kind, extra?)`, `SWITCHED_OFF`, `OTHER_SYSTEM` (the 14 names
  stay, each one line); `tableViewOf(fields)`; notes-server's fetch fake (32) split into handlers. Optional: split
  mocks/sending-stone.ts by domain behind a shim, only with the move codemod (120 importers). Pins: every suite
  using them (gate 2); snapshots unchanged. Risk low-medium. **3 h** (+1.5 h split).
- **W.11 Placement moves (Phase 2a codemod).** constants/links.ts (+test) → src/components/help-links/;
  constants/conditions.ts → the sheet's conditions folder. **0.25 h**.

Order: W.11 (2a) → W.1 → W.2 → W.9 → W.8 → W.3 → W.10 (commit 10) → W.4 → W.7 → W.6 → W.5 (commit 11), full
jest after each of W.4/W.7/W.6. **≈ 25 h** vs the prior plan's 13 h for WS6: give W.6 a second builder or move
checkLinked/toGmRollView complexity to Phase 4.

## 5. Contract surface (byte-identical) and goldens

- **In:** rollRequestSchema accepts/refuses exactly as now (400 empty body, seat-routes.ts:132); commandsPollSchema;
  parseGameEvent per type: same data objects (incl. transforms: expandSheet, enchant :158, texts filter) and same
  ZodError → `z.prettifyError` in the events 400 JSON `detail` (≤1000 chars) and the stored refusal detail (2 lines,
  ≤300).
- **Out:** toCommand bodies (payload, id, actorId, of?, by?); RollRequestView/GmRollView key order; GM_ROLL_KINDS
  words; rollsKey strings; rollsToTable order (ROLL_KINDS); NO_DICE adopters' body key order.
- **Stored/queried:** campaign.rollKinds and companionKinds filters (campaign-events.ts:154-161, :251-256);
  Prisma `in ['save','ability','skill']` and `notIn` lists in today's order (asserted by db tests).
- **Overridden constants (gate 5):** '@/constants/sending-stone' EFFECT_SETTLE, WILD_SHAPE_SETTLE;
  '@/constants/cookbook' DISH_ATTEMPTS, MOST_DISHES_WAITING; '@/schemas/sending-stone' parseGameEvent: consumers keep
  these import paths.
- **Goldens (WS2):** C6: per EVENTS type, a good and a malformed payload → parseGameEvent output and prettifyError
  snapshot, plus the events route 400 body; rollRequestSchema issue list (path+message, ordered) for one bad payload
  per kind (30); C3: JSON.stringify of toCommand, toRollRequestView (each status branch), toGmRollView, and the
  NO_DICE adopters' posted bodies; roll-kinds.test.ts (derived = literal).

## 6. Seams

Phase 2b: (a) src/constants/roll-kinds.ts + its equality test, so S and R read it in their lanes; (b) DamageModifiers
and ExtraTerm into types/roll.ts with re-exports left in damage-modifiers.ts and roll-modifiers.ts (R's). Phase 4:
db/roll-requests.ts :154 :160 :164-168 :225 :323 :572-581 and campaign-events.ts :154-161 :251-256 (S) read the
table; roll-tray.tsx:1652, use-sheet-roller.ts:86, use-table-rolls.ts:1402-1405 (R) read it; NO_DICE in 7 product
files; isDieSides in roll-modifiers.ts:56, formulas.ts:46; importers of moved types and of utils/roll-requests.ts (16)
to new paths; G deletes the shims. **Names others import that move (shims until Phase 4):** every
utils/roll-requests export (rollsKey, RollRefusal, HeldRollRequest, RollCommand, availableRollKinds,
availableRollFeatures, toGmRollView, toCommand, GM_UNSENT, rollStatus, isDying, sameCounter, checkRoll,
checkEndTurn, checkUndoTurn, checkDamage, toRollRequestView); the six op/feature types; CookbookRefusalReason;
DIE_SIZES/DieSize. EFFECT_DICE_KINDS, COMPANION_UNTAKEN keep name and path.

## 7. Tests

Area suites: schemas/sending-stone.test.ts 6012, .groups 170, .settings 127, roll-request 3029, notes 216, cookbook
193, campaign 140, foundry-settings 132, constants/links 55, utils/roll-requests 7066. They stay beside their
modules; roll-requests.test.ts splits with W.6 into src/utils/requests/<module>.test.ts (assertions untouched;
gate 2 matches `fullName`, which includes describe titles: keep them, or map old → new names for the gate);
links.test.ts moves with W.11. New: roll-kinds, schemas/utils, dice tests. The area's suites use no jest.mock; the
jest.mock paths into the area (§5) don't move. Duplicated helpers: `NOW`/`ago()` roll-requests.test.ts:69-70 and
db/roll-requests.test.ts:43-51 (T's `atFixedTime` candidate; two copies: out of scope); request builders per suite
(roll-requests.test.ts:92, roll-request.test.ts:5-129, db test :66) are shapes, not copies.

## 8. Bugs seen

None confirmed in this pass (kinds, checks, views, fallbacks read for intent; the own-switch kinds' GM refusal is
enforced in each creator). Two behaviour questions, not bugs: a companion's prepare/spellSlot is refused 409
`unavailable` (via companionKinds) while its transfer/remove/favorite/effect/wildShape is 422 `unknown`
(db/roll-requests.ts:154); foundry-settings.ts:19 `listOf(entry, most)` cuts before dropping malformed entries while
sending-stone.ts:2277 `mostOf` cuts after (so they can't merge).

## 9. Out of scope and risks

Out: merging the two `listOf`s; `throws`/`matchesPlanned` (roll-requests.ts:1196/:1210); NOW/ago; splitting
constants/sending-stone.ts by concern (91 exports; jest.mock pins its path; no rule needs it); the 40 non-exact hand
types (v0.44); Q1's exclusions (shared poller/stores, End Turn state machine, journal context, sheet rows from
context). Risks: (1) a wrong table flag silently changes a refusal (the equality test lands first); (2) JSON key
order in views, commands, NO_DICE bodies (goldens compare strings); (3) superRefine issue order; (4) prettifyError
text in the events 400 body; (5) budget ≈25 h vs 13 h; (6) types leaving constants/sending-stone.ts touch 47 prod
importers: shims, then G's codemod.
