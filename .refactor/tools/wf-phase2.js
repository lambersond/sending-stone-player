export const meta = {
  name: 'v043-phase2',
  description: 'v0.43 Phase 2: M\'s moves (commits 5, 6) and export moves and seams (7, 8), each landed; owners.tsv checked; the e2e pass 2 with an independent review of 5-8; repairs',
  phases: [
    { title: 'Moves', detail: 'WS3: commits 5, 6; landed' },
    { title: 'Seams', detail: 'WS4: commits 7, 8; landed; owners.tsv checked against the tree' },
    { title: 'Check', detail: 'e2e pass 2 and a review of commits 5-8, in parallel' },
    { title: 'Repair', detail: 'fix rounds for real failures, then the pass again' },
  ],
}
const APP = '/home/user/sending-stone-player'
const R = APP + '/.refactor'
const X = '/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043'
const BR = 'claude/dazzling-dirac-m8cq54'
const WT = '/home/user/w043/M/sending-stone-player'
const READ = 'Read ' + R + '/brief.md first, then ' + R + '/request.md, ' + R + '/decisions.md and the contract ' + R + '/round.md: its "How to read this", then its binding parts (§0.2, §1.0, §1.8, §2.2-§2.3, §3), then the rows for your label in §2.1 and §2.4 and the items they name; ' + R + '/owners.tsv is the file matrix. Read the planning files from APP (' + R + '), which is current. The reports of Phase 1 are in ' + R + '/reports/ (T, W-a, C-b, C-a, M): read what they say later workstreams must know. '
const WAIT = 'To wait for a file or a condition, run a background until-loop and carry on, never a foreground sleep. '
const OUT = { type: 'object', properties: { ok: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } }, report: { type: 'string' } }, required: ['ok', 'commits', 'report'] }
const LANDOUT = { type: 'object', properties: { landed: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } }, red: { type: 'string' }, report: { type: 'string' } }, required: ['landed', 'commits', 'red', 'report'] }
const MB = (what, extra) => agent(READ + WAIT + 'You are builder M, in your worktree ' + WT + ' on local/043-M (kept from Phase 1; your codemods are in APP\'s R/tools: use those). First `git -C ' + WT + ' rebase ' + BR + '` so you start from APP\'s head (your branch is local and holds nothing unlanded unless this is a fix round). ' + what + ' Each commit: L1 in your worktree with APP\'s `' + R + '/tools/l1.sh <outdir under ' + X + '/l1/M/> ' + WT + '` (it takes the locks itself) all green, then the commit on your branch with §2.5\'s subject and the brief\'s trailers. Builders push nothing and never write in APP; the orchestrator lands. Allowlist rows a gate needs (gate 1b, 4b, shims) go in your report for the orchestrator, with the reason. Bugs found go to ' + R + '/bugs-found.md inside `flock ' + X + '/bugs.lock` (append only), never into the work. Write your report to ' + X + '/reports/M-' + (extra || 'p2') + '.md. Return ok, commits ("SHA subject"), report.', { label: 'build:M:' + (extra || 'p2'), phase: extra && extra.startsWith('seams') ? 'Seams' : extra && extra.startsWith('fix') ? 'Repair' : 'Moves', schema: OUT })
const land = (what, phaseName, tag) => agent(READ + WAIT + 'You are the orchestrator\'s lander (round.md §2.3.4) for builder M\'s branch local/043-M in ' + WT + ': ' + what + ' All inside one `flock ' + X + '/git.lock`: (1) apply any allowlist rows M\'s report (' + X + '/reports/M-' + tag + '.md) asks for to APP\'s R/tools allowlists ONLY if each is justified by round.md (a planned exception); commit them in APP as "chore(refactor): allowlist rows for M\'s commits" (trailers) BEFORE the L1, and push; (2) `git -C ' + WT + ' rebase ' + BR + '` (local branch; on a conflict abort and report); (3) L1 at the rebased head: `' + R + '/tools/l1.sh ' + X + '/l1/M/landing-' + tag + ' ' + WT + '` (it takes the locks itself; a red test is rerun alone by it), and `next build` in the worktree under `flock ' + X + '/l1-wait.lock flock ' + X + '/checks.lock`; (4) if all green, `git -C ' + APP + ' merge --ff-only local/043-M` and `git -C ' + APP + ' push -u origin ' + BR + '` (retry after 2, 4, 8, 16 s); (5) copy ' + X + '/reports/M-' + tag + '.md to ' + R + '/reports/M-' + tag + '.md, commit it in APP by pathspec as "chore(refactor): M ' + tag + ' report" with the trailers, push. If red, land nothing: return landed false with the failures in `red`. Return landed, commits (SHAs now on the branch with subjects), red, report.', { label: 'land:M:' + tag, phase: phaseName, schema: LANDOUT })
const buildLand = async (what, tag, phaseName, landWhat) => {
  let b = await MB(what, tag)
  if (!b || !b.ok) return { b, l: null }
  let l = await land(landWhat, phaseName, tag)
  for (let i = 1; i <= 2 && l && !l.landed; i++) {
    b = await MB('THIS IS A FIX ROUND for ' + tag + ': the landing L1 or build at the rebased head was red: ' + l.red + ' Fix it with NEW commits on your branch (never amend; never edit an existing assertion or golden), L1 green, and return.', tag)
    if (!b || !b.ok) break
    l = await land(landWhat + ' (fix round ' + i + ')', phaseName, tag)
  }
  return { b, l }
}

phase('Moves')
const FROM = (args && args.from) || ''
const landOnly = async (landWhat, tag, phaseName) => {
  let l = await land(landWhat, phaseName, tag)
  let b = null
  for (let i = 1; i <= 2 && l && !l.landed; i++) {
    b = await MB('THIS IS A FIX ROUND for ' + tag + ': the landing L1 or build at the rebased head was red: ' + l.red + ' Fix it with NEW commits on your branch (never amend; never edit an existing assertion or golden), L1 green, and return. If the cause is in APP\'s planning files (R/tools, R/analysis) rather than your branch, say exactly what the orchestrator must change and return ok false.', tag)
    if (!b || !b.ok) break
    l = await land(landWhat + ' (fix round ' + i + ')', phaseName, tag)
  }
  return { b, l }
}
const moves = FROM === 'land-seams' ? { b: null, l: { landed: true, commits: ['f7eb1a5 commit 5', 'fd2c34d commit 6', '51e82f8 kit directive kept'], red: '', report: 'landed in an earlier run' } } : FROM === 'land-moves' ? await landOnly('commits 5 and 6 and M\'s chore(refactor) and chore(lint) commits with them (the branch already holds them: 7682f9b commit 5, 718fee6 the ratchet (APP already has its bytes since 492f51b: the rebase drops or empties it, which is fine), 08e5a87 commit 6, 8e12352 the kit directive kept (round.md amendment 2)). M\'s report is ' + X + '/reports/M-moves.md.', 'moves', 'Moves') : await buildLand('Your task now: WS3 (round.md §2.4 "WS3"): R1.0.1 with your move codemod → commit 5 (moves only: renames and import and mock-path lines; `git show -M --stat` all renames); the lint ratchet re-taken after the moves exactly as gate 9\'s conditions say (`run.sh moved`, its output under R/analysis in YOUR worktree, committed with commit 5 only if round.md says so, else in a separate chore(refactor) commit); then R1.0.2 → commit 6 (unicorn/no-null off with its reason in eslint.config.mjs and its disable comments gone; `reportUnusedDisableDirectives` proves none served another rule). Stop after commit 6.', 'moves', 'Moves', 'commits 5 and 6 (and any chore(refactor) commit M made with them).')
if (!moves.l || !moves.l.landed) return { moves }
phase('Seams')
const seams = FROM === 'land-seams' ? await landOnly('commits 7 and 8 and M\'s chore(refactor) commit with them (the branch already holds them: 14b2ab4 commit 7, 24d2c43 commit 8, c2ed41f their moves.tsv rows; APP already has the ratchet patch and the six gate 1b rows of M\'s report, round.md amendment 3, and gate-lib reads the checkout\'s own moves.tsv rows). M\'s report is ' + X + '/reports/M-seams.md.', 'seams', 'Seams') : await buildLand('Your task now: WS4 (round.md §2.4 "WS4"): R1.9.1 + R1.9.5 with your export-move codemod → commit 7 (export moves only), with the cycle report; then R1.9.2 → R1.9.3 → R1.9.4 → commit 8 (the seams; C1-C9 unchanged); `next build` green. Include the names the Phase 1 reports asked for in the export-move list (e.g. C-a: briefOf and reasons from roll-tray.tsx). Stop after commit 8.', 'seams', 'Seams', 'commits 7 and 8 (and any chore(refactor) commit M made with them).')
if (!seams.l || !seams.l.landed) return { moves, seams }
const OWN = { type: 'object', properties: { ok: { type: 'boolean' }, commit: { type: 'string' }, fixes: { type: 'number' }, report: { type: 'string' } }, required: ['ok', 'commit', 'fixes', 'report'] }
const owners = await agent(READ + 'You are the orchestrator\'s owners check (round.md §2.2.3): against APP\'s tree at its head (commit 8 landed), check R/owners.tsv: every `path_after` that Phase 2 should have produced exists, every src file has a row (a glob row counts), no Phase 3 file has two lanes, and the `-` rows for new shared files are present. Write a small script under R/analysis/owners-check/ to do it mechanically. Correct owners.tsv where the tree is right and the matrix is stale (never move files); list anything that is a real conflict. Commit the corrections in APP by pathspec (`flock ' + X + '/git.lock`) as "chore(refactor): owners.tsv checked against commit 8" with the trailers and push. Return ok, commit, fixes (rows changed), report.', { label: 'owners:check', phase: 'Seams', schema: OWN })

const E2EOUT = { type: 'object', properties: { green: { type: 'boolean' }, failures: { type: 'array', items: { type: 'object', properties: { run: { type: 'string' }, check: { type: 'string' }, cause: { type: 'string' }, product: { type: 'boolean' }, files: { type: 'string' } }, required: ['run', 'check', 'cause', 'product', 'files'] } }, commit: { type: 'string' }, report: { type: 'string' } }, required: ['green', 'failures', 'commit', 'report'] }
const REV = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string' }, file: { type: 'string' }, what: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['id', 'severity', 'file', 'what', 'evidence', 'fix'] } }, report: { type: 'string' } }, required: ['findings', 'report'] }
const e2e = pass => agent(READ + 'You run the e2e FULL pass ' + pass + ' (round.md §2.3.8, §2.6) from APP at its head, BUILD=1, under the wait, checks and e2e locks in that order, in the background, waiting on its log (brief.md\'s e2e environment). A failed run is rerun alone once (`ONLY=<suite> BUILD=0 npm run e2e`, same three locks). Compare each run with the baseline ' + R + '/analysis/e2e/base.md. For each failure that also fails alone, read its log and the diff of the commits since the baseline in the files it touches, and say whether it is the product (a moved or seamed file changed behaviour) or the environment. Edit nothing in src or e2e. Write the table to ' + R + '/analysis/e2e/' + pass + '.md as base.md is, commit it in APP by pathspec under `flock ' + X + '/git.lock` as "chore(refactor): e2e ' + pass + '" with the trailers, push. Return green, failures, commit, report.', { label: 'e2e:' + pass, phase: 'Check', schema: E2EOUT })
const review = () => agent(READ + 'You are an independent reviewer of commits 5-8 on APP\'s branch (the moves, no-null off, export moves, seams: `git -C ' + APP + ' log --format="%h %s" -12`). Check, with evidence, what round.md promises for each: commit 5 renames and import or mock-path lines only (`git show -M --stat`, then the non-rename hunks); commit 6 comment lines and one config line (and that every removed disable served only unicorn/no-null); commit 7 export moves only (`git show --color-moved=zebra`: every moved block identical, importers updated, no shim left unless round.md allows it, jest.mock paths follow their module, mocked names still mocked where the test meant them to be); commit 8 the seams exactly as R1.9.2-4 say, behaviour-preserving (C1-C9 snapshots unchanged: `git diff <commit 4> HEAD -- \'**/__snapshots__/**\'` empty). Also: \'use client\' and @jest-environment directives kept, no server module newly reachable from a client one, no new import cycle, Next.js route and page files still exporting only what Next allows (read node_modules/next/dist/docs if unsure). Run the goldens and the moved suites under the L0 lock if useful; edit nothing. Severity: blocker (behaviour or contract broken), major (a promise of round.md broken), minor. Return findings and a report.', { label: 'review:5-8', phase: 'Check', schema: REV })

phase('Check')
let [pass, rev] = await parallel([() => e2e('pass2'), review])
const repairs = []
for (let round = 1; round <= 2; round++) {
  const prod = pass && !pass.green ? pass.failures.filter(f => f.product) : []
  const block = rev ? rev.findings.filter(f => f.severity === 'blocker' || f.severity === 'major') : []
  if (!prod.length && !block.length) break
  phase('Repair')
  const fix = await buildLand('Your task now: a repair round for commits 5-8. Fix each of these at its cause, in the moved or seamed code, so behaviour is exactly as before (reproduce with a jest test where you can; never edit an e2e suite, a golden or an existing assertion); a reviewer finding you judge wrong, answer in your report with evidence instead of changing code. E2E failures: ' + JSON.stringify(prod) + ' Review findings: ' + JSON.stringify(block) + ' Commit as "fix: v0.43 moves and seams, round ' + round + '" (trailers).', 'fix' + round, 'Repair', 'the repair commit of round ' + round + '.')
  repairs.push(fix)
  if (!fix.l || !fix.l.landed) break
  ;[pass, rev] = await parallel([prod.length ? () => e2e('pass2-r' + round) : () => Promise.resolve(pass), block.length ? review : () => Promise.resolve(rev)])
}
return { moves, seams, owners, pass, rev, repairs }
