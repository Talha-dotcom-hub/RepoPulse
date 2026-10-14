# RepoPulse

**Repository intelligence for the work behind the code.**

RepoPulse is a frontend-only data analytics portfolio project that reads public GitHub repository data and turns it into an interactive engineering study. It is built with React, TypeScript, Vite, and Tailwind CSS, with a restrained editorial visual system and responsive local dialogs.

**Developed by M Talha Iftikhar**

## What it does

- Accepts a public GitHub repository URL or `owner/repository`.
- Fetches public repository metadata and all language byte counts returned by GitHub using the `2026-03-10` GitHub REST API version header.
- Uses GitHub's dedicated weekly commit-activity statistics endpoint for the last-year activity chart; it does not mistake the newest commit page for full historical activity.
- Provides paginated browser views for commits on the default branch, recognized and anonymous contributors, all-state pull requests, issues, published releases, Git tags, and branches. Page through each list to continue through records exposed by GitHub's public REST API.
- Includes transparent notes for API rate limits, anonymous attribution, GitHub's cached contributor counts, default-branch commit scope, pending statistics, and the difference between releases and tags.
- Exports the overview report as JSON and exports the weekly activity aggregate as CSV.
- Provides local About and Method dialogs, an accessible mobile menu, keyboard focus handling, clipboard feedback, and reduced-motion support.
- Uses a custom inline SVG material-study and pointer-registered light sweep as the hero visual; no stock imagery or third-party media URLs are used.
- Includes a RepoPulse brand mark, favicon, installable PWA manifest, offline app-shell cache, and an in-app install guide for supported desktop/mobile browsers.

## Run locally

Requires Node.js 20.19+ or 22.12+. Tailwind CSS 4 and Vite 6 require a modern Node.js runtime.

```bash
npm install
npm run test:source
npm run dev
```

Vite prints the local development URL in the terminal.

## Dependency security

The project uses Vite 6.4.4 and Tailwind CSS 4.3.3 through the official Vite plugin. The old Tailwind 3 dependency chain reported the `braces` advisory, which currently has no published patched release; this migration removes that old chain. PostCSS is pinned at 8.5.23, beyond the currently reported vulnerable range, and is also used by the source checker to parse CSS. Run `npm audit` after install to inspect the exact resolved tree on your machine; see `SECURITY-AUDIT.md` for verification details and the tests that must pass before release. This ZIP does not include a generated `package-lock.json` because the build environment could not reach the npm registry; after the install/audit gates pass, commit the generated lockfile with the project before deploying.

## Build for production

```bash
npm run test:source
npm audit
npm audit --omit=dev
npm run build
npm run preview
```

The static production build is written to `dist/`. In production, the app registers `public/sw.js` to cache the shell and same-origin build assets. GitHub API requests are intentionally not cached; the app shell can open offline, but repository analysis requires a network connection.

## Deploy to Netlify

This repository includes `netlify.toml` and `public/_redirects`.

1. Push the `RepoPulse` folder to a GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project** and connect that repository.
3. Build command: `npm run build`.
4. Publish directory: `dist`.
5. Deploy. No environment variables or API key are required.

You can also deploy the `dist/` directory by dragging it into Netlify Drop after running the production build locally. The PWA install prompt appears only when the browser considers the site installable; Safari on iOS uses Share → Add to Home Screen.

## Data and limitations

- RepoPulse only requests unauthenticated public GitHub REST API endpoints. It does not request a GitHub login, store credentials, send data to a backend, or persist repository reports on a server.
- GitHub's unauthenticated API has rate limits. Requests can fail temporarily if the limit is reached.
- The activity chart is GitHub's last-year weekly commit-activity aggregate. It is not a lifetime total, and GitHub can return `202 Accepted` while calculating statistics. RepoPulse retries a few times and visibly labels pending/unavailable activity instead of fabricating zeros.
- Individual commits are browsed page-by-page from the repository default branch. Commits unique to other branches may not appear in that default-branch history; inspect the branch directory for available branch refs.
- Contributors, commits, pull requests, issues, releases, tags, and branches use public REST API pagination. Results are not all downloaded at once, both to avoid loading a huge repository into browser memory and to reduce unnecessary API calls.
- GitHub can return anonymous contributor entries; only the first 500 author email addresses may be linked to GitHub users for contributor statistics, and results may be cached for a few hours. The API's `open_issues_count` combines issues and pull requests. Unauthenticated API requests are normally limited to 60 requests per hour per originating IP.
- The releases view contains published GitHub releases only; the Tags view separately includes Git tags that may not have a release. Language composition is based on bytes returned by GitHub, not meaningful source lines.
- Public repository activity is not a definitive measure of code quality, project health, or individual contribution impact.
- Contributor profile links open GitHub in a new tab. The rest of the interface is local to the app.

## What the detail tabs show

- **All commits:** paged commit messages, author/committer dates, recognized account when available, SHA, and link to the commit. Defaults to the repository's default branch, with a ref field to query any branch, tag, or commit SHA.
- **Contributors:** paged contributor count results with anonymous entries requested (`anon=1`).
- **Pull requests:** all states, newest-updated order.
- **Issues:** all states, with pull requests removed from issue results even though GitHub's issues endpoint returns both kinds.
- **Releases and Tags:** separated so a repository tag is not falsely described as a published release.
- **Branches:** paginated branch names, protection status and head SHA.

## Stack

- React + ReactDOM
- TypeScript
- Vite 6.4.4
- Tailwind CSS 4.3.3 (official Vite plugin)
- GitHub REST API (public read-only requests, paginated detail data)
- Browser APIs: `fetch`, `navigator.clipboard`, `Blob`, and object URLs for exports

## Project structure

```text
RepoPulse/
├── public/
│   ├── icons/
│   │   ├── apple-touch-icon.png
│   │   ├── repopulse-icon-192.png
│   │   ├── repopulse-icon-512.png
│   │   ├── repopulse-maskable-512.png
│   │   └── repopulse-icon.svg
│   ├── manifest.webmanifest
│   ├── repopulse-mark.svg
│   ├── sw.js
│   └── _redirects
├── src/
│   ├── App.tsx
│   ├── github.ts
│   ├── index.css
│   └── main.tsx
├── index.html
├── .nvmrc
├── netlify.toml
├── scripts/
│   └── check-source.cjs
├── SECURITY-AUDIT.md
├── tsconfig.app.json
├── tsconfig.json
└── vite.config.ts
```
