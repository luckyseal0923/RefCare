const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function taiwanInput(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(formatter.formatToParts(date).map(x => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function taiwanISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('時間格式不正確');
  const date = new Date(value + ':00+08:00');
  if (!Number.isFinite(date.getTime()) || taiwanInput(date) !== value) throw new Error('時間格式不正確');
  return date.toISOString();
}

// Undefined means leave the saved timestamp untouched, including its seconds.
export function editedTimestamp(value, original) {
  if ((value || '') === taiwanInput(original)) return undefined;
  return value ? taiwanISO(value) : null;
}

export function serverClock(monotonicNow) {
  let anchor = null;
  return {
    sync(value, roundTripMs = 0) {
      if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('系統時間回應不正確');
      const millis = new Date(value).getTime();
      if (!Number.isFinite(millis)) throw new Error('系統時間回應不正確');
      anchor = { millis: millis + Math.max(0, roundTripMs) / 2, at: monotonicNow() };
    },
    now() { return anchor ? new Date(anchor.millis + Math.max(0, monotonicNow() - anchor.at)) : null; },
  };
}
