# Phase 4 items after integration (v0.43)

Written by the orchestrator's bookkeeper on 2026-11-03, around 8:15 PM EST, after all nine Phase 3 lanes landed on
`claude/dazzling-dirac-m8cq54` (round.md amendment 5). It lists every Phase 4 item that a lane or an
integrator reported, with duplicates merged. Each item names its builder:

- **F-a** (commit 21): R1.9.20, R1.9.24 and R1.9.25.
- **F-b** (commit 22): R1.9.22 and R1.9.23.
- **G** (commits 23 and 24): R1.9.26 to R1.9.30, plus anything new.

This follows round.md §2.2.5. Every file an F-a or F-b item edits has an owners.tsv row with phase 4
that names the builder, as `R1.9.xx(F-a)` or `R1.9.xx(F-b)`. G owns everything after F-a and F-b
(§2.2.5), so the rows name G only for the new files its items make, and for the two frozen files
whose import lines it may change.

How the sources are cited:

- **Lane phase4 lists:** "S b", "S fix" and so on are the `b` and `fix` phase4 lists in
  R/reports/phase3-*.json. W-b's and R-a's lists survive only in R/reports/W-b.md and R-a.md.
- **Integrators:** "int R-b" and so on are the integrators' results (amendment 5), and
  R/reports/integrate-R-a.json.
- **Review findings** are cited by id (S-4, RB-3, U1-m5 …).
- **Line numbers** are at the integrated head (ac01b2c) unless noted otherwise. Find import lines
  by name, not by number.

State at the integrated head:

- **eslint:** 114 warnings, 0 errors. By rule: 46 no-restricted-syntax, 25 react-hooks/rules-of-hooks
  (all in tests), 22 react-hooks/refs, 12 import/no-restricted-paths, 5 react-hooks/set-state-in-effect,
  3 react-hooks/globals (tests) and 1 react-hooks/exhaustive-deps.
- **Cycles:** gate 12 finds 0 cycle groups.
- **Disables:** the tree has 7 line-level react-hooks disables, each with a reason. That is the whole
  ≤ 7 budget of §1.7.3, so any react-hooks finding left now has to be fixed, not disabled.

## F-a (commit 21)

**FA-1. R1.9.20: usePopover at the other five popovers.**

- **Files:**
  - src/features/rolling/components/roll-menu/choice-menu.tsx (ChoiceMenu; the roll-menu site of
    base roll-menu.tsx:160-198 is here now, and its `const { setFloating } = refs` line came from
    R1.2.12b)
  - src/features/rolling/components/rolls-button/rolls-button.tsx (its `const { setReference } = refs`
    line)
  - src/features/sheet/components/wild-shape/return-popover.tsx (ReturnPopover, base
    wild-shape.tsx:765-778)
  - src/features/sheet/components/sheet-settings/sheet-settings.tsx
  - src/features/notes/components/move-menu/move-menu.tsx (V2 changed only its icon-button class line)
- **What:**
  - Adopt `usePopover({ open, onOpenChange, anchor?, placement, gap?, across?, fit?, escape? })` from
    src/hooks/use-popover.ts. `fit` is floating-ui's size options and goes after shift.
  - The hook returns `{ setReference, setFloating, setPositionReference, floatingStyles, context,
    root }`, and each adopter writes `ref={setFloating}`.
  - The hook has no `point?` option, although R1.1.16 drafted one. A point-placed menu, such as
    choice-menu, keeps its own layout effect calling
    `setPositionReference(point ? pointOn(anchor, point) : anchor)`, because src/hooks may not
    import FR's menu-points.
  - rolls-button passes `escape: false`, which keeps its Escape quirk. useTopmostEscape(false) is a
    no-op effect.
- **Why:** R1.9.20. The floating-ui `react-hooks/refs` findings go away: 4 in move-menu.tsx, and 1
  each in sheet-settings.tsx and return-popover.tsx (U1's 2). So do the `const { … } = refs` lines
  that R1.2.12b added in choice-menu and rolls-button.
- **From:** U2 b 4, U2 fix 4, R-b b 2, R-b fix 2 (item 3), V2 b 3, V2 fix 3, int R-b, int U2.

**FA-2. R1.9.24: rollOf at the description link.**

- **File:** src/features/sheet/components/description-link/utils.ts, the function `rollAgainst`
  (base description-link.tsx:1108). U2 moved it there; save-button.tsx and the link menus call it.
- **What:** adopt `rollOf` from src/features/rolling/utils/sheet-rolls.ts:
  `rollOf(target, chosen ?? toAdvantage(target.mode), chosen !== undefined, { dc, ask: target.ask })`.
  R-b says this builds the same keys in the same order. C2 pins the request.
- **Why:** R1.9.24.
- **From:** U2 b 5, U2 fix 5, R-b b 2, R-b fix 2, int R-b, int U2.

**FA-3. R1.9.25: favorites on ActionChips, UsesChips and RowName, where the markup is equal.**

- **File:** src/features/sheet/components/favorites/favorite-row.tsx.
  - FavoriteRow comes from U1's R1.1.7 split of favorites.tsx, which is now the shell for the
    strip, column and list. Row 188 (favorites.tsx) keeps its F-a grant.
  - FavoriteRow renders ActionEntry, SpellEntry, ItemEntry and FeatureEntry, which U2's chip
    cluster already draws. It also renders its own SlotsEntry, ClassEntry and CheckEntry, which use
    ModeChip and UsesButton.
- **What:** use the cluster where the markup is byte-equal, and list the rest in `later`.
  - `ActionChips` (action-chips/action-chips.tsx):
    `{ action, view, rows, uses?, damage?: 'inline' | 'none' }`.
  - `UsesChips` (action-chips/uses-chips.tsx), as it is after bba5753:
    `{ name, uses, rows, spends?, place: 'row' | 'cell', fold? }`. Favorites passes `place='row'`
    and `fold={false}` where the base ChipUses had `always`. A row always draws the `data-uses`
    span, which §1.8.1 and the e2e read.
  - `RowName` (row-name/row-name.tsx): `{ name, favorite, busy?, detail?, children }`.
- **Why:** R1.9.25. C1 pins the markup.
- **From:** U2 b 6, U2 fix 6, int U2, U2-4.

## F-b (commit 22)

**FB-1. R1.9.22: seenQuery in the table poll.**

- **File:** src/features/table/utils/table-query.ts.
  - V1 (R1.5.10) made the poll's query a pure `tableQuery(seen)` with `seenOf` there.
  - src/features/table/hooks/use-table-view.ts only calls it, and keeps its F-b grant, row 505.
- **What:** build the query with `seenQuery` from src/utils/seen-query.ts. Map the fields in the
  table's order, which is the wire: version, live, rolls, gm, gmrolls: gmRolls, moves, typed,
  removes, favorites, effects, wildshape: wildShape, sheet: sheetVersion. That mapping is V2's.
- **Why:** R1.9.22. use-table-view.test pins the URLs byte for byte, and so does C2.
- **From:** V1 b 2, V1 fix 1, V2 b 7, V2 fix 9, V1-RV-2, int V1, int V2.

**FB-2. R1.9.23: seat URLs and the header button.**

- **Files:**
  - src/features/table/utils/party-urls.ts: `partyApi` and `partyPage`, the encoded party URLs of
    base game-table.tsx:1017-1030.
  - src/features/table/components/table-party-panel/table-party-panel.tsx, which calls them. It
    changes only if their signatures do.
  - src/features/table/components/table-header/table-header.tsx: the back link's class, base
    game-table.tsx:823.
- **What:**
  - Write the party URLs with seat-urls' `gmPartyApi`, `partyApi`, `gmPartyPath` and `partyPath`
    from src/utils/seat-urls.ts.
  - Compose HEADER_ICON_BUTTON from src/constants/buttons.ts in the back link as
    `` `-ml-1.5 shrink-0 ${HEADER_ICON_BUTTON}` ``, so the class string stays byte-equal.
  - table-header's `/campaigns?campaign=…` link is a query, not a seat path, and seat-urls has no
    function for it, so it stays.
  - game-table.tsx (row 295) keeps its F-b grant, but no R1.9.23 site is left in it.
- **Why:** R1.9.23. C1 and C2 pin the result.
- **From:** V1 b 3, V1 fix 1, V2 b 7, V2 fix 9, V1-RV-2, int V1, int V2.

## G (commit 23 unless noted; R1.9.26 unless noted)

Items that move names other lanes import. Phase 3 could not move these, under §2.2.2.

**G-1. useToastSetting and useToastTop to their own files.**

- **Files:**
  - From: src/features/rolling/hooks/use-roll-toasts.ts.
  - To: src/features/rolling/hooks/use-toast-setting.ts and use-toast-top.ts, which are owners.tsv
    rows for G.
  - Importers, found by name: src/features/sheet/components/character-pane/character-pane.tsx:39,
    src/features/table/components/turn-toast/turn-toast.tsx:9, and the multi-line import in
    src/features/rolling/components/roll-toasts/roll-toasts.tsx.
- **What:** move the two hooks and retarget their import lines. No jest.mock names use-roll-toasts.
- **Why:** R1.2.9 gives each hook its own file. Their home is FR/hooks/ rather than row 717's
  components/roll-toasts/, because the sheet and the table import them (RB-3).
- **From:** R-b b 0, R-b fix 0, R-b.md item 1, int R-b, RB-3.

**G-2. gmRollsOf to FR/utils/gm-rolls.ts.**

- **Files:**
  - From: src/features/rolling/hooks/use-gm-rolls.ts.
  - To: src/features/rolling/utils/gm-rolls.ts, beside namesOf and heardOf.
  - Import lines only: roll-toasts.test.tsx:13, roll-tray.test.tsx:10 and
    use-table-rolls.test.tsx:22.
- **Why:** R1.2.5's remainder. R-b's tests import the name.
- **From:** R-a.md item 1, int R-a, RA-4 (a).

**G-3. useFavorites to its own file.**

- **Files:**
  - From: src/features/sheet/components/favoriting/favoriting.tsx.
  - To: favoriting/use-favorites.ts, an owners.tsv row for G.
  - The frozen kit src/mocks/sheet-providers/sheet-providers.tsx imports it at :17, inside the
    import of lines 15-18. That import line follows, which gate 10 allows. Row 670 has phase 4.
- **What:** move the hook. Leave no re-export behind (gate 7).
- **Why:** CLAUDE.md rule (a) and R1.1.6. favoriting.tsx is U1's last file that exports more than
  one thing.
- **From:** U1 b 0, U1 fix 0, int U1, U1-m5.

**G-4. SpellSlotPool to FS/utils/types.ts.**

- **Files:**
  - From: src/features/sheet/utils/slot-words.ts:11.
  - To: src/features/sheet/utils/types.ts.
  - Retarget: src/features/sheet/components/charging/types.ts (U1's),
    spell-slots/{spell-slots.tsx, utils.ts, types.ts, spell-slots.test.tsx},
    FS/utils/slot-words.test.ts, and slot-words.ts itself (`import type … from './types'`). Use
    `@/features/sheet/utils/…` specifiers.
- **Why:** rule (b) and R1.1.17. A re-export would be a shim (gate 7).
- **From:** U2 b 0, U2 fix 0, int U2, U2-2.

**G-5. Named types to FR/types.ts.**

- **Files:**
  - Move RollBrief and Creature from src/features/rolling/utils/tray-words.ts (:27, :502), and
    RollToast and ToastBook from FR/utils/roll-toasts.ts (:63, :66), into
    src/features/rolling/types.ts.
  - Retarget brief.ts, gm-words.ts, tray-words.ts and roll-toasts.ts (FR/utils);
    roll-tray/constants.ts and status-line.tsx; roll-toasts/badge.tsx and toast.tsx;
    hooks/use-roll-toasts.ts; and the import lines of roll-tray.test.tsx and
    utils/roll-toasts.test.ts.
- **What:**
  - Name `ToastDraft = ToastBook & { popped: Set<RollToast> }` in place of the four
    `ReturnType<typeof draftOf>` in pop, meet, meetNew and capped.
  - Name `WayWords = { doing: string; done: string; not: string }` for wayWords' `words` parameter
    and commandWords' return.
- **Why:** rule (b). These are the last 4 warnings in R-b's files.
- **From:** R-b b 1, R-b fix 1, int R-b, RB-5.

**G-6. TOAST_FOR.**

- **Files:** src/features/campaigns/components/page-toast/page-toast.tsx, to
  src/features/campaigns/constants.ts. src/__tests__/golden/values.golden.test.ts:143 imports it, and
  that import line follows (gate 10). Row 682 has phase 4.
- **What:** move TOAST_FOR now, or leave it until commit 26 retires C9. G decides.
- **Why:** page-toast.tsx's last 2 rule (a) findings (R1.5.18).
- **From:** V2 b 1, V2 fix 1, int V2, V2-5.

**G-7. ChoiceProblem.**

- **Files:** src/db/characters.ts:54, to src/db/types.ts. Retarget the import line in
  src/app/characters/actions.ts, whose row has phases `-`.
- **Why:** rule (b).
- **From:** S b 0, S fix 1, S.md item 2.

Decisions G makes before commit 23 turns the rules into errors:

**G-8. SocialProviderId** (src/auth-providers.ts:19).

- **The constraint:** it stays where it is under amendment 1 (a), and there is no
  src/types/auth.ts. It is derived (`keyof ReturnType<typeof socialProviders>`), so moving it to a
  types.ts would form a type-only cycle.
- **G picks one:**
  - a narrow written exception: a line disable whose reason names the cycle; or
  - a home: a literal union in src/types, with the object checked against it.
- **From:** S b 1, S fix 0, S.md item 1, S-3.

**G-9. CampaignStatus and LastHeard**
(src/features/campaigns/components/campaign-status/campaign-status.tsx:42).

- **The constraint:** both are Server Components in the server graph, reached through
  CampaignCard. A file for either would be a new component module there, which gate 11 refuses.
- **G picks one:**
  - The orchestrator gives gate 11 an allowance in R/tools for a component split out of a base
    server-graph module. Then G splits LastHeard into last-heard.tsx (a conditional owners.tsv row
    exists).
  - Or G lists the one-export finding as an exception in the PR.
- **From:** V2 b 2, V2 fix 2, int V2, V2-6.

**G-10. creature-switcher.test.tsx's directives**
(src/features/companions/components/creature-switcher/creature-switcher.test.tsx).

- **Now:** since f4b17f1 there is no whole-file disable. The file has one
  `no-this-outside-of-class` disable/enable range, with its reason, around the five layout mocks,
  and one next-line directive for the focus mock: 2 in all.
- **Why line-level is costly:** `this` is read on 9 lines in 6 mocks, so line-level throughout
  would take 9 directives.
- **G picks one:** keep the range, as the base's companions test has it, or list it as an
  exception. Row 255 records 2.
- **From:** V2 b 4, V2 fix 4, int V2, V2-4.

**G-11. The react-hooks findings left (commit 23).**

- **V2's 12, all present at base:**
  - set-state-in-effect: notes' journal-modal.tsx:110, hooks/use-journal-layout.ts:42,
    use-focus-to.ts:76, use-ordering.ts:12 and use-keyboard-inset.ts:27
  - refs ×2: use-reader-pick.ts:26
  - exhaustive-deps: use-draft-focus.ts:74
  - refs ×4: move-menu.tsx, which FA-1 removes
- **U1's 2:** refs in sheet-settings.tsx and return-popover.tsx, which FA-1 removes.
- **The budget is full.** The 7 line-level disables already in the tree are V1's 4
  (use-turn-toast-card.ts, use-typed-dice.ts, src/hooks/use-waiting-prompts.ts, use-hold.ts),
  R-b's 1 (use-roll-toasts.ts) and U1's 2 (use-return-confirm.ts, wild-shape-ended.tsx). So each
  remaining finding needs a fix that does not change timing.
- **The test-only findings** (rules-of-hooks, refs, globals) go with §0.6.6's test overrides
  (G-14).
- **From:** V2 b 5, V2 fix 5, V1 b 4, int V1, U1 fix report.

**G-12. useFollow.**

- **Files:** src/hooks/use-follow.ts (:20-37) and src/features/rolling/hooks/use-table-rolls.ts:
  startEach :147-198, readWildShapeForms :539-560, and the `running` set at :104.
- **G picks one:**
  - useFollow returns the follow promise and takes an external signal. use-table-rolls' startEach
    and readWildShapeForms adopt it, and the hook's own `running` set goes.
  - Or G records a decision not to do this.
- **Why:** until then, useTableRolls aborts two controller sets on unmount (R1.2.2's remainder).
- **From:** R-a.md item 2, int R-a, RA-4 (b).

**G-13. due** (src/db/commands.ts:221). Optional; G decides (S-4).

- **What:** move `due` to src/utils/throttle.ts (a conditional owners.tsv row exists) and retarget
  db/roll-requests.ts and db/cookbook.ts. Or accept it where it is.
- **Why:** it is a general throttle, not command logic.
- **From:** S fix 2, S.md item 3, S-4.

Config, directives and small moves:

**G-14. eslint.config.mjs.**

- **What:** the `files:` list that turns react-hooks off for roll-requests.test's pieces now names
  src/utils/requests/checks.test.ts and src/utils/requests/check-damage.test.ts.
  src/utils/roll-requests.test.ts carries no finding any more.
- **Why:** §0.6.6. R1.4.6's split moved the findings.
- **From:** W-b.md item 1.

**G-15. use-popover.ts's two directives.**

- **What:** remove the two line-level `import/no-restricted-paths` disables in
  src/hooks/use-popover.ts (:10, :12, on the usePortalRoot and useTopmostEscape imports) together
  with zone 5 (§1.7.4). They become unused then. Row 777 records 2.
- **From:** U2 b 3, U2 fix 3, int U2.

**G-16. entry-icon.tsx's reason.**

- **What:** in src/components/entry-icon/entry-icon.tsx:29, put the no-img-element reason on its
  directive with `-- reason`, as portrait.tsx and conditions.tsx have it.
- **Why:** R1.1.17's third reason. The row gave the file no Phase 3.
- **From:** U2 b 1, U2 fix 1, int U2.

**G-17. COOKBOOK_MOST_DELAY.**

- **What:** add `COOKBOOK_MOST_DELAY = 120_000` beside COOKBOOK_POLL_EVERY in
  src/constants/cookbook.ts. src/features/cookbook/hooks/use-cookbook-view.ts reads it in place of
  its file-private `MOST_DELAY` (:15).
- **Why:** R1.5.13. The constants file is W-a's.
- **From:** V2 b 0, V2 fix 0, int V2, V2-7.

**G-18. HIT_DIE's test beside its unit.**

- **What:** move `describe('HIT_DIE', …)` (src/utils/dice.test.ts:29-34) and its HIT_DIE import
  (:5) unchanged into src/constants/sending-stone.test.ts, an owners.tsv row for G.
- **Why:** CLAUDE.md §8 colocation. Both files are new since 24f808b, so gates 1, 1b and 3 are
  unaffected.
- **From:** W-a fix 0, W-a.md §0.5 item 1, W-a-2.

**G-19. EFFECT_DICE_KINDS** (src/constants/sending-stone.ts:214).

- **Now:** no product code imports it since 410051c. Only C9 reads it.
- **What:** delete it with C9's retirement in commit 26, or G decides otherwise.
- **From:** W-a fix 1, W-a.md §0.5 item 2.

**G-20. R1.9.27 (dead code).**

- **Nothing left from V1:** its list (countsAsUnread, sheetSummary, actingOf, sameTurn, shownTurn,
  edgeOf) is already file-private since c2ca691.
- **Nothing left from S:** inRoster is already file-private (S-5).
- **The sweep runs as planned** over the rest.
- **From:** V1 b 1, V1 fix 2, int V1.

**G-21. ROADMAP (commit 24, §4.5).**

- **B6** (the HP bar's rounded zero) is now in src/features/table/utils/combat.ts `hpBar`, which
  hit-points.tsx draws.
- **B7** stays in src/components/local-time/local-time.tsx.
- **§0.8 item 8's EVENT_HANDLERS** is true as written: S-2 made `apply`'s switch the table in
  src/db/campaign-events.ts.
- **From:** V1 b 5, int V1, S fix report (S-2).

**G-22. Zero cycle groups (commit 23 and R1.9.28).**

- **Now:** gate 12 already finds 0 cycle groups at the integrated head.
- **History:** W-a's R1.4.9b (amendment 1 (c)) was done in the lane by 410051c without moving a
  name, so src/types/base.ts was not made. V2's move-dialog ↔ recipient-list pair ended with
  R1.5.19.
- **What:** commit 23's check and the import-cycle test start from 0.
- **From:** W-a fix report, int V2.

Optional (G decides; each is fine to leave, with the reason recorded):

**G-23. Part and FormulaGroup.** These are file-private types in src/utils/damage-modifiers.ts (:39,
:231). Move them to src/types/roll.ts only if every named type should sit in a types.ts. FR/types.ts
would break zone 4. (R-a.md item 3, int R-a, RA-3.)

**G-24. src/utils/roll-requests.ts emptied** (WB-2).

- **What:**
  - Move isSeatCombatant, sheetUses and checkDamageDice into src/utils/requests/, with
    checkDamageDice beside check-damage.ts.
  - Retarget check-damage.ts and checks.ts.
  - Delete roll-requests.ts and its 2-test remainder, roll-requests.test.ts.
  - Point moves.d/W-b.tsv's rows for those 2 tests at their new files. moves.d is planning, so the
    orchestrator edits it with G's commit.
  - Any new file needs an owners.tsv row.
- **From:** W-b.md item 2.

**G-25. COMPANION_UNTAKEN from the kind table.** Do it only through `kindsWhere(…)` in
src/constants/roll-kinds.ts; deriving it in place closes a constants cycle. Do it only after commit
26, because C9 pins its literal order. Low value, since roll-kinds.test.ts already holds it equal
to the table. (W-a b 1, W-a fix 2.)

**G-26. One home for the favorite target and ask types.**

- **What:** move FavoriteTarget, TableAsk, TableSaveAsk and TableCheckAsk into
  src/types/sending-stone.ts and retarget about 20 import lines in U1, U2, S, W-b and V1 files,
  plus the words golden's import line.
- **Why:** it would remove the derived alias and repeated literals that 410051c added. It is no
  longer needed for zero cycles.
- **From:** W-a fix 3, W-a.md §0.5 item 4.

**G-27. getPlayerSeat.** Other lanes' server pages that look up a player's own Character seat could
call `getPlayerSeat` (new in src/db/seats.ts, beside getGmSeat). (S b 3.)

**G-28. Two small type merges** (V1 fix 3 and 4).

- WaitingCompanion (FT/types.ts) has the same shape as V2's CompanionAskRow
  (F/companions/types.ts). That makes it a two-copy merge, so it is noted only (§1.10).
- useCookbookEntry could declare a named return type, of which CookbookEntry (FT/types.ts) is the
  subset the table reads.

**G-29. useChoices' slot choices.** In src/features/sheet/components/use-picker/use-choices.ts,
group pools, levels, slot, setSlot, spends and enchantsAt. U2's fix round left this for Phase 5.
(U2-5.)

**G-30. Fewer props for TableNav and AsideColumn.** Pass one tab-controls object, and give
CreatureSheets fewer props. The builder declined, because onShow, combatTab and hold differ between
the two. (V1-RV-5.)

## For the PR text (Phase 6; not a code edit)

**P-1. Lane SHAs to branch SHAs.** The lane reports cite their pre-rebase SHAs, and each report
commit's message maps them:

| Lane | Lane SHAs | Branch SHAs |
|---|---|---|
| W-a | 52851b2, c7e36bf, b6245a7 | a3b222f, 2365911, 410051c |
| W-b | 22dfe58, 1c11a9c, 506ce72 | 38a17b5, 5ec922f, f1bde09 |
| S | f5e4021, b5ebef2, eb1618b, f1ab7d2 | d264d9a, e88b05a, f7d3890, 8088279 |
| R-a | 896cf1e, e95fdf3 | e173ffc, 71cef6c |
| R-b | be4a367, f338ea5 | ef3507a, ac31d37 |
| U1 | 98665eb, f3c0010, 1649abf | 4114094, aae075d, c9b5be3 |
| U2 | f2c42a1, 41a5b45 | 64172b6, bba5753 |
| V1 | 265955a, 06660ec | 61de31a, c2ca691 |
| V2 | f6697e6, f45e99b | 983b4b4, f4b17f1 |

**P-2. The commit table.** Each lane's fix commit sits beside its commit. aae075d (U1's type-only
follow-up) sits beside commit 17, and 5ec922f (W-b's moves.d record) beside commit 14.

**P-3. Process notes.**

- **R-a:** commit 15 (e173ffc) says nine log* functions share one `keep`. At that commit only 8
  did; 71cef6c makes it 9. Complexity over the tree after commit 15 was 53, not 54.
- **V1:** ran 2 L1s for 10 items, because of lock contention (V1-RV-7).
- **V2:** R1.5.14-.23 had no per-item L1s (V2-8). Every commit-level L1 and build was green.
- **S:** one tsc ran without the locks. It passed.
- **W-a:** one body line of 410051c's message runs past 100 columns.

**P-4. Stale report text.**

- R/reports/V1.md's last section calls fix round 1 incomplete. It landed as c2ca691, and its L1 is
  X/l1/V1/fix1-orch.
- The U2 report covers commit 18 only. Its fix round (bba5753) is recorded in phase3-U1-U2.json,
  whose `fix` entry says ok=false because it was written before the orchestrator finished the
  round. Its L1 is X/l1/U2/fix1-orch, all green.
- R-b's report swapped two similarity scores: damage-menu.tsx → modify-damage.tsx is R088, and
  use-dice-entry .tsx → .ts is R077.

**P-5. Deviations to list.**

- **Commit 16:** toneOf sits in tray-words.ts (brief.ts would form a cycle), and reachOf holds
  RollHistory's notSent branch (RB-6).
- **Commit 17:**
  - U1's rollActions and linkActions are plain builders, where R1.1.3 named hooks (U1-m2,
    CLAUDE.md §3).
  - The pane is 422 lines against R1.1.4's estimate of about 200 (U1-m3). The binding complexity
    targets are met.
  - blockedReason follows amendment 5.
- **Commit 11:** notePresent sits in src/lib/routes/seat-routes.ts, not http.ts (S-1).

## Done in the bookkeeping commit (for the record)

- **owners.tsv after integration:**
  - rows for every new file a lane made: RB-2, U2-1, V1-RV-1, V2-2, U1's FS/hooks/types.ts, and
    W-b's checks.test.ts directive
  - the Phase 3 renames (.tsx → .ts bridges, modify-damage.tsx, use-dialog-root.ts) and the
    Phase 3 splits as `(deleted in 3: …)`
  - rows 792 and 800 corrected, and src/types/base.ts marked `not made`
  - phase 3 added on logo.tsx and confirm-modal.tsx (V2-1)
  - the disables column matched to the tree
  - the F-a and F-b sites above (V1-RV-2)
  - G's new files
  - S-1's note
- **The check:** `AFTER=3 node .refactor/analysis/owners-check/check.mjs` is clean.
- **U1-m1** is decided in amendment 5.
