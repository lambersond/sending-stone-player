export const meta = {
  name: 'v043-phase1',
  description: 'v0.43 Phase 1 (one group per run, by args): builders in their own worktrees, then the orchestrator\'s landing of their commits into APP',
  phases: [
    { title: 'Build', detail: 'the group\'s builders (T + W-a, C-b + C-a, or M)' },
    { title: 'Land', detail: 'rebase, L1, fast-forward APP, push; a red landing goes back to its builder' },
  ],
}
const APP = '/home/user/sending-stone-player'
const R = APP + '/.refactor'
const X = '/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043'
const BR = 'claude/dazzling-dirac-m8cq54'
const WT = l => '/home/user/w043/' + l + '/sending-stone-player'
const READ = 'Read ' + R + '/brief.md first, then ' + R + '/request.md, ' + R + '/decisions.md and the contract ' + R + '/round.md: its "How to read this", then its binding parts (§0.2, §1.0, §1.8, §2.2-§2.3, §3), then your label\'s rows in §2.1 and §2.4 and the items they name; ' + R + '/owners.tsv is the file matrix (read rows for your label). The repo\'s CLAUDE.md is binding. Read the planning files from APP (' + R + '), which is current; your worktree\'s copy may lag. '
const WAIT = 'To wait for a file or a condition, run a background until-loop (e.g. `until [ -f F ]; do sleep 60; done` with run_in_background) and carry on with other work, never a foreground sleep. '
const SETUP = l => 'Your worktree: per round.md §2.3.3, `git -C ' + APP + ' worktree add -b local/043-' + l + ' ' + WT(l) + ' ' + BR + '` (if it already exists from an earlier attempt, reuse it as it is), then `npm ci` and `npx prisma generate` in it (`df -h /` first). Work only there; never write in APP (' + APP + '): only the orchestrator does. Builders push nothing. Write your report to ' + X + '/reports/' + l + '.md (files changed, commits on your branch with SHA and subject, L1 and gate results, deviations from round.md and why, bugs appended to ' + APP + '/.refactor/bugs-found.md inside `flock ' + X + '/bugs.lock` (the one APP file you may append to), and what later workstreams must know). '
const OUT = { type: 'object', properties: { ok: { type: 'boolean' }, branch: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, copies: { type: 'array', items: { type: 'string' } }, report: { type: 'string' } }, required: ['ok', 'branch', 'commits', 'copies', 'report'] }
const ROLE = {
  T: 'You are builder T: WS1 Kit (round.md §2.1 and §2.4 "WS1", §3.2 R3.1-R3.5 and C9, §3.1, §2.2.6, and the parts of §3.4 that concern the kit). ' + SETUP('T')
    + 'Hand-off out: as soon as R3.1, R3.2 and R3.5 are written (aim for the first ~2.5 h), copy those files, as untracked files at the same paths, into ' + WT('C-b') + ' and ' + WT('C-a') + ' (wait for those worktrees to exist), and append a line naming them and their exports to ' + X + '/handoff/kit-ready (append again whenever you change one, and copy again). '
    + 'Hand-off in: W-a copies its R1.6 files (roll-kinds.ts, its test, RollKindInfo in types/roll.ts) into your worktree as untracked files and lists them in ' + X + '/handoff/r16-ready; they go into YOUR commit 2 (its message names W-a\'s part). W-a\'s gate scripts appear in ' + WT('W-a') + '/.refactor/tools/ and ' + X + '/handoff/gates-ready says when: run your L1 with that l1.sh once it exists; until then run the plain checks under the locks (full jest --ci --json, next typegen && tsc --noEmit, eslint .) and check the counts and per-test results against ' + X + '/jest-base.tsv yourself. '
    + 'Gate before committing (§2.4 WS1): 290 base suites, every base test passing with equal or more assertions, plus the kit\'s, C9\'s and roll-kinds\' new tests. Then commit 2 on your branch local/043-T with §2.5\'s subject and the brief\'s trailers. Return ok, branch, commits ("SHA subject"), copies (the untracked files you placed in other worktrees), report.',
  'W-a': 'You are builder W-a: WS1b Table and gates (round.md §2.1 and §2.4 "WS1b", §1.6 R1.6, §3.4 the gates with base.sh and replay.sh). ' + SETUP('W-a')
    + 'First R1.6 (the request-kind table as new files, with its derived-equals-literal test green): then copy those files, untracked at the same paths, into ' + WT('T') + ' (wait for it to exist) and write their paths into ' + X + '/handoff/r16-ready. Do NOT commit the R1.6 files yourself: T commits them in commit 2. If you change one later, copy it again and append to r16-ready. '
    + 'Then the gate scripts of §3.4 (l1.sh, gates.sh, base.sh, replay.sh and the gate files, the tools always run from APP\'s R/tools once landed) in your worktree\'s .refactor/tools/, each dry-run on the base (every gate green at 24f808b\'s tree; gate 1b\'s and 4b\'s allowlists listing only base cases); as soon as l1.sh works, write ' + X + '/handoff/gates-ready naming its path in your worktree (T uses it from there until it lands). Commit the scripts on your branch local/043-W-a as "chore(refactor): the gate scripts (round.md §3.4)" (planning files only; the R1.6 files left out) with the trailers. Return ok, branch, commits, copies (the R1.6 files you placed in T\'s worktree), report.',
  'C-b': 'You are builder C-b: WS2 Goldens, C-b\'s share (round.md §2.1 and §2.4 "WS2", §3.2: C2 with C3\'s view JSON and U2\'s bodies, C3, C5 with the pages, C6; §3.1). ' + SETUP('C-b')
    + 'The kit arrives from T as untracked copies in your worktree: wait for ' + X + '/handoff/kit-ready (write what does not need the kit first; re-read kit-ready when it changes). Your goldens are new files only under src/__tests__/golden/** (owners.tsv), green on today\'s code, snapshots written once with `--ci=false` over your own files only (every other jest run with --ci). A mutation spot-check per suite (break one thing as §2.4 lists, see a named test fail, revert). When green, commit them on your branch local/043-C-b with §2.5\'s commit 3 subject and the trailers, WITHOUT the kit copies (they are T\'s; leave them untracked). The orchestrator rebases your branch onto commit 2 and runs L1 there. Return ok, branch, commits, copies (the kit files that are untracked copies in your worktree), report.',
  'C-a': 'You are builder C-a: WS2 Goldens, C-a\'s share (round.md §2.1 and §2.4 "WS2", §3.2: C1 with the maps\' states, C4, C7, C8; §3.1; and first, extend R/analysis/T/e2e-surface.mjs per §1.8.1 so C1 and C4 cover what it lists: edit it in your worktree\'s .refactor/analysis/T/ and commit it on your branch as "chore(refactor): e2e surface extended" before your goldens commit). ' + SETUP('C-a')
    + 'The kit arrives from T as untracked copies in your worktree: wait for ' + X + '/handoff/kit-ready (write what does not need the kit first; re-read kit-ready when it changes). Your goldens are new files only under src/__tests__/golden/** (owners.tsv), green on today\'s code, snapshots written once with `--ci=false` over your own files only (every other jest run with --ci); ids and times normalized as §3.2 says. A mutation spot-check per suite (break one thing as §2.4 lists, see a named test fail, revert). When green, commit them on your branch local/043-C-a with §2.5\'s commit 4 subject and the trailers, WITHOUT the kit copies (leave them untracked). The orchestrator rebases your branch onto commits 2 and 3 and runs L1 there. Return ok, branch, commits, copies, report.',
  M: 'You are builder M: WS1c Codemods (round.md §2.1 and §2.4 "WS1c", §1.0 R1.0.1-R1.0.2, §1.9.1 R1.9.1, §3.4 gates 11 and 12). ' + SETUP('M')
    + 'Write move.cjs and export-move.cjs in your worktree\'s .refactor/tools/ (closures, directives such as \'use client\' and @jest-environment kept, jest.mock/requireActual/requireMock/doMock path retargets, git mv so history follows), and dry-run them on a scratch worktree of your own (`git worktree add --detach /home/user/w043/M-trial ' + BR + '`, npm ci or a node_modules symlink): apply §1.0.1\'s and §1.9.1\'s moves, show tsc clean and gates 11 and 12 clean (W-a\'s scripts in ' + WT('W-a') + '/.refactor/tools/ once ' + X + '/handoff/gates-ready exists; until then tsc and a cycle check of your own), then discard the trial worktree (`git worktree remove --force` on it only). Commit the codemods on your branch local/043-M as "chore(refactor): the move codemods (round.md §1.0, §1.9.1)" with the trailers. Your worktree is kept for Phase 2. Return ok, branch, commits, copies ([]), report.',
}
const LANDOUT = { type: 'object', properties: { landed: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } }, red: { type: 'string' }, report: { type: 'string' } }, required: ['landed', 'commits', 'red', 'report'] }
const land = (l, b, what) => agent(READ + WAIT + 'You are the orchestrator\'s lander (round.md §2.3.4) for ' + l + '\'s branch local/043-' + l + ' in ' + WT(l) + ': ' + what + ' The builder\'s result: ' + JSON.stringify(b).slice(0, 6000) + '\nSteps, all inside `flock ' + X + '/git.lock` (take it once for the whole landing): (1) in ' + WT(l) + ', delete the untracked hand-off copies (the builder\'s `copies` are the ones it placed elsewhere; the ones placed IN this worktree by others are listed in ' + X + '/handoff/kit-ready or r16-ready: delete only untracked files that the APP head now tracks or that the builder\'s commits do not include, never a committed file), then `git rebase ' + BR + '` (the branch is local and never pushed, so this rewrites nothing pushed; on a conflict stop, `git rebase --abort`, and report it); (2) if the base moved, run L1 at the rebased head: `' + R + '/tools/l1.sh <outdir under ' + X + '/l1/' + l + '> ' + WT(l) + '` when that script exists in APP, else the plain checks under the locks (full jest --ci --json compared with ' + X + '/jest-base.tsv, next typegen && tsc --noEmit, eslint .); a red test is rerun once alone before it counts; (3) if green, `git -C ' + APP + ' merge --ff-only local/043-' + l + '` then `git -C ' + APP + ' push -u origin ' + BR + '` (retry after 2, 4, 8, 16 s on a network error); (4) copy ' + X + '/reports/' + l + '.md to ' + R + '/reports/' + l + '.md and commit it in APP with pathspec as "chore(refactor): ' + l + ' report" (the trailers) and push. If L1 is red, land nothing and return landed false with the failures in `red` (test names, gate lines, errors). Return landed, commits (the SHAs now on ' + BR + ', with subjects), red ("" when green), report.', { label: 'land:' + l, phase: 'Land', schema: LANDOUT })
const build = (l, extra) => agent(READ + WAIT + ROLE[l] + (extra || ''), { label: 'build:' + l, phase: 'Build', schema: OUT })
const buildAndLand = async (l, what) => {
  let b = await build(l)
  if (!b || !b.ok) return { l, b, landing: null }
  let landing = await land(l, b, what)
  for (let i = 1; i <= 2 && landing && !landing.landed; i++) {
    b = await build(l, ' THIS IS A FIX ROUND: your branch already exists in your worktree; the orchestrator\'s landing L1 at the rebased commit was red: ' + landing.red + ' Fix it with a NEW commit on your branch (never amend; never edit an existing assertion), rerun L1, and return as before.')
    if (!b || !b.ok) break
    landing = await land(l, b, what + ' (fix round ' + i + ')')
  }
  return { l, b, landing }
}
const group = (args && args.group) || ''
let res = []
if (group === 'T') {
  phase('Build')
  const [wa, t] = await parallel([() => build('W-a'), () => build('T')])
  phase('Land')
  const lwa = wa && wa.ok ? await land('W-a', wa, 'the gate scripts commit (planning files only); land it first, so commit 2 lands with the gates in APP.') : null
  let lt = t && t.ok ? await land('T', t, 'commit 2 (the kit, adopted helpers, the no-db guard, TZ, C9, and W-a\'s request-kind table files); the gates in APP now apply.') : null
  let t2 = t
  for (let i = 1; i <= 2 && lt && !lt.landed; i++) {
    t2 = await build('T', ' THIS IS A FIX ROUND: your branch already exists in your worktree; the orchestrator\'s landing L1 at the rebased commit was red: ' + lt.red + ' Fix it with a NEW commit on your branch (never amend; never edit an existing assertion), rerun L1 (APP\'s ' + R + '/tools/l1.sh), and return as before.')
    if (!t2 || !t2.ok) break
    lt = await land('T', t2, 'commit 2, fix round ' + i)
  }
  res = [{ wa, lwa }, { t: t2, lt }]
} else if (group === 'C') {
  phase('Build')
  const [cb, ca] = await parallel([() => build('C-b'), () => build('C-a')])
  phase('Land')
  const waitTwo = 'Commit 2 must be on ' + BR + ' in APP first: if `git -C ' + APP + ' log --format=%s ' + BR + '` has no line starting "test: a small test kit", wait for it (background until-loop, up to 8 h; if it never comes, return landed false with red "commit 2 not landed"). '
  let lb = cb && cb.ok ? await land('C-b', cb, waitTwo + 'Then land commit 3.') : null
  let cb2 = cb
  for (let i = 1; i <= 2 && lb && !lb.landed && lb.red !== 'commit 2 not landed'; i++) {
    cb2 = await build('C-b', ' THIS IS A FIX ROUND: your branch exists; the landing L1 after rebasing onto commit 2 was red: ' + lb.red + ' The kit is now tracked (commit 2): remove any untracked copies, fix with a NEW commit, rerun L1, return as before.')
    if (!cb2 || !cb2.ok) break
    lb = await land('C-b', cb2, waitTwo + 'Then land commit 3 (fix round ' + i + ').')
  }
  let la = ca && ca.ok ? await land('C-a', ca, waitTwo + 'Commit 3 (C-b) lands before yours when it is green: if C-b\'s landing is still to come, land anyway once commit 2 is in (the order of 3 and 4 is not load-bearing; say which order happened). Land "e2e surface extended" and commit 4.') : null
  let ca2 = ca
  for (let i = 1; i <= 2 && la && !la.landed && la.red !== 'commit 2 not landed'; i++) {
    ca2 = await build('C-a', ' THIS IS A FIX ROUND: your branch exists; the landing L1 after rebasing was red: ' + la.red + ' Remove any untracked kit copies, fix with a NEW commit, rerun L1, return as before.')
    if (!ca2 || !ca2.ok) break
    la = await land('C-a', ca2, 'commit 4, fix round ' + i)
  }
  res = [{ cb: cb2, lb }, { ca: ca2, la }]
} else if (group === 'M') {
  res = [await buildAndLand('M', 'the codemods commit (planning files only).')]
}
return res
