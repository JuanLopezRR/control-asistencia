import { useEffect, useState, useCallback } from 'react'
import { Clock, MapPin, AlertTriangle, QrCode, RefreshCw, Navigation } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'

interface Props {
  employeeId: number
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
          <p className="text-zinc-600 font-medium">Solicitando acceso a ubicación...</p>
          <p className="text-xs text-zinc-400 mt-2">Necesitamos tu ubicación para verificar que estés dentro del perímetro de trabajo</p>
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
          <h2 className="text-lg font-semibold text-zinc-800 mb-2">Ubicación requerida</h2>
          <p className="text-sm text-zinc-500 mb-6">
            Debes permitir el acceso a tu ubicación para usar esta aplicación. Tu ubicación se usa solo para verificar que estés dentro del perímetro de trabajo.
          </p>
          <button
            onClick={requestLocation}
            disabled={requestingLocation}
            className="w-full px-6 py-3 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            {requestingLocation ? 'Solicitando...' : 'Permitir ubicación'}
          </button>
          <p className="text-xs text-zinc-400 mt-4">
            Si bloqueaste la ubicación, ve a la configuración de tu navegador y permítela para este sitio
          </p>
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
            <p className="text-xs text-zinc-400">ID: {emp?.id} — Escaneo para entrada</p>
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

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-zinc-600">Horas hoy</span>
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

        {data?.active_session_id && (
          <div className={`rounded-xl border p-4 ${geoStatus?.inside ? 'bg-green-50 border-green-200' : geoStatus ? 'bg-red-50 border-red-200' : 'bg-zinc-50 border-zinc-200'}`}>
            <div className="flex items-center gap-2">
              <MapPin size={16} className={geoStatus?.inside ? 'text-green-600' : 'text-red-500'} />
              <span className={`text-sm font-medium ${geoStatus?.inside ? 'text-green-700' : 'text-red-600'}`}>
                {geoStatus?.inside ? 'Dentro del perímetro' : geoStatus ? 'Fuera del perímetro' : 'Verificando ubicación...'}
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

        {data?.pending_incidents > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-700">{data.pending_incidents} incidencia(s) pendiente(s)</p>
              <p className="text-xs text-amber-500">Contacta a tu supervisor</p>
            </div>
          </div>
        )}

        <button onClick={() => { loadData(); requestLocation() }} className="w-full flex items-center justify-center gap-2 py-2 text-zinc-400 text-xs hover:text-zinc-600">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>
    </div>
  )
}
