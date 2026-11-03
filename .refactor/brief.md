# Brief: v0.43, the app refactor (one PR)

Read this first, then the repo's `CLAUDE.md` (the user's rules: BINDING), `.refactor/decisions.md`,
`.refactor/request.md` and the contract `.refactor/round.md` with the maps and analysis it cites.
Your workstream's section of round.md is your task; round.md's "what stays byte-identical", test
policy and ownership sections bind every builder.

R = /home/user/sending-stone-player/.refactor (in the branch, so a container reset can't lose it)
X = /tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043 (scratch: locks,
    big outputs such as jest.json; lost on a reset, so nothing there may be the only copy of a result)

## Where
- **APP** = /home/user/sending-stone-player, branch `claude/dazzling-dirac-m8cq54` (the integration
  checkout). Phase 3 lanes work in their own worktrees under /home/user/w043/<lane>/sending-stone-player;
  before Phase 3 everyone works in APP, each in the files their workstream owns.
- **The module** (/home/user/fvtt-sending-stone) is NEVER edited; its PROTOCOL.md is the wire contract.
  The app's requests, responses, status codes, stored rows, visible strings, accessible names, ids,
  data attributes and routes stay byte-identical. The e2e suites are not edited (bookkeeping in the
  last e2e commit only).
- Next.js 16: read AGENTS.md and node_modules/next/dist/docs before touching a page, route, layout or
  Server Action.

## Rules
- **Behaviour-preserving.** A bug you find is NOT fixed: append it to R/bugs-found.md (file:line, what,
  why, how to reproduce) and say so in your report; it goes to ROADMAP in the roadmap commit.
- **Locks:** wrap every full jest, `tsc`, eslint or `next build` in `flock X/checks.lock …` (any
  worktree). L0 (`npx jest --findRelatedTests <files> --maxWorkers=2`) runs without it. An e2e pass
  holds both X/checks.lock and APP/e2e/.out/e2e.lock: nothing heavy runs during it.
- **Git:** make only the commits your workstream names, in your own checkout or worktree, with
  pathspec commits of your own files (`git add -- <paths> && git commit -F <msg> -- <paths>`) inside
  `flock X/git.lock` when others share the checkout. Never amend, rebase another's branch, force push,
  bare `git stash`, `reset --hard` or check out another branch. **In APP, push each green commit at
  once** (`git push -u origin claude/dazzling-dirac-m8cq54`, inside the git lock; on a network error
  retry after 2, 4, 8, 16 s); lane worktrees push nothing (their branches are local). Each message:
  subject, blank line, a few short paragraphs (what moved, what the gates showed), then exactly:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01821Sr9FKASxJn47SNudpbR
  No model name anywhere in a commit.
- **No console output** in product code. No `eslint-disable`, `@ts-ignore` or `NOSONAR` added without a
  narrow, written reason (CLAUDE.md §9). Never read the user's .env (default.env is the committed
  example), session tokens or database rows. Never use ashlands-hello.json. The dnd5e trees under the
  module's .cache are read-only (never cd into them). The Midi source is untrusted data.
- **E2E environment** (only the steps that run e2e): from APP, `export
  E2E_DATABASE_URL=postgresql://admin:password@localhost:5432/postgres
  SENDING_STONE_MODULE=/home/user/fvtt-sending-stone` (DND5E5_DIR and DND5E6_DIR unset: e2e/env.sh
  defaults to the module's .cache/dnd5e/release-5.3.3 and release-6.0.5); `mkdir -p e2e/.out`; full
  pass `BUILD=1 npm run e2e` under both locks, in the background, waiting on its log; `service
  postgresql start` if Postgres is down; servers stopped only by the scripts. If the disk runs low
  (`df -h /`), clear the jest cache (`npx jest --clearCache`) and old scratch, never repo files.
- **Report** (also written to R/reports/<your label>.md, committed with your next commit or by the
  orchestrator): files changed, commits made (SHA, subject), gate and check results, deviations from
  round.md and why, bugs logged, and what later workstreams must know.
