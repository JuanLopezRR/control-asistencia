import { useEffect, useState } from 'react'
import { Users, Clock, Coffee, AlertTriangle } from 'lucide-react'
import { api } from '../api/client'
import ClockCard from '../components/ClockCard'
import StatCard from '../components/StatCard'
import { getGeoAndWifi } from '../utils/location'
import type { DashboardStats, Employee, AttendanceRecord } from '../types'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([])
  const [selectedId, setSelectedId] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    const [s, e, t] = await Promise.all([
      api.attendance.dashboard(),
      api.employees.list('', true),
      api.attendance.today(),
    ])
    setStats(s)
    setEmployees(e)
    setTodayRecords(t)
  }

  useEffect(() => {
    loadData()
  }, [])

  const todayRecord = todayRecords.find(r => r.employee_id === selectedId) || null

  const handleClockIn = async (id: number, justification?: string) => {
    setLoading(true)
    try {
      const extras = await getGeoAndWifi()
      await api.attendance.clockIn(id, justification, extras)
      await loadData()
    } catch (e: any) {
      alert(e.message)
    }
    setLoading(false)
  }

  const handleClockOut = async (id: number) => {
    setLoading(true)
    try {
      await api.attendance.clockOut(id)
      await loadData()
    } catch (e: any) {
      alert(e.message)
    }
    setLoading(false)
  }

  const handleBreakStart = async (id: number) => {
    setLoading(true)
    try {
      await api.attendance.breakStart(id)
      await loadData()
    } catch (e: any) {
      alert(e.message)
    }
    setLoading(false)
  }

  const handleBreakEnd = async (id: number) => {
    setLoading(true)
    try {
      await api.attendance.breakEnd(id)
      await loadData()
    } catch (e: any) {
      alert(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Resumen del día de hoy</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={20} />}
          label="Empleados"
          value={stats?.total_employees ?? 0}
          sub={`${stats?.active_employees ?? 0} activos`}
          color="blue"
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Presentes Hoy"
          value={stats?.present_today ?? 0}
          color="green"
        />
        <StatCard
          icon={<Coffee size={20} />}
          label="En Descanso"
          value={stats?.on_break ?? 0}
          sub="empleados"
          color="amber"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Tardanzas"
          value={stats?.late_today ?? 0}
          sub="después de 8:10 AM"
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClockCard
          employees={employees.filter(e => e.active).map(e => ({ id: e.id, name: e.name }))}
          todayRecord={todayRecord}
          selectedId={selectedId}
          onSelectEmployee={setSelectedId}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
          onBreakStart={handleBreakStart}
          onBreakEnd={handleBreakEnd}
          loading={loading}
        />

        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4">Registros de Hoy</h2>
          <div className="space-y-2">
            {employees.filter(e => e.active).map((emp) => {
              const rec = todayRecords.find(r => r.employee_id === emp.id)
              const isPresent = !!rec
              return (
                <div
                  key={emp.id}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm ${
                    isPresent ? 'bg-green-50 border-green-200' : 'bg-zinc-50 border-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isPresent ? 'bg-green-500' : 'bg-zinc-300'}`} />
                    <span className="font-medium text-zinc-700">{emp.name}</span>
                    <span className="text-zinc-400 text-xs">{emp.position}</span>
                    {rec?.late && <span className="text-xs text-amber-500">Tarde</span>}
                  </div>
                  <span className="text-xs text-zinc-400">
                    {isPresent
                      ? rec?.entry_time
                        ? rec?.exit_time
                          ? `Salida: ${rec.exit_time.slice(0, 5)}`
                          : `Entrada: ${rec.entry_time.slice(0, 5)}`
                        : 'Registrado'
                      : 'Ausente'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
