# Value critique of the v0.43 draft (round.md, owners.tsv at a527cfc)

Lens: does each item reduce complexity so later work goes faster, at the least churn; is CLAUDE.md fully
met afterwards; does the scope match decisions Q1; do the targets match metrics-base.md; what ROADMAP v0.44
needs; is the timeline realistic. Line numbers are at a527cfc (src equals 24f808b). "Probe" means
`npx eslint --stdin --stdin-filename src/components/zz-probe/<name>.tsx` run from APP with the repo's own
config. Nothing was written into the repo for them. Probe sources and the icon-button script are in the
scratchpad (probe-*.tsx, iconbtn.cjs).

4 major, 6 minor.

## Findings

### VA F1 (major): most react-hooks disables the plan budgets can be fixed with a destructure

**Evidence.** §0.4 (round.md:89) budgets "≤ 25 of today's kinds" plus react-hooks line disables, "expected
≤ 25 after the splits". §1.7.3 (round.md:843-847) names the two big groups as ones that keep a disable
because fixing them would change render timing: "floating-ui's `refs` object read in render, wild-shape.tsx's
13". Decisions Q2 (decisions.md:7) says "about 30 line-level ones left". The plan's own numbers allow up to
about 50. Of the 29 product `react-hooks/refs` findings (X/metrics-base/eslint.json), 24 come from two
patterns, and neither needs a timing change:
- **floating-ui (12):** `ref={refs.setFloating}` / `refs.setReference` at character-sheet/hit-dice-menu.tsx:150,
  uses-menu.tsx:99, roll-menu.tsx:215, rolls-button.tsx:110, sheet-settings.tsx:144, description-link.tsx:1009,
  inventory-tab.tsx:331, wild-shape.tsx:793, notes/move-menu.tsx:104, :117, :126, :142. Probe A
  (`const { refs } = useFloating(...)`, then `ref={refs.setFloating}`) reports `react-hooks/refs`. Probe B/C
  (a hook does `const { setReference, setFloating } = refs` and returns them, and the component writes
  `ref={setFloating}`) reports nothing in the hook or in the component. R1.1.16's planned API returns
  `{ refs, floatingStyles, context, root }` (round.md:398-403), so every adopter, the 9 of R1.1.16 and
  R1.9.20, keeps its finding.
- **Wild Shape (12 more; the plan's "13" counts :793 above with them):** useWildShape's object carries
  two refs next to render data: `heading` and `body` (wild-shape.tsx:178-180, defaults :207-208, returned
  :612-613). The components write `ref={ws.heading}`
  (:707) and `ref={ws.body}` (:1039). After that, the compiler treats every `ws.*` read in render as a ref
  read (:721, :725, :1019-1039). Probe F (the same shape: `ref={ws.body}` plus `ws.back` and `ws.name`) gives 2
  findings. Probe H (`const { body } = ws`, then `ref={body}`) and probe G (the refs from their own object)
  give 0. A ref object is stable, so taking it out first changes nothing at run time.
- HoldFill (game-table.tsx:1126, :1129: `hold.offer.fill`) has the same shape (2 more; not probed).

**Fix.** R1.1.16: usePopover returns `{ setReference, setFloating, floatingStyles, context, root }`,
destructured once inside the hook. Adopters write `ref={setFloating}`. move-menu's `button` object takes
`ref: setReference`. R1.1.5: each Wild Shape component destructures `heading`/`body` before its render reads,
or useWildShapeFocus hands them over. Every other line stays verbatim. V1 R1.5.11: HoldFill destructures `fill`
(confirm with eslint). §1.7.3: remove both groups from the disables it allows. §0.4: give one target for every
disable left, react-hooks included, ≤ 30 (Q2), each listed in the PR. The 30 other product react-hooks
findings (set-state-in-effect 11, exhaustive-deps 8, purity 3, immutability 3, rules-of-hooks 4,
preserve-manual-memoization 1) are the real budget.

### VA F2 (major): the composition golden C3 stays in the repo, though Q4 keeps only the focused goldens

**Evidence.** Q4 (decisions.md:8) retires "the whole-page markup snapshots that prove nothing changed" and keeps
"the focused wire, words, route, refusal, storage and dice-draw goldens". Composition is not on that list.
The plan still keeps C3: R3.10 deletes only markup.golden.test.tsx (round.md:1364-1366), and commit 26 is
"C1's files only" (round.md:1146). C3 reads React's fiber (`__reactFiber$`, `.return`, `type.name`) and
snapshots the props keys and values of 12 area-root components (round.md:1256-1262). Risk 16 (round.md:1504)
admits it depends on React dev internals. That pins implementation, against CLAUDE.md §8 ("Test observable
behavior rather than implementation details"). It also gets in the way of v0.44's first items:
CharacterSheet's nine props (character-sheet.tsx:75-84) change with item 2 (favorites on the Character tab,
ROADMAP.md:27), RollTray's (roll-tray.tsx:102-112) and the dice dialog's with item 5, and ChatLog's with item
8. Each change breaks C3 with no behaviour at stake. During v0.43 it also blocks any cut to a root's prop
surface (CLAUDE.md §2).

**Fix.** Treat C3 under Q4 (a)'s rule, as a snapshot that proves nothing changed. Commit 26 deletes
composition.golden.test.tsx with C1: R3.10, the §2.5 row 26 text, gate1.allow and counts.conf change to match.
C3's `JSON.stringify` cases of toCommand, toRollRequestView (per status branch) and toGmRollView are wire and
view outputs: write them in C2 (commit 3) so they stay.

### VA F3 (major): three react-hooks rules are turned off for all 290 test files, for findings in 7 of them

**Evidence.** §0.6.6 (round.md:205-208, :839-840) turns `react-hooks/{rules-of-hooks,refs,globals}` off for
`**/*.test.{ts,tsx}`. The 42 test findings are all in 7 files (X/metrics-base/eslint.json):
use-picker.test.tsx (3), notes/chapter-form.test.tsx (7), notes/note-editor.test.tsx (7),
hooks/use-image-fallback.test.tsx (3), utils/roll-requests.test.ts (15), utils/sheet-actions.test.ts (6),
utils/uses.test.ts (1). CLAUDE.md §9 forbids "blanket exclusions" and asks for "a narrowly scoped, documented
justification". With the glob, a hook-order bug in any future test harness passes lint.

**Fix.** Give the override a `files:` list of those 7 suites at their post-move paths, with the reason beside
it. Where R1.4.6 splits roll-requests.test.ts by describe, the list names the pieces that carry `useRequest`.
Every other test keeps the three rules at `error`. The TSX_TYPE exemption for tests can stay: CLAUDE.md §3 is
about reusable types.

### VA F4 (major): one-use, file-private constants are sent to constants.ts, against CLAUDE.md §3 and §4

**Evidence.** §0.3's row (round.md:64) sends "~40 in .tsx/hooks" to "the feature's or folder's constants.ts",
whether they are shared or not. The items follow it:
- R1.5.2 (round.md:668-670): game-table.tsx's NOTHING_READ (:100, one read :216), SIDE_BY_SIDE (:103, :196),
  MOST_PANES (:109, :388), NO_KINDS (:115, :271) and NO_ROW (:1394, :327); SETTLE_FOR (only in
  turn-toast.tsx:57) and OVER_FOR (only in use-end-turn.ts:28), all into FT/constants.ts.
- R1.1.17 (round.md:408-409): item-menu.tsx's 10 MenuItem constants (:23-95), each read once in that file.
- R1.1.4 (round.md:332): character-pane.tsx's TABS, ROLLING, WITH_FAVORITES, COLUMN_FROM, FAVORITES_COLUMN
  (:265-308), none read outside the file.
- R1.5.8's "maps to constants.ts" (round.md:701) and R1.5.16's NO_ACTIONS, TABS (round.md:744).

CLAUDE.md §3: constants.ts "when they are meaningfully shared or represent domain configuration. Avoid
introducing files for trivial one-use values". §4: "Colocate by default". No lint rule asks for the move:
commit 1's rules flag exports from a .tsx, and these constants are not exported (reports/WS0.md, rule (a)).
Moving them adds files and imports, and puts each constant one hop away from its only reader.

**Fix.** Add a placement rule in §1.0 and change §0.3's row to match: a module-level constant moves with the
code that reads it. When a split leaves two or more files reading it, it goes to the folder's constants.ts.
Domain configuration (wire limits, timings a test overrides, ids) goes there too. Anything else stays beside
its one reader, file-private. In R1.1.4, R1.1.17, R1.5.2, R1.5.8 and R1.5.16, replace the lists with that
rule. NO_KEYS (5 reads across several functions) and the exported NO_* context defaults of R1.1.6 (used by
tests and SheetProviders) qualify as shared.

### VA F5 (minor): PLAIN_KINDS plus sendPlain is a table over code that differs everywhere except the part already shared

**Evidence.** R1.2.3 (round.md:453-456) plans `PLAIN_KINDS {gate, body, kept, label}` and one `sendPlain` for
14 send* functions, keeping their names. Each of them (use-table-rolls.ts:639-797) is about 12 lines. All
four columns differ between them:
- the gate: a switch at :642, :657, :675, or a logged field at :694, :711, :728, :745, :768, :786;
- the body field and its key order: wildShape's `label` comes after PLAIN at :789, and effect is wrapped in
  `labelled` at :749-752;
- the kept fields;
- the label: `moveLabel` at :697, :714.

What they share already lives in `start` (:303) and `PLAIN` (:1011), which becomes NO_DICE. The result
would be 14 wrappers, a 14-row table of lambdas and a dispatcher, in place of 14 plain callbacks. That is
more moving parts, it puts key order in a riskier place (§5 risk 1), and it is CLAUDE.md §1's
"implementations that only look similar". The one true copy is the gate `if (!on || !kinds.includes('x'))
return`, 9 times (:470, :529, :598, :623, :642, :657, :675, :828, :852).

**Fix.** Drop PLAIN_KINDS and sendPlain. Keep the named callbacks, adopt `...NO_DICE` as planned, and add one
helper that reads `latest.current` for those 9 gates, for example `takes(kind)`. §0.8's "a sendPlain row" for
items 4 and 7 becomes "a send callback". This takes about 1 h off R1.2.3's 3 h.

### VA F6 (minor): saveTitle "with an option per difference" merges four functions that only look alike

**Evidence.** R1.1.19 and R1.9.21 (round.md:420-423, :952) merge four functions, and they differ in input and
in detail:
- description-link.tsx:272-283: a SaveLink, ability ids, a DC prefix;
- prompt-banner.tsx:199-209: labels, no DC, the `list || 'A'` fallback at :208;
- utils/table-view.ts:391-402: a DC prefix, an `isAbility` filter, a `names[0]` guard;
- db/table.ts:381-398: a switch that also words `check` and `skill`, its own `either`, `?? ability` and
  `.trim()`.

One function would need at least four options to do all four, plus a golden to pin them. CLAUDE.md §1 warns
against a generic abstraction for implementations that only look similar. The one rule all four really share
is "Concentration check (X), naming the ability unless it is Constitution".

**Fix.** Narrow R1.1.19 to that rule, one small function with no options, and let each of the four keep its
own list wording. Or drop R1.1.19 and R1.9.21. Either way, F-b's item and most of the 0.75 h go.

### VA F7 (minor): the 12 route integration suites leave their routes for one folder with long dashed names

**Evidence.** §0.6.9 and §3.3 (round.md:218-220, :1311-1312), with owners.tsv's rows, move each
`src/app/api/<path>/route.test.ts` to `src/app/api/__tests__/<path-dashed>.integration.test.ts`. One example:
`campaigns-id-characters-actor-companions-companion-rolls-roll.integration.test.ts`, eight folders away from
the route it tests. CLAUDE.md §4 says "Colocate by default". §8 says integration tests go in `__tests__/`,
"preferably within the owning feature". Next 16 colocates app files safely and treats underscore folders as
private (node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md:257-271).

**Fix.** Use `<route folder>/__tests__/route.integration.test.ts`. That is one level down, needs no invented
names, and gate 6 is unaffected because it is not a route file. Change §0.6.9, §3.3 and the 12 owners.tsv
rows to match.

### VA F8 (minor): §0.8 overstates what v0.44 item 3 gets from the new shape

**Evidence.** §0.8 (round.md:245-246) says item 3 (larger icon buttons) gets "two class constants" (R1.5.14,
round.md:730-733). I listed the product `<button aria-label>` elements whose only child is an icon component
(TS AST, scratchpad iconbtn.cjs). There are 34, in 21 files, with 20 different className expressions. The two
constants cover about 10 of them, and §6 (round.md:1522) leaves the IconButton component to item 3.
JOURNAL_ICON_BUTTON is still a fair 3-copy merge (notes/contents.tsx:106, chapter-pane.tsx:15,
note-pane.tsx:31).

**Fix.** Keep R1.5.14. In §0.8 say that item 3 still visits about 34 buttons in 21 files, and list them in the
PR's follow-ups so v0.44 starts from that list.

### VA F9 (minor): nothing guards against type-only import cycles once .refactor/ is gone

**Evidence.** Q3 (decisions.md:9) asks the linter to enforce no import cycles, and the plan counts type-only
cycles as cycles (§0.1). eslint-plugin-import-x's no-cycle always skips `import type`, with no option to change
that (node_modules/eslint-plugin-import-x/lib/rules/no-cycle.js:68-72). §1.7.3 (round.md:841-842) relies on
"the metrics' type-only cycle report" for them. That report is .refactor/analysis/metrics/graph.mjs, deleted
by commit 28 (round.md:1148). From v0.44 on, a type-only loop such as the four groups of metrics-base §5 can
come back unseen.

**Fix.** In commit 23, G adds `src/__tests__/import-cycles.test.ts` (node). It builds src's import graph with
the TypeScript compiler API (already installed), type-only edges included, and expects no strongly connected
component: graph.mjs's Tarjan step, about 60 lines. Add it to counts.conf and to §3.1.3's list of allowed new
tests. About 0.5 h.

### VA F10 (minor): the timeline's critical path is one agent's codemods, with 3 h budgeted for both

**Evidence.** In Phase 1, M has R1.6 (9-11), the gate scripts (11-2) and both codemods plus their dry run
(2-5 PM) (round.md:1560, :1097-1098, :1362). The 2a moves (5-7:30) and 2b (7:30 PM to 2 AM) follow
(round.md:1561-1562). None of the nine lanes can start before commit 8. export-move.cjs has the plan's least
tested estimate: TS "Move to file" for 218 names into 140 modules, a mock retarget pass, and a full dry run.
Any slip there moves Phase 3 and the PR hour for hour. Meanwhile W-a's builder is idle until Phase 3, though
it owns roll-kinds.ts afterwards (round.md:788). The rest of the timeline holds up. Phase 3's per-item L1s
come to about 81 × 6 min ≈ 8 h of checks-lock time across about 23 h of wall time (about 35 %), which fits
the 20 % per lane allowed (round.md:1549). The ±30 % slack line (round.md:1577-1580) is honest.

**Fix.** W-a's builder writes R1.6 in Phase 1 (2 h, new files, landing in commit 2). That gives M 5 h for the
two codemods and the dry run. §8 then shows M's chain as the critical path with its own slack.

## Checked, no finding

- **Q1 scope.** All five consolidations and both splits are in: R1.6, R1.3.2 with R1.1.2, R1.9.4 with
  R1.2.2, R1.1.1, R1.3.4, R1.1.4, R1.5.5. None of the exclusions crept in. R1.5.9 composes the End Turn
  hooks without a state machine. R1.5.10 and R1.5.13 share helpers, not a poller. R1.5.15 adds no journal
  context. SheetContext and PaneContext already exist as provider components (character-pane.tsx:1380,
  :1445).
- **The four server creators are near copies,** so createCommand earns its place (db/effects.ts:32-119 and
  db/favorites.ts:35-123 differ only in field, switch, check and clash test).
- **Targets against metrics-base.** These match: 999 warnings, 74 rule-(a) files, 171 + 121 types, 63
  functions over 15, 4 cycle groups, 27 barrels, 430 disables, 101 react-hooks findings (59 product and 42
  test), and 25 no-store files. The one mismatch is the disables budget (F1).
- **v0.44.** The two held functions are where item 1 rewrites. Items 4 and 7 land on one kind row and one
  command spec. Item 2 is blocked only by C3 (F2), item 3 is F8.

## To the user (not covered by the decisions)

1. **May Phase 1 start as soon as the revised plan is pushed, about 3 AM Tue, instead of after your review
   at about 9 AM?** Phase 1 only adds tests, tools and new files: the kit, the goldens, the gate scripts and
   roll-kinds.ts. It changes no product code. §8 (round.md:1579-1580) says this moves the PR about 6 h
   earlier, but the plan does not ask.
