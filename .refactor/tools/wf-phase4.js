export const meta = {
  name: 'v043-phase4',
  description: 'v0.43 Phase 4 by stage: "fab" = F-a and F-b (commits 21, 22) built, reviewed, fixed and landed, then a pushed checkpoint (L1, build, RESUME.md); "g" = G (commits 23, 24) built, reviewed, fixed, landed, then e2e pass 4',
  phases: [
    { title: 'Build', detail: 'the stage\'s builders in their own worktrees' },
    { title: 'Review', detail: 'an independent reviewer per builder' },
    { title: 'Fix', detail: 'one fix round for blocker and major findings (minor where small)' },
    { title: 'Land', detail: 'rebase, L1, build, fast-forward, push' },
    { title: 'Checkpoint', detail: 'green head, RESUME.md, pushed; or e2e pass 4 after G' },
  ],
}
const APP = '/home/user/sending-stone-player'
const R = APP + '/.refactor'
const X = '/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043'
const BR = 'claude/dazzling-dirac-m8cq54'
const STAGE = (args && args.stage) || 'fab'
const WT = l => '/home/user/w043/' + l + '/sending-stone-player'
const READ = 'Read ' + R + '/brief.md first, then the contract ' + R + '/round.md: its amendments at the top, "How to read this", its binding parts (§0.2, §1.0, §1.8, §2.2-§2.3, §3), §1.9 (R1.9.20-.30) and §2.4-§2.5 for your label. ' + R + '/phase4-items.md is the list of Phase 4 items the lanes and integration reported, each with its builder; ' + R + '/owners.tsv\'s phase-4 rows name each file\'s builder. Read the planning files from APP (' + R + '), which is current. '
const OUT = { type: 'object', properties: { ok: { type: 'boolean' }, branch: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, later: { type: 'array', items: { type: 'string' } }, report: { type: 'string' } }, required: ['ok', 'branch', 'commits', 'later', 'report'] }
const REV = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string' }, file: { type: 'string' }, what: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['id', 'severity', 'file', 'what', 'evidence', 'fix'] } }, report: { type: 'string' } }, required: ['findings', 'report'] }
const LANDOUT = { type: 'object', properties: { landed: { type: 'boolean' }, head: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, red: { type: 'string' }, report: { type: 'string' } }, required: ['landed', 'head', 'commits', 'red', 'report'] }
const TASK = {
  'F-a': 'F-a: round.md R1.9.20 (usePopover at the other popovers), R1.9.24 (rollOf at the description link), R1.9.25 (favorites\' chips on ActionChips/UsesChips where the markup equals, else listed), and every phase4-items.md row whose builder is F-a. Commit 21, §2.5\'s subject.',
  'F-b': 'F-b: round.md R1.9.22 (the table poll\'s seen query) and R1.9.23 (seat URLs, HEADER_ICON_BUTTON), at the sites where Phase 3 put them (phase4-items.md and owners.tsv say where), and every phase4-items.md row whose builder is F-b. Commit 22, §2.5\'s subject.',
  G: 'G: round.md R1.9.26 (every phase4-items.md row whose builder is G, or that names no builder), R1.9.27 (dead code; unused exports lose `export`, skipping Next.js special files and \'use server\' modules), R1.9.28 (every CLAUDE.md rule in eslint.config.mjs at `error`, the layered import zones, src/__tests__/import-cycles.test.ts, `eslint .` printing nothing) together with the amendments\' G items (2 (b): the frozen node kit\'s no-null directive and its config block removed together, with a gate 10 allowance for that comment line in R/tools; 4 (c): imports that leave their feature or reach a shared layer use `@/` paths, a codemod over import lines only) → commit 23; then R1.9.29 (ROADMAP.md per §4.5, with every bugs-found.md entry, re-checked at the head and with current paths) and R1.9.30 (metrics after: `sh R/analysis/metrics/run.sh after` into R/analysis/metrics-after.md; §0.4 filled) → commit 24. §2.5\'s subjects.',
}
const build = (l, extra) => agent(READ + 'You are the Phase 4 builder ' + TASK[l] + ' Your worktree: if ' + WT(l) + ' does not exist, `git -C ' + APP + ' worktree add -b local/043-' + l + ' ' + WT(l) + ' ' + BR + '` (`df -h /` first), `npm ci`, `npx prisma generate`; if it exists, continue on its branch. Work only there; never write in APP except appending bugs to ' + R + '/bugs-found.md inside `flock ' + X + '/bugs.lock`. L0 per edit (`flock ' + X + '/l1-wait.lock true && flock -s ' + X + '/checks.lock npx jest --ci --findRelatedTests <files> --maxWorkers=2`), and L1 (`' + R + '/tools/l1.sh ' + X + '/l1/' + l + '/<step> ' + WT(l) + '`, it takes the locks itself) before each commit, not after each edit: the lock queue is shared. Behaviour-preserving (§1.8): goldens, existing assertions and mocked paths unchanged (gate 10 allows import lines that follow a move). Bugs go to bugs-found.md, never into the work. Anything you cannot do inside your files, list in `later`. `next build` at the end under `flock ' + X + '/l1-wait.lock flock ' + X + '/checks.lock`. Push nothing. Report to ' + X + '/reports/' + l + '.md (if the write is refused, put the whole report in your return). ' + (extra || '') + 'Return ok, branch, commits ("SHA subject"), later, report.', { label: 'build:' + l + (extra ? ':fix' : ''), phase: extra ? 'Fix' : 'Build', schema: OUT })
const review = (l, b) => agent(READ + 'You are an independent reviewer of Phase 4 builder ' + l + ' (worktree ' + WT(l) + ', branch local/043-' + l + ', against ' + BR + '). The builder says: ' + JSON.stringify(b).slice(0, 5000) + '\nCheck with evidence, editing nothing: every item of its task done as round.md says (or the deviation justified); behaviour preserved (§1.8; goldens and existing assertions unchanged; the riskiest diffs read closely); ownership (only files whose owners.tsv phase-4 rows name ' + l + ', or the files its items name); CLAUDE.md in the changed files; KISS. Run the goldens and related suites under the L0 lock with --ci. Severity: blocker, major, minor. Return findings and a report.', { label: 'review:' + l, phase: 'Review', schema: REV })
const land = (l, b) => agent(READ + 'You are the orchestrator\'s lander (round.md §2.3.4) for ' + l + '\'s branch local/043-' + l + ' in ' + WT(l) + '. The builder says: ' + JSON.stringify(b).slice(0, 3000) + '\nAll inside one `flock ' + X + '/git.lock`: the worktree must be clean (else stop and report); `git -C ' + WT(l) + ' rebase ' + BR + '` (local branch; a conflict outside an import line: abort and report); L1 at the rebased head (`' + R + '/tools/l1.sh ' + X + '/l1/' + l + '/landing ' + WT(l) + '`), `next build` in the worktree under the two check locks; if green, `git -C ' + APP + ' merge --ff-only local/043-' + l + '` and `git -C ' + APP + ' push -u origin ' + BR + '` (retry after 2, 4, 8, 16 s); copy ' + X + '/reports/' + l + '.md (or the builder\'s report text) to ' + R + '/reports/' + l + '.md and commit it in APP by pathspec as "chore(refactor): ' + l + ' report" (trailers), push. If red, land nothing: return landed false with the failures in `red`. Return landed, head, commits, red, report.', { label: 'land:' + l, phase: 'Land', schema: LANDOUT })
const run = async l => {
  let b = await build(l)
  if (!b || !b.ok) return { l, b }
  const rev = await review(l, b)
  const must = rev ? rev.findings.filter(f => f.severity !== 'minor') : []
  const minor = rev ? rev.findings.filter(f => f.severity === 'minor') : []
  if (must.length || minor.length) {
    const fb = await build(l, 'THIS IS A FIX ROUND after an independent review. Fix every blocker and major finding with NEW commits (never amend; never a golden or an existing assertion); a finding you judge wrong, answer with evidence; fix minor ones where small and inside your files, list the rest in `later`. L1 and `next build` green after. Findings: ' + JSON.stringify(must.concat(minor)) + ' ')
    if (fb && fb.ok) b = fb
  }
  return { l, b, rev }
}
const landLoop = async res => {
  let l = await land(res.l, res.b)
  for (let i = 1; i <= 2 && l && !l.landed; i++) {
    const fb = await build(res.l, 'THIS IS A LANDING FIX ROUND: the landing L1 or build at the rebased head was red: ' + l.red + ' Rebase onto ' + BR + ' yourself, fix with NEW commits, L1 and build green, return. ')
    if (!fb || !fb.ok) break
    l = await land(res.l, fb)
  }
  return l
}
const CK = { type: 'object', properties: { green: { type: 'boolean' }, head: { type: 'string' }, commit: { type: 'string' }, report: { type: 'string' } }, required: ['green', 'head', 'commit', 'report'] }

if (STAGE === 'fab') {
  phase('Build')
  const built = await parallel([() => run('F-a'), () => run('F-b')])
  phase('Land')
  const landed = []
  for (const r of built) landed.push(r && r.b && r.b.ok ? await landLoop(r) : null)
  phase('Checkpoint')
  const ck = await agent(READ + 'You make the checkpoint the user asked for after Phase 4.1 (they are near their weekly usage limit and may have to wait a week before the refactor continues). (1) At APP\'s head (' + BR + '), a full L1 (`' + R + '/tools/l1.sh ' + X + '/l1/checkpoint-4.1 ' + APP + '`) and `next build` in APP under the two check locks. (2) Write ' + R + '/RESUME.md, short and exact: the date and time (Eastern) and head SHA; what is done (commits 1-22 by number and SHA from `git log`, with the Phase 3 lanes and integration, e2e passes 1-3 and their results from R/analysis/e2e/); the checkpoint\'s L1 and build results; what is left, in order (Phase 4.2: G, commits 23-24 and e2e pass 4; Phase 5: review, commit 25; Phase 6: the L3 replay, commits 26-28, the final e2e, the PR), each with its round.md section and the workflow script that runs it (R/tools/wf-phase4.js with {"stage":"g"}, then the review and final scripts still to be written from round.md §2.4\'s Phase 5 and 6 rows); how to rebuild the machine after a reset (brief.md\'s steps: Postgres and its admin role, the module\'s npm ci and test:setup, the app\'s npm ci and prisma generate, Chromium 1194, the jest base regenerated by R/tools/base.sh); open decisions and known flakes (amendments, phase4-items.md rows still open, bugs-found.md); and that nothing lives outside the branch (local worktrees are disposable). (3) Commit RESUME.md (and any results files you wrote) in APP by pathspec under `flock ' + X + '/git.lock` as "chore(refactor): checkpoint after Phase 4.1 (RESUME.md)" with the trailers, push (retry 2, 4, 8, 16 s), and confirm `git -C ' + APP + ' status` is clean and `git -C ' + APP + ' rev-parse HEAD` equals `git -C ' + APP + ' rev-parse origin/' + BR + '` after a fetch. Return green (L1 and build), head, commit, report.', { label: 'checkpoint:4.1', phase: 'Checkpoint', schema: CK })
  return { built, landed, ck }
}
if (STAGE === 'g') {
  phase('Build')
  const g = await run('G')
  phase('Land')
  const lg = g && g.b && g.b.ok ? await landLoop(g) : null
  phase('Checkpoint')
  const E2EOUT = { type: 'object', properties: { green: { type: 'boolean' }, failures: { type: 'array', items: { type: 'object', properties: { run: { type: 'string' }, check: { type: 'string' }, cause: { type: 'string' }, product: { type: 'boolean' }, files: { type: 'string' } }, required: ['run', 'check', 'cause', 'product', 'files'] } }, commit: { type: 'string' }, report: { type: 'string' } }, required: ['green', 'failures', 'commit', 'report'] }
  const pass4 = lg && lg.landed && !(args && args.noE2E) ? await agent(READ + 'You run the e2e FULL pass 4 (round.md §2.3.8, §2.6: after the follow-ups and guards) from APP at its head, BUILD=1, under the wait, checks and e2e locks in that order, in the background, waiting on its log. A failed run is rerun alone once (`ONLY=<suite> BUILD=0 npm run e2e`, same three locks). Compare with ' + R + '/analysis/e2e/base.md and pass3.md; for each failure that also fails alone, say whether it is the product (which commit, which file) or the environment. Edit nothing in src or e2e. Write ' + R + '/analysis/e2e/pass4.md, update ' + R + '/RESUME.md\'s "done" and "left" lines, commit both by pathspec under `flock ' + X + '/git.lock` as "chore(refactor): e2e pass4; RESUME.md" (trailers), push. Return green, failures, commit, report.', { label: 'e2e:pass4', phase: 'Checkpoint', schema: E2EOUT }) : null
  return { g, lg, pass4 }
}
return { error: 'unknown stage ' + STAGE }
