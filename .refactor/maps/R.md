# Map R: Rolling (re-plan, 2026-11-03, base 51b8916; final)

Scripts/outputs: .refactor/analysis/R/ (graph.cjs, importers.cjs, complexity.cjs → cross-area-importers.txt,
complexity.txt, eslint-disables.txt, cycle-edges.txt); full graph X/R/graph.{txt,json}. Paths below drop `src/`;
cs = components/character-sheet.

**Headlines.** 54 files: 28 prod (10,887 lines), 26 tests (23,625). §2: 6 .tsx export more than one thing (roll-tray 21,
roll-menu 9, damage-menu 5, roll-button 4, d20-rolls 2, dice-keypad 2), 2 more export only a hook returning JSX, 1 barrel.
§3: 17 named types in .tsx, 47 exported types in .ts. §7: 2 type-only cycles, 4 utils→hooks edges, rolling→sheet and
rolling→table edges. §9: 22 disables (21 no-null, gone at Q2); 30 top-level functions over 15. **The request lifecycle is
copied 6×** (3 in use-table-rolls, 3 outside), its controller set 4×, the PLAIN body 6×, body tails 8×, "way words" 7×,
the status line 4×, NOT_MADE 3×, log* 9×. 12 items, ~21 h. 3 bugs logged.

## 1. Inventory (prod; importers outside the area, prod unless marked)

| file | lines | exports | outside importers |
|---|---|---|---|
| cs/roll-tray.tsx | 2311 | comps RollTray, RollHistory, AreaOutcomes, DamageDue, SpentLines, GmPill; fns rollsName, offersDamage, listed, reasons, rechargeTitle, spentLine, shownTotal, briefOf; consts REASONS, GM_WORDS, BADGES, BADGE_ICONS; types TableRolls, RollDue, RollBrief (inside: 23 components, ~46 pure fns, 12 tables) | character-pane {reasons, RollTray, TableRolls}; action-entry {REASONS}; use-picker {listed}; wild-shape, game-table/turn-toast, transfers/move-status {reasons}; cs/index.ts re-export; tests charges, needs-player, seat-words |
| cs/roll-toasts.tsx | 270 | RollToasts | character-pane; 2 tests |
| cs/rolls-button.tsx | 183 | RollsButton | character-pane; companion-pane.test mock |
| cs/roll-button.tsx | 155 | RollTarget, LONG_PRESS, RollButton, pointWithin | 7 sheet files + press-menu.ts; LONG_PRESS in 6 tests |
| cs/roll-menu.tsx | 332 | RollChoice, MenuPoint, MenuItem, D20_CHOICES, RollMenu, ChoiceMenu, choiceItem, placing, pointOn | 9 sheet files (action-entry, concentration, description-link, hit-dice(-menu), item-menu, press-menu, sheet-entry, uses-menu) |
| cs/modify-roll.tsx | 154 | ModifyRoll | description-link |
| cs/d20-rolls.tsx | 94 | RollActions, useD20Rolls (hook → JSX) | action-entry, character-sheet, prompt-banner; type in favorites, sheet-tiles, companions/creature-header |
| cs/damage-menu.tsx | 420 | DamageChoice, DamageSubject, useDamageMenu (hook → JSX), ModifyDamage, formulaOf | action-entry, description-link |
| dice-entry/dice-entry-dialog.tsx | 785 | DiceEntryDialog (private Entry ~600 lines, Countdown, useSecondsLeft) | character-pane.test mock |
| dice-entry/dice-keypad.tsx | 121 | DiceKey, DiceKeypad | — |
| dice-entry/use-dice-entry.tsx | 79 | useDiceEntry (hook → portal) | via barrel |
| dice-entry/index.ts | 3 | barrel | character-pane {useDiceEntry} |
| hooks/use-table-rolls.ts | 1696 | 11 consts (CHECK_EVERY, FOLLOW_FOR, LATE_FOLLOW, BUSY_WAIT, BUSY_FOR, SEND_KEY, GM_SEND_KEY, ALONE_KEY, GM_ALONE_KEY, SEND_CHOICES, SETTLED); 5 types (RechargeRoll, AttackSource, TableRollState, WildShapeForms, DueDamage); useTableRolls, useGmRolls; gmRollsOf, withGmRolls, labelled, follow, refusal, toRollRequest, toFormulaRequest, toHitDiceRequest, toHitDieRequests, damageRollOf, choicesOf, damageDue, needsPlayer, missed | 17: character-pane (9 names), action-entry, effect-controls, enchantments, favoriting, preparing, wild-shape, end-turn-button, turn-toast, give-controls, move-status, remove-controls, use-end-turn & use-turn-undo {follow, SEND_KEY, GM_SEND_KEY, SEND_CHOICES}, use-transfers {follow, labelled, SETTLED}, use-spent-offers, utils/end-turn; 22 tests; needs-player.test mock |
| hooks/use-sheet-roller.ts | 1601 | ANIMATION_TIMEOUT, ROLL_HISTORY, MOST_EXTRAS, REROLL_NOTE; 13 types (SheetRoll, SheetDamageRoll, SheetFormulaRoll, Local{Extra,Check,Damage,Use,Move,Formula,Ask,GmRoll,Roll}, TypedRolls); useSheetRoller | 23 (types; character-pane the hook): 12 sheet files, 8 transfers files {LocalMove, LocalUse}, use-spent-offers, use-transfers; 7 tests |
| hooks/use-roll-toasts.ts | 148 | useToastSetting, useRollToasts, useToastTop | character-pane, turn-toast {useToastTop} |
| hooks/use-rolls-locked.ts | 13 | RollsLocked, useRollsLocked | action-entry, character-pane, description-link, recharge-chip; 3 tests |
| hooks/use-hold.ts | 253 | useHold | game-table only |
| utils/damage-modifiers.ts | 574 | 4 types, 3 consts, 19 fns | 9 sheet files, db/roll-requests, schemas/roll-request, types/roll, utils/roll-requests |
| utils/dice-modifiers.ts | 459 | 4 types, MOST_THROWN, 5 fns | area only |
| utils/roll-modifiers.ts | 92 | 4 types, MAX_DICE, MAX_FLAT, 2 fns | description-link, schemas ×2, types/roll, utils/roll-requests |
| utils/formulas.ts | 236 | 2 types, 8 fns | 6 sheet files, utils/description-links, utils/roll-requests |
| utils/effect-dice.ts | 222 | 5 types, 7 fns | character-pane, use-spent-offers |
| utils/move-words.ts | 227 | MovedPart, 5 fns | 4 transfers files, use-transfers |
| utils/roll-toasts.ts | 198 | 6 consts, 2 types, NO_TOASTS, 5 fns | TOASTS_KEY in 17 test suites |
| utils/damage-alone.ts | 102 | AloneChoice, aloneRollOf; **re-exports** alone-choices (3 fns, 4 types) | action-entry, use-picker |
| utils/typed-dice.ts | 96 | 3 consts, 3 fns | character-pane.test |
| utils/faces.ts | 52 | 4 fns | dice-entry-dialog only |
| utils/roll-mode.ts | 11 | toAdvantage | description-link |

Wrong-direction edges: roll-tray.tsx:16 → cs/effect-controls {useSpent, Spent} (rolling→sheet); roll-toasts.tsx:18 →
game-table/turn-toast {TurnToastContext} (rolling→table).

## 2. CLAUDE.md rule by rule

**§2.** roll-tray (21 → one per file, R.8); roll-menu (RollMenu, ChoiceMenu → 2 files; types → types.ts; D20_CHOICES →
constants; choiceItem, placing, pointOn → utils); damage-menu (ModifyDamage own file; hook own file; formulaOf → utils;
types); roll-button (RollTarget → types; LONG_PRESS → constants; pointWithin → utils); d20-rolls (RollActions → types;
hook); dice-keypad (DiceKey → types). **Hooks returning JSX** (useD20Rolls, useDamageMenu, useDiceEntry; 27 .tsx export
hooks repo-wide): planner decision, (a) hook in .ts returning state + one `<XDialogs>` .tsx (call-site seams), or (b) a
`use-*.tsx` whose only export is the hook (passes the planned "one export per .tsx" lint, not CLAUDE.md's text). I propose
(a) for useD20Rolls and useDamageMenu, (b) held for useDiceEntry (#440).

**§3 types.** In .tsx: TableRolls, RollDue, RollBrief, Creature (roll-tray:61,91,2061,80); RollTarget, Props
(roll-button:12,33); RollChoice, MenuPoint, MenuPlace, Props, MenuItem (roll-menu:35,42,82,92,129); Props (modify-roll:18);
RollActions (d20-rolls:13); DamageChoice, DamageSubject (damage-menu:33,36); DiceKey (dice-keypad:8); Asked
(use-dice-entry:10). In .ts not types.ts: 47 exported (13 use-sheet-roller, 5 use-table-rolls, 5 effect-dice, 4 each
damage-/dice-/roll-modifiers, 2 formulas, 2 roll-toasts, 1 damage-alone, 1 move-words) + 6 private (TypedEffect,
TypedOffer, More use-sheet-roller:526,529,1379; Press use-hold:22; Part, FormulaGroup damage-modifiers:51,250).
**Shared constants in hooks/components:** use-table-rolls' 11, LONG_PRESS, D20_CHOICES, BADGES, BADGE_ICONS, GM_WORDS,
REASONS. **Rules inside components:** roll-tray's ~46 pure fns (reasons 368-545, outcome/spent/recharge 685-806,
usedWords 1432, askedWords 1608, gm* 1663-1803, breakdown 1986, shownTotal 2045, briefOf 2095, accentOf 2171, madeIt
2218, checkDice 2232, tableLine 2254, toneOf 2296); damage-menu labelsFor 134, criticalHint 339, formulaOf 405;
DamageButton 925-936. **JSX logic:** RollHistory 205-215 (`table?.states.get(roll.id)` 4×), TableMark 1027-1066,
GmResult 1851-1868, DamageButton 995-1000, modify-roll 63-64. **SheetRoll builders inline:** d20-rolls 37-43, 54-60,
modify-roll 47-55 (+ description-link:1108, U2). **Hook-worthy:** RollToasts' top (roll-toasts:88-91 → useToastTop),
rolls-button's popover (U2's usePopover, Phase 4).

**§4 placement.** `features/rolling/` (sheet, table, transfers import it; it imports none of them after S-2/S-3).
By importers: damage-modifiers, dice-modifiers, roll-modifiers, formulas stay in **utils/** (server, schemas import them);
move-words stays (transfers + rolling); reasons/REASONS/listed → new **utils/roll-reasons.ts** (table, transfers, sheet);
lifecycle → **utils/lifecycle.ts, utils/pause.ts, constants/lifecycle.ts, hooks/use-follow.ts** (table, transfers, rolling);
damage-alone → features/sheet/utils (sheet-only; its alone-choices re-export goes); use-hold → features/table/hooks;
faces → beside the dialog. DamageModifiers, DieSize, CriticalAdds, DamageChange → **types/roll.ts** (seam S-1).

**§7.** (a) The 12-file type SCC (analysis/R/cycle-edges.txt) closes at formulas.ts:10 → use-sheet-roller (SheetFormulaRoll)
and types/roll → damage-modifiers (DamageModifiers): broken by R.1 + S-1. (b) move-words.ts:2-3 ↔ use-table-rolls.ts:22:
R.1. utils→hooks: roll-toasts.ts:1-6 (runtime needsPlayer, SETTLED), damage-alone.ts:1 (runtime damageRollOf), formulas.ts:10,
move-words.ts:2-3. Barrels: dice-entry/index.ts, cs/index.ts (re-exports RollTray; its owner deletes it), damage-alone's
re-export.

**§9 disables** (eslint-disables.txt). File scope, no-null, in tests, with reasons (11): roll-toasts.test, roll-tray.test,
rolls-button.test, use-sheet-roller.test, .typed.test, use-table-rolls.test, damage-alone.test, damage-modifiers.test,
formulas.test, move-words.test, utils/roll-toasts.test. Line no-null with reasons (10): roll-menu:157, roll-toasts:167,
rolls-button:53, use-table-rolls:540, 1371, 1621, damage-modifiers:552, formulas:234, effect-dice.test:288, 387. All 21 go
at Q2. Stays: use-dice-entry.tsx:37 no-useless-undefined "nothing typed in". None without a reason.
**Complexity > 15** (approx.; agg counts nested callbacks into the enclosing function, as sonarjs; file:line score):
use-table-rolls:262 useTableRolls 182 (sendDamage 33), :1251 follow 26, :1034 gmRollsOf 18, :1343 toRollRequest 17;
dice-entry-dialog:138 Entry 159; use-sheet-roller:551 useSheetRoller 144 (roll 37, rollDamage 22), :1227 toLocalFormula 16;
use-hold:44 60; roll-tray:1432 usedWords 56, :1986 breakdown 42, :1023 TableMark 31, :1717 gmLine 30, :892 DamageButton 22,
:2254 tableLine 18, :2095 briefOf 16; dice-modifiers:95 readModifier 49, :183 throwTerm 36, :251 rethrow 26, :402 18;
utils/roll-toasts:102 popToasts 42; formulas:32 formulaTerms 34; damage-modifiers:426 criticalParts 31, :471 24, :270 23,
:337 17; roll-modifiers:40 parseExtraTerms 26; use-roll-toasts:101 useToastTop 24; damage-menu:154 ModifyDamage 22;
roll-menu:147 ChoiceMenu 20; dice-keypad:66 DiceKeypad 18.
**#440 hold (may stay over 15; 5): Entry, useSheetRoller's roll and rollDamage, DiceKeypad, toLocalFormula.**

## 3. Duplication (3+ copies)

**D1 Request lifecycle** (POST, 'sending', poll, result/expiry, abort): (1) use-table-rolls:303-330 `start` (GM label,
aborted guard, partly-made `together`, Map set, `taken` keeps requestId); (2) :341-389 `startEach` (sequence; busy retry
BUSY_FOR/BUSY_WAIT); (3) :800-824 `readWildShapeForms` (await, last state); (4) use-transfers:51-81 `take` (label by
`role`, drops settled, sets 'sending' itself); (5) use-end-turn:176-212 `end` (no label; writes two states); (6)
use-turn-undo:156-186 `undo` (no label). Controller set + unmount abort, identical 4×: use-table-rolls:290-296,
use-transfers:43-49, use-end-turn:163-169, use-turn-undo:140-146. Home: **hooks/use-follow.ts** `useFollow()` →
`follow(api, input, onState, onTaken?)` owning the set, abort and aborted guard; **utils/lifecycle.ts** the pure
`follow`, `refusal`, `labelled`, `PLAIN`; **utils/pause.ts**. Each caller keeps its own onState. R adopts 1-3; 4-6 Phase 4.
**D2 PLAIN body** written out besides the const (use-table-rolls:1011): :544-547, :604-607, :835-838, use-transfers:57-60,
use-end-turn:203-206, use-turn-undo:176-179 (same key order). Home: lifecycle.ts PLAIN.
**D3 Body tails.** `typed`, `rerolls:'kept'` identical 7×: use-table-rolls:454-456, 485-487, 514-517, 864-866, 1434-1436,
1458-1460, 1480-1482; 1389-1395 differs (effectDice between them: keeps its own order). Damage tail `types?, critical?,
modifiers?, typed?, rerolls?` 3× in sendDamage (alone: critical from alone.critical; text: roll.critical; use: none).
Home: features/rolling/utils/request-bodies.ts `typedFields`, `damageTail`.
**D4 Request-kind table** (send* 591-874): switch-gated (`on && kinds.includes`): endConcentration, spend, inspiration,
spellSlot (keeps op), endEnchantment (keeps source?), ask, use, recharge; logged-gated (no switch, no kind check):
transfer, remove (label moveLabel), favorite, effect (body labelled with the effect's name), prepare, wildShape (body
label 'Wild Shape'). Home: utils/request-kinds.ts `PLAIN_KINDS` {gate, body, kept, label} + one `sendPlain`; the 18 send*
names stay. gmShape/gmVerbs (roll-tray:1663-1698), DAMAGE_KINDS (:1652), movesAlone (:244) read the same facts: join the
ROLL_KIND_INFO seam if the planner keeps it (W).
**D5 Way words** (sending/rolling → doing; done; else not + `${reason ? `: ${reason}` : ''}`): usedWords favorite
1440-1459, effect 1461-1476 (`Not ${short}`), prepare 1478-1493 (`.not`), wildShape 1495-1510 (doing/done are fns), use
1512-1545 (verb chain); askedWords 1608-1627 (askReasons); gmLine 1726-1765; utils/move-words moveWords. Home:
features/rolling/utils/way-words.ts `wayWords(state, role, words, reason)`.
**D6 Status line** (spinning LoaderCircle / Send / TriangleAlert + text-warning; `line` class 3×): TableStatus 589-649,
UseStatus 1394-1424, AskStatus 1574-1604, GmResult 1856-1909. Differ in span wrapping (TableStatus default, UseStatus
done), EyeOff for hidden (TableStatus, GmResult). Home: roll-tray/status-line.tsx (tone, icon?, children verbatim).
**D7 Not made** {failed, expired, lost, refused}: roll-tray:548, game-table/turn-toast:46, use-spent-offers:13 (UNSPENT);
SETTLED = it + done (use-table-rolls:243). Home: constants/lifecycle.ts.
**D8 log\*** use-sheet-roller:961-1103, 9× `{kind:'use', id:`use-${Date.now()}-${++uses}`, label, spell:false, …,
at: Date.now()}` + setRolls(keeping) (logAsk 'ask'/'ask-'; logEffect `at` param; logUse spell/itemCast). Home: one private
`keep(fields)`; same counter order and Date.now() calls.
**D9 Seat pair** useTableRole()+useCreature() → reasonOf: roll-tray 588, 1392, 1572, 1845; roll-toasts 95. Home:
hooks/use-tray-seat.ts (optional).
**D10 SheetRoll from RollTarget**: d20-rolls 37-43 (toAdvantage, explicit false), 54-60 (choice, true), modify-roll 47-55
(+extras, ask), description-link:1108. Home: utils/sheet-rolls.ts `rollOf`, key order per caller.
**D11 Menu + modify dialog** (useD20Rolls, useDamageMenu, useLinkMenus at description-link:123): DOM differs
(always-mounted `<Modal open={…}>` vs `{modifying && <Modal open>}`): **not merged**.

## 4. Target shape

```
features/rolling/ types.ts constants.ts
  hooks/ use-table-rolls use-sheet-roller use-gm-rolls use-roll-toasts use-toast-setting use-toast-top use-rolls-locked
         use-d20-rolls use-damage-menu use-tray-seat (.ts)
  utils/ request-bodies request-kinds roll-states gm-rolls damage-due local-rolls entry-terms effect-dice typed-dice
         roll-mode roll-toasts way-words tray-words gm-words brief sheet-rolls menu-points (.ts + .test.ts)
  components/ roll-tray/ (roll-tray roll-history latest-result status-line table-status partly-made area-outcomes
         damage-due damage-button table-mark check-result dice spent-lines damage-result formula-result terms use-result
         ask-result gm-result gm-pill) roll-toasts/ (roll-toasts toast badge) rolls-button/ roll-button/ roll-menu/
         (roll-menu choice-menu) modify-roll/ damage-menu/ (modify-damage damage-dialogs) d20-rolls/d20-dialogs
         dice-entry/ (dice-entry-dialog dice-keypad use-dice-entry faces.ts)
  __tests__/
utils/ roll-reasons.ts lifecycle.ts pause.ts (new); constants/lifecycle.ts; hooks/use-follow.ts
```
**R.1 Types and constants out** (recommend as Phase 2b seam, §6): all named types of the area → features/rolling/types.ts
(private ones too); the area's shared constants → constants.ts; formulas, move-words, roll-toasts import types only.
Pins tsc; MOST_EXTRAS=MAX_EXTRAS (.typed.test). Low. 2 h.
**R.2 One lifecycle (D1, D2, D7):** pause, follow, refusal, labelled, PLAIN moved verbatim; timings + SETTLED + NOT_MADE →
constants/lifecycle.ts; useFollow; start, startEach (keeps its busy loop), readWildShapeForms use it. Pins
use-table-rolls.test (polling, expiry, late, busy, abort), use-transfers/end-turn/turn-undo tests, e2e rolling, rolls,
endturn, givetake, typed. Risk: fake-timer order (setTimeout before addEventListener). 3 h.
**R.3 Builders and kind table (D3, D4):** toRollRequest, toFormulaRequest, toHitDiceRequest, toHitDieRequests,
activityCheck, formulaOrigin, damageDice, modeOf, the 3 damage bodies and recharge's → request-bodies.ts; PLAIN_KINDS +
sendPlain. Pins C2, use-table-rolls.test's JSON.stringify bodies. Risk: body key order. 3 h.
**R.4 State reducer:** roll-states.ts `rollStates(held, action)` {way (kept, state, partly), together, damaged(use),
offer(id)} + together, answeringOf, dueOf, busy, known, added, partly (also gmRollsOf:1071); hook keeps functional
setStates. Pins use-table-rolls.test, needs-player.test. 1.5 h.
**R.5 GM rolls:** gmRollsOf, namesOf, withGmRolls, heardOf → gm-rolls.ts; useGmRolls own hook (setState in render kept).
Pins GM block of use-table-rolls.test, e2e gm, gmroll, gmerr. 1 h.
**R.6 Damage due:** damageRollOf, choicesOf, damageDue, needsPlayer, missed, typesFor, chosenLabel, termsOf →
damage-due.ts; damage-alone imports it. **needs-player.test's jest.mock must target this module and all consumers
(rolls-button, roll-toasts.tsx, utils/roll-toasts, roll-tray, character-pane) import from it**, or its spies stop
intercepting. 1 h.
**R.7 Sheet roller split:** toLocal{Roll,Formula,Damage}, formulaTotals, setTerms, damageTerm, landTerm, (no)rethrows,
rerolls, rethrown, keeping, withEffects, offerTerms, withOffers, within → local-rolls.ts; damageEntryTerms,
formulaEntryTerms, typedSoFar → entry-terms.ts (moved only, #440); log* → keep (D8); roll/rollDamage/rollFormula
unchanged. Pins the 3 roller suites (.elven-off's `jest.mock('@/utils/typed-dice')` follows typed-dice), e2e manualdice,
typed. 2 h.
**R.8 Tray: one export per file, words per kind (D5, D6, D9):** verbatim first: reasons block → utils/roll-reasons.ts;
words → tray-words.ts; gm* → gm-words.ts; briefOf, accentOf, madeIt, checkDice, tableLine, toneOf → brief.ts; components
one per file; then wayWords (usedWords 56, gmLine 30), StatusLine, breakdown by a table (42), TableMark (31). Rolling→sheet:
SpentLines takes `useSpent`'s function from a rolling SpentContext the pane provides (S-3), or the edge stays listed.
Pins roll-tray.test (5152), .critical, seat-words, charges, C1, C4; e2e results, rolls, damagecard, alone, uses,
favoriting, effects, wildshape. Risk: markup (spans, class order), useId order (DamageBehind). 4 h.
**R.9 Toasts:** utils/roll-toasts → features/rolling/utils (SETTLED from constants, needsPlayer from damage-due);
useToastSetting, useToastTop (takes the turn foot), Toast, Badge own files; TurnToastContext via S-2. Pins
roll-toasts.test (2055), utils/roll-toasts.test, turn-toast.test, e2e toasts. 1 h.
**R.10 Small components:** pointWithin, placing, pointOn, choiceItem → menu-points.ts; ChoiceMenu, ModifyDamage own
files; labelsFor, criticalHint, formulaOf → utils; useDamageMenu, useD20Rolls → .ts + Dialogs components (S-4); D10
rollOf. Pins roll-button/menu/modify-roll/rolls-button tests, description-link and action-entry tests; e2e rolling, sheet,
phone. 2.5 h.
**R.11 Dice entry moved (#440: no behaviour change):** barrel gone (character-pane imports use-dice-entry); DiceKey, Asked →
types; faces beside; files moved whole. Pins dice-entry suites (use-dice-entry.test's relative `jest.mock('./dice-entry-dialog')`
holds if they stay together), character-pane.test:79 mock path, C8, e2e manualdice, typed. 0.75 h.
**R.12 use-hold** → features/table/hooks (Phase 2a move; V1 splits its agg 60). 0.25 h.
Order: R.1 → R.2 → R.3 → R.4 → R.5 → R.6 → R.7 (commit 12) → R.8 → R.9 → R.10 → R.11 (commit 13); R.12 in 2a. ≈ 21 h.

## 5. Contract surface (byte-identical) and goldens

- `POST ${api}/rolls` {method 'POST', headers {'Content-Type': 'application/json'}, body JSON.stringify(input), signal};
  `GET ${api}/rolls/${id}` {cache 'no-store', signal}. Body key order per kind as today (use: kind, item, activity,
  targets, self?, slot (null), enchant?, mode, explicit, extras, dice; wildShape: … dice, label 'Wild Shape'; GM seat:
  label last, trimmed, cut at MAX_ROLL_LABEL by code point; attack without targets: target null). 202 taken; 409/422/429
  body reason else 'error'; throw 'network'; poll 401/404 stop; 'lost' after FOLLOW_FOR unless late; failed+timeout
  without spent → LATE_FOLLOW; partly made `together`.
- Timings 1000/110000/330000/5000/65000; ANIMATION_TIMEOUT 15000; TOAST_FOR 4000, FADE 200, CAP 3, GAP 8; LONG_PRESS 500,
  DRIFT 10; ROLL_HISTORY 20.
- localStorage 'sending-stone:send-rolls' (on), '…:gm', 'sending-stone:send-damage' (off), '…:gm',
  'sending-stone:roll-toasts' (on); 'on'/'off'.
- Ids `use-${Date.now()}-${n}`, `ask-…` (one counter), `gm:${view.id}`; toast keys `${id}:${poppedAt}`.
- Words/names: REASONS (both seats), every status line; 'Your rolls' / `${name}’s rolls`; role=status aria-live
  polite|off; role=log 'Roll results'; 'Earlier rolls (n)'; 'Targets'; data-gm-roll; `Roll ${label} ${kind}`, 'Roll
  critical damage'; 'Modify roll', 'Modify damage'/'healing'; GM pill title + sr-only; REROLL_NOTE; z-[100001].
- Goldens: **C2** useTableRolls at both seats, typed and kept rerolls on/off: every send* once (25 kinds, 3 damage
  branches, the hitDie sequence, a busy retry, readWildShapeForms), each fetch whole via `posted()` (today endEnchantment
  and remove bodies aren't pinned here). **C4** reasons('player'|'gm'), briefOf over a table of states × kinds (incl. GM
  shapes, partly made). **C1** RollTray, RollsButton popover, RollToasts for ~12 rolls (ids normalized). **C8**
  useSheetRoller seeded: check adv/dis/elven, damage crit/maximize/rerolls, formula sets.

## 6. Seams and moving names

Phase 2b (M): **S-1** DamageModifiers, DieSize, CriticalAdds, DamageChange → types/roll.ts. **S-2** TurnToastContext
(turn-toast:38) → rolling, imported by turn-toast (V1) and roll-toasts. **S-3** SpentContext for SpentLines, provided by
character-pane (only if the rolling→sheet edge goes). **S-4** callers render the dialogs components of useD20Rolls,
useDamageMenu (action-entry, character-sheet, prompt-banner, description-link), if §2 (a). **Recommend R.1 as a seam**:
40 prod import edges in U1, U2, V1, V2 take the moving types; a seam avoids ~45 type shims.
Phase 4 (F): use-transfers, use-end-turn, use-turn-undo adopt useFollow/PLAIN; turn-toast, use-spent-offers adopt
NOT_MADE; description-link adopts rollOf; rolls-button, roll-menu adopt usePopover; bridge route adopts pause (optional);
cs/index.ts barrel.
Shimmed names (Phase 3, `v0.43-shim`, unless R.1 is a seam): roll-tray reasons, REASONS, listed, TableRolls, RollTray,
briefOf; use-table-rolls follow, labelled, SETTLED, SEND_KEY, GM_SEND_KEY, SEND_CHOICES, ALONE_KEY, CHECK_EVERY, choicesOf,
damageRollOf, damageDue, needsPlayer, useGmRolls, withGmRolls (+ types); roll-menu/roll-button placing, pointOn,
pointWithin, choiceItem, D20_CHOICES, LONG_PRESS; damage-menu formulaOf, useDamageMenu; use-roll-toasts useToastSetting,
useToastTop; d20-rolls useD20Rolls.

## 7. Tests

26 suites go beside their units (roll-tray.test stays the tray's; use-table-rolls.test with the hook). jest.mock paths that move:
character-pane.test:79 '@/components/dice-entry/dice-entry-dialog'; companion-pane.test:31 '@/components/character-sheet/
rolls-button'; needs-player.test:18-21 '@/hooks/use-table-rolls' (follows R.6); use-sheet-roller.elven-off.test
'@/utils/typed-dice'; use-dice-entry.test './dice-entry-dialog'. Duplicated helpers: respond/advance (use-table-rolls.test:290-300
among 23), the renderer mock (3), check/rolled fixtures (3 each).

## 8. Bugs seen (logged to bugs-found.md)

1. use-table-rolls.ts:496-502: sendDamage marks the attack `damaged` before the damage request is answered; a refused
   damage request (network, busy, 422) leaves it so and "Roll damage" is never offered again. Repro: an attack the game
   hits; offline; Roll damage → "Not made at the table: Sending Stone couldn't be reached"; online: no button. To confirm.
2. roll-tray.tsx:1761-1763: gmLine's partly-made line for the Gamemaster's hit dice omits "· N HP regained" that the
   player's own says (2286-2288, 668-673), though gmRollsOf keeps `healed`. Repro: GM spends 3 hit dice as the
   character, the game stops after 2. To confirm.
3. use-table-rolls.ts:1270-1276: a 202 whose body isn't JSON is told as refused 'network' though the game makes it.
   Unlikely (own server). To check.

## 9. Out of scope and risks

Out: shared poller/stores; the End Turn state machine; sheet rows from context; D11; pause's server copy and `within`
(1-2 copies); the dice parsers' complexity (readModifier 49, throwTerm 36, formulaTerms 34, criticalParts 31,
parseExtraTerms 26): split only with C8 green, else held. Risks: (a) body key order (C2 first); (b) needs-player's spies
(R.6); (c) fake-timer order in pause/follow; (d) tray markup and useId order (C1); (e) use-sheet-roller.test:1137-1150 pins
`console.error('Dice animation failed')` (use-sheet-roller.ts:581): the brief's "no console output" can't remove it here;
roadmap; (f) react-hooks/exhaustive-deps flags sendAsk's `[]` (use-table-rolls:843; `start` is stable): adding it changes
nothing; (g) the hook-returning-JSX decision spans 27 files.
