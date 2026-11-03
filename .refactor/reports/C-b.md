# C-b report: WS2 goldens C2, C3, C5, C6 (commit 3)

Worktree /home/user/w043/C-b/sending-stone-player, branch `local/043-C-b`, made from
`claude/dazzling-dirac-m8cq54` at dd3a2ad (round.md §2.3.3); `npm ci`, `npx prisma generate`.

## Commit

- `4cf0df1` test: characterization goldens for wire, composition, routes and refusals
  (parent dd3a2ad; subject as round.md §2.5 commit 3; the two trailers; pathspec commit of its 8 files).

## Files (all new, src/__tests__/golden/**, owners.tsv rows 671, 672, 674, 675, 679)

| file | suite | tests | snapshots |
|---|---|---|---|
| src/__tests__/golden/wire.golden.test.tsx | C2 wire | 55 | 64 |
| src/__tests__/golden/composition.golden.test.tsx | C3 composition (retired in commit 26) | 7 | 7 |
| src/__tests__/golden/routes.golden.test.ts | C5 routes (node) | 141 | 141 |
| src/__tests__/golden/refusals.golden.test.ts | C6 refusals (node) | 243 | 242 |
| src/__tests__/golden/__snapshots__/{wire,composition,routes,refusals}…snap | | | 454 in all |

Total: 446 tests, 454 snapshots. Kit copies (T's, untracked, NOT committed, hashes equal to kit-ready and to
commit 2 850ceed): src/utils/test-utils.ts, src/utils/test-utils-node.ts, src/mocks/dice-renderer.ts,
src/mocks/sheet-providers/sheet-providers.tsx, src/mocks/sheet-providers/types.ts. They will block a plain
rebase onto commit 2 (git won't overwrite untracked files): delete them first (round.md §2.3.4).

## What each suite pins

- **C2 wire**: `sent()` whole (url, method, sorted headers, raw body, `cache`, signal) after each gesture and
  the first poll (`CHECK_EVERY`). Pane gestures (CharacterPane, `rollServer`): save at the player and GM seat,
  skill, ability, death, initiative for the combat, attack at a target then its damage (player and GM),
  attack with advantage out of combat then maximum damage (context menus), a use in an area at a slot
  (Burning Hands, picker), spend (Sorcery Points popover), end concentration (Effects row), Heroic
  Inspiration (confirm), hit die, a description's save / ask / damage / roll with its text GET first,
  damage on its own with choices (Battleaxe, Two-Handed), a companion's view then its attack through
  CompanionPane. useTableRolls sends at both seats: checks (advantage + extras, a prompt's save, an area
  attack with slot/mode/ammunition/itemCast), damage (types + modifiers, typed + kept rerolls, a description's
  critical, damage on its own with every choice), formulas (formula, hit dice at once, hit dice one by one
  where the game takes no hitDice), uses (self + slot + enchant, plain), ask, recharge (typed, kept), every
  command (endConcentration, spend, inspiration, spellSlot, endEnchantment with source, transfer, remove,
  favorite, effect, prepare, wildShape transform / learn / revert, readWildShapeForms), and a busy (429)
  retry. End Turn then Undo (player, GM); a party Take via useTransfers (player, GM); the table poll with no
  flags, every flag and at the GM seat, and its backoff times then 401 → refresh; GameTable's markChatRead
  calls and first poll; useNotes: first read, create/change/remove/resolve/reorder/resolveOrder/preview against
  201/200/204/404/401/500 answers, and its backoff to a 404; usePartySheet (first read and from its page,
  204/401/404); useCompanionView (200/204/404); useCookbookView (200/204/500). And, as JSON strings,
  `toCommand` (player, GM, companion), `toRollRequestView` and `toGmRollView` for each status branch
  (sending, expired, rolling, lost, done, done unseen, failed, failed part way, damage done).
- **C3 composition**: GameTable (player, GM, player with its companion's tab shown), CharacterPane,
  CompanionPane, PartySheet, JournalCard: the tree of area roots and each root's props (functions `fn`,
  elements `el`, DOM nodes by tag, objects two levels deep then their keys) through `ordered()`.
- **C5 routes**: every handler of analysis/T/route-exports.txt (52) by `routeCall` over the real db modules on
  one prismaFake world (The Lonely Mountain: Thorin's player's Character, its GM, roster, the Company, the
  wolf, sheets, texts, a message, a fight, a done roll, a journal with a note, a cookbook link), each case
  `{status, sorted headers, body text, ordered(fake.calls)}`: signed out, another's sheet, not in the roster,
  bad hash, unchanged (204), player seat, GM seat, happy paths (roll 202, note 201/200, dish 202, texts);
  G-S2: events and commands no secret, not Forge, declared and undeclared oversize, bad envelope, protocol,
  ping ok / unknown / wrong secret, no campaign, wrong secret, malformed (recordRefusal's args), heartbeat
  (and of another session: resend), texts 204, a result, OPTIONS ± private network; commands cold, off, held
  with a roll waiting, held with nothing coming. Pages: the static metadata and viewport; each
  generateMetadata, page outcome (returned / notFound digest) and Prisma calls for the player, the GM and a
  stranger; and each page's `requireUser` path when signed out.
- **C6 refusals**: `safeParse` issues (code, path, message, in order) of rollRequestSchema for each of the 30
  kinds (taken, one field wrong, one unknown key) and one with many wrong at once; commandsPollSchema;
  envelopeSchema; per EVENTS type a good payload (parseGameEvent's output) and a malformed one
  (`z.prettifyError` text), with a check that the table covers every type in EVENTS; the notes, cookbook,
  campaign and foundry-settings schemas; and for 13 body routes (rolls ×4 seats, notes POST ×4 books, a note
  PATCH, order PUT/PATCH, preview, cookbook dishes) the status, headers, body and calls for a body sent as
  text, too large, malformed and not one it takes.

## Checks run (all in this worktree, before the commit, on today's code + the kit copies)

- Snapshots written once: `npx jest --ci=false <the 4 files>` (454 written); composition's .snap deleted
  and written again once (over that file only) after a fix (DOM-node props printed React's random
  `__reactFiber$…` keys).
- `npx jest --ci <the 4 files>`: 446 passed, 454 snapshots passed (twice); one C5 test alone with
  `--runInBand -t` passed (order-independent).
- `npx eslint <the 4 files>`: exit 0, no output. `npx next typegen && npx tsc --noEmit`: exit 0.
- Mutation spot-checks (each reverted, file clean after): C2, spend's body keys swapped → "what
  useTableRolls sends › each command at the player seat" (+ gm, + "charges spent") fail; C3, CompanionPane's
  `sharedDice={false}` → "the panes and cards › CompanionPane" and "GameTable › at the player seat, its
  companion's tab shown" fail; C5, markBridgePolled without `lastSeenAt` → "the routes of the module ›
  commands POST, cold" (+ off, held ×2) fail; C6, "Only an attack has a target" reworded → "rollRequestSchema ›
  refuses dice the roll does not throw, and fields of another kind, in its order" fails.
- Not run here: the full L1 (`R/tools/l1.sh`), gates 1-12, `next build` (the orchestrator runs L1 after the
  rebase onto commit 2). jest.config's TZ line is commit 2's; this machine's TZ is UTC already.

## Deviations from round.md, and why

1. **C2's 30 kinds are not all driven from their UI gesture.** 17 go through the pane (or CompanionPane);
   tool, hitDice, formula, recharge, endEnchantment, spellSlot, transfer, remove, favorite, effect, wildShape,
   prepare go through the hook that builds them (useTableRolls' send*, useTransfers), and endTurn / undoEndTurn
   through useEndTurn / useTurnUndo. All pass the one `follow()` choke point, so the bodies are the ones the
   wire carries; the sheet-side composition of those requests (which row, which props) is C1's/C3's ground.
   Not separately covered: U2's G1 per picker path beyond area (self/enchant are in the hook-level uses),
   useDamageRolls per branch (G2; the damage branches are covered at sendDamage), every DescriptionLink kind
   (G3; save, ask, damage, roll are).
2. **Inline inputs in C2**: the hook-level inputs (LocalCheck, LocalUse, LocalDamage, LocalFormula) and one
   description's HTML are literals in the golden, not src/mocks fixtures (src/mocks has none of these shapes).
3. **C3 reads the fiber tree from the container's root** (`__reactContainer$` → `stateNode.current`, walking
   `child`/`sibling`), not from each element's `__reactFiber$` up `.return`: the latter met both alternates of
   a fiber and listed GameTable and CompanionPane twice. "CookbookCard" has no component of that name: the
   area root is `CookbookPanel` (and, like PageToasts, it renders only when open, so no case shows it).
4. **C5 warms the server's three throttles** (`notePlayersSeen`, `noteTableOpen`, `claimDishes`' prune:
   process-wide Maps, bug already logged by S) in `beforeEach`, so no test's Prisma calls depend on which
   ran before it (a test rerun alone with `-t` gives the same snapshot). The throttled writes themselves are
   therefore not in C5 (their unit suites pin them). C5 also fixes the server's randomness:
   `jest.mock('node:crypto')` with `randomUUID` a counter, and `globalThis.crypto.getRandomValues` spied
   (note ids). Not covered from G-S2/G-S5: commands "aborted" and "open changed"; the dish ladder beyond its
   first refusals and an accepted dish.
5. **C6's "wrong secret" and "not set up"** are C5's module cases (both suites would otherwise pin the same
   answers); C6 keeps the body refusals.
6. **Scratch runs**: while authoring, copies of the goldens were run from an untracked scratch-cb/ folder
   with `--ci=false` (their snapshots landed in scratch-cb/__snapshots__, never in the golden folder); the
   folder is deleted. Two of those runs hung (jest's `it.each` took a row's missing 4th field for a `done`
   callback) and held the shared checks lock for ~10 and ~20 minutes before I killed them, which delayed
   other builders' L1s; fixed with a rest parameter in C5's runner.

## Bugs

None new found; nothing appended to bugs-found.md. (The throttles' process-wide Maps are already S's entry.)

## What later workstreams must know

- The goldens mock: C5 `@/lib/session` (getCurrentUser, requireUser — requireUser throws naming its
  returnTo), `next/headers` (headers), `@/clients/auth-client` (authClient), `node:crypto` (spread +
  randomUUID); C6 `@/lib/session`; C2 and C3 `@lambersond/3d-dice-react` (the kit's NO_DICE_RENDERER) and
  `next/navigation` (useRouter). Commit 5's codemod rewrites only their import and mock paths.
- **S**: keep `randomUUID` imported from `'node:crypto'` and note ids from `globalThis.crypto.getRandomValues`;
  importing from `'crypto'` (no `node:`) would escape C5's mock and make its snapshots random. The fake
  answers only the models in its world and returns rows whole (`select` ignored), so a query to a new model,
  a raw query or a changed call order shows in C5 by design.
- **R-a / R-b / U1 / U2 / V1**: C2 pins request bodies as raw strings (key order counts); C3 pins the area
  roots' names (GameTable, CharacterPane, CharacterSheet, RollTray, ChatLog, CombatTracker, TurnToast,
  JournalCard, PartySheet, CompanionPane, CookbookPanel, PageToasts) and the props each is handed until
  commit 26.
- The C2 pane gestures use accessible names ("Cast at 1 target", "Spend Sorcery Points: 8 of 20 left",
  "End concentration on Bless", …) and need `advance(0)` after a `<details>` toggle under fake timers.
