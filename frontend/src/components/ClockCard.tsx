import { useState, useEffect } from 'react'
import { Play, Square, Coffee, Coffee as CoffeeOff, AlertTriangle } from 'lucide-react'

interface Props {
  employees: { id: number; name: string }[]
  todayRecord: any
  selectedId: number
  onSelectEmployee: (id: number) => void
  onClockIn: (id: number, justification?: string) => void
  onClockOut: (id: number) => void
  onBreakStart: (id: number) => void
  onBreakEnd: (id: number) => void
  loading: boolean
}

export default function ClockCard({
  employees,
  todayRecord,
  selectedId,
  onSelectEmployee,
  onClockIn,
  onClockOut,
  onBreakStart,
  onBreakEnd,
  loading,
}: Props) {
  const [time, setTime] = useState(new Date())
  const [showJustify, setShowJustify] = useState(false)
  const [justification, setJustification] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const hasEntry = !!todayRecord?.entry_time
  const hasExit = !!todayRecord?.exit_time
  const onBreak = !!todayRecord?.break_start && !todayRecord?.break_end

  const handleClockIn = async () => {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/attendance/check-late/${selectedId}`)
      const data = await res.json()
      if (data.is_late) {
        setShowJustify(true)
      } else {
        onClockIn(selectedId)
      }
    } catch {
      onClockIn(selectedId)
    }
  }

  const submitJustification = () => {
    onClockIn(selectedId, justification || 'Sin justificación')
    setShowJustify(false)
    setJustification('')
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 relative">
      {showJustify && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl border border-amber-200 p-6 w-full max-w-sm shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <h3 className="font-semibold text-zinc-800">Llegada Tarde</h3>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              Son las {time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} — pasaste la hora de entrada (8:10 AM). Escribe la justificación:
            </p>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Motivo de la tardanza..."
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowJustify(false); setJustification('') }}
                className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitJustification}
                className="flex-1 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
              >
                Registrar entrada
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-zinc-900 rounded-lg text-white">
          <ClockIcon size={20} />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-800">Reloj Digital</p>
          <p className="text-2xl font-mono font-semibold text-zinc-900 tabular-nums">
            {time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Empleado</label>
        <select
          value={selectedId}
          onChange={(e) => onSelectEmployee(Number(e.target.value))}
          className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 bg-white"
        >
          <option value={0}>Seleccionar empleado</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {!hasEntry ? (
          <button
            onClick={handleClockIn}
            disabled={loading || !selectedId}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            <Play size={16} /> Entrada
          </button>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200"
          >
            <Play size={16} /> Entrada {todayRecord?.entry_time?.slice(0, 5)}
          </button>
        )}

        {!hasExit && hasEntry ? (
          <button
            onClick={() => onClockOut(selectedId)}
            disabled={loading || !selectedId}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            <Square size={16} /> Salida
          </button>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 text-zinc-400 rounded-lg text-sm font-medium"
          >
            <Square size={16} /> {todayRecord?.exit_time ? `Salida ${todayRecord.exit_time.slice(0, 5)}` : 'Salida'}
          </button>
        )}

        {!onBreak && hasEntry && !hasExit ? (
          <button
            onClick={() => onBreakStart(selectedId)}
            disabled={loading || !selectedId}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-40 transition-colors"
          >
            <Coffee size={16} /> Descanso
          </button>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 text-zinc-400 rounded-lg text-sm font-medium"
          >
            <Coffee size={16} /> {onBreak ? 'En descanso' : 'Descanso'}
          </button>
        )}

        {onBreak ? (
          <button
            onClick={() => onBreakEnd(selectedId)}
            disabled={loading || !selectedId}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            <CoffeeOff size={16} /> Volver
          </button>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 text-zinc-400 rounded-lg text-sm font-medium"
          >
            <CoffeeOff size={16} /> Volver
          </button>
        )}
      </div>
    </div>
  )
}

function ClockIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
