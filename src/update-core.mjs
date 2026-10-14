export function validVersion(value) {
  return typeof value === 'string' && /^\d{4}\.\d{2}\.\d{2}-\d{2,}$/.test(value);
}
export function compareVersions(a, b) {
  const left = a.split(/[.-]/).map(Number), right = b.split(/[.-]/).map(Number);
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}
export function refreshUrl(href, version, nonce) {
  const url = new URL(href);
  url.searchParams.set('_refcare_reload', `${version}-${nonce}`);
  return url.toString();
}
export function createUpdater({ currentVersion, fetchLatest, onChange, pendingWrites, dirty, confirm, navigate, href, nonce }) {
  if (!validVersion(currentVersion)) throw new Error('Missing built website version');
  const state = { currentVersion, latestVersion: null, checking: false, failed: false, updating: false };
  let inFlight;
  function publish() { onChange({ ...state }); }
  function check() {
    if (inFlight) return inFlight;
    state.checking = true; publish();
    inFlight = (async () => {
      try {
        const value = await fetchLatest();
        if (!validVersion(value)) throw new Error('Invalid server version');
        state.latestVersion = value; state.failed = false;
      } catch { state.failed = true; }
      finally { state.checking = false; inFlight = null; publish(); }
      return { ...state };
    })();
    return inFlight;
  }
  async function update() {
    if (state.updating || pendingWrites() > 0) return 'busy';
    state.updating = true; publish();
    await check();
    // A save may start while the version request is in flight.
    if (pendingWrites() > 0) { state.updating = false; publish(); return 'busy'; }
    if (!state.failed && state.latestVersion && compareVersions(state.latestVersion, currentVersion) < 0) {
      state.updating = false; publish(); return 'switching';
    }
    if (dirty() && !confirm('更新網站會重新載入頁面，未儲存或未送出的內容可能會清空。要繼續更新嗎？')) {
      state.updating = false; publish(); return 'cancelled';
    }
    const version = !state.failed && state.latestVersion && compareVersions(state.latestVersion, currentVersion) >= 0 ? state.latestVersion : currentVersion;
    navigate(refreshUrl(href(), version, nonce()));
    return 'updated';
  }
  return { check, update, render: publish, state };
}
