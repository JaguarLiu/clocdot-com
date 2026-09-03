import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar.jsx'

export default function AdminLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-dvh bg-[#f3f0e6] text-slate-900 overflow-hidden relative">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-slate-900 focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* 背景裝飾色塊 — 與 client 同系列但位置偏桌面版 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
        <div className="absolute top-[-10%] left-[15%] w-[30%] h-64 bg-emerald-100 -rotate-3" style={{ borderRadius: '40%' }} />
        <div className="absolute top-[20%] right-[-5%] w-[25%] h-80 bg-sky-100 rotate-6" style={{ borderRadius: '30%' }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[35%] h-64 bg-orange-50 -rotate-6" style={{ borderRadius: '45%' }} />
      </div>

      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
            onClick={() => setMobileNavOpen(false)}
          />
          <Sidebar mobile onNavigate={() => setMobileNavOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col relative z-10">
        <header className="lg:hidden shrink-0 h-16 px-4 sm:px-6 flex items-center border-b border-slate-300/50 bg-[#ece7d5]/95 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center text-slate-700 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Menu size={24} aria-hidden="true" />
          </button>
          <span className="ml-3 text-lg font-black tracking-tight text-slate-800">ClocDot</span>
          <span className="ml-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Admin</span>
        </header>

        <main id="admin-main" className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10 xl:py-10 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
