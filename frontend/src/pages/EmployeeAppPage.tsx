import { useEffect, useState, useCallback, useRef } from 'react'
import { Clock, MapPin, AlertTriangle, QrCode, RefreshCw, Navigation, Timer, Coffee, Bell } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'

interface Props {
  employeeId: number
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function EmployeeAppPage({ employeeId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(new Date())
  const [geoStatus, setGeoStatus] = useState<{ inside: boolean; distance?: number; location?: string } | null>(null)
  const [showQR, setShowQR] = useState(false)
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null)
  const [requestingLocation, setRequestingLocation] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  const [workSeconds, setWorkSeconds] = useState(0)
  const [breakSeconds, setBreakSeconds] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pendingScan, setPendingScan] = useState<{ scanId: number } | null>(null)
  const lastTickRef = useRef<number>(Date.now())
  const initializedRef = useRef(false)
  const dismissedScansRef = useRef<Set<number>>(new Set())

  const requestLocation = useCallback(async () => {
    setRequestingLocation(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
      })
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      setLocationGranted(true)
    } catch {
      setLocationGranted(false)
    }
    setRequestingLocation(false)
  }, [])

  useEffect(() => {
    requestLocation()
  }, [])

  const loadData = async () => {
    try {
      const d = await api.employees.appData(employeeId)
      setData(d)
      setError('')
    } catch (e: any) {
      setError(e.message || 'Error al cargar datos')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (locationGranted) loadData()
  }, [locationGranted])

  useEffect(() => {
    if (!locationGranted) return
    const checkPending = async () => {
      try {
        const res = await api.attendance.getPendingScan(employeeId)
        if (res.pending && !pendingScan && !dismissedScansRef.current.has(res.scan_id)) {
          setPendingScan({ scanId: res.scan_id })
        }
      } catch {}
    }
    checkPending()
    const interval = setInterval(checkPending, 3000)
    return () => clearInterval(interval)
  }, [locationGranted, employeeId])

  const respondToScan = async (action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') => {
    if (!pendingScan) return
    setActionLoading(action)
    try {
      await api.attendance.respondPendingScan(pendingScan.scanId, action, employeeId)
      const labels: Record<string, string> = {
        clock_in: 'Entrada registrada',
        clock_out: 'Salida registrada',
        break_start: 'Descanso iniciado',
        break_end: 'Descanso finalizado',
      }
      setActionResult({ type: 'success', message: labels[action] })
      setPendingScan(null)
      initializedRef.current = false
      await loadData()
    } catch (e: any) {
      setActionResult({ type: 'error', message: e.message || 'Error al registrar' })
    }
    setActionLoading('')
    setTimeout(() => setActionResult(null), 4000)
  }

  useEffect(() => {
    if (!data?.active_session_id || !coords) return
    checkGeofence()
    const interval = setInterval(checkGeofence, 30000)
    return () => clearInterval(interval)
  }, [data?.active_session_id, coords])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!data?.active_session_id || !data?.today_record) {
      initializedRef.current = false
      return
    }

    const rec = data.today_record
    if (!rec?.entry_time) return

    if (!initializedRef.current) {
      const nowMs = Date.now()
      const parts = rec.entry_time.split(':').map(Number)
      const today = new Date()
      const entryDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parts[0], parts[1], parts[2] || 0)
      const totalElapsed = Math.max(0, Math.floor((nowMs - entryDate.getTime()) / 1000))

      let breakTotal = 0
      if (rec.break_start) {
        const bp = rec.break_start.split(':').map(Number)
        const breakStartDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), bp[0], bp[1], bp[2] || 0)
        if (rec.break_end) {
          const bep = rec.break_end.split(':').map(Number)
          const breakEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), bep[0], bep[1], bep[2] || 0)
          breakTotal = Math.floor((breakEndDate.getTime() - breakStartDate.getTime()) / 1000)
        } else {
          breakTotal = Math.floor((nowMs - breakStartDate.getTime()) / 1000)
        }
      }

      const onBreak = !!rec.break_start && !rec.break_end
      const insidePerimeter = geoStatus?.inside ?? true

      const worked = Math.max(0, totalElapsed - breakTotal)
      setWorkSeconds(worked)
      setBreakSeconds(breakTotal)
      setIsPaused(!insidePerimeter && !onBreak)
      lastTickRef.current = nowMs
      initializedRef.current = true
    }
  }, [data?.active_session_id, data?.today_record, geoStatus?.inside])

  useEffect(() => {
    if (!data?.active_session_id) return

    const tick = setInterval(() => {
      const nowMs = Date.now()
      const delta = Math.floor((nowMs - lastTickRef.current) / 1000)
      lastTickRef.current = nowMs

      if (delta <= 0 || delta > 10) return

      const onBreak = data?.today_record?.break_start && !data?.today_record?.break_end
      const inside = geoStatus?.inside ?? false

      if (onBreak) {
        setBreakSeconds(prev => prev + delta)
        setIsPaused(false)
      } else if (inside) {
        setWorkSeconds(prev => prev + delta)
        setIsPaused(false)
      } else {
        setIsPaused(true)
      }
    }, 1000)

    return () => clearInterval(tick)
  }, [data?.active_session_id, geoStatus?.inside, data?.today_record?.break_start, data?.today_record?.break_end])

  const checkGeofence = async () => {
    if (!coords) return
    try {
      const result = await api.geofence.check(coords.lat, coords.lng, employeeId)
      setGeoStatus({
        inside: result.inside,
        distance: result.distance_meters,
        location: result.work_location?.name || null,
      })
    } catch {
      setGeoStatus(null)
    }
  }

  if (locationGranted === null || requestingLocation) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="animate-spin w-10 h-10 border-2 border-zinc-300 border-t-zinc-900 rounded-full mx-auto mb-4" />
          <p className="text-zinc-600 font-medium">Solicitando acceso a ubicacion...</p>
          <p className="text-xs text-zinc-400 mt-2">Necesitamos tu ubicacion para verificar que este dentro del perimetro de trabajo</p>
        </div>
      </div>
    )
  }

  if (locationGranted === false) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="p-4 bg-red-100 rounded-full mx-auto mb-4 w-fit">
            <Navigation size={32} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-800 mb-2">Ubicacion requerida</h2>
          <p className="text-sm text-zinc-500 mb-6">
            Debes permitir el acceso a tu ubicacion para usar esta aplicacion.
          </p>
          <button
            onClick={requestLocation}
            disabled={requestingLocation}
            className="w-full px-6 py-3 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            {requestingLocation ? 'Solicitando...' : 'Permitir ubicacion'}
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-3" />
          <p className="text-zinc-600 font-medium">{error}</p>
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm">Reintentar</button>
        </div>
      </div>
    )
  }

  const emp = data?.employee
  const rec = data?.today_record
  const hours = data?.total_hours_today || 0
  const onBreak = !!rec?.break_start && !rec?.break_end
  const hasSession = !!data?.active_session_id
  const hasEntry = !!rec?.entry_time

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-800">{emp?.name}</h1>
            <p className="text-xs text-zinc-400">{emp?.position || 'Empleado'}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-600">
              <MapPin size={12} />
              <span className="text-[10px] font-medium">GPS</span>
            </div>
            <button onClick={() => setShowQR(!showQR)} className="p-2 rounded-lg bg-zinc-900 text-white">
              <QrCode size={18} />
            </button>
          </div>
        </div>

        {showQR && (
          <div className="bg-white rounded-xl border border-zinc-200 p-6 flex flex-col items-center gap-3">
            <QRCodeSVG value={`AS:${emp?.id}`} size={180} level="H" />
            <p className="text-xs text-zinc-400">ID: {emp?.id} — Tu codigo QR</p>
          </div>
        )}

        {pendingScan && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full flex flex-col items-center gap-4 shadow-xl">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Bell size={32} className="text-amber-600 animate-bounce" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-zinc-800">Escaneo detectado</h2>
                <p className="text-sm text-zinc-500 mt-1">Que deseas registrar?</p>
              </div>
              <div className="w-full flex flex-col gap-2">
                {!hasEntry && (
                  <button
                    onClick={() => respondToScan('clock_in')}
                    disabled={!!actionLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-40"
                  >
                    Registrar entrada
                  </button>
                )}
                {hasEntry && hasSession && !onBreak && (
                  <>
                    <button
                      onClick={() => respondToScan('break_start')}
                      disabled={!!actionLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-40"
                    >
                      Iniciar descanso
                    </button>
                    <button
                      onClick={() => respondToScan('clock_out')}
                      disabled={!!actionLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-40"
                    >
                      Registrar salida
                    </button>
                  </>
                )}
                {onBreak && (
                  <button
                    onClick={() => respondToScan('break_end')}
                    disabled={!!actionLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
                  >
                    Finalizar descanso
                  </button>
                )}
                {actionLoading && (
                  <div className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-100 text-zinc-400 rounded-xl text-sm">
                    <div className="animate-spin w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
                    Registrando...
                  </div>
                )}
                {!actionLoading && (
                  <button
                    onClick={() => {
                      dismissedScansRef.current.add(pendingScan.scanId)
                      api.attendance.dismissPendingScan(pendingScan.scanId, employeeId).catch(() => {})
                      setPendingScan(null)
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-zinc-400 text-sm hover:text-zinc-600 transition-colors"
                  >
                    Cerrar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <Clock size={20} className="text-zinc-900" />
            <span className="text-3xl font-mono font-semibold text-zinc-900 tabular-nums">
              {now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-zinc-400 ml-8">{now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {hasSession && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Timer size={16} className="text-green-600" />
                  <span className="text-xs font-medium text-green-600">Trabajo</span>
                </div>
                <p className="text-2xl font-mono font-bold text-green-700 tabular-nums">
                  {formatTime(workSeconds)}
                </p>
                {isPaused && (
                  <span className="text-[10px] text-amber-500 font-medium mt-1 inline-block">PAUSADO</span>
                )}
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Coffee size={16} className="text-orange-500" />
                  <span className="text-xs font-medium text-orange-500">Descanso</span>
                </div>
                <p className="text-2xl font-mono font-bold text-orange-600 tabular-nums">
                  {formatTime(breakSeconds)}
                </p>
                {onBreak && (
                  <span className="text-[10px] text-orange-400 font-medium mt-1 inline-block animate-pulse">EN DESCANSO</span>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-100 text-center">
              <span className="text-[10px] text-zinc-400">
                {!geoStatus?.inside ? 'Fuera del perimetro — tiempo no registrado' :
                 onBreak ? 'Descanso activo — tiempo de trabajo en pausa' :
                 'Contando horas de trabajo'}
              </span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-zinc-600">Resumen del dia</span>
            <span className="text-2xl font-bold text-zinc-900 tabular-nums">{hours.toFixed(2)}h</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-zinc-50 rounded-lg p-2">
              <p className="text-zinc-400">Entrada</p>
              <p className="font-medium text-zinc-700">{rec?.entry_time ? rec.entry_time.slice(0, 5) : '—'}</p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-2">
              <p className="text-zinc-400">Salida</p>
              <p className="font-medium text-zinc-700">{rec?.exit_time ? rec.exit_time.slice(0, 5) : '—'}</p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-2">
              <p className="text-zinc-400">Descanso</p>
              <p className="font-medium text-zinc-700">{onBreak ? 'Activo' : rec?.break_end ? 'Finalizado' : '—'}</p>
            </div>
          </div>
          {rec?.late && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              <AlertTriangle size={14} /> Llegada tarde registrada
            </div>
          )}
        </div>

        {hasSession && (
          <div className={`rounded-xl border p-4 ${geoStatus?.inside ? 'bg-green-50 border-green-200' : geoStatus ? 'bg-red-50 border-red-200' : 'bg-zinc-50 border-zinc-200'}`}>
            <div className="flex items-center gap-2">
              <MapPin size={16} className={geoStatus?.inside ? 'text-green-600' : 'text-red-500'} />
              <span className={`text-sm font-medium ${geoStatus?.inside ? 'text-green-700' : 'text-red-600'}`}>
                {geoStatus?.inside ? 'Dentro del perimetro' : geoStatus ? 'Fuera del perimetro' : 'Verificando ubicacion...'}
              </span>
            </div>
            {geoStatus && (
              <p className="text-xs text-zinc-500 mt-1 ml-6">
                {geoStatus.location && `${geoStatus.location} — `}
                {geoStatus.distance !== undefined && `${Math.round(geoStatus.distance)}m`}
              </p>
            )}
          </div>
        )}

        {actionResult && (
          <div className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium ${
            actionResult.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {actionResult.type === 'success' ? '✓' : '✕'} {actionResult.message}
          </div>
        )}

        {data?.pending_incidents > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-700">{data.pending_incidents} incidencia(s) pendiente(s)</p>
              <p className="text-xs text-amber-500">Contacta a tu supervisor</p>
            </div>
          </div>
        )}

        <button onClick={() => { loadData(); requestLocation(); initializedRef.current = false }} className="w-full flex items-center justify-center gap-2 py-2 text-zinc-400 text-xs hover:text-zinc-600">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>
    </div>
  )
}
