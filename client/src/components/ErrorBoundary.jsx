import { Component } from 'react'
import i18n from '../i18n/index.js'

// 動態 import 失敗（部署新版後舊分頁載到已不存在的舊 chunk）時，
// 各瀏覽器丟出的訊息不一，用關鍵字粗略辨識。
function isChunkLoadError(error) {
  const msg = String(error?.message || error || '')
  return (
    /dynamically imported module/i.test(msg) || // Chrome / Firefox
    /Importing a module script failed/i.test(msg) || // Safari
    /Failed to fetch/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  )
}

const RELOAD_TS_KEY = 'chunk-reload-ts'
const RELOAD_COOLDOWN_MS = 10_000

// 近期已自動重整過就別再刷（避免新版本身壞掉時無限迴圈）；
// 冷卻期過後允許再次自我修復，毋須手動清 flag
function reloadedRecently() {
  const ts = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0)
  return ts && Date.now() - ts < RELOAD_COOLDOWN_MS
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    // chunk 載入失敗 → 自動重新整理一次拿新版殼
    if (isChunkLoadError(error) && !reloadedRecently()) {
      sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()))
      window.location.reload()
      return
    }
    console.error('ErrorBoundary caught:', error)
  }

  handleReload = () => {
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()))
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    // chunk 錯誤在 componentDidCatch 已觸發 reload，這裡多半只閃一下；
    // 其餘錯誤顯示可手動重試的畫面
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f3f0e6] px-6 text-center">
        <p className="font-zh text-slate-600 text-base">{i18n.t('common.pageLoadError')}</p>
        <button
          type="button"
          onClick={this.handleReload}
          className="font-zh text-sm text-white bg-emerald-500 px-5 py-2.5 active:scale-95 transition"
        >
          {i18n.t('common.reload')}
        </button>
      </div>
    )
  }
}
