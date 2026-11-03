# v0.43 decisions (the user's answers, 2026-11-02 ~12:15 PM EST and ~9:45 PM EST)

| Q | Topic | Answer |
|---|---|---|
| Q1 | Scope | (a) **Core consolidations**: CLAUDE.md compliance plus merging code copied three or more times (one request-kind table, one command pipeline, one request lifecycle, one settle hook, one seat resolver; the sheet pane and the game table split into hooks). Not: one shared poller and stores, one End Turn state machine, a journal context, sheet rows fed from context. |
| Q2 | The null rule | (a) **unicorn/no-null off** in eslint.config.mjs with its reason beside it; the schema's fallbacks into small helpers; each remaining disable gets a reason; about 30 line-level ones left and none covering a whole file. |
| Q3 | Lint rules | (a) **CLAUDE.md's rules plus Sonar**: enforce one exported component per .tsx, types in types.ts, React hook rules, no import cycles and layered imports, plus eslint-plugin-sonarjs's cognitive-complexity limit of 15 (a dev dependency). No permanent file-size caps. |
| Q4 | Whole-page snapshots | (a) **Refactor only**: the whole-page markup snapshots that prove nothing changed are deleted in the PR's last test commit; the focused wire, words, route, refusal, storage and dice-draw goldens stay. |
| — | Planning files | **In the branch, removed later**: this .refactor/ folder, deleted in the PR's last commit. |

Orchestration notes (not the user's):
- The branch is brought up to main by a merge (no force push); 24f808b is that merge.
- Every green commit is pushed at once.
- The machine has 4 CPUs: a workflow runs 2 agents at a time; parallel lanes run as several workflows.
