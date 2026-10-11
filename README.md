# Turia Agent Center (MVP)

A local demo of an **Agent Center** with three agent modules: **Task**, **DSC** and **License**.
You can create, edit, save as draft, publish, disable and *simulate* agents, and review what each simulated run did.

> **Everything that "runs" is simulated.** No email, WhatsApp or in-app message is ever sent, and there is no scheduler.
> A test run records what *would* happen, and the UI and API label it as simulated.

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, JavaScript, Tailwind CSS, Redux Toolkit |
| Backend | Node.js, Express, REST/JSON |
| Database | SQLite via `better-sqlite3` (a single file, created automatically) |

---

## 1. Prerequisites

- **Node.js 20 LTS or newer** and **npm** (check with `node -v` and `npm -v`).
- `better-sqlite3` normally installs a prebuilt binary. If `npm install` in `backend/` fails while compiling it, install a build toolchain: Windows → *Visual Studio Build Tools* ("Desktop development with C++"); macOS → `xcode-select --install`; Linux → `sudo apt install build-essential python3`.
- Ports **4000** (backend) and **3000** (frontend) free.

## 2. Run it from a clean checkout

Open **two terminals**.

**Terminal 1: backend**
```bash
cd backend
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm install
npm run dev                 # or: npm start
```
Check it: <http://localhost:4000/api/health> should return `{"success":true,"data":{"status":"ok","database":"connected",...}}`.

**Terminal 2: frontend**
```bash
cd frontend
cp .env.example .env.local  # Windows PowerShell: Copy-Item .env.example .env.local
npm install
npm run dev
```
Open <http://localhost:3000> (it redirects to the Agent Center).

Start the backend first. If it is not running, the frontend shows a clear "Cannot reach the server" message with a *Try again* button instead of crashing.

### Production build of the frontend

```bash
cd frontend
npm run lint        # ESLint (Next.js "core-web-vitals" rules); `next build` also fails on lint errors
npm run build       # production build
npm start           # serves the production build on http://localhost:3000
```
Run the backend in another terminal as above. After changing `NEXT_PUBLIC_API_URL` you must run `npm run build` again, because that value is baked into the build.
For a production-style backend run use `npm start` instead of `npm run dev`.

### Reproducible installs (lockfiles)

The first `npm install` in `backend/` and in `frontend/` creates a `package-lock.json`. **Commit both files** (do not delete them) so every machine installs identical versions. For a clean, exact install from the lockfile use `npm ci` instead of `npm install`.

## 3. Environment variables

**`backend/.env`** (copy from `.env.example`; never commit `.env`)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | Port the API listens on |
| `NODE_ENV` | `development` | Environment name |
| `DB_PATH` | `./data/agent_center.db` | SQLite file, relative to `backend/` |
| `CORS_ORIGIN` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated frontend origins allowed to call the API |

**`frontend/.env.local`** (copy from `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | Backend base URL. Changing it requires restarting `npm run dev`. |

No secrets are used. `NEXT_PUBLIC_*` values are visible in the browser by design, so never put secrets in them.

## 4. Database setup

There is nothing to set up by hand. On every backend start `src/db/database.js` opens `DB_PATH` and runs `src/db/schema.sql`, which uses `CREATE TABLE IF NOT EXISTS` and is therefore safe to repeat; existing data is never touched.

- Tables: `agents` and `agent_runs` (foreign key with `ON DELETE CASCADE`; `CHECK` constraints on module, status and run type; indexes for the list and history queries).
- Timestamps are ISO-8601 UTC strings.
- **Reset the demo data:** stop the backend and delete `backend/data/agent_center.db*` (the `.db`, `.db-wal` and `.db-shm` files). It is recreated empty on the next start.
- The automated tests use a temporary database and never touch this file.

## 5. API

Base URL: `http://localhost:4000/api`. Every response is JSON in one of two shapes:

```json
{ "success": true,  "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Name is required.", "details": ["..."] } }
```

| Method & path | Purpose | Success | Typical errors |
|---|---|---|---|
| `GET /health` | Server + database check | 200 | 503 |
| `GET /agent-definitions` | Triggers, conditions, recipients, channels, actions (used to build the form) | 200 | |
| `GET /agents?module=&status=&search=` | List agents (newest update first) | 200 | 400 invalid filter |
| `POST /agents` | Create an agent (always saved as `draft`) | 201 | 400 validation |
| `GET /agents/:id` | One agent | 200 | 400 bad id, 404 |
| `PUT /agents/:id` | Edit a **draft** (partial updates allowed) | 200 | 400, 404, 409 not a draft |
| `POST /agents/:id/publish` | draft → published | 200 | 400 invalid config, 404, 409 |
| `POST /agents/:id/disable` | published → disabled | 200 | 404, 409 |
| `POST /agents/:id/test-run` | Simulated run (published only) | 201 | 404, 409 |
| `GET /agents/:id/history` | Runs of one agent, newest first | 200 | 400, 404 |
| `GET /history?limit=` | Runs of all agents, newest first (default 100, max 250) | 200 | |

Example `POST /api/agents` body:

```json
{
  "name": "Task due reminder",
  "module": "Task",
  "description": "Notify the assignee before a task is due.",
  "config": {
    "trigger": "Task due soon",
    "conditions": { "daysBeforeDue": 3 },
    "recipient": "Assigned user",
    "channel": "Email",
    "action": "Send notification",
    "message": "Your task is due soon."
  }
}
```

### Agent definitions (one place to change them)

Triggers, per-trigger conditions, recipients, channels and actions live in **`backend/src/config/agentDefinitions.js`**. The validator, the simulator and the frontend form (through `GET /api/agent-definitions`) all read from it.

| Module | Triggers | Condition |
|---|---|---|
| Task | Task created · Task assigned · Task due soon | *Task due soon:* days before due date (1–90, default 2) |
| DSC | DSC expiry approaching · DSC expired · Renewal required | *Expiry approaching / Renewal required:* days before expiry (1–365, default 30) |
| License | License expiry approaching · License expired · Renewal required | same as DSC |

### Status rules

```
draft ──publish──▶ published ──disable──▶ disabled
  ▲ edit (PUT) allowed only here            (final in this MVP)
```

- New agents are always `draft`. Only **draft** agents can be edited or published.
- Only **published** agents can be disabled or test-run. Draft and disabled agents get `409 INVALID_STATE`.
- Publishing re-validates the stored configuration; an invalid one is refused with `400`.
- A disabled agent cannot be re-enabled (kept simple on purpose).

### What a test run means

`POST /agents/:id/test-run` loads the agent from SQLite, re-validates its configuration, builds a **fixed, fictional sample event** for its trigger (same configuration → same event and result), and writes a row to `agent_runs`.

- `status: "success"` means: *the configuration passed validation and the simulated run completed.* It does **not** mean a message was delivered or a real DSC/license/task was processed.
- `status: "failed"` means the configuration was not valid at run time (for example the database row was edited by hand or damaged). The run is still stored with an `error_message`.
- The HTTP status is `201` in both cases (a run record was created); check `data.status` for the outcome.

## 6. Tests

All backend tests use Node's built-in test runner (no extra packages) and a **temporary** database.

```bash
cd backend
npm test
```

| File | What it covers | Needs Express? |
|---|---|---|
| `tests/validator.test.js` | Valid input per module; empty/blank/over-long fields; wrong module↔trigger; bad recipient/channel/action; condition ranges; legacy data | no |
| `tests/services.test.js` | Create/list/filter/search; edit and Save Draft; draft→published→disabled rules; simulated runs (success, determinism, **failure**); history order and timestamps; DB constraints; **fresh database initialisation** (new file in a missing folder, tables/indexes, no seed data) and **persistence across a backend restart** (close and reopen the database file) | no |
| `tests/controllers.test.js` | Real controllers + error handler: 200/201/400/404/409/500 and JSON shapes, invalid ids (`abc`, `1.5`, `0`, `-1`, `1e2`…), missing records, failed-run response | no |
| `tests/api.test.js` | End-to-end over real HTTP: health, 404 route, malformed JSON, oversized body, CORS, full create→edit→publish→test-run→history→disable flow for all three modules, restart persistence | **yes** (uses the installed `express`) |

### Manual checks (browser behaviour is not covered by the automated tests)

1. **Refresh persistence:** create a draft, publish another agent, run a test; press F5 on Agent Center, an agent page and History. Everything remains.
2. **Backend restart:** stop the backend with Ctrl+C, start it again, reload the page. Agents and history are unchanged.
3. **Backend stopped:** stop the backend and reload. A readable error with *Try again* appears; nothing crashes. Start the backend and click *Try again*.
4. **Module counts:** with agents in several modules, click the *Task* card. The *DSC* and *License* counts must not change.
5. **Edit a draft:** Agent Center → *Edit* on a draft (or *Edit* on its detail page) → change fields → *Save draft*. The detail page shows the changes and the status is still *Draft*. Published agents show no Edit button; opening `/agents/<id>/edit` for one shows a message.
6. **Validation:** submit an empty form, then a name of spaces only, a message of spaces only, and a condition of `0` or `1.5`. Each shows an inline message and nothing is saved.
7. **Each module:** create and publish one Task, one DSC and one License agent (try each trigger, including those with and without a condition), run a test on each, and open *View details* in History.
8. **Failure display:** with the backend stopped, click *Test run* on a published agent. An error notice appears. (A server-side `failed` simulation cannot be triggered from the UI, because the UI only saves valid configurations; the automated tests cover it.)
9. **Missing record:** open `/agents/99999`. You get "Agent not found." and a link back, not a crash.

## 7. Project structure

```
backend/
  src/server.js                 starts Express, closes SQLite cleanly on Ctrl+C
  src/app.js                    middleware, /api/health, route mounting
  src/config.js                 reads .env (one place)
  src/config/agentDefinitions.js  triggers / conditions / options (single source of truth)
  src/db/{database.js,schema.sql} connection + automatic table creation
  src/validators/agentValidator.js server-side validation and normalisation
  src/services/agentService.js    agent rules + SQL
  src/services/executionService.js simulated runs + history
  src/controllers/, src/routes/   HTTP layer
  src/middleware/errorHandler.js  consistent JSON errors
  tests/                          automated tests
frontend/src/
  app/agent-center/page.jsx       module cards, agent list, search/filters, actions
  app/agents/new/page.jsx         create
  app/agents/[id]/page.jsx        details, test runs
  app/agents/[id]/edit/page.jsx   edit a draft
  app/history/page.jsx            execution history with details
  components/AgentForm.jsx        shared create/edit form with validation + preview
  components/{Shell,RunDetails}.jsx
  services/{api.js,agentApi.js}   all HTTP calls
  store/                          Redux Toolkit (agent list, filters, actions)
```

## 8. Known limitations

- **Simulation only.** No real email, WhatsApp or in-app delivery, and no background scheduler. The Email/WhatsApp/In-app choice is stored configuration only.
- Expiry conditions are not connected to real task, DSC or license data. Test runs use fixed sample records.
- The `actual` run type exists in the schema but is not implemented; only `test` runs are recorded.
- Published agents are read-only and disabled agents cannot be re-enabled. To change a published agent, create a new one.
- No delete endpoint, no authentication or multi-user support (local demo).
- The Agent Center list loads all agents at once (no pagination); history is capped at 250 rows per request.
- **No automated frontend tests.** The frontend was checked by static analysis and the manual list above, not by browser automation.
- The UI follows the written assignment. It has **not** been compared against the Turia website or the reference screenshot/video, so visual details may differ from the original.
- The Message template is plain text (no placeholders such as `{{name}}`).
# Assignment-agent
