import { createUpdater, compareVersions } from './update-core.mjs';
import './site-update.css';

const mounts = [...document.querySelectorAll('[data-refcare-update]')];
const currentVersion = document.querySelector('meta[name="refcare-version"]')?.content;
if (mounts.length && currentVersion) {
  let draftChanged = false;
  const scope = document.body.dataset.refcareDraftScope || 'body';
  function changed(event) {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('[data-refcare-update-ignore]')) return;
    if (target.matches('input:not([readonly]):not([disabled]):not([type="hidden"]), textarea:not([readonly]):not([disabled]), select:not([disabled])') && target.closest(scope)) draftChanged = true;
  }
  document.addEventListener('input', changed);
  document.addEventListener('change', changed);
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-refcare-draft-action]')) draftChanged = true;
  });
  const widgets = mounts.map(mount => {
    const compact = mount.dataset.refcareUpdate === 'compact';
    const label = document.createElement('span'); label.className = 'refcare-version-label'; label.textContent = compact ? '網站版本' : '目前版本';
    const value = document.createElement('strong'); value.textContent = currentVersion;
    const versionRow = document.createElement('div'); versionRow.className = 'refcare-version-row'; versionRow.append(label, value);
    const status = document.createElement('p'); status.className = 'refcare-update-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const button = document.createElement('button'); button.type = 'button'; button.className = 'refcare-update-button'; button.textContent = '↻ 更新網站';
    mount.classList.add('refcare-update-widget'); mount.append(versionRow, status, button);
    return { mount, status, button };
  });
  const pendingWrites = () => window.refcareRequests?.pendingWrites || 0;
  const updater = createUpdater({
    currentVersion,
    fetchLatest: async () => {
      const response = await fetch('/api/version', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Version check unavailable');
      return (await response.json()).version;
    },
    onChange: state => {
      const newer = !state.failed && state.latestVersion && compareVersions(state.latestVersion, currentVersion) > 0;
      const older = !state.failed && state.latestVersion && compareVersions(state.latestVersion, currentVersion) < 0;
      const busy = pendingWrites() > 0;
      for (const { mount, status, button } of widgets) {
        mount.classList.toggle('refcare-has-update', !!newer);
        status.textContent = busy ? '操作處理中，完成後可更新' : state.failed ? '暫時無法檢查版本，請稍後再試' : newer ? `有新版本可更新：${state.latestVersion}` : older ? '網站版本切換中，請稍後再試' : state.checking ? '正在檢查版本…' : '目前已是最新版本';
        button.disabled = busy || state.updating || !!older;
        button.setAttribute('aria-busy', String(state.updating));
        button.textContent = state.updating ? '更新中…' : '↻ 更新網站';
      }
    },
    pendingWrites,
    dirty: () => draftChanged,
    confirm: message => window.confirm(message),
    navigate: url => window.location.replace(url),
    href: () => window.location.href,
    nonce: () => Date.now().toString(36),
  });
  for (const { button } of widgets) button.addEventListener('click', () => { void updater.update(); });
  window.addEventListener('refcare:requests', () => updater.render());
  window.addEventListener('focus', () => { void updater.check(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void updater.check(); });
  setInterval(() => { if (document.visibilityState === 'visible') void updater.check(); }, 180000);
  void updater.check();
}
