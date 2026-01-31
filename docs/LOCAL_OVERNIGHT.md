# Local Overnight Harness

Automated CI + smoke test loop that runs unattended on your local machine.

## Quick Start

```bash
bash scripts/overnight.sh
```

This runs for 8 hours with 5-minute intervals by default.

## Custom Duration

```bash
# Run for 1 hour with 2-minute intervals
bash scripts/overnight.sh 1 2

# Run for 10 minutes (use fractional hours or pass seconds via env)
bash scripts/overnight.sh 0.17 1
```

## Prerequisites

Run the doctor script to check your environment:

```bash
bash scripts/doctor.sh
```

Required:
- Node.js >= 18
- npm
- curl
- git
- `npm install` completed (node_modules present)

Optional:
- Docker (for container builds)
- `DATABASE_URL` env var (for database features)
- `GOOGLE_CLOUD_PROJECT` env var (for GCP features)

## What Each Cycle Does

1. **Git sanity** — warns if working tree is dirty (ignoring `artifacts/`)
2. **CI pipeline** (`scripts/ci_local.sh`) — install, lint, typecheck, test, build
3. **Start server** (`scripts/run_local.sh`) — runs `next start` on port 3000
4. **Smoke tests** (`scripts/smoke_local.sh`) — curls API endpoints
5. **Stop server** — clean shutdown

## Individual Scripts

| Script | Purpose |
|--------|---------|
| `scripts/doctor.sh` | Pre-flight environment check |
| `scripts/ci_local.sh` | Full CI: install, lint, typecheck, test, build |
| `scripts/run_local.sh` | Start/stop server (`start` / `stop`) |
| `scripts/smoke_local.sh` | Smoke test endpoints against localhost |
| `scripts/overnight.sh` | Full overnight loop |

## Interpreting Reports

Reports are written to `artifacts/report_<timestamp>.md` and contain:
- Start/end times
- Number of cycles passed/failed
- Per-cycle PASS/FAIL status
- Branch and commit info

## Expected Endpoint Behavior

| Endpoint | Expected Status |
|----------|----------------|
| `GET /api/health` | 200 (always) |
| `GET /api/about` | 200 (always) |
| `GET /api/documents` | 200 or 401 (auth required) |
| `GET /api/documents/folders` | 200 or 401 |
| `GET /api/audit?limit=5` | 200 or 401 |
| `POST /api/documents` | 400 or 401 (no body/no auth) |

401 responses from protected endpoints are expected when running locally without auth.

## Stopping

Press `Ctrl+C`. The harness traps the signal, stops the server, and writes a final report.

## Artifacts

All outputs go to `artifacts/` (git-ignored):
- `artifacts/logs/<timestamp>/` — per-step CI logs
- `artifacts/smoke_<timestamp>.txt` — smoke test results
- `artifacts/report_<timestamp>.md` — overnight summary
- `artifacts/server.log` — server stdout/stderr
- `artifacts/.server.pid` — server PID file
