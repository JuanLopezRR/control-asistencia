import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  Clock,
  ScanLine,
  Smile,
  BarChart3,
  Settings,
  LogOut,
  MapPin,
  Briefcase,
  Bell,
  AlertTriangle,
  Shield,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
  { icon: Users, label: 'Empleados', view: 'employees' },
  { icon: Clock, label: 'Registro', view: 'attendance' },
  { icon: ScanLine, label: 'Escaneo QR', view: 'qr-scan' },
  { icon: Smile, label: 'Escaneo Facial', view: 'face-scan' },
  { icon: BarChart3, label: 'Reportes', view: 'reports' },
  { divider: true, label: 'Monitoreo' },
  { icon: MapPin, label: 'Geocerca', view: 'geofence' },
  { icon: Briefcase, label: 'Sesiones', view: 'sessions' },
  { icon: Bell, label: 'Validaciones', view: 'presence' },
  { icon: AlertTriangle, label: 'Incidencias', view: 'incidents' },
  { icon: Shield, label: 'Permisos', view: 'permissions' },
  { divider: true, label: 'Sistema' },
  { icon: Settings, label: 'Configuración', view: 'settings' },
]

export default function Layout({
  currentView,
  onNavigate,
  children,
}: {
  currentView: string
  onNavigate: (view: string) => void
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [currentView])

  return (
    <div className="flex h-screen bg-zinc-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-zinc-200 flex flex-col transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-800 tracking-tight">
              Control AS
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">Entrada y Salida</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded-lg hover:bg-zinc-100">
            <X size={18} className="text-zinc-500" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item, i) => {
            if ('divider' in item && item.divider) {
              return <div key={i} className="pt-4 pb-1 px-3"><p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{item.label}</p></div>
            }
            const navItem = item as { icon: any; label: string; view: string }
            const Icon = navItem.icon
            return (
              <button
                key={navItem.view}
                onClick={() => onNavigate(navItem.view)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  currentView === navItem.view
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Icon size={18} />
                {navItem.label}
              </button>
            )
          })}
        </nav>
        <div className="p-3 border-t border-zinc-100">
          <div className="flex items-center gap-3 px-3 py-2 text-xs text-zinc-400">
            <LogOut size={14} />
            Sistema v2.0
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-zinc-100">
            <Menu size={20} className="text-zinc-700" />
          </button>
          <h1 className="text-sm font-semibold text-zinc-800">Control AS</h1>
        </div>
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
