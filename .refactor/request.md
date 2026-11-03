# v0.43 request: the refactor (the user's words, 2026-11-02, Eastern time)

> Start planning out the refactor. This refactor is going to be big, that is fine and why we have all
> our tests. It should be a single MR and only affect the app side. It should not affect the module.
> Any bugs found highlight them in the roadmap for follow-on work. The goal is to reduce complexity so
> that we can move faster in the future. Open the PR when it is ready for review.

## The rules as given
1. **One PR**, in the app repo (lambersond/sending-stone-player) only. Big is fine.
2. **The module is not touched** (lambersond/fvtt-sending-stone): no wire, protocol, hello, command,
   sheet or result change; the app behaves to the module exactly as before (the module's PROTOCOL.md
   is the contract and stays as is).
3. **Bugs found are not fixed in the refactor**: each is written into ROADMAP.md for follow-on work.
4. **The goal: reduce complexity so future work goes faster.**
5. **The tests are the safety net**: jest (290 suites, 8607 tests at the start), `next typegen && tsc`,
   eslint, `next build`, and the e2e lane regression (104 runs over 49 suites, ~62 min), which drives
   the real app against the real module and a Foundry stand-in.
6. Open the PR when ready for review.
7. **CLAUDE.md is binding** (main 81a8278, the user's Engineering Guidelines): SOLID/KISS/DRY with
   judgment; each .tsx exports at most one React component and nothing else; named types in types.ts;
   shared constants in constants.ts; business rules in utilities; React behaviour in localized hooks;
   colocate by default, hoist to the lowest common ancestor, src/features/<feature>/; no circular
   imports; `import type`; no hiding barrels; Server Components by default; DB efficiency; Jest unit
   tests colocated, integration tests in `__tests__/`, behaviour not implementation, no overlapping
   coverage; no eslint-disable/@ts-ignore/NOSONAR without a narrow written reason; definition of done:
   typecheck, lint, Jest and build run, results reported honestly. No SonarQube is configured in the
   repo (no sonar-project.properties); eslint-plugin-sonarjs stands in (decisions Q3).

## Context
- App: /home/user/sending-stone-player (Next.js 16: AGENTS.md, node_modules/next/dist/docs). Branch
  `claude/dazzling-dirac-m8cq54`: 9ae1c44 (ROADMAP: v0.42.1 released; v0.43 the refactor; v0.44 the
  table's feedback, release candidate) + the merge of main 81a8278 (CLAUDE.md, README emptied,
  boilerplate icons gone, session 30 days).
- Module: /home/user/fvtt-sending-stone (read-only; main 94773cb = tag v0.42.1). Its `npm run
  test:setup` fetched dnd5e 5.3.3 and 6.0.5 into its .cache/dnd5e/ (the e2e's defaults).
- Sizes at the start: src/components 113k lines (302 files, 130 tests), src/utils 34k, src/db 31k,
  src/hooks 19k, src/schemas 14k, src/app 13k, src/mocks 6k, src/types 4k, src/lib 4k, e2e 42k.
  Largest non-test files: mocks/sending-stone.ts 4350, schemas/sending-stone.ts 2549,
  character-sheet/roll-tray.tsx 2311, action-entry.tsx 2122, types/sending-stone.ts 2036,
  hooks/use-table-rolls.ts 1696, use-picker.tsx 1679, utils/roll-requests.ts 1629, wild-shape.tsx 1629,
  hooks/use-sheet-roller.ts 1601, db/notes.ts 1591, character-pane.tsx 1589, game-table.tsx 1508.

## Standing constraints
- Never read session tokens or database rows; never read the user's .env (default.env is the
  committed example). No console output in product code. Times in Eastern.
- No force push, no amend, no bare stash. Push every green commit to `claude/dazzling-dirac-m8cq54`
  at once (container resets wipe the machine). The PR is opened only when the refactor is ready.
- Commit trailers: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01821Sr9FKASxJn47SNudpbR`.
