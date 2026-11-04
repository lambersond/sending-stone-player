# F-b report (Phase 4, commit 22)

Builder F-b. Worktree /home/user/w043/F-b/sending-stone-player, branch `local/043-F-b`, made from
APP's head 680d60e (`claude/dazzling-dirac-m8cq54`), with `npm ci` and `npx prisma generate`.
Nothing was pushed.

## Commit

| SHA | subject |
|---|---|
| 2d2c154 | refactor: seat URLs, the table's seen query and header button adopted |

It is one commit on 680d60e, a pathspec commit of three files. It is §2.5's commit 22.

## Files changed (all owners.tsv rows with phase 4 and an R1.9.2x(F-b) grant)

- **src/features/table/utils/table-query.ts** (row 929, R1.9.22; this is FB-1).
  - `tableQuery(seen: ViewSeen)` now returns `seenQuery({...})` from src/utils/seen-query.ts. It
    used to build its own `new URLSearchParams({...})` record.
  - The twelve fields are passed in the table's order, which is the wire's: version, live, rolls,
    gm, `gmrolls: gmRolls`, moves, typed, removes, favorites, effects, `wildshape: wildShape`,
    `sheet: sheetVersion`.
  - The destructured signature is unchanged. seenOf is unchanged. The doc comment now names
    seenQuery's order.
  - use-table-view.ts (row 505) only calls tableQuery, so it is not changed.
- **src/features/table/utils/party-urls.ts** (row 930, R1.9.23; part of FB-2).
  - `partyApi(seat, character, group = '')` is now written with seat-urls' `gmPartyApi` and
    `partyApi`. Because party-urls already exports a `partyApi`, seat-urls' one is imported as
    `playerPartyApi`.
  - `partyPage` is now written with `gmPartyPath` and `partyPath`.
  - The signatures are unchanged, so table-party-panel.tsx (row 925) is not changed.
- **src/features/table/components/table-header/table-header.tsx** (row 781, R1.9.23; part of
  FB-2). The back link's class is now `` `-ml-1.5 shrink-0 ${HEADER_ICON_BUTTON}` ``, with
  `HEADER_ICON_BUTTON` from src/constants/buttons.ts. The class string is byte-equal; this was
  checked by a shell compare against the old literal.

Not changed, on purpose:

- table-header's `/campaigns?campaign=…` link. It is a query, not a seat path, and seat-urls has
  no function for it (FB-2).
- game-table.tsx (row 295). No R1.9.23 site is left in it (FB-2). A grep of src/features/table
  finds no other `encodeURIComponent` and no other copy of the header-button class.
- table-party-panel's `ownSheetHref` `/characters/${character.id}`. It is unencoded, and
  `characterPath` would encode it. This is the unencoded game-table site that R1.5.22 says keeps
  its own code.

## Why it is behaviour-preserving

- **The seen query.**
  - Old code: `version: String(version)` and `live: live ? '1' : '0'` were always written, then
    each optional key was spread in when truthy.
  - seenQuery writes version and live only when they are not `undefined`, then writes the same
    keys under the same truthiness tests, in the same order.
  - ViewSeen types `version: number` and `live: boolean` as required. The server always sends
    both: db/table.ts:405 sends `version: 0, live: false`, and :435-436 sends
    `campaign.version` and `isLive(...)`. So the two ways never differ on the wire.
  - A JS copy of the old and the new code
    (X/F-b-work/equiv.mjs) gave the same string for all 55,296 type-valid inputs. It covered
    every flag combination, empty and set strings, every gm value, and a sheet version with
    `&` and spaces.
  - The two differ only on input outside the type, such as a view with no version, which the old
    code sent as `version=undefined`. No test or real response gives such input. The L1 is green,
    and use-table-view.test pins the URLs byte for byte.
- **The party URLs.**
  - seat-urls encodes each id as a path segment, as the old template did. That includes
    `campaignId ?? ''` and the group's `''` default.
  - X/F-b-work/urls.mjs compared both URLs for 128 cases: both roles; undefined, empty, plain
    and special-character campaign ids, character ids and groups. No case differed.

## Checks (all ran)

- **L0** over the three files, under the shared lock:
  - jest `--ci --findRelatedTests`: 19 suites, 680 tests and 449 snapshots, all passed.
  - eslint on the three files: no output, exit 0.
  - My first L0 waited behind e2e pass 3 and hit its background time limit before it got the
    lock. It was rerun once over all three files, and that run is the result above.
- **L1**, `R/tools/l1.sh X/l1/F-b/c22 <worktree>`, at the committed tree (03:03-03:07Z): 0 failed.
  - jest: 316 suites, 9,726 tests, 0 red, 0 flaky.
  - typegen ok. tsc: 0 errors.
  - eslint: 1,154 files, 0 errors, 114 warnings. That equals the integrated head, and none are
    in these files, before or after.
  - Gates 1-12 all ok: gate 9 at 114 against ratchet-moved.json; gate 10 with 991 golden tests
    and 24 frozen files held; gate 12 with 0 cycle groups.
- **`next build`**, under the exclusive locks: exit 0.
  - The route table is equal to integration's last build (l1/integrate/V2/build.log). Only the
    timing lines differ.
  - Both builds print the same environment-only messages: 6 BetterAuth default-secret and 6
    Prisma P1012 `DB_URL`, because the worktree has no .env.
- **e2e:** not run. Builders run none (§2.3.3).

## Tests, mocks, goldens

None changed. use-table-view.test.tsx and C2 (wire) pin the poll URLs, and C1 (markup) pins the
header. No new test was added: tableQuery is not a new helper, and seenQuery has its own table
test (§3.1.3, CLAUDE.md §8).

## Imports and cycles

The new imports are `@/utils/seen-query`, `@/utils/seat-urls` and `@/constants/buttons`. All
three are shared-layer modules with no imports of their own, so no cycle is possible, and gate 12
finds 0 groups. No directive changed: table-header keeps `'use client'`, and the utils files have
none.

## Deviations from round.md

None.

## Bugs logged

None. Nothing was appended to bugs-found.md.

## For later workstreams

- **G:** R1.9.22 and R1.9.23 are done. game-table.tsx's F-b grant (row 295) and the glob rows
  780 and 781 need nothing more. The `/campaigns?campaign=` query link and the unencoded
  `ownSheetHref` stay as they are, by the contract.
- **The orchestrator:** commit 22 is 2d2c154 on `local/043-F-b`, based on 680d60e. If APP's head
  has moved (for example, F-a's commit 21 landed first), rebase it and run L1 again at the
  rebased commit. F-a and F-b touch no common file.
