import { useEffect, useState, useRef, useCallback } from 'react'
import { UserCheck, UserX, Clock, ScanLine, AlertCircle, LogOut, Coffee, LogIn, Power } from 'lucide-react'
import { api } from '../api/client'
import { getGeoAndWifi } from '../utils/location'

type EmployeeStatus = 'none' | 'working' | 'on_break'

interface ScanAction {
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  label: string
  icon: any
  color: string
}

export default function FaceScanPage() {
  const [status, setStatus] = useState<'idle' | 'loading-models' | 'ready' | 'scanning' | 'error'>('idle')
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'late'; message: string; employee?: string; time?: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [matchInfo, setMatchInfo] = useState('')
  const [pendingAction, setPendingAction] = useState<{ empId: number; empName: string; actions: ScanAction[] } | null>(null)
  const [lastEvent, setLastEvent] = useState<{ employee: string; action: string; time: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const knownFacesRef = useRef<{ id: number; name: string; descriptor: Float32Array }[]>([])
  const faceapiRef = useRef<any>(null)
  const detectingRef = useRef(false)
  const scanActiveRef = useRef(false)
  const matchCountRef = useRef(0)
  const processingRef = useRef(false)
  const kioskModeRef = useRef(true)

  const getActionsForStatus = (status: EmployeeStatus, hasEntry: boolean): ScanAction[] => {
    if (status === 'none' || !hasEntry) {
      return [{ type: 'clock_in', label: 'Registrar entrada', icon: LogIn, color: 'green' }]
    }
    if (status === 'on_break') {
      return [{ type: 'break_end', label: 'Finalizar descanso', icon: Coffee, color: 'blue' }]
    }
    return [
      { type: 'break_start', label: 'Iniciar descanso', icon: Coffee, color: 'amber' },
      { type: 'clock_out', label: 'Registrar salida', icon: LogOut, color: 'red' },
    ]
  }

  const resumeScanning = useCallback(() => {
    setTimeout(() => {
      setResult(null)
      setPendingAction(null)
      processingRef.current = false
      matchCountRef.current = 0
      setMatchInfo('')
      if (kioskModeRef.current && !scanActiveRef.current) {
        scanActiveRef.current = true
        setStatus('scanning')
        rafRef.current = requestAnimationFrame(detectLoop)
      }
    }, 3000)
  }, [])

  const executeAction = async (empId: number, action: ScanAction, empName: string) => {
    setPendingAction(null)
    processingRef.current = true

    try {
      const extras = await getGeoAndWifi()
      let actionLabel = ''

      if (action.type === 'clock_in') {
        const lateCheck = await api.attendance.checkLate(empId)
        const justification = lateCheck.is_late ? 'Reconocimiento facial - Tarde' : undefined
        await api.attendance.clockIn(empId, justification, extras)
        actionLabel = lateCheck.is_late ? 'Entrada (TARDE)' : 'Entrada'
        setResult({
          type: lateCheck.is_late ? 'late' : 'success',
          message: lateCheck.is_late ? 'Entrada registrada (TARDE)' : 'Entrada registrada',
          employee: empName,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })
      } else if (action.type === 'clock_out') {
        await api.attendance.clockOut(empId)
        actionLabel = 'Salida'
        setResult({
          type: 'success',
          message: 'Salida registrada',
          employee: empName,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })
      } else if (action.type === 'break_start') {
        await api.attendance.breakStart(empId)
        actionLabel = 'Descanso iniciado'
        setResult({
          type: 'success',
          message: 'Descanso iniciado',
          employee: empName,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })
      } else if (action.type === 'break_end') {
        await api.attendance.breakEnd(empId)
        actionLabel = 'Descanso finalizado'
        setResult({
          type: 'success',
          message: 'Descanso finalizado',
          employee: empName,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })
      }

      setLastEvent({
        employee: empName,
        action: actionLabel,
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      })
    } catch (e: any) {
      setResult({ type: 'error', message: e.message || 'Error al registrar' })
    }

    processingRef.current = false
    if (kioskModeRef.current) {
      resumeScanning()
    } else {
      setTimeout(() => setResult(null), 5000)
    }
  }

  const loadModels = useCallback(async () => {
    setStatus('loading-models')
    setErrorMsg('')
    try {
      const faceapi = await import('face-api.js')
      faceapiRef.current = faceapi
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ])
      setStatus('ready')
    } catch (err: any) {
      setErrorMsg('Error cargando modelos: ' + err.message)
      setStatus('error')
    }
  }, [])

  const loadKnownFaces = async () => {
    try {
      const faces = await api.attendance.getAllFaces()
      knownFacesRef.current = faces.map((f: any) => ({
        id: f.id,
        name: f.name,
        descriptor: new Float32Array(JSON.parse(f.descriptor)),
      }))
      return knownFacesRef.current.length
    } catch {
      knownFacesRef.current = []
      return 0
    }
  }

  const findBestMatch = (descriptor: Float32Array) => {
    let best: { id: number; name: string; distance: number } | null = null
    let bestDist = 0.6
    for (const known of knownFacesRef.current) {
      let sum = 0
      for (let i = 0; i < descriptor.length; i++) {
        sum += (descriptor[i] - known.descriptor[i]) ** 2
      }
      const dist = Math.sqrt(sum)
      if (dist < bestDist) {
        bestDist = dist
        best = { id: known.id, name: known.name, distance: dist }
      }
    }
    return best
  }

  const detectLoop = useCallback(async () => {
    if (!scanActiveRef.current) return
    if (detectingRef.current) {
      rafRef.current = requestAnimationFrame(detectLoop)
      return
    }

    const video = videoRef.current
    if (!video || video.readyState !== 4 || !faceapiRef.current) {
      rafRef.current = requestAnimationFrame(detectLoop)
      return
    }

    detectingRef.current = true
    try {
      const faceapi = faceapiRef.current
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptors()

      const canvas = canvasRef.current
      if (canvas && video) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          const dims = faceapi.matchDimensions(canvas, { width: video.videoWidth, height: video.videoHeight }, true)
          const resized = faceapi.resizeResults(detections, dims)
          for (const det of resized) {
            const box = det.detection.box
            ctx.strokeStyle = '#22c55e'
            ctx.lineWidth = 2
            ctx.strokeRect(box.x, box.y, box.width, box.height)
          }
        }
      }

      if (detections.length > 0) {
        const match = findBestMatch(detections[0].descriptor)
        if (match) {
          matchCountRef.current += 1
          setMatchInfo(`Cara detectada: ${match.name} (${matchCountRef.current}/2)`)
          if (matchCountRef.current >= 2) {
            scanActiveRef.current = false
            if (processingRef.current) return

            try {
              const appData = await api.employees.appData(match.id)
              const empName = appData.employee?.name || match.name
              const hasSession = !!appData.active_session_id
              const onBreak = !!appData.today_record?.break_start && !appData.today_record?.break_end
              const hasEntry = !!appData.today_record?.entry_time

              let empStatus: EmployeeStatus = 'none'
              if (hasSession && onBreak) empStatus = 'on_break'
              else if (hasSession) empStatus = 'working'

              const actions = getActionsForStatus(empStatus, hasEntry)

              if (actions.length === 1) {
                await executeAction(match.id, actions[0], empName)
              } else {
                processingRef.current = false
                setPendingAction({ empId: match.id, empName, actions })
              }
            } catch (e: any) {
              processingRef.current = false
              setResult({ type: 'error', message: e.message })
              if (kioskModeRef.current) {
                resumeScanning()
              } else {
                setTimeout(() => setResult(null), 3000)
              }
            }
          }
        } else {
          matchCountRef.current = 0
          setMatchInfo(detections.length > 0 ? 'Cara detectada pero no coincide' : '')
        }
      } else {
        matchCountRef.current = 0
        setMatchInfo('')
      }
    } catch (e) {
      console.error('Detection error:', e)
    }
    detectingRef.current = false

    if (scanActiveRef.current) {
      rafRef.current = requestAnimationFrame(detectLoop)
    }
  }, [])

  const startScanning = async () => {
    setResult(null)
    setErrorMsg('')
    setMatchInfo('')
    setPendingAction(null)
    matchCountRef.current = 0

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setStatus('scanning')
      scanActiveRef.current = true
    } catch (err: any) {
      setErrorMsg('No se pudo acceder a la cámara: ' + err.message)
      setStatus('error')
      return
    }

    if (!faceapiRef.current) {
      await loadModels()
      if (!faceapiRef.current) return
    }

    const count = await loadKnownFaces()
    if (count === 0) {
      setErrorMsg('No hay empleados con cara registrada.')
      scanActiveRef.current = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      setStatus('ready')
      return
    }

    rafRef.current = requestAnimationFrame(detectLoop)
  }

  const stopScanning = useCallback(() => {
    kioskModeRef.current = false
    scanActiveRef.current = false
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    matchCountRef.current = 0
    setMatchInfo('')
    setStatus('ready')
  }, [])

  const toggleKioskMode = async () => {
    if (kioskModeRef.current) {
      stopScanning()
    } else {
      kioskModeRef.current = true
      await startScanning()
    }
  }

  useEffect(() => {
    const init = async () => {
      await loadModels()
      kioskModeRef.current = true
      await startScanning()
    }
    init()
    return () => {
      scanActiveRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const isScanning = status === 'scanning'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Escaneo Facial</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Reconocimiento facial automatico — entrada, salida o descanso</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            kioskModeRef.current && isScanning
              ? 'bg-green-100 text-green-700'
              : 'bg-zinc-100 text-zinc-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${kioskModeRef.current && isScanning ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
            {kioskModeRef.current && isScanning ? 'ACTIVO' : 'INACTIVO'}
          </div>
          <button
            onClick={toggleKioskMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              kioskModeRef.current
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <Power size={16} />
            {kioskModeRef.current ? 'Detener' : 'Activar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-zinc-200 p-6 flex flex-col items-center">
          <div className="relative w-full max-w-sm rounded-xl overflow-hidden bg-zinc-900" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover rounded-xl"
              style={{ display: isScanning ? 'block' : 'none', transform: 'scaleX(-1)' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
              style={{ display: isScanning ? 'block' : 'none' }}
            />
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <UserCheck size={48} className="text-zinc-600" />
                <p className="text-xs text-zinc-500 text-center px-4">
                  {status === 'loading-models' ? 'Cargando modelos...' :
                   status === 'error' ? 'Error al cargar' :
                   'Camara inactiva'}
                </p>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg max-w-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center">
          {pendingAction ? (
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-zinc-200 bg-white">
              <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
                <ScanLine size={32} className="text-zinc-600" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-zinc-800">{pendingAction.empName}</h2>
                <p className="text-sm text-zinc-400 mt-1">Que desea realizar?</p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {pendingAction.actions.map((action) => {
                  const Icon = action.icon
                  const colors = {
                    green: 'bg-green-600 hover:bg-green-700',
                    red: 'bg-red-600 hover:bg-red-700',
                    amber: 'bg-amber-600 hover:bg-amber-700',
                    blue: 'bg-blue-600 hover:bg-blue-700',
                  }
                  return (
                    <button
                      key={action.type}
                      onClick={() => executeAction(pendingAction.empId, action, pendingAction.empName)}
                      className={`flex items-center justify-center gap-2 px-6 py-3 ${colors[action.color as keyof typeof colors]} text-white rounded-xl text-sm font-medium transition-colors`}
                    >
                      <Icon size={18} /> {action.label}
                    </button>
                  )
                })}
                <button
                  onClick={() => {
                    setPendingAction(null)
                    matchCountRef.current = 0
                    setMatchInfo('')
                    processingRef.current = false
                    if (kioskModeRef.current) {
                      scanActiveRef.current = true
                      setStatus('scanning')
                      rafRef.current = requestAnimationFrame(detectLoop)
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-2 text-zinc-400 text-sm hover:text-zinc-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : result ? (
            <div className={`flex flex-col items-center gap-3 p-8 rounded-2xl border-2 ${
              result.type === 'success' ? 'border-green-300 bg-green-50' :
              result.type === 'late' ? 'border-amber-300 bg-amber-50' :
              'border-red-300 bg-red-50'
            }`}>
              {result.type === 'success' && <UserCheck size={64} className="text-green-500" />}
              {result.type === 'late' && <Clock size={64} className="text-amber-500" />}
              {result.type === 'error' && <UserX size={64} className="text-red-500" />}
              <h2 className={`text-2xl font-bold ${
                result.type === 'success' ? 'text-green-700' :
                result.type === 'late' ? 'text-amber-700' : 'text-red-700'
              }`}>{result.message}</h2>
              {result.employee && <p className="text-lg font-medium text-zinc-700">{result.employee}</p>}
              {result.time && <p className="text-sm text-zinc-500">{result.time}</p>}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <ScanLine size={80} className={isScanning ? 'text-green-400 animate-pulse' : 'text-zinc-300'} />
              <div>
                <p className="text-sm text-zinc-500">
                  {isScanning ? 'Buscando rostros... Mira a la camara' :
                   status === 'loading-models' ? 'Cargando modelos de IA...' :
                   'Camara inactiva'}
                </p>
                {isScanning && (
                  <>
                    <p className="text-xs text-zinc-400 mt-1">
                      {knownFacesRef.current.length} empleado(s) registrado(s)
                    </p>
                    {matchInfo && (
                      <p className="text-xs text-green-600 mt-1 font-medium">{matchInfo}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {lastEvent && (
            <div className="mt-6 w-full max-w-sm bg-zinc-50 rounded-xl border border-zinc-100 p-4">
              <p className="text-[10px] text-zinc-400 uppercase font-medium mb-2">Ultimo registro</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-700">{lastEvent.employee}</p>
                  <p className="text-xs text-zinc-500">{lastEvent.action}</p>
                </div>
                <p className="text-xs text-zinc-400">{lastEvent.time}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
