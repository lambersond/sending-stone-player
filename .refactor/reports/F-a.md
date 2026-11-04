# F-a (Phase 4, commit 21): report

Builder F-a, worktree /home/user/w043/F-a/sending-stone-player, branch local/043-F-a, made from APP's
head 680d60e (claude/dazzling-dirac-m8cq54). Nothing pushed; nothing written in APP.

## Items

### FA-1 (R1.9.20): usePopover at the other five popovers: done

| file | before | after |
|---|---|---|
| src/features/rolling/components/roll-menu/choice-menu.tsx | usePortalRoot, useTopmostEscape(true), useFloating(anchor, placing(point), offset/flip/shift(crossAxis)/size), `const { setFloating } = refs`, layout effect on `refs` | usePopover({ open: true, onOpenChange, anchor, placement, gap, across, fit }); the layout effect calls `setPositionReference` (deps `[anchor, point, setPositionReference]`), as hit-dice-menu does |
| src/features/rolling/components/rolls-button/rolls-button.tsx | usePortalRoot, useFloating(bottom-end, offset(6), flip, shift, size), `const { setReference } = refs`, `attach` calling `refs.setFloating` | usePopover({ open, onOpenChange, placement: 'bottom-end', gap: 6, fit, escape: false }); `attach` calls `setFloating` (deps `[setFloating]`) |
| src/features/sheet/components/wild-shape/return-popover.tsx | usePortalRoot, useTopmostEscape(true), useFloating(anchor, bottom-end, offset(6), flip, shift), `ref={refs.setFloating}` | usePopover({ open: true, onOpenChange, anchor, placement: 'bottom-end', gap: 6 }), `ref={setFloating}` |
| src/features/sheet/components/sheet-settings/sheet-settings.tsx | usePortalRoot, useTopmostEscape(open), useFloating(bottom-end, offset(6), flip, shift, size), `refs.setReference`, `refs.setFloating` | usePopover({ open, onOpenChange: change, placement: 'bottom-end', gap: 6, fit }); `setReference`, `ref={setFloating}` |
| src/features/notes/components/move-menu/move-menu.tsx | usePortalRoot, useTopmostEscape(open), useFloating(bottom-end, offset(4), flip, shift, size), `ref: refs.setReference`, `ref={refs.setFloating}` | usePopover({ open, onOpenChange: setOpen, placement: 'bottom-end', gap: 4, fit }); `ref: setReference`, `ref={setFloating}` |

Why each is behaviour-preserving:

- **Middleware and options.** usePopover builds `offset(gap), flip({ padding: 8 }), shift({ padding:
  8[, crossAxis] }), size(fit)` with `whileElementsMounted: autoUpdate`, the order every site had.
  - Where a site gave no crossAxis, the hook gives none: `across` is undefined there.
  - ChoiceMenu's `placing()` always returns a boolean `across`, so its `crossAxis` is passed as
    before.
  - `elements.reference` is set exactly where the site had an anchor (ChoiceMenu, ReturnPopover:
    always an HTMLElement).
  - Each size callback and its comment are moved unchanged into `fit`.
- **Hook order.**
  - Inside the hook: usePortalRoot (a `use(context)` read), then useTopmostEscape, then
    useFloating. That is the order the sites called them in.
  - RollsButton read usePortalRoot before useCreature and its `inside` state. It now reads it
    inside usePopover, after them. A context read holds no hook slot and has no effect, so nothing
    observable moves.
  - RollsButton gains `useTopmostEscape(false)`, an effect that returns at once (amendment 5 (e),
    phase4-items FA-1). Its Escape quirk is kept: no document keydown listener, so Escape still
    goes on to a dialog opened from it.
- **Stable callbacks.**
  - In @floating-ui/react 0.27.20 and react-dom 2.1.9, `refs` is a useMemo over `position.refs`,
    `setReference` and `setPositionReference`. Each of those is memoized on `position.refs`, and
    `position.refs` is a useMemo over two useCallback([]) setters.
  - So `refs`, `setFloating`, `setReference` and `setPositionReference` change identity together,
    never within a mount.
  - So the deps swaps (`[refs]` to `[setFloating]` in RollsButton's attach, `refs` to
    `setPositionReference` in ChoiceMenu's layout effect) run those callbacks and effects exactly
    as often as before.
- **RollsButton's onOpenChange** still reads floating-ui's close reason. usePopover passes
  `onOpenChange` to useFloating unchanged. Its parameters are now written out as floating-ui types
  them, `(next: boolean, _?: Event, reason?: OpenChangeReason)`, since the hook's own type names
  only `open` (see `later`).

eslint over the five files: the integrated head had 6 react-hooks/refs findings here, G-11's V2 and
U1 share (move-menu 4, sheet-settings 1, return-popover 1). All 6 are gone. A per-(file, rule) diff of
the integrated head's eslint.json against this L1's shows only those three keys changing, none
rising.

### FA-2 (R1.9.24): rollOf at the description link: done

src/features/sheet/components/description-link/utils.ts `rollAgainst` now calls
`actions.roll(rollOf(target, chosen ?? toAdvantage(target.mode), chosen !== undefined, { dc, ask:
target.ask }))`.

rollOf (src/features/rolling/utils/sheet-rolls.ts) builds `label, modifier, advantage, [extras],
source, explicit, [dc], [ask]`. With no extras, these are the keys the inline literal had, in the
same order, with the same guards:

- `dc !== undefined`
- `ask` truthy

The new import edge is FS → FR/utils/sheet-rolls. sheet-rolls imports only FR/types and
@/types/roll, which this file already imports, so no cycle is added. C2 pins the request.

### FA-3 (R1.9.25): favorites on ActionChips, UsesChips and RowName: nothing adoptable (listed)

FavoriteRow (src/features/sheet/components/favorites/favorite-row.tsx) draws no chip row of its
own:

- **Already on the cluster.** Its action, spell, item and feature favorites go through ActionEntry,
  SpellEntry, ItemEntry and FeatureEntry, which U2 put on ActionChips, UsesChips and RowName.
  - ActionEntry passes `place='row'` and `fold={… && look.uses === undefined}`. That is the base
    ChipUses `always` for a favorite resource's action.
  - Its slots, class and other-item favorites go through SheetEntry, which draws RowName.
- **What stays as it is, because the markup differs** (C1 and the e2e read it):
  1. **The resource favorite's aside** (`case 'resource'`): a bare `<UsesButton>` in SheetEntry's
     aside. UsesChips with place='row' would wrap it in `<span data-uses class="shrink-0">`. It
     would also add a RechargeChip where `rechargeOf(rows, uses)` gives one. The base favorite has
     neither: a new data-uses span, and a new chip.
  2. **CheckEntry's name block.** It is `<span class="min-w-0 flex-1"><span class="block truncate
     font-medium">label</span><span class="block truncate text-xs text-text-secondary">…</span></span>`.
     RowName draws the name inside `<span class="flex items-center gap-1"><span class="truncate
     font-medium">`. The wrapper, the classes and the star slot all differ.
  3. **CheckEntry's ModeChip and modifier:** no cluster component draws this pair.

So the file is unchanged. owners.tsv row 921's R1.9.25(F-a) grant goes unused, and so does row
188's (favorites.tsx).

## Checks

Commit: **e6735b0** `refactor: popovers, roll labels and chips adopted across areas`, on
local/043-F-a. Its parent is 680d60e. Files: the six above (+77 −136). No test, golden, mock, kit
or planning file changed.

- **L0, FA-1:** `npx jest --ci --findRelatedTests` over the five popover files, under
  `flock l1-wait true && flock -s checks`. 68 suites and 2,889 tests passed, with 478 snapshots;
  eslint over the five files printed nothing.
  - The first attempt was killed at its 20-minute background limit while queued behind the e2e
    pass (01:45-02:45 UTC). It had not started jest. It was queued again and ran at 02:45.
- **L0, FA-2:** description-link/utils.ts. 48 suites and 1,702 tests passed, with 478 snapshots;
  eslint printed nothing.
- **L1:** `.refactor/tools/l1.sh X/l1/F-a/commit21 <worktree>`, run on the tree that was then
  committed, 03:06:47 to 03:10:18 UTC. 0 failed.
  - jest: 316 suites, 9,726 tests, 0 red, 0 flaky, 0 suites that did not run.
  - typegen ok; tsc ok (0 errors).
  - eslint: 1,154 files, 0 errors, 108 warnings (114 at the integrated head).
  - gates 1, 1b, 2, 3, 4, 4b, 5-12: all ok. Gate 9 at 108 against ratchet-moved.json; gate 10:
    991 golden tests, 24 frozen files held; gate 12: 0 cycle groups.
  - Output: X/l1/F-a-commit21.out, and the folder X/l1/F-a/commit21/.
- **`next build`:** at e6735b0, under `flock l1-wait flock checks`. Exit 0. Its route table is
  byte-identical to the integrated head's (X/l1/integrate/V2/build.log). Its only warnings are the
  same 6 Better Auth "Base URL is not set" environment lines the integrated build prints. Log:
  X/l1/F-a/commit21-build.log.
- **Not run:** e2e (builders run none, §2.3.3) and SonarQube (not configured here).
- **prettier --check** over the six files: clean.

## Later (not doable inside F-a's files)

1. **R1.9.25 is listed, not done.** FavoriteRow has no site where ActionChips, UsesChips or RowName
   gives byte-equal markup:
   - A resource favorite's bare UsesButton would gain UsesChips' data-uses span and a possible
     RechargeChip.
   - CheckEntry's name block is not RowName's.
   - CheckEntry's ModeChip and modifier have no cluster counterpart.
   Adopting any of them changes C1's markup, so it would be a behaviour question for v0.44, not a
   refactor.
2. **usePopover's onOpenChange type** (src/hooks/use-popover.ts, U2's in Phase 3, G's after) is
   `(open: boolean) => void`. The hook passes the callback to useFloating unchanged, so RollsButton
   still gets floating-ui's `reason`. The pass-through is not in the hook's type, though.
   - Optional for G: type it as floating-ui's `UseFloatingOptions['onOpenChange']`.
   - Otherwise, a later wrapper inside the hook would silently drop the reason and break
     RollsButton's "Escape on a menu inside closes only that".

## Deviations from round.md

- **R1.9.25:** no code change, since no site has byte-equal markup (the item says "else listed").
- **RollsButton's onOpenChange parameters** are written out with floating-ui's own optional types,
  where the base relied on contextual typing from useFloating. The type is the same as before.

## Bugs logged

None.

## What later workstreams must know

- No exported name moved and no file was added or removed. No test file, golden, mock or kit file
  changed.
- usePopover now has nine adopters, and no file outside src/hooks/use-popover.ts imports
  useFloating.

## Fix round 1 (after the independent review): no new commit

The review had no blocker or major findings, only two minor ones. Neither has a fix inside F-a's
files, so no commit was made. The branch stays at e6735b0, and the worktree is clean (`git diff
--quiet`; tree 9a529beb9f7c38f8bea85625cb9e242002cf50ad).

- **FA-R1 (usePopover's onOpenChange type): agreed, and not F-a's to fix.**
  - owners.tsv:777 gives src/hooks/use-popover.ts to lane U2, in phase 3 only, with no R1.9.xx(F-a)
    grant. G owns it after that, so editing it here would break §2.2.
  - RollsButton's handler cannot go back to inferred parameters until the hook's option type
    changes. Today the contextual type is `(open: boolean) => void`, which carries no `reason`. So
    rolls-button.tsx stays as committed.
  - The pass-through is pinned by rolls-button.test.tsx R6 and R9, so a wrapper that drops `reason`
    turns them red.
  - Carried to `later` for G (commit 23): type the option as
    `UseFloatingOptions['onOpenChange']`, then RollsButton's parameters can be inferred again.
    Both edits are type-only.
- **FA-R2 (R1.9.25's three sites would be lost when .refactor/ goes in commit 28): agreed, and
  no code change.**
  - The review's evidence matches FA-3 above: the bare UsesButton in SheetEntry's aside,
    CheckEntry's name block against RowName's, and CheckEntry's ModeChip and modifier pair.
  - Carried to `later` as the one line for G to paste into R1.9.29's ROADMAP edit or the PR's
    notes (§7): "favorites' resource and check rows not on UsesChips/RowName: would change markup".
  - None of the three is a bug, so bugs-found.md is untouched.

**Checks.** The L1 and `next build` from the first round still hold for this tree. I did not run
them again, to keep the shared lock queue free:

- **L1:** X/l1/F-a/commit21, 03:06:47 to 03:10:18 UTC, 0 failed. The six committed files were
  last modified between 01:51 and 02:03 UTC, before the L1 started, and e6735b0 was committed at
  03:11:04. So the L1 ran on exactly the committed tree.
- **Build:** X/l1/F-a/commit21-build.log, rc 0.
- **What changed in APP since 680d60e:** APP's head is now 89f6884, and its R/ changes are
  analysis/conflicts.md, analysis/e2e/pass3.md and patches/F-{a,b}/uncommitted.diff. No gate
  reads them: tools/ names them only in snapshot.sh, wf-integrate.js and wf-phase4.js. The
  ratchet, allowlists and moves.tsv are unchanged, so a rerun would check the same inputs.
