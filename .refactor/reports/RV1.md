# RV1: Phase 5 review of the server, the wire and the checks (v0.43)

Reviewer RV1. I am independent of the builders and I edited nothing in APP. The branch is
`claude/dazzling-dirac-m8cq54` at 6e92666. Its src equals 153834e's src, and that tree passed G's
landing L1 at b40b6f0 and e2e pass 4 (104 of 104) at 66d5f4a. I checked this with
`git diff --stat 153834e HEAD -- src`, which is empty.

## Scope

| § 2.5 | SHA | lane | fix commits beside it |
|---|---|---|---|
| 9 | d264d9a | S | 8088279 (S round 1, shared by 9-11) |
| 10 | e88b05a | S | 8088279 |
| 11 | f7d3890 | S | 8088279 |
| 12 | a3b222f | W-a | 410051c |
| 13 | 2365911 | W-a | 410051c |
| 14 | 38a17b5 | W-b | 5ec922f (moves.d), f1bde09 |
| 22 | 5c56ff7 | F-b | none |

The files in scope: src/app/api, src/app/{campaigns,characters}/actions.ts, src/lib, src/db,
src/clients, src/schemas, src/types, src/constants, src/mocks, src/utils/requests and the server
utils (features, hello-features, slim-sheet, table-view, transfers, wild-shape, removals,
*-commands, seen-query, seat-urls). F-b's three files are included too.

## What I ran

- **The goldens and the area's suites.** Run in APP under the locks, as given:
  `flock X/l1-wait.lock true && flock -s X/checks.lock npx jest --ci src/__tests__ src/app src/lib
  src/db src/schemas src/utils src/constants src/mocks src/features/table --maxWorkers=2 --json`.
  - The result: **166 suites and 5,955 tests passed, 0 failed.** Snapshots: 1,001 matched, 0 added,
    0 unchecked, 0 updated.
  - The run includes all nine goldens (C1-C9 in src/__tests__/golden) and the import-cycle test.
  - Output: X/RV1/jest.json and X/RV1/jest.log.
- **eslint over the area.** Run under `flock X/l1-wait.lock flock X/checks.lock`, over src/app/api,
  both actions.ts files, src/lib, src/db, src/clients, src/schemas, src/types, src/constants,
  src/mocks, src/utils and F-b's table files. It exited 0 with no output (X/RV1/eslint.txt is
  empty).
- **Not run:** tsc, `next build`, the gate scripts and e2e. The src tree is byte-equal to the one
  G's landing L1 ran on at b40b6f0, which was green on tsc, eslint, jest and gates 1-12, and
  `next build` was green there too. e2e pass 4 was 104/104 on the same src. I did not run any of
  these again.

## Behaviour (§1.8): read diff by diff

I read every hunk of commits 9-11, the creators and the roll path line by line against their
parents, and also commit 14's checks and views and commit 22. I found no change to the surface.
What I checked:

- **Commit 9.**
  - createCommand keeps each creator's refusal order:
    1. 409 for no campaign, actor or value
    2. the Gamemaster's 409, now from the table's `gm`; remove has none, as before
    3. the campaign read, with the same select keys in the same order (`[info.own]`, bridgePolledAt,
       characters)
    4. switchOn
    5. 429 from seatBusy (the same two counts in the same Promise.all order)
    6. 422 unknown
    7. the sheet and waiting reads, with Wild Shape's `forms` skip
    8. the check, then the clash
  - holdCommand writes the row's keys in the same order, then the same prune.
  - commandPayload gives the same keys as the old destructure-rest.
  - On the kind table:
    - OWN_KINDS, ANSWER_KINDS, `'shaped' in` and `'check' in` cover the same kinds as the literals.
    - The withheld list is in OWN_KINDS order, which was the pinned order.
    - BRIDGE_SWITCHES has the 8 switches in their order (markBridgePolled's select and answer, and
      the commands route).
    - FOUNDRY_ID is the same pattern as the 3 copies it replaces.
    - due() is the throttles' exact test.
    - The NO_DICE spread has the same key order.
- **Commit 10.**
  - seatAnswer keeps the order: getCurrentUser, then 401, then `await params`, then find, then 404.
  - The texts routes keep their B16 quirks:
    - the player's route has no headers on its 401 and its two 404s
    - the Gamemaster's route has none on its 401 and `no-store` on its 404
    - the companions' texts routes keep their hash check inside find
  - seenAs gives the same comparison per key: a number by `Number()`, text by `?? ''`, a flag by
    `=== '1'`, and gm and gmrolls by `?? undefined`. The cookbook's version string compares as
    before.
  - readBody maps every `why` to today's answer. Rolls: 415, 413, 400, bare. Notes: 415 bare, then
    413 and 400 as `{reason: 'invalid'}`. Dishes: the type lower-cased, the declared size first,
    then 415 NOT_JSON, 413 TOO_LARGE and 400 NOT_READ. Events and commands: the declared size
    first. Rolls and notes still have no declared check (B4).
  - recordRollResult keeps the order: markGmMessages, then closeAnsweredPrompt, then the version
    bump.
- **Commit 11.**
  - EVENT_HANDLERS has every case of the old switch with the same writes. command.result and the
    dish events have no handler and answer false.
  - VERSION_SILENT holds the same three types.
  - The hello's campaign update writes its keys in the same order:
    1. characters and groups
    2. helloCampaignData's 13 keys, with rollFeatures in HELLO_ROLL_FLAGS order
    3. companions
    4. companionKinds and companionInitiative
    5. foundry
    The writes after it keep their order.
  - The roll path: rollGate, readRollContext (its 11 reads with the same arguments; inFlight uses
    onItsWay, which gives the same where), rollRefusal, then holdCommand. The row carries the same
    keys, ofActorId and useId among them. combatOf equals the old let and if chain.
  - The route splits (pingAnswer, takeEvent, eventAnswer; commandsFor, claimAll, holdForCommands)
    keep each answer's body key order and headers.
  - R1.3.11's splits in notes, note-sync, table, party, campaigns, slim-sheet and table-view are
    extract-function only:
    - Each view and row keeps its key order.
    - The transaction writes keep their order.
    - The `changed` flag in applyJournalUpdated is still false where mirrorPages assigns it.
    - originOf never returns '', so rollLabel's `origin ?? item` is equal to the old code.
- **Commits 12-13.**
  - leftOut and orNull are the exact chains they replace.
  - HIT_DIE.source is unchanged, and a test pins it.
  - isDieSides is the same DIE_SIDES test.
  - EVENT_SCHEMAS has the same schema per type. parseGameEvent answers undefined for every type not
    in it, as before. C6 holds the prettifyError text.
  - rollRequestSchema's rule groups keep the issue order. DICE_RULES gives the same dice branch per
    kind, which W-a's fuzz over 200,000 requests also showed.
- **Commit 14.**
  - CHECKS and LINKED match the old switch kind for kind, including 'damage', and every kind
    missing from them answers undefined or 'link' as before.
  - Each view's key order holds: outcomesOf always comes last, and toldOf sits before d20,
    critical, healing and slotOp.
  - The gmLabel words come from the table. GM_UNSENT keeps its order.
  - C9 shows the mock fixtures are equal.
- **Commit 22.**
  - seenQuery writes the same keys in the same order. ViewSeen requires version and live, so the
    old `String(version)` always held a number.
  - The seat-urls give the same encoded paths.
  - HEADER_ICON_BUTTON is byte-equal to the old class string, `-ml-1.5 shrink-0` first.
- **Test files the commits touched:** only import lines and `import type` lines changed (gate 1b).

## §1 items

- **S, R1.3.1-R1.3.14:** all done.
  - The accepted deviations are amendment 5(d) (notePresent in seat-routes.ts) and G-13 (`due`
    stays in db/commands.ts).
  - R1.3.4 is done in substance, but its form differs from the item and no report or amendment
    records it. See RV1-1.
- **W-a, R1.4.1-R1.4.4, R1.4.7-R1.4.9b:** done.
  - The deviations are reported in W-a.md: EFFECT_DICE_KINDS and COMPANION_UNTAKEN stay literals,
    HIT_DIE stays put, and R1.4.9b is done by amendment 5(d).
  - W-a-2 (the HIT_DIE test beside its unit) was done by G (G-18).
- **W-b, R1.4.4-R1.4.6, R1.4.10:** done.
  - The deviations are reported in W-b.md: GM_ROLL_KINDS and CHECK_TYPES are read rather than
    derived, the test split goes below describe level, and src/utils/roll-requests.ts is not
    emptied (G-24, optional, not done: RV1-3).
- **F-b, R1.9.22-R1.9.23:** done. The sites are those of amendment 5(e).

## CLAUDE.md in the area's files now

- **Passed:**
  - eslint is clean at error level.
  - No .tsx in the area exports more than one thing.
  - No exported named type sits outside a types.ts or src/types.
  - There are 0 cycle groups (import-cycles.test.ts is green).
  - The area has 5 disables, all at base and each with a reason.
  - Each new helper removes copies: seenAs 5, readBody 5, textAnswer 3, switchOn 5, createCommand 4,
    kindOn 7, leftOut 67, orNull 59, issuesTo 44.
  - Each new test sits beside its unit.
- **Gaps:** RV1-3 (colocation) and RV1-4 (pure rules left in db modules).

## Findings

| id | severity | area | what |
|---|---|---|---|
| RV1-1 | major (documentation only) | server | R1.3.4 differs from the item with no amendment or report entry. metrics-after.md says the 4 companion helpers went, but they are still in the code. |
| RV1-2 | minor | table-ui | two exported `partyApi` functions with different signatures; F-b's alias hides the clash |
| RV1-3 | minor | server | src/utils/roll-requests.ts keeps 3 helpers that only src/utils/requests/ uses (G-24 not done) |
| RV1-4 | minor | server | the roll path's new pure rule functions sit in db/roll-requests.ts rather than in utilities (CLAUDE.md §3, §5, §6) |

### RV1-1 (major, documentation only): R1.3.4 differs from the contract, and the report does not say so

- **The contract.** round.md:831-838 asks for seat-resolver.ts with playerAt, gmAt, companionAt,
  companionRollAt, partyAt and seatAnswer, and says "the four companion-routes helpers go".
- **The code.**
  - src/lib/routes/seat-resolver.ts:17 exports seatAnswer only.
  - playerAt is `getPlayerSeat` (src/db/seats.ts:33). partyAt is in
    src/lib/routes/party-routes.ts:26.
  - gmAt, companionAt and companionRollAt were never made.
  - The four helpers stay at src/lib/routes/companion-routes.ts:31, 45, 61 and 77.
- **Where it is explained.** Only e88b05a's commit message gives the reason:
  companion-routes.integration.test calls each helper, and the GM routes suite mocks db/seats with
  getGmSeat alone. Neither reason is recorded anywhere else:
  - S.md's "Deviations from round.md" (lines 116-123) lists 4 deviations, and this is not one of
    them.
  - S.md:109 says the 4 helpers became "seat-resolver.ts".
  - The PR-bound table in R/analysis/metrics-after.md:278 says "21 route files, 4 companion helpers,
    `notesSeat` → 1 (src/lib/routes/seat-resolver.ts, commit 10)".
- **Effect.** No behaviour changes: C5 and the route suites are green, and this way is KISS-sound.
- **Fix.** No code change.
  - Add the deviation to S.md's list, with e88b05a's reasons.
  - Write an amendment line or a PR deviation note: R1.3.4's resolver is seatAnswer, plus
    getPlayerSeat beside getGmSeat in db/seats and partyAt beside the party's responders. The four
    companion helpers stay as two-line finders, because the frozen integration test calls them.
  - Correct metrics-after.md:278 and S.md:109 to "1 seatAnswer (seat-resolver.ts); the 4 companion
    finders kept on getPlayerSeat/getGmSeat".

### RV1-2 (minor, table-ui): two `partyApi` functions with different signatures

- **Where.**
  - src/utils/seat-urls.ts:36 is `partyApi(characterId, groupId)`.
  - src/features/table/utils/party-urls.ts:13 is `partyApi(seat, character, group)`.
- **What 5c56ff7 did.** It imports the first as `partyApi as playerPartyApi` (party-urls.ts:4) to
  hide the clash. A reader or an auto-import can now pick the wrong one.
- **Fix.** Rename party-urls' two functions after what they take, for example `tablePartyApi` and
  `tablePartyPage`. Change the one import in
  src/features/table/components/table-party-panel/table-party-panel.tsx:4 and its two calls
  (:31 and :32), then drop the alias. No test or mock imports party-urls.

### RV1-3 (minor, server): src/utils/roll-requests.ts sits above the folder that uses it

- **What is left.** The file keeps isSeatCombatant, sheetUses and checkDamageDice. Their only
  importers are src/utils/requests/checks.ts:13-17 and src/utils/requests/check-damage.ts:3.
- **Why it matters.**
  - CLAUDE.md §4 says to hoist only as far as required, and these three are hoisted one level too
    far.
  - The file's name is easily read as the requests/ folder.
  - This is W-b's deviation 4 and G-24 (optional, not done: the moves.d rows are the
    orchestrator's).
- **Fix, in commit 25 (orchestrator plus W-b).**
  - Move checkDamageDice into check-damage.ts. Move isSeatCombatant and sheetUses into checks.ts,
    or a requests/ module of their own.
  - Retarget the two import lines.
  - Move roll-requests.test.ts's 2 tests to the new files, and point moves.d/W-b.tsv's 2 rows at
    them.
  - Delete the file.
- **If commit 25 should stay small:** add one ROADMAP v0.44 tooling line instead.

### RV1-4 (minor, server): the roll path's new pure rules sit in a db module

- **What.** R1.3.9's stages made four pure, file-private functions in src/db/roll-requests.ts:
  rollGate (:215), lacksFeature (:261), combatOf (:475) and rollPayload (:490). They sit beside
  companionRefusal (:542) and namesAloneChoices (:526), which were there at base.
- **Why it matters.**
  - CLAUDE.md §3 puts domain decisions in utilities, §5 says routes delegate rules to utilities,
    and §6 keeps persistence apart from domain rules.
  - These are refusal rules of the same family as checkRoll in src/utils/requests/checks.ts.
  - As file-private functions in db, they can only be tested through createRollRequest's Prisma
    mocks.
- **The same pattern:** db/table.ts viewerOf (:489), gmRollParts (:609) and seatAllows (:633), and
  db/notes.ts's view helpers (:343-460, :705-760). The contract asked for extract-function only
  (R1.3.11), so these are in line with it.
- **Fix, either of:**
  - Move rollGate, lacksFeature, combatOf, rollPayload, companionRefusal and namesAloneChoices
    verbatim to src/utils/requests/roll-gate.ts, imported by db/roll-requests.ts. They need no
    Prisma and nothing mocks them. This changes no behaviour.
  - With that move, give rollGate's and rollPayload's campaign parameter a structural type in
    src/utils/requests/types.ts (rollFeatures, rollKinds, companionKinds, characters...), not the
    file-private RollCampaign. Zone 4 bars src/utils from importing src/db.
  - Or add one ROADMAP v0.44 line: "db modules still hold pure view and refusal rules (roll gate,
    table view parts, notes overlay); move them to src/utils".

## Bugs

- No product bug was introduced in the area. I found none.
- No new bug at base either, so nothing was appended to R/bugs-found.md.
- The area's base bugs already logged are still there unchanged, as ROADMAP v0.44 lists them:
  B4, B5, B16, the ping binding a campaign, and x-forwarded-host.

## Not reviewed

e2e was not run (pass 4 is the record). tsc, `next build` and the gates were not run again: see
"What I ran".
