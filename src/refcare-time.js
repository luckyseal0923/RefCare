import { taiwanInput, taiwanISO, editedTimestamp, serverClock } from './time-core.mjs';

const clock = serverClock(() => performance.now());
window.refcareTime = { taiwanInput, taiwanISO, editedTimestamp, now: () => clock.now() };
const input = document.getElementById('referralTime');
if (input) {
  const status = document.getElementById('referralTimeStatus');
  let inFlight;
  function render() {
    const now = clock.now();
    if (now) input.value = taiwanInput(now);
  }
  function refresh() {
    if (inFlight) return inFlight;
    const started = performance.now();
    inFlight = (async () => {
      try {
        const response = await fetch('/api/time', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('Time unavailable');
        clock.sync((await response.json()).server_time, performance.now() - started);
        render();
        status.textContent = '顯示臺灣系統時間；正式起案時間以案件儲存成功為準。';
      } catch {
        status.textContent = clock.now() ? '暫時無法校時；正式起案時間以案件儲存成功為準。' : '暫時無法取得系統時間；正式起案時間仍會在儲存案件時記錄。';
      } finally { inFlight = undefined; }
    })();
    return inFlight;
  }
  input.placeholder = '正在取得系統時間';
  status.textContent = '正在取得系統時間…';
  setInterval(() => { if (document.visibilityState === 'visible') render(); }, 1000);
  setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 300000);
  window.addEventListener('focus', () => { void refresh(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh(); });
  void refresh();
}
