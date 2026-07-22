import { useEffect, useState, useRef, useCallback } from 'react'
import { Camera, CameraOff, UserCheck, UserX, Clock, ScanLine, AlertCircle } from 'lucide-react'
import { api } from '../api/client'
import { getGeoAndWifi } from '../utils/location'

export default function FaceScanPage() {
  const [status, setStatus] = useState<'idle' | 'loading-models' | 'ready' | 'scanning' | 'error'>('idle')
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'late'; message: string; employee?: string; time?: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [matchInfo, setMatchInfo] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const knownFacesRef = useRef<{ id: number; name: string; descriptor: Float32Array }[]>([])
  const faceapiRef = useRef<any>(null)
  const detectingRef = useRef(false)
  const scanActiveRef = useRef(false)
  const matchCountRef = useRef(0)

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
          setMatchInfo(`Cara detectada: ${match.name} (${matchCountRef.current}/2) — dist: ${match.distance.toFixed(3)}`)
          if (matchCountRef.current >= 2) {
            scanActiveRef.current = false
            try {
              const lateCheck = await api.attendance.checkLate(match.id)
              const justification = lateCheck.is_late ? 'Reconocimiento facial - Tarde' : undefined
              const extras = await getGeoAndWifi()
              await api.attendance.clockIn(match.id, justification, extras)
              setResult({
                type: lateCheck.is_late ? 'late' : 'success',
                message: lateCheck.is_late ? 'Entrada registrada (TARDE)' : 'Entrada registrada',
                employee: match.name,
                time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              })
              stopScanning()
              setTimeout(() => setResult(null), 5000)
            } catch (e: any) {
              setResult({ type: 'error', message: e.message })
              setTimeout(() => setResult(null), 3000)
            }
          }
        } else {
          matchCountRef.current = 0
          setMatchInfo(detections.length > 0 ? 'Cara detectada pero no coincide con empleados registrados' : '')
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
    matchCountRef.current = 0

    // Open camera immediately
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

    // Load models and faces in background while camera is already on
    if (!faceapiRef.current) {
      await loadModels()
      if (!faceapiRef.current) return
    }

    const count = await loadKnownFaces()
    if (count === 0) {
      setErrorMsg('No hay empleados con cara registrada. Ve a Empleados → click en la cámara de cada uno.')
      scanActiveRef.current = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      setStatus('ready')
      return
    }

    // Start detection loop
    rafRef.current = requestAnimationFrame(detectLoop)
  }

  const stopScanning = useCallback(() => {
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

  useEffect(() => {
    loadModels()
    return () => {
      scanActiveRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const isScanning = status === 'scanning'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">Escaneo Facial</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Reconocimiento facial para registrar entrada</p>
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
                   'Presiona iniciar para comenzar'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            {!isScanning ? (
              <button
                onClick={startScanning}
                disabled={status === 'loading-models'}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                {status === 'loading-models' ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Cargando...</>
                ) : (
                  <><Camera size={18} /> Iniciar escáner</>
                )}
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <CameraOff size={18} /> Detener
              </button>
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
          {result ? (
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
                  {isScanning ? 'Buscando rostros... Mira a la cámara' :
                   status === 'loading-models' ? 'Cargando modelos de IA...' :
                   'Presiona "Iniciar escáner" para comenzar'}
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
        </div>
      </div>
    </div>
  )
}
