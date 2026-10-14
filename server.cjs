const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const ACTIVE = new Set(['一輪媒合中', '二輪媒合中', '三輪媒合中']);
const TABLES = new Set(['cases', 'replies', 'facilities', 'facility_groups', 'case_managers', 'platform_feedbacks']);
const ADMIN_TABLES = new Set(['case_managers', 'platform_feedbacks']);
const HIDDEN = new Set(['password', 'reply_access_token', 'legacy_reply_link_enabled']);
const CLOSED_HTML = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>RefCare 案件回覆</title><body><main style="max-width:600px;margin:80px auto;padding:24px;font-family:sans-serif"><h1>此連結目前無法使用</h1><p>案件可能已停止收回覆，或連結不完整。請聯絡原起案個管師取得可用連結。</p></main></body></html>';
class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
function assert(ok, status, message) { if (!ok) throw new AppError(status, message); }
function equal(a, b) { const x = crypto.createHash('sha256').update(String(a)).digest(); const y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); }
function clean(data, extra = []) {
  if (Array.isArray(data)) return data.map(x => clean(x, extra));
  if (data && typeof data === 'object') return Object.fromEntries(Object.entries(data).filter(([k]) => !HIDDEN.has(k) && !extra.includes(k)).map(([k, v]) => [k, clean(v, extra)]));
  return data;
}
async function hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); const hash = await scrypt(password, salt, 64); return `scrypt$${salt}$${hash.toString('hex')}`; }
async function passwordMatches(password, stored) {
  if (!stored) return false;
  if (!stored.startsWith('scrypt$')) return equal(password, stored);
  const [, salt, digest] = stored.split('$');
  if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(digest || '')) return false;
  return equal((await scrypt(password, salt, 64)).toString('hex'), digest);
}

function createApp(options = {}) {
  const config = {
    appVersion: require('./release.json').version,
    supabaseUrl: process.env.SUPABASE_URL || 'https://supabase-ref-care.zeabur.app',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    origin: process.env.APP_ORIGIN || 'https://refcare.zeabur.app',
    writeEnabled: process.env.REFCARE_WRITE_ENABLED === 'true',
    notificationsEnabled: process.env.REFCARE_NOTIFICATIONS_ENABLED === 'true',
    secureCookies: process.env.NODE_ENV !== 'development',
    staticDir: path.join(__dirname, 'dist'),
    ...options.config,
  };
  const upstreamFetch = options.fetchImpl || fetch;
  const versionProvider = options.versionProvider || (() => config.appVersion);
  const cookieKey = crypto.createHash('sha256').update(`refcare-session-v1:${config.serviceKey}`).digest();
  const attempts = new Map();
  function limited(key, max = 12) {
    const now = Date.now();
    if (attempts.size > 5000) { for (const [k, v] of attempts) if (v.until < now) attempts.delete(k); }
    assert(attempts.size < 10000 || attempts.has(key), 429, '請稍後再試');
    let v = attempts.get(key);
    if (!v || v.until < now) { v = { count: 0, until: now + 300000 }; attempts.set(key, v); }
    assert(++v.count <= max, 429, '嘗試次數過多，請五分鐘後再試');
  }
  function sign(payload) { const body = Buffer.from(JSON.stringify(payload)).toString('base64url'); return `${body}.${crypto.createHmac('sha256', cookieKey).update(body).digest('base64url')}`; }
  function readSession(req) {
    const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('refcare_session='));
    if (!cookie) return null;
    const [body, signature, extra] = cookie.slice(16).split('.');
    if (!body || !signature || extra || body.length > 1000) return null;
    const expected = crypto.createHmac('sha256', cookieKey).update(body).digest('base64url');
    if (!equal(signature, expected)) return null;
    try { const value = JSON.parse(Buffer.from(body, 'base64url')); return typeof value.sub === 'string' && value.exp > Date.now() ? value : null; } catch { return null; }
  }
  function cookie(value, maxAge = 28800) { return `refcare_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.secureCookies ? '; Secure' : ''}`; }
  async function db(table, params = {}, method = 'GET', body, prefer = '') {
    assert(config.serviceKey, 503, '資料庫後端尚未設定完成');
    const query = params instanceof URLSearchParams ? params : new URLSearchParams(params);
    const url = `${config.supabaseUrl}/rest/v1/${table}${query.size ? '?' + query.toString() : ''}`;
    let response;
    try {
      response = await upstreamFetch(url, { method, headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, 'Content-Type': 'application/json', Accept: 'application/json', Prefer: prefer || 'return=representation' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    } catch { throw new AppError(503, '資料庫暫時無法連線，請稍後再試'); }
    const raw = await response.text();
    let data; try { data = raw ? JSON.parse(raw) : []; } catch { throw new AppError(502, '資料庫回應格式異常'); }
    if (!response.ok) {
      if (response.status === 409 || data.code === '23505') throw new AppError(409, '資料已存在，請重新整理後確認');
      if (table === 'rpc/refcare_submit_reply' && ['P0001', '42501'].includes(data.code)) throw new AppError(403, '此案件、機構或回覆連結目前不可使用，請重新整理');
      throw new AppError(502, '資料庫操作失敗，請聯絡管理員');
    }
    return { data, status: response.status, range: response.headers.get('content-range') };
  }
  async function one(table, params) { const { data } = await db(table, { ...params, limit: '1' }); return data[0] || null; }
  const notificationPaths = new Set(['case_individual', 'case_cooperate', 'case_all_areas', 'case_difficult', 'case_reminder', 'case_closed', 'case_updated', 'platform-feedback']);
  async function notify(destination, payload) {
    assert(config.notificationsEnabled, 503, '資料已儲存，LINE 通知尚未啟用，請改以人工聯繫');
    let response;
    try { response = await upstreamFetch(destination, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) }); }
    catch { throw new AppError(502, '資料已儲存，但 LINE 通知傳送失敗，請改以人工聯繫'); }
    assert(response.ok, 502, '資料已儲存，但 LINE 通知傳送失敗，請改以人工聯繫');
  }
  async function staff(req) {
    const session = readSession(req); if (!session) return null;
    const row = await one('case_managers', { id: `eq.${session.sub}`, select: '*' });
    if (!row || row.approved !== true || !equal(session.version, crypto.createHash('sha256').update(row.password || '').digest('hex'))) return null;
    return row;
  }
  async function grant(req) {
    const caseId = req.headers['x-refcare-case-id']; const token = req.headers['x-refcare-reply-token'];
    if (typeof caseId !== 'string' || typeof token !== 'string') return null;
    assert(caseId.length < 100 && token.length < 100, 403, '回覆連結無效');
    const row = await one('cases', { case_id: `eq.${caseId}`, select: '*' });
    if (!row || !ACTIVE.has(row.status) || !row.reply_access_token || !equal(token, row.reply_access_token)) return null;
    return row;
  }
  function json(res, status, value, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(value)); }
  async function body(req) {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; assert(size <= 256000, 413, '送出資料過大'); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new AppError(400, '資料格式錯誤'); }
  }
  function writes() { assert(config.writeEnabled, 503, '平台切換準備中，暫停新增與修改資料'); }
  function validateFields(item, allowed) { assert(item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).every(k => allowed.has(k)), 400, '包含不允許修改的欄位'); }
  function replyLink(row) { return `${config.origin}/facility.html?case_id=${encodeURIComponent(row.case_id)}&token=${encodeURIComponent(row.reply_access_token)}`; }
  async function api(req, res, url) {
    if (!['GET', 'HEAD'].includes(req.method)) assert(req.headers.origin === config.origin, 403, '請從正式網站操作');
    if (url.pathname === '/api/version' && req.method === 'GET') return json(res, 200, { version: versionProvider() });
    if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ready: !!config.serviceKey, database: new URL(config.supabaseUrl).hostname, write_enabled: config.writeEnabled, notifications_enabled: config.notificationsEnabled });
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const input = await body(req); const empId = String(input.emp_id || '').trim(); const password = String(input.password || '');
      assert(empId.length > 0 && empId.length < 100 && password.length > 0 && password.length < 500, 400, '請輸入員編與密碼');
      limited(`login:${empId}`, 12); limited(`login-ip:${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`, 40);
      const row = await one('case_managers', { emp_id: `eq.${empId}`, select: '*' });
      assert(row && await passwordMatches(password, row.password), 401, '員編或密碼錯誤');
      assert(row.approved === true, 403, '您的帳號尚未被管理員啟用');
      const value = sign({ sub: row.id, version: crypto.createHash('sha256').update(row.password).digest('hex'), exp: Date.now() + 28800000 });
      return json(res, 200, { data: clean(row), error: null }, { 'Set-Cookie': cookie(value) });
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') return json(res, 200, { data: null, error: null }, { 'Set-Cookie': cookie('', 0) });
    if (url.pathname === '/api/session' && req.method === 'GET') {
      const user = await staff(req); assert(user, 401, '請重新登入'); return json(res, 200, { data: clean(user), error: null });
    }
    if (url.pathname === '/api/register' && req.method === 'POST') {
      writes(); limited(`register:${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`, 5);
      const input = await body(req);
      validateFields(input, new Set(['emp_id', 'password', 'name', 'email', 'phone', 'hospital', 'ext']));
      assert(['emp_id', 'password', 'name', 'phone', 'hospital'].every(k => typeof input[k] === 'string' && input[k].trim() && input[k].length <= 500), 400, '請填寫員編、密碼、姓名、電話與醫院');
      assert(!(await one('case_managers', { emp_id: `eq.${input.emp_id}`, select: 'id' })), 409, '此員編已被註冊');
      await db('case_managers', {}, 'POST', { ...input, password: await hashPassword(input.password), role: '個案管理師', approved: false });
      return json(res, 200, { data: null, error: null });
    }
    if (url.pathname === '/api/reply-link' && req.method === 'GET') {
      assert(await staff(req), 401, '請先登入');
      const caseId = url.searchParams.get('case_id') || ''; assert(caseId.length < 100, 400, '案件編號無效');
      const row = await one('cases', { case_id: `eq.${caseId}`, select: '*' });
      assert(row && ACTIVE.has(row.status) && row.reply_access_token, 409, '案件已停止收回覆');
      return json(res, 200, { data: replyLink(row), error: null });
    }
    if (url.pathname === '/api/notify' && req.method === 'POST') {
      writes(); const user = req.headers['x-refcare-case-id'] ? null : await staff(req); const access = user ? null : await grant(req);
      assert(user || access, 401, '請先登入或使用有效的案件連結');
      const input = await body(req); let destination;
      try { destination = new URL(input.destination); } catch { throw new AppError(400, '通知網址無效'); }
      const event = destination.pathname.replace('/webhook/', '');
      assert(destination.protocol === 'https:' && ['n8nwfh.zeabur.app', 'chihwei.zeabur.app'].includes(destination.hostname) && !destination.username && !destination.password && !destination.port && !destination.search && notificationPaths.has(event), 400, '不允許此通知網址');
      assert(user || event === 'platform-feedback', 403, '機構不能派發案件');
      if (event === 'platform-feedback') { await notify(destination.origin + destination.pathname, input.payload); return json(res, 200, { sent: true }); }
      const caseId = input.payload?.case_id; assert(typeof caseId === 'string' && caseId.length < 100, 400, '案件編號無效');
      const row = await one('cases', { case_id: `eq.${caseId}`, select: '*' }); assert(row, 404, '案件不存在');
      const outgoing = { ...clean(row), notify_type: input.payload.notify_type || 'new', reply_url: replyLink(row) };
      if (event === 'case_reminder') {
        const facilities = (await db('facilities', { select: 'id,line_group_id' })).data;
        const targetIds = new Set((row.target_facility_ids || []).map(String));
        const permittedGroups = new Set(facilities.filter(f => targetIds.has(String(f.id))).map(f => f.line_group_id));
        outgoing.line_group_ids = (input.payload.line_group_ids || []).filter(x => permittedGroups.has(x));
        assert(outgoing.line_group_ids.length > 0, 400, '沒有可通知的指定機構');
      }
      await notify(destination.origin + destination.pathname, outgoing); return json(res, 200, { sent: true });
    }
    const match = /^\/api\/supabase\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
    assert(match && TABLES.has(match[1]), 404, '找不到此功能');
    const table = match[1]; const params = new URLSearchParams(url.searchParams);
    assert(['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method), 405, '不支援此操作');
    assert(![...params.keys()].some(k => ['or', 'and', 'not'].includes(k)), 400, '不支援此查詢');
    const insertColumns = params.getAll('columns');
    assert(!insertColumns.length || (req.method === 'POST' && insertColumns.length === 1), 400, '不支援此查詢');
    const projection = params.get('select') || '*';
    assert(/^(\*|[a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*)$/.test(projection), 400, '不支援關聯查詢');
    assert(!projection.split(',').some(k => HIDDEN.has(k)), 403, '此欄位不可讀取');
    const user = req.headers['x-refcare-case-id'] ? null : await staff(req); const isAdmin = user?.role === '系統管理員'; const access = user ? null : await grant(req);
    assert(user || access, 401, '請先登入或使用有效的案件回覆連結');
    let input; if (req.method !== 'GET') { writes(); input = await body(req); }
    if (insertColumns.length) {
      // Supabase SDK array inserts include quoted columns. They must match the full body.
      assert(insertColumns[0].length <= 8192 && /^"[a-z_][a-z0-9_]*"(,"[a-z_][a-z0-9_]*")*$/.test(insertColumns[0]), 400, '新增欄位清單無效');
      const rows = Array.isArray(input) ? input : [input];
      assert(rows.length > 0 && rows.every(x => x && typeof x === 'object' && !Array.isArray(x)), 400, '資料格式錯誤');
      const fields = new Set(insertColumns[0].split(',').map(x => x.slice(1, -1)));
      const submitted = new Set(rows.flatMap(x => Object.keys(x)));
      assert(fields.size === submitted.size && [...submitted].every(k => fields.has(k)), 400, '新增欄位清單與資料不一致');
      params.delete('columns');
    }
    let result;
    if (!user) {
      assert((!ADMIN_TABLES.has(table) || (table === 'case_managers' && req.method === 'GET') || (table === 'platform_feedbacks' && req.method === 'POST')) && table !== 'facility_groups', 403, '權限不足');
      if (table === 'cases' || table === 'replies') {
        const asked = params.get('case_id'); assert(!asked || asked === `eq.${access.case_id}`, 403, '只能存取此連結的案件');
        params.set('case_id', `eq.${access.case_id}`);
      }
      if (req.method === 'GET') {
        assert(['cases', 'replies', 'facilities', 'case_managers'].includes(table), 403, '權限不足');
        if (table === 'cases') params.set('select', '*');
        if (table === 'replies') params.set('select', 'facility_id,facility_name,reply_status');
        if (table === 'facilities') {
          const ids = (access.target_facility_ids || []).filter(x => /^[a-f0-9-]{36}$/i.test(String(x)));
          if (!ids.length) return json(res, 200, []);
          params.set('id', `in.(${ids.join(',')})`); params.set('select', 'id,facility_name,short_name,phone,service_area');
        }
        // Existing pages can use the phone/ext already present on the granted case.
        if (table === 'case_managers') return json(res, 200, [{ phone: access.case_manager_phone || '', ext: access.case_manager_ext || access.hospital_ext || '' }]);
        result = await db(table, params);
        result.data = clean(result.data, ['patient_id', 'address_detail', 'matched_note', 'cancel_service_reason', 'cancel_service_note']);
      } else if (table === 'replies' && req.method === 'POST') {
        assert(Array.isArray(input) && input.length === 1, 400, '一次只能送出一筆回覆');
        const item = input[0]; validateFields(item, new Set(['case_id', 'facility_id', 'facility_name', 'reply_status', 'note', 'round', 'reporter']));
        assert(item.case_id === access.case_id && ['accept', 'reject', 'coordinate'].includes(item.reply_status), 403, '回覆資料無效');
        assert(typeof item.note === 'string' && item.note.length <= 5000, 400, '回覆備註過長');
        const saved = await db('rpc/refcare_submit_reply', {}, 'POST', { p_case_id: access.case_id, p_token: req.headers['x-refcare-reply-token'], p_facility_id: String(item.facility_id || ''), p_status: item.reply_status, p_note: item.note, p_reporter: String(item.reporter || '').slice(0, 100) });
        let sent = false;
        try {
          const facility = await one('facilities', { id: `eq.${item.facility_id}`, select: 'facility_name' });
          await notify('https://n8nwfh.zeabur.app/webhook/facility_reply', { case_id: access.case_id, facility_id: item.facility_id, facility_name: facility?.facility_name || '', reply: item.reply_status, reply_note: item.note, reporter: item.reporter || '', reply_time: new Date().toISOString() });
          sent = true;
        } catch { /* A saved reply must never be reported as unsaved merely because LINE failed. */ }
        if (saved.data.advance) {
          try {
            const updated = await one('cases', { case_id: `eq.${access.case_id}`, select: '*' });
            await notify('https://n8nwfh.zeabur.app/webhook/case_difficult', { ...clean(updated), reply_url: replyLink(updated) });
          } catch { sent = false; }
        }
        return json(res, 201, [{ saved: true, notification_sent: sent }]);
      } else if (table === 'platform_feedbacks' && req.method === 'POST') {
        // Feedback is available for a granted facility, with no read permission.
        result = await saveFeedback(input);
      } else throw new AppError(403, '機構連結不能修改案件或管理資料');
    } else {
      assert(!ADMIN_TABLES.has(table) || isAdmin || (table === 'platform_feedbacks' && req.method === 'POST'), 403, '此功能需要系統管理員權限');
      if (req.method !== 'GET') {
        assert(isAdmin || ['cases', 'replies', 'platform_feedbacks'].includes(table), 403, '此功能需要系統管理員權限');
        assert(req.method !== 'DELETE' || isAdmin, 403, '此功能需要系統管理員權限');
        if (req.method === 'PATCH' || req.method === 'DELETE') assert([...params.keys()].some(k => ['id', 'case_id'].includes(k)), 400, '修改或刪除必須指定資料');
        const rows = Array.isArray(input) ? input : [input];
        assert(rows.length <= 100 && rows.every(x => x && typeof x === 'object' && !Array.isArray(x)), 400, '資料格式錯誤');
        assert(rows.every(x => !Object.keys(x).some(k => ['reply_access_token', 'legacy_reply_link_enabled'].includes(k))), 403, '回覆權限欄位由後端管理');
        if (table === 'cases' && req.method === 'POST') input = rows.map(x => ({ ...x, hospital: user.hospital, case_manager: user.name, case_manager_phone: user.phone, case_manager_ext: user.ext }));
        if (table === 'case_managers' && ['POST', 'PATCH'].includes(req.method)) {
          for (const row of rows) {
            if ('password' in row) { if (row.password) { assert(typeof row.password === 'string' && row.password.length <= 500, 400, '密碼格式錯誤'); row.password = await hashPassword(row.password); } else if (req.method === 'PATCH') delete row.password; else throw new AppError(400, '請輸入密碼'); }
          }
        }
      }
      // Rebuild after server profile injection so the SDK cannot omit trusted fields.
      if (insertColumns.length) params.set('columns', [...new Set((Array.isArray(input) ? input : [input]).flatMap(x => Object.keys(x)))].map(k => `"${k}"`).join(','));
      result = table === 'platform_feedbacks' && req.method === 'POST' ? await saveFeedback(input) : await db(table, params, req.method, input, req.headers.prefer);
      result.data = clean(result.data);
    }
    const wantsSingle = (req.headers.accept || '').includes('application/vnd.pgrst.object');
    if (wantsSingle && Array.isArray(result.data)) {
      if (result.data.length !== 1) return json(res, 406, { code: 'PGRST116', message: '找不到唯一資料' });
      result.data = result.data[0];
    }
    const headers = result.range ? { 'Content-Range': result.range } : {};
    json(res, result.status === 204 ? 200 : result.status, result.data, headers);
  }
  async function saveFeedback(input) {
    const rows = Array.isArray(input) ? input : [input]; assert(rows.length === 1, 400, '一次只能送出一筆回報');
    validateFields(rows[0], new Set(['name', 'facility_name', 'phone', 'issue']));
    assert(['name', 'facility_name', 'phone', 'issue'].every(k => typeof rows[0][k] === 'string' && rows[0][k].length <= 5000), 400, '回報格式錯誤');
    return db('platform_feedbacks', {}, 'POST', rows);
  }
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY');
    try {
      const url = new URL(req.url, config.origin);
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      assert(['GET', 'HEAD'].includes(req.method), 405, '不支援此操作');
      if (url.pathname === '/facility.html') {
        limited(`link:${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`, 120);
        const caseId = url.searchParams.get('case_id') || ''; const token = url.searchParams.get('token') || '';
        const row = caseId && caseId.length < 100 ? await one('cases', { case_id: `eq.${caseId}`, select: '*' }) : null;
        if (!row || !ACTIVE.has(row.status) || !row.reply_access_token || (token && !equal(token, row.reply_access_token)) || (!token && row.legacy_reply_link_enabled !== true)) {
          res.writeHead(410, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(CLOSED_HTML);
        }
        if (!token) { res.writeHead(302, { Location: replyLink(row) }); return res.end(); }
      }
      // Serve only Vite output; never expose .env, SQL, workflow exports or source files.
      let decoded; try { decoded = decodeURIComponent(url.pathname); } catch { throw new AppError(400, '網址格式錯誤'); }
      assert(!decoded.includes('\\') && !decoded.split('/').some(x => x === '..' || x.startsWith('.')), 404, '找不到頁面');
      const relative = decoded === '/' ? 'index.html' : decoded.slice(1);
      assert(/^(index|admin|mobile|facility|dashboard)\.html$/.test(relative) || relative === 'supabase-config.js' || /^assets\/[a-zA-Z0-9_.-]+\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/.test(relative), 404, '找不到頁面');
      const file = path.join(config.staticDir, relative); const content = await fs.readFile(file);
      const ext = path.extname(file); const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime }); res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
      if (!res.headersSent) json(res, status, { data: null, error: { message: error.status ? error.message : '系統暫時無法使用' }, message: error.status ? error.message : '系統暫時無法使用' }); else res.end();
    }
  });
}

if (require.main === module) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (key) { try { if (JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role !== 'service_role') throw new Error(); } catch { throw new Error('SUPABASE_SERVICE_ROLE_KEY must be a service_role key'); } }
  createApp().listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('RefCare backend ready'));
}
module.exports = { createApp, passwordMatches, hashPassword };
