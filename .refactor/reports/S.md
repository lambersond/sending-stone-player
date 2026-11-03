# S (Phase 3, server lane): report, with fix round 1

Worktree /home/user/w043/S/sending-stone-player, branch `local/043-S`, from a2332a2 (commit 8 + M's
fix3 report). Nothing pushed. No earlier S report existed in X/reports, so this one covers the
whole lane: commits 9-11 and the fix round after the independent review (findings S-1 to S-7).

## Commits (in landing order)

| SHA | subject |
|---|---|
| f5e4021 | refactor(server): the db cycle gone, one command creator, the kind table's switches, throttles (commit 9: R1.3.1, .2, .3, .14 with R1.9.6's server sites) |
| b5ebef2 | refactor(server): one seat resolver, NO_STORE and the answers, one body reader, the result router, types (commit 10: R1.3.4, .5, .6, .7, .12) |
| eb1618b | refactor(server): event table and hello split, the roll path in stages, route and db complexity (commit 11: R1.3.8, .9, .10, .11, .13) |
| f1ab7d2 | fix: v0.43 server, round 1 (notePresent; the event handlers table; one Tx; RollCampaign; keptLabel) |

No moves.d/S.tsv and no chore(refactor) commit: S split no test file. R1.3.13's "attempt's cases out
of bridge-http.test" found no such cases: bridge-http.test.ts never tested `attempt`, so nothing moved.

## Items done

All of S's items in §2.4's order: R1.3.1 → .2 → .3 → .14 (commit 9) → .4 → .5 → .6 → .7 → .12
(commit 10) → .8 → .9 → .10 → .11 (db/notes.ts last) → .13 (commit 11). Each commit message lists what
moved. Fix round 1 (f1ab7d2) finishes R1.3.5's notePresent and R1.3.8's EVENT_HANDLERS, which the first
pass had left out.

## Fix round 1: the findings

- **S-1 (fixed).** `notePresent(campaignId, failed = 'Failed to note a player at the table')` sits in
  src/lib/routes/seat-routes.ts beside `noting`, which is now file-private. It is used at the four
  sites R1.3.5 counts: tableResponse, companionTableResponse and partyResponse, all with the table
  message, and notesResponse with its own message ('Failed to note a player at their notes'). It
  returns `noting(...)` directly and is not `async`, so notePlayersSeen is still called synchronously
  in the same order inside tableResponse's Promise.all. notePlayersSeen is still imported, and mocked,
  from `@/db/roll-requests`. **Deviation:** round.md and the owners.tsv row put notePresent in
  src/lib/routes/http.ts. It goes beside `noting` instead (the reviewer's alternative). In http.ts it
  would need `noting` and a db import, and seat-routes.ts imports http.ts, so http.ts would either
  form a cycle or pull a database module into every route that only wants NO_STORE. The http.ts row's
  note ("… seenAs, notePresent") is the only thing to correct.
- **S-2 (fixed, so the deviation is gone).** `apply`'s switch is now `EVENT_HANDLERS` in
  src/db/campaign-events.ts, with no casts. A file-private payload map,
  `EventData = { [T in GameEvent['type']]: (GameEvent & { type: T })['data'] }`, types a partial
  mapped table `{ [T]?: (data: EventData[T], applying: Applying) => Promise<boolean> }`. A generic
  `apply<T>(event: { type: T; data: EventData[T] }, applying)` looks up the handler, and TypeScript
  correlates the key with its handler (tsc 0 errors). The cases are copied as they were, in the same
  order and with the same writes. The types that shared a case share a named handler: keepMessage,
  keepCombat, keepCombatant. command.result, dish.applied and dish.dismissed have no handler and
  answer `false` as the switch's fall-through did; the events route records them itself and never
  passes them here. eb1618b's message says a table "would need a cast at each call". f1ab7d2
  supersedes that (history is not rewritten). round.md §0.8 item 8 ("EVENT_HANDLERS") and R1.3.8 are
  now true as written, so the orchestrator has nothing to update.
- **S-3 (Phase 4 entry corrected).** The earlier note was wrong. Amendment 1(a) keeps
  `SocialProviderId` in src/auth-providers.ts and creates no src/types/auth.ts. Its warning
  (no-restricted-syntax, "Exported named types go in a types.ts", src/auth-providers.ts:19) therefore
  cannot be cleared by a move. G must decide in commit 23 (see Phase 4 below).
- **S-4 (not moved; the orchestrator decides).** owners.tsv's row for src/db/commands.ts names `due`
  as one of that file's names. Every utility file S may create needs a row, and none exists for a
  throttle module (for example src/utils/throttle.ts). It is listed under Phase 4 for the
  orchestrator. The cookbook's alias (`due as pruneDue`) is needed either way: claimDishes has a local
  `const due` (db/cookbook.ts:238). Behaviour does not change.
- **S-5 (fixed).** `inRoster` is file-private. transfers.ts still parses its own roster because it
  needs the array. That is two copies, which §0.2.4 leaves alone.
- **S-6 (fixed).** db/notes.ts:1018 and :1229 use `Tx` from './types'.
- **S-7 (fixed, both parts).** `type RollCampaign = Prisma.CampaignGetPayload<{ select: typeof
  ROLL_CAMPAIGN }>` is file-private beside ROLL_CAMPAIGN, and the three signatures use it. The
  `gmLabel()` helper in db/commands.ts is renamed `keptLabel()` at its three callers (db/commands.ts,
  db/transfers.ts, db/roll-requests.ts; all S files, imported by no test or mock), so it no longer
  shares a name with ROLL_KIND_INFO's `gmLabel` field.

## Checks

- **Fix round L1** (l1/S/fix1, on f1ab7d2's tree): jest 306 suites, 9,698 tests, 0 red, 0 flaky;
  typegen ok; tsc 0 errors; eslint 797 files, 0 errors, 608 warnings. Gates 1-12 ok:
  - gate 9: 608 against ratchet-moved.json's 981. No key rose, so I have no moved-warning keys to report.
  - gate 12: 2 cycle groups (base 4). The src/db runtime group and use-table-rolls' pair are gone. What
    remains is src/types' group of 4 (W-a's, broken on its own branch) and transfers' move-dialog and
    recipient-list pair (V2's).
  - gate 4b: 698 names checked, down from commit 11's 721, because three route modules no longer
    import notePlayersSeen from the mocked `@/db/roll-requests`.
- **`next build`** on f1ab7d2, under the wait and checks locks: exit 0, every route listed. The Better
  Auth "default secret / Base URL not set" lines in the log come from the worktree's missing
  environment, not from this change.
- **L0** per edit (`--findRelatedTests`, shared lock): the four route modules (37 suites, 655 tests),
  the db files (59 suites, 1,715 tests) and campaign-events.ts (49 suites, 1,345 tests). All green.
- **Earlier L1s** (from the commit messages):
  - commit 9: 305 suites, 9,689 tests, 648 warnings.
  - commit 10 (l1/S/c10b): 305 suites, 9,689 tests, 625 warnings.
  - commit 11 (l1/S/c11b): 306 suites, 9,698 tests, 608 warnings.
  - All three: 0 red, tsc and eslint 0 errors, gates 1-12 ok.
- **Process slip, fix round:** one `npx tsc --noEmit` ran in this worktree without the wait and checks
  locks, to check that the EVENT_HANDLERS typing needed no cast. It passed (0 errors). Every other
  heavy run (eslint, L1, build) took the locks.

## Metrics the lane moved

Over S's 181 files: eslint at commit 8 (l1/M/landing-fix3, 169 S files then) against f1ab7d2
(l1/S/fix1).

| metric | before | after |
|---|---|---|
| rule (a), .tsx with more than one export | 0 (S owns no such .tsx) | 0 |
| rule (b), exported named types outside types.ts | 27 | 2 (src/auth-providers.ts:19 SocialProviderId, src/db/characters.ts:54 ChoiceProblem; both in Phase 4) |
| cognitive complexity > 15 | 18 functions | 0 |
| import/no-cycle warnings | 10 | 0 |
| cycle groups (whole tree, gate 12) | 4 | 2 (neither is S's) |
| import/no-restricted-paths | 7 | 7: 6 db and utils tests import `@/schemas/sending-stone`, and db/notes.ts:23 imports `@/schemas/notes` |
| eslint-disable comments in S files | 70 | 70 |
| `{'Cache-Control':'no-store'}` copies | 25 files | 1 (NO_STORE) |
| command creators | 5 + the roll path's copy | 1 (createCommand; transfer keeps its own gates on seatBusy and holdCommand) |
| seat resolution | 21 route files, 4 helpers, notesSeat | seat-resolver.ts |

- The 7 no-restricted-paths warnings all come from commit 1's old "db must not import schemas" zone.
  §1.7.4 drops that zone in commit 23, so they clear there.
- Of the 70 disables, 68 are in frozen tests. The 2 in product code are line-level with a reason:
  note-sync.ts:673 (camelcase) and slim-sheet.ts:223 (prefer-structured-clone).

## Deviations from round.md

1. R1.3.5's notePresent is in seat-routes.ts, not http.ts (S-1 above). owners.tsv's http.ts note should
   say so.
2. R1.3.14's `due` stays in db/commands.ts, as owners.tsv places it. A move needs a new row (S-4).
3. R1.3.13 split no test file: there were no attempt cases to split.
4. Fix round names: `gmLabel()` → `keptLabel()`, and `noting` and `inRoster` are now file-private. These
   are S's own new names, imported by no other lane, test or mock.

## Bugs logged

None new in the fix round. The first pass's entries are under "[S] Server" in R/bugs-found.md:
- bridge.ping binds a waiting campaign (db/campaigns.ts).
- Roll and note bodies are read before their size is checked (B4).
- The texts routes' missing Cache-Control (B16).
- x-forwarded-host is taken whole (lib/app-origin.ts).
- The three throttle Maps are never pruned (B5).

## Phase 4

Each item is file, what, why:

1. **src/auth-providers.ts:19, `SocialProviderId`. Corrected entry.** It stays in auth-providers.ts under
   amendment 1(a); there is no src/types/auth.ts. Its one importer is
   src/components/sign-in-buttons/sign-in-buttons.tsx (V2's). The type is derived,
   `keyof ReturnType<typeof socialProviders>`, so any types.ts home would import `typeof socialProviders`
   back from auth-providers.ts, which uses the type in enabledSocialProviders: a type-only cycle. G
   needs a decision before commit 23 turns no-restricted-syntax into an error. Either a narrow written
   exception (a line disable whose reason names that cycle), or a home the orchestrator chooses (for
   example a literal union `'google' | 'discord'` in a src/types file, with auth-providers' object
   checked against it). Both are type-only.
2. **src/db/characters.ts:54, `ChoiceProblem`.** This exported type warns no-restricted-syntax. Its one
   importer, src/app/characters/actions.ts, is S's file but owners.tsv gives it phases `-` (stays), so S
   could not change its import line in Phase 3. Fix: move the type to src/db/types.ts and change that
   import line. G in commit 23, or a row change.
3. **src/db/commands.ts:221, `due`. The orchestrator decides (S-4).** If wanted, move it to a new
   utility module (for example src/utils/throttle.ts, which needs an owners.tsv row) and change its two
   importers, db/roll-requests.ts and db/cookbook.ts. Pure and behaviour-neutral.
4. **owners.tsv, the src/lib/routes/http.ts row's note.** notePresent now lives in
   src/lib/routes/seat-routes.ts (deviation 1). Bookkeeping only.

## What integration must know

- **What S's branch touches.** db/*, lib/*, lib/routes/*, app/api/**, src/constants/features.ts, and
  these utils: features, hello-features, slim-sheet, table-view, transfers, wild-shape. S's new files all
  have owners.tsv rows: db/types.ts, db/constants.ts, db/commands.ts, lib/routes/{seat-resolver, http,
  body, types}.ts, lib/attempt.ts, lib/types.ts, utils/features.ts, utils/hello-features.ts (+ test),
  constants/features.ts.
- **Mocked surfaces are unchanged.** notePlayersSeen stays at `@/db/roll-requests`, recordCommandResult
  stays the entry the events suite mocks, and getGmSeat and getPlayerSeat are in db/seats.
- **Names other lanes import.** Their paths are those from 2b; S moved none in Phase 3.
- **Merge conflicts.** If S's branch conflicts with W-a's on src/types imports, the conflict is in import
  lines only: S's files import RollSeat and RollRejection from `@/db/types` and the shared types from
  their 2b paths.
- **The base moved after a2332a2.** If the landing rebases S onto other lanes, rerun L1 at the rebased
  head. The fix commit needs nothing from any other lane.
