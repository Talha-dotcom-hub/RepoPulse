# RepoPulse — Security, Data Coverage, and Quality Audit

**Review date:** 2026-10-15  
**Release:** 1.3.0  
**Scope:** React/TypeScript source, public GitHub REST API integration, activity aggregation, all paginated repository detail tabs, local exports, frontend dependencies, and deploy configuration.

## Dependency/security changes

- **Vite:** upgraded to `6.4.4` to address the October 2026 Vite 6 advisory affecting earlier 6.4.x versions. Advisory: https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw
- **Tailwind CSS:** migrated from Tailwind 3 to `4.3.3` using the official `@tailwindcss/vite` plugin. This removes the earlier Tailwind 3 dependency path which reported the `braces` advisory. Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- **PostCSS:** pinned to `8.5.23` via `overrides`, beyond the versions listed in the reported source-map disclosure advisory. Advisory: https://github.com/advisories/GHSA-fxqj-rqcc-2cmp
- **React/ReactDOM:** kept on `18.3.1`.
- **Node.js:** documented `^20.19.0 || >=22.12.0` to match the current build tooling.
- **Important audit caveat:** this environment could not resolve `registry.npmjs.org` (`EAI_AGAIN`). This report therefore does **not** claim that the complete newly resolved dependency tree was freshly installed or that `npm audit` returned zero vulnerabilities. The project ZIP deliberately does not include a fabricated lockfile; generate and commit `package-lock.json` from a successful install and review its audit results before release.

## Repository-intelligence changes

- Replaced the previous chart source (the newest 100 individual commit records) with GitHub's `GET /repos/{owner}/{repo}/stats/commit_activity` endpoint. The Activity view now uses GitHub's weekly aggregate for approximately the last year. `202 Accepted` responses are retried; unavailable/pending data is labelled rather than silently represented as a confirmed zero.
- Added paginated, on-demand data views for commits, contributors (requesting `anon=1`), all-state pull requests, issues, published releases, Git tags, and branches. Pages use API pagination metadata where available rather than claiming that one response is the entire repository.
- Added a commit ref selector to browse an individual branch, tag, or SHA. The default is the repository's default branch; the commit list does **not** silently claim that one default-branch history includes commits unique to all other branches.
- Filtered pull-request objects out of the issues view because the GitHub issues endpoint returns both issue and pull-request records. Issue pagination follows the unfiltered raw page boundaries so results are not shifted or double-counted across pages.
- Preserved all language rows returned by GitHub and calculated percentages from byte counts, not just the largest few languages.
- Added source notes for API coverage and limits, timeouts, clearer 404/rate-limit/network errors, and page-level counts.
- Kept exports local to the browser and deferred object-URL cleanup to reduce premature revocation risk.
- Kept the About credit: **Developed by M Talha Iftikhar**.

## Checks executed in this environment

| Check | Result | What was actually checked |
|---|---|---|
| `package.json` JSON parsing | PASS | Parsed locally with Python's JSON module after version bump to `1.3.0`. |
| TypeScript/TSX syntax | PASS | Used the installed TypeScript compiler's `transpileModule` diagnostics for `src/App.tsx`, `src/github.ts`, `src/main.tsx`, and `vite.config.ts`. This is a syntax check, not by itself a complete React typecheck. |
| CSS parsing | PASS | Parsed `src/index.css` with PostCSS and checked Tailwind 4 import and detail-tab styling. |
| Repository URL parsing | PASS | Valid and invalid URL/owner-repository inputs covered in `scripts/check-source.cjs`. |
| Weekly activity mapping | PASS | Mocked last-year weekly API response, total aggregation, all-language rows, and retry after GitHub `202 Accepted`. |
| Commit pagination/ref | PASS | Mocked Link header including `next`/`last`, page metadata, empty terminal page, and branch/tag/SHA ref query. |
| Contributor mapping | PASS | Mocked recognized and anonymous contributor records; asserted `anon=1` and `per_page=100`. |
| Pull requests/issues/releases/tags/branches mapping | PASS | Mocked responses; confirmed issues filter PR entries and release/tag views remain separate. |
| 404, rate limit, network failure | PASS | Mocked error responses and connection failure; verifies user-facing error paths. |
| Strict standalone TypeScript check of `src/github.ts` | PASS | Compiled the API/data module with strict TypeScript flags. |
| Lightweight app semantic check | PASS WITH SCOPE NOTE | TypeScript semantic check of app files was performed using temporary React declarations because npm dependencies could not be resolved here. This is not equivalent to compiling against the installed React type packages. |
| PWA manifest and icon assets | PASS | Manifest parsed; local PNG icon signatures and dimensions checked; all referenced paths exist. |
| Service worker syntax/offline shell simulation | PASS | `node --check public/sw.js`; mocked install confirms hashed JS/CSS assets are pre-cached and a navigation can fall back to cached HTML after simulated network loss. |
| PWA install wiring and mobile-layout guards | PASS (source checks) | Verified install prompt listener, install dialog wiring, responsive tablet menu rules, short-phone menu spacing, and overflow-aware dialog styles. This is not a real device visual test. |
| `npm install` for this revision on this host | BLOCKED | Registry lookup failed with `EAI_AGAIN registry.npmjs.org`. |
| Full `npm audit` for this revision | NOT VERIFIED | Must run against the lockfile generated by `npm install` on a networked machine. No clean-audit claim is made. |
| Full `npm run build` for this revision | NOT VERIFIED HERE | The new Tailwind 4/Vite 6 package tree could not be installed on this build host. Run locally before deployment. |
| Browser QA of this exact revision | NOT VERIFIED HERE | The latest repo-intelligence panels need to be checked in the local preview at desktop and mobile sizes. Earlier versions working locally do not verify this code revision. |

## Data completeness and accuracy boundaries

RepoPulse aims to display the records exposed by GitHub's public REST API, with page-by-page navigation. It cannot honestly promise absolute 100% completeness independent of GitHub, API availability, privacy rules, or the view selected.

- **Activity chart:** GitHub documents `stats/commit_activity` as the last year grouped by week. It is not the repository's lifetime history. Reference: https://docs.github.com/en/rest/metrics/statistics
- **Individual commits:** records are loaded page-by-page for the selected ref. The default ref is the default branch. Select another branch, tag, or SHA to inspect a different history.
- **Contributors:** the endpoint's data may be cached for a few hours. GitHub says only the first 500 author email addresses are linked to GitHub accounts for contributor statistics; anonymous authors can be returned. Reference: https://docs.github.com/en/rest/repos/repos
- **Pagination:** GitHub returns a subset of large collections per response and documents using the `Link` header for further pages. RepoPulse follows this instead of loading all history into browser memory. Reference: https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api
- **Rate limit:** unauthenticated public REST calls are normally limited to 60 requests per hour per originating IP, and secondary limits also exist. Reference: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- **Issues and pull requests:** the issues endpoint contains both; RepoPulse filters pull-request records out of the Issues tab, while the Pull requests tab requests all states separately.
- **Releases and tags:** a tag does not necessarily have a published release, so these are separate views.
- **Contribution meaning:** GitHub contributor counts and language byte counts are descriptive platform data, not a definitive score of engineering quality or individual impact.

## Required local release gate

Run these commands from the extracted project directory on a machine with npm registry access:

```powershell
npm install
npm run test:source
npm audit
npm audit --omit=dev
npm run build
npm run preview
```

Before deployment, review the full audit output, confirm a successful build, and exercise repository analysis plus every detail tab in the browser. If the full audit reports a transitive advisory, do not use `npm audit fix --force` blindly; update the affected dependency deliberately and repeat the build and tests.

## Honest final status

The source/API mock tests and static checks listed as PASS were run and passed in this environment. A clean full dependency audit, the full Vite production build, and browser testing for this exact revision are **not verified here**, because the npm registry was unreachable. This is not a “100% bug-free” certification. The application handles known public-API limits transparently, and the local release gate above is still required before production deployment.


## PWA and mobile install update (v1.3.0)

- Added a local RepoPulse SVG brand mark, SVG favicon, Apple touch icon, 192px/512px PNG icons, and a maskable 512px icon.
- Added `manifest.webmanifest` with standalone display, app scope, theme/background colors, and valid icon declarations.
- Added an opt-in production-only service worker. It precaches the app shell, icons, and the hashed Vite JS/CSS bundles discovered from built `index.html`, caches same-origin Vite assets, uses a network-first navigation strategy with an offline shell fallback, and does not intercept third-party GitHub API requests.
- Added an install guide dialog and install controls for desktop navigation and the mobile menu. Native installation prompts are triggered only from a user click; browsers that do not expose `beforeinstallprompt` receive manual installation instructions.
- Added source checks for manifest parsing, PWA metadata, PNG signatures/dimensions, service-worker boundaries, cached HTML and hashed-bundle precaching, and install-event wiring.
- Mobile layout safeguards keep desktop navigation controls hidden in the 768–1023px tablet range, use the mobile menu there, and reduce menu spacing on short phone viewports. The PWA install dialog wraps content to avoid long-text overflow.

## Tests that must still be run on the release machine

Run `npm install`, `npm run test:source`, `npm audit`, `npm audit --omit=dev`, `npm run build`, and `npm run preview` in that order. Confirm the install prompt on an installable Chromium browser, manual Add to Home Screen instructions on iOS Safari, and offline shell on a secure origin after one successful online load. Offline repository analysis is intentionally unavailable. The service worker passed a simulated offline-shell test, but this report does not claim that the complete React app was built or that real browser/device visual QA was executed here.
