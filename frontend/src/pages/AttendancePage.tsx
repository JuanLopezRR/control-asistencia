import { useEffect, useState } from 'react'
import { Filter, Trash2, Play, Square, Coffee, AlertTriangle, Pencil, Check, X } from 'lucide-react'
import { api } from '../api/client'
import type { AttendanceRecord, Employee } from '../types'

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filterEmp, setFilterEmp] = useState<number>(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editJustification, setEditJustification] = useState('')
  const [view, setView] = useState<'all' | 'late'>('all')

  const loadRecords = async () => {
    const data = await api.attendance.list({
      employee_id: filterEmp || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    })
    setRecords(data)
  }

  useEffect(() => {
    api.employees.list('', true).then(setEmployees)
  }, [])

  useEffect(() => {
    loadRecords()
  }, [filterEmp, dateFrom, dateTo])

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este registro?')) return
    try {
      await api.attendance.delete(id)
      await loadRecords()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleSaveJustification = async (id: number) => {
    try {
      await api.attendance.update(id, { justification: editJustification })
      setEditingId(null)
      await loadRecords()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const formatTime = (t: string | null) => t ? t.slice(0, 5) : '—'

  const filtered = view === 'late' ? records.filter(r => r.late) : records
  const lateCount = records.filter(r => r.late).length

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Registro de Asistencia</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Historial de entrada, salida y descansos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('all')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'all' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
            Todos ({records.length})
          </button>
          <button onClick={() => setView('late')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'late' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>
            <AlertTriangle size={14} className="inline mr-1" />
            Tardanzas ({lateCount})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-zinc-500 mb-1">Empleado</label>
          <select value={filterEmp} onChange={(e) => setFilterEmp(Number(e.target.value))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/20">
            <option value={0}>Todos</option>
            {employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}
          </select>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20" />
          </div>
        </div>
        <button onClick={() => { setFilterEmp(0); setDateFrom(''); setDateTo('') }} className="px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50 transition-colors">
          <Filter size={15} className="inline mr-1" /> Limpiar
        </button>
      </div>

      <div className="hidden md:block bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Empleado</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Fecha</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Entrada</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Salida</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Descanso</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Total</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Estado</th>
                <th className="text-right px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => {
                const entry = rec.entry_time ? rec.entry_time.split(':').map(Number) : null
                const exit = rec.exit_time ? rec.exit_time.split(':').map(Number) : null
                let total = ''
                if (entry && exit) {
                  let diff = (exit[0] * 60 + exit[1]) - (entry[0] * 60 + entry[1])
                  if (diff < 0) diff += 1440
                  total = `${Math.floor(diff / 60)}h ${diff % 60}m`
                }
                return (
                  <tr key={rec.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-zinc-800">{rec.employee?.name || `ID: ${rec.employee_id}`}</td>
                    <td className="px-5 py-3 text-zinc-500">{new Date(rec.date + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                    <td className="px-5 py-3 text-center"><span className="inline-flex items-center gap-1 text-green-700"><Play size={12} /> {formatTime(rec.entry_time)}</span></td>
                    <td className="px-5 py-3 text-center"><span className="inline-flex items-center gap-1 text-red-700"><Square size={12} /> {formatTime(rec.exit_time)}</span></td>
                    <td className="px-5 py-3 text-center"><span className="inline-flex items-center gap-1 text-amber-700"><Coffee size={12} />{rec.break_start ? `${formatTime(rec.break_start)} - ${formatTime(rec.break_end)}` : '—'}</span></td>
                    <td className="px-5 py-3 text-center font-medium text-zinc-700">{total || '—'}</td>
                    <td className="px-5 py-3 text-center">
                      {rec.late ? (
                        editingId === rec.id ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input value={editJustification} onChange={(e) => setEditJustification(e.target.value)} className="px-2 py-1 border border-amber-300 rounded text-xs w-40 focus:outline-none focus:ring-1 focus:ring-amber-400" placeholder="Justificación..." autoFocus />
                            <button onClick={() => handleSaveJustification(rec.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"><X size={14} /></button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-xs bg-amber-50 px-2 py-1 rounded-full cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => { setEditingId(rec.id); setEditJustification(rec.justification || '') }}>
                            <AlertTriangle size={12} /> Tarde {rec.justification && <span className="text-amber-500">· {rec.justification}</span>}
                            <Pencil size={10} className="text-amber-400 ml-0.5" />
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">A tiempo</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleDelete(rec.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-zinc-400 text-sm">{view === 'late' ? 'No hay tardanzas' : 'No hay registros'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {filtered.map((rec) => {
          const entry = rec.entry_time ? rec.entry_time.split(':').map(Number) : null
          const exit = rec.exit_time ? rec.exit_time.split(':').map(Number) : null
          let total = ''
          if (entry && exit) {
            const diff = (exit[0] * 60 + exit[1]) - (entry[0] * 60 + entry[1])
            total = `${Math.floor(diff / 60)}h ${diff % 60}m`
          }
          return (
            <div key={rec.id} className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-zinc-800">{rec.employee?.name || `ID: ${rec.employee_id}`}</p>
                  <p className="text-xs text-zinc-400">{new Date(rec.date + 'T12:00:00').toLocaleDateString('es-MX')}</p>
                </div>
                {rec.late ? (
                  editingId === rec.id ? (
                    <div className="flex items-center gap-1">
                      <input value={editJustification} onChange={(e) => setEditJustification(e.target.value)} className="px-2 py-1 border border-amber-300 rounded text-xs w-32 focus:outline-none" placeholder="Justificación..." autoFocus />
                      <button onClick={() => handleSaveJustification(rec.id)} className="p-1 text-green-600"><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-zinc-400"><X size={14} /></button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 text-xs bg-amber-50 px-2 py-1 rounded-full cursor-pointer" onClick={() => { setEditingId(rec.id); setEditJustification(rec.justification || '') }}>
                      <AlertTriangle size={12} /> Tarde
                    </span>
                  )
                ) : (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">A tiempo</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <p className="text-zinc-400">Entrada</p>
                  <p className="font-medium text-green-700">{formatTime(rec.entry_time)}</p>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <p className="text-zinc-400">Salida</p>
                  <p className="font-medium text-red-700">{formatTime(rec.exit_time)}</p>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <p className="text-zinc-400">Total</p>
                  <p className="font-medium text-zinc-700">{total || '—'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                {rec.justification && <p className="text-xs text-amber-500 truncate">{rec.justification}</p>}
                <button onClick={() => handleDelete(rec.id)} className="p-2 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 ml-auto"><Trash2 size={15} /></button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-400 text-sm">{view === 'late' ? 'No hay tardanzas' : 'No hay registros'}</div>
        )}
      </div>
    </div>
  )
}
