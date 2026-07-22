import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, MapPin, Clock } from 'lucide-react'
import { api } from '../api/client'

interface Incident {
  id: number
  employee_id: number
  work_session_id: number | null
  incident_type: string
  severity: string
  description: string
  latitude: number | null
  longitude: number | null
  timestamp: string
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  employee?: { id: number; name: string }
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [stats, setStats] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('')

  const load = async () => {
    const [data, s] = await Promise.all([
      api.incidents.list({ resolved: filter === 'all' ? undefined : filter === 'resolved', incident_type: typeFilter || undefined }),
      api.incidents.stats()
    ])
    setIncidents(data)
    setStats(s)
  }

  useEffect(() => { load() }, [filter, typeFilter])

  const handleResolve = async (id: number) => {
    const by = prompt('¿Quién resuelve esta incidencia?')
    if (!by) return
    await api.incidents.resolve(id, { resolved_by: by })
    await load()
  }

  const formatTime = (dt: string) => new Date(dt).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const getSeverityColor = (s: string) => {
    if (s === 'critical') return 'bg-red-50 text-red-700 border-red-200'
    if (s === 'warning') return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }

  const getTypeLabel = (t: string) => {
    const labels: Record<string, string> = {
      perimeter_exit: 'Salida del perímetro',
      missed_check: 'No respondió verificación',
      wifi_disconnect: 'Wi-Fi desconectado',
      impersonation: 'Posible suplantación'
    }
    return labels[t] || t
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">Incidencias</h1>
        <p className="text-sm text-zinc-400 mt-0.5">{stats?.pending || 0} pendientes de resolver</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-zinc-200 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-800">{stats.total}</p>
            <p className="text-xs text-zinc-400">Total</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-amber-500">Pendientes</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
            <p className="text-xs text-green-500">Resueltas</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.by_severity?.critical || 0}</p>
            <p className="text-xs text-red-500">Críticas</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'resolved'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
            {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : 'Resueltas'}
          </button>
        ))}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white">
          <option value="">Todos los tipos</option>
          <option value="perimeter_exit">Salida del perímetro</option>
          <option value="missed_check">No respondió verificación</option>
          <option value="wifi_disconnect">Wi-Fi desconectado</option>
          <option value="impersonation">Posible suplantación</option>
        </select>
      </div>

      <div className="space-y-3">
        {incidents.length === 0 && (
          <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-8 text-center">
            <AlertTriangle size={40} className="mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-400 text-sm">No hay incidencias registradas</p>
          </div>
        )}
        {incidents.map(inc => (
          <div key={inc.id} className={`bg-white rounded-xl border p-5 ${inc.resolved ? 'border-zinc-200 opacity-70' : 'border-amber-200'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${inc.severity === 'critical' ? 'bg-red-100' : inc.severity === 'warning' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                  <AlertTriangle size={16} className={inc.severity === 'critical' ? 'text-red-600' : inc.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(inc.severity)}`}>{inc.severity}</span>
                    <span className="text-xs text-zinc-400">{getTypeLabel(inc.incident_type)}</span>
                  </div>
                  <p className="text-sm font-medium text-zinc-800">{inc.employee?.name || `Empleado #${inc.employee_id}`}</p>
                  <p className="text-sm text-zinc-500 mt-1">{inc.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(inc.timestamp)}</span>
                    {inc.latitude && inc.longitude && <span className="flex items-center gap-1"><MapPin size={12} /> {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}</span>}
                  </div>
                  {inc.resolved && (
                    <p className="text-xs text-green-600 mt-2">Resuelta por {inc.resolved_by} · {inc.resolved_at && formatTime(inc.resolved_at)}</p>
                  )}
                </div>
              </div>
              {!inc.resolved && (
                <button onClick={() => handleResolve(inc.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                  <CheckCircle size={12} /> Resolver
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
