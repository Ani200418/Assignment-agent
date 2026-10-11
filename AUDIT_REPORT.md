# Final audit report: Turia Agent Center MVP

Scope: the project in `turia-agent-center-final.zip`, checked and completed for submission.
Everything below was actually run in the working environment unless it is listed under "Not run".
The environment had **no network access**, so `npm install`, `next build` and `next lint` could not be executed (see section 4).

## 1. Fixes made (cumulative)

| # | Area | Problem found | Fix |
|---|---|---|---|
| 1 | Task/DSC/License | Edit-a-draft had no UI (backend `PUT` was unused) | New `/agents/[id]/edit` page; Edit buttons on list and detail; one shared `AgentForm` for create and edit |
| 2 | Task/DSC/License | Conditions hard-coded to 30 days for every agent | Per-trigger condition field with limits, driven by central definitions |
| 3 | Simulation | Test run could never fail and never validated | Re-validates config, builds a fixed sample event per module, stores `failed` runs with an error message; UI shows failures |
| 4 | History | No trigger column, no details view, no loading state | Added all three; "No history" no longer flashes while loading |
| 5 | Backend | Triggers defined only in frontend; no module-trigger check; message not required; publish did not re-validate | `backend/src/config/agentDefinitions.js` is the single source; `GET /api/agent-definitions` feeds the form |
| 6 | Frontend | Module "active" counts changed with the selected filter | List is always fetched in full; filtering is done on the page; status filter added |
| 7 | Backend | Invalid ids (`abc`, `1.5`, `1e0`) accepted/NaN | Strict id parsing, `400 INVALID_ID` |
| 8 | Frontend | "Publish" failing after "create" made a duplicate on retry | Retry now updates the already-created draft |
| 9 | Tooling | `npm test` (`node --test tests/`) fails on Node 22 | Script is now `node --test` |
| 10 | Frontend | **Detail page showed "Agent published." while still displaying the old status and buttons** | Refresh from the server first, then show the message |
| 11 | Frontend | **Detail page: a rejected action's error message was wiped by the refresh that followed** | The error is re-applied after the refresh |
| 12 | Tooling | `eslint .` would lint the generated `.next/` folder after a build | `ignores` added to `frontend/eslint.config.mjs` |
| 13 | Misc | Raw "Failed to fetch" on network errors; damaged `config_json` broke the whole list; `%`/`_` acted as search wildcards; list/history tie-ordering; calls to `fetch` scattered in components | Friendly error with Try again; tolerant parsing; escaped search; id tiebreak; `services/agentApi.js` |

Items 10 and 11 were found by real-browser testing; each failed 3/3 runs before the fix and passed 3/3 after.

## 2. Checks that PASSED (actual results)

| Check | Result |
|---|---|
| Backend: validator + services + controllers tests (`node --test`) | **149 passed, 0 failed** |
| Same tests with 4 original bugs re-introduced one at a time | Caught each (48, 4, 5, 3 failures). A 5th change (history tiebreak) is not detectable by any test, since SQLite orders those ties correctly anyway; the tiebreak is a safeguard |
| Legacy data: agents saved by the earlier version still run, edit and publish | 8/8 checks passed |
| Real-browser scenarios (headless Chromium, real React pages, real controllers/validator/services/SQLite schema), run 3 times in a row | **18/18 passed each time**, zero console errors or warnings in React development mode |
| Static: every frontend file parses and all relative imports resolve (esbuild) | Passed (16 files) |
| Static: undefined names / redeclarations (TypeScript `checkJs`, with a planted-typo control that was detected) | None found |
| Static: unescaped quotes in JSX text, rules-of-hooks ordering (syntax-tree scan) | 0 problems |
| `node --check` on all backend source and test files | Passed |

Browser scenarios cover: empty states, empty/whitespace form rejection, DSC/Task/License triggers and conditions, range validation, preview, save draft, edit draft, publish, simulated test run and details, module counts vs filters, status filter, search and clear, list actions (publish/test/disable), failed simulated run, history page, backend unreachable and recovery (list, history, form), publish-failure retry without duplicate, double-click, missing/invalid ids, server-side validation error display, stale-page conflicts.

## 3. Failed checks that were fixed and re-run

- Browser S6 (publish notice vs status) and S18 (stale-page error) failed 3/3, then passed 3/3 after fixes 10 and 11.
- Browser S4 / S8 / S9 failed first. They were test mistakes (reading the form before it loaded; comparing text that legitimately changes on selection), corrected in the test, not in the product.

## 4. Not run: blocked by the environment or needs your Mac

| Check | Why | Command for your Mac |
|---|---|---|
| `npm install` for both packages, hence **`package-lock.json` files not generated** | No network | `cd backend && npm install` and `cd frontend && npm install`; commit the lockfiles |
| `backend/tests/api.test.js` (real Express + real `better-sqlite3`, over HTTP) | Express and better-sqlite3 not installable here; written but **never executed** | `cd backend && npm test` |
| The 149 passing tests used Node's built-in SQLite behind a small stand-in for `better-sqlite3` | Real driver unavailable | same `npm test` |
| `npm run lint` and `npm run build` (Next.js, Tailwind) | Not installable; `next build` also runs ESLint | `cd frontend && npm run lint && npm run build` |
| Real Next.js runtime: the browser harness used stand-ins for `next/link`, `next/navigation`, `react-redux`, `@reduxjs/toolkit` and Express routing | Packages not installable | manual checklist in README section 6 |
| Visual layout and responsiveness | Tailwind CSS not available, pages rendered unstyled | open on desktop width and a phone-width browser window |

## 5. Remaining limitations

See README "Known limitations": notifications and scheduler are simulated only; disabled agents cannot be re-enabled; published agents are read-only; no auth; the UI was built from the written brief and not compared to the Turia reference screenshot/video (not accessible).
