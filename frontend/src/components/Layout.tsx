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
  return (
    <div className="flex h-screen bg-zinc-50">
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-5 border-b border-zinc-100">
          <h1 className="text-lg font-semibold text-zinc-800 tracking-tight">
            Control AS
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Entrada y Salida</p>
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
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
