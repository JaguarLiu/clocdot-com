import { useEffect, useState, useCallback } from 'react'

const DISMISS_KEY = 'clocdot:install-dismissed-at'
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

function recentlyDismissed() {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY))
    if (!ts) return false
    return Date.now() - ts < DISMISS_COOLDOWN_MS
  } catch {
    return false
  }
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [visible, setVisible] = useState(false)
  const [platform] = useState(detectPlatform)
  const installed = isStandalone()

  useEffect(() => {
    if (installed) return
    if (recentlyDismissed()) return

    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferred(e)
      setVisible(true)
    }
    const onInstalled = () => {
      setDeferred(null)
      setVisible(false)
      try { localStorage.removeItem(DISMISS_KEY) } catch { /* localStorage 不可用（無痕模式等）時忽略 */ }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    if (platform === 'ios') {
      const t = setTimeout(() => setVisible(true), 1500)
      return () => {
        clearTimeout(t)
        window.removeEventListener('beforeinstallprompt', onBeforeInstall)
        window.removeEventListener('appinstalled', onInstalled)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [installed, platform])

  const install = useCallback(async () => {
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    setVisible(false)
    if (outcome === 'dismissed') {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* localStorage 不可用（無痕模式等）時忽略 */ }
    }
  }, [deferred])

  const dismiss = useCallback(() => {
    setVisible(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* localStorage 不可用（無痕模式等）時忽略 */ }
  }, [])

  return {
    visible: visible && !installed,
    platform,
    canInstall: !!deferred,
    install,
    dismiss,
  }
}
