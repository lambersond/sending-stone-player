# Completeness critique of the v0.43 contract (draft round.md + owners.tsv at c94fe3f)

Critic: completeness. Question: is anything dropped between the maps (maps/*.md), the metrics
(analysis/metrics-base.md), the bug log (bugs-found.md) and the contract (round.md, owners.tsv)?
Code read at HEAD (src equals 24f808b's, round.md:6). Line numbers below are round.md's, owners.tsv's
(file line, header = 1), the maps', or the source's at HEAD.

The checks are small node scripts in `.refactor/analysis/completeness/` (`node <script>.mjs`; each
writes the `.txt` beside it). Per this step's instructions they are not committed: only this file is.

## Results by check

| check | result | script |
|---|---|---|
| every map item (T.1 … V2.12) in §1.11 and §1 | 92 of 92 indexed, each target item exists; files: see F1, F4, F7, F8, F11 | map-items-check, new-files-check |
| rule (a) files (metrics §2) have a row and a fixing item | 74 of 74; per lane U1 12, U2 18, R-b 7, V1 4, V2 33 = §0.4.2 | metrics-check |
| rule (b) named types (94 product .tsx, 48 .ts) have a fixing item | 3 .tsx have none (F5); 4 S rows don't cite R1.3.12 (F5) | metrics-check, types-strict, rule2-check |
| functions over 15 (metrics §4) have a `cc:` token and an item naming them | 63 of 63 (2 held, §0.6.8); per lane = §0.4.1 | metrics-check |
| eslint-disable directives | 430 in 248 files (= metrics); every file has a row, counts agree; what stays matches §1.7.2's ≤ 25 list; camelcase's 10 all fall in §0.6.7's six names | disables-check |
| cycles and barrels | every edge closing the four groups has an item (R1.3.1, R1.9.1, R1.4.9, R1.2.1, R1.5.19); 27 barrels → R1.0.1; zone 4 holds after 2b (only formulas.ts:10, move-words.ts:2-3, both moved to src/types/roll.ts by owners.tsv:561) | zone4-check, zone4b-check, server-import-check |
| every bugs-found.md entry in §4 | 20 of 20 (B1-B20); §4.5's ROADMAP text drops B20 and Q2 (F10) | bugs-check |
| every seam a map names in §1.9 | all placed (R1.9.1-6, R1.9.20-25, §0.6, §1.10); none dropped | by hand |
| every map risk in §5 | 11 not there (F9) | by hand |
| every owners.tsv base path exists; `-` rows cite real items | 0 missing; 0 unknown item ids; 4 tracked src files without a row are not edited (2 icons, globals.css, a json fixture) | owners-check |
| new files the items create have a row | the rolling lanes' new files and two 2b tests have none (F4) | new-files-check |
| no file has two lanes in Phase 3 | by path: none (only same-lane duplicate rows, F6); by item text: R1.2.12 (F2) | lanes-check, items-check, item-files-lane |
| the files the maps left without an owner | all owned: favorites, character-sheet, sheet-settings, party-sheets, conditions-reference → U1 (owners.tsv:164-229); uses-button → U2 (:240), Charging/useCharging/ChargeActions → U1 (:747, :812-814) | owners rows |
| the commit list covers every item | R1.9.6's server part is in no sequence or commit (F3); R1.2.12 is in the wrong lane's commit (F2) | items-check |
| 2b export list (R1.9.1) | 257 (source, name) pairs from 70 modules to 140 destinations, none with two destinations (fact 21's 218/66 plus rule (2)'s types) | moves-count |

**Totals: 2 major, 9 minor.**

## Findings

### CO F1 (major). Map goldens for the riskiest consolidations and splits are not in C1-C8, and nothing says why

The maps asked for characterization goldens, made on today's code, before the items that put each
behaviour at risk. §3.2's eight suites (round.md:1237-1296) absorb some of them (G-U1a → C2, G-U1c → C1,
G-U1e and G6 → C7, G7 → C4, G-S2-S5 → C5/C7). The ones below are in no golden and not in §1.10:

- **G-U1b settle matrix** (maps/U1.md:276-278): 5 clients × waiting at settle−1 ms / not at settle ×
  the missing-state case (favorite/prepare `idle`, effect/slot/wild `waiting`). The map's mitigation
  for R1.1.1's own named risk ("Medium (the missing-state difference)", round.md:314; maps/U1.md:184
  "G-U1b first"). Today only favoriting.test.tsx:159, preparing.test.tsx:190,
  effect-controls.test.tsx:288 and wild-shape.test.tsx:755 advance a settle timer. No character-pane or
  charges suite mentions EFFECT_SETTLE (grep), so useSlotWaits' settle has no pin.
  R1.1.1's pins (round.md:312-313) are suites plus C2 and C4, which pin no timer.
- **G-U1d** (maps/U1.md:279-280): inspiration and enchantment end leave the tray hidden on a
  non-rolling tab. That is bug B14 kept as is, and the only check that R1.1.2's `acts: false` keeps it.
- **U2's G1-G5** (maps/U2.md:324-328): G1 picker markup per step plus the onPick JSON per path; G2
  useDamageRolls' JSON per branch; G3 each DescriptionLink kind's call JSON; G4 ActionsTab in the list,
  table and columns layouts; G5 each popover's portal, role and "Escape closes only the top one". The
  map's risk (g) (maps/U2.md:388) says these must exist before S.2-S.6. C1 renders one picker step
  ("Longsword attack picker") and the Actions tab in its default layout only, with no Escape behaviour.
  R1.1.14 merges the list and table chip rows (round.md:387-391), and R1.1.16 merges nine popovers with
  different Escape handling (round.md:398-403). §5 #8 (round.md:1496) names "the tray, picker, popovers"
  as C1's to catch.
- **V1's C1 states** (maps/V1.md:258-263): no campaign, choose actor, no sheet ± withheld, my turn + 3
  unread, not connected, GmNote ×3, companions (one gone, one asked), party open; ChatLog per kind and
  variant; CombatTracker none / not started / mine / companion's / refusal / sending; TurnToast each card ×
  character/companion; LiveStatus 4 × 2; FullscreenButton ×3. C1 has GameTable at three seats, one
  message, one combat and the turn toast's `taking` only. R1.5.5 (Medium-high, round.md:682-688) and
  R1.5.6-8 rely on C1.
- **V2's C-route** (maps/V2.md:89, last clause): each page's metadata, notFound and requireUser path.
  C5 covers API routes only (round.md:1270-1272).

**Fix:** add these cases to C1, C2, C4 and C7 (G-U1b fits a C7-like timer table; G5 fits C1 with a
keyboard step), or list each one in §1.10 or §3.2 with the reason it is left out and the suite that
pins it instead. Then re-state §5 #6-#8's "caught by" to match.

### CO F2 (major). R1.2.12 is an R-b item that edits R-a's files

R1.2.12 sits in R-b's sequence (round.md:1104, commit 16) but says "the react-hooks findings in R-a's
and R-b's files (use-table-rolls.ts:843's `[]` …)" (round.md:500-502). use-table-rolls.ts is R-a's
(owners.tsv:500, lane R-a). Its `hooks:exhaustive-deps@843` finding has no R-a item there: the row cites
R1.2.1-R1.2.6, not R1.2.12. The `}, [])` is at use-table-rolls.ts:843. Eleven R-a rows cite R1.2.12 as
their "tests follow" item: owners.tsv:489, 490, 492, 499, 578, 582, 586, 605, 610, 629 and 655
(items-check.txt). R-a's R1.2.2-R1.2.6 all rewrite use-table-rolls.ts, so the two worktrees would
almost certainly conflict there. That breaks §0.2.5 and §2.2.1 as written.

**Fix:** split R1.2.12 the way R1.4.4 and R1.1.22 are split. Put an R-a part in R-a's sequence
(round.md:1104, commit 15) for use-table-rolls.ts:843 and R-a's tests. Leave R-b the tray's refs and
its own files. Add the R-a part to owners.tsv:500 and the eleven test rows.

### CO F3 (minor). R1.9.6's server adopters are scheduled nowhere

R1.9.6 (round.md:940-943) says S adopts `...NO_DICE` at db/cookbook and db/note-sync. The three sites
exist: db/cookbook.ts:305-308, db/note-sync.ts:606-609 and :635-638. But S's sequence (round.md:1102-1103)
has no R1.9.6, and no S item names NO_DICE: of all §1 items only R1.2.2, R1.4.5, R1.5.9 and R1.5.19 do.
owners.tsv:436 and :442 don't cite it. The party page that R1.5.19 adopts (round.md:762) is
owners.tsv:94, which cites only R1.5.22. As written, §0.4's "no-dice body tail 11 sites → 1 NO_DICE"
(round.md:99) misses three sites.

**Fix:** add R1.9.6 to S's sequence (it fits commit 9 with R1.3.14) and to owners.tsv:436 and :442.
Add R1.5.19 to owners.tsv:94.

### CO F4 (minor). The rolling lanes' new files, and two new 2b tests, have no owners.tsv rows

round.md:7-8 says every file the plan creates is a row. §2.2.3 (round.md:1047-1049) checks "every
file with a row" after commit 8. The sheet and the table cover their new files with glob rows
(owners.tsv:744-761). Rolling has rows only for what 2b creates (owners.tsv:689-700). Every file
created in Phase 3 is missing:

- **R-a:** FR/utils/request-bodies.ts and request-kinds.ts (R1.2.3), roll-states.ts (R1.2.4),
  local-rolls.ts and entry-terms.ts (R1.2.7).
- **R-b:** tray-words.ts and gm-words.ts (R1.2.8), plus the ~19 component files under
  FR/components/roll-tray/ (round.md:476); roll-toasts' Toast, Badge, useToastSetting and useToastTop
  files (R1.2.9); ModifyDamage's file, d20-dialogs.tsx, damage-dialogs.tsx and FR/utils/sheet-rolls.ts
  (R1.2.10); dice-entry/types.ts (R1.2.11).

FR/utils and FR/hooks hold files of both R-a and R-b (owners.tsv:586-598, 627-634, 689-697), so the
matrix does not show who may create a file there. §4.5's ROADMAP text cites
src/features/rolling/utils/gm-words.ts (round.md:1451), a file with no row.

R1.9.4 also promises "small tests" for useFollow and useSendChoice (round.md:937; §3.1.3 at
round.md:1181-1182). Neither src/hooks/use-follow.test.ts nor FR/hooks/use-send-choice.test.ts has a row,
and gate 3's counts.conf needs commit 8's line for them.

**Fix:** add `-` rows (or glob rows like :744-761) for each file above, with lane and item.

### CO F5 (minor). Three .tsx files keep a named type with no item; four S rows don't cite R1.3.12

avatar.tsx:3, copy-button.tsx:7 and sign-in-buttons.tsx:17 each declare a local `type Props`. Their rows
(owners.tsv:115, 262, 371) have `types:1` and items "(none: moves only)". R1.9.1 moves only the
exported names another lane imports, and R1.5.21 (round.md:771-773) doesn't name these three. So §0.4's
"named types in .tsx … 0 product" (round.md:84) would miss by three, and commit 23's TSX_TYPE at error
(§1.7.3, round.md:838-839) would fail. Separately, db/cookbook.ts (5 exported types), db/party.ts
(PartySeat), db/table.ts (CampaignStatus) and lib/notes-routes.ts (NotesPlace, NotesAddress) have
`types:` breaks. Their rows (owners.tsv:436, 446, 456, 527) don't cite R1.3.12, which moves S's exported
types; no 2b note moves these names.

**Fix:** name the three files in R1.5.21 (Props → each folder's types.ts) and cite it on their rows.
Add R1.3.12 to the four S rows.

### CO F6 (minor). owners.tsv doesn't record Phase 4, and some rows disagree with their items

- No row cites R1.9.20-R1.9.25. The eleven files they edit (owners.tsv:176, 185, 215, 222, 229, 245,
  292, 333, 456, 502, 652) have no `4` in phases. So §2.2.5's "F-a and F-b never touch the same file"
  (round.md:1055-1056) rests on round.md's table only. It holds today: F-a's files and F-b's are
  disjoint (round.md:951-956).
- Phases that miss what the items need (phases-check.txt):
  - types/cookbook.ts and types/table.ts receive names in 2b, but their phases say `3` and their items
    lack R1.9.1 (owners.tsv:556, 563);
  - utils/dice.ts, utils/dice.test.ts, FR/utils/menu-points.ts and utils/roll-reasons.ts cite Phase 3
    items but have phases `2b` (owners.tsv:681, 682, 695, 701).
- Duplicate rows for one new file, same lane (lanes-check.txt (a)): charging ×2 each (owners.tsv:747
  vs :812-814), description (:754 vs :793-794), notes/companions/transfers/cookbook/modal pieces
  (:770/:803, :773/:800, :777/:883/:887, :778/:884-885, :779/:801-802, :780/:795-798).
- owners.tsv:667 (src/mocks/types.ts, lane W-b) cites R1.4.9, a W-a item whose text (round.md:640-643)
  doesn't touch it. R1.4.10 is the item that does.

**Fix:** add the Phase 4 items and `4` to those rows, correct the six phases, merge the duplicate rows,
and drop R1.4.9 from :667. This matters because the post-commit-8 matrix check (§2.2.3) reads these
columns.

### CO F7 (minor). One "replaces" site of the request-kind table has no adopting item

§1.6's `check` row lists use-sheet-roller.ts:86 (round.md:805): `const CHECKS = new Set(['skill',
'tool', 'ability'])`. §1.6 says readers adopt in their lanes (round.md:814), but no R-a item names it.
R1.2.3's activityCheck is use-table-rolls.ts:1402-1405, and R1.2.7 (round.md:468-472) doesn't mention
CHECKS. Map W §6 had it as R's (maps/W.md, §6 Phase 4 list).

**Fix:** add it to R1.2.7, or to R1.2.1 with the area's constants, or move it to §1.6's "stays local"
list with a reason.

### CO F8 (minor). Two 3+-copy duplications the maps name have neither an item nor a §1.10 line

- Map R D9, the seat pair (maps/R.md:137-138): `useTableRole()` + `useCreature()` → reasonOf at
  roll-tray.tsx:587-588, 1392-1393, 1572-1573, 1845-1846 and roll-toasts.tsx:95-96 (5 copies). Map R
  listed it under R.8 (optional hooks/use-tray-seat.ts); R1.2.8 (round.md:474-484) doesn't mention it.
- Map V1 D10, the latest-value ref (maps/V1.md:152-154): turn-toast.tsx:398-401, :503-506 and
  end-turn-button.tsx:46-49 (layout); use-end-turn.ts:156-159 and use-turn-undo.ts:134-137 (passive);
  "8 more in src".

§1.10 (round.md:965-984) lists the two-copy merges and the near copies, but neither of these. Q1 (a)
and §0.2.4 make three or more copies the threshold.

**Fix:** a §1.10 line each (e.g. "optional in the map, low value, layout vs passive timing differ"),
or an item.

### CO F9 (minor). Eleven map risks are not in §5

| map risk | where | what §5 would need |
|---|---|---|
| S.8 rebuilds stored arrays (hello's rollKinds, features, companions orders) | maps/S.md:341 | a row: C7's G-S4 hello data, campaign-events suites |
| S.4's per-route headers | maps/S.md:341 | a row: C5's sorted headers, the 34 route suites |
| slim-sheet `expand` is the largest single complexity job | maps/S.md:343-344 | a row, or R1.3.11's own risk line |
| D1's missing-state difference (U1 c) | maps/U1.md:325-326 | a row naming its catch (see F1: G-U1b) |
| G1-G5 must exist before the U2 splits (U2 g) | maps/U2.md:388-389 | a row naming the catch (see F1) |
| DiceRendererProvider position (V1 R2) | maps/V1.md:319-320 | a row: renderer counts in .companions, C3 |
| Sonar scores extracted hooks apart (V1 R7) | maps/V1.md:323-324 | a row: useCompanionRow, useTurnEnding may need a further split |
| module-instance stores: a shim must re-export, never copy (V2 3) | maps/V2.md:108 | a row: §0.6.11, one store instance |
| campaign-styles/ids moved into a client module make CampaignCard a client reference (V2 5) | maps/V2.md:108 | a row: R1.5.18's rule, `next build` |
| a non-test .ts under `__tests__/` is run as a suite (T e) | maps/T.md:346 | a row: R3.6's rule |
| prismaFake's `where` matching must be strict enough to show a changed query | maps/T.md:281-282 | a row: C5 records `fake.calls` args |

**Fix:** add these rows to §5 (round.md:1487-1514).

### CO F10 (minor). §4.5's ROADMAP text drops B20 and Q2

The request's rule 3 (request.md:13) puts each bug found in ROADMAP. §4.5's v0.44 item 9 has 19
bullets, B1-B19 (round.md:1443-1478). B20 (round.md:1417-1421; bugs-found.md's [V1] jest-harness entry)
isn't there, and §4.4 doesn't say why. Its "Questions from it" line (round.md:1479-1482) carries Q1 and
Q3-Q9 (Q4 sits in the B14 bullet). Q2 (round.md:1404-1405, foundry-settings.ts:19 `listOf` vs
sending-stone.ts:2277 `mostOf`) is missing.

**Fix:** add B20 to §4.5, or a line in §4.4 saying it is left out because R1.9.3 removes the cause.
That is itself a test-harness change: the two suites then run real timings, gate-2-neutral by fact 14.
Add Q2 to the questions line.

### CO F11 (minor). §3.3 places four suites differently from the maps, with no reason

- T.8 lists use-transfers.test.tsx as an integration suite (maps/T.md, T.8: "rolling: … use-transfers").
- T.8 puts give-controls.test.tsx under the table, because it renders GameTable.
- V2 §7 (maps/V2.md:99) calls party-sheet.test and journal-modal.test "de facto integration suites
  (rename into F/<feature>/__tests__/ only)".

§3.3's 41 (round.md:1306-1313) keep use-transfers, party-sheet and journal-modal beside their units
(owners.tsv:503, 359, 330), and move give-controls to F/transfers/__tests__ (:397). §0.6.9 gives a
reason only for the GM routes.test.

**Fix:** a sentence in §3.3 or §0.6.9 for each choice, or move them as the maps say.

## Checks that passed (no finding)

- All 74 rule (a) files, all 63 complexity functions and all 430 directives are owned and carry an
  item or a stated "stays". The leftovers equal §1.7.2's list: 8 no-img-element, 4
  no-this-outside-of-class, 2 prefer-structured-clone, 1 jsx-key, 1 prefer-query-selector, 1
  prefer-code-point, 1 no-console, plus the two holds.
- Every exported type of a module that stays in src/utils or src/constants is on the 2b list. The
  exceptions are the three `*Refusal` types R1.3.12 un-exports.
- The four cycle groups each have an item for every closing edge; no server module imports a module
  the plan moves into a feature.
- Fact 8's 13 `onItsWay` sites all cite R1.9.2.
- Each of the 20 bugs is in §4.
- Every seam a map names has a home in R1.9.1-6, R1.9.20-25, §0.6 or §1.10.

## To the user

Nothing. Every finding above is the planner's to fix within the decisions (Q1-Q4) and CLAUDE.md. None
needs a new choice from the user.
