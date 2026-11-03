# C-a report: WS2 Goldens, C-a's share (C1 markup, C4 words, C7 storage, C8 dice draws)

Builder C-a, 2026-11-03 (UTC 05:30-08:45; EST 00:30-03:45). Worktree
`/home/user/w043/C-a/sending-stone-player`, branch `local/043-C-a`, made from APP's head dd3a2ad.
Nothing pushed. The kit (T's commit 2 files) is present only as untracked copies, never committed.

## Commits on local/043-C-a (on dd3a2ad)

| SHA | subject |
|---|---|
| b6a773c | `chore(refactor): e2e surface extended` |
| 70d81a6 | `test: characterization goldens for markup, words, storage and dice draws` (§2.5 commit 4) |

## Files changed

- `.refactor/analysis/T/e2e-surface.mjs` (b6a773c): §1.8.1's extension. It now also lists the
  reads that bypass a selector: `getAttribute` names, `dataset` keys (as `data-*`), class reads
  (`classList.contains/toggle/add/remove` and `.className`) and child structure (`children`,
  `first/lastElementChild`, `childElementCount`, `tagName`, `nodeName`), each with `suite:line`,
  and counts them per area. `e2e-surface.txt` regenerated; its earlier sections are unchanged
  (diffed). Some of these reads are of the Foundry stand-in's DOM or a chat card's
  (gmerr, manualdice, activities:828, cookbook's `#chat-log`); the list keeps every read so RV3
  can tell them apart.
- New, all under `src/__tests__/golden/` (owners.tsv rows 670, 673, 676, 677, 679) (70d81a6):
  - `markup.golden.test.tsx` (C1, 110 tests, 112 snapshots, snap 2.7 MB)
  - `words.golden.test.tsx` (C4, 104 tests, 104 snapshots, snap 540 KB)
  - `storage.golden.test.tsx` (C7, 21 tests, 21 snapshots)
  - `dice.golden.test.tsx` (C8, 29 tests, 29 snapshots)
  - `__snapshots__/{markup,words,storage,dice}.golden.test.tsx.snap`

## What each golden pins

- **C1 markup** (`markup()` of the whole body, portals included; ids and times by the kit):
  GameTable at a player's seat narrow on Character/Combat/Chat and wide, the GM's seat, a GM roll
  arriving as a toast and in the banner (via the real table poll), no campaign, no sheet, held back
  as too large with a party and the journal, its turn with 3 unread, not connected, offline,
  companions (one summoned, one asked), choose actor, a companion's seat; CharacterPane on
  fullerSheet per tab (7) with moves/removes/favorites/effects offered, the druid's Wild Shape row,
  the shaped ribbon and its Return popover; the item, feature, spell, attack, damage and save
  menus; Settings (narrow and wide, the layouts' `aria-pressed`), the dice entry (and a die out of
  range: `aria-invalid`), Modify damage, the target picker, Your rolls, Send to… and Remove…,
  roll toasts (on its way / made / refused; waiting for damage `data-waits`; fading
  `data-leaving`); **U1** the settle matrix G-U1b for favorite, prepare, effect, slot and Wild
  Shape, each "made, the sheet not agreeing" and "its state missing", the control's markup at
  settle − 1 ms and at settle; **U2** the Actions tab in list/table/columns with every chip kind
  (G4), the damage-on-its-own picker per step and the area picker (G1), four popovers open then
  Escape, and two open where Escape closes only the top (G5); **V1** each chat line kind at both
  seats (details opened), the combat tracker (none, not started, its turn, a companion's,
  another's, End Turn refused), LiveStatus 4 × 2 seats, FullscreenButton supported/unsupported,
  the turn toast `ended` → Undo `taking` and a companion's; **V2** the journal (empty, and with
  chapters on a note and a chapter), the party side panel; the campaigns page per campaign state
  (wrong secret, never connected, live, offline, roster to come) and the whole index, a page
  toast (`data-page-toast`), home (signed out/in), login, the character list (one, none), join.
- **C4 words**: `reasons('player'|'gm')`; `briefOf` over 25 roll shapes × 15 states × 2 seats;
  each shape's toast and tray row text and role/name list in every state at both seats; chat
  lines per kind at both seats; heading, subtitle and tab names per tab for 7 table states and the
  GM's seat; the turn panel and toast step by step for 10 End Turn scenarios (ended + Undo, Undo
  refused, each TURN_REFUSALS key, lost, a companion's, the GM's seat); turnRefusedLine per key,
  move words per verb × state × seat, things/names words, slot words, askTitle, noteTime at a
  fixed mid-day now (+ fullNoteTime through normalizeTimes), every note-words and order-words
  output; the save titles of G7 through the UI: description links' menus (saveTitle) and the
  prompt banner (titleOf).
- **C7 storage**: both storages' raw keys and values after each gesture: the settings at both
  seats (send-rolls, send-damage, roll-toasts, `:gm` keys), actions-layout and
  actions-closed:<id>, favorites-shown:<id>, alone-spend:player:<id>, wild-shape-form:<id> (once
  the sheet agrees), wild-shape-ended:<seat>, creature:<id> (sessionStorage); the rows written
  by `createRollRequest` over `prismaFake` for a typed check with an effect's die and kept
  rerolls, the GM's labelled check, a favorite, an effect, Wild Shape change and forms, a GM's
  labelled move, a removal, and the first refusal of three ladders; the hello's
  `campaign.update` data for a full 0.42 hello and a pre-0.10 one (via `applyCampaignEvent`).
- **C8 dice**: `useSheetRoller` per roll shape (d20 normal/adv/dis, extras, Elven Accuracy thrown,
  damage normal/two kinds/critical/one more die as d12/maximized/critical + more, healing, hit die
  min and with Con, hit dice at once, formula, recharge; typed: Bless + Bane kept rerolls, Bane
  skipped, Elven Accuracy's third on its own line (ELVEN_LINE as today), typed critical damage,
  typed hit dice) with the fixed LCG: `Math.random` calls, the dice asked for, what the roller
  hands on, and the rolls kept; and the raw bodies posted from the pane (save tapped, adv/dis from
  the menu, Elven Accuracy attack, an attack that hits / crits then its damage, a hit die).

## Checks

- Snapshots written once with `--ci=false` over these four files only (the first write, then
  only the snapshots of tests added or made deterministic before the commit: see deviations),
  then two full `--ci` runs over the four files: **264 tests green, 266 snapshots, added 0,
  unmatched 0, unchecked 0, both runs**. Every other jest run passed `--ci`.
- eslint over `src/__tests__/golden/`: clean (no errors, no warnings; no eslint-disable added).
- Mutation spot-checks (one per suite, each reverted from a backup, `git status` clean after):
  C1 a class in the roll menu's portal (`z-50` → `z-40`): 5 named tests red (a feature's / a
  spell's / an attack's roll menu …); C4 the reaction reason's word: `reasons(player)`,
  `reasons(gm)` red; C7 the creature key (`sending-stone:creature` → `…:creatures`): "the creature
  chosen at the table" red; C8 the d20's pool (count 1 → 2): the four d20 shapes red.
- e2e surface (the extended list) against C1's and C4's snapshots: every class read (14/14);
  every app id (`#character-pane`, `#sheet-panel`, `#turn-heading`, `#prompts-heading`,
  `#initiative-heading`, `creature-panel-<key>`, `creature-tab-<key>`,
  `creature-<key>-creature-name`, `creature-<key>-sheet-tab-actions` with this fixture's key);
  data attributes data-roll-toast, data-turn-toast, data-waits, data-leaving, data-gm,
  data-accent, data-side, data-kind, data-key, data-mode, data-state, data-campaign*, data-refusal,
  data-seats, data-page-toast, data-gm-roll; 32 of 35 getAttribute names. Not in them, and why:
  `#sending-stone-settings`, `#chat-log` and data-action/-actor-id/-campaign-state(-label)/
  -campaign-status/-filter-list/-manual-dice/-section/-tooltip, data-dc/-skill are the Foundry
  stand-in's or a dnd5e chat card's DOM, not the app's; `content`/`media`/`sizes` are the
  layout's meta and link tags (C5 pins metadata and viewport).
- L1 (`R/tools/l1.sh` in the worktree, kit copies present, untracked): see the last section.

## Deviations from round.md and why

1. **Snapshots written in more than one `--ci=false` run, before the commit.** A few tests were
   nondeterministic on the first write (jsdom tells `<details>`' toggle on a real-clock timer
   outside the fake one; a companion view and the clipboard settled at varying microtask
   depth). Their entries were removed from the uncommitted .snap, the tests made deterministic
   (the toggle dispatched at once, `advance()` instead of a bare act flush), and only those
   entries written again; every committed snapshot has since passed two `--ci` runs untouched.
   Nothing committed was ever updated.
2. **C7: notes create/change/order and cookbook dishes are not written here.** Their writes are
   recorded call by call (model, method, args in order) by C5's routes golden over the real db
   modules (C-b); doing it again here would be overlapping coverage (CLAUDE.md §8). C7 keeps
   the roll-request ladder, the hello's campaign row and every storage key.
3. **G7's fourth save title (db/table.ts `askedFor`, reached through `companionAsks`) is not in
   C4**: it is server code whose output reaches pages only through the table route's body, which
   C5 pins. C4 pins the other three: description links' `saveTitle` and the banner's `titleOf`
   through the UI (not by importing them from their .tsx files, which U2's S.9 moves), and
   `askTitle` directly.
4. **C1 is larger than "~45 snapshots"** (112): the maps' states (U1, U2, V1, V2) and the e2e
   surface's attributes needed their own states. C1 is retired in commit 26 anyway.
5. **Inline literal inputs** where src/mocks has no builder (TableMessage chat lines, LocalRoll
   shapes for briefOf, OwnedCampaign rows, TableRollState values): small literals inside the test
   files, no new fixture module (helpers stay out of `__tests__/`, which jest would run).
6. One `tsc --noEmit` run early on was made without the L1 locks (it found three type errors in
   the drafts, since fixed); every later jest/eslint/tsc run took the locks.

## Bugs logged

None. Nothing seen while writing the goldens was clearly a product bug (the GM seat's tray saying
"your game", End Turn's `not-undoable` reading "Try again in a moment", Elven Accuracy thrown
(not typed) as two d20s are pinned as today's behaviour without a claim either way).

## What later workstreams must know

- **Names the goldens import (they constrain moves; gate 10 lets only import lines and mock paths
  follow a move):**
  - components by name: `CharacterPane` (character-pane), `GameTable`, `ChatLog`, `CombatTracker`,
    `LiveStatus` (game-table/*), `FullscreenButton`, `RollToasts` (roll-toasts), `RollTray`,
    and the pages' default exports (`@/app/page`, `/login/page`, `/characters/page`,
    `/join/[code]/page`, `/campaigns/page`).
  - non-components: `briefOf`, `reasons` (roll-tray.tsx; R-b's R1.2.8 splits that file, so these
    two must be at their final path after 2b or stay importable where 2b put them: please add
    them to M's export-move list), `useSheetRoller` + its types (use-sheet-roller), `TableApiContext`
    (use-table-api), `ROLL_KINDS` (constants/sending-stone), `turnRefusedLine`, `TURN_REFUSALS`
    (end-turn), move-words, note-time, note-words, order-words, slot-words exports, `askTitle`,
    `toTableSheet` (utils/table-view), `createRollRequest` (db/roll-requests), `getGmSeat`,
    `playerSeat` (db/seats), `applyCampaignEvent` (db/campaign-events), `parseGameEvent`
    (schemas/sending-stone), `findInvite`, `listOwnedCampaigns` (db/campaigns), `listCharacters`
    (db/characters), `getCurrentUser`, `requireUser` (lib/session), and src/mocks fixtures.
  - The golden imports `saveTitle`/`titleOf` nowhere (they are read through the UI), so U2's S.9
    may move them freely.
- **Mocked surfaces C1 adds** (all already listed in §1.8.3 or third-party): `next/navigation`,
  `@/lib/session` (factory: getCurrentUser, requireUser — no requireActual: better-auth is ESM),
  `@/db/campaigns`, `@/db/characters`, `@/lib/app-origin`, `@/lib/campaign-secret`,
  `@/auth-providers` (each spread over `requireActual`), `@/app/campaigns/actions` and
  `@/app/characters/actions` (factories naming every export: next/cache can't load in jsdom),
  `@/clients/auth-client` (better-auth's ESM client). M's codemod must follow any of these that
  move; gate 4b's factory check holds for each.
- **Storage keys are read raw** (no key constant imported), so a key constant may move freely;
  its value may not.
- The goldens use the kit's `atFixedTime`, `advance`, `markup`, `normalizeIds`,
  `normalizeTimes`, `ordered`, `respond`, `responding`, `rollServer`, `sent` (jsdom) and
  `prismaFake`, `resetPrisma` (node) and `NO_DICE_RENDERER`; they rely on commit 2's kit as
  copied (hashes in handoff/kit-ready).
- The LCG (seed 43) and a numbered `crypto.randomUUID` are local to each golden that throws dice;
  React's act takes one `Math.random` the first time it runs in a file, so those files warm it in
  `beforeAll`. Each GameTable test in C1 uses a character id derived from its own test name,
  because the journal's and cookbook's stores are module-level and keyed by the character's API.
- C4's words file takes ~32 s and C1 ~12 s in a run; C1's snap is 2.7 MB.

## L1 (R/tools/l1.sh in the worktree at 70d81a6, kit copies untracked; 08:31-08:37 UTC)

Outdir `/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043/l1/C-a`.

```
check jest ok (294 suites, 8871 tests, 0 red, 0 flaky (green alone), 0 suites that did not run)
check typegen ok
check tsc ok (0 errors)
check eslint ok (675 files, 0 errors, 999 warnings)
gate 1 ok · gate 1b ok · gate 2 ok (8607 base tests) · gate 3 ok (294 suites, 8871 tests, 264 new)
gate 4 ok · gate 4b ok (726 imported names) · gate 5 ok · gate 6 ok · gate 7 ok
gate 8 FAIL (25 suites: no guardNoDb())
gate 9 ok (999 warnings = ratchet base 999: the goldens add none)
gate 10 ok (264 golden tests, 8 frozen files held) · gate 11 ok · gate 12 ok (4 groups = base)
```

Gate 8's 25 failures are the worktree's arrangement, not this commit: the node kit is present
here as T's untracked copy, so gate 8 applies, but the 25 route suites' `guardNoDb()` lines are
commit 2's (T's R3.4), which this branch is not yet on. On the branch rebased onto commits 2 and 3
gate 8 should pass; the orchestrator's landing L1 there is the one that counts.
