export const meta = {
  name: 'v043-phase5',
  description: 'v0.43 Phase 5: three independent reviewers over commits 2-24, a skeptic per review, area fixers for confirmed findings (commit 25), landed; then a pushed checkpoint (L1, build, RESUME.md)',
  phases: [
    { title: 'Review', detail: 'RV1 server/wire/checks, RV2 rolling/sheet, RV3 table/UI/tests/guards' },
    { title: 'Verify', detail: 'a skeptic per review tries to refute each blocker and major finding' },
    { title: 'Fix', detail: 'one fixer per area with confirmed findings, own worktree' },
    { title: 'Land', detail: 'rebase, L1, build, fast-forward, push' },
    { title: 'Checkpoint', detail: 'green head, RESUME.md, pushed' },
  ],
}
const APP = '/home/user/sending-stone-player'
const R = APP + '/.refactor'
const X = '/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043'
const BR = 'claude/dazzling-dirac-m8cq54'
const WT = l => '/home/user/w043/' + l + '/sending-stone-player'
const READ = 'Read ' + R + '/brief.md first, then ' + R + '/RESUME.md (where the refactor stands), then the contract ' + R + '/round.md: its amendments 1-6 at the top, "How to read this", §0.2 (principles), §1.8 (what stays byte-identical), §2.5 (the commits), §3 (test policy) and the §1 items your area names. The repo\'s CLAUDE.md is binding. The commits are on ' + BR + ' in APP (' + APP + '); find each by its §2.5 subject with `git -C ' + APP + ' log --format="%h %s"` (after commit 8 they landed in the order 12, 13, 14, 9, 10, 11, 15-24, each with fix commits beside it). '
const FIND = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string' }, area: { type: 'string' }, file: { type: 'string' }, what: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['id', 'severity', 'area', 'file', 'what', 'evidence', 'fix'] } }, report: { type: 'string' } }, required: ['findings', 'report'] }
const VER = { type: 'object', properties: { verdicts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, real: { type: 'boolean' }, severity: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'real', 'severity', 'reason'] } } }, required: ['verdicts'] }
const OUT = { type: 'object', properties: { ok: { type: 'boolean' }, branch: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, answered: { type: 'array', items: { type: 'string' } }, report: { type: 'string' } }, required: ['ok', 'branch', 'commits', 'answered', 'report'] }
const LANDOUT = { type: 'object', properties: { landed: { type: 'boolean' }, head: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, red: { type: 'string' }, report: { type: 'string' } }, required: ['landed', 'head', 'commits', 'red', 'report'] }
const AREAS = {
  RV1: { area: 'server', scope: 'the server, wire and checks: commits 9, 10, 11 (S), 12, 13 (W-a), 14 (W-b) and 22 (F-b), with their fix commits; src/app/api, src/app/**/actions.ts, src/lib, src/db, src/clients, src/schemas, src/types, src/constants, src/mocks, src/utils/requests and the server utils' },
  RV2: { area: 'rolling-sheet', scope: 'rolling and the sheet: commits 15 (R-a), 16 (R-b), 17 (U1), 18 (U2) and 21 (F-a), with their fix commits; src/features/rolling, src/features/sheet, src/hooks/use-popover.ts, use-follow.ts and the rolling and sheet utils' },
  RV3: { area: 'table-ui', scope: 'the table, the other UI, tests and guards: commits 2-8 (the kit, the goldens C1-C9, the moves, no-null off, export moves, seams), 19 (V1), 20 (V2), 23 and 24 (G: lint at error, zones, the import-cycle test, dead code, ROADMAP, metrics), with their fix commits; src/features/table, notes, party, companions, campaigns, characters, transfers, cookbook, src/components, src/app pages and layouts, src/__tests__, eslint.config.mjs, ROADMAP.md' },
}
const review = k => agent(READ + 'You are Phase 5 reviewer ' + k + ' (round.md §2.4 "Phase 5"), independent of the builders. Your area: ' + AREAS[k].scope + '. Review against the contract, editing nothing: (1) behaviour preserved: §1.8\'s surface (requests and bodies with key order, routes, statuses, headers, stored rows, visible strings, accessible names, ids, data attributes), read the riskiest diffs closely (hook and effect order, memo identities, render-time state, timers, key order, transaction order, refusal order, server/client boundaries and directives); run the goldens and the area\'s suites (`flock ' + X + '/l1-wait.lock true && flock -s ' + X + '/checks.lock npx jest --ci <paths> --maxWorkers=2` in APP); (2) every §1 item of the area done as described, or its deviation justified in an amendment or report (' + R + '/reports/); (3) CLAUDE.md in the area\'s files now: one export per .tsx, named types in types.ts, rules in utilities, React behaviour in hooks, colocation, no cycles, disables only with a reason, KISS (an abstraction must remove copies), tests placed per §8; (4) correctness bugs the refactor introduced (a bug that is at the base too is not a finding: append it to ' + R + '/bugs-found.md under `flock ' + X + '/bugs.lock` if it is not there yet). Severity: blocker (behaviour or contract changed), major (an item or a CLAUDE.md rule not met, a real bug introduced), minor (naming, a small cleanup, a comment). Each finding needs evidence (file:line, command output) and a concrete fix. Set area to "' + AREAS[k].area + '" unless the fix lies wholly in another area (then "server", "rolling-sheet" or "table-ui"). Write your report to ' + X + '/reports/' + k + '.md as well (if refused, put it all in your return). Return findings and report.', { label: 'review:' + k, phase: 'Review', schema: FIND })
const verify = (k, r) => agent(READ + 'You are a skeptic for reviewer ' + k + '. For each blocker and major finding below, try to REFUTE it: reproduce or read the evidence yourself in APP at its head; check whether the behaviour is the base\'s too (`git show 24f808b:<old path>`; moves are in ' + R + '/tools/moves.tsv), whether an amendment or a report already accepts it, whether the "fix" would itself change behaviour. Default to real=false when the evidence does not hold up. You may lower a severity (e.g. major to minor) with a reason. Edit nothing. Findings: ' + JSON.stringify(r.findings.filter(f => f.severity !== 'minor')) + ' Return a verdict per finding id.', { label: 'verify:' + k, phase: 'Verify', schema: VER })
const fixer = (area, findings, extra) => agent(READ + 'You are the Phase 5 fixer for area "' + area + '" (round.md §2.4 "Phase 5": findings fixed by the area\'s builder in a worktree from the branch head). Your worktree: if ' + WT('fix-' + area) + ' does not exist, `git -C ' + APP + ' worktree add -b local/043-fix-' + area + ' ' + WT('fix-' + area) + ' ' + BR + '` (`df -h /` first), `npm ci`, `npx prisma generate`; else continue on its branch. Work only there; never write in APP except appending bugs to ' + R + '/bugs-found.md under `flock ' + X + '/bugs.lock`. Fix every confirmed finding below (blocker and major first; minor ones where small and inside the area), behaviour-preserving (§1.8: goldens, existing assertions and mocked paths unchanged); a finding you judge wrong, answer in `answered` with evidence instead of changing code. L0 per edit (`flock ' + X + '/l1-wait.lock true && flock -s ' + X + '/checks.lock npx jest --ci --findRelatedTests <files> --maxWorkers=2`), then L1 (`' + R + '/tools/l1.sh ' + X + '/l1/fix-' + area + ' ' + WT('fix-' + area) + '`, it takes the locks) and `next build` under `flock ' + X + '/l1-wait.lock flock ' + X + '/checks.lock`, all green. One commit, "fix: review findings (v0.43, ' + area + ')", a short paragraph per finding id, the brief\'s trailers. Push nothing. Report to ' + X + '/reports/fix-' + area + '.md (if refused, put it in your return). ' + (extra || '') + 'Findings: ' + JSON.stringify(findings) + ' Return ok, branch, commits ("SHA subject"), answered, report.', { label: 'fix:' + area + (extra ? ':again' : ''), phase: 'Fix', schema: OUT })
const land = (area, b) => agent(READ + 'You are the orchestrator\'s lander (round.md §2.3.4) for the Phase 5 fixer branch local/043-fix-' + area + ' in ' + WT('fix-' + area) + '. The fixer says: ' + JSON.stringify(b).slice(0, 3000) + '\nAll inside one `flock ' + X + '/git.lock`: the worktree must be clean (else stop and report); `git -C ' + WT('fix-' + area) + ' rebase ' + BR + '` (local branch; a conflict: abort and report); L1 at the rebased head (`' + R + '/tools/l1.sh ' + X + '/l1/fix-' + area + '-landing ' + WT('fix-' + area) + '`) and `next build` in the worktree under the two check locks; if green, `git -C ' + APP + ' merge --ff-only local/043-fix-' + area + '` and `git -C ' + APP + ' push -u origin ' + BR + '` (retry after 2, 4, 8, 16 s); copy ' + X + '/reports/fix-' + area + '.md (or the fixer\'s report text) to ' + R + '/reports/fix-' + area + '.md and commit it in APP by pathspec as "chore(refactor): Phase 5 ' + area + ' fix report" (trailers), push. If red, land nothing: return landed false with the failures in `red`. Return landed, head, commits, red, report.', { label: 'land:' + area, phase: 'Land', schema: LANDOUT })

phase('Review')
const reviewed = await pipeline(Object.keys(AREAS),
  k => review(k),
  async (r, k) => {
    if (!r) return { k, r, v: null }
    const hard = r.findings.filter(f => f.severity !== 'minor')
    const v = hard.length ? await verify(k, r) : { verdicts: [] }
    return { k, r, v }
  })
const confirmed = []
for (const x of reviewed.filter(Boolean)) {
  if (!x.r) continue
  const verdicts = new Map(((x.v && x.v.verdicts) || []).map(v => [v.id, v]))
  for (const f of x.r.findings) {
    if (f.severity === 'minor') { confirmed.push(f); continue }
    const v = verdicts.get(f.id)
    if (!v) { confirmed.push(f); continue }
    if (v.real) confirmed.push({ ...f, severity: v.severity || f.severity, skeptic: v.reason })
  }
}
const byArea = {}
for (const f of confirmed) (byArea[f.area] = byArea[f.area] || []).push(f)
log('Confirmed findings by area: ' + Object.keys(byArea).map(a => a + ' ' + byArea[a].length).join(', '))

phase('Fix')
const fixes = await parallel(Object.keys(byArea).map(a => async () => {
  const b = await fixer(a, byArea[a])
  return { a, b }
}))
phase('Land')
const landed = []
for (const x of fixes.filter(Boolean)) {
  if (!x.b || !x.b.ok || !x.b.commits.length) { landed.push({ a: x.a, l: null }); continue }
  let l = await land(x.a, x.b)
  for (let i = 1; i <= 2 && l && !l.landed; i++) {
    const fb = await fixer(x.a, byArea[x.a], 'THIS IS A LANDING FIX ROUND: the landing L1 or build at the rebased head was red: ' + l.red + ' Rebase onto ' + BR + ' yourself, fix with a NEW commit, L1 and build green, return. ')
    if (!fb || !fb.ok) break
    l = await land(x.a, fb)
  }
  landed.push({ a: x.a, l })
}

phase('Checkpoint')
const CK = { type: 'object', properties: { green: { type: 'boolean' }, head: { type: 'string' }, commit: { type: 'string' }, report: { type: 'string' } }, required: ['green', 'head', 'commit', 'report'] }
const ck = await agent(READ + 'You make the checkpoint after Phase 5. (1) At APP\'s head, a full L1 (`' + R + '/tools/l1.sh ' + X + '/l1/checkpoint-5 ' + APP + '`) and `next build` in APP under the two check locks. (2) Update ' + R + '/RESUME.md: the date and time (Eastern) and head SHA; Phase 5 done (the three reviews, the skeptics\' verdicts, the fix commits by area with SHAs, the findings answered instead of fixed, the minor findings left for the PR\'s notes: write them into a "Phase 5 findings" section); the checkpoint\'s L1 and build results; what is left (Phase 6 per round.md §2.4: the L3 replay with R/tools/replay.sh over commits 2-25, commit 26 retiring C1, C3 and C9, the final e2e and a rerun round, commit 27 e2e bookkeeping, commit 28 removing .refactor/, the PR per §7; no workflow script exists for Phase 6 yet). Summary of this run: ' + JSON.stringify({ reviews: reviewed.filter(Boolean).map(x => ({ k: x.k, n: x.r ? x.r.findings.length : null, verdicts: x.v && x.v.verdicts })), fixes: fixes.filter(Boolean).map(x => ({ a: x.a, ok: x.b && x.b.ok, commits: x.b && x.b.commits, answered: x.b && x.b.answered })), landed: landed.map(x => ({ a: x.a, landed: x.l && x.l.landed, red: x.l && x.l.red })) }).slice(0, 12000) + ' (3) Commit RESUME.md and any results files by pathspec in APP under `flock ' + X + '/git.lock` as "chore(refactor): checkpoint after Phase 5 (RESUME.md)" (trailers), push (retry 2, 4, 8, 16 s), and confirm `git -C ' + APP + ' status` is clean and HEAD equals origin/' + BR + ' after a fetch. Return green, head, commit, report.', { label: 'checkpoint:5', phase: 'Checkpoint', schema: CK })
return { reviewed, confirmed: confirmed.length, fixes, landed, ck }
