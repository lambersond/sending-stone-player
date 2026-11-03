# Map T: tests and the safety net (repo-wide), v0.43 re-plan

Mapper T, 2026-11-03, on 51b8916 (= 24f808b + .refactor/). Design only. Outputs and scripts in
`.refactor/analysis/T/`; full e2e listing X/T-e2e-full.txt (regenerate: e2e-surface.mjs).

Headlines: 290 suites / 155,040 lines, all colocated, no `__tests__/`, **no snapshot anywhere today**, no
id normalizer. Test kit files do not exist (jest.config.ts:20-21 already names them). 25 route suites
use no prismaMock and **all 25 pass a no-db probe today** (281 tests, 0 prisma calls; control suite shows
hits). Copies: `respond` 22 (15 byte-identical), `advance` 11 identical, the 3d-dice-react mock 21
(18 identical), the sheet roll-server `answering` 9 (6 in sheet suites, all differing), notes-route
jest.mock block 16 (2 variants), prismaMock imported by 33 suites through `../`×2..11 relative paths.
268 eslint-disable lines in tests (156 file-scope), 178 go with Q2. 33 named types in 30 .test.tsx.
10 numbered items (T.1-T.10), 1 bug logged.

## (1) Inventory

| group | files | lines | kind | importers outside T |
|---|---|---|---|---|
| jest.config.ts | 1 | 48 | config (next/jest, jsdom default, `clearMocks`, modulePaths src, `@/` mapper, dice ESM mapper) | WS0 lint config |
| jest.setup.ts | 1 | 140 | setup: `prismaMock` (mockDeep), `@prisma/client` mock, polyfills, `fetch = jest.fn()`; exports `prismaMock`, `mockFetch`, `mockManyFetch` (last two dead) | 33 suites import `prismaMock` relatively |
| unit/integration suites | 290 (158 .test.tsx, 132 .test.ts) | 155,040 | 63 `@jest-environment node`, 227 jsdom | none (no test imports another test) |
| src/mocks/* (W owns, read by T) | 6 | 6,141 | fixtures | 140 suites; slim-sheet.ts, alone.ts import other mocks |
| e2e/*.mjs (frozen) | 51 + 11 sh | 40,752 | Playwright suites + harness | none |
| new (WS1): src/utils/test-utils.ts, test-utils-node.ts, src/mocks/sheet-providers.tsx | 0 | 0 | kit | |

Per folder: components 130, app 50 (37 route suites), utils 47, hooks 23, db 20, lib 10, schemas 8,
src root 2. Largest: utils/roll-requests 7066, character-pane 6917, schemas/sending-stone 6012.

## (2) CLAUDE.md rule by rule (tests)

- **§2** test files export nothing (0 `^export` in tests). jest.setup.ts exports 3 (a .ts, fine).
  sheet-providers.tsx (new) exports one component only (`SheetProviders`); its option type goes in
  src/mocks/types.ts.
- **§3 types:** 33 named types in 30 .test.tsx (+7 in .test.ts), all file-private (none exported).
  13 are `Parameters<typeof X>[0]` (11 in notes/*, companion-pane:183, character-pane.creature:153) →
  `import type { XProps }` once the owner's lane moves the props type to types.ts (import line only);
  4 `type User = ReturnType<typeof userEvent.setup>` (charges:110, description-link:30,
  character-pane:127, game-table.companions:270) → `import type { UserEvent } from
  '@testing-library/user-event'`; 16 stay file-private. **For Q3's rule:** the types-in-types.ts
  selector covers exported declarations only in `*.test.*` (reason: file-private fixture shapes).
- **§3 rules in components:** none in tests by definition; jest.setup's `mockFetch`/`mockManyFetch`
  (jest.setup.ts:3-70) are dead: G drops them in commit 19.
- **§4 placement:** kit at src/utils/test-utils*.ts (application-wide, every area's suites import it);
  sheet providers at src/mocks/sheet-providers.tsx (WS1 writes it, U1 owns it after Phase 2, per
  prior-plan). After moves, `src/mocks/sheet-providers.tsx` could live in src/features/sheet/ but the
  table, companions and party suites also render sheets: stays at src/mocks (LCA).
- **§7:** no cycles in tests; no barrels. Relative `../…/jest.setup` imports (33) and relative
  jest.mock paths (4: use-dice-entry.test.tsx:7 `./dice-entry-dialog`, app/characters/[id]/page.test.tsx:25
  `../actions`, app/characters/page.test.tsx:8 and app/campaigns/page.test.tsx:9 `./actions`) are what
  the move codemod's second pass must re-resolve.
- **§8:** all suites colocated; integration suites below (§7 of this map) need `__tests__/`.
- **§9 disables in tests:** 268 lines (list of the 90 that stay: analysis/T/disables.txt). File-scope
  (block at line 1): 153 `unicorn/no-null` (all with reason), creature-switcher.test.tsx:1
  `no-this-outside-of-class`, manifest.test.ts:4 `camelcase` (reason given; keep: the file is that
  data); game-table.companions.test.tsx:597 is a block closed by eslint-enable at :604 (scoped).
  Line: 78 `no-useless-undefined` (31 without reason: app pages, route suites, site-header.test:35),
  24 `no-null`, 6 `camelcase` (note-sync.test), `react/jsx-key`, `no-console`
  (utils/note-headings.test.ts:116, prints an agreement rate), `@next/next/no-img-element`
  (use-image-fallback.test:13, no reason), 1 `no-this-outside`. **Q2:** the 177 no-null lines and
  jest.setup.ts:47 go → 90 left, 2 file-scope; WS3's commit 5 gives the 31 reasonless ones a reason
  (`mockResolvedValue(undefined)`: resolves to nothing), comment-only, gate 1 safe.
- **§9 complexity:** exact counts from WS0's sonarjs run; no test helper read here looks over 15
  (companion-pane.test.tsx:122 `routes()` ~7 branches, note-editor.test.tsx:694 `holdWrites` small).
  If a test body exceeds 15 it is listed, not rewritten (assertions frozen): tests at `warn`.

## (3) Duplication (3+ copies; file:line; exact differences; proposed home)

Full grouping by hash: analysis/T/dup-helpers.txt.

1. **Fetch responder `respond`** (22). Variant A, 15 byte-identical `(status, body?) => ({status, ok:
   2xx, json: async () => body}) as Response`: cookbook-card.test:24, cookbook-entry.test:10,
   game-table.favorites:74, game-table.removals:96, give-controls:122, party-controls:59,
   take-controls:53, use-companion-view:9, use-cookbook-view:23, use-end-turn:25, use-party-sheet:36,
   use-table-rolls:290, use-table-view:22, use-transfers:6, use-turn-undo:59. Variant B (3) wraps in
   `Promise.resolve(...)`: game-table.cookbook:73, .notes:100, .party:140. Others differ in meaning:
   party-sheet.test:79 `(body, status=200)` reversed args + Promise; sheet-text.test:12 `(ok, html)`;
   use-notes.test:20 throws SyntaxError on `json()` without a body; campaigns party page.test:54
   `ok: true` always. **Home:** `respond` (A) and `responding` (B = `Promise.resolve(respond(...))`) in
   src/utils/test-utils.ts; the 4 others stay local.
2. **`advance`** 11 byte-identical `act(async () => { await jest.advanceTimersByTimeAsync(ms) })`:
   game-table.endturn:159, give-controls:140, take-controls:80, use-companion-view:16,
   use-cookbook-view:30, use-end-turn:32, use-party-sheet:43, use-table-rolls:297, use-table-view:29,
   use-transfers:13, use-turn-undo:66; plus 60 inline `advanceTimersByTimeAsync` in 23 files (stay).
   `wait` = sync `act(() => jest.advanceTimersByTime(ms))` ×2 (turn-toast:123, use-hold:106).
   **Home:** test-utils.ts `advance`.
3. **Captured POSTs** `posts()` = POST calls → `{url, body: JSON.parse(String(init?.body))}`: 3
   identical (game-table.favorites:82, .removals:104, party-controls:75), give-controls:130 same with
   `posted = () => posts()[0]` (:135); `posted` variants: use-end-turn:58 = use-turn-undo:86 (url +
   body), game-table.party:160 (= posts), use-table-rolls:249 (bodies only, typed), take-controls:75
   (`lastCall` only, any method). 40 inline `JSON.parse(String(init?.body))` in 20 files. **Home:**
   test-utils.ts `posts()` (the 3-copy shape exactly) and `sent()` (every call whole: url, method,
   headers, body string; for C2).
4. **Roll server `answering`** (POST → 202 `{id: req-N}`, GET `…/<id>` → answer): action-entry.alone:207
   (default `{}`, `answers[id] ?? {status:'pending'}`), enchantments:129 and charges:70 (same but
   `const answer`; charges defaults `{}`), character-pane.creature:132 (`{id, status:'pending',
   ...answers[id]}`: merges, so an answer without status reads pending), character-pane:259 (`answers[id]
   ?? {id, status:'pending'}`), character-pane:5538 `answeringShaped` (never answers non-`/rolls/` GETs).
   Same name, other shapes: game-table.removals:131, .favorites:98, use-end-turn:68, use-turn-undo:96
   (queue of views). **Home:** test-utils.ts `rollServer(answers)` with the action-entry.alone
   semantics, for the goldens; the 6 sheet copies stay (each differs, assertions read `posted`).
5. **3d-dice-react mock** 21: 18 identical (`DiceRendererProvider` passes children, `useDiceRenderer`
   → `{isReady:false, roll: jest.fn()}`) in action-entry.alone:43, character-pane.notes:14,
   character-pane:64, charges:45, enchantments:28, favorites:39, item-menu:32, recharge-chip:14,
   companion-pane:24, game-table.{cookbook:32, endturn:57, favorites:26, manual-dice:28, notes:34,
   party:60, removals:24, test:54}, give-controls:17; 3 differ (use-sheet-roller.test:15,
   .typed:25, .elven-off:13). **Home:** src/mocks/dice-renderer.ts `NO_DICE` module object; each
   copy becomes `jest.mock('@lambersond/3d-dice-react', () => jest.requireActual('@/mocks/dice-renderer').NO_DICE)`.
6. **Notes route mock block** (6 jest.mocks: session, characters, seats + getGmSeat, party +
   partyNotesAccess, roll-requests, notes) in 16 suites: 12 identical (notes, [note], preview × 4
   seats), 4 identical (order). Stays (jest.mock must sit in the file); a 2-variant merge is out of scope.
7. **Route callers** (`get` 18, `post` 14, `patch` 4, `send` 4, `params` 8, `statusOf` 4; 50 `new
   NextRequest(` in 36 files): each bound to its route's params → stay; `routeCall` is for goldens.
8. **Time:** `ago(minutes)` → ISO, 5 identical (notes: chapter-pane:9, journal-modal:34, note-card:6,
   note-lines:18, note-pane:18) → test-utils.ts `minutesAgo`; `ago(ms) => new Date(NOW - ms)` 7
   identical text but each over its own `NOW` (6 different dates): stays.
9. **`brokenBeforeMount`** 4 identical (character-sheet.test:82, sheet-entry:13, creature-header:70,
   chat-log:124) → test-utils.ts `brokenImages()`.
10. **prisma fakes** `given(...)`: db/{removals:66, favorites:64, effects:106, transfers:74,
    wild-shape:83, roll-requests:3506}, bridge/commands route:89: one skeleton (campaign.findUnique,
    actorSheet.findUnique/findMany, rollRequest.count by `where.OR`, findMany by seat), each with its
    feature's switches → stay. `held(...)` 22 copies, 2 identical pairs → stay.
11. **prismaMock import** 33 suites, `../../jest.setup` (21) up to 11 levels → test-utils-node.ts
    re-exports `prismaMock`; import line only (gate 1 safe), and moves stop touching it.

## (4) Target shape

**T.1 jsdom kit** `src/utils/test-utils.ts` (WS1, commit 2): `respond`, `responding`, `advance`,
`posts`, `sent()` (each call whole: url, method, headers as a sorted object, raw body string),
`rollServer(answers?)` → `posted`, `minutesAgo`, `brokenImages`, `normalizeIds(html)` (each distinct
`_r_…_`/`_R_…_`/`«r…»`/`:r…:` token, alone or inside a value such as `_r_3_-panel`, → `id-1`, `id-2`
by first appearance, references consistent; SheetIdPrefix ids such as `creature-wolf-sheet-tab-actions`
untouched), `normalizeTimes` (`<time>` text → `⟨time⟩`, `dateTime` kept), `atFixedTime(iso)`,
`markup()` (both normalizers over `document.body.innerHTML`, portals included). Its own unit test
beside it (a small table). 1.5 h.

**T.2 node kit** `src/utils/test-utils-node.ts`: `prismaMock` (re-export of jest.setup's),
`prismaFake(rows)` (installs `mockImplementation` on each model method named in `rows`: answers by
model + `where` match, records `{model, method, args}` in call order: `fake.calls`), `resetPrisma()`
(`mockReset(prismaMock)` + `$extends` re-pointed; for goldens, since clearMocks keeps implementations
across tests), `guardNoDb()` (an `afterEach` that fails naming every called model method: walk of
`Object.keys(prismaMock)` and each model's keys, skipping `$extends`; prototype:
analysis/T/guard-probe.js), `routeCall(handler, {method, url, body, headers, params})` →
`{status, headers (sorted object), body (text), json?}`. 1.5 h.

**T.3 adopt byte-identical copies only** (WS1, commit 2): §3 items 1A (15), 1B (3), 2 (11), 3 (3),
5 (18 via src/mocks/dice-renderer.ts: a W-owned folder: new file named in commit 2), 8 (5), 9 (4),
11 (33 import lines). Each adoption deletes the local definition and adds an import; no call site and
no `expect` changes (gate 1), counts equal (gates 2, 3). Near copies stay (list in §3). 1.5 h.

**T.4 no-db guard**: `guardNoDb()` one line after imports in the 25 route suites of
analysis/T/route-suites.txt ("noprisma"): all 25 pass today (guard-probe.txt). Optional: the 22
page/action/lib suites (also 0 hits). Gate 8 checks the line's presence. 0.5 h.

**T.5 `SheetProviders`** `src/mocks/sheet-providers.tsx`: one component composing the sheet's
contexts as CharacterPane gives them: Favoriting (in 10 suites today), Charging 5, Effecting 4,
FavoriteMarks 7, RollsLocked 5, WildShaping 6, DescriptionLinks 4, Preparing 4, Enchanting,
Concentrating, ConditionsOpener, SheetIdPrefix, TableApiContext, CreatureContext. Defaults: the real
hooks over a sheet and a seat (`NO_*` where the pane gives none); a prop overrides one context.
Options type in src/mocks/types.ts. Goldens only. 1 h.

**T.6 goldens C1-C8** (WS2, commit 3; new files only, under `src/__tests__/golden/`, snapshots in
`__snapshots__/`, run with `--ci` so none is written by accident). Common rules: `atFixedTime
('2026-10-04T19:30:00.000Z')`, `process.env.TZ = 'UTC'` set at the top of each golden file (Node
re-reads it), `Math.random` spied with a fixed LCG sequence in every golden that may throw dice,
`resetPrisma()` and `localStorage.clear()` in `beforeEach`, `matchMedia` both ways (narrow default,
wide spied), fixtures only from src/mocks (W must not change their outputs: any change shows in the
goldens, which is the point). React ids by `normalizeIds`; times by `normalizeTimes`; `toMatchSnapshot`
names fixed strings. No `__tests__/` file may be a non-test .ts (jest's default testMatch runs every
.ts under `__tests__/`): helpers go in the kit.

- **C1 markup** (`markup.golden.test.tsx`, retired in commit 22; ~45 snapshots): GameTable player
  seat (toTableSheet(characterSheet()), a message, a combat) narrow (tabs Character/Chat/Combat) and
  wide, GM seat (gm roll toasts), companion seat; CharacterPane on fullerSheet per tab (Actions, Spells,
  Inventory, Features, Effects, Biography), druidSheet/shapedSheet (Wild Shape ribbon, Return popover),
  mockCompanionSheet creature tabs; open menus: item menu with moves, action roll menu, press menu;
  open dialogs: Settings, dice entry, Modify damage, Longsword attack picker, Your rolls,
  move/distribute/remove/confirm, Journal modal (empty, with chapters), 'The Iron Company', cookbook;
  roll toasts pending/done/refused, turn toast `taking`, page toast; CampaignIndex per campaign state
  and refusal, character list, join, login, home.
- **C2 wire** (`wire.golden.test.tsx`, ~70 cases): `sent()` of each request whole (URL, method,
  headers, raw body string: key order counts). Each of the 30 ROLL_KINDS from its UI gesture (the
  building file per kind: analysis/T/kinds-where.txt), with the variants that change a body (advantage,
  typed dice, effect dice, aloneChoices, self target, companion seat `…/companions/<c>/rolls`, GM seat
  `/api/campaigns/<id>/characters/<actor>/rolls`) and the poll after (`/rolls/<id>`, `no-store`); the
  other 9 fetch sites: table poll query per seat (use-table-view.ts:91), party (use-party-sheet.ts:55),
  companion view (use-companion-view.ts:57), cookbook (use-cookbook-view.ts:92), sheet texts
  (sheet-text.tsx:54), notes GET/POST/PATCH/DELETE/preview/order (use-notes.ts:332,429,493). All roll
  POSTs pass use-table-rolls.ts:1260 `follow()` (one choke point to pin).
- **C3 composition** (`composition.golden.test.tsx`): for GameTable (player, GM, companion), CharacterPane,
  CompanionPane, PartySheet, JournalCard: the tree of area-root components (GameTable, CharacterPane,
  CharacterSheet, RollTray, ChatLog, CombatTracker, TurnToast, JournalCard, PartySheet, CompanionPane,
  CookbookCard, PageToast) read from React's fiber (`__reactFiber$` key of rendered nodes, walking
  `.return`, `type.name`), with each root's props keys and serializable values (functions → `fn`,
  elements → `el`). Pins which component renders which and the props that cross areas; intermediate
  components are free to change. Area-root names are frozen in v0.43.
- **C4 words** (`words.golden.test.tsx`): visible strings and accessible names (`textContent` and
  role+name lists via `getAllByRole`) per kind's toast in each state (pending, waiting for player,
  done, refused per reason), per refusal reason text (`refusal()`), tray rows, chat lines per message
  kind, turn toast states, transfer/move words (move-words.ts), slot words, note times (noteTime at
  fixed now and TZ). ~60 cases.
- **C5 routes** (`routes.golden.test.ts`, node): every route method of analysis/T/route-exports.txt
  (40 files, 52 handlers; auth excluded) called by `routeCall` over the real db modules on
  `prismaFake` rows: signed out, other user's sheet (404), GM seat, player seat, happy path; recorded
  `fake.calls` (model, method, args, in order: transaction order counts) and the response (status,
  headers incl. `Cache-Control`, `Retry-After`, body). ~120 cases.
- **C6 refusals** (`refusals.golden.test.ts`): `safeParse(...).error.issues` (code, path, message) for
  rollRequestSchema per kind (one wrong field each, one unknown key each), sending-stone event schemas
  (hello, events, settings, groups), notes, cookbook, campaign, foundry-settings; and per route the
  status + body for malformed JSON, wrong content type, too large (`MAX_ROLL_BYTES` 16,384), wrong
  secret, not set up (the `data-refusal` reasons wrongSecret, malformed, notSetUp). ~150 cases.
- **C7 storage** (`storage.golden.test.ts(x)`): localStorage keys and stored strings (SEND_KEY,
  GM_SEND_KEY, ALONE_KEY, GM_ALONE_KEY, TOASTS_KEY, LAST_FORM_KEY, ENDED_KEY, roll mode, actions layout,
  note drafts) after each gesture; db rows written (create/update `data` args) per command kind via
  prismaFake (createRollRequest per kind, notes create/change/order, cookbook dishes, campaign events).
- **C8 dice draws** (`dice.golden.test.tsx`): useSheetRoller with Math.random as a fixed sequence:
  per roll shape (d20 normal/adv/dis, Elven Accuracy 3d20 with ELVEN_LINE as today, damage normal and
  critical (EVERY_DIE_TWICE), with modifiers, hit die minimum, hit dice, formula, effect dice Bless d4 /
  Bane, typed dice kept rerolls) the number of `Math.random` calls, the pools and totals, and the body
  posted. No 3D renderer (NO_DICE).

What keeps them stable: fixed clock, TZ, random sequence, storage cleared, prisma reset per test;
ids/times normalized; fixtures from src/mocks only; mutation spot-check per suite (prior plan WS2).
5 h each builder (C-a: C1, C4, C7, C8; C-b: C2, C3, C5, C6).

**T.7 gate scripts** (`.refactor/tools/`, not in the PR; WS1). `base.sh`: if X/base/jest-base.tsv is
missing: `git -C APP worktree add --detach X/base/wt 24f808b`; node_modules symlinked from APP when
`git diff --quiet 24f808b HEAD -- package-lock.json prisma/` (else `npm ci && npx prisma generate`);
under `flock X/checks.lock`: `npx jest --json --outputFile=X/base/jest-base.json --maxWorkers=3`;
`node tools/base-tsv.mjs` → jest-base.tsv (`file\tfullName\tstatus\tnumPassingAsserts`, 8,607 rows)
and X/base/expects/ (gate 1's per-test expect lists); `git worktree remove --force X/base/wt`.
`l1.sh <outdir> [checkout]` as prior-plan item 4, then `gates.sh <outdir>`; each gate prints
`gate N ok|FAIL` and its findings to `<outdir>/gate-N.txt`; exit = number of failed gates.
Renames: `git diff -M50% --name-status 24f808b HEAD` maps base paths to today's.
1. assertions: TS compiler API parses each test file (base and head); per test (describe/it title
   path) the ordered list of `expect(...)` statements, whitespace collapsed outside strings; every base
   list must equal the head's for the same test (renamed files followed). Allowlist: C1's deletion
   (commit 22).
2. per test: head `fullName` present, `status` passed, `numPassingAsserts` ≥ base.
3. counts: suites and tests = base + goldens added − retired (numbers in tools/counts.conf).
4. stale mocks: each `jest.mock`/`requireActual`/`requireMock`/`doMock` path resolves (TS module
   resolution with tsconfig paths, `@/` and src modulePaths, relative from the test's folder) **and**
   the resolved file is in the import closure of the test's own imports (a mock of a shim nobody
   imports any more mocks nothing).
5. overridden constants: the 5 overrides (effect-controls.test.tsx:28 `EFFECT_SETTLE`, wild-shape.test.tsx:33
   `WILD_SHAPE_SETTLE` in @/constants/sending-stone; cookbook-dish-list.test.tsx:8 `DISH_ATTEMPTS`,
   cookbook/dishes/route.test.ts:17 `MOST_DISHES_WAITING` in @/constants/cookbook;
   use-sheet-roller.elven-off.test.tsx:19 `ELVEN_LINE` in @/utils/typed-dice): the name is still
   declared in the resolved module and the subject's closure reads it from there (not a copy).
6. route exports: per route.ts the exported names equal the base's (route-exports.txt).
7. shims: `v0.43-shim` imports only in files tools/shims.allow names; none after commit 19.
8. prisma: each of the 25 suites has `guardNoDb()`; they pass.
9. lint ratchet: `eslint -f json` warnings per (folder, rule) ≤ ratchet-base.json; the base re-taken
   once after commit 4 (the moves change folders).
10. goldens: src/__tests__/golden/** green; jest.json `snapshot.added == 0`, `unchecked == 0`,
    `updated == 0`; `git diff --quiet <commit 3> -- 'src/__tests__/**/__snapshots__/**'` (C1's removal
    allowed in commit 22 only).
3 h (with T.1-T.4: WS1's 3 h + 2 h).

**T.8 test placement** (WS3, commit 4, moves only). Integration suites (several real units, network
or db faked at the boundary) → `src/features/<feature>/__tests__/<name>.integration.test.tsx` (name
kept but the suffix: renames keep history with `git mv`): table: game-table.test.tsx and the 8
game-table.*.test.tsx (GameTable composes sheet, rolling, notes, party, cookbook), give-controls.test.tsx
(renders GameTable); sheet: character-pane.test.tsx, character-pane.{creature,notes}.test.tsx,
action-entry.alone.test.tsx, charges, enchantments, recharge-chip, favorites, item-menu (each renders
CharacterPane with a fetch server); rolling: use-sheet-roller{,.typed,.elven-off}.test.tsx (sheet roller
over the real useTableRolls and fetch), use-transfers.test.tsx; companions: companion-pane.test.tsx;
party: party-controls, take-controls (render PartySheet); server: the 12 route suites over real db
modules and prismaMock (analysis/T/route-suites.txt "PRISMA") and lib/companion-routes.test.ts →
`src/app/api/__tests__/<route-path-dashed>.integration.test.ts` (an `_`-prefixed folder is a Next.js
private folder, never a route segment: node_modules/next/dist/docs/01-app/01-getting-started/
02-project-structure.md). The goldens (cross-feature) → `src/__tests__/golden/`. Unit suites stay
beside their unit and move with it. jest.mock paths re-resolved by M's codemod. 1 h (M).

**T.9 lint for tests** (WS0 config): `unicorn/filename-case` `ignore: ['^__tests__$', '^__snapshots__$']`
(before commit 3); the types rule as §2 proposes; sonarjs complexity `warn` for `**/*.test.*`;
`no-restricted-syntax` one-export-per-.tsx exempts nothing in tests (they export none). 0.5 h.

**T.10 C1 retired** (commit 22): delete markup.golden.test.tsx and its .snap; counts.conf lowered by
its tests; gate 1 allowlist names it. 0.25 h.

Risk overall: medium (goldens' size; C3's fiber walk relies on React dev internals; prismaFake's
`where` matching must be strict enough that a changed query shows).

## (5) Contract surface (byte-identical) and what pins it

From e2e (analysis/T/e2e-surface.txt; 51 suites: sheet 21, table 15, notes 5, party 4, companions 2,
campaigns 2, cookbook 2): 3,054 `getByRole` (distinct role+name: sheet 474, table 271, party 111),
500 `getByText`, 139 `getByLabel`, 711 locators, 514 `evaluate`. Ids: `#character-pane`, `#sheet-panel`,
`#creature-panel-<id>`, `#creature-tab-<id>`, `#creature-<id>-creature-name`,
`#creature-wolf-sheet-tab-actions` (SheetIdPrefix), `#turn-heading`, `#sending-stone-settings`,
`#prompts-heading`, `#chat-log`. Data attributes: `data-roll-toast` (`<id>`, `gm:<id>`),
`data-turn-toast`, `data-gm-roll`, `data-waits`, `data-side`, `data-page-toast`, `data-state`,
`data-campaign{,-state,-state-label,-status}`, `data-refusal` (wrongSecret, malformed, notSetUp),
`data-seats`, `data-action`, `data-actor-id`, `data-filter-list`, `data-manual-dice`, `data-section`,
`data-tooltip`. Most-read names: tablist 'Character sheet', regions 'Your rolls', 'Character',
'Favorites', 'Combat', 'Chat', 'Your Gamemaster asks', log 'Roll results', dialogs 'Settings',
'Modify damage', 'Longsword attack', switch 'Send to the table'. Requests read: `postDataJSON()` of
`/rolls` POSTs in 7 suites, `on('request')` filters on `/rolls$`, `/notes`, `/cookbook`; paths
`/api/bridge/commands`, `/api/events`, `/api/characters/<id>/{rolls,table,party/company,texts/<h>,
cookbook}`, `/api/campaigns/<id>/{characters/<actor>,party/company}`.
Pinned by: C1 (ids, data attributes, classes), C4 (names/strings), C2 (bodies, URLs, headers), C5/C6
(routes, statuses, headers, refusal bodies), C7 (stored strings/rows); and the e2e full passes.

## (6) Seams

- Phase 2b: none needed by T. M's codemod must rewrite the 33 `jest.setup` imports unless T.3 lands
  first (it does: commit 2), and the 4 relative jest.mock paths.
- Names other areas import from T that move: none (tests import product code, not the reverse).
  Kit names are new. `src/mocks/dice-renderer.ts` (new, W's folder): W must keep it.
- Per lane: a `jest.mock` of a module whose export moves is changed by the lane that moves it (gate 4
  finds misses): `@/lib/session` 47, `@/db/characters` 33, `@/db/roll-requests` 29, `@/db/seats` 19,
  `@/db/party` 19, `@/db/notes` 17, `@/hooks/use-table-view` 11, `@/db/{cookbook,campaigns}` 6,
  `@/hooks/use-notes` 4, `@/db/table` 4; the barrels `@/components/party-sheet` and
  `@/components/game-table` (2 each; index.ts files gone in commit 4) must follow their target.
- Q1's settle hook (U1): EFFECT_SETTLE and WILD_SHAPE_SETTLE must stay read from
  @/constants/sending-stone by the consumer at render time (gate 5), or the two tests' 7000 ms
  overrides stop applying.

## (7) Tests: placement, moved mocks, helpers

Placement per T.8; everything else colocated with its unit and moved with it in commit 4. jest.mock
paths that move: every `@/components/...`, `@/hooks/...` and `@/utils/...` one (rewritten by the
codemod's second pass, then proven by gate 4); `@/db`, `@/lib`, `@/schemas`, `@/constants` keep their
paths unless S/W move them. Helpers duplicated: §3. Overlapping coverage seen (report only; frozen):
the 16 notes route suites repeat the same 401 and 404 checks (2-4 each) per seat kind; game-table.*.test.tsx re-assert sheet behaviour that character-pane.test.tsx covers
(favorites, removals); use-sheet-roller.test.tsx and character-pane.test.tsx both pin dice pools;
db/*.test.ts `given` suites and the bridge route suite both pin createRollRequest's limits.

## (8) Bugs seen (not fixed; logged in bugs-found.md, tag [T])

1. jest.config.ts:16 (`coveragePathIgnorePatterns: 'index.ts'`): the pattern is a regex matched
   anywhere in the path, meant for barrels, and also drops src/components/campaigns/campaign-index.tsx
   (`index.tsx` contains `index.ts`) from coverage and from the 80 % threshold; `'types.ts'` and
   `'auth.ts'` would do the same to any `*types.tsx`/`*auth.ts(x)` file. Reproduce: `npx jest --coverage
   src/components/campaigns` lists no campaign-index.tsx row. Tooling defect.

## (9) Out of scope and risks

Out: two-copy merges (held pairs, `posted` of use-end-turn/use-turn-undo, cookbook `reads`, `settle`,
`wait`, the 2 notes-route variants); near-copies (`answering` ×6, `given` ×7, `held` ×22, route
callers); Q1's excluded extras; any existing assertion; e2e edits; jest.setup's dead exports (G).
Risks: (a) a jest.mock left on a shim path silently mocks nothing: gate 4's closure check is the guard;
(b) per-file React id counter and shared prismaMock implementations (clearMocks, not reset) make
goldens order-dependent unless T.1/T.2's normalizer and resetPrisma are used; (c) locale: LocalTime and
note-time use `toLocale*String` with the machine's default locale: goldens normalize `<time>` text;
(d) C3's fiber walk uses React internals (dev build in jest; stable in 19.3, pinned); (e) jest's
default testMatch makes every .ts under `__tests__/` a suite: no helper files there; (f) fixtures in
src/mocks change under W's "mock base" item: goldens would show it, so W's item must be byte-neutral
for the fixtures' outputs; (g) the base worktree shares node_modules only while package-lock and
prisma/ equal 24f808b's.
