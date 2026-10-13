const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createApp, hashPassword, passwordMatches } = require('../server.cjs');

const admin = { id: 'admin-id', emp_id: 'admin-test', password: 'disposable-test-password', role: '系統管理員', approved: true, name: 'Test Admin', hospital: 'Test Hospital', phone: '000', ext: '00' };
const employee = { ...admin, id: 'staff-id', emp_id: 'staff-test', role: '個案管理師' };
const activeCase = { id: 'case-internal-id', case_id: 'TEST-A', status: '一輪媒合中', reply_access_token: '11111111-1111-4111-8111-111111111111', legacy_reply_link_enabled: true, target_facility_ids: ['22222222-2222-4222-8222-222222222222'], patient_id: 'PRIVATE-TEST-ID', case_manager_phone: '000' };
async function fixture(t, overrides = {}) {
  const calls = [];
  const tables = {
    case_managers: [structuredClone(admin), structuredClone(employee)],
    cases: [structuredClone(activeCase), { ...activeCase, case_id: 'TEST-NEW', legacy_reply_link_enabled: false }, { ...activeCase, case_id: 'TEST-CLOSED', status: '案件結案' }],
    facilities: [{ id: '22222222-2222-4222-8222-222222222222', facility_name: 'Test Facility' }, { id: '33333333-3333-4333-8333-333333333333', facility_name: 'Unassigned Test Facility' }],
    replies: [], facility_groups: [], platform_feedbacks: [],
  };
  const upstream = async (rawUrl, init) => {
    const url = new URL(rawUrl); calls.push({ url, ...init });
    if (url.hostname === 'n8nwfh.zeabur.app') return new Response('{}', { status: url.pathname.endsWith('/facility_reply') ? (overrides.replyNotificationStatus || 200) : 200 });
    const table = url.pathname.split('/rest/v1/')[1];
    if (table === 'rpc/refcare_submit_reply') return new Response(JSON.stringify({ saved: true, advance: !!overrides.rpcAdvance }), { status: 200 });
    assert.ok(Object.hasOwn(tables, table), `Unexpected upstream table: ${table}`);
    let rows = tables[table].filter(row => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]));
      return true;
    }));
    if (init.method === 'POST') { const input = JSON.parse(init.body); const items = Array.isArray(input) ? input : [input]; tables[table].push(...items); rows = items; }
    if (init.method === 'PATCH') { const input = JSON.parse(init.body); rows.forEach(row => Object.assign(row, input)); }
    const projection = url.searchParams.get('select');
    if (projection && projection !== '*') rows = rows.map(row => Object.fromEntries(projection.split(',').filter(k => k in row).map(k => [k, row[k]])));
    return new Response(JSON.stringify(rows), { status: init.method === 'POST' ? 201 : 200 });
  };
  const config = { serviceKey: 'test-server-only-secret', origin: 'http://refcare.test', writeEnabled: true, notificationsEnabled: false, secureCookies: false, staticDir: path.join(__dirname, 'fixtures'), ...overrides };
  const server = createApp({ config, fetchImpl: upstream });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = (route, options = {}) => fetch(base + route, { ...options, headers: { Origin: config.origin, ...options.headers } });
  const login = async (user = 'admin-test', password = admin.password) => {
    const response = await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emp_id: user, password }) });
    return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  return { request, login, calls, tables };
}
const grantHeaders = { 'X-RefCare-Case-Id': activeCase.case_id, 'X-RefCare-Reply-Token': activeCase.reply_access_token };

test('anonymous database request is rejected', async t => { const f = await fixture(t); const r = await f.request('/api/supabase/rest/v1/cases'); assert.equal(r.status, 401); assert.equal(f.calls.length, 0); });
test('login returns only safe identity and an HttpOnly session', async t => { const f = await fixture(t); const { response, cookie } = await f.login(); assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/); const x = await response.json(); assert.equal(x.data.password, undefined); assert.ok(cookie); assert.ok(f.calls.every(c => !c.url.searchParams.has('password'))); });
test('bad password and unapproved account cannot establish session', async t => { const f = await fixture(t); assert.equal((await f.login('admin-test', 'wrong')).response.status, 401); f.tables.case_managers[0].approved = false; assert.equal((await f.login()).response.status, 403); });
test('forged identity and role in browser cannot grant access', async t => { const f = await fixture(t); assert.equal((await f.request('/api/supabase/rest/v1/cases', { headers: { Cookie: 'refcare_session=fake.fake', 'X-Role': 'system-admin' } })).status, 401); });
test('current approval/role is checked again on each request', async t => { const f = await fixture(t); const { cookie } = await f.login(); f.tables.case_managers[0].approved = false; assert.equal((await f.request('/api/supabase/rest/v1/cases', { headers: { Cookie: cookie } })).status, 401); });
test('password change invalidates the existing session', async t => { const f = await fixture(t); const { cookie } = await f.login(); f.tables.case_managers[0].password = 'changed-test-password'; assert.equal((await f.request('/api/session', { headers: { Cookie: cookie } })).status, 401); });
test('staff cannot read account directory or modify facilities', async t => { const f = await fixture(t); const { cookie } = await f.login('staff-test'); assert.equal((await f.request('/api/supabase/rest/v1/case_managers', { headers: { Cookie: cookie } })).status, 403); assert.equal((await f.request('/api/supabase/rest/v1/facilities?id=eq.22222222-2222-4222-8222-222222222222', { method: 'PATCH', headers: { Cookie: cookie }, body: '{}' })).status, 403); });
test('staff response never exposes account passwords or case access tokens', async t => { const f = await fixture(t); const { cookie } = await f.login(); for (const table of ['case_managers', 'cases']) { const r = await f.request('/api/supabase/rest/v1/' + table, { headers: { Cookie: cookie } }); assert.equal(r.status, 200); const raw = await r.text(); assert.ok(!raw.includes(admin.password)); assert.ok(!raw.includes(activeCase.reply_access_token)); } });
test('relations and password projection cannot bypass sanitization', async t => { const f = await fixture(t); const { cookie } = await f.login(); for (const query of ['select=cases(*)', 'select=password']) { const r = await f.request('/api/supabase/rest/v1/case_managers?' + query, { headers: { Cookie: cookie } }); assert.ok([400, 403].includes(r.status)); } });
test('cross-origin mutation is rejected before database access', async t => { const f = await fixture(t); const r = await f.request('/api/login', { method: 'POST', headers: { Origin: 'https://other.test' }, body: '{}' }); assert.equal(r.status, 403); assert.equal(f.calls.length, 0); });
test('legacy active link redirects only to that case token', async t => { const f = await fixture(t); const r = await f.request('/facility.html?case_id=TEST-A', { redirect: 'manual' }); assert.equal(r.status, 302); const link = new URL(r.headers.get('location')); assert.equal(link.searchParams.get('case_id'), 'TEST-A'); assert.equal(link.searchParams.get('token'), activeCase.reply_access_token); assert.equal(r.headers.get('referrer-policy'), 'no-referrer'); });
test('new unsigned, closed, missing and wrong-token links never redirect', async t => { const f = await fixture(t); for (const suffix of ['case_id=TEST-NEW', 'case_id=TEST-CLOSED', 'case_id=ABSENT', 'case_id=TEST-A&token=wrong']) assert.equal((await f.request('/facility.html?' + suffix, { redirect: 'manual' })).status, 410); });
test('new signed link serves page without further redirection', async t => { const f = await fixture(t); const r = await f.request('/facility.html?case_id=TEST-NEW&token=' + activeCase.reply_access_token, { redirect: 'manual' }); assert.equal(r.status, 200); assert.equal(r.headers.get('location'), null); });
test('facility grant cannot access unrelated case or patient ID', async t => { const f = await fixture(t); assert.equal((await f.request('/api/supabase/rest/v1/cases?case_id=eq.TEST-NEW', { headers: grantHeaders })).status, 403); const r = await f.request('/api/supabase/rest/v1/cases?case_id=eq.TEST-A', { headers: grantHeaders }); assert.equal(r.status, 200); const rows = await r.json(); assert.equal(rows.length, 1); assert.equal(rows[0].patient_id, undefined); assert.equal(rows[0].reply_access_token, undefined); });
test('facility list is restricted by server to the assigned IDs', async t => { const f = await fixture(t); const r = await f.request('/api/supabase/rest/v1/facilities?select=*', { headers: grantHeaders }); assert.equal(r.status, 200); const rows = await r.json(); assert.equal(rows.length, 1); assert.equal(rows[0].id, activeCase.target_facility_ids[0]); });
test('facility page stays scoped even when its browser also has a staff session', async t => { const f = await fixture(t); const { cookie } = await f.login(); const headers = { ...grantHeaders, Cookie: cookie }; assert.equal((await f.request('/api/supabase/rest/v1/cases?case_id=eq.TEST-NEW', { headers })).status, 403); const r = await f.request('/api/supabase/rest/v1/cases?case_id=eq.TEST-A', { headers }); assert.equal((await r.json())[0].patient_id, undefined); });
test('facility cannot patch case or read management records', async t => { const f = await fixture(t); for (const table of ['case_managers', 'platform_feedbacks', 'facility_groups']) { const r = await f.request('/api/supabase/rest/v1/' + table, { headers: grantHeaders }); if (table === 'case_managers') { assert.equal(r.status, 200); assert.deepEqual(await r.json(), [{ phone: '000', ext: '' }]); } else assert.equal(r.status, 403); } assert.equal((await f.request('/api/supabase/rest/v1/cases?case_id=eq.TEST-A', { method: 'PATCH', headers: grantHeaders, body: '{"status":"媒合成功"}' })).status, 403); });
test('reply uses only server-only atomic RPC and cannot overpost fields', async t => { const f = await fixture(t); const row = { case_id: 'TEST-A', facility_id: activeCase.target_facility_ids[0], reply_status: 'accept', note: 'Disposable test' }; const r = await f.request('/api/supabase/rest/v1/replies', { method: 'POST', headers: grantHeaders, body: JSON.stringify([row]) }); assert.equal(r.status, 201); const call = f.calls.find(c => c.url.pathname.endsWith('/rpc/refcare_submit_reply')); assert.ok(call); assert.equal(JSON.parse(call.body).p_facility_id, row.facility_id); assert.ok(!f.calls.some(c => c.url.hostname === 'n8nwfh.zeabur.app')); assert.equal((await f.request('/api/supabase/rest/v1/replies', { method: 'POST', headers: grantHeaders, body: JSON.stringify([{ ...row, approved: true }]) })).status, 400); });
test('failed reply notification does not prevent the next difficult-case notification', async t => { const f = await fixture(t, { notificationsEnabled: true, rpcAdvance: true, replyNotificationStatus: 404 }); const r = await f.request('/api/supabase/rest/v1/replies', { method: 'POST', headers: grantHeaders, body: JSON.stringify([{ case_id: 'TEST-A', facility_id: activeCase.target_facility_ids[0], reply_status: 'reject', note: 'Disposable test' }]) }); assert.equal(r.status, 201); assert.deepEqual(await r.json(), [{ saved: true, notification_sent: false }]); const call = f.calls.find(c => c.url.pathname.endsWith('/case_difficult')); assert.ok(call); assert.match(JSON.parse(call.body).reply_url, /&token=/); });
test('writes can be paused without disabling read access', async t => { const f = await fixture(t, { writeEnabled: false }); const { cookie } = await f.login(); assert.equal((await f.request('/api/supabase/rest/v1/cases', { headers: { Cookie: cookie } })).status, 200); assert.equal((await f.request('/api/supabase/rest/v1/cases', { method: 'POST', headers: { Cookie: cookie }, body: '[{}]' })).status, 503); });
test('registration cannot request approval or administrator role', async t => { const f = await fixture(t); assert.equal((await f.request('/api/register', { method: 'POST', body: JSON.stringify({ emp_id: 'test-new', password: 'test', name: 'Test', phone: '000', hospital: 'Test', approved: true, role: '系統管理員' }) })).status, 400); });
test('unfiltered updates and access-control field updates are rejected', async t => { const f = await fixture(t); const { cookie } = await f.login(); assert.equal((await f.request('/api/supabase/rest/v1/cases', { method: 'PATCH', headers: { Cookie: cookie }, body: '{}' })).status, 400); assert.equal((await f.request('/api/supabase/rest/v1/cases?case_id=eq.TEST-A', { method: 'PATCH', headers: { Cookie: cookie }, body: '{"legacy_reply_link_enabled":true}' })).status, 403); });
test('static server never serves secrets, SQL or workflow exports', async t => { const f = await fixture(t); for (const route of ['/.env', '/server.cjs', '/supabase_schema.sql', '/n8n_workflow.json', '/%2e%2e%2fserver.cjs']) assert.equal((await f.request(route)).status, 404); });
test('new passwords are salted hashes while legacy credentials still work', async () => { const hash = await hashPassword('test-password'); assert.ok(!hash.includes('test-password')); assert.equal(await passwordMatches('test-password', hash), true); assert.equal(await passwordMatches('wrong', hash), false); assert.equal(await passwordMatches('old-password', 'old-password'), true); });
