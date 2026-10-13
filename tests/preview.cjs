// Local browser QA only: synthetic data, no network access to Supabase or LINE.
const { createApp } = require('../server.cjs');
const sample = {
  case_managers: [{ id: 'preview-admin', emp_id: 'preview', password: 'preview-only', approved: true, role: '系統管理員', name: '測試使用者', hospital: '測試醫院', phone: '0000000000', ext: '00' }],
  cases: [{ id: 'preview-case', case_id: 'REFCARE-TEST-PREVIEW', patient_name: '測試案例（非真實資料）', hospital: '測試醫院', age: 80, gender: '女', diagnosis: '瀏覽器功能測試', status: '一輪媒合中', created_at: '2026-10-14T00:00:00+08:00', target_facility_ids: ['22222222-2222-4222-8222-222222222222'], case_manager: '測試使用者', case_manager_phone: '0000000000', total_targets: 1, service_type: '居家服務', service_codes: [], reply_access_token: '11111111-1111-4111-8111-111111111111', legacy_reply_link_enabled: true }],
  facilities: [{ id: '22222222-2222-4222-8222-222222222222', facility_name: '測試機構', short_name: '測試', phone: '0000000000', service_area: '測試地區', is_round_1: true }],
  replies: [], facility_groups: [], platform_feedbacks: [],
};
createApp({ config: { serviceKey: 'preview-only-nonsecret', origin: 'http://localhost:3100', writeEnabled: false, notificationsEnabled: false, secureCookies: false }, fetchImpl: async rawUrl => {
  const url = new URL(rawUrl); const table = url.pathname.split('/rest/v1/')[1];
  let rows = (sample[table] || []).filter(row => [...url.searchParams].every(([key, value]) => value.startsWith('eq.') ? String(row[key]) === value.slice(3) : value.startsWith('in.(') ? value.slice(4, -1).split(',').includes(String(row[key])) : true));
  const projection = url.searchParams.get('select');
  if (projection && projection !== '*') rows = rows.map(row => Object.fromEntries(projection.split(',').filter(k => k in row).map(k => [k, row[k]])));
  return new Response(JSON.stringify(rows), { status: 200 });
} }).listen(3100, '127.0.0.1', () => console.log('Synthetic RefCare browser QA at http://localhost:3100'));
