# RV3: Phase 5 review of the table, the other UI, tests and guards

Reviewer RV3 (round.md §2.4, Phase 5). I worked independently of the builders and edited nothing in APP. Review date: 2026-11-04, about 06:30-07:30 UTC. The review is of APP at 6e92666 on claude/dazzling-dirac-m8cq54; its src is commit 24's tree plus 153834e.

**Scope:**
- Commits 2-8, with their fixes:
  - 4e7b8ec (the kit and C9)
  - eb533bd (C2, C3, C5, C6)
  - 929c797 (C1, C4, C7, C8)
  - f7eb1a5 (moves)
  - fd2c34d and 51e82f8 (no-null off)
  - 3255abf (export moves)
  - 63c5cc3 (seams), with 9c694f1, 064a76b and 299d979
- Commit 19 (61de31a), with its fix c2ca691.
- Commit 20 (983b4b4), with its fix f4b17f1.
- Commit 23 (00709e2), with its fix 153834e and the tools 938efea, 6b8aff8 and f7e3d6b.
- Commit 24 (a8377ca), with 00d330c.
- In the tree:
  - FT, notes, party, companions, campaigns, characters, transfers and cookbook
  - src/components, and src/app's pages and layouts
  - src/__tests__, eslint.config.mjs and ROADMAP.md

## Verdict

**Behaviour is preserved in everything I read.** I found no blocker, and I found no bug that the refactor introduced. There is one major finding: frozen test infrastructure that nothing imports (CLAUDE.md §9; R1.9.27 not fully met). There are five minor findings.

## Checks run (all read-only, under the locks the task names)

**Goldens and the area's suites:**
- Command: `flock l1-wait true && flock -s checks npx jest --ci src/__tests__ src/features/{table,notes,party,companions,campaigns,characters,transfers,cookbook} src/components src/app src/hooks src/utils --maxWorkers=2`
- Result: 212 suites and 4,765 tests, all passed.
- Snapshots: 1,001 matched, with 0 added, updated, unchecked or unmatched.
- The goldens alone: 991 tests, all passed. By suite: words 104, routes 141, markup 110, refusals 243, wire 55, storage 21, dice 29, composition 7, values 281.
- Output: X/RV3/jest-area.json and X/RV3/jest-area.log.

**Other checks:**
- `npx eslint .`, run under `flock l1-wait flock checks`: exit 0 and no output (X/RV3/eslint.log).
- `git diff --stat 929c797 HEAD` over the goldens, their snapshots, the kit and the sheet-providers mock shows only import lines and removed eslint directives. That fits gate 10's allowance.
- G's sweep `node .refactor/tools/g/unused-exports.mjs APP` at the head finds no unused exports.
- My orphan-module scan (X/RV3/orphans.cjs) uses TS module resolution over every import, `import()`, `jest.mock`, `requireActual` and `require`. It finds exactly one module in src that nothing imports: src/mocks/sheet-providers/sheet-providers.tsx (RV3-1).
- No relative import leaves its feature or its top folder (amendment 4 (c)). The only hits are files directly in src, and the frozen node kit's import of `../../jest.setup`.
- No barrels. Every path that an eslint per-file override names exists. All 35 zone probes in R/tools/g/zone-probes.txt pass.

## The riskiest diffs, read closely

**GameTable (commit 19):**
- I diffed the base GameTable (61de31a^, 1,500 lines) hook by hook against useTableTabs, usePartyOpen, useChatRead, useTypedDice, useTurnEnding (with useRefusal and useTurnHold), useCompanionRow (with useRow and usePanes) and useChatScroll.
- The order of hooks and effects is the same:
  - markChatRead's effect
  - the dice effect
  - useEndTurn and useTurnUndo
  - the `ending.sent` effect
  - useHold
  - useWaitingPrompts and useWaitingCompanions
  - useCreatureChoice
  - the chat's layout effect
  - useCookbookEntry
- useMediaQuery moved ahead of the party state, but no effect lies between them.
- The render-time setStates (lastParty, wasSideBySide/tab, seenUpTo, refused, companions/lost, mounted/paneMarks) move verbatim.
- The bottom bar still clears the refusal after `quiet()`, and the column still does not (§4.3 Q3 is kept).
- `seatOf`, `cookbookPlace`, `sheetPane`, `partyApi` and `partyPage`, header.ts and combat.ts each equal the base text.
- `OwnSheet` adds a fiber level but changes no mount boundary.

**TurnToast:**
- useTurnToastCard and useToastFoot keep the base order of state, refs, effects and layout effects.
- `nextCard`'s holdStep, wayStep and undoStep reproduce the effect's branches, including `told` and `covered`.
- The settle effect's new dep `settlingTurn` is `sent.turn`, which is `given` for one End Turn (use-end-turn.ts `setSent({ turn: given, way })`), so the effect runs as often as before.
- UndoButton's focus hand-off is the same code.

**End Turn hooks:**
- `useFollow` sits where the controllers' unmount effect was, and keeps the aborted guard.
- The bodies `{ kind, turn|undo, turn, ...NO_DICE }` keep their key order.
- `nextFollowed` equals the base's inline branches.
- use-hold's `useEffectEvent` reads only refs and stable setters, as the `[]` closure did.

**Chat:** the `BODIES[kind]` lookup cannot miss, since `kind` is always 'text', 'roll' or 'card' (utils/table-view.ts:141-143). TextBody returns nothing for an ask, as the base did.

**Journal (commit 20):**
- Journal's effects keep the base order:
  - live
  - the open-focus layout effect
  - the measure layout effect
  - narrow, then the short layout effect
  - said
  - focusTo
  - drawn
  - keep
  - ordering
- This holds although the states now sit inside the hooks.
- `hitsOf`, `afterDelete`, `lockedBy`, `draftNoteOf`, `inputOf` and `changeOf` keep the base logic. The bodies keep today's key order.

**Polls:**
- seenQuery is adopted by use-notes, use-party-sheet, use-companion-view, the cookbook store and the table's tableQuery. Every field it now leaves out when undefined is a required `version: number` or `live: boolean` in its view type, so no query string changes.
- retryDelay equals the base formula.

**Transfers:** use-transfers' body keeps the order kind, transfer, mode, explicit, extras, dice. The party page's takeFrom keeps kind, mode, explicit, extras, dice, transfer.

**Seat URLs:** characterPath, partyPath and partyApi encode as the base did.

**Campaigns:**
- The five 'use client' control files, use-toast.ts and use-campaign-choice.ts (createContext with no directive) are imported only by 'use client' files.
- CampaignCard and LastHeard stay Server Components.

**useSwitcherLayout:** the three stable useCallbacks read only refs and setters, so the effects run as often as before.

**use-draft-focus (commit 23):** reading from its mount ref gives the values its `[]` closure captured.

**Commit 23's product diffs:**
- They change only import lines, `export` keywords and directives.
- `auth-providers`' `satisfies` change is type-only.
- `ChoiceProblem` moved to db/types.
- Neither 'use server' module changes its names (gate 6).

**Test files:**
- Commits 19, 20 and 23 change test files only in import lines and removed directives. note-editor.test.tsx has one line that prettier re-joined after its directive went.
- The HIT_DIE describe moved from dice.test.ts (new in 299d979) to a new constants/sending-stone.test.ts.

**ROADMAP (commit 24):** it is §4.5's text, plus G's three documented additions (G.md, deviation 5).

## Findings

| id | sev | area | what |
|---|---|---|---|
| RV3-1 | major | table-ui | src/mocks/sheet-providers/ (409 lines) is imported by nothing: dead, frozen test code |
| RV3-2 | minor | table-ui | four pure helpers left in V1/V2 component files |
| RV3-3 | minor | table-ui | two different exports named `partyApi` (seat-urls vs FT/utils/party-urls) |
| RV3-4 | minor | table-ui | eslint.config.mjs's `.refactor/**` ignore outlives commit 28 |
| RV3-5 | minor | table-ui | import-cycles.test.ts finds src from `process.cwd()` |
| RV3-6 | minor | table-ui | C1 does not cover CreatureSwitcher's avatars mode, though §3.2 names it |

### RV3-1 (major): SheetProviders is dead code, and frozen

**What:**
- R3.5 (T, commit 2) made src/mocks/sheet-providers/sheet-providers.tsx (349 lines) and types.ts (60 lines) "for goldens only".
- No golden, test or module imports them, at commit 4 or at the head.
- They are frozen by gate 10, and they bound Phase 3: §2.2.6 and T.md:74-79 made every lane keep the signatures of the hooks SheetProviders composes.
- Their types.ts redeclares `PaneTable` and `PaneRoller`, which src/features/sheet/components/character-pane/types.ts:32-35 also declares.
- G's R1.9.27 sweep skips frozen files (R/tools/g/unused-exports.mjs, G.md: "It skips … the frozen files and tests"), so the module survived commit 23.
- This conflicts with CLAUDE.md §9 (unused code) and §1 (KISS, no speculative extensibility), and with R1.9.27 (dead code).

**Evidence:**
- `grep -rn "SheetProviders\|sheet-providers" src jest.setup.ts | grep -v ^src/mocks/sheet-providers/` returns nothing.
- `git grep sheet-providers eb533bd -- src/__tests__` and `git grep sheet-providers 929c797 -- src/__tests__` return nothing.
- X/RV3/orphans.cjs lists only `src/mocks/sheet-providers/sheet-providers.tsx`.
- T.md:57-79 describes it and the constraint it set on the lanes.

**Fix:**
- Delete src/mocks/sheet-providers/sheet-providers.tsx and types.ts. Removing them changes no test count.
- Do it in commit 26 beside the C1, C3 and C9 retirement, with gate 10's one allowed deletion extended to these two files. Alternatively do it in commit 25, with an orchestrator gate10.allow entry.
- Mark the two owners.tsv rows deleted, and name the deletion in the PR.

**Note for commit 26:** once C1 retires, the kit's `markup()` and `normalizeIds()` have no user but their own cases in test-utils.test.ts (grep of importers). Commit 26 should decide whether to keep them for later goldens or retire them, and say which in the PR.

### RV3-2 (minor): pure helpers left in components

**What:** CLAUDE.md §3 (rules in utilities) and §0.3's "pure functions inside components … moved to utils.ts" call for these four to move:
- src/components/local-time/local-time.tsx:19 `formatTime`. V1's file, and bug B7's site.
- src/features/campaigns/components/campaign-index/campaign-index.tsx:186 `countWords`
- src/features/campaigns/components/campaign-setup-form/campaign-setup-form.tsx:170 `randomSecret`
- src/components/avatar/avatar.tsx:35 `initial`. Bug B8's site.

**Evidence:** `grep -nE '^(async )?function [a-z]|^const [a-z]\w* = (\(|async|[a-z]+ =>)'` over the area's product .tsx files. The hits outside U2's description/entry-icon and note-time's useSyncExternalStore glue are these four. All four were there at base, and lanes V1 and V2 left them.

**Fix:**
- Move each one verbatim to a utils.ts beside its component (local-time/utils.ts, campaign-index/utils.ts, campaign-setup-form/utils.ts, avatar/utils.ts), unexported where only that component reads it, and import it back.
- Update bugs-found.md's B7 and B8 paths. ROADMAP names no path for them.

### RV3-3 (minor): two different `partyApi` exports

**What:**
- src/utils/seat-urls.ts:38 exports `partyApi(characterId, groupId)` (V2, commit 20).
- src/features/table/utils/party-urls.ts:13 exports `partyApi(seat, character, group)` (V1, commit 19). It imports the first under another name (`partyApi as playerPartyApi`, party-urls.ts:4).
- The same name with two signatures misleads grep and auto-import.

**Fix:**
- Rename FT's pair to `seatPartyApi` and `seatPartyPage` (they take a seat) in party-urls.ts, and in its one caller, table-party-panel.tsx:4 and :31-32.
- No test imports them.

### RV3-4 (minor): the `.refactor/**` ignore

**What:**
- eslint.config.mjs's globalIgnores still lists `'.refactor/**'`, with the comment "(deleted in the PR's last commit)". It was added in 51b8916.
- §2.5 row 28 limits commit 28 to ".refactor/ only", so after the PR the config keeps a dead ignore and a comment that no longer holds.

**Fix:**
- Commit 28 also drops that line and its comment from eslint.config.mjs, and re-runs `npx eslint .`.
- Amend §2.5 row 28's check to ".refactor/ and its eslint ignore".

### RV3-5 (minor): the import-cycle test reads `process.cwd()`

**What:**
- src/__tests__/import-cycles.test.ts:11-12 sets `ROOT = process.cwd()`.
- Jest walks up to find its config, so `npx jest` run from, say, src/ runs the suite with SRC = src/src.
- `fs.readdirSync` then throws ENOENT, and the guard fails for a reason that is not a cycle.

**Fix:** use `const ROOT = path.resolve(__dirname, '../..')`. It is a two-line change in a new test of G's, and it changes no assertion.

### RV3-6 (minor): C1 does not cover avatars mode

**What:**
- §3.2's C1 list for V2 includes "CreatureSwitcher (tabs, avatars)". The committed snapshot has only `data-mode="tabs"` (3 times) and never `avatars`.
- V2's commit 20 moved exactly the layout effects that choose avatars into useSwitcherLayout.
- The snapshot covers the journal's group page ("with chapters on a note and a chapter").

**Evidence:** `grep -o 'data-mode="[a-z]*"' src/__tests__/golden/__snapshots__/markup.golden.test.tsx.snap | sort | uniq -c` gives `3 data-mode="tabs"`.

**Coverage elsewhere:** creature-switcher.test.tsx:356-400 asserts both modes, and e2e companions was green in pass 4.

**Fix:**
- No code change: the goldens are frozen (gate 10) and C1 retires in commit 26.
- List the gap as a commit 4 deviation in the PR's goldens note, and name the suite and e2e run that hold avatars mode.

## Contract items in the area

- **V1 (R1.5.2-.11) and V2 (R1.5.13-.23):** done as described, or with their deviations reported in V1.md and V2.md and accepted by amendment 5 (d) and (e).
  - V1's places.ts became game-table/utils.ts.
  - The cookbook card's button classes stayed file-private (rule 8).
  - TOAST_FOR, COOKBOOK_MOST_DELAY and LastHeard were finished by G (G-6, G-17, G-9).
- **Commit 23:**
  - R1.9.26-.28 are done. Its deviations are accepted by amendment 6: the per-rule test overrides, the two extra zone exceptions, src/types/auth.ts, and the 34 directives, 13 of them react-hooks, each with its reason.
  - R1.9.27 is not fully met: SheetProviders (RV3-1).
- **Commit 24:** R1.9.29 and .30 are done.
- **Placement:** single-consumer hooks sit in the feature's hooks/ folder: GameTable's seven, the journal's five, useSortableDrag, useSwitcherLayout and useCampaignIndexNav. owners.tsv rows 780, 792, 794 and 796 put them there, and CLAUDE.md §4 allows "near that component or its feature", so this is not a finding.

## CLAUDE.md in the area's files now

- One export per .tsx, named types in types.ts, no cycles, and directives each with a reason: eslint enforces all of these at error and prints nothing.
- Bridges that return createElement follow §0.6.4.
- Exceptions: the KISS and §3 points above (RV3-1, RV3-2) and a naming point (RV3-3).
- Not raised again: the earlier minor findings that were already handled (V1-RV-5 on wide prop surfaces, which was declined with a reason; the WaitingCompanion and CompanionAskRow copies).

## Bugs

- None new found at base in my reading, so nothing was appended to bugs-found.md.
- No product bug introduced by the refactor was found.

## For later

- **Commit 26:** RV3-1 (delete SheetProviders); decide on `markup()` and `normalizeIds()`; G-19 (EFFECT_DICE_KINDS).
- **Commit 28:** RV3-4.
- **The PR:** RV3-6's note.
- **eslint.config.mjs:** it still has one warn-level rule, `react/jsx-max-props-per-line` at `1`. This comes from the base and is not a CLAUDE.md rule, and prettier makes it moot. Raise it to `'error'` if commit 25 touches the config.
