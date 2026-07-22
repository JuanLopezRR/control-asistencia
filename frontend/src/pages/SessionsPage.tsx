import { useEffect, useState } from 'react'
import { User, Wifi, Play } from 'lucide-react'
import { api } from '../api/client'

interface WorkSession {
  id: number
  employee_id: number
  work_location_id: number | null
  date: string
  start_time: string
  end_time: string | null
  status: string
  entry_method: string | null
  entry_location_lat: number | null
  entry_location_lng: number | null
  entry_wifi_ssid: string | null
  exit_method: string | null
  exit_location_lat: number | null
  exit_location_lng: number | null
  total_hours: number | null
  employee?: { id: number; name: string; position: string | null }
  work_location?: { id: number; name: string }
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [activeSessions, setActiveSessions] = useState<WorkSession[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  const load = async () => {
    const [all, active] = await Promise.all([
      api.sessions.list({ status: filter === 'all' ? undefined : filter }),
      api.sessions.active()
    ])
    setSessions(all)
    setActiveSessions(active)
  }

  useEffect(() => { load() }, [filter])

  const formatTime = (dt: string) => {
    if (!dt) return '—'
    return new Date(dt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (d: string) => {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
  }

  const getStatusBadge = (status: string) => {
    if (status === 'active') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Activa</span>
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">Completada</span>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">Sesiones de Trabajo</h1>
        <p className="text-sm text-zinc-400 mt-0.5">{activeSessions.length} sesiones activas</p>
      </div>

      <div className="flex gap-2">
        {(['all', 'active', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
            {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Completadas'}
          </button>
        ))}
      </div>

      {activeSessions.length > 0 && filter === 'all' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2"><Play size={14} /> Sesiones Activas</h3>
          <div className="space-y-2">
            {activeSessions.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-green-100">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{s.employee?.name || `Empleado #${s.employee_id}`}</p>
                    <p className="text-xs text-zinc-400">Inicio: {formatTime(s.start_time)} · {s.entry_method}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p>{s.work_location?.name || 'Sin ubicación'}</p>
                  {s.entry_wifi_ssid && <p className="flex items-center gap-1 justify-end"><Wifi size={10} /> {s.entry_wifi_ssid}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Empleado</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Fecha</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Entrada</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Salida</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Horas</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Estado</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-zinc-400" />
                      <span className="font-medium text-zinc-800">{s.employee?.name || `#${s.employee_id}`}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{formatDate(s.date)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="text-green-600 font-medium">{formatTime(s.start_time)}</span>
                    {s.entry_method && <p className="text-xs text-zinc-400">{s.entry_method}</p>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {s.end_time ? (
                      <span className="text-red-600 font-medium">{formatTime(s.end_time)}</span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center font-mono text-sm">{s.total_hours ? `${s.total_hours}h` : '—'}</td>
                  <td className="px-5 py-3 text-center">{getStatusBadge(s.status)}</td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">{s.work_location?.name || '—'}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-zinc-400 text-sm">No hay sesiones registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
