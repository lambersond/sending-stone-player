# Phase 5 fix report: area "server" (RV1-1, RV1-3, RV1-4)

- **Worktree:** /home/user/w043/fix-server/sending-stone-player
- **Branch:** local/043-fix-server, from claude/dazzling-dirac-m8cq54 at 6e92666. Nothing pushed.
- **Commit:** ca30667 `fix: review findings (v0.43, server)`, with one paragraph per finding id and
  the brief's trailers.

## Findings

### RV1-3 (minor): fixed in code. This is G-24 / WB-2.

src/utils/roll-requests.ts and its 2-test remainder are deleted. Their helpers now sit with their
only consumers in src/utils/requests/ (CLAUDE.md §4).

**The helpers.** Each was moved verbatim, JSDoc included; I checked this against the deleted file.
- `checkDamageDice` → src/utils/requests/check-damage.ts. checkDamage calls it there. Its imports
  came with it: damage-modifiers, `matchesPlanned` from check-linked, and DamagePreview.
- checks.ts now imports `checkDamageDice` from check-damage.ts. check-damage.ts imports neither
  checks.ts nor anything that does, so no cycle forms (gate 12: 0 groups).
- `isSeatCombatant` and `sheetUses` → src/utils/requests/checks.ts, their only user, at the end of
  the file beside the other helpers.
  - `isSeatCombatant` stays exported, because its test imports it.
  - `sheetUses` is now file-private. Nothing outside checks.ts uses it, and no mock names it.

**The tests.** Both moved unchanged, with their titles and describe paths:
- `takes the seat’s own combatant …` → checks.test.ts, first in its existing companions describe,
  as at the base. That describe already held the base's identical `fight`, and the file the base's
  `request` and `alone`.
- `damage on its own › checks its dice as an attack’s due damage is checked` → check-damage.test.ts,
  under the same describe path. Its top-level `alone` helper came verbatim. The file already had the
  base's identical `request`.
- Only import lines changed otherwise: `isSeatCombatant`; `checkDamageDice`; `mockTableDamage`.

**moves.d.** .refactor/tools/moves.d/W-b.tsv's two rows for these tests now point at
src/utils/requests/checks.test.ts and src/utils/requests/check-damage.test.ts. The row change is in
the same commit, so the L3 replay at commit 25 finds the tests: splits are read from the checkout.

**Not touched, and why:**
- No moves.tsv rows. Only the codemod commits 5, 7 and 8 wrote moves.tsv.
- No base test mocks `@/utils/roll-requests`.
- No gate follows the deleted source file. Gates 6, 8 and 11 follow route, noprisma-suite and
  header files only.
- The titles in roll-kinds.test.ts that cite `utils/roll-requests.ts:<line>` describe the base
  file. They are frozen and left as they are.
- phase4-items.md's G-24 now says "Done in commit 25 (Phase 5, RV1-3)".

### RV1-1 (minor): fixed (documentation only)

- **.refactor/reports/S.md:**
  - The seat-resolution metrics row (line 109) now reads "1 seatAnswer (seat-resolver.ts); the 4
    companion finders kept on getPlayerSeat/getGmSeat; notesSeat keeps its own checks".
  - New deviation 5 records R1.3.4 with e88b05a's reasons:
    - seatAnswer is alone in seat-resolver.ts.
    - getPlayerSeat sits beside getGmSeat in db/seats.ts, and partyAt in party-routes.ts.
    - The four companion helpers stay as two-line finders, because the frozen
      companion-routes.integration.test calls each one.
    - No route's import closure grows: the GM routes suite mocks db/seats with getGmSeat alone.
    - notesSeat keeps its own 401/404, as R1.3.4 planned.
    - Behaviour is unchanged: at the base, these helpers were already finders that never answered
      401 or 404.
- **.refactor/analysis/metrics-after.md:278:** the "after" cell is corrected in the same way. This
  line feeds the PR's metrics table.
- **.refactor/phase4-items.md P-5 (deviations for the PR):** a "Commit 10 (R1.3.4; Phase 5,
  RV1-1)" bullet is added before the commit 11 bullet.
- **round.md:** no amendment line was added. Amendments are the orchestrator's; P-5 carries the PR
  note instead. If the orchestrator wants an amendment too, the deviation 5 text in S.md can be
  pasted.

I agree with the skeptic that the deviation was already recorded in phase3-S-W-a.json and in
e88b05a's message. What was missing was the final report's list and the metrics line.

### RV1-4 (minor): fixed by the finding's option (b), a ROADMAP v0.44 line

ROADMAP.md, v0.44 item 9, has a new bullet after "Throttle memory": **Rules in the database
modules**. It names:
- db/roll-requests.ts's rollGate, lacksFeature, combatOf, rollPayload, namesAloneChoices and
  companionRefusal
- db/table.ts's viewerOf, gmRollParts and seatAllows
- db/notes.ts's view overlay

It says they move to src/utils/.

**Why not option (a).** It is not small:
- rollGate returns RollRejection, which src/db/types.ts defines. Zone 4 bars src/utils from
  importing src/db, so RollRejection would have to move as well, and it has 8 importers.
- The campaign parameter is Prisma-derived (RollCampaign) and would need a structural copy.
- R1.3.9 and R1.3.11 placed these stages in the file.

**Cross-area note.** ROADMAP.md is listed in RV3's (table-ui) scope. The bullet sits between two
server bullets, to keep rebase conflicts with a table-ui ROADMAP edit unlikely.

## Checks

| check | where | result |
|---|---|---|
| L0 | check-damage.ts, checks.ts and their tests, `--findRelatedTests` | 49 suites, 1,622 tests, 404 snapshots, all passed |
| eslint | the 4 changed src files | clean |
| gate 1b, before L1 | | ok (288 base test files compared, 474 moved names) |
| L1 | X/l1/fix-server, 07:06:29 to 07:11:08 UTC | 0 failed |
| `next build` | under both locks, 07:11:17 to 07:12:11 UTC | exit 0 |

L1 in detail:
- jest: 317 suites (318 before; the remainder suite is gone), 9,727 tests, 0 red, 0 flaky.
- typegen ok; tsc 0 errors.
- eslint: 1,159 files, 0 errors, 0 warnings.
- Gates 1-12 all ok:
  - gate 2: all 8,607 base tests.
  - gate 3: 317 suites against the base's 290; 9,727 tests against 8,607.
  - gate 9: 0 warnings.
  - gate 10: 991 golden tests, 24 frozen files held.
  - gate 12: 0 cycle groups.

The build printed only the environment messages earlier builds printed, 6 each: Better Auth's
"Base URL is not set", its default-secret message, and Prisma's "Environment variable not found:
DB_URL".

## Files changed (ca30667)

- src/utils/requests/check-damage.ts, check-damage.test.ts, checks.ts, checks.test.ts
- src/utils/roll-requests.ts and src/utils/roll-requests.test.ts (deleted)
- ROADMAP.md
- .refactor/tools/moves.d/W-b.tsv, .refactor/reports/S.md, .refactor/analysis/metrics-after.md,
  .refactor/phase4-items.md

## For the lander and later work

- **The .refactor/ edits.** The commit touches .refactor/ files because the moves.d rows must sit in
  the same commit as the test move for the replay, and the brief lets a builder's planning edits go
  in its own commit. They go away with .refactor/ in commit 28.
- **Rebase risk.** A rebase onto a head where another fixer changed the same lines of
  metrics-after.md, phase4-items.md P-5 or ROADMAP item 9 could conflict. Each hunk is one to five
  lines.
- **owners.tsv.** Rows 634-635 (src/utils/roll-requests{,.test}.ts) are now history. owners.tsv is a
  record, not a gate (amendment 6 (c)), so I left them.
- **Bugs.** None found; bugs-found.md is unchanged.
