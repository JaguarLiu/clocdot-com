import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './context/AuthContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import App from './App.jsx'
// i18n 必須在任何元件 render 前初始化（副作用 import）
import './i18n/index.js'
import './index.css'

// autoUpdate 模式：偵測到新版 service worker 接管後會自動重新整理頁面，
// 消除「舊殼載新 chunk → 404 → 白畫面」的空窗（ErrorBoundary 作為保險網）
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
