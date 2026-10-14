/* Database access goes through the same-origin server. No database keys are shipped. */
(() => {
  const browserFetch = window.fetch.bind(window);
  window.refcareRequests = { pendingWrites: 0 };
  async function rawFetch(input, init = {}) {
    const method = String(init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    const writing = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const signal = () => window.dispatchEvent(new Event('refcare:requests'));
    if (writing) { window.refcareRequests.pendingWrites++; signal(); }
    try { return await browserFetch(input, init); }
    finally { if (writing) { window.refcareRequests.pendingWrites--; signal(); } }
  }
  const params = new URLSearchParams(window.location.search);
  const grantHeaders = {};
  if (params.get('case_id') && params.get('token')) {
    grantHeaders['X-RefCare-Case-Id'] = params.get('case_id');
    grantHeaders['X-RefCare-Reply-Token'] = params.get('token');
  }
  async function api(url, body) {
    try {
      const response = await rawFetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...grantHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json();
      return response.ok ? result : { data: null, error: result.error || { message: result.message || '操作失敗' } };
    } catch { return { data: null, error: { message: '連線失敗，請稍後再試' } }; }
  }
  function saveUser(data) {
    if (data) {
      sessionStorage.setItem('admin_token', data.emp_id);
      sessionStorage.setItem('admin_role', data.role || '個案管理師');
      sessionStorage.setItem('admin_name', data.name || '');
    } else ['admin_token', 'admin_role', 'admin_name', 'isAdminAuthorized'].forEach(k => sessionStorage.removeItem(k));
  }
  window.refcareAuth = {
    async login(emp_id, password) { const result = await api('/api/login', { emp_id, password }); if (result.data) saveUser(result.data); return result; },
    async session() { const result = await api('/api/session'); saveUser(result.data); return result; },
    async logout() { await api('/api/logout', {}); saveUser(null); },
    register: values => api('/api/register', values),
    async replyLink(caseId) { const result = await api('/api/reply-link?case_id=' + encodeURIComponent(caseId)); if (result.error) throw new Error(result.error.message); return result.data; },
  };
  window.refcareReady = window.refcareAuth.session();
  window.supabaseClient = window.supabase.createClient(window.location.origin + '/api/supabase', 'refcare-server-session', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init = {}) => rawFetch(input, { ...init, credentials: 'same-origin', headers: { ...Object.fromEntries(new Headers(init.headers)), ...grantHeaders } }) },
  });
  // The protected backend provides fresh data through HTTP, without exposing Realtime credentials.
  window.supabaseClient.channel = () => {
    const callbacks = new Set();
    const channel = {
      on(_event, _filter, callback) { callbacks.add(callback); return channel; },
      subscribe() { const timer = setInterval(() => { if (document.visibilityState === 'visible') callbacks.forEach(fn => fn()); }, 15000); channel.unsubscribe = () => clearInterval(timer); return channel; },
    };
    return channel;
  };
  // Existing notification calls retain their destination and payload; the backend supplies reply_url.
  window.fetch = (input, init = {}) => {
    let url; try { url = new URL(typeof input === 'string' ? input : input.url, window.location.origin); } catch { return rawFetch(input, init); }
    if (['n8nwfh.zeabur.app', 'chihwei.zeabur.app'].includes(url.hostname) && url.pathname.startsWith('/webhook/') && init.method === 'POST') {
      return rawFetch('/api/notify', { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...grantHeaders }, body: JSON.stringify({ destination: url.origin + url.pathname, payload: JSON.parse(init.body || '{}') }) });
    }
    return rawFetch(input, init);
  };
})();
