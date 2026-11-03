export const meta = {
  name: 'v043-phase3',
  description: 'v0.43 Phase 3 (lanes by args): each lane builds its items in its own worktree from the Phase 2 head, an independent reviewer checks it, one fix round; branches stay local for integration',
  phases: [
    { title: 'Build', detail: 'the lane builder: its items in order, L1 per item, its commits, next build' },
    { title: 'Review', detail: 'an independent reviewer per lane: contract, ownership, CLAUDE.md, goldens' },
    { title: 'Fix', detail: 'the lane builder fixes blocker and major findings' },
  ],
}
const APP = '/home/user/sending-stone-player'
const R = APP + '/.refactor'
const X = '/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043'
const BR = 'claude/dazzling-dirac-m8cq54'
const BASE = (args && args.base) || BR
const lanes = (args && args.lanes) || []
const WT = l => '/home/user/w043/' + l + '/sending-stone-player'
const READ = 'Read ' + R + '/brief.md first, then ' + R + '/request.md, ' + R + '/decisions.md and the contract ' + R + '/round.md: its amendments at the top, its "How to read this", its binding parts (§0.2, §1.0, §1.8, §2.2-§2.3, §3), then your lane\'s rows in §2.1 and §2.4 and every item they name in §1. ' + R + '/owners.tsv is the binding file matrix: you edit only rows whose lane is yours, in phase 3. Read the planning files from APP (' + R + '), which is current. The Phase 1 and 2 reports in ' + R + '/reports/ say what later workstreams must know: read them. '
const WAIT = 'To wait for something, run a background until-loop and carry on, never a foreground sleep. '
const OUT = { type: 'object', properties: { ok: { type: 'boolean' }, branch: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, phase4: { type: 'array', items: { type: 'string' } }, report: { type: 'string' } }, required: ['ok', 'branch', 'commits', 'phase4', 'report'] }
const REV = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string' }, file: { type: 'string' }, what: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['id', 'severity', 'file', 'what', 'evidence', 'fix'] } }, report: { type: 'string' } }, required: ['findings', 'report'] }
const build = (l, extra) => agent(READ + WAIT + 'You are the Phase 3 lane builder ' + l + '. Your worktree: if ' + WT(l) + ' does not exist, `git -C ' + APP + ' worktree add -b local/043-' + l + ' ' + WT(l) + ' ' + BASE + '` (`df -h /` first), then `npm ci` and `npx prisma generate` in it; if it exists, continue on its branch as it is. Work only there; never write in APP except appending bugs to ' + R + '/bugs-found.md inside `flock ' + X + '/bugs.lock`. Your items in round.md §2.4\'s order for ' + l + ', each: L0 per edit, then L1 (`' + R + '/tools/l1.sh ' + X + '/l1/' + l + '/<item> ' + WT(l) + '`, it takes the locks itself; all checks and gates green; the one exception: gate 9 failing ONLY because warnings moved between folders while that rule\'s total over src does not rise is not red for you, but write each such key (folder, rule, before → after, why) in your report for the orchestrator), and your commits at the points §2.4 marks, with §2.5\'s subjects and the brief\'s trailers. Behaviour-preserving: requests, responses, statuses, stored rows, visible strings, accessible names, ids, data attributes and routes stay byte-identical (§1.8); the goldens (C1-C9) and every existing assertion stay as they are; bugs go to bugs-found.md, never into the work. An edit to a file another lane owns, a name another lane imports, a kit or golden change, or a mocked path is NOT made: write it in `phase4` (file, what, why) and carry on. Split test files: record them in your worktree\'s .refactor/tools/moves.d/' + l + '.tsv and commit that in a chore(refactor) commit at the end. End with `next build` in your worktree under `flock ' + X + '/l1-wait.lock flock ' + X + '/checks.lock` (green). Push nothing. Report to ' + X + '/reports/' + l + '.md (items done, commits with SHA and subject, L1 and gate results, the metrics your items moved: rule (a)/(b) violations, complexity over 15, disables, cycles, deviations from round.md and why, bugs logged, phase4 items, what integration must know). ' + (extra || '') + 'Return ok, branch, commits ("SHA subject"), phase4, report.', { label: 'build:' + l + (extra ? ':fix' : ''), phase: extra ? 'Fix' : 'Build', schema: OUT })
const review = (l, b) => agent(READ + 'You are an independent reviewer of Phase 3 lane ' + l + ' (worktree ' + WT(l) + ', branch local/043-' + l + ', base ' + BASE + '). The builder says: ' + JSON.stringify(b).slice(0, 5000) + '\nCheck with evidence (file:line, command output), editing nothing: (1) every item round.md §2.4 lists for ' + l + ' is done as §1 describes, or its deviation is justified; (2) ownership: `git -C ' + WT(l) + ' diff --name-status ' + BASE + '..HEAD` touches only files whose owners.tsv lane is ' + l + ' (or new files its rows give it); (3) behaviour preserved: §1.8\'s surface, the goldens unchanged (`git diff ' + BASE + '..HEAD -- \'**/__snapshots__/**\' \'src/__tests__/golden/**\'` empty), no existing assertion changed (gate 1/1b), server/client boundaries and directives kept, no new cycle; read the riskiest diffs closely (hook and effect order, memo identities, key order in bodies, render-time state); (4) CLAUDE.md in the lane\'s files after the change: one export per .tsx, types in types.ts, rules in utilities, React behaviour in hooks, colocation, disables only with a reason, complexity under 15 (run `npx eslint <the lane\'s files>` under the L0 lock: `flock ' + X + '/l1-wait.lock true && flock -s ' + X + '/checks.lock …`), KISS (no abstraction that removes no copies); (5) run the goldens and the lane\'s suites under the L0 lock with --ci. Severity: blocker (behaviour or contract broken), major (an item or CLAUDE.md rule not met, or an ownership breach), minor (style, naming, a missed small cleanup). Return findings and a report.', { label: 'review:' + l, phase: 'Review', schema: REV })
const lane = async l => {
  const b = await build(l)
  if (!b || !b.ok) return { l, b, rev: null, fix: null }
  const rev = await review(l, b)
  const must = rev ? rev.findings.filter(f => f.severity === 'blocker' || f.severity === 'major') : []
  const minor = rev ? rev.findings.filter(f => f.severity === 'minor') : []
  if (!must.length && !minor.length) return { l, b, rev, fix: null }
  const fix = await build(l, 'THIS IS A FIX ROUND after an independent review of your branch. Fix every blocker and major finding with NEW commits (never amend; never edit a golden or an existing assertion); a finding you judge wrong, answer in your report with evidence instead. Fix the minor ones too where each is small and inside your files; list the rest. Rerun L1 and `next build` (green) after the fixes. Findings: ' + JSON.stringify(must.concat(minor)) + ' ')
  return { l, b, rev, fix }
}
phase('Build')
const out = await parallel(lanes.map(l => () => {
  if (l === 'W-b+R-b') return (async () => [await lane('W-b'), await lane('R-b')])()
  return lane(l)
}))
return out
