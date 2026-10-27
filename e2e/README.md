# End-to-end suites

The real Sending Stone module, in a stand-in Foundry (the module's own `test/fvtt`), posting from a
game's page in Chromium to this app, built and served for real over its own Postgres database, with
players and a Gamemaster in their own browsers. 48 suites, 98 runs (`regress.sh`), each on fresh data,
and each run's `ok` lines counted against the number it wants.

They run locally, on Linux, from this checkout and the module's. Nothing here runs in CI yet.

## What it needs

- **The module's checkout**, at the commit that matches this one: `SENDING_STONE_MODULE` (absolute), by
  default `fvtt-sending-stone` beside this checkout. In it, `npm ci` and `npm run test:setup` (which
  fetches dnd5e 5.3.3 and 6.0.5 by pinned SHA; or set `DND5E5_DIR` and `DND5E6_DIR` to checkouts of
  them, see the module's `test/README.md`). The scripts check all of this before they start, link
  `e2e/fvtt` to its `test/fvtt` (the stand-ins every suite imports as `./fvtt/…`), and print both
  checkouts' HEADs. A stand-in changed in the module can break a suite here: keep the two branches in
  step.
- **Postgres 16 or later**, and `E2E_DATABASE_URL`: an admin URL on it, for a role that may create
  databases. The e2e makes its own databases beside it, `sending_stone_e2e` for the serial run and
  `sending_stone_e2e_N` for lane N, and never touches the app's own. `local/docker-compose.yaml`'s
  server will do (`docker compose -f local/docker-compose.yaml up -d`, then
  `E2E_DATABASE_URL=postgresql://admin:password@localhost:5432/postgres`). Start Postgres yourself: the
  scripts don't.
- **Playwright's Chromium**: `npm ci` here installs Playwright 1.56.1; `npm run e2e:browsers` fetches
  its Chromium, or `PLAYWRIGHT_BROWSERS_PATH` points at one already installed.
- **Linux** (`flock`, `setsid`, `/proc/net/tcp`), `psql`, `curl`, and 4 cores for three lanes.

`e2e.env.example` lists these variables with placeholders.

## Secrets

None is kept anywhere. Each pass (`checks-lanes.sh`, `checks-cycle.sh`, `rerun.sh`) makes its own
`E2E_AUTH_SECRET`, unless one is exported, and gives it to every app server as `BETTER_AUTH_SECRET` on
its command line, beside its database URLs and address. Next takes those over any `.env`, so no test
reads or needs the app's `.env`. The suites sign their session cookies with it through `env.mjs`, which
stops at once when it is unset. Never write the secret to a file or a log. The campaign secrets in the
suites (`'erebor-secret'` and the like) are synthetic test values.

## Data

`reset-db.sh` runs before every run: it empties the run's database (`E2E_DB_URL`), applies the app's
migrations (`prisma migrate deploy`) and loads `seed.sql`. The seed is synthetic and holds only what
the suites expect to find: two users, Alice (`e2e-user`, "Alice Adventurer") and Bob (`e2e-bob`), with
one session each, `e2e-token` and `e2e-bob-token`, valid for 7 days from the reset; and two campaigns
of the Lonely Mountain game from before Gamemasters set campaigns up here, with no owner, in which Alice
already plays Thorin Oakenshield and Vex (gm-e2e binds them again, theme-e2e opens that Thorin).
Everything else (campaigns, characters, rolls) the suites make themselves.

## Running

Run every pass under one lock for the whole sequence, because another pass may stop or start servers
in between, and from this checkout's root:

    export E2E_DATABASE_URL=postgresql://admin:password@localhost:5432/postgres
    flock -o e2e/.out/e2e.lock npm run e2e

(`mkdir -p e2e/.out` first, the first time.)

### The full regression on three lanes (about 31 minutes)

`npm run e2e` (`lanes/checks-lanes.sh`) builds the app, ups the lanes (`lanes/lanes-up.sh`), runs every
run of `regress.sh` on them (`lanes/regress-lanes.sh`), downs the lanes (`lanes/lanes-down.sh`) and ends
with `exit N`. It exits 0 only if every run has `exit=0` and `oks=want`.

- **Lane N** (N = 0, 1, 2) is one app server on `http://localhost:300N` over its own database
  `sending_stone_e2e_N`. One build serves all three. Each lane runs one run at a time, each on fresh
  data from its own reset, the lanes all at once. A suite's variants stay together on one lane, in
  `regress.sh`'s order.
- The suites find their lane through `APP_URL` and `E2E_DB_URL`, which `regress-lanes.sh` sets.
- The output: `build errors: N`, both HEADs, one `lane N: …` line per lane; then
  `# lane N +T s: name exit=… oks=… want=… (secs)` as each run finishes (on stderr); then **the result
  lines in `regress.sh`'s order**, exactly as `regress.sh` prints them; `lane N …: R runs, T s: suites…`;
  a `FAILED: …` line for each run that failed; `wall time: …`; and `exit N`. Compare the result lines
  with an earlier pass's:

      diff earlier-regress-lanes.out e2e/.out/logs/regress-lanes.out

- `RETRY=1` runs each failed run once more after the lanes finish, alone on lane 0 with the other lanes
  idle. A `RETRIED:` line shows the first try, whose log is kept as `<log>.try1`; the result lines and
  the exit code follow the second try. It is off by default, so a failure stays a failure. Say so when
  you report a pass that used it.

### A targeted pass (minutes)

    ONLY=gm,settings NO_MIDI=1 BUILD=0 flock -o e2e/.out/e2e.lock npm run e2e

- `ONLY=suite1,suite2` runs only those suites, every variant of each. A name with no runs in
  `regress.sh` stops the pass before anything starts.
- `NO_MIDI=1` leaves out every run with `MIDI=1` (midi's own first run among them).
- `BUILD=0` reuses `.next` unless a source file is newer than it; otherwise the pass builds.
- `KEEP=1` leaves the lanes up afterwards. Export your own `E2E_AUTH_SECRET` first, then run more passes
  on them with `ONLY=… flock -o e2e/.out/e2e.lock sh e2e/lanes/regress-lanes.sh`, and finish with
  `sh e2e/lanes/lanes-down.sh`. `regress-lanes.sh` refuses lanes started with another secret.
- `npm run e2e:dry` (with `ONLY` and `NO_MIDI` if you like) prints which runs would go where and starts
  nothing. It needs no servers and no lock: it plans in a scratch folder of its own.

### Serially (about 57 minutes)

    flock -o e2e/.out/e2e.lock npm run e2e:serial

`checks-cycle.sh` builds, starts one server on `localhost:3000` over `sending_stone_e2e`, runs
`regress.sh` on it and stops it (`KEEP=1` leaves it up). `npm run e2e:rerun -- gm settings`
(`rerun.sh`) reruns only those suites' lines, serially: on the server `checks-cycle.sh` left up when
`E2E_AUTH_SECRET` is the one it was started with, else on a server of its own from the current build.

### Older modules (SKEW)

Some runs pair this app with an older module, to prove the app still serves it (`SKEW=…` in
`regress.sh`, with `MODULE` or `MODULE_DIR` naming the module). `skew.conf` lists each such module's
release tag and SHA, and `skew.sh` extracts each from the module checkout's history, by SHA, into
`.out/module-<version>`, once per SHA; the pass scripts run it before they start. A shallow clone of the
module needs `git fetch --tags` first.

## Outputs

Everything a pass writes is under `e2e/.out/`, which git ignores:

| path | what |
|---|---|
| `logs/<name>[.MIDI1\|.SKEW…\|.DND5E61].rolls-regress.out` | each lane run's log; `logs/regress-lanes.out` the result lines; `logs/times.tsv` each run's place, lane, seconds and log |
| `serial/` | the same logs from `checks-cycle.sh` and `rerun.sh` |
| `shots-*/` | screenshots (`SHOTS`) |
| `build.out`, `build-serial.out` | the build's output |
| `server-N.log`, `server-serial.log`, `reset-N.out`, `reset-serial.out` | each server's log and its database's first reset |
| `work/` | a lane pass's run list, units, queue and results |
| `module-<version>/` | the older modules (`skew.sh`) |
| `rerun-now.sh` | `rerun.sh`'s run list |

## The files

| file | does |
|---|---|
| `*-e2e.mjs` | the suites; `world-030.mjs` is the world eighteen of them share, with Foundry's journals (the module's `test/fvtt/journal-core.mjs`) since module 0.34.0, since module 0.36.0 scenes, tokens and companions (`sceneWorld()`, the module's `test/fvtt/token-core.mjs`) for the three that load them, and since module 0.37.0 dnd5e's favorites (`favoring()`, the module's `test/fvtt/favorites-core.mjs`); the cookbook's suite also loads, since module 0.38.0, dishes' effects, world time, cards and their deletion (the module's `test/fvtt/dish-core.mjs`); the effects suite, since module 0.39.0, a character's own and items' effects, who put them there, updated and deleted (the module's `test/fvtt/effects-core.mjs`); the Wild Shape suite, since module 0.40.0, dnd5e's transformation and return, its packs and druids (the module's `test/fvtt/transform5e.mjs`); `journal-ui.mjs`, how the four journal suites find the journal's card, modal, contents, reader, editor, Move and Reorder (module 0.35.0) |
| `cookbook-post.mjs` | the cookbook's POST to this app, as its server makes it, with synthetic dishes and link codes (module 0.38.0) |
| `env.mjs` | what every suite takes from the environment: `BASE`, `dbUrl` and `sql()`, `authSecret` and `cookieFor()`, `MODULE` |
| `regress.sh` | every run: `run name want VARS…` |
| `reset-db.sh`, `seed.sql` | a run's fresh data |
| `checks-cycle.sh`, `rerun.sh` | the serial pass, and a few suites again |
| `skew.sh`, `skew.conf` | the older modules |
| `env.sh` | sourced by the scripts: the module checkout and its checks, the databases, the secret, the servers' environment, and which servers are the e2e's own |
| `lanes/lanes-env.sh` | sourced by the lane scripts: `LANES=3`, `PORT_BASE=3000`, each lane's URL, database and port, and the up-check (its port served by a server carrying `E2E_LANE_DB=sending_stone_e2e_N` and `/login` answering 200; never port 3999) |
| `lanes/lanes-up.sh` | stops lane servers an earlier pass left (refusing a lane port anything else holds), builds if needed (`BUILD=1` always, `BUILD=0` never), extracts the older modules, creates and resets each lane's database, starts the lane servers (`setsid`) and waits for each `/login` 200 |
| `lanes/lanes-down.sh` | stops the lane servers, each by its process group, and no other |
| `lanes/regress-lanes.sh` | reads `regress.sh` (its header, its own `run()` and every `run` line), groups the runs by suite, runs the suites pinned in `lanes.conf` on their lanes and the rest longest first from a shared queue, then the solo suites; prints the results in `regress.sh`'s order |
| `lanes/checks-lanes.sh` | build, lanes up, `regress-lanes.sh`, lanes down, `exit N` |
| `lanes/lanes.conf` | `suite seconds [lane]`, and `solo suite…` |

Other knobs: `LANES=2` (or 4) changes the number of lanes (more than 3 is unlikely to help on 4 cores);
`PORT_BASE=3001` keeps :3000 free (the lanes are then 3001 to 3003); `LANES_CONF=file` uses another
assignment; `LOGS=dir` puts a lane pass's logs elsewhere; `REGRESS=file` reads the runs from another
file shaped like `regress.sh` (for testing the scripts); `SOLO=0` runs the solo suites in the lanes.

## Suites run alone

toasts' 4-second timers trip under three lanes' load (79 of 149 checks once), and hold alone. The
`solo` line of `lanes.conf` names such suites: they run after the lanes, one at a time in `regress.sh`'s
order, on lane 0 with the other lanes idle, which adds about 8 minutes. `ONLY=toasts` runs it alone on
lane 0. Add a suite to `solo` only after it fails in the lanes and passes alone.

## Adding a suite

1. Import what it needs from the environment from `./env.mjs`: `BASE` (derive every app URL from it:
   cookies' `url`, `${BASE}/…`, `settings.set('listenerUrl', new URL(BASE).host)`; never write
   `localhost:3000` or `127.0.0.1` anywhere else, since the app tells http from https by a `localhost`
   host), `sql()`, `cookieFor('e2e-token')` and `MODULE`. Or build it on `world-030.mjs`, which
   re-exports them with `launch()`, `newCampaign()`, `foundryWorld()` and `startModule()`.
2. Stand-ins come from `./fvtt/…`, dnd5e's roots from `./fvtt/paths.mjs` (`DND5E5`, `DND5E6`), and a new
   stand-in goes into the module's `test/fvtt`.
3. **Ports and files.** Nothing in a suite may listen on a fixed port: use the in-process stand-ins and
   Playwright's `context.route`, as the others do. If a suite must listen, derive the port from
   `E2E_LANE` and stay off 3000–3002 and 3999. Write only under `SHOTS` or a `mkdtemp` directory.
4. **`regress.sh`.** Add its `run name want VARS…` lines. `regress-lanes.sh` reads them from there, `want`
   included, with `regress.sh`'s own `run()`, so a new variant key in `run()` (the `variant=` grep) or a
   `TIMEOUT=` applies to both.
5. **`lanes.conf`.** Optionally add `name seconds` with its serial time (the sum of its runs in
   `.out/logs/times.tsv`). A suite missing there counts as 600 s and starts early. Pin a suite only if
   it is much longer than the others.
6. **Prove it** both ways: on the lanes with `ONLY=name BUILD=0` (`LANES=1 PORT_BASE=3001` makes one lane
   on :3001, to be sure it runs off :3000), and serially with `npm run e2e:rerun -- name`.

## Things to know

- **Never rebuild while lanes are up.** All three serve the same `.next`.
- **Lanes and the serial server share :3000.** Down the lanes before a serial pass; each pass stops a
  server the e2e left on its ports, and refuses ports held by anything else (a `next dev`, say).
- **CPU load.** Three Chromiums render dice in software, beside three Nodes, three app servers and
  Postgres: a load average of 6–12 on 4 cores. The timing checks hold there (rolls at 31 s, gmerr's
  retries, the heartbeats), except toasts', which runs alone.
- **Two known races**, neither caused by the lanes; each failed once and passed when rerun:
  - **uses MIDI=1**, "Midi has the goblins save, and applies the damage": most likely the check reads HP
    as soon as the app reports the damage done, while the Midi stand-in's workflow, which isn't awaited,
    is still applying it.
  - **manualdice**, "ticked and saved, Erebor keeps it…": `hello()` takes the last hello by when its
    fetch *finished*, and a resent hello from before the tick can finish after the new one.

  If a run fails only in lanes, read its FAIL line before blaming the lanes. Rerun it with `ONLY=name`,
  serially, or with `RETRY=1`. Never loosen the check.
- **The e2e's databases** persist between passes; every run resets its own. Don't drop them unless asked.
- Screenshot folders shared by several suites (shots-022, shots-026, shots-030) get pictures from
  whichever lane wrote last. No two suites write the same file name; prompts and gm reuse names across
  their own variants, which is why a suite's variants stay together.
- Port 3999 is gmerr's "unreachable app". Nothing may listen there; `lanes-env.sh` refuses it.
