const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createApp } = require('../server.cjs');
const { nextVersion } = require('../scripts/bump-release.cjs');
const core = import('../src/update-core.mjs');

async function fixture(overrides = {}) {
  const { createUpdater } = await core;
  const navigations = [], changes = [], confirmations = [];
  const updater = createUpdater({ currentVersion: '2026.10.14-01', fetchLatest: async () => '2026.10.14-02', onChange: x => changes.push(x), pendingWrites: () => 0, dirty: () => false, confirm: x => { confirmations.push(x); return true; }, navigate: x => navigations.push(x), href: () => 'https://refcare.test/admin.html?view=cases#details', nonce: () => 'test-once', ...overrides });
  return { updater, navigations, changes, confirmations };
}
test('new version notification keeps the loaded page version and never auto-reloads', async () => {
  const f = await fixture(); await f.updater.check();
  assert.equal(f.updater.state.currentVersion, '2026.10.14-01');
  assert.equal(f.updater.state.latestVersion, '2026.10.14-02');
  assert.deepEqual(f.navigations, []);
});
test('cancel update keeps an edited draft and stays on the original page', async () => {
  const draft = { note: 'Synthetic unsaved note' };
  const f = await fixture({ dirty: () => true, confirm: () => false });
  assert.equal(await f.updater.update(), 'cancelled');
  assert.equal(draft.note, 'Synthetic unsaved note'); assert.deepEqual(f.navigations, []);
  assert.equal(f.updater.state.updating, false);
});
test('confirmed update preserves case token, other query parameters and hash with one fresh GET URL', async () => {
  const f = await fixture({ dirty: () => true, href: () => 'https://refcare.test/facility.html?case_id=TEST-A&token=synthetic-token&view=reply#form' });
  assert.equal(await f.updater.update(), 'updated');
  const url = new URL(f.navigations[0]);
  assert.equal(url.searchParams.get('case_id'), 'TEST-A'); assert.equal(url.searchParams.get('token'), 'synthetic-token');
  assert.equal(url.searchParams.get('view'), 'reply'); assert.equal(url.hash, '#form');
  assert.equal(url.searchParams.get('_refcare_reload'), '2026.10.14-02-test-once');
  assert.equal(f.confirmations.length, 1);
});
test('pending saves block updates, including a save starting during the version request', async () => {
  let pending = 1, checked = 0;
  const f = await fixture({ pendingWrites: () => pending, fetchLatest: async () => { checked++; pending = 1; return '2026.10.14-02'; } });
  assert.equal(await f.updater.update(), 'busy'); assert.equal(checked, 0);
  pending = 0;
  assert.equal(await f.updater.update(), 'busy'); assert.equal(checked, 1);
  assert.deepEqual(f.navigations, []);
});
test('double-click shares one check and performs only one navigation', async () => {
  let resolve, checked = 0;
  const f = await fixture({ fetchLatest: () => { checked++; return new Promise(r => { resolve = r; }); } });
  const first = f.updater.update();
  assert.equal(await f.updater.update(), 'busy');
  resolve('2026.10.14-02'); await first;
  assert.equal(checked, 1); assert.equal(f.navigations.length, 1);
});
test('version failure is not reported as current; manual recovery remains available', async () => {
  const f = await fixture({ fetchLatest: async () => { throw new Error('Synthetic offline'); } });
  await f.updater.check(); assert.equal(f.updater.state.failed, true); assert.equal(f.updater.state.latestVersion, null);
  await f.updater.update();
  assert.equal(new URL(f.navigations[0]).searchParams.get('_refcare_reload'), '2026.10.14-01-test-once');
});
test('numeric versions compare correctly and an older server does not trigger a downgrade', async () => {
  const { compareVersions } = await core;
  assert.equal(compareVersions('2026.10.14-10', '2026.10.14-09'), 1);
  assert.equal(compareVersions('2026.10.15-01', '2026.10.14-99'), 1);
  const f = await fixture({ fetchLatest: async () => '2026.10.13-99' });
  assert.equal(await f.updater.update(), 'switching'); assert.deepEqual(f.navigations, []);
});
test('release date uses Taiwan time and advances the daily sequence only on explicit release', () => {
  assert.equal(nextVersion('2026.10.13-09', new Date('2026-10-13T16:30:00Z')), '2026.10.14-01');
  assert.equal(nextVersion('2026.10.14-09', new Date('2026-10-14T00:00:00Z')), '2026.10.14-10');
  assert.throws(() => nextVersion('2026.10.15-01', new Date('2026-10-14T00:00:00Z')));
});
test('public version endpoint needs no login or database, prevents caching and survives restart', async t => {
  for (let i = 0; i < 2; i++) {
    let calls = 0;
    const server = createApp({ config: { appVersion: '2026.10.14-01', serviceKey: 'synthetic-secret' }, fetchImpl: async () => { calls++; throw new Error('No database access expected'); } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/version');
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { version: '2026.10.14-01' }); assert.equal(calls, 0);
  }
});
test('shared browser fetch guard counts overlapping SDK writes and unwinds failures without changing requests', async () => {
  const pending = [], events = [];
  let sdkFetch;
  const originalFetch = async (url, init = {}) => {
    if (String(url).endsWith('/api/session')) return new Response('{"data":null}');
    return new Promise((resolve, reject) => pending.push({ resolve, reject, url, init }));
  };
  const window = { fetch: originalFetch, location: { search: '', origin: 'https://refcare.test' }, dispatchEvent: () => events.push(window.refcareRequests.pendingWrites), supabase: { createClient: (_url, _key, options) => { sdkFetch = options.global.fetch; return {}; } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/supabase-config.js'), 'utf8'), { window, document: { visibilityState: 'visible' }, Headers, Event, URL, URLSearchParams, sessionStorage: { setItem() {}, removeItem() {} }, setInterval() {}, clearInterval() {} });
  await window.refcareReady;
  const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[{"case_id":"TEST"}]' };
  const first = sdkFetch('https://refcare.test/api/supabase/rest/v1/cases?columns=%22case_id%22', init);
  const second = sdkFetch('https://refcare.test/api/supabase/rest/v1/replies', init);
  assert.equal(window.refcareRequests.pendingWrites, 2);
  assert.equal(pending[0].init.body, init.body); assert.equal(pending[0].init.credentials, 'same-origin');
  pending[0].resolve(new Response('[]', { status: 201 })); await first; assert.equal(window.refcareRequests.pendingWrites, 1);
  pending[1].reject(new Error('Synthetic failed write')); await assert.rejects(second); assert.equal(window.refcareRequests.pendingWrites, 0);
  assert.deepEqual(events, [1, 2, 1, 0]);
});
