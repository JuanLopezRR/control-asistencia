import { useEffect, useState } from 'react'
import { Bell, CheckCircle, XCircle, Clock, User, Send } from 'lucide-react'
import { api } from '../api/client'

interface PresenceCheck {
  id: number
  employee_id: number
  work_session_id: number
  scheduled_at: string
  responded_at: string | null
  status: string
  response_method: string | null
  response_lat: number | null
  response_lng: number | null
  timeout_seconds: number
  employee?: { id: number; name: string }
}

interface Employee {
  id: number
  name: string
}

export default function PresencePage() {
  const [pending, setPending] = useState<PresenceCheck[]>([])
  const [history, setHistory] = useState<PresenceCheck[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmp, setSelectedEmp] = useState<number | ''>('')
  const [scheduleMsg, setScheduleMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [tab, setTab] = useState<'pending' | 'history'>('pending')

  const load = async () => {
    const [p, h] = await Promise.all([
      api.presence.pending(),
      api.presence.history()
    ])
    setPending(p)
    setHistory(h)
  }

  const loadEmployees = async () => {
    try {
      const emps = await api.employees.list()
      setEmployees(emps)
    } catch {}
  }

  useEffect(() => { load(); loadEmployees() }, [tab])

  const handleSchedule = async () => {
    if (!selectedEmp) return
    setScheduling(true)
    setScheduleMsg(null)
    try {
      const res = await api.presence.schedule(selectedEmp)
      setScheduleMsg({ type: 'success', text: `Validacion enviada a ${res.employee}` })
      setSelectedEmp('')
      await load()
    } catch (e: any) {
      const msg = e.message || 'Error al programar'
      setScheduleMsg({ type: 'error', text: msg.includes('Failed to fetch') ? 'Servidor no disponible, intenta de nuevo en unos segundos' : msg })
    }
    setScheduling(false)
    setTimeout(() => setScheduleMsg(null), 5000)
  }

  const formatTime = (dt: string) => new Date(dt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const formatDate = (dt: string) => new Date(dt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const getStatusIcon = (status: string) => {
    if (status === 'confirmed') return <CheckCircle size={16} className="text-green-500" />
    if (status === 'missed') return <XCircle size={16} className="text-red-500" />
    if (status === 'expired') return <Clock size={16} className="text-amber-500" />
    return <Bell size={16} className="text-blue-500 animate-pulse" />
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = { pending: 'Pendiente', confirmed: 'Confirmada', missed: 'No respondida', expired: 'Expirada' }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-blue-50 text-blue-700 border-blue-200',
      confirmed: 'bg-green-50 text-green-700 border-green-200',
      missed: 'bg-red-50 text-red-700 border-red-200',
      expired: 'bg-amber-50 text-amber-700 border-amber-200'
    }
    return colors[status] || 'bg-zinc-50 text-zinc-700 border-zinc-200'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">Validaciones Aleatorias</h1>
        <p className="text-sm text-zinc-400 mt-0.5">{pending.length} verificaciones pendientes</p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <p className="text-sm font-medium text-zinc-700 mb-3">Programar validacion manual</p>
        <div className="flex items-center gap-3">
          <select
            value={selectedEmp}
            onChange={(e) => setSelectedEmp(e.target.value ? Number(e.target.value) : '')}
            className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">Seleccionar empleado...</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <button
            onClick={handleSchedule}
            disabled={!selectedEmp}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            <Send size={14} /> Enviar ahora
          </button>
        </div>
        {scheduleMsg && (
          <p className={`mt-2 text-sm ${scheduleMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {scheduleMsg.text}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('pending')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'pending' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
          Pendientes ({pending.length})
        </button>
        <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'history' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
          Historial
        </button>
      </div>

      {tab === 'pending' ? (
        <div className="space-y-3">
          {pending.length === 0 && (
            <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-8 text-center">
              <Bell size={40} className="mx-auto text-zinc-300 mb-3" />
              <p className="text-zinc-400 text-sm">No hay verificaciones pendientes</p>
            </div>
          )}
          {pending.map(check => (
            <div key={check.id} className="bg-white rounded-xl border border-blue-200 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl animate-pulse"><Bell size={20} className="text-blue-600" /></div>
                <div>
                  <p className="font-medium text-zinc-800">{check.employee?.name || `Empleado #${check.employee_id}`}</p>
                  <p className="text-xs text-zinc-400">Programada: {formatTime(check.scheduled_at)} · Timeout: {check.timeout_seconds}s</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(check.status)}`}>
                {getStatusLabel(check.status)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase">Empleado</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase">Programada</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase">Respondida</th>
                  <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase">Estado</th>
                  <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase">Metodo</th>
                </tr>
              </thead>
              <tbody>
                {history.map(check => (
                  <tr key={check.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-5 py-3 flex items-center gap-2"><User size={14} className="text-zinc-400" /> {check.employee?.name || `#${check.employee_id}`}</td>
                    <td className="px-5 py-3 text-zinc-500">{formatDate(check.scheduled_at)}</td>
                    <td className="px-5 py-3 text-zinc-500">{check.responded_at ? formatDate(check.responded_at) : '—'}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(check.status)}`}>
                        {getStatusIcon(check.status)} {getStatusLabel(check.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs">{check.response_method || '—'}</td>
                  </tr>
                ))}
                {history.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-zinc-400 text-sm">No hay historial</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
