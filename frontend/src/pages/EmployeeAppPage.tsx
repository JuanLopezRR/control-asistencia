import { useEffect, useState, useCallback, useRef } from 'react'
import { Clock, MapPin, AlertTriangle, QrCode, RefreshCw, Navigation, Timer, Coffee, X, Camera } from 'lucide-react'
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
  const [showScanner, setShowScanner] = useState(false)
  const lastTickRef = useRef<number>(Date.now())
  const initializedRef = useRef(false)
  const scannerRef = useRef<any>(null)
  const processingScanRef = useRef(false)

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

  const executeAction = async (action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') => {
    setActionLoading(action)
    setActionResult(null)
    try {
      const extras = coords ? { latitude: coords.lat, longitude: coords.lng } : undefined

      if (action === 'clock_in') {
        await api.attendance.clockIn(employeeId, undefined, extras)
        setActionResult({ type: 'success', message: 'Entrada registrada' })
      } else if (action === 'clock_out') {
        await api.attendance.clockOut(employeeId)
        setActionResult({ type: 'success', message: 'Salida registrada' })
      } else if (action === 'break_start') {
        await api.attendance.breakStart(employeeId)
        setActionResult({ type: 'success', message: 'Descanso iniciado' })
      } else if (action === 'break_end') {
        await api.attendance.breakEnd(employeeId)
        setActionResult({ type: 'success', message: 'Descanso finalizado' })
      }

      initializedRef.current = false
      await loadData()
    } catch (e: any) {
      setActionResult({ type: 'error', message: e.message || 'Error al registrar' })
    }
    setActionLoading('')
    stopScanner()
    setTimeout(() => setActionResult(null), 4000)
  }

  const getActionForState = (): 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | null => {
    const hasEntry = !!data?.today_record?.entry_time
    const hasSession = !!data?.active_session_id
    const onBreak = !!data?.today_record?.break_start && !data?.today_record?.break_end

    if (!hasEntry) return 'clock_in'
    if (onBreak) return 'break_end'
    if (hasSession) return 'clock_out'
    return null
  }

  const getActionLabel = (action: string): string => {
    switch (action) {
      case 'clock_in': return 'Registrar entrada'
      case 'clock_out': return 'Registrar salida'
      case 'break_start': return 'Iniciar descanso'
      case 'break_end': return 'Finalizar descanso'
      default: return ''
    }
  }

  const startScanner = async () => {
    processingScanRef.current = false
    setShowScanner(true)

    try {
      const { Html5Qrcode } = await import('html5-qrcode')

      if (scannerRef.current) {
        try { await scannerRef.current.stop() } catch {}
        scannerRef.current = null
      }

      const scanner = new Html5Qrcode('emp-qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          if (processingScanRef.current) return
          const scannedId = parseInt(decodedText.replace('AS:', ''))
          if (isNaN(scannedId)) return
          if (scannedId !== employeeId) {
            setActionResult({ type: 'error', message: 'Este QR no corresponde a tu cuenta' })
            setTimeout(() => setActionResult(null), 3000)
            return
          }

          processingScanRef.current = true
          try { await scanner.stop() } catch {}

          const action = getActionForState()
          if (action) {
            await executeAction(action)
          }
        },
        () => {}
      )
    } catch (err: any) {
      setActionResult({ type: 'error', message: 'No se pudo acceder a la camara' })
      setShowScanner(false)
      setTimeout(() => setActionResult(null), 3000)
    }
  }

  const stopScanner = () => {
    if (scannerRef.current) {
      try { scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    setShowScanner(false)
    processingScanRef.current = false
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop() } catch {}
      }
    }
  }, [])

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
            Debes permitir el acceso a tu ubicacion para usar esta aplicacion. Tu ubicacion se usa solo para verificar que este dentro del perimetro de trabajo.
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
  const pendingAction = getActionForState()

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

        {showScanner && (
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-zinc-700">Escanea tu QR</p>
              <button onClick={stopScanner} className="p-1 rounded-lg hover:bg-zinc-100">
                <X size={18} className="text-zinc-400" />
              </button>
            </div>
            <div id="emp-qr-reader" className="w-full rounded-xl overflow-hidden" style={{ minHeight: 250 }} />
            <p className="text-xs text-zinc-400 text-center mt-2">Apunta a tu codigo QR para {pendingAction ? getActionLabel(pendingAction).toLowerCase() : 'registrar'}</p>
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

        {pendingAction && !showScanner && !actionLoading && (
          <button
            onClick={startScanner}
            className="w-full flex items-center justify-center gap-2 py-4 bg-zinc-900 text-white rounded-xl text-base font-medium hover:bg-zinc-800 transition-colors"
          >
            <Camera size={22} /> Escanear QR para {getActionLabel(pendingAction).toLowerCase()}
          </button>
        )}

        {actionLoading && (
          <div className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-100 text-zinc-400 rounded-xl text-sm font-medium">
            <div className="animate-spin w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
            Registrando...
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
