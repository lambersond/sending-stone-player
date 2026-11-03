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
  checkout). **Every builder works in its own worktree from Phase 1 on** (round.md §2.3.3); only the
  orchestrator writes in APP and lands commits there.
- **The module** (/home/user/fvtt-sending-stone) is NEVER edited; its PROTOCOL.md is the wire contract.
  The app's requests, responses, status codes, stored rows, visible strings, accessible names, ids,
  data attributes and routes stay byte-identical. The e2e suites are not edited (bookkeeping in the
  last e2e commit only).
- Next.js 16: read AGENTS.md and node_modules/next/dist/docs before touching a page, route, layout or
  Server Action.

## Rules
- **Behaviour-preserving.** A bug you find is NOT fixed: append it to R/bugs-found.md (file:line, what,
  why, how to reproduce) and say so in your report; it goes to ROADMAP in the roadmap commit.
- **Locks (round.md §2.3.6):** L0 is `flock X/l1-wait.lock true && flock -s X/checks.lock npx jest --ci
  --findRelatedTests <files> --maxWorkers=2`; every full jest, `tsc`, eslint or `next build` (any
  worktree) is `flock X/l1-wait.lock flock X/checks.lock …`; an e2e pass and every e2e rerun take the
  wait, checks and APP/e2e/.out/e2e.lock locks in that order: nothing heavy runs during it.
- **Jest:** every run passes `--ci` (CI is unset here, so without it jest writes missing snapshots); a
  golden's author writes its snapshots once with `--ci=false` over its own files only (§3.1.6). A test
  red in an L1 is rerun once alone before it is called a regression; a flake goes in the report.
- **Git:** make only the commits your workstream names, in your own worktree, on its local branch, with
  pathspec commits of your own files (`git add -- <paths> && git commit -F <msg> -- <paths>`). Never
  amend, rebase another's branch, force push, bare `git stash`, `reset --hard` or check out another
  branch. **Builders push nothing**: the orchestrator lands each commit in §2.5's order (rebase onto
  APP's head, L1 at the rebased commit if the base moved, fast-forward, push with retries after 2, 4,
  8, 16 s). Planning files under R/ that a builder writes go in its own commit or its report. Each message:
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
  defaults to the module's .cache/dnd5e/release-5.3.3 and release-6.0.5); `mkdir -p e2e/.out`. On a
  fresh machine first (the baseline needed both): `npm run e2e:browsers` (Playwright 1.56.1 wants
  Chromium build 1194 in /opt/pw-browsers), and the Postgres role of local/docker-compose.yaml
  (`create role admin with login superuser createdb password 'password'`); the very first pass may
  build before the lane databases exist (Prisma P1003 in the build log): stop it and start again. Full
  pass `BUILD=1 npm run e2e` under both locks, in the background, waiting on its log; `service
  postgresql start` if Postgres is down; servers stopped only by the scripts. If the disk runs low
  (`df -h /`), clear the jest cache (`npx jest --clearCache`) and old scratch, never repo files.
- **Report** (also written to R/reports/<your label>.md, committed with your next commit or by the
  orchestrator): files changed, commits made (SHA, subject), gate and check results, deviations from
  round.md and why, bugs logged, and what later workstreams must know.
