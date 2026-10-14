/* Offline-friendly source + GitHub API tests. Uses project dev dependencies and Node built-ins only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const postcss = require('postcss');

const root = path.resolve(__dirname, '..');
const typeFiles = ['src/App.tsx', 'src/github.ts', 'src/main.tsx', 'vite.config.ts'];
for (const relative of typeFiles) {
  const filename = path.join(root, relative);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      isolatedModules: true,
    },
  });
  const errors = (output.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${relative} has TypeScript/TSX syntax diagnostics: ${errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('; ')}`);
}
console.log(`PASS: TypeScript/TSX syntax parsed (${typeFiles.length} files)`);
assert.equal((fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8').match(/The threshold you asked for is not staged/g) || []).length, 1, '404 body copy must not be duplicated');
console.log('PASS: 404 copy is singular and not repeated');

const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const cssRoot = postcss.parse(css, { from: path.join(root, 'src/index.css') });
assert(cssRoot.nodes.some((node) => node.type === 'atrule' && node.name === 'import' && node.params.includes('tailwindcss')), 'Tailwind v4 import is missing');
for (const tab of ['commits', 'contributors', 'pulls', 'issues', 'releases', 'tags', 'branches']) {
  assert(css.includes(`.results-tab-${tab}`), `Accent styling is missing for ${tab}`);
}
assert(css.includes('.repository-detail-item'), 'Repository detail item styles are missing');

console.log('PASS: CSS syntax parsed, Tailwind v4 entry and detail-tab styling found');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(html.includes('rel="manifest" href="/manifest.webmanifest"'), 'PWA manifest link missing from index.html');
assert(html.includes('rel="apple-touch-icon"'), 'Apple touch icon link missing');
assert(html.includes('href="/icons/repopulse-icon.svg"'), 'SVG favicon link missing');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
assert.equal(manifest.name, 'RepoPulse — Repository Intelligence');
assert.equal(manifest.display, 'standalone');
assert(manifest.icons.some((entry) => entry.sizes === '192x192' && entry.purpose === 'any'), '192px app icon missing');
assert(manifest.icons.some((entry) => entry.sizes === '512x512' && entry.purpose === 'any'), '512px app icon missing');
assert(manifest.icons.some((entry) => entry.sizes === '512x512' && entry.purpose === 'maskable'), 'Maskable app icon missing');
for (const [relative, size] of [['public/icons/repopulse-icon-192.png', 192], ['public/icons/repopulse-icon-512.png', 512], ['public/icons/repopulse-maskable-512.png', 512], ['public/icons/apple-touch-icon.png', 180]]) {
  const png = fs.readFileSync(path.join(root, relative));
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', `${relative} must be a PNG file`);
  assert.equal(png.readUInt32BE(16), size, `${relative} width incorrect`);
  assert.equal(png.readUInt32BE(20), size, `${relative} height incorrect`);
}
const serviceWorker = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
assert(serviceWorker.includes("const CACHE_NAME = 'repopulse-shell-v1.3.0'"), 'Service worker cache version missing');
assert(serviceWorker.includes("if (url.origin !== self.location.origin) return;"), 'Service worker must not intercept remote API requests');
assert(serviceWorker.includes("url.pathname.startsWith('/assets/')"), 'Service worker should cache built static assets');
assert(serviceWorker.includes('shellHtml.matchAll'), 'Service worker should discover and pre-cache hashed Vite JS/CSS bundles on installation');
assert(serviceWorker.includes("await cache.put('/index.html', shellResponse.clone())"), 'Offline navigation fallback must have cached HTML');
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
assert(appSource.includes("panel === 'install'"), 'PWA install dialog is not wired into app panels');
assert(appSource.includes("window.addEventListener('beforeinstallprompt'"), 'Install prompt event listener missing');
assert(appSource.includes("navigator.serviceWorker.register('/sw.js'"), 'Production service worker registration missing');
console.log('PASS: PWA manifest, icons, install UI, service worker and offline-shell rules');


const githubPath = path.join(root, 'src/github.ts');
const githubJs = ts.transpileModule(fs.readFileSync(githubPath, 'utf8'), {
  fileName: githubPath,
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const githubModule = new Module(githubPath, module);
githubModule.filename = githubPath;
githubModule.paths = Module._nodeModulePaths(path.dirname(githubPath));
githubModule._compile(githubJs, githubPath);
const api = githubModule.exports;

assert.deepEqual(api.parseRepositoryInput('vercel/next.js'), { owner: 'vercel', repo: 'next.js' });
assert.deepEqual(api.parseRepositoryInput('https://github.com/facebook/react.git'), { owner: 'facebook', repo: 'react' });
assert.deepEqual(api.parseRepositoryInput('https://github.com/vercel/next.js/tree/canary'), { owner: 'vercel', repo: 'next.js' });
assert.throws(() => api.parseRepositoryInput(''), /Enter a public GitHub/);
assert.throws(() => api.parseRepositoryInput('https://example.com/owner/repo'), /github.com repository URL/);
assert.throws(() => api.parseRepositoryInput('owner/repo/path'), /Use owner\/repository/);
assert.throws(() => api.parseRepositoryInput('../repo'), /unsupported characters/);
console.log('PASS: repository URL parser valid and invalid inputs');

const mockRepo = {
  id: 1, name: 'repo', full_name: 'owner/repo', html_url: 'https://github.com/owner/repo',
  description: 'Test repository', homepage: 'https://example.test', stargazers_count: 42, forks_count: 7,
  open_issues_count: 3, watchers_count: 10, language: 'TypeScript', default_branch: 'main', visibility: 'public',
  created_at: '2020-01-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', pushed_at: '2026-10-01T00:00:00Z',
  size: 120, topics: ['analytics'], license: { name: 'MIT License', spdx_id: 'MIT' }, fork: false, archived: false,
};
const commits = [{
  sha: '0123456789abcdef', html_url: 'https://github.com/owner/repo/commit/0123456789abcdef',
  commit: { message: 'Add feature\n\nMore detail', author: { name: 'Developer', email: 'dev@example.test', date: '2026-10-01T12:00:00Z' }, committer: null },
  author: { login: 'developer', avatar_url: 'https://github.com/images/dev.png', html_url: 'https://github.com/developer' },
}];
const linkNext = '<https://api.github.com/repos/owner/repo/commits?per_page=30&page=2>; rel="next", <https://api.github.com/repos/owner/repo/commits?per_page=30&page=4>; rel="last"';
const weekly = [
  { week: Math.floor(Date.parse('2026-09-27T00:00:00Z') / 1000), total: 4, days: [0, 1, 1, 1, 0, 1, 0] },
  { week: Math.floor(Date.parse('2026-10-04T00:00:00Z') / 1000), total: 3, days: [0, 0, 1, 1, 1, 0, 0] },
];
const endpoints = [];
const originalFetch = global.fetch;
let statsCalls = 0;
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
}
function urlHas(url, fragment) { return String(url).includes(fragment); }

(async () => {
  try {
    global.fetch = async (url) => {
      const address = String(url);
      endpoints.push(address);
      if (address.endsWith('/repos/owner/repo')) return jsonResponse(mockRepo);
      if (address.endsWith('/repos/owner/repo/languages')) return jsonResponse({ TypeScript: 800, CSS: 150, HTML: 50 });
      if (urlHas(address, '/stats/commit_activity')) {
        statsCalls += 1;
        if (statsCalls === 1) return new Response(null, { status: 202, headers: { 'retry-after': '0' } });
        return jsonResponse(weekly);
      }
      if (urlHas(address, '/commits?')) {
        if (urlHas(address, 'page=1')) return jsonResponse(commits, 200, { link: linkNext });
        return jsonResponse([]);
      }
      if (urlHas(address, '/contributors?')) {
        assert(urlHas(address, 'anon=1'), 'Contributor request must ask GitHub to include anonymous commit authors');
        assert(urlHas(address, 'per_page=100'), 'Contributor pages should request the API maximum');
        return jsonResponse([
          { login: 'developer', avatar_url: '', html_url: 'https://github.com/developer', contributions: 20 },
          { name: 'Anonymous committer', email: 'hidden-email@example.test', contributions: 2 },
        ]);
      }
      if (urlHas(address, '/pulls?')) return jsonResponse([{ number: 8, html_url: 'https://github.com/owner/repo/pull/8', title: 'Feature PR', state: 'open', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z', closed_at: null, merged_at: null, user: { login: 'developer' } }]);
      if (urlHas(address, '/issues?')) return jsonResponse([
        { number: 4, html_url: 'https://github.com/owner/repo/issues/4', title: 'Bug issue', state: 'open', created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-03T00:00:00Z', closed_at: null, user: { login: 'developer' }, labels: [{ name: 'bug', color: 'B85E3E' }] },
        { number: 8, html_url: 'https://github.com/owner/repo/pull/8', title: 'Feature PR', state: 'open', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z', closed_at: null, user: { login: 'developer' }, pull_request: {} },
      ]);
      if (urlHas(address, '/releases?')) return jsonResponse([{ id: 2, html_url: 'https://github.com/owner/repo/releases/tag/v1', tag_name: 'v1', name: 'Version 1', draft: false, prerelease: false, created_at: '2026-01-01T00:00:00Z', published_at: '2026-01-02T00:00:00Z', author: null, assets: [] }]);
      if (urlHas(address, '/tags?')) return jsonResponse([{ name: 'v1', zipball_url: '', tarball_url: '', commit: { sha: '0123456789abcdef', url: '' } }]);
      if (urlHas(address, '/branches?')) return jsonResponse([{ name: 'main', protected: true, commit: { sha: 'abcdef0123456789', url: '' } }]);
      return jsonResponse({ message: `Unexpected test endpoint: ${address}` }, 500);
    };

    const report = await api.analyzeRepository('owner/repo');
    assert.equal(report.repository.full_name, 'owner/repo');
    assert.equal(report.activityStatus, 'ready');
    assert.equal(report.activity.length, 2);
    assert.equal(report.activityTotal, 7, 'weekly totals should preserve the API aggregate');
    assert.equal(report.languages.length, 3, 'all language rows must be retained');
    assert.equal(Math.round(report.languages.reduce((sum, row) => sum + row.percentage, 0)), 100);
    assert(endpoints.some((url) => urlHas(url, '/stats/commit_activity')), 'activity must use the statistics endpoint, not the latest 100 commits');
    assert(report.dataNotes.some((note) => note.includes('not a lifetime total')));
    assert.equal(statsCalls, 2, '202 statistics should be retried before returning ready data');
    console.log('PASS: repository overview uses weekly aggregate stats, all language rows, and retries GitHub 202');

    const commitPage = await api.fetchRepositoryPage('commits', 'owner/repo', 1);
    assert.equal(commitPage.items.length, 1);
    assert.equal(commitPage.items[0].sha, commits[0].sha);
    assert.equal(commitPage.hasNext, true);
    assert.equal(commitPage.totalPages, 4, 'pagination header should be parsed when exposed');
    await api.fetchRepositoryPage('commits', 'owner/repo', 1, 'feature/auth');
    assert(endpoints.some((url) => url.includes('/commits?') && url.includes('sha=feature%2Fauth')), 'commit explorer must support branch/tag/SHA refs');
    const lastCommitPage = await api.fetchRepositoryPage('commits', 'owner/repo', 4);
    assert.equal(lastCommitPage.items.length, 0);
    assert.equal(lastCommitPage.hasNext, false);
    console.log('PASS: commit pagination, visible page metadata and branch/tag/SHA ref selection');

    const contributorPage = await api.fetchRepositoryPage('contributors', 'owner/repo', 1);
    assert.equal(contributorPage.items.length, 2);
    assert.equal(contributorPage.items[1].name, 'Anonymous committer');
    const pullsPage = await api.fetchRepositoryPage('pulls', 'owner/repo', 1);
    assert.equal(pullsPage.items.length, 1);
    const issuePage = await api.fetchRepositoryPage('issues', 'owner/repo', 1);
    assert.equal(issuePage.items.length, 1, 'pull requests must be excluded from issue results');
    assert.equal(issuePage.rawCount, 2, 'issues should retain the raw API count to keep paging aligned');
    const releasePage = await api.fetchRepositoryPage('releases', 'owner/repo', 1);
    assert.equal(releasePage.items[0].tag_name, 'v1');
    const tagPage = await api.fetchRepositoryPage('tags', 'owner/repo', 1);
    assert.equal(tagPage.items[0].name, 'v1');
    const branchPage = await api.fetchRepositoryPage('branches', 'owner/repo', 1);
    assert.equal(branchPage.items[0].protected, true);
    console.log('PASS: contributors (including anonymous), PRs, issues, releases, tags and branches API mapping');

    global.fetch = async () => jsonResponse({ message: 'Not Found' }, 404);
    await assert.rejects(() => api.analyzeRepository('owner/repo'), /Repository not found, private, or inaccessible/);
    global.fetch = async () => jsonResponse({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0' });
    await assert.rejects(() => api.analyzeRepository('owner/repo'), /public API rate limit reached/);
    global.fetch = async () => { throw new TypeError('network failed'); };
    await assert.rejects(() => api.analyzeRepository('owner/repo'), /Could not reach GitHub/);
    console.log('PASS: 404, rate-limit and network-failure handling');
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error('FAIL: source and GitHub API tests');
  console.error(error);
  process.exitCode = 1;
});
