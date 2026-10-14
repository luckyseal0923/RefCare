const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { createApp } = require('../server.cjs');
const core = import('../src/time-core.mjs');

test('facility page expands service codes from REST arrays and legacy encoded JSON', () => {
  const html = fs.readFileSync(path.join(__dirname, '../facility.html'), 'utf8');
  const source = html.slice(html.indexOf('    function formatServiceCodes(value)'), html.indexOf('    function showStatus(type, message)'));
  const format = vm.runInNewContext(source + '\nformatServiceCodes');
  assert.equal(format(['SC09']), 'SC09 居家短照');
  assert.equal(format(encodeURIComponent(JSON.stringify(['SC09']))), 'SC09 居家短照');
  assert.equal(format(['SC09 居家短照']), 'SC09 居家短照');
  assert.equal(format(['CUSTOM 保留自訂內容']), 'CUSTOM 保留自訂內容');
  assert.equal(format([]), '未選擇');
});

test('Taiwan datetime inputs cross UTC midnight correctly', async () => {
  const { taiwanInput, taiwanISO } = await core;
  assert.equal(taiwanInput('2026-10-13T16:30:45.678Z'), '2026-10-14T00:30');
  assert.equal(taiwanInput('2026-10-14T08:15:00Z'), '2026-10-14T16:15');
  assert.equal(taiwanISO('2026-10-14T00:30'), '2026-10-13T16:30:00.000Z');
  assert.equal(taiwanInput(null), '');
  assert.throws(() => taiwanISO('2026-02-30T10:00'));
});

test('editing another field preserves the original timestamp and sub-minute precision', async () => {
  const { taiwanInput, editedTimestamp } = await core;
  const saved = '2026-10-14T07:25:49.321+00:00';
  const typed = taiwanInput(saved);
  assert.equal(typed, '2026-10-14T15:25');
  assert.equal(editedTimestamp(typed, saved), undefined);
  assert.equal(editedTimestamp('2026-10-14T15:26', saved), '2026-10-14T07:26:00.000Z');
  assert.equal(editedTimestamp('', saved), null);
  assert.equal(editedTimestamp('', null), undefined);
});

test('Taiwan time edits give the same saved instant in Taiwan, UTC and New York', () => {
  const code = "const m=await import('./src/time-core.mjs');process.stdout.write(m.taiwanISO('2026-10-14T15:25')+'|'+m.taiwanInput('2026-10-14T07:25:00Z'));";
  for (const zone of ['Asia/Taipei', 'UTC', 'America/New_York']) {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: path.join(__dirname, '..'), env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.equal(output, '2026-10-14T07:25:00.000Z|2026-10-14T15:25', zone);
  }
});

test('server-synchronized clock advances while a form is open without reading the PC wall clock', async () => {
  const { serverClock, taiwanInput } = await core;
  let monotonic = 500;
  const clock = serverClock(() => monotonic);
  assert.equal(clock.now(), null);
  clock.sync('2026-10-14T07:25:00Z', 200);
  assert.equal(taiwanInput(clock.now()), '2026-10-14T15:25');
  monotonic += 12 * 60 * 1000;
  assert.equal(taiwanInput(clock.now()), '2026-10-14T15:37');
  assert.throws(() => clock.sync(null));
  assert.throws(() => clock.sync('2026-10-14T15:25'));
});

test('public server time is current, uncached, and needs no login or database access', async t => {
  let dbCalls = 0;
  const app = createApp({ config: { serviceKey: '' }, fetchImpl: () => { dbCalls++; throw new Error('No database expected'); } });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => { app.closeAllConnections(); return new Promise(resolve => app.close(resolve)); });
  const before = Date.now();
  const response = await fetch('http://127.0.0.1:' + app.address().port + '/api/time');
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Object.keys(result).sort(), ['server_time', 'time_zone']);
  assert.equal(result.time_zone, 'Asia/Taipei');
  assert.ok(Date.parse(result.server_time) >= before && Date.parse(result.server_time) <= Date.now());
  assert.equal(dbCalls, 0);
});
