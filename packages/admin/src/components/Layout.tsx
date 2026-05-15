import { useAuth } from '../hooks/useAuth'
import { LogOut, Key, LayoutDashboard } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed top-0 left-0 z-40 w-64 h-screen sidebar">
        <div className="h-full px-4 py-6 overflow-y-auto">
          <div className="flex items-center mb-10 px-2">
            <Key className="w-7 h-7 text-black mr-3" strokeWidth={2} />
            <div className="flex items-baseline">
              <span className="text-xl font-bold text-black tracking-tight">Corz</span>
              <span className="text-sm font-medium text-gray-400 ml-1.5">Admin</span>
            </div>
          </div>

          <nav className="space-y-1">
            <Link
              to="/"
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/'
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mr-3" strokeWidth={1.5} />
              <span>Tokens</span>
            </Link>
          </nav>

          <div className="absolute bottom-6 left-0 w-full px-4">
            <button
              onClick={logout}
              className="flex items-center w-full px-3 py-2.5 text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              <LogOut className="w-5 h-5 mr-3" strokeWidth={1.5} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="p-6 sm:ml-64">
        <div className="max-w-6xl">
          {children}
        </div>
      </div>
    </div>
  )
}
