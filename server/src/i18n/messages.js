// Server 端訊息翻譯表
//
// 設計取捨：route/service 仍然直接把中文訊息放進 `{ error: '...' }`，
// 由 plugins/i18n.js 的 onSend hook 在回傳前依 Accept-Language 翻譯。
// 好處是 API 契約與所有 route 程式碼都不必改動，未翻譯的訊息會原樣落回中文。
//
// 中文是「原始碼語言」＝查表的 key。新增訊息時若忘了在此登錄，
// 英文使用者只會看到中文，不會壞掉。
//
// ⚠️ 只翻譯「回應訊息」。持久化到 DB 的字串（例如 routes/correction.js 寫入的
//    `[上班] 09:00 - 說明`）不在此列，也不可加入，否則既有紀錄會解析不出來。

export const SUPPORTED = ['zh-TW', 'en']
export const DEFAULT_LANG = 'zh-TW'

/** 完全相符的訊息 */
const EXACT_EN = {
  // --- 通用 / 系統 ---
  '伺服器發生錯誤，請稍後再試': 'A server error occurred. Please try again later.',
  '找不到資料': 'Not found.',
  '請填寫完整資料': 'Please fill in every field.',
  '請填寫所有必填欄位': 'Please fill in all required fields.',
  'GOOGLE_MAPS_API_KEY 未設定': 'GOOGLE_MAPS_API_KEY is not configured.',

  // --- 認證 / 帳號 ---
  '請輸入 email 與密碼': 'Please enter your email and password.',
  '請輸入目前密碼與新密碼': 'Please enter your current and new password.',
  '帳號不存在': 'Account not found.',
  '帳號已停用': 'This account is disabled.',
  '帳號未綁定公司': 'This account is not linked to a company.',
  '帳號尚未設定密碼，請聯絡管理員': 'This account has no password set. Please contact an administrator.',
  '目前密碼錯誤': 'Current password is incorrect.',
  '新密碼不可與目前密碼相同': 'New password must differ from the current one.',
  '新密碼長度至少 8 碼': 'New password must be at least 8 characters.',

  // --- 打卡 ---
  '不在辦公區域無法打卡': 'You are outside the office area and cannot punch in.',
  '今日已打過上班卡': 'You have already clocked in today.',
  '尚未打上班卡': 'You have not clocked in yet.',
  'clientTime 格式錯誤': 'clientTime is malformed.',
  'clientTime 不可為未來時間': 'clientTime cannot be in the future.',
  'clientTime 超過 24 小時，請重新打卡': 'clientTime is more than 24 hours old. Please punch again.',
  '找不到該日期的考勤紀錄': 'No attendance record for that date.',
  '該日無完成的打卡紀錄': 'No completed punch record for that day.',

  // --- 日期 / 區間 ---
  '日期格式需為 YYYY-MM-DD': 'Date must be in YYYY-MM-DD format.',
  '時間格式需為 HH:MM': 'Time must be in HH:MM format.',
  'workDate 需為 YYYY-MM-DD': 'workDate must be in YYYY-MM-DD format.',
  'hireDate 須為 YYYY-MM-DD': 'hireDate must be in YYYY-MM-DD format.',
  'month 需為 YYYY-MM': 'month must be in YYYY-MM format.',
  'month 需為 YYYY-MM 格式': 'month must be in YYYY-MM format.',
  'from / to 需為 YYYY-MM-DD': 'from / to must be in YYYY-MM-DD format.',
  'from / to 需為 YYYY-MM-DD 格式': 'from / to must be in YYYY-MM-DD format.',
  'from / to 含無效的日期': 'from / to contains an invalid date.',
  '包含無效的日期': 'Contains an invalid date.',
  '查詢區間不可超過 3 個月': 'The query range cannot exceed 3 months.',
  '查詢區間需為 1–62 天': 'The query range must be between 1 and 62 days.',
  'scheduleAnchorDate 格式錯誤': 'scheduleAnchorDate is malformed.',
  '結束時間必須晚於開始時間': 'End time must be later than the start time.',

  // --- 請假 ---
  '不支援的假別': 'Unsupported leave type.',
  '此筆請假時間格式異常，請要求員工重送': 'This leave request has a malformed time range. Ask the employee to resubmit.',
  '請假時間計算失敗，請檢查日期/時間格式': 'Could not compute the leave duration. Check the date/time format.',
  '已審核的申請無法撤回': 'A reviewed request cannot be withdrawn.',
  '無權撤回此申請': 'You are not allowed to withdraw this request.',
  '無權操作此申請': 'You are not allowed to act on this request.',
  '找不到該申請': 'Request not found.',
  '找不到申請': 'Request not found.',
  '此申請已審核': 'This request has already been reviewed.',
  '此申請已審核，無法重複審核': 'This request has already been reviewed and cannot be reviewed again.',
  '此申請目前沒有待處理的取消請求': 'This request has no pending cancellation.',
  '此申請目前無法申請取消': 'This request cannot be cancelled right now.',
  '需提供 status (approved/rejected) 或 action (confirm-cancel/reject-cancel)':
    'Provide either status (approved/rejected) or action (confirm-cancel/reject-cancel).',

  // --- 加班 ---
  '該日無加班時數': 'No overtime hours on that day.',
  'requestedMinutes 需為正整數': 'requestedMinutes must be a positive integer.',
  '此加班單已是該狀態，無需重複操作': 'This overtime request is already in that state.',

  // --- 簽核 ---
  'decision 必須為 approve 或 reject': 'decision must be approve or reject.',
  'status 必須為 approved 或 rejected': 'status must be approved or rejected.',
  '找不到簽核項目': 'Approval step not found.',
  '非指派給您的簽核': 'This approval is not assigned to you.',
  '此項目已被處理': 'This item has already been handled.',
  '此項目目前無法簽核': 'This item cannot be approved right now.',
  '未知的申請類型': 'Unknown request type.',

  // --- 公司設定 ---
  '找不到公司': 'Company not found.',
  '公司名稱不可為空': 'Company name cannot be empty.',
  '午休分鐘數需為 0–480 的整數': 'Break minutes must be an integer between 0 and 480.',
  'leavePolicyYearReset 只接受 anniversary 或 calendar': 'leavePolicyYearReset accepts only anniversary or calendar.',
  '彈性工時設定需為布林值': 'The flexible-hours setting must be a boolean.',
  '簽核層數需為 1–10 的整數': 'Approval levels must be an integer between 1 and 10.',
  'workHourType 只接受 flexible 或 fixed': 'workHourType accepts only flexible or fixed.',
  'lateDeductMode 只接受 per_minute 或 per_hour': 'lateDeductMode accepts only per_minute or per_hour.',
  'allowedIps 每筆需為合法 IP 或 CIDR 網段': 'Each entry in allowedIps must be a valid IP or CIDR range.',
  'wifiCheckinEnabled 需為布林值': 'wifiCheckinEnabled must be a boolean.',
  '啟用 WiFi 打卡前需至少設定一筆允許 IP': 'Configure at least one allowed IP before enabling WiFi check-in.',
  'name 與 address 為必填': 'name and address are required.',
  '地址編輯太過頻繁，請稍後再試': 'Address edits are too frequent. Please try again later.',
  'policies 需為陣列': 'policies must be an array.',

  // --- 部門 / 角色 ---
  '部門不存在': 'Department not found.',
  '部門名稱不可為空': 'Department name cannot be empty.',
  '上層部門不存在': 'Parent department not found.',
  '主管不存在': 'Manager not found.',
  '不可將部門設為自己或子部門的下層': 'A department cannot be nested under itself or its own sub-department.',
  '請先移動子部門與成員後再刪除': 'Move sub-departments and members out before deleting.',
  '角色不存在': 'Role not found.',
  '角色 id 不正確': 'Invalid role id.',
  '角色名稱不可為空': 'Role name cannot be empty.',
  '角色與部門不符': 'The role does not belong to that department.',
  '此部門已有同名角色': 'A role with that name already exists in this department.',
  '此角色仍有成員，請先移除指派': 'This role still has members. Remove the assignments first.',
  'Admin 角色不可修改': 'The Admin role cannot be modified.',
  'Admin 角色不可刪除': 'The Admin role cannot be deleted.',
  '不可透過此端點建立管理員角色': 'Administrator roles cannot be created through this endpoint.',
  '只有管理員可指派角色': 'Only administrators can assign roles.',
  '不能修改自己的角色': 'You cannot change your own role.',
  '不能刪除自己的帳號': 'You cannot delete your own account.',

  // --- 員工 / 匯入 ---
  'email 為必填': 'email is required.',
  'email 格式錯誤': 'email is malformed.',
  'email 已被使用': 'That email is already in use.',
  'empNo 必須為整數': 'empNo must be an integer.',
  '員工編號已被使用': 'That employee number is already in use.',
  'employmentType 只接受 regular / operation / parttime': 'employmentType accepts only regular / operation / parttime.',
  'rows 必須為陣列': 'rows must be an array.',
  '沒有可匯入的資料列': 'There are no importable rows.',
  'userIds 必填': 'userIds is required.',
  '包含無效或無權限操作的員工': 'Contains employees that are invalid or outside your permissions.',

  // --- 班別 / 排班 ---
  '找不到班別': 'Shift not found.',
  '班別不存在': 'Shift not found.',
  '班別名稱已存在': 'A shift with that name already exists.',
  '包含無效的班別': 'Contains an invalid shift.',
  '預設班別不可刪除，請先將其他班別設為預設': 'The default shift cannot be deleted. Set another shift as default first.',
  '不可直接取消預設班，請將其他班別設為預設': 'You cannot unset the default shift directly. Set another shift as default instead.',
  '正常班員工不可排班': 'Regular-shift employees cannot be scheduled.',
  'changes 必須為非空陣列': 'changes must be a non-empty array.',
  '每筆變更需含 userId 與 YYYY-MM-DD 格式的 date': 'Each change needs a userId and a date in YYYY-MM-DD format.',
  'shiftId 需為班別 id 或 null': 'shiftId must be a shift id or null.',

  // --- 薪資 ---
  '尚未結算': 'Payroll has not been run yet.',
  '已鎖定，無法修改': 'Locked — cannot be modified.',
  '已鎖定，請先解鎖': 'Locked — unlock it first.',
  '已是鎖定狀態': 'Already locked.',
  '目前非鎖定狀態': 'Not currently locked.',
  '查無已發放薪資單': 'No issued payslip found.',
  '找不到該員工薪資項': 'No payroll item found for that employee.',
  'adjustments 必須為陣列': 'adjustments must be an array.',
  '調整項說明不可為空': 'Adjustment description cannot be empty.',
  'allowances 必須為陣列': 'allowances must be an array.',
  '加給名稱不可為空': 'Allowance name cannot be empty.',
  '本薪必須為非負整數': 'Base salary must be a non-negative integer.',
  '時薪必須為正整數': 'Hourly rate must be a positive integer.',
  'baseSalary 必須為非負整數': 'baseSalary must be a non-negative integer.',
  '有填薪資欄位時 baseSalary 為必填': 'baseSalary is required when any salary field is filled in.',
  '勞退自願提繳率必須介於 0 至 0.06': 'The voluntary contribution rate must be between 0 and 0.06.',

  // --- 問題回報 ---
  '標題與描述為必填': 'Title and description are required.',
  '種類只能是 bug 或 feature': 'Type must be either bug or feature.',

  // --- 內部錯誤（正常情況下會被 500 handler 蓋掉，列此僅為完整性）---
  'computePayslip: salaryProfile 必填': 'computePayslip: salaryProfile is required.',
  'computePayslip: baseSalary 必須為數字': 'computePayslip: baseSalary must be a number.',
  'computeHourlyPayslip: salaryProfile 必填': 'computeHourlyPayslip: salaryProfile is required.',
  'computeHourlyPayslip: hourlyRate 必須為正整數': 'computeHourlyPayslip: hourlyRate must be a positive integer.',
  'findGrade: grades 不可為空': 'findGrade: grades cannot be empty.',
  'findGrade: monthlyWage 必須為有限數': 'findGrade: monthlyWage must be a finite number.',
}

/**
 * 含插值的訊息 —— 以 regex 捕捉數值後重組英文語序。
 * 順序即比對順序；先命中先贏。
 */
const PATTERN_EN = [
  [/^(.+)，剩餘嘗試次數 (\d+)$/,
    (m) => `${translateExact(m[1], 'en') ?? m[1]} ${m[2]} attempt(s) remaining.`],
  [/^密碼錯誤次數過多，帳號暫時鎖定，請於 (\d+) 分鐘後再試$/,
    (m) => `Too many failed attempts. This account is temporarily locked — try again in ${m[1]} minute(s).`],
  [/^密碼長度至少 (\d+) 碼$/, (m) => `Password must be at least ${m[1]} characters.`],
  [/^密碼為必填，長度至少 (\d+) 碼$/, (m) => `Password is required and must be at least ${m[1]} characters.`],
  [/^email 與第 (\d+) 列重複$/, (m) => `Duplicate email — also on row ${m[1]}.`],
  [/^員工編號與第 (\d+) 列重複$/, (m) => `Duplicate employee number — also on row ${m[1]}.`],
  [/^一次最多匯入 (\d+) 列$/, (m) => `At most ${m[1]} rows can be imported at once.`],
  [/^一次最多 (\d+) 筆變更$/, (m) => `At most ${m[1]} changes at a time.`],
  [/^不支援的假別: (.*)$/, (m) => `Unsupported leave type: ${m[1]}`],
  [/^(.+) 的 annualQuotaMinutes 需為 ≥0 整數或 null$/,
    (m) => `annualQuotaMinutes for ${m[1]} must be an integer ≥ 0 or null.`],
  [/^(.+) 的 deductRate 需為 0~1 或 null$/, (m) => `deductRate for ${m[1]} must be between 0 and 1, or null.`],
  [/^加給「(.+)」金額必須為非負整數$/, (m) => `The amount for allowance "${m[1]}" must be a non-negative integer.`],
  [/^調整項「(.+)」金額必須為整數$/, (m) => `The amount for adjustment "${m[1]}" must be an integer.`],
  [/^(.+)必須為非負整數$/, (m) => `${m[1]} must be a non-negative integer.`],
  [/^仍有 (\d+) 位員工以此為預設班別，請先變更$/,
    (m) => `${m[1]} employee(s) still use this as their default shift. Change them first.`],
  [/^仍有 (\d+) 筆今天以後的排班使用此班別，請先改排$/,
    (m) => `${m[1]} future assignment(s) still use this shift. Reschedule them first.`],
  [/^申請時數不可超過推導值 (\d+) 分鐘$/,
    (m) => `The requested duration cannot exceed the derived ${m[1]} minutes.`],
  [/^餘額不足：剩餘 ([\d.]+) 小時，此筆需 ([\d.]+) 小時$/,
    (m) => `Insufficient balance: ${m[1]} h remaining, this request needs ${m[2]} h.`],
  [/^餘額不足：此假別剩餘 ([\d.]+) 小時，本次申請 ([\d.]+) 小時$/,
    (m) => `Insufficient balance: ${m[1]} h left for this leave type, this request needs ${m[2]} h.`],
  // 排班法規檢核（scheduleCompliance.js）
  [/^(.+)：(\d{4}-\d{2}-\d{2})～(\d{4}-\d{2}-\d{2}) 連續上班 (\d+) 天，違反七休一（連續工作不得超過 (\d+) 天）$/,
    (m) => `${m[1]}: worked ${m[4]} consecutive days from ${m[2]} to ${m[3]}, breaching the "one rest day every seven days" rule (Employees cannot work for seven consecutive days without a day off).`],
  [/^(.+)：(\d{4}-\d{2}-\d{2}) 下班到 (\d{4}-\d{2}-\d{2}) 上班僅間隔 ([\d.]+) 小時，不足輪班間隔 (\d+) 小時$/,
    (m) => `${m[1]}: only ${m[4]} h between clocking out on ${m[2]} and clocking in on ${m[3]}, short of the required ${m[5]} h rest between shifts.`],
  // 內部錯誤
  [/^computePayslip: 未知加班 rate「(.+)」$/, (m) => `computePayslip: unknown overtime rate "${m[1]}".`],
  [/^computeHourlyPayslip: 未知加班 rate「(.+)」$/, (m) => `computeHourlyPayslip: unknown overtime rate "${m[1]}".`],
  [/^twPayroll (.+) 第 (\d+) 列非數字：「(.*)」$/,
    (m) => `twPayroll ${m[1]}: row ${m[2]} is not numeric: "${m[3]}".`],
  [/^twPayroll rates 第 (\d+) 列無效：「(.*)」$/, (m) => `twPayroll rates: row ${m[1]} is invalid: "${m[2]}".`],
  [/^twPayroll 無 (\d+) 年（含以前）的法定參照資料$/,
    (m) => `twPayroll has no statutory reference data for ${m[1]} or earlier.`],
]

const TABLES = { en: { exact: EXACT_EN, patterns: PATTERN_EN } }

function translateExact(text, lang) {
  return TABLES[lang]?.exact[text]
}

/**
 * 翻譯單一訊息；查無對應時回傳 null（呼叫端保留原文）。
 * @param {string} text 原始中文訊息
 * @param {string} lang 目標語言
 */
export function translateMessage(text, lang) {
  if (typeof text !== 'string' || !text) return null
  const table = TABLES[lang]
  if (!table) return null

  const exact = table.exact[text]
  if (exact) return exact

  for (const [re, build] of table.patterns) {
    const m = re.exec(text)
    if (m) return build(m)
  }
  return null
}

/**
 * 解析 Accept-Language，回傳我們支援的語言。
 * 只做簡單的 q-value 排序即可 —— 前端本來就會送明確的單一語言。
 */
export function pickLanguage(header) {
  if (!header || typeof header !== 'string') return DEFAULT_LANG
  const candidates = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find((p) => p.trim().startsWith('q='))
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split('=')[1]) || 0 : 1 }
    })
    .filter((c) => c.tag)
    .sort((a, b) => b.q - a.q)

  for (const { tag } of candidates) {
    if (tag === '*') return DEFAULT_LANG
    const exact = SUPPORTED.find((s) => s.toLowerCase() === tag)
    if (exact) return exact
    // en-US → en；zh-Hant / zh-HK → zh-TW
    const base = tag.split('-')[0]
    if (base === 'en') return 'en'
    if (base === 'zh') return 'zh-TW'
  }
  return DEFAULT_LANG
}
