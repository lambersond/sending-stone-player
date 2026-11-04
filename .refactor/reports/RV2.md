# RV2: Phase 5 review of rolling and the sheet (v0.43)

- **Reviewer:** RV2. I am independent of the builders and edited nothing in APP.
- **Area:** commits 15 (R-a, e173ffc and fix 71cef6c), 16 (R-b, ef3507a and fix ac31d37), 17 (U1, 4114094, with aae075d and fix c9b5be3), 18 (U2, 64172b6 and fix bba5753) and 21 (F-a, 2abfc20).
- **Files:** src/features/rolling, src/features/sheet, src/hooks/use-popover.ts, src/hooks/use-follow.ts, and the rolling and sheet utils (lifecycle, dice, dice-, roll- and damage-modifiers, formulas).
- **Head:** 6e92666. Its src equals 153834e's, which had a green L1. I checked this with `git diff --stat 153834e HEAD -- src`, which prints nothing.

## Verdict

- **Behaviour:** I found no behaviour change and no bug that the refactor introduced.
- **Contract items:** every §1 item in the area is either done or has a deviation justified in a lane report or an amendment.
- **Findings:** 1 major and 2 minor. All three are CLAUDE.md placement issues inside the area, with no effect at runtime.

## Checks run (APP, under the brief's locks)

| check | result |
|---|---|
| `npx jest --ci src/__tests__/golden src/features/rolling src/features/sheet src/hooks src/utils --maxWorkers=2` (shared lock) | **124 suites, 5,214 tests, all passed. 1,001 snapshots matched, 0 written, 0 unchecked.** The 9 goldens C1-C9 are among them. |
| `npx jest --ci src/__tests__/import-cycles.test.ts` (shared lock) | 1 passed (0 cycle groups) |
| `npx eslint` over the area's folders and files (exclusive lock) | exit 0, no output |
| tsc, `next build`, e2e | Not rerun: src is unchanged since 153834e. RESUME.md records for that tree: L1 green (tsc 0), `next build` green, and e2e pass 4 at 104/104. |

## (1) Behaviour: the riskiest diffs, read against a2332a2

### R-a (commit 15)

**`follow` split into `post` and `look`** (lifecycle.ts):
- The awaits, timers and abort checks are the same. `update` runs inside the same try blocks.
- The late extension still happens once, through `heard === 'late' && !late`.
- RA-1's `{ id } | undefined` follows an id-less 202 as before.

**`start` on `useFollow`:**
- The abort guard moved into useFollow's `update`.
- `'sending'` is still set before the POST.
- `kept` is read inside the setStates updater: the `way` action is built inside it.
- `start`'s deps went from `[]` to `[followRoll]`, which is stable. sendAsk's `[start]` changes nothing.

**`takes()`** is equivalent to the 9 `!on || !kinds.includes(x)` gates. The damage gate keeps its `!use` check.

**request-bodies.ts**, checked key by key against the base:
- toAloneRequest: `critical` from `alone.critical`.
- toTextDamageRequest: `critical` from `roll.critical`.
- toDamageRequest: no `critical`.
- toRechargeRequest: `activity?` after `item`.
- `typedFields`: typed, then rerolls.
- `activityCheck`: reads `'check' in ROLL_KIND_INFO`, which is true for skill, tool and ability only. The same holds for `CHECKS`.
- NO_DICE's key order is PLAIN's.

**roll-states.ts:** each case equals the inline code it replaced. `partly` keeps its key position in gmRollsOf.

**`keep`:** all nine log\* make their `Date.now()` and `++uses` reads in the same order. logEffect's default `at` is still read first. Keys stay in order: kind, id, the fields, then at.

**The dice parsers** (readRethrow/rethrowOf, readKeepOrDrop, readLimit, readCount, apply/countMatches, rethrowDie, formulaTerm, extraTerm, groupsOf/readBracket/readSign) are extract-function splits. The branch order is unchanged, and so are the `most` and recursion checks and the error texts. `isDieSides` equals `DIE_SIDES.includes`. C8 is green.

### R-b (commit 16)

**wayWords, usedWords and askedWords:**
- verbsOf's first-match order is the base's last-assignment-wins order, reversed.
- `reasonOf`, `usedAt` and `madeOf` are now computed for every status, where the base computed them only in their branch. All three are pure, so nothing observable changes.

**gmLine:** gmNotMade checks `together` first, which matches the base's last-wins order.

**StatusLine:** the class string is the same in clsx order, and so are the icons per tone. The span wrapping matches each base site:
- UsedStatus wraps only when `made`.
- AskStatus never wraps.
- TableStatus and GmResult wrap as they did.

**Other tray pieces:**
- TableMark and MadeMark: madeWord gives the same precedence (recharge, then alone, then saved).
- RollHistory: `reachOf(undefined)` equals the base's `notSent` branch.

**popToasts** (draftOf, pop, meet, meetNew, capped): the identity tests behind `return book` are the same, and so are the cap loop and `told`/`quiet`.

**rollOf:** the key order is label, modifier, advantage, extras?, source, explicit, dc?, ask?. That is what the d20 tap, the d20 choose, ModifyRoll (extras always present) and rollAgainst each built.

**The bridges** (D20Dialogs, DamageDialogs, DiceEntryDialogs) give the same DOM. The `./dice-entry-dialog` mocks still intercept.

### U1 (commit 17)

**`useSettle` against the five base copies:**
- `missing: 'idle'` (favorites, prepare) matches the base's `!!state &&`.
- `'waiting'` (effects, slots, Wild Shape) matches `!state → !settled.has`.
- The `agrees` inputs equal the base's checks. For favorites, `isFavorite` reads only the key's fields.
- `send`, then `setHeld`, then the timer, in the base order.
- The `useCallback` identities change on the same inputs as before.

**RollingSheet:** the passive effects run in the same order:
1. useTableRolls
2. the prompt answers
3. the roller
4. the give/remove controls
5. onPending/onBusy
6. the toasts setting, conditions and cookbook
7. the picker's focus return
8. favorites, prepare and effects
9. Wild Shape
10. the due-damage effect
11. the actions layout

The layout effects also run in order: the lock, then useWidth, then the effect controls, then useSpentSet, then useSpentRemovals.

useSlotWaits now registers its unmount-only timer clean-up earlier. That has no observable effect.

**Memos:** the pane's memos are the base's own. No memo was added.

**`command()`:** each command keeps the base order setActed, log, send. Heroic Inspiration and an enchantment's end still pass `acts: false` (B14 kept). The slot command keeps its waiting guard and `slotWaits.sent` after the send.

**Wild Shape:**
- The effect order is still useStoredText, then the settle clean-up, then settle, then focus, then return-confirm.
- `dispatch` and the settle effect's unsettle and settleNow paths equal the base's.
- `made()` reads `view` and `opener` from the current render, as the base effect did.

### U2 (commit 18) and F-a (commit 21)

**usePopover:**
- usePortalRoot, then useTopmostEscape, then useFloating, in the sites' order.
- Middleware is `offset(gap)`, `flip`, `shift` (`crossAxis` only where it was given) and `size(fit)`.
- `elements.reference` is passed only where an anchor was.

**The 9 adopters**, each checked against its base call:
- The placement and gap are the same.
- ChoiceMenu and hit-dice-menu keep their point layout effect, with deps on `setPositionReference`.
- RollsButton passes `escape: false`, so its Escape quirk is kept, and it still reads the close reason.

No file outside use-popover.ts imports useFloating.

**Picker:**
- `defaultSlot` equals Choices' initial slot.
- `optionsOf` equals the inline `options`.
- whomOf and whomOfUse keep the whom tree's order.

**checkLabel:** I byte-checked all four labels against the base templates (character-sheet.tsx :418, :458, :518 and favorite-row.tsx:295).

**Coverage:** C1 (G1, G4, G5), C2 (G1-G3) and C4 cover the rest, and they are green.

## (2) Items

Every item in R1.1.1-R1.1.22, R1.2.1-R1.2.13, R1.9.20, R1.9.24 and R1.9.25 is done, or its deviation is justified.

**Deviations justified elsewhere:**

| item | deviation | justified in |
|---|---|---|
| R1.1.3 | named rollActions/linkActions | amendment 5 (d) |
| R1.1.3 | the blockedReason merge | amendment 5 (c) |
| R1.1.4 | 423 lines, not ≈ 200 | U1-m3 (an estimate) |
| R1.1.16 | no `point` option | amendment 5 (e) |
| R1.2.2 | startEach and readWildShapeForms keep their own controller set | R-a deviation 2, G-12 |
| R1.2.5 | gmRollsOf | G-2 moved it |
| R1.2.8 | gmVerbs has no kind-table field | R-b deviation 3 |
| R1.2.8 | toneOf and reachOf placement | R-b deviations 8 and 9 |
| R1.2.9 | the toast hooks | G-1 |
| R1.2.9 | the turn foot read in RollToasts | R-b deviation 1 |
| R1.2.11 | dice entry moved only | the contract itself |
| R1.9.25 | no change | listed by F-a, FA-R2 |
| — | the request-bodies tests stay in use-table-rolls.test | R-a deviation 5, frozen tests |

**Not done and not justified:**
- **R1.1.17's map U2 §2 line for effects-tab:** "utils.ts: conditionDetail and the effect detail at :195-204". effectDetail was not moved (RV2-1).
- **R1.2.8's GM_WORDS placement** (RV2-3).

## (3) CLAUDE.md in the area's files now

- **One export per .tsx:** every product .tsx in rolling and sheet has exactly 1 `export`.
- **Named types:** none in a .tsx. Outside types.ts there are only three:
  - damage-modifiers.ts Part and FormulaGroup (base, file-private, G-23).
  - use-spent-removals.ts `Effecting`, which is new (RV2-2).
- **Disables:** 7 product disables in the area, each line-level and each with a reason. No `@ts-ignore` and no NOSONAR.
- **`use*` functions:** each one calls a hook.
- **Directives:** 'use client' sits only on base files and on component .tsx files split from them (§1.0 rule 9).
- **Cycles:** none.
- **Tests:** unit suites sit beside their units, and the integration suites are in `__tests__/`.
- **Rules in utilities: not met in six sheet files** (RV2-1). Pure helpers in area .tsx files went from 138 at a2332a2 to 18 at 2abfc20. Of those 18:
  - 7 are dice-entry-dialog's (moved only, by R1.2.11).
  - 3 are DOM event helpers.
  - 8 are domain helpers left in sheet components. These are RV2-1.

## (4) Bugs

No bug was introduced. I found no new base bug, so bugs-found.md is unchanged.

## Findings

### RV2-1 (major, rolling-sheet): domain helpers still live inside sheet component .tsx files

**What:** these eight pure functions are file-private inside component .tsx files:

| file | functions |
|---|---|
| src/features/sheet/components/effects-tab/effect-entry.tsx | `effectDetail` (:105) |
| src/features/sheet/components/spells-tab/spells-tab.tsx | `foundOf` (:170), `preparedCount` (:280) |
| src/features/sheet/components/spells-tab/spell-entry.tsx | `fromNote` (:122), `factsOf` (:146) |
| src/features/sheet/components/features-tab/features-tab.tsx | `originName` (:166) |
| src/features/sheet/components/sheet-tiles/portrait.tsx | `initials` (:40) |
| src/features/sheet/components/sheet-entry/sheet-entry.tsx | `keyTarget` (:20) |

**Why it is a finding:**
- CLAUDE.md §2 and §3 put domain calculations, transformations and filtering in utilities.
- round.md §0.3's "rules in utilities" row says such functions are "moved verbatim to utils.ts beside their component".
- R1.1.17 works "per map U2 §2", and that map names effectDetail for effects-tab/utils.ts.

**Evidence:**
- `git grep -nE "^(export )?(async )?function [a-z]"` over the area's .tsx files lists them.
- Each function is called only in its own file. `initials` also appears in character-sheet.test.tsx, but only as a word.
- U2's report has no deviation for them.

**Fix (U2's files):**
- Move each function verbatim, with its doc comment, into its folder's utils.ts. effects-tab, features-tab and sheet-tiles already have one; make spells-tab/utils.ts and sheet-entry/utils.ts.
- Export each one, and add one import line in its component.
- No test changes. `initials` keeps its first-code-unit behaviour (B8).
- Then run L0 over the six files, plus C1 and C4.

### RV2-2 (minor, rolling-sheet): a new file-private named type outside types.ts

**What:** src/features/sheet/hooks/use-spent-removals.ts:6 has `type Effecting = Pick<Effects, 'effectOf' | 'choiceFor' | 'send'>`. Commit 17 added it, and c9b5be3 kept it.

**Why it is a finding:**
- In that same fix round, U1-m4 moved this folder's other types to FS/hooks/types.ts.
- RA-3 removed a file-private type of exactly this kind (FormulaScan).

**Evidence:** `grep -nE "^(export )?(type|interface) [A-Z]"` over the area finds it beside the base's two damage-modifiers types. It is used at :15 and :53.

**Fix (U1's file):** either one works.
- Move it to src/features/sheet/hooks/types.ts and use `import type { Effecting } from './types'`.
- Or inline `Pick<Effects, 'effectOf' | 'choiceFor' | 'send'>` at its two uses, as use-spent-set.ts does.

### RV2-3 (minor, rolling-sheet): GM_WORDS and GM_WORDS_AFTER sit in a utils module

**What:** src/features/rolling/utils/gm-words.ts:18 and :21 hold these two constants. They are read by three files: roll-tray/gm-result.tsx, roll-tray/gm-pill.tsx and utils/brief.ts.

**Why it is a finding:**
- R1.2.8 sends GM_WORDS to a constants.ts wherever the split leaves two or more readers (§1.0 rule 8, CLAUDE.md §3).
- R-b's report puts it in gm-words.ts and gives no deviation.

**Fix (R-b's files):**
- Move both constants, with their doc comments, to src/features/rolling/constants.ts. That file imports only types, so no cycle forms.
- Retarget the three import lines. No test imports them, and the values are unchanged.
