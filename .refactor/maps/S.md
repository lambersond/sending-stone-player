# Map S: the server (v0.43 re-plan, 2026-11-03)

Area: `src/app/api/**` (41 route files), `src/app/{characters,campaigns}/actions.ts`, `src/lib/**`,
`src/db/**`, `src/clients/**`, `src/auth.ts`, `src/auth-providers.ts`, and the server-side utils
(`table-view, transfers, removals, favorite-commands, effect-commands, wild-shape, prompts,
companions, slim-sheet, literal-pattern`). 88 product files, 79 test files. Read-only survey of
24f808b+; nothing in src/ edited. Scripts and outputs: `.refactor/analysis/S/` (graph.cjs → edges in
the scratchpad, inventory.cjs → inventory.tsv, cycles.py → cycles-value.txt, complexity.cjs →
complexity.txt, eslint-disables*.txt, tests-per-file.txt, layer-edges.txt, exported/local-types.txt).
Line numbers are per file at 24f808b.

## (1) Inventory (full rows: analysis/S/inventory.tsv)

Server-only utils by real importers: only `companions, transfers, effect-commands, literal-pattern`
are imported by server code alone. The others the first plan gave S have client importers too
(names stay, so no shim): `table-view` (chat-log.tsx `askTitle`; utils/roll-requests `damageKinds,
healingRolls, toTableRoll`; 40 client tests), `wild-shape` (`articled` in use-picker, character-sheet,
companion-ask-notice; wild-shape.tsx; utils/roll-requests `isShaped`; wild-shape-words),
`favorite-commands` (favoriting.tsx `isFavorite, targetKey`), `removals` (remove-controls.tsx
`relatedItems`), `prompts` (use-waiting-prompts `shownPrompts, waitingPrompts`), `slim-sheet`
(schemas/sending-stone `expandSheet`, W's).

| file | lines | exports | importers outside S (non-test) |
|---|---|---|---|
| lib/session.ts | 34 | getCurrentUser, requireUser, type SessionUser | 10 pages/layout + header-account.tsx; mocked by 47 suites (10 outside) |
| lib/seat-routes.ts | 178 | tableResponse, noting, rollPostResponse, rollGetResponse, textResponse | — (routes only) |
| lib/companion-routes.ts | 156 | player/gm CompanionSeat, player/gm CompanionRollSeat, companionTableResponse, companionTextResponse | — |
| lib/party-routes.ts | 84 | partyResponse, partyTextResponse | — |
| lib/notes-routes.ts | 330 | notesSeat, notesResponse, notesPost/Patch/Delete/Order/OrderResolve/PreviewResponse, types NotesPlace, NotesAddress | — |
| lib/cookbook-routes.ts | 253 | dishPostResponse, cookbookViewResponse | — |
| lib/bridge-http.ts | 78 | cors, refuse, attempt, notSetUp, type Refusal | — (db/campaigns imports `attempt`) |
| lib/campaign-secret.ts | 70 | generateSecret, generateInviteCode, hashSecret, verifySecret, bearerSecret | campaigns/page.tsx |
| lib/cookbook-code.ts, app-origin.ts | 22, 15 | generate/hash/isCookbookCode; appOrigin | campaigns/page.tsx (appOrigin) |
| lib/sheet-html.ts, note-html.ts, note-markdown.ts | 259, 133, 198 | sanitizers, sheetLinks, enrichMarkdown… | — (db imports them) |
| db/roll-requests.ts | 828 | createRollRequest, getRollRequestView, claimRollRequests, recordCommandResult, markBridgePolled, notePlayersSeen, noteTableOpen, openActorIds, madeBy, ago, types RollSeat, RollRejection | mocked by 29 suites |
| db/effects, favorites, removals, wild-shape, transfers | 120, 124, 126, 164, 199 | create{Effect,Favorite,Remove,WildShape,Transfer}Request; shapedRefusal; onItsWay | party page imports `shapedRefusal` |
| db/table.ts | 631 | getCampaignStatus, getTableView, seatRolls, gmRollsOf, gmRollsKey, healingUses, heldPrompts, companionAsks, withheld, rollsSelect, gmRollStateSelect, MESSAGE_LIMIT, type CampaignStatus | 2 pages |
| db/companions.ts | 419 | companionSeat, companionRollSeat, getCompanionStatus, getCompanionView, getCompanionText, type CompanionStatus, re-export companionRoster (unused) | — |
| db/party.ts | 444 | partySeat, groupRoster, tableGroups, tableMoves, allowedGroup, partyNotesAccess, getPartyStatus, getGroupView, type PartySeat | 2 party pages |
| db/seats.ts | 65 | playerSeat, getGmSeat | 3 pages |
| db/characters.ts | 181 | list/get/join/choose/deleteCharacter, markChatRead, setCharacterManualDice, type ChoiceProblem | 3 pages; mocked by 33 |
| db/campaigns.ts | 633 | isLive, listOwnedCampaigns, setUp/remove…, findEventCampaign, recordRefusal, checkGameSecret, markSeen, findInvite, getCampaignChoice, type EventCampaign | 3 pages |
| db/campaign-events.ts | 883 | applyCampaignEvent, closePrompt, sortTurnOrder | — |
| db/cookbook.ts | 501 | 10 fns, 5 types | — |
| db/notes.ts, note-sync.ts | 1592, 895 | notes CRUD/views (14), sync (11) | mocks/sending-stone.ts imports note-sync |
| db/sheet-texts.ts | 154 | save/keepOnly/lacks/getSheetText, getGroupText | — |
| app/characters/actions.ts | 142 | 9 Server Actions | 3 pages bind them (mocked by their tests) |
| app/campaigns/actions.ts | 114 | 6 Server Actions | campaigns/page.tsx |
| auth.ts, auth-providers.ts, clients/{prisma,auth-client}.ts | 17, 28, 19, 4 | auth; socialProviders, enabledSocialProviders, type SocialProviderId; prisma; authClient | login page; sign-in-buttons.tsx (type only); sign-in/out buttons |
| app/api/** | 1721 total | GET/POST/PUT/PATCH/DELETE/OPTIONS; `maxDuration` (bridge/commands) | — |

Routes: 21 seat routes (`characters/[id]/{table,rolls,rolls/[roll],texts/[hash],cookbook,party/[group],
party/[group]/texts/[hash]}`, `campaigns/[id]/characters/[actor]/{table,rolls,rolls/[roll],texts/[hash]}`,
8 companion routes, `campaigns/[id]/party/[group]{,/texts/[hash]}`), 12 notes route files (20
handlers), `events`, `bridge/commands`, `cookbook/dishes`, `auth/[...all]`.

## (2) CLAUDE.md, rule by rule

**§2 (.tsx)**: no .tsx in the area. **§5**: both actions.ts are `'use server'`, call `requireUser`
first; no client module imports server code (sign-in-buttons.tsx imports only the type
`SocialProviderId`). Routes are thin except `events` (POST 177 lines) and `bridge/commands` (177).

**§3 types**: exported named types in non-types.ts files (31, none imported outside the area):
db/roll-requests `RollSeat, RollRejection`; db/table `CampaignStatus`; db/companions `CompanionStatus`;
db/party `PartySeat`; db/notes `NotesSeat, NotesBook, NoteAnswer, NoteRights`; db/note-sync
`NotePageCommand, NoteOrderCommand, NoteCommand, JournalDrawings`; db/cookbook `CookbookLinkFound,
DishAccepted, CookbookLinkProblem, DishDecision, CookbookSeat`; db/campaigns `EventCampaign`;
db/characters `ChoiceProblem`; lib/bridge-http `Refusal`; lib/notes-routes `NotesPlace, NotesAddress`;
lib/session `SessionUser`; auth-providers `SocialProviderId`; utils/prompts `PromptData, HeldPrompt`;
utils/table-view `Viewer, LinkedMessages`; utils/{removals,transfers,wild-shape} `*Refusal` (used only
in-file: drop `export`). Local types: 25 (analysis/S/local-types.txt); `type Tx =
Prisma.TransactionClient` is declared 3× (campaign-events.ts:42, note-sync.ts:31, sheet-texts.ts:12).
**Shared constants**: the Foundry-id regex 3× (seats.ts:12 `ACTOR_ID`, roll-requests.ts:800 `ACTOR_ID`,
party.ts:24 `GROUP_ID`, all `[A-Za-z0-9]{1,64}`); `{ 'Cache-Control': 'no-store' }` declared in 25
files; `'private, max-age=86400'` 3×. **Business rules in routes**: events/route.ts:113-232
(protocol, ping, event routing, resend/announce rule, FEATURES table at :254 and
ANSWERED_WITH_FEATURES at :278 are domain config in a route file); bridge/commands/route.ts:173-227
(switch check, claim order, hold loop). **Hooks**: n/a.

**§4 placement** (lowest common ancestor by real importers): `src/db/` stays the server-only data
layer (CLAUDE.md's suggested `db/`). The route responders (`lib/*-routes.ts`) are imported only by
`src/app/api/**` → see S.13. The pure server utils stay in `src/utils/` (client importers above make
`src/` their LCA). New files: `src/db/commands.ts`, `src/db/types.ts`, `src/db/constants.ts`,
`src/lib/routes/{seat-resolver,http,body}.ts`, `src/constants/features.ts`,
`src/utils/{features,hello-features}.ts`.

**§7 cycles/barrels**: one runtime cycle, 6 files: roll-requests → {effects, favorites, removals,
transfers, wild-shape} (dispatch, :18-23) and each of those → roll-requests (`ago, madeBy,
RollRejection`) and → transfers (`onItsWay`); transfers → roll-requests. No index.ts in the area.
One re-export: db/companions.ts:47 `export { companionRoster } from '@/utils/companions'`, unused →
delete. `utils/wild-shape.ts` sits in the 12-file type-only cycle through src/types (W's edges).
Layering: lib mixes responders (import db) with helpers db imports (`db/campaigns → lib/bridge-http
attempt`, `db/* → lib/{sheet-html,note-html,note-markdown,campaign-secret,cookbook-code}`;
analysis/S/layer-edges.txt): a "layered imports" rule can't be written for `src/lib` as is (S.13).

**§9 eslint-disable** (analysis/S/eslint-disables*.txt): 159 in the area. Product: 31 = 29
`unicorn/no-null` (7 file-scope: campaigns.ts:82, cookbook.ts:1, note-sync.ts:1, notes.ts:1,
slim-sheet.ts:1, table-view.ts:555 and :1162 (block disables mid-file); 22 line, 6 with no reason:
campaigns.ts:389,391,408,410, roll-requests.ts:763,790), 1 `camelcase` (note-sync.ts:700, reason),
1 `unicorn/prefer-structured-clone` (slim-sheet.ts:222, reason "as above"). Tests: 128 = 60 no-null
(55 file-scope), 62 `unicorn/no-useless-undefined` (20 without a reason, all
`mockResolvedValue(undefined)` for signed-out/not-found), 6 `camelcase` (note-sync.test.ts). **Under
Q2 all 89 no-null go** (all 62 file-scope ones among them). Left: 62 no-useless-undefined (line;
20 need a reason, or T's kit helper `signedOut()` removes ~40 of them in setup lines), 7 camelcase,
1 structured-clone: 70, all line-level.

**§9 complexity > 15** (rough, analysis/S/complexity.txt; WS0's sonarjs counts rule): slim-sheet
`expand` :219 ≈115; campaign-events `apply` :106 ≈88; roll-requests `createRollRequest` :142 ≈67;
events `POST` :56 ≈41; table `getTableView` :408 ≈39; commands `POST` :52 ≈35; note-sync
`recordNoteResult` :712 ≈34; table-view `messageLabel` :892 ≈33; notes `overlay` :363 ≈32, `viewOf`
:684 ≈29, `fits` :892 ≈27, `changeNote` :1078 ≈20, `deleteNote` :1248 ≈18, `reorderNotes` :1429
≈16; note-sync `applyJournalUpdated` :272 ≈27; wild-shape `checkWildShape` :97 ≈27; campaigns
`findEventCampaign` :359 ≈25; transfers `checkEnds` :63 ≈24, `checkHoldings` :150 ≈19; party
`getGroupView` :276 ≈22; sheet-html `linkWalk` :154 ≈22; companions `getCompanionView` :241 ≈21;
db/transfers `createTransferRequest` :43 ≈21; table-view `toTableMessage` :156 ≈19, `targetsOf`
:764 ≈18, `toTableSheet` :1089 ≈18, `tableAsk` :244 ≈17, `sideOf` :62 ≈16; roll-requests
`claimRollRequests` :538 ≈18, `recordCommandResult` :634 ≈17; note-markdown `enrichMarkdown` :136
≈18; db/removals `createRemoveRequest` :30 ≈16. 32 functions.

## (3) Duplication (3+ copies, Q1 scope)

**D1 Seat resolver** (Q1). session → 401 → lookup → 404 → seat, written out in 21 route files:
player sheet (getCharacter + playerSeat): characters/[id]/{table:19-26, rolls:20-27,
rolls/[roll]:14-21, texts/[hash]:17-25, party/[group]:20-31 (+partySeat), party/[group]/texts:18-29
(+partySeat), cookbook:16-24 (character, no seat)}; GM sheet (getGmSeat): campaigns/…/[actor]/{table,
rolls, rolls/[roll], texts/[hash]}; companions ×8 via the 4 near-identical helpers
companion-routes.ts:33,49,65,83 (getCharacter|getGmSeat then companionSeat|companionRollSeat); GM
party ×2 (literal PartySeat); and `notesSeat` notes-routes.ts:73-144 (4 address kinds) used by 20
handlers. Differences, exact: (a) texts/[hash] (player) answers 401 and both 404s with **no
headers**, checks TEXT_HASH before getCharacter; (b) campaigns texts/[hash] answers 401 with no
headers, 404 no-store, no early hash check (textResponse checks it); (c) companion texts check
TEXT_HASH after 401, before the seat; (d) all others 401/404 no-store; (e) notesSeat's player branch
404s a character without campaignId/actorId (sheet routes don't); (f) GM party routes do no lookup
(access() checks ownership later). Home: `src/lib/routes/seat-resolver.ts` (S.4).

**D2 Command pipeline** (Q1). effects.ts:32-119, favorites.ts:35-123, removals.ts:30-125,
wild-shape.ts:39-130, transfers.ts:43-171, plus the shared tail of roll-requests.ts:142-455. Common
ladder: guard ids+payload → 409 `unavailable`; [player-only: effect, favorite, wildShape] gm → 409;
`campaign.findUnique({select:{<switch>, bridgePolledAt, characters}})` (transfer adds
`transferFeatures, groups`) → !available → 409; [transfer: `among` without `distribute` → 409];
`Promise.all([count {madeBy, onItsWay}, count {madeBy, createdAt > ago(60 s)}])` → 429 `busy`;
roster `Array.isArray(characters)…some(id === actorId)` → 422 `unknown` [transfer: `checkEnds`
instead]; `Promise.all([sheet, waiting findMany {madeBy, kind, onItsWay}, take ROLLS_IN_FLIGHT])`
(waiting kind: effect `'effect'`, favorite `'favorite'`, wildShape `'wildShape'` and skipped as
`Promise.resolve([])` for op `forms`, remove and transfer `{in:['transfer','remove']}` with
`select {kind, payload}`; transfer reads groupSheet or actorSheet by `transfer.from`); kind check →
422; clash → 409 `moving`; strip (`label` always dropped for effect/favorite/wildShape via
`{...input}` + `delete`; kept for GM on remove/transfer via `{label, ...command}`; `typed` and
`rerolls` always deleted); `rollRequest.create({data:{campaignId, characterId, role,
requestedById, actorId, kind, [label], payload, createdAt}, select:{id}})`; `deleteMany {madeBy,
createdAt < ago(ROLLS_KEPT_FOR)}`. The roll path repeats the busy counts (roll-requests.ts:269-292,
inline copy of `onItsWay`, plus `asks`), the create (:432) and the prune (:450). Home:
`src/db/commands.ts` (S.1, S.2).

**D3 Request-kind lists / feature switches** (Q1 "one request-kind table", server side). The five
command kinds listed by hand: roll-requests.ts:154 (refused at a companion), :167 (wait while shaped:
four), :168-172 (dispatch), :572-578 (withheld per switch), :581 (`notOwn`); campaign-events.ts:155-162
(excluded from rollKinds); constants COMPANION_UNTAKEN, utils/roll-requests GM_UNSENT (W's). The
eight switches by hand: markBridgePolled roll-requests.ts:706-744 (type, select, return),
bridge/commands/route.ts:173-182, table.ts:243-247 and :424-428 (selects); `*Available` ×5 identical
but for the field (transfers.ts:35, removals.ts:26, favorite-commands.ts:16, effect-commands.ts:16,
wild-shape.ts:36); hello's `enabled && kinds.includes(x)` ×7 (campaign-events.ts:126, 131, 213,
218, 228, 237, 243). Home: `src/constants/features.ts` + `src/utils/features.ts` (S.3).

**D4 Body readers** (5): seat-routes.ts:121-135 (type case-sensitive → 415 bare; no declared
check; > 16 384 → 413 bare; parse+schema → 400 bare); notes-routes.ts:178-192 (type → 415 bare; no
declared check; > MAX_NOTE_BYTES → 413 `{reason:'invalid'}`; parse → 400 `{reason:'invalid'}`);
cookbook-routes.ts:155-170 (type lower-cased → 415 NOT_JSON; declared > MAX_DISH_BYTES → 413; read
→ 413; parse with reviver `cleanText` → 400 NOT_READ); events/route.ts:99-112 (no type check;
declared → 413; read → 413; parse+schema → 400 BAD_ENVELOPE); bridge/commands/route.ts:113-128 (as
events, 4096, no-store added). Home: `src/lib/routes/body.ts` returning `{value} | {why: 'type' |
'size' | 'json'}`; each caller maps `why` to its own answer (S.6).

**D5 Answers** (3+): `const headers = {'Cache-Control':'no-store'}` in 25 files and `bare(status)` in
notes-routes.ts:66, cookbook-routes.ts:230 and ~40 inline `new Response(undefined, {status,
headers})`; text answers ×3 (seat-routes.ts:165-177, companion-routes.ts:141-155,
party-routes.ts:67-83: 404 no-store or `{html}` private max-age=86400); "unchanged since seen" → 204
×5 (seat-routes.ts:80-94, companion-routes.ts:115-129, party-routes.ts:46-53, notes-routes.ts:161-171,
cookbook-routes.ts:250); presence noting ×4 (seat-routes.ts:52 `noting(notePlayersSeen…)`,
companion-routes.ts:109, party-routes.ts:40, notes-routes.ts:156; messages "Failed to note a player
at the table" ×3, "…at their notes" ×1). Home: `src/lib/routes/http.ts` (S.5).

**D6 Others found (3+)**: in-memory once-per-N throttles ×3 (roll-requests.ts:748-756, :773-781,
cookbook.ts:223-241); Foundry-id regex ×3; `Tx` type ×3; roster cast `Array.isArray(characters) ?
… : []` ×5 identical in the creators (folded into D2; the 7 unguarded casts elsewhere differ in
behaviour on a non-array and stay); test helper `const ago = (ms) => new Date(NOW - ms)` in 10 db
suites (§7).

## (4) Target shape (behaviour-preserving; order of work S.1 → S.14)

Target tree (new or moved, marked +/→):
```
src/constants/features.ts            + COMMAND_KINDS, COMMAND_SWITCHES, BRIDGE_SWITCHES, SHAPED_KINDS, GM_TAKEN_KINDS, HELLO_ROLL_FLAGS
src/utils/features.ts                + switchOn(campaign, field, now) (the 5 *Available become one-liners, names kept)
src/utils/hello-features.ts          + helloCampaignData(data, sentAt) (pure; .test.ts beside it)
src/db/types.ts                      + Tx, RollSeat, RollRejection, CampaignStatus, CompanionStatus, PartySeat, Notes*, NoteCommand*, Cookbook*, EventCampaign, ChoiceProblem
src/db/constants.ts                  + FOUNDRY_ID
src/db/commands.ts                   + ago, madeBy, onItsWay, seatBusy, inRoster, commandPayload, holdCommand, createCommand(spec), due() throttle
src/db/{effects,favorites,removals,wild-shape,transfers}.ts   specs + createCommand / helpers (names kept)
src/db/roll-requests.ts              dispatch by COMMAND_KINDS table; createRollRequest in stages; recordCommandResult as router
src/lib/routes/                      → seat-routes, companion-routes, party-routes, notes-routes, cookbook-routes, bridge-http (cors, refuse, notSetUp)
src/lib/routes/{seat-resolver,http,body,types}.ts   +
src/lib/attempt.ts                   → attempt() out of bridge-http (db/campaigns imports it)
src/lib/types.ts                     + SessionUser (session.ts keeps its functions)
```

**S.1 The db cycle gone.** Move `ago, madeBy, onItsWay` and the types `RollSeat, RollRejection` to
`src/db/commands.ts` / `src/db/types.ts`; the five creators, roll-requests, companions.ts:29,
companion-routes.ts:9, seat-routes import from there. No outside importer, no test imports them, no
test mocks them: no shim. Steps: create files, verbatim moves, rewrite imports, cycles.py → 0 runtime
SCCs. Pins: db/{effects,favorites,removals,transfers,wild-shape,roll-requests}.test.ts (they pin
every prisma arg), route suites. Risk low. 0.5 h.

**S.2 One command pipeline.** In commands.ts: `seatBusy(seat, now)` (the two counts, same where
objects, `Promise.all` order), `inRoster(characters, actorId)`, `commandPayload(input, seat,
keepGmLabel)` (the strip, key order kept: spread then delete), `holdCommand(seat, kind, payload,
now, extra?)` (create + prune, same data keys), and `createCommand(seat, input, spec)` for effect,
favorite, wildShape, remove: `spec = {kind, field, playerOnly, switchField, available,
waiting: {kinds, select, skip?}, check(payload, sheet), clashes(rows, payload, sheet),
keepGmLabel}`. Transfer keeps its own gates (distribute, checkEnds, group sheet, among, holdings)
and uses seatBusy/holdCommand. The roll path uses `onItsWay` for its inline copy and holdCommand for
create+prune (S.9). Steps: helpers first, one creator at a time (effect, favorite, wildShape,
remove, transfer), L0 after each. Pins: the 5 creator suites assert campaign select, findMany
where/select/take, create data and deleteMany (e.g. effects.test.ts:162-205); roll-requests.test.ts;
e2e favorites, favoriting, effects, wildshape, removals, transfers, givetake. Risk medium (the refusal
ladder order and the `forms` skip). 2.5 h.

**S.3 One request-kind table and the feature switches.** `src/constants/features.ts`:
`COMMAND_SWITCHES = {transfer:'transfersEnabled', remove:'removalsEnabled',
favorite:'favoritesEnabled', effect:'effectsEnabled', wildShape:'wildShapeEnabled'}` (this key
order is the `withheld`/`notOwn` array order, which roll-requests.test pins), `COMMAND_KINDS =
keys`, `SHAPED_KINDS` (the first four), `GM_TAKEN_KINDS = ['transfer','remove']`, `BRIDGE_SWITCHES`
(the 8 fields in markBridgePolled's order). `switchOn` replaces the 5 `*Available` bodies (names
kept: 40+ client tests and table.ts call them). Rewrite roll-requests.ts:152-172 (dispatch through a
`{kind: creator}` map local to roll-requests, which already imports the creators), :562-582,
:706-744; bridge/commands :173-182 (`BRIDGE_SWITCHES.every(f => !polled[f])`);
campaign-events.ts:155-162. Pins: roll-requests.test (claim where), bridge/commands/route.test,
campaign-events.test, table.test; e2e every lane (hello, commands). Risk low-medium (array orders).
1.25 h. Phase 4 follow-up: W derives COMPANION_UNTAKEN/GM_UNSENT's command part from it.

**S.4 One seat resolver.** `src/lib/routes/seat-resolver.ts`: `playerAt(userId, characterId)`
(getCharacter + playerSeat), `gmAt` (= getGmSeat), `companionAt(seat, key)`, `companionRollAt`,
`partyAt(userId, address)`, and `seatAnswer(params, find, answer, {headers})`: getCurrentUser →
401, `await params`, find → 404, else answer. It must keep calling `getCurrentUser` from
`@/lib/session`, `getCharacter` from `@/db/characters`, `getGmSeat/playerSeat` from `@/db/seats`,
`companionSeat/companionRollSeat` from `@/db/companions`, `partySeat` from `@/db/party` (the 34
route suites mock those paths), and keep "401 before params"? (today `getCurrentUser` is awaited
before `context.params`: keep the order). The 4 companion-routes seat helpers go (composition). The
two texts/[hash] routes keep their header quirks explicitly (D1 a, b; bug logged) and the companion
texts their hash check between 401 and the seat. `notesSeat` is rebuilt on playerAt/gmAt with its
own stricter player check (D1 e). Route files stay `export async function GET(request, context:
RouteContext<'…'>)` (typegen, gate 6), each 5-10 lines. Pins: the 34 route suites (status +
headers for signed out, not theirs, bad hash), lib/notes-routes.test, companion-routes.test; e2e gm,
companions, notes, partynotes, party, sheet. Risk medium (headers per route). 2 h.

**S.5 NO_STORE and the answers.** `src/lib/routes/http.ts`: `NO_STORE`, `bare(status, headers =
NO_STORE)`, `textAnswer(html)`, `seenAs(known, current)` (typed comparisons: number `Number(get) ===
v`, boolean `(get === '1') === v`, string `(get ?? '') === v`, optional `(get ?? undefined) === v`;
the 5 pollers pass their own key lists in today's order), `notePresent(campaignId, failed)` (wraps
`noting(() => notePlayersSeen(id))`; notePlayersSeen stays in roll-requests: 29 suites mock it
there). Pins: route suites (204 cases per key), notes-routes.test, cookbook route test. Risk low.
1.25 h.

**S.6 One body reader.** `src/lib/routes/body.ts` `readBody(request, {limit, type?: 'exact' |
'lower', declared?: boolean, reviver?})` → `{ok:true, text, value}` or `{ok:false, why}`; the 5
callers map `why` to today's exact answer (D4). The schema parse stays at each caller. Pins:
rolls route tests (415/413/400), notes route + notes-routes.test, cookbook/dishes/route.test (ladder
order: code before body), events and commands route tests (declared vs read 413). Risk low. 1 h.

**S.7 The result router.** `recordCommandResult` (roll-requests.ts:634, mocked by
events/route.test) stays the entry point and becomes a 3-line router: `dish-` prefix →
recordDishResult; else `recordRollResult` (today's body: update, then `markGmMessages`,
`closeAnsweredPrompt`, version bump); none matched → recordNoteResult. Same order of writes. Pins:
roll-requests.test (results), cookbook.test, note-sync.test, events route test. Risk low. 0.5 h.

**S.8 Campaign event table and the hello split.** campaign-events.ts `apply` (:106-433): the
bridge.hello case → `applyHello(tx, campaignId, event, sentAt)` with its writes in today's order;
its campaign data → pure `helloCampaignData(data, sentAt, before)` in
`src/utils/hello-features.ts`: `HELLO_ROLL_FLAGS` (the 14 in stored order: modifiers, prompts,
areaAttacks, activityChecks, signedDice, selfTargets, gmRolls, gmRollMessages, manualDice,
midiPrompts, aloneChoices, companionPrompts, effectDice, keptRerolls; not ROLL_FEATURES, which
lacks two) and `kindOn(feature, kind)` for the 7 switches. The other cases become an `EVENT_HANDLERS`
table keyed by event type (typed per type); `VERSION_SILENT` for :87-91. Pins: campaign-events
{,.groups,.settings}.test (assert `tx.campaign.update` data), events route test; every e2e lane
starts with a hello. Risk medium (stored array orders, `foundry` JSON key order). 2 h.

**S.9 The roll path in stages.** createRollRequest :142-455 → `rollGate(seat, input, campaign)`
(pure: the 409/422 gates :175-229), `readRollContext(seat, input, campaign, now)` (the 11 reads in
one Promise.all, same order and args), `rollRefusal(…)` (the four-way check :371-401),
`rollPayload(input, seat, campaign)` (:408-430), then holdCommand. Stages stay in roll-requests.ts
(pure ones may go to utils/roll-requests only in Phase 4: W's file). Pins: roll-requests.test.ts
(5 247 lines), rolls route suites; e2e rolling, rolls, typed, manualdice, gmroll, alone, prompts,
companionsaves, endturn, attacks, activities, links. Risk medium-high (hottest path). 2 h.

**S.10 The module's routes under 15.** events POST → local `pingAnswer`, `takeEvent` (the
try-block :178-211 routing COMMAND_RESULT / DISH_* / applyCampaignEvent / markSeen),
`eventAnswer` (resend/announce); FEATURES and ANSWERED_WITH_FEATURES → `src/constants/features.ts`
(key order kept). commands POST → local `holdForCommands` (the loop), `claimAll`. Only HTTP methods,
`OPTIONS` and `maxDuration` stay exported (Next.js route-file rule; gate 6). Pins: events
(1 178 lines) and commands (810) route suites; e2e all. Risk low-medium. 1 h.

**S.11 The remaining complexity.** Extract-function only, file by file: table.ts `getTableView`
(`seatSwitches`, `tableMessagesOf`; status and view share `seatSwitches`, the view ANDs
`connected`), companions `getCompanionView`, party `getGroupView`, campaigns `findEventCampaign`
(`boundCampaign`, `recordNotSetUp`), sheet-html `linkWalk`, note-markdown `enrichMarkdown`,
note-sync `recordNoteResult`/`applyJournalUpdated`, table-view's six, transfers' two,
wild-shape `checkWildShape`, slim-sheet `expand` (≈115: by row kind), and **db/notes.ts last**
(overlay, viewOf, fits, changeNote, deleteNote, reorderNotes). Pins: each file's own suite
(tests-per-file.txt), table-view's 42 suites, notes.test (3 068), note-sync.test (1 720). Risk
medium for notes/slim-sheet. 3.5 h.

**S.12 Types and constants placed.** The 31 exported types → `src/db/types.ts`,
`src/lib/routes/types.ts` (Refusal, NotesPlace, NotesAddress, CookbookRefusal), `src/lib/types.ts`
(SessionUser); `Tx` once; the three `*Refusal` util types un-exported; `FOUNDRY_ID` in
`src/db/constants.ts`; `GAMEMASTER` (2×) may join it. `SocialProviderId` and PromptData/HeldPrompt
need a home in src/types (W's folder): Phase 4 (F). Pins: tsc. Risk low. 0.75 h.

**S.13 Layering moves (for WS3's codemod).** `git mv` the five `lib/*-routes.ts` and bridge-http to
`src/lib/routes/` with their tests (notes-routes.test, companion-routes.test, bridge-http.test);
`attempt` → `src/lib/attempt.ts` (+ its test cases split from bridge-http.test only if T agrees:
else keep a re-export… no: move the test file with `attempt`'s cases unchanged in Phase 2a). Then the
rule: `src/db` may not import `src/lib/routes` or `src/app`; `src/lib/routes` only from `src/app/api`.
No suite mocks any moved path. Delete db/companions.ts:47 re-export. Risk low. 0.25 h (WS3).

**S.14 Small shared pieces.** `due(map, key, every, now)` for the three throttles (same Map
semantics, set before the write); FOUNDRY_ID used by seats, roll-requests, party. Pins: roll-requests
and cookbook suites (throttle cases with fake time). Risk low. 0.5 h.

Total ≈ 19 h for one builder (S.13 in WS3). Commits: 7 = S.1, S.2, S.3, S.6, S.14; 8 = S.4, S.5,
S.7, S.12; 9 = S.8, S.9, S.10, S.11.

## (5) Contract surface (byte-identical) and goldens

Must not change: the 41 route paths and their exports (`GET/POST/PUT/PATCH/DELETE/OPTIONS`,
`maxDuration = 30`); every status per case and its order (auth before body for the module and the
cookbook; 401 before 404; 415 → 413 → 400 for seat bodies); headers: `Cache-Control: no-store` on
every seat/notes/cookbook answer except the two texts routes' 401/404 quirks, `private,
max-age=86400` on texts 200, CORS on every events/commands answer (`Access-Control-Allow-Origin`
echo or `*`, `Methods: POST, OPTIONS`, `Headers: Content-Type, Authorization`, `Max-Age: 600`,
`Vary: Origin`, `Allow-Private-Network` on request), commands adds no-store, events doesn't; cookbook
no CORS, `Retry-After: 60/3600`. Bodies and key orders: refusals `{reason, message, limit?,
protocol?, type?, detail?}` (detail cut 1000; recorded detail `${type}: ${2 lines}` trimmed, cut 300;
title cut 200); `{commands, open}` / `{commands, wait, open}`; `{resend:'hello'?, features?}` with
FEATURES' 15 keys in order; roll `{id}` 202 / `{reason}`; notes `{id?, stamp}`, `{reason, field?,
lines?}`; cookbook `{reason, message, limit?, field?}`, `{id, status}` 200/202, view `{version,
...view}` where version = sha256(JSON.stringify(view))[0,12] (the view's key order is part of the
hash); all messages with their curly quotes. Query keys: `version, live, rolls, gm, gmrolls, moves,
typed, removes, favorites, effects, wildshape, sheet`, notes `stamp` (≤ 80). Stored rows:
RollRequest data and payload per kind (strip lists), prune; hello's campaign update (rollKinds
filter, rollFeatures order, transferFeatures `[partySends, distribute]`, noteFeatures, dishVersions,
companions, `foundry` JSON), version bumps (`VERSION_SILENT`), helloSession, refusal columns;
claim writes. Server Actions: 15 exported names, their form states, messages, redirects,
`refresh()` calls.

Goldens (WS2, concrete): **G-S1 route matrix** (`src/__tests__/server-routes.golden.test.ts`): every
route × method × {signed out, not theirs, bad hash where it applies, unchanged (204)} → `{status,
headers: sorted entries, body text}` snapshot, with prismaFake; **G-S2 module wire**: events and
commands for no secret, not Forge, declared and undeclared oversize, bad envelope, wrong protocol,
ping ok/unknown/refused, malformed (body and recordRefusal args), hello/heartbeat answer text
byte-exact, texts 204, OPTIONS ± private network; commands off-wait, cold, held, aborted, open
changed; **G-S3 command storage**: for roll (player typed with effectDice and kept rerolls, GM with
label), transfer (GM label), remove, favorite, effect, wildShape (change and `forms`): the ordered
list of prisma calls `[model.method, args]` as JSON, and each refusal ladder's first refusal;
**G-S4 hello storage**: `tx.campaign.update` data JSON for a full 0.42 hello and a pre-0.10 one;
**G-S5 cookbook**: the dish ladder (status, headers, body text) and the view's version for a fixed
view.

## (6) Seams

Phase 2b / Phase 4 edits outside S: (a) W: utils/roll-requests GM_UNSENT and constants
COMPANION_UNTAKEN read S's COMMAND_KINDS (Phase 4, F); (b) W: a home in src/types for
SocialProviderId and PromptData/HeldPrompt (Phase 4); (c) V2: sign-in-buttons.tsx and login page
import SocialProviderId from its new home (Phase 4, shim in auth-providers until then); (d) V2
pages (characters/[id], campaigns/[id]/characters/[actor], both party pages) repeat the
session → seat lookup with requireUser/notFound: may adopt `playerAt/gmAt` (Phase 4, optional,
different answers); (e) T: guardNoDb in the 34 route suites, the kit helpers of §7. Names others
import from S, all kept at their paths (no shim needed): `getCurrentUser, requireUser`; db
`getCharacter, playerSeat, getGmSeat, getTableView, getGroupView, partySeat, shapedRefusal,
listOwnedCampaigns, findInvite, getCampaignChoice…`; `appOrigin, generateSecret`; utils `askTitle,
damageKinds, healingRolls, toTableRoll, isShaped, articled, hoursWords, isFavorite, targetKey,
relatedItems, shownPrompts, waitingPrompts, expandSheet, *Available`; `authClient`.

## (7) Tests

79 suites: 34 route (src/app/api/**, colocated), 4 lib responders/helpers + 5 lib pure, 24 db,
10 utils, 2 actions, auth-providers. All colocated unit suites stay beside their files and move with
them (S.13: notes-routes.test, companion-routes.test, bridge-http.test → src/lib/routes/).
`campaigns/[id]/characters/[actor]/routes.test.ts` tests four routes at once: an integration suite
→ `src/app/api/campaigns/[id]/characters/[actor]/__tests__/gm-seat-routes.integration.test.ts`
(private folder; WS3). `jest.mock` paths that move: none (no suite mocks a moved module); paths that
must keep their names: `@/db/roll-requests` (29 suites: notePlayersSeen, noteTableOpen,
createRollRequest, getRollRequestView, recordCommandResult, claimRollRequests, markBridgePolled,
openActorIds), `@/db/characters` (33), `@/lib/session` (47), `@/db/seats` (19), `@/db/party` (19),
`@/db/notes` (17), `@/db/table`, `@/db/cookbook`, `@/db/campaigns`, `@/db/companions`.
Duplicated helpers for T's kit: signed-out `mockResolvedValue(undefined)` + a no-useless-undefined
disable in 32 suites (62 lines); `{ id: 'user-1' } as any` in 20; `NextRequest` + `params:
Promise.resolve(…)` builders in 34; `const ago = (ms) => new Date(NOW - ms)` in 10 db suites;
`expectRefusal` twice (events, commands). Overlap: the 12 notes route suites re-test what
lib/notes-routes.test covers (keep: they pin each address's wiring); the five creator suites share
~60% of their cases (busy, roster, switch): fine until S.2, then G-S3 covers the ladder.

## (8) Bugs seen (logged in bugs-found.md, [S], 5)

1. campaigns.ts:437 via events/route.ts:127: a `bridge.ping` binds the campaign (PROTOCOL.md:1513
"Store nothing"); a wrong-world Test can bind the wrong module id and lock the real one out (404).
2. seat-routes.ts:126, notes-routes.ts:183: bodies read whole before the size check, no declared
Content-Length check (the other three readers have one).
3. (to confirm) the two texts/[hash] routes' 401/404 without Cache-Control, unlike siblings.
4. (to confirm) app-origin.ts:9 takes a comma list in `x-forwarded-host` whole.
5. (low) roll-requests.ts:748,773, cookbook.ts:223: throttle Maps never pruned.

## (9) Out of scope (listed) and risks

Two-copy merges (Q1 excludes): the module gate in events and commands (secret, Forge origin,
size, campaign lookup with its unavailable/wrongSecret/notSetUp closures); `noting` vs `attempt`;
`GAMEMASTER` ×2; status vs view switch flags in table.ts (folded into S.11 only for complexity);
companion status/view mirroring the table's; notes `bare`/`refused`. Q1's excluded extras: none on
the server (the shared poller is the client's).

Efficiency, report only (no change in v0.43): a table poll that isn't 204 reads the campaign and
the GM rolls twice (getCampaignStatus then getTableView); a party poll reads the campaign 3× (access
in getPartyStatus, again in getGroupView, then the roster at party.ts:~296); a GM companion route
reads it twice (getGmSeat, companionSeat); each claim pass of a held commands fetch (about every
second for 20 s) reads the campaign 3× (claimDishes, claimNoteWrites, claimRollRequests) and runs
two `deleteMany` of stale note writes (note-sync.ts:442-443); every event post and every commands
fetch pays one scrypt (N=16 384) in findEventCampaign. Indexes: every hot filter is covered by an
index prefix (RollRequest `(campaignId, actorId, role, createdAt)`, `(characterId, createdAt)`,
`(campaignId, status, createdAt)`; Character `(campaignId, actorId)`; Campaign `(origin,
foundryId)`; RollPrompt `(campaignId, actorId, closedAt)`; Journal/Cookbook `(campaignId, status,
queuedAt)`); the prompt-answer read filters `payload` by JSON path inside the `(campaignId,
actorId)` prefix: no missing index found.

Risks: S.2 and S.9 touch every command and roll (tests pin prisma args, so a drift fails loudly;
e2e covers the wire); S.8 changes how stored arrays are built (G-S4 first); S.4's per-route header
quirks (G-S1 first); keeping mocked names at their paths is what keeps 29+33+47 suites honest
(guardNoDb catches a miss); Next.js 16 route files may export only methods and segment config, so
helpers stay unexported in route files or live in src/lib/routes; slim-sheet `expand` (≈115) is the
largest single complexity job and its only importer is W's schema.
