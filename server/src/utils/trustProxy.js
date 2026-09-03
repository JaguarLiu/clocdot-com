// X-Forwarded-* 只有在確實位於已知反向代理後面時才可信。
// trustProxy: true 會信任整條 X-Forwarded-For，用戶端因此可以自行偽造來源 IP，
// 而 request.ip 正是 Wi-Fi 打卡驗證 (onsiteCheck → isIpAllowed) 的判準，
// 等於讓員工可以假裝人在公司網段打卡。所以預設不信任，必須明確設定 TRUST_PROXY。
//
// TRUST_PROXY 支援：
//   未設定 / 空值 / 'false' → false，直接使用 socket 來源 IP（最安全）
//   數字（例如 '1'）        → 信任的反向代理跳數，適合前面固定有 N 層 proxy
//   IP 或 CIDR 清單         → 只信任這些 proxy，逗號分隔
//   'true'                  → 信任整條鏈；只有在 proxy 會覆寫 XFF 時才可使用
export function parseTrustProxy(raw) {
  const value = String(raw ?? '').trim()
  const keyword = value.toLowerCase()
  if (!value || keyword === 'false') return false
  if (keyword === 'true') return true
  if (/^\d+$/.test(value)) return Number(value)
  const list = value.split(',').map((entry) => entry.trim()).filter(Boolean)
  return list.length ? list : false
}
