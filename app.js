const tableBody = document.getElementById("tableBody");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const hospitalFilter = document.getElementById("hospitalFilter");
const sortFilter = document.getElementById("sortFilter");
const btnReload = document.getElementById("btnReload");
const btnReset = document.getElementById("btnReset");
const drawerOverlay = document.getElementById("drawerOverlay");
const detailDrawer = document.getElementById("detailDrawer");
const drawerPatientName = document.getElementById("drawerPatientName");
const drawerMeta = document.getElementById("drawerMeta");
const drawerContent = document.getElementById("drawerContent");
const drawerClose = document.getElementById("drawerClose");

let currentRenderedList = [];
let currentEditingIndex = null;

function replyText(reply) {
  return reply === "accept" ? "可收案" : "無法收案";
}

function badgeClass(status) {
  if (status === "一輪媒合中") return "pending";
  if (status === "二輪媒合中") return "matching";
  if (status === "三輪媒合中") return "done";
  return "closed";
}

function parseCreatedAt(value) {
  return new Date(String(value).replace(/\//g, "-").replace(" ", "T")).getTime();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getReplyProgress(item) {
  const total = item.total_targets || Math.max(item.replies.length, 1);
  const replied = item.replies.length;
  const acceptCount = item.replies.filter(r => r.reply === "accept").length;
  const percent = Math.max(0, Math.min(100, Math.round((replied / total) * 100)));
  return { total, replied, acceptCount, percent };
}

function createProgressHtml(item) {
  const progress = getReplyProgress(item);
  const badge = badgeClass(item.status);

  return [
    '<div class="progress-wrap">',
    '  <div class="progress-top">',
    `    <span>${progress.replied} / ${progress.total} 已回覆</span>`,
    `    <span>${progress.percent}%</span>`,
    '  </div>',
    '  <div class="progress-bar">',
    `    <div class="progress-fill ${badge}" style="width:${progress.percent}%;"></div>`,
    '  </div>',
    `  <div class="progress-note">可收案 ${progress.acceptCount} 間</div>`,
    '</div>'
  ].join("");
}

function createDrawerContent(item) {
  const replyHtml = item.replies.length
    ? item.replies.map(r => [
        '<div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #e5e7eb;">',
        `  <strong>${escapeHtml(r.facility_name)}</strong>｜${escapeHtml(replyText(r.reply))}｜${escapeHtml(r.time)}`,
        '  <br>',
        `  ${escapeHtml(r.note || "無補充說明")}`,
        '</div>'
      ].join(""))
    : ['<div>目前尚無機構回覆。</div>'];

  const serviceCodesHtml = (item.service_codes || []).length
    ? item.service_codes.map(code => `• ${escapeHtml(code)}`).join("<br>")
    : "尚未填寫";

  const roundStatus = item.round_status || {};
  const roundFacilities = item.round_facilities || {};
  const roundConfig = [
    { key: "round1", label: "一輪媒合" },
    { key: "round2", label: "二輪媒合" },
    { key: "round3", label: "三輪媒合" }
  ];

  const summaryChips = roundConfig.map(round => {
    const data = roundStatus[round.key] || { sent: 0, replied: 0, accepted: 0, rejected: 0, pending: 0 };
    return `<span class="round-summary-chip">${round.label}｜${escapeHtml(data.sent)}家 / 已回覆 ${escapeHtml(data.replied)} / 可收案 ${escapeHtml(data.accepted)}</span>`;
  }).join("");

  const roundTabs = roundConfig.map((round, idx) => {
    return `<button type="button" class="round-tab ${idx === 0 ? "active" : ""}" data-round-key="${round.key}">${round.label}</button>`;
  }).join("");

  const tablesHtml = roundConfig.map((round, idx) => {
    const list = roundFacilities[round.key] || [];
    const data = roundStatus[round.key] || { sent: 0, replied: 0, accepted: 0, rejected: 0, pending: 0 };

    const rows = list.length
      ? list.map(entry => {
          const statusLabel = entry.status === "accept" ? "可收案" : entry.status === "reject" ? "婉拒" : "未回覆";
          return [
            "<tr>",
            `  <td>${escapeHtml(entry.name)}</td>`,
            `  <td><span class="reply-status-tag ${escapeHtml(entry.status)}">${escapeHtml(statusLabel)}</span></td>`,
            `  <td>${escapeHtml(entry.time || "-")}</td>`,
            `  <td>${escapeHtml(entry.note || "-")}</td>`,
            "</tr>"
          ].join("");
        }).join("")
      : `<tr><td colspan="4">本輪目前沒有虛擬回覆名單</td></tr>`;

    return [
      `<div class="round-panel" data-round-panel="${round.key}" style="display:${idx === 0 ? "block" : "none"};">`,
      '  <div class="round-summary-bar">',
      `    <span class="round-summary-chip">已發送 ${escapeHtml(data.sent)} 家</span>`,
      `    <span class="round-summary-chip">已回覆 ${escapeHtml(data.replied)} 家</span>`,
      `    <span class="round-summary-chip">可收案 ${escapeHtml(data.accepted)} 家</span>`,
      `    <span class="round-summary-chip">婉拒 ${escapeHtml(data.rejected)} 家</span>`,
      `    <span class="round-summary-chip">未回覆 ${escapeHtml(data.pending)} 家</span>`,
      "  </div>",
      '  <div class="facility-table-wrap">',
      '    <table class="facility-table">',
      '      <thead><tr><th>機構名稱</th><th>回覆狀態</th><th>回覆時間</th><th>備註</th></tr></thead>',
      "      <tbody>",
      rows,
      "      </tbody>",
      "    </table>",
      "  </div>",
      "</div>"
    ].join("");
  }).join("");

  return [
    '<div class="detail-card">',
    "  <h4>基本資料</h4>",
    `  <div><strong>案件標號：</strong>${escapeHtml(item.case_id)}</div>`,
    `  <div><strong>起單時間：</strong>${escapeHtml(item.created_at)}</div>`,
    `  <div><strong>轉介單位：</strong>${escapeHtml(item.hospital)}</div>`,
    `  <div><strong>個管人員：</strong>${escapeHtml(item.case_manager || "未設定")}</div>`,
    `  <div><strong>病患姓名：</strong>${escapeHtml(item.patient_name)}</div>`,
    `  <div><strong>年齡 / 性別：</strong>${escapeHtml(item.age)}歲 / ${escapeHtml(item.gender)}</div>`,
    `  <div><strong>聯絡人：</strong>${escapeHtml(item.contact_name || "未填寫")}</div>`,
    `  <div><strong>聯絡電話：</strong>${escapeHtml(item.contact_phone || "未填寫")}</div>`,
    `  <div><strong>地址：</strong>${escapeHtml(item.address || "未填寫")}</div>`,
    "</div>",

    '<div class="detail-card">',
    "  <h4>功能評估</h4>",
    `  <div><strong>主要診斷：</strong>${escapeHtml(item.diagnosis)}</div>`,
    `  <div><strong>案況簡述：</strong>${escapeHtml(item.case_summary)}</div>`,
    `  <div><strong>CMS：</strong>${escapeHtml(item.cms_level || "未填寫")}</div>`,
    `  <div><strong>ADL：</strong>${escapeHtml(item.adl)}</div>`,
    `  <div><strong>行動能力：</strong>${escapeHtml(item.mobility)}</div>`,
    `  <div><strong>意識狀態：</strong>${escapeHtml(item.consciousness || "未填寫")}</div>`,
    `  <div><strong>氧氣需求：</strong>${escapeHtml(item.oxygen)}</div>`,
    `  <div><strong>特殊需求：</strong>${escapeHtml(item.special_need || "未填寫")}</div>`,
    "</div>",

    '<div class="detail-card full">',
    "  <h4>服務需求</h4>",
    `  <div><strong>服務類型：</strong>${escapeHtml(item.service_type || "未填寫")}</div>`,
    `  <div><strong>服務時段：</strong>${escapeHtml(item.service_time || "未填寫")}</div>`,
    `  <div><strong>服務碼別：</strong><br>${serviceCodesHtml}</div>`,
    "</div>",

    '<div class="detail-card full">',
    "  <h4>各輪機構回覆狀況</h4>",
    `  <div class="round-summary-bar">${summaryChips}</div>`,
    `  <div class="round-tabs">${roundTabs}</div>`,
    `  <div>${tablesHtml}</div>`,
    "</div>",

    '<div class="detail-card full">',
    "  <h4>機構回覆紀錄</h4>",
    `  <div>${replyHtml.join("")}</div>`,
    "</div>"
  ].join("");
}

function createEditForm(item, index) {
  const statusOptions = ["一輪媒合中", "二輪媒合中", "三輪媒合中", "案件結案"];
  const statusHtml = statusOptions.map(status => `<option value="${escapeHtml(status)}" ${item.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("");
  const consciousnessOptions = ["清楚", "混亂", "木僵"];
  const consciousnessHtml = consciousnessOptions.map(c => `<option value="${escapeHtml(c)}" ${item.consciousness === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
  const mobilityOptions = ["可自行行走", "可使用輔具行走(手杖、助行器等)", "使用輔具並扶持下行走", "無法行走，但可站立", "無法行走及站立，需全移位", "長期臥床，均於床上照顧"];
  const mobilityHtml = mobilityOptions.map(m => `<option value="${escapeHtml(m)}" ${item.mobility === m ? "selected" : ""}>${escapeHtml(m)}</option>`).join("");

  return [
    '<div class="detail-card full">',
    "  <h4>編輯案件資料</h4>",
    `  <form class="edit-form" id="editCaseForm" data-index="${index}">`,
    '    <div class="edit-field"><label>案件標號</label>',
    `      <input name="case_id" value="${escapeHtml(item.case_id)}" /></div>`,
    '    <div class="edit-field"><label>起單時間</label>',
    `      <input name="created_at" value="${escapeHtml(item.created_at)}" /></div>`,
    '    <div class="edit-field"><label>病患姓名</label>',
    `      <input name="patient_name" value="${escapeHtml(item.patient_name)}" /></div>`,
    '    <div class="edit-field"><label>轉介單位</label>',
    `      <input name="hospital" value="${escapeHtml(item.hospital)}" /></div>`,
    '    <div class="edit-field"><label>年齡</label>',
    `      <input name="age" value="${escapeHtml(item.age)}" /></div>`,
    '    <div class="edit-field"><label>性別</label>',
    `      <input name="gender" value="${escapeHtml(item.gender)}" /></div>`,
    '    <div class="edit-field"><label>案件狀態</label>',
    `      <select name="status">${statusHtml}</select></div>`,
    '    <div class="edit-field"><label>個管人員</label>',
    `      <input name="case_manager" value="${escapeHtml(item.case_manager || "")}" /></div>`,
    '    <div class="edit-field full"><label>主要診斷</label>',
    `      <textarea name="diagnosis">${escapeHtml(item.diagnosis)}</textarea></div>`,
    '    <div class="edit-field full"><label>案況簡述</label>',
    `      <textarea name="case_summary">${escapeHtml(item.case_summary)}</textarea></div>`,
    '    <div class="edit-field"><label>CMS</label>',
    `      <input name="cms_level" value="${escapeHtml(item.cms_level || "")}" /></div>`,
    '    <div class="edit-field"><label>意識狀態</label>',
    `      <select name="consciousness">${consciousnessHtml}</select></div>`,
    '    <div class="edit-field"><label>行動能力</label>',
    `      <select name="mobility">${mobilityHtml}</select></div>`,
    '    <div class="edit-field"><label>氧氣需求</label>',
    `      <input name="oxygen" value="${escapeHtml(item.oxygen || "")}" /></div>`,
    '    <div class="edit-field"><label>聯絡人</label>',
    `      <input name="contact_name" value="${escapeHtml(item.contact_name || "")}" /></div>`,
    '    <div class="edit-field"><label>聯絡電話</label>',
    `      <input name="contact_phone" value="${escapeHtml(item.contact_phone || "")}" /></div>`,
    '    <div class="edit-field full"><label>地址</label>',
    `      <textarea name="address">${escapeHtml(item.address || "")}</textarea></div>`,
    '    <div class="edit-field"><label>服務類型</label>',
    `      <input name="service_type" value="${escapeHtml(item.service_type || "")}" /></div>`,
    '    <div class="edit-field"><label>服務時段</label>',
    `      <input name="service_time" value="${escapeHtml(item.service_time || "")}" /></div>`,
    '    <div class="edit-field full"><label>服務碼別（用逗號分隔）</label>',
    `      <textarea name="service_codes">${escapeHtml((item.service_codes || []).join("，"))}</textarea></div>`,
    '    <div class="edit-field full"><label>特殊需求</label>',
    `      <textarea name="special_need">${escapeHtml(item.special_need || "")}</textarea></div>`,
    "  </form>",
    '  <div class="drawer-actions">',
    '    <button class="btn btn-primary" type="button" id="saveEditBtn">儲存修改</button>',
    '    <button class="btn btn-secondary" type="button" id="cancelEditBtn">取消</button>',
    "  </div>",
    "</div>"
  ].join("");
}

function createTableRows(item, index) {
  return [
    "<tr>",
    "  <td>",
    `    <div class="created-at">${escapeHtml(item.created_at)}</div>`,
    `    <div class="case-id">${escapeHtml(item.case_id)}</div>`,
    "  </td>",
    "  <td>",
    `    <div class="patient-name">${escapeHtml(item.patient_name)}</div>`,
    `    <div class="sub-text">${escapeHtml(item.age)}歲 / ${escapeHtml(item.gender)}</div>`,
    "  </td>",
    `  <td><div>${escapeHtml(item.hospital)}</div></td>`,
    "  <td>",
    `    <div>${escapeHtml(item.diagnosis)}</div>`,
    `    <div class="sub-text">${escapeHtml(item.case_summary)}</div>`,
    "  </td>",
    `  <td><span class="badge ${badgeClass(item.status)}">${escapeHtml(item.status)}</span></td>`,
    `  <td>${createProgressHtml(item)}</td>`,
    "  <td>",
    '    <div class="action-row">',
    `      <button class="action-btn" type="button" data-index="${index}" data-action="detail">查看詳情</button>`,
    `      <button class="action-btn" type="button" data-index="${index}" data-action="edit">編輯</button>`,
    '      <button class="action-btn" type="button">結案</button>',
    "    </div>",
    "  </td>",
    "</tr>"
  ].join("");
}

function updateKPI(list) {
  document.getElementById("kpiTotal").textContent = String(list.length);
  document.getElementById("kpiPending").textContent = String(list.filter(i => i.status === "一輪媒合中").length);
  document.getElementById("kpiMatching").textContent = String(list.filter(i => i.status === "二輪媒合中" || i.status === "三輪媒合中").length);
  document.getElementById("kpiDone").textContent = String(list.filter(i => i.status === "案件結案").length);

  const hintEl = document.getElementById("loadedHint");
  if (hintEl) {
    hintEl.textContent = `目前載入 ${list.length} 筆虛擬案件`;
  }
}

function renderTable() {
  const keyword = (searchInput.value || "").trim().toLowerCase();
  const filterStatus = statusFilter.value;
  const filterHospital = hospitalFilter.value;
  const sortValue = sortFilter.value;

  let filtered = Array.isArray(mockCases) ? [...mockCases] : [];

  filtered = filtered.filter(item => {
    const haystack = [item.case_id, item.patient_name, item.hospital, item.diagnosis, item.case_summary]
      .join(" ")
      .toLowerCase();

    const matchKeyword = haystack.includes(keyword);
    const matchStatus = filterStatus === "all" ? true : item.status === filterStatus;
    const matchHospital = filterHospital === "all" ? true : item.hospital === filterHospital;

    return matchKeyword && matchStatus && matchHospital;
  });

  filtered.sort((a, b) => {
    const aTime = parseCreatedAt(a.created_at);
    const bTime = parseCreatedAt(b.created_at);
    return sortValue === "newest" ? bTime - aTime : aTime - bTime;
  });

  currentRenderedList = filtered;
  updateKPI(filtered);

  if (!filtered.length) {
    tableBody.innerHTML = "";
    emptyState.style.display = "block";
    closeDrawer();
    return;
  }

  emptyState.style.display = "none";
  const rowsHtml = filtered.map((item, index) => createTableRows(item, index)).join("");
  tableBody.innerHTML = rowsHtml;
}

function bindRoundTabs() {
  const tabs = drawerContent.querySelectorAll(".round-tab");
  const panels = drawerContent.querySelectorAll(".round-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.roundKey;
      tabs.forEach(btn => btn.classList.toggle("active", btn === tab));
      panels.forEach(panel => {
        panel.style.display = panel.dataset.roundPanel === key ? "block" : "none";
      });
    });
  });
}

function openDrawer(index) {
  const item = currentRenderedList[index];
  if (!item) return;

  currentEditingIndex = null;
  drawerPatientName.textContent = item.patient_name;
  drawerMeta.textContent = `${item.case_id}｜${item.created_at}｜${item.hospital}`;
  drawerContent.innerHTML = createDrawerContent(item);
  bindRoundTabs();

  drawerOverlay.classList.add("show");
  detailDrawer.classList.add("show");
  detailDrawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function openEditDrawer(index) {
  const item = currentRenderedList[index];
  if (!item) return;

  currentEditingIndex = index;
  drawerPatientName.textContent = `${item.patient_name}｜編輯模式`;
  drawerMeta.textContent = `${item.case_id}｜${item.created_at}｜${item.hospital}`;
  drawerContent.innerHTML = createEditForm(item, index);

  drawerOverlay.classList.add("show");
  detailDrawer.classList.add("show");
  detailDrawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  const saveBtn = document.getElementById("saveEditBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");

  if (saveBtn) saveBtn.addEventListener("click", saveEditForm);
  if (cancelBtn) cancelBtn.addEventListener("click", () => openDrawer(index));
}

function saveEditForm() {
  const form = document.getElementById("editCaseForm");
  if (!form || currentEditingIndex === null) return;

  const formData = new FormData(form);
  const target = currentRenderedList[currentEditingIndex];
  if (!target) return;

  target.case_id = String(formData.get("case_id") || "").trim();
  target.created_at = String(formData.get("created_at") || "").trim();
  target.patient_name = String(formData.get("patient_name") || "").trim();
  target.hospital = String(formData.get("hospital") || "").trim();
  target.age = String(formData.get("age") || "").trim();
  target.gender = String(formData.get("gender") || "").trim();
  target.status = String(formData.get("status") || "").trim();
  target.case_manager = String(formData.get("case_manager") || "").trim();
  target.diagnosis = String(formData.get("diagnosis") || "").trim();
  target.case_summary = String(formData.get("case_summary") || "").trim();
  target.cms_level = String(formData.get("cms_level") || "").trim();
  target.mobility = String(formData.get("mobility") || "").trim();
  target.consciousness = String(formData.get("consciousness") || "").trim();
  target.oxygen = String(formData.get("oxygen") || "").trim();
  target.contact_name = String(formData.get("contact_name") || "").trim();
  target.contact_phone = String(formData.get("contact_phone") || "").trim();
  target.address = String(formData.get("address") || "").trim();
  target.service_type = String(formData.get("service_type") || "").trim();
  target.service_time = String(formData.get("service_time") || "").trim();
  target.special_need = String(formData.get("special_need") || "").trim();
  target.service_codes = String(formData.get("service_codes") || "")
    .split(/[，,]/)
    .map(item => item.trim())
    .filter(Boolean);

  renderTable();
  openDrawer(currentEditingIndex);
}

function closeDrawer() {
  drawerOverlay.classList.remove("show");
  detailDrawer.classList.remove("show");
  detailDrawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function resetFilters() {
  searchInput.value = "";
  statusFilter.value = "all";
  hospitalFilter.value = "all";
  sortFilter.value = "newest";
  renderTable();
}

function runSelfTests() {
  console.assert(Array.isArray(mockCases) && mockCases.length >= 5, "虛擬個案數量不足 5 位");
  console.assert(parseCreatedAt("2026/03/30 10:58") > 0, "日期解析失敗");
  const progress = getReplyProgress(mockCases[0]);
  console.assert(progress.total === 35, "回覆進度計算失敗");
  const drawerHtml = createDrawerContent(mockCases[0]);
  console.assert(drawerHtml.includes("機構名稱"), "詳情視窗內容生成失敗");
  const editHtml = createEditForm(mockCases[0], 0);
  console.assert(editHtml.includes("編輯案件資料") && editHtml.includes("儲存修改"), "編輯表單未生成");
}

tableBody.addEventListener("click", (event) => {
  const detailButton = event.target.closest('button[data-action="detail"]');
  if (detailButton) {
    const index = Number(detailButton.dataset.index);
    if (!Number.isNaN(index)) openDrawer(index);
    return;
  }

  const editButton = event.target.closest('button[data-action="edit"]');
  if (editButton) {
    const index = Number(editButton.dataset.index);
    if (!Number.isNaN(index)) openEditDrawer(index);
  }
});

searchInput.addEventListener("input", renderTable);
statusFilter.addEventListener("change", renderTable);
hospitalFilter.addEventListener("change", renderTable);
sortFilter.addEventListener("change", renderTable);
btnReload.addEventListener("click", renderTable);
btnReset.addEventListener("click", resetFilters);
drawerOverlay.addEventListener("click", closeDrawer);
drawerClose.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
});

runSelfTests();
renderTable();
