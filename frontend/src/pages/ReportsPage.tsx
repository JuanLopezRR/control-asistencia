import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import type { AttendanceRecord } from '../types'

export default function ReportsPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  const load = async () => {
    const data = await api.attendance.list({
      employee_id: undefined,
      date_from: dateRange.from || undefined,
      date_to: dateRange.to || undefined,
    })
    setRecords(data)
  }

  useEffect(() => { load() }, [dateRange])

  const chartData = records
    .filter((r) => r.entry_time && r.exit_time)
    .slice(0, 30)
    .map((r) => {
      const entry = r.entry_time!.split(':').map(Number)
      const exit = r.exit_time!.split(':').map(Number)
      let mins = (exit[0] * 60 + exit[1]) - (entry[0] * 60 + entry[1])
      if (mins < 0) mins += 1440
      return {
        date: new Date(r.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }),
        hours: Number((mins / 60).toFixed(1)),
        employee: r.employee?.name || `#${r.employee_id}`,
      }
    })

  const exportCSV = () => {
    const headers = ['Empleado', 'Fecha', 'Entrada', 'Salida', 'Descanso Inicio', 'Descanso Fin', 'Notas']
    const rows = records.map((r) => [
      r.employee?.name || '',
      r.date,
      r.entry_time || '',
      r.exit_time || '',
      r.break_start || '',
      r.break_end || '',
      r.notes || '',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'asistencia.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Reportes</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{records.length} registros encontrados</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2.5 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Desde</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))}
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Hasta</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))}
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
          />
        </div>
        <button
          onClick={() => setDateRange({ from: '', to: '' })}
          className="px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50"
        >
          Limpiar
        </button>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4">Horas Trabajadas (últimos 30 registros)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#a1a1aa" />
              <YAxis tick={{ fontSize: 12 }} stroke="#a1a1aa" unit="h" />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e4e4e7',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Bar dataKey="hours" fill="#18181b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
                <th className="text-right px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Horas</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const entry = r.entry_time?.split(':').map(Number)
                const exit = r.exit_time?.split(':').map(Number)
                let total = ''
                if (entry && exit) {
                  let diff = (exit[0] * 60 + exit[1]) - (entry[0] * 60 + entry[1])
                  if (diff < 0) diff += 1440
                  total = `${Math.floor(diff / 60)}h ${diff % 60}m`
                }
                return (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-5 py-3 font-medium text-zinc-800">{r.employee?.name || `#${r.employee_id}`}</td>
                    <td className="px-5 py-3 text-zinc-500">{new Date(r.date + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                    <td className="px-5 py-3 text-center text-zinc-600">{r.entry_time?.slice(0, 5) || '—'}</td>
                    <td className="px-5 py-3 text-center text-zinc-600">{r.exit_time?.slice(0, 5) || '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-zinc-700">{total || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
