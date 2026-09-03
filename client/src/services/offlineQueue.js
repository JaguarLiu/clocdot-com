// 離線打卡佇列 — localStorage 為儲存媒介
//
// 一筆 entry：
//   { id, action: 'in'|'out', clientTime: ISO, lat, lng, queuedAt: ISO }
// id 由 queuedAt + random 組成，避免上線重送時重複處理
//
// 上限 5 筆 (一天一上一下 × 2 + buffer)；超過丟最舊
//
// 不放敏感資料；不放 token；無加密 (localStorage 在同 origin 本來就可被 JS 讀)

const STORAGE_KEY = 'clocdot.offlineQueue.v1'
const MAX_ENTRIES = 5

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch (err) {
    // localStorage 滿、私密模式等情境
    console.warn('offlineQueue write failed', err)
  }
}

export function listQueue() {
  return readRaw()
}

export function queueSize() {
  return readRaw().length
}

export function enqueuePunch({ action, lat, lng }) {
  const entries = readRaw()
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    clientTime: new Date().toISOString(),
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
    queuedAt: new Date().toISOString(),
  }
  entries.push(entry)
  // 超出上限丟最舊
  while (entries.length > MAX_ENTRIES) entries.shift()
  writeRaw(entries)
  return entry
}

export function removeEntry(id) {
  const entries = readRaw().filter((e) => e.id !== id)
  writeRaw(entries)
}

export function clearQueue() {
  writeRaw([])
}

// 依序送出佇列中的每一筆；遇到網路錯誤就停下來保留剩下的
//   sender(entry) 應 throw 以表示失敗 (網路錯誤或 server 4xx/5xx)
//   遇到 4xx (例如 NOT_AT_OFFICE / 已打過卡) → 仍 dequeue (不再重試)
//   遇到網路錯誤 → 保留並中止 replay
export async function replayQueue(sender) {
  const entries = readRaw()
  if (entries.length === 0) return { sent: 0, dropped: 0, kept: 0 }

  let sent = 0
  let dropped = 0
  for (const entry of [...entries]) {
    try {
      await sender(entry)
      removeEntry(entry.id)
      sent += 1
    } catch (err) {
      // 4xx 視為「重送也無解」→ dequeue 並計為 dropped
      const status = err?.status
      if (typeof status === 'number' && status >= 400 && status < 500) {
        removeEntry(entry.id)
        dropped += 1
        continue
      }
      // 網路或 5xx → 保留剩下的，下次再試
      const remaining = readRaw().length
      return { sent, dropped, kept: remaining, lastError: err }
    }
  }
  return { sent, dropped, kept: 0 }
}
