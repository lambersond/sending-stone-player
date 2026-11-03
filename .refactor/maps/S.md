# Map S: the server (v0.43 re-plan, 2026-11-03)

Area: `src/app/api/**` (41 route files), `src/app/{characters,campaigns}/actions.ts`, `src/lib/**`,
`src/db/**`, `src/clients/**`, `src/auth.ts`, `src/auth-providers.ts`, utils `table-view, transfers,
removals, favorite-commands, effect-commands, wild-shape, prompts, companions, slim-sheet,
literal-pattern`: 88 product files, 79 suites. Lines are per file at 24f808b. Scripts/outputs in
`.refactor/analysis/S/`: graph.cjs (import graph incl. `jest.mock`), inventory.cjs → inventory.tsv
(every file: lines, exports, outside importers, mocked-by), cycles.py → cycles-value.txt,
complexity.cjs → complexity.txt, eslint-disables{,-summary}.txt, tests-per-file.txt,
layer-edges.txt, exported-types.txt, local-types.txt, no-store-files.txt.

## (1) Inventory (rows: inventory.tsv)

Only `companions, transfers, effect-commands, literal-pattern` are server-only by importers. The
rest have client importers (names stay): `table-view` (chat-log.tsx `askTitle`; W's utils/roll-requests
`damageKinds, healingRolls, toTableRoll`; 40 client suites), `wild-shape` (`articled` in use-picker,
character-sheet, companion-ask-notice; wild-shape.tsx; roll-requests `isShaped`; wild-shape-words),
`favorite-commands` (favoriting.tsx), `removals` (remove-controls.tsx `relatedItems`), `prompts`
(use-waiting-prompts), `slim-sheet` (W's schemas/sending-stone `expandSheet`).

Cross-area edges into S (non-test): `lib/session` ← 10 pages/layouts + header-account.tsx;
`db/characters` ← 3 pages; `db/seats` ← 3 pages; `db/table` ← 2 pages; `db/party` ← 2 party pages;
`db/wild-shape.shapedRefusal` ← party page; `db/campaigns` ← 3 pages; `lib/{app-origin,
campaign-secret}` ← campaigns page; `db/note-sync` ← mocks/sending-stone.ts; actions ← 4 pages;
`auth-providers` ← login page, sign-in-buttons.tsx (type only); `clients/auth-client` ← sign-in/out
buttons. Mocked by suites outside S: session 10, characters 3, campaigns 3, party 2, table 2,
seats 1, wild-shape 1, actions 4, app-origin/campaign-secret/auth-providers/auth-client.

Biggest: db/notes 1592, utils/table-view 1256, note-sync 895, campaign-events 883, roll-requests
828; events route 286, commands 248, the other 39 routes 4-46 lines.

## (2) CLAUDE.md, rule by rule

**§2**: no .tsx in the area. **§5**: both actions.ts `'use server'`, `requireUser` first; no client
module imports server code (sign-in-buttons imports only a type). Routes are thin but events
(POST 177 lines) and bridge/commands (177).

**§3**: 31 exported named types in non-types.ts files, none imported outside S (exported-types.txt):
db/roll-requests `RollSeat, RollRejection`; table `CampaignStatus`; companions `CompanionStatus`;
party `PartySeat`; notes `NotesSeat, NotesBook, NoteAnswer, NoteRights`; note-sync
`NotePageCommand, NoteOrderCommand, NoteCommand, JournalDrawings`; cookbook `CookbookLinkFound,
DishAccepted, CookbookLinkProblem, DishDecision, CookbookSeat`; campaigns `EventCampaign`;
characters `ChoiceProblem`; lib/bridge-http `Refusal`; notes-routes `NotesPlace, NotesAddress`;
session `SessionUser`; auth-providers `SocialProviderId`; utils/prompts `PromptData, HeldPrompt`;
table-view `Viewer, LinkedMessages`; removals/transfers/wild-shape `*Refusal` (used in-file only).
25 local types; `type Tx = Prisma.TransactionClient` 3× (campaign-events.ts:42, note-sync.ts:31,
sheet-texts.ts:12). Shared constants: Foundry-id regex 3× (seats.ts:12, roll-requests.ts:800,
party.ts:24); `{'Cache-Control':'no-store'}` in 25 files; `private, max-age=86400` 3×. Domain rules
in route files: events/route.ts:113-232 (ping, routing, resend/announce) with FEATURES (:254) and
ANSWERED_WITH_FEATURES (:278); bridge/commands/route.ts:173-227 (switches, claim order, hold loop).

**§4**: `src/db/` stays the server-only data layer. The five `lib/*-routes.ts` responders are imported
only by `src/app/api/**` (S.13). Server utils stay in `src/utils/` (LCA `src/` by importers).

**§7**: one runtime cycle of 6: roll-requests → effects, favorites, removals, transfers, wild-shape
(dispatch, :18-23); each → roll-requests (`ago, madeBy, RollRejection`) and → transfers
(`onItsWay`); transfers → roll-requests. No index.ts. Unused re-export db/companions.ts:48
(`companionRoster`). utils/wild-shape sits in the 12-file type-only cycle through src/types (W's
edges). Layering: src/lib holds responders (→ db) and helpers db imports (db/campaigns →
bridge-http `attempt`; db → sheet-html, note-html, note-markdown, campaign-secret, cookbook-code):
a layered-imports rule can't be written for src/lib as is (S.13).

**§9 eslint-disable**: 159 lines. Product 31: 29 `unicorn/no-null` (file-scope 7: campaigns.ts:82,
cookbook.ts:1, note-sync.ts:1, notes.ts:1, slim-sheet.ts:1, table-view.ts:555 and :1162 (mid-file
blocks); no reason 6: campaigns.ts:389,391,408,410, roll-requests.ts:763,790), `camelcase`
note-sync.ts:700, `prefer-structured-clone` slim-sheet.ts:222. Tests 128: 60 no-null (55
file-scope), 62 `no-useless-undefined` (20 without reason: `mockResolvedValue(undefined)`), 6
camelcase. **Q2 removes all 89 no-null**, every file-scope one with them. Left: 70 line-level (62
no-useless-undefined: 20 need a reason, or T's `signedOut()` helper removes ~40; 7 camelcase; 1
structured-clone).

**§9 complexity > 15** (rough; WS0's sonarjs is the count): slim-sheet `expand` :219 ≈115;
campaign-events `apply` :106 ≈88; `createRollRequest` :142 ≈67; events POST :56 ≈41;
`getTableView` :408 ≈39; commands POST :52 ≈35; note-sync `recordNoteResult` :712 ≈34,
`applyJournalUpdated` :272 ≈27; table-view `messageLabel` :892 ≈33, `toTableMessage` :156 ≈19,
`targetsOf` :764 ≈18, `toTableSheet` :1089 ≈18, `tableAsk` :244 ≈17, `sideOf` :62 ≈16; notes
`overlay` :363 ≈32, `viewOf` :684 ≈29, `fits` :892 ≈27, `changeNote` :1078 ≈20, `deleteNote`
:1248 ≈18, `reorderNotes` :1429 ≈16; `checkWildShape` :97 ≈27; `findEventCampaign` :359 ≈25;
transfers `checkEnds` :63 ≈24, `checkHoldings` :150 ≈19; `getGroupView` :276 ≈22; sheet-html
`linkWalk` :154 ≈22; `getCompanionView` :241 ≈21; `createTransferRequest` :43 ≈21;
`claimRollRequests` :538 ≈18; `enrichMarkdown` :136 ≈18; `recordCommandResult` :634 ≈17;
`createRemoveRequest` :30 ≈16. 32 functions.

## (3) Duplication (3+ copies)

**D1 Seat resolver (Q1)**: session → 401 → lookup → 404 → seat, in 21 route files: player
(getCharacter + playerSeat) characters/[id]/{table:19-26, rolls:20-27, rolls/[roll]:14-21,
texts/[hash]:17-25, party/[group]:20-31 (+partySeat), party/[group]/texts/[hash]:18-29,
cookbook:16-24 (character only)}; GM (getGmSeat) campaigns/[id]/characters/[actor]/{table, rolls,
rolls/[roll], texts/[hash]}; 8 companion routes through 4 near-identical helpers
companion-routes.ts:33,49,65,83; 2 GM party routes (literal PartySeat); `notesSeat`
notes-routes.ts:73-144 for 20 handlers. Exact differences: (a) characters texts/[hash] answers 401
and both 404s with no headers and checks TEXT_HASH before getCharacter; (b) campaigns texts/[hash]
401 no headers, 404 no-store, hash checked later in textResponse; (c) companion texts check
TEXT_HASH between 401 and the seat; (d) the rest 401/404 no-store; (e) notesSeat's player branch
404s a character with no campaignId/actorId; (f) GM party routes look nothing up (access() checks
ownership). Home: `src/lib/routes/seat-resolver.ts` (S.4).

**D2 Command pipeline (Q1)**: effects.ts:32-119, favorites.ts:35-123, removals.ts:30-125,
wild-shape.ts:39-130, transfers.ts:43-171, and the tail of roll-requests.ts:142-455. Ladder: ids +
payload → 409 `unavailable`; player-only (effect, favorite, wildShape) GM → 409;
`campaign.findUnique({select:{<switch>, bridgePolledAt, characters}})` (transfer + `transferFeatures,
groups`) → 409; [transfer: `among` without `distribute` → 409]; `Promise.all([count {madeBy,
onItsWay}, count {madeBy, createdAt > ago(60 000)}])` → 429 `busy`; roster `Array.isArray` + `some`
→ 422 `unknown` [transfer: `checkEnds`]; `Promise.all([sheet, waiting])` (waiting kind `'effect'`,
`'favorite'`, `'wildShape'` (`Promise.resolve([])` for op `forms`), remove/transfer `{in:
['transfer','remove']}` with `select {kind, payload}`; transfer's sheet is groupSheet or actorSheet
of `transfer.from`), all `take: ROLLS_IN_FLIGHT`; check → 422; clash → 409 `moving`; strip (label
dropped for effect/favorite/wildShape by spread + `delete`, kept for GM on remove/transfer by `{label,
...command}`; `typed`, `rerolls` deleted); `rollRequest.create` (same data keys); `deleteMany`
older than ROLLS_KEPT_FOR. The roll path repeats the counts (roll-requests.ts:284-307, an inline
`onItsWay`, plus `asks` :337), create (:432), prune (:450). Home: `src/db/commands.ts` (S.1, S.2).

**D3 Kind table and switches (Q1, server side)**: the five command kinds by hand at
roll-requests.ts:154 (refused at a companion), :167 (wait while shaped: four), :168-172 (dispatch),
:572-578 (withheld per switch), :581 (`notOwn`); campaign-events.ts:155-162 (out of rollKinds); W's
COMPANION_UNTAKEN, GM_UNSENT. The 8 bridge switches by hand: markBridgePolled :706-744 (type,
select, return), commands route :173-182, table.ts:245 and :426 (selects). `*Available` ×5,
identical but the field (transfers.ts:35, removals.ts:26, favorite-commands.ts:16,
effect-commands.ts:16, wild-shape.ts:36). Hello's `enabled === true && kinds.includes(x)` ×7
(campaign-events.ts:125, 130, 213, 218, 233, 238, 243). Home: `src/constants/features.ts` +
`src/utils/features.ts` (S.3).

**D4 Body readers (5)**: seat-routes.ts:121-135 (type, case-sensitive → 415 bare; no declared
check; > 16 384 → 413 bare; parse + schema → 400 bare); notes-routes.ts:178-192 (415 bare; no
declared check; > MAX_NOTE_BYTES → 413 `{reason:'invalid'}`; parse → 400 same); cookbook-routes.ts:
155-170 (type lower-cased → 415 NOT_JSON; declared → 413; read → 413; parse with `cleanText` → 400
NOT_READ); events/route.ts:99-112 (no type check; declared → 413; read → 413; parse + schema → 400);
commands/route.ts:113-128 (as events, 4096, + no-store). Home: `src/lib/routes/body.ts` (S.6).

**D5 Answers**: no-store const in 25 files, `bare()` 2× + ~40 inline `new Response(undefined,
{status, headers})`; text answers 3× (seat-routes.ts:165-177, companion-routes.ts:141-155,
party-routes.ts:67-83); "unchanged since seen" → 204 5× (seat-routes.ts:80-94,
companion-routes.ts:115-129, party-routes.ts:46-53, notes-routes.ts:161-171, cookbook-routes.ts:250);
presence `noting(notePlayersSeen)` 4× (seat-routes.ts:52, companion-routes.ts:109,
party-routes.ts:40, notes-routes.ts:156; messages "…at the table" 3×, "…at their notes" 1×). Home:
`src/lib/routes/http.ts` (S.5).

**D6 Others**: once-per-N throttles 3× (roll-requests.ts:748-756, :773-781, cookbook.ts:223-241);
Foundry-id regex 3×; `Tx` 3×; test helper `const ago = (ms) => new Date(NOW - ms)` in 10 db suites.

## (4) Target shape (behaviour-preserving)

```
src/constants/features.ts     + COMMAND_SWITCHES, COMMAND_KINDS, SHAPED_KINDS, GM_TAKEN_KINDS, BRIDGE_SWITCHES, FEATURES, ANSWERED_WITH_FEATURES
src/utils/features.ts         + switchOn(campaign, field, now)   (the 5 *Available stay as one-liners)
src/utils/hello-features.ts   + helloCampaignData(), HELLO_ROLL_FLAGS (pure, .test.ts beside it)
src/db/types.ts | constants.ts| commands.ts   + types (Tx…); FOUNDRY_ID; ago, madeBy, onItsWay, seatBusy, inRoster, commandPayload, holdCommand, createCommand, due
src/lib/routes/               → seat-routes, companion-routes, party-routes, notes-routes, cookbook-routes, bridge-http (+ their tests)
src/lib/routes/{seat-resolver,http,body,types}.ts   +
src/lib/attempt.ts            → attempt() (db/campaigns and the routes import it); src/lib/types.ts + SessionUser
```

**S.1 Db cycle gone.** `ago, madeBy, onItsWay` → `src/db/commands.ts`, `RollSeat, RollRejection` →
`src/db/types.ts`; importers (the 5 creators, roll-requests, companions.ts:29, companion-routes.ts:9,
seat-routes) rewritten. No test imports or mocks them: no shim. Then cycles.py shows 0 runtime SCCs.
Pins: the 6 db suites (they assert every prisma arg), route suites. Risk low. 0.5 h.

**S.2 One command pipeline.** commands.ts: `seatBusy(seat, now)` (same where objects and
Promise.all order), `inRoster`, `commandPayload(input, seat, keepGmLabel)` (spread then delete: key
order kept), `holdCommand(seat, kind, payload, now, extra?)`, and `createCommand(seat, input, spec)`
for effect, favorite, wildShape, remove (`spec: kind, field, playerOnly, switchField, available,
waiting {kinds, select, skip?}, check, clashes, keepGmLabel`). Transfer keeps its gates and uses
seatBusy/holdCommand. Steps: helpers, then one creator at a time (effect, favorite, wildShape,
remove, transfer), L0 each. Pins: creator suites (e.g. effects.test.ts:162-205 pin select,
findMany, create, deleteMany), roll-requests.test; e2e favorites, favoriting, effects, wildshape,
removals, transfers, givetake. Risk medium (ladder order, the `forms` skip). 2.5 h.

**S.3 One kind table, the switches.** `COMMAND_SWITCHES = {transfer:'transfersEnabled',
remove:'removalsEnabled', favorite:'favoritesEnabled', effect:'effectsEnabled',
wildShape:'wildShapeEnabled'}` (its key order is the `withheld`/`notOwn` order roll-requests.test
pins), `BRIDGE_SWITCHES` (markBridgePolled's 8, in order). Rewrite roll-requests.ts:152-172
(dispatch via a local `{kind: creator}` map), :562-582, :706-744; commands route :173-182;
campaign-events.ts:155-162; `*Available` bodies → `switchOn` (names kept: 40+ suites and table.ts
call them). Pins: roll-requests.test (claim where), commands route test, campaign-events.test,
table.test; e2e all lanes. Risk low-medium (array orders). 1.25 h. Phase 4 (F): W derives
COMPANION_UNTAKEN/GM_UNSENT's command part from it.

**S.4 One seat resolver.** seat-resolver.ts: `playerAt(userId, characterId)`, `gmAt`,
`companionAt(seat, key)`, `companionRollAt`, `partyAt(userId, address)`, and `seatAnswer(params,
find, answer, {headers})` (getCurrentUser → 401, then `await params` as today, find → 404, else
answer). It keeps calling the mocked paths: `@/lib/session` getCurrentUser, `@/db/characters`
getCharacter, `@/db/seats` getGmSeat/playerSeat, `@/db/companions` companionSeat/companionRollSeat,
`@/db/party` partySeat. The 4 companion-routes helpers go. The two texts/[hash] routes keep their
header quirks visibly (D1 a, b; bug 3), companion texts their hash check. `notesSeat` sits on
playerAt/gmAt with its stricter player check (D1 e). Route files stay `export async function GET(…,
context: RouteContext<'…'>)` (typegen, gate 6), 5-10 lines. Pins: the 34 route suites (401/404
status and headers, bad hash), notes-routes.test, companion-routes.test; e2e gm, companions, notes,
partynotes, party, sheet. Risk medium (per-route headers). 2 h.

**S.5 NO_STORE and the answers.** http.ts: `NO_STORE`, `bare(status, headers = NO_STORE)`,
`textAnswer(html)`, `seenAs(known, current)` (number `Number(get) === v`, boolean `(get === '1') ===
v`, string `(get ?? '') === v`, optional `(get ?? undefined) === v`; each poller passes its keys
in today's order), `notePresent(campaignId, failed)`; notePlayersSeen stays in roll-requests (29
suites mock it there). Pins: route suites' 204 cases, notes-routes.test, cookbook route test. Low.
1.25 h.

**S.6 One body reader.** body.ts `readBody(request, {limit, type?: 'exact'|'lower', declared?,
reviver?})` → `{ok, text, value}` or `{ok:false, why:'type'|'size'|'json'}`; each caller maps `why`
to today's answer; schemas stay with callers. Pins: rolls (415/413/400), notes, dishes (code before
body), events and commands (declared vs read 413) suites. Low. 1 h.

**S.7 Result router.** `recordCommandResult` (roll-requests.ts:634, mocked by the events suite)
stays the entry and routes: `dish-` → recordDishResult; else `recordRollResult` (today's body,
split into `markGmMessages`, `closeAnsweredPrompt`, version bump); none matched → recordNoteResult.
Same writes, same order. Pins: roll-requests, cookbook, note-sync, events suites. Low. 0.5 h.

**S.8 Event table, hello split.** campaign-events `apply` :106-433: the hello case →
`applyHello(tx, campaignId, event, sentAt)` (writes in today's order); its campaign data → pure
`helloCampaignData(data, sentAt)` with `HELLO_ROLL_FLAGS` in stored order (modifiers, prompts,
areaAttacks, activityChecks, signedDice, selfTargets, gmRolls, gmRollMessages, manualDice,
midiPrompts, aloneChoices, companionPrompts, effectDice, keptRerolls: not ROLL_FEATURES, which lacks
two) and `kindOn(feature, kind)` for the 7 switches; the other cases → `EVENT_HANDLERS` keyed by
type; `VERSION_SILENT` for :90. Pins: campaign-events {,.groups,.settings} suites (assert
`campaign.update` data), events suite; every e2e lane opens with a hello. Medium (stored array
orders, `foundry` JSON). 2 h.

**S.9 Roll path in stages.** createRollRequest → `rollGate` (pure, the 409/422 gates :175-229),
`readRollContext` (the 11 reads, same Promise.all order and args), `rollRefusal` (:371-401),
`rollPayload` (:408-430), holdCommand. In roll-requests.ts (pure stages may join W's
utils/roll-requests in Phase 4). Pins: roll-requests.test (5 247 lines), rolls suites; e2e rolling,
rolls, typed, manualdice, gmroll, alone, prompts, companionsaves, endturn, attacks, activities,
links. Medium-high (hottest path). 2 h.

**S.10 Module routes under 15.** events POST → local `pingAnswer`, `takeEvent` (:178-211),
`eventAnswer` (resend/announce); FEATURES, ANSWERED_WITH_FEATURES → features.ts (key order kept).
commands POST → local `holdForCommands`, `claimAll`. Route files export only methods, OPTIONS and
`maxDuration` (Next.js rule; gate 6). Pins: events (1 178 lines) and commands (810) suites; e2e
all. Low-medium. 1 h.

**S.11 Remaining complexity.** Extract-function only: `getTableView` (`seatSwitches` shared with
getCampaignStatus, the view ANDs `connected`; `tableMessagesOf`), `getCompanionView`,
`getGroupView`, `findEventCampaign`, `linkWalk`, `enrichMarkdown`, note-sync's two, table-view's
six, transfers' two, `checkWildShape`, slim-sheet `expand` (by row kind), **db/notes.ts last**.
Pins: each file's suite (tests-per-file.txt), table-view's 42 suites, notes.test (3 068),
note-sync.test (1 720). Medium for notes and slim-sheet. 3.5 h.

**S.12 Types and constants.** Exported types → `src/db/types.ts`, `src/lib/routes/types.ts`,
`src/lib/types.ts`; `Tx` once; the three util `*Refusal` un-exported; `FOUNDRY_ID`
(src/db/constants.ts). SocialProviderId, PromptData/HeldPrompt need src/types (W): Phase 4. Pins:
tsc. Low. 0.75 h.

**S.13 Layering (moves for WS3).** `git mv` the five responders and bridge-http to `src/lib/routes/`
with their suites; `attempt` → `src/lib/attempt.ts` (its cases move out of bridge-http.test
verbatim); then lint: `src/db` imports neither `src/lib/routes` nor `src/app`; `src/lib/routes`
only from `src/app/api`. No suite mocks a moved path. Delete db/companions.ts:48. Low. 0.25 h.

**S.14 Small shared.** `due(map, key, every, now)` for the 3 throttles (set before the write, as
now); FOUNDRY_ID in seats, roll-requests, party. Pins: roll-requests, cookbook suites (fake time).
Low. 0.5 h.

≈ 19 h for one builder. Commits: 7 = S.1, S.2, S.3, S.6, S.14; 8 = S.4, S.5, S.7, S.12; 9 = S.8,
S.9, S.10, S.11.

## (5) Contract surface and goldens

Byte-identical: the 41 route paths and their exports (`maxDuration = 30`); statuses per case and
their order (module/cookbook: auth before body; 401 before 404; seat bodies 415 → 413 → 400);
headers: no-store on seat, notes, cookbook and commands answers (but the texts quirks), `private,
max-age=86400` on texts 200, CORS on events and commands (origin echo or `*`, `POST, OPTIONS`,
`Content-Type, Authorization`, `600`, `Vary: Origin`, private-network on ask), cookbook no CORS and
`Retry-After` 60/3600. Bodies with key order: refusals `{reason, message, limit?, protocol?, type?,
detail?}` (detail cut 1000; recorded `${type}: ${2 lines}` cut 300; title cut 200); `{commands,
open}` / `{commands, wait, open}`; `{resend?, features?}` with FEATURES' 15 keys in order; roll
`{id}` 202 / `{reason}`; notes `{id?, stamp}` / `{reason, field?, lines?}`; cookbook `{reason,
message, limit?, field?}`, `{id, status}` 200/202, view `{version, ...view}` with version =
sha256(JSON.stringify(view)).slice(0, 12) (the view's key order is in the hash); messages with
their curly quotes. Query keys `version, live, rolls, gm, gmrolls, moves, typed, removes,
favorites, effects, wildshape, sheet`, notes `stamp` ≤ 80. Stored rows: RollRequest data and payload
per kind, prune; hello's campaign update (rollKinds, rollFeatures order, transferFeatures,
noteFeatures, dishVersions, companions, `foundry`), version bumps, helloSession, refusal columns,
claim writes. Server Actions: 15 names, form states, messages, redirects, `refresh()`.

Goldens (WS2): **G-S1 route matrix** (`src/__tests__/server-routes.golden.test.ts`): each route ×
method × {signed out, not theirs, bad hash, unchanged} → `{status, sorted headers, body text}`;
**G-S2 module wire**: events and commands for no secret, not Forge, declared/undeclared oversize,
bad envelope, protocol, ping ok/unknown/refused, malformed (body + recordRefusal args),
hello/heartbeat answer text, texts 204, OPTIONS ± private network; commands off, cold, held,
aborted, open changed; **G-S3 command storage**: per kind (roll typed + effectDice + kept rerolls,
GM roll with label, transfer GM label, remove, favorite, effect, wildShape change and `forms`) the
ordered prisma calls `[model.method, args]` as JSON, and each ladder's first refusal; **G-S4 hello
storage**: `campaign.update` data JSON for a full 0.42 hello and a pre-0.10 one; **G-S5 cookbook**:
the dish ladder and the view version of a fixed view.

## (6) Seams

(a) W: COMPANION_UNTAKEN/GM_UNSENT from COMMAND_KINDS (Phase 4); (b) W: src/types homes for
SocialProviderId, PromptData, HeldPrompt (Phase 4; auth-providers re-exports the type until then,
`v0.43-shim`); (c) V2: sign-in-buttons.tsx, login page import SocialProviderId from its new home
(Phase 4); (d) V2 pages (characters/[id], campaigns/[id]/characters/[actor], both party pages)
repeat session → seat with requireUser/notFound: may adopt `playerAt/gmAt` (Phase 4, optional);
(e) T: guardNoDb in the 34 route suites and the kit helpers of §7. Every name other areas import
from S stays at its path: no shim needed beyond (b).

## (7) Tests

79 suites: 34 route, 9 lib, 24 db, 10 utils, 2 actions, 1 auth-providers; all colocated, moving
with their files (S.13: notes-routes, companion-routes, bridge-http suites → src/lib/routes/).
`campaigns/[id]/characters/[actor]/routes.test.ts` covers four routes: an integration suite →
`…/[actor]/__tests__/gm-seat-routes.integration.test.ts` (private folder; WS3). `jest.mock` paths
that move: none. Must keep their names at their paths: `@/db/roll-requests` (29 suites:
notePlayersSeen, noteTableOpen, createRollRequest, getRollRequestView, recordCommandResult,
claimRollRequests, markBridgePolled, openActorIds), `@/db/characters` (33), `@/lib/session` (47),
`@/db/seats` (19), `@/db/party` (19), `@/db/notes` (17), `@/db/{table,cookbook,campaigns}`.
Duplicated helpers for T's kit: signed-out `mockResolvedValue(undefined)` with a
no-useless-undefined disable (32 suites, 62 lines), `{ id: 'user-1' } as any` (20), NextRequest +
`params: Promise.resolve()` builders (34), `ago` (10 db suites), `expectRefusal` (2). Overlap:
the 12 notes route suites re-test notes-routes.test (keep: they pin each address's wiring); the 5
creator suites share busy/roster/switch cases (G-S3 covers the ladder after S.2).

## (8) Bugs (logged in bugs-found.md under [S]: 5)

1. campaigns.ts:437 via events/route.ts:127: a `bridge.ping` binds the campaign, against
PROTOCOL.md:1513 "Store nothing"; a Test typed with another campaign's title and secret binds the
wrong module id and the real campaign's events are then refused 404.
2. seat-routes.ts:126, notes-routes.ts:183: bodies read whole before the size check, no declared
Content-Length check (the other three readers have one).
3. (to confirm) the two texts/[hash] routes answer 401/404 with no Cache-Control, unlike siblings.
4. (to confirm) app-origin.ts:9 takes a comma list in `x-forwarded-host` whole.
5. (low) roll-requests.ts:748,773, cookbook.ts:223: throttle Maps never pruned.

## (9) Out of scope and risks

Two-copy merges (Q1 excludes): the module gate of events and commands (secret, Forge origin,
size, campaign lookup and their closures); `noting` vs `attempt`; `GAMEMASTER` (notes-routes.ts:54,
notes.ts:100); status vs view switch flags (only via S.11 for complexity); companion status/view
mirroring the table's. Q1's excluded extras: none on the server.

Efficiency, report only: a non-204 table poll reads the campaign and the GM rolls twice
(getCampaignStatus, getTableView); a party poll reads the campaign 3× (access ×2, roster
party.ts:299); a GM companion route 2× (getGmSeat, companionSeat); each claim pass of a held
commands fetch (~1/s for 20 s) reads the campaign 3× (claimDishes, claimNoteWrites,
claimRollRequests) and runs 2 `deleteMany` (note-sync.ts:442-443); every event post and commands
fetch pays one scrypt (N=16 384). Indexes: every hot filter has an index prefix (RollRequest
`(campaignId, actorId, role, createdAt)`, `(characterId, createdAt)`, `(campaignId, status,
createdAt)`; Character `(campaignId, actorId)`; Campaign `(origin, foundryId)`; RollPrompt
`(campaignId, actorId, closedAt)`; journal and dish `(campaignId, status, queuedAt)`); the
prompt-answer read filters `payload` by JSON path within `(campaignId, actorId)`: no missing index.

Risks: S.2 and S.9 touch every command and roll (suites pin prisma args, so drift fails loudly);
S.8 rebuilds stored arrays (G-S4 first); S.4's per-route headers (G-S1 first); mocked names must
stay at their paths or 29+33+47 suites silently reach prismaMock (guardNoDb catches it); Next.js
route files export only methods and segment config; slim-sheet `expand` (≈115) is the largest
single complexity job and its only importer is W's schema.
