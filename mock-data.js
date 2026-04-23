const mockCases = [
  {
    case_id: "REF-20260330-WF79",
    patient_name: "王阿滿",
    hospital: "萬芳醫院急診",
    age: 82,
    gender: "女",
    diagnosis: "肺炎治療後病況穩定，需返家後銜接居家照護",
    mobility: "無法行走，但可站立",
    oxygen: "無",
    status: "一輪媒合中",
    created_at: "2026/03/30 10:58",
    case_summary: "女兒白天需上班，返家初期需生活照護與陪伴。",
    total_targets: 35,
    contact_name: "林小姐（女兒）",
    contact_phone: "0912-345-678",
    address: "台北市文山區興隆路三段 88 號 5 樓",
    cms_level: "第6級",
    consciousness: "清楚",
    service_type: "居家服務",
    service_time: "週一至週五白天",
    service_codes: ["BA01 基本身體清潔", "BA04 餵食/灌食", "BA11 關節活動"],
    special_need: "高跌倒風險、需女性居服員",
    case_manager: "張護理師",
    replies: [],
    round_status: {
      round1: { sent: 35, replied: 18, accepted: 2, rejected: 16, pending: 17 },
      round2: { sent: 35, replied: 0, accepted: 0, rejected: 0, pending: 35 },
      round3: { sent: 150, replied: 0, accepted: 0, rejected: 0, pending: 150 }
    },
    round_facilities: {
      round1: [
        { name: "慈濟居家長照機構", status: "accept", time: "09:12", note: "可先評估" },
        { name: "大心居家長照機構", status: "reject", time: "09:40", note: "目前人力不足" },
        { name: "愛吾愛居家長照機構", status: "pending", time: "", note: "尚未回覆" }
      ],
      round2: [
        { name: "聯承居家長照機構", status: "pending", time: "", note: "第二輪尚未啟動" }
      ],
      round3: []
    }
  },
  {
    case_id: "REF-20260329-AX12",
    patient_name: "陳春梅",
    hospital: "萬芳醫院住院",
    age: 79,
    gender: "女",
    diagnosis: "腦中風後失能，需長期照護與移位協助",
    mobility: "長期臥床，均於床上照顧",
    oxygen: "鼻導管 2L",
    status: "二輪媒合中",
    created_at: "2026/03/29 15:20",
    case_summary: "家屬傾向先找台北市南區機構，盼本週內確認。",
    total_targets: 35,
    contact_name: "陳先生（兒子）",
    contact_phone: "0933-111-222",
    address: "台北市中正區南海路 120 號 3 樓",
    cms_level: "第7級",
    consciousness: "清楚",
    service_type: "居家服務",
    service_time: "每日白天",
    service_codes: ["BA02 基本日常照顧", "BA11 關節活動", "BA15-1 家務（自用）"],
    special_need: "需鼻導管氧氣、需女性居服員",
    case_manager: "李個管師",
    replies: [
      { facility_name: "安心護理之家", reply: "accept", time: "16:10", note: "可先評估，需病摘與用藥清單" },
      { facility_name: "福安長照中心", reply: "reject", time: "16:35", note: "目前滿床" }
    ],
    round_status: {
      round1: { sent: 35, replied: 21, accepted: 1, rejected: 20, pending: 14 },
      round2: { sent: 35, replied: 12, accepted: 0, rejected: 12, pending: 23 },
      round3: { sent: 150, replied: 0, accepted: 0, rejected: 0, pending: 150 }
    },
    round_facilities: {
      round1: [
        { name: "安心護理之家", status: "accept", time: "16:10", note: "可先評估，需病摘與用藥清單" },
        { name: "福安長照中心", status: "reject", time: "16:35", note: "目前滿床" }
      ],
      round2: [
        { name: "國泰居家長照機構", status: "reject", time: "09:20", note: "目前排班已滿" },
        { name: "永佳居家長照機構", status: "pending", time: "", note: "尚未回覆" }
      ],
      round3: []
    }
  },
  {
    case_id: "REF-20260328-BH55",
    patient_name: "林水木",
    hospital: "雙和醫院",
    age: 88,
    gender: "男",
    diagnosis: "失智合併反覆感染，需安置照護",
    mobility: "長期臥床，均於床上照顧",
    oxygen: "面罩氧氣",
    status: "案件結案",
    created_at: "2026/03/28 09:05",
    case_summary: "已由仁愛安養中心確認收案，等待入住安排。",
    total_targets: 35,
    contact_name: "林先生（兒子）",
    contact_phone: "0928-888-321",
    address: "新北市永和區中正路 66 號 8 樓",
    cms_level: "第8級",
    consciousness: "混亂",
    service_type: "機構安置",
    service_time: "儘速入住",
    service_codes: ["24小時住宿照護", "失智照護", "協助灌食"],
    special_need: "感染控制、全面照護、需男性居服員",
    case_manager: "王社工師",
    replies: [
      { facility_name: "仁愛安養中心", reply: "accept", time: "10:20", note: "已確認收案，請提供出院摘要" }
    ],
    round_status: {
      round1: { sent: 35, replied: 24, accepted: 1, rejected: 23, pending: 11 },
      round2: { sent: 35, replied: 7, accepted: 0, rejected: 7, pending: 28 },
      round3: { sent: 150, replied: 0, accepted: 0, rejected: 0, pending: 150 }
    },
    round_facilities: {
      round1: [
        { name: "仁愛安養中心", status: "accept", time: "10:20", note: "已確認收案，請提供出院摘要" }
      ],
      round2: [
        { name: "維昕居家長照機構", status: "reject", time: "14:05", note: "暫無空床" }
      ],
      round3: []
    }
  },
  {
    case_id: "REF-20260327-CC21",
    patient_name: "黃秋香",
    hospital: "萬芳醫院急診",
    age: 76,
    gender: "女",
    diagnosis: "髖部骨折術後，返家需短期照護與復能協助",
    mobility: "可使用輔具行走(手杖、助行器等)",
    oxygen: "無",
    status: "三輪媒合中",
    created_at: "2026/03/27 11:40",
    case_summary: "案家希望以文山區、信義區資源優先。",
    total_targets: 150,
    contact_name: "黃小姐（媳婦）",
    contact_phone: "0911-222-555",
    address: "台北市信義區松德路 18 號 6 樓",
    cms_level: "第5級",
    consciousness: "清楚",
    service_type: "居家復能",
    service_time: "週一、三、五上午",
    service_codes: ["BA11 關節活動", "BA13 陪同外出", "BA20 陪伴服務"],
    special_need: "術後復能、需女性居服員",
    case_manager: "陳護理師",
    replies: [
      { facility_name: "同心居家長照機構", reply: "accept", time: "12:05", note: "可收案，最快明日家訪" }
    ],
    round_status: {
      round1: { sent: 35, replied: 19, accepted: 0, rejected: 19, pending: 16 },
      round2: { sent: 35, replied: 15, accepted: 1, rejected: 14, pending: 20 },
      round3: { sent: 150, replied: 32, accepted: 3, rejected: 29, pending: 118 }
    },
    round_facilities: {
      round1: [
        { name: "大愛居家長照機構", status: "reject", time: "08:55", note: "距離過遠" }
      ],
      round2: [
        { name: "同心居家長照機構", status: "accept", time: "12:05", note: "可收案，最快明日家訪" }
      ],
      round3: [
        { name: "百佳居家長照機構", status: "reject", time: "15:12", note: "服務區域不符" },
        { name: "善誠居家長照機構", status: "accept", time: "16:45", note: "可排家訪" },
        { name: "凱安居家長照機構", status: "pending", time: "", note: "尚未回覆" }
      ]
    }
  },
  {
    case_id: "REF-20260326-KL08",
    patient_name: "郭金龍",
    hospital: "萬芳醫院住院",
    age: 90,
    gender: "男",
    diagnosis: "慢性心衰竭反覆住院，需出院後照護銜接",
    mobility: "無法行走及站立，需全移位",
    oxygen: "鼻導管 1L",
    status: "案件結案",
    created_at: "2026/03/26 14:12",
    case_summary: "家屬決定自行安排照護資源，案件關閉。",
    total_targets: 150,
    contact_name: "郭太太",
    contact_phone: "0977-765-222",
    address: "台北市大安區復興南路二段 210 號 4 樓",
    cms_level: "第6級",
    consciousness: "清楚但易喘",
    service_type: "居家服務",
    service_time: "每日下午",
    service_codes: ["BA02 基本日常照顧", "BA04 餵食/灌食", "生命徵象觀察"],
    special_need: "慢性心衰竭、需密切觀察呼吸狀況",
    case_manager: "周個管師",
    replies: [
      { facility_name: "青松居家長照機構", reply: "reject", time: "15:20", note: "目前人力不足" }
    ],
    round_status: {
      round1: { sent: 35, replied: 14, accepted: 0, rejected: 14, pending: 21 },
      round2: { sent: 35, replied: 10, accepted: 0, rejected: 10, pending: 25 },
      round3: { sent: 150, replied: 18, accepted: 0, rejected: 18, pending: 132 }
    },
    round_facilities: {
      round1: [
        { name: "青松居家長照機構", status: "reject", time: "15:20", note: "目前人力不足" }
      ],
      round2: [
        { name: "杏保居家長照機構", status: "reject", time: "17:20", note: "量能不足" }
      ],
      round3: [
        { name: "善誠居家長照機構", status: "reject", time: "09:10", note: "無法配合時段" },
        { name: "遠曜居家長照機構", status: "pending", time: "", note: "尚未回覆" }
      ]
    }
  }
];
