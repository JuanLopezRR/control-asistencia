import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Check, Loader2, Eye, RotateCcw } from 'lucide-react'
import { api } from '../api/client'
import type { Employee } from '../types'

interface Props {
  employee: Employee
  onClose: () => void
  onSaved: () => void
}

type Step = 'detecting' | 'capturing' | 'processing' | 'success' | 'error'

const SAMPLES_NEEDED = 5

export default function FaceCaptureModal({ employee, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('detecting')
  const [samples, setSamples] = useState<Float32Array[]>([])
  const [faceInfo, setFaceInfo] = useState('')
  const [faceDetected, setFaceDetected] = useState(false)
  const [captureFlash, setCaptureFlash] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const detectingRef = useRef(false)
  const faceapiRef = useRef<any>(null)
  const samplesRef = useRef<Float32Array[]>([])
  const lastCaptureTime = useRef(0)
  const stableFramesRef = useRef(0)

  const loadModels = async () => {
    const faceapi = await import('face-api.js')
    faceapiRef.current = faceapi
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    ])
  }

  const drawOverlay = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    detection: any,
    qualityScore: number
  ) => {
    ctx.clearRect(0, 0, width, height)

    const cx = width / 2
    const cy = height / 2
    const radiusX = width * 0.22
    const radiusY = height * 0.32

    ctx.save()

    // Face oval guide
    ctx.beginPath()
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2)
    ctx.strokeStyle = faceDetected ? `rgba(34,197,94,${0.6 + qualityScore * 0.4})` : 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 3
    ctx.setLineDash(faceDetected ? [] : [8, 6])
    ctx.stroke()
    ctx.setLineDash([])

    // Glow effect when detected
    if (faceDetected) {
      ctx.beginPath()
      ctx.ellipse(cx, cy, radiusX + 4, radiusY + 4, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(34,197,94,${qualityScore * 0.3})`
      ctx.lineWidth = 8
      ctx.stroke()
    }

    // Face box from detection
    if (detection) {
      const box = detection.detection.box
      const scaleX = width / (videoRef.current?.videoWidth || 1)
      const scaleY = height / (videoRef.current?.videoHeight || 1)
      const x = box.x * scaleX
      const y = box.y * scaleY
      const w = box.width * scaleX
      const h = box.height * scaleY

      ctx.strokeStyle = faceDetected ? '#22c55e' : 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, w, h)

      // Corner markers
      const cornerLen = Math.min(w, h) * 0.2
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 3
      // Top-left
      ctx.beginPath()
      ctx.moveTo(x, y + cornerLen)
      ctx.lineTo(x, y)
      ctx.lineTo(x + cornerLen, y)
      ctx.stroke()
      // Top-right
      ctx.beginPath()
      ctx.moveTo(x + w - cornerLen, y)
      ctx.lineTo(x + w, y)
      ctx.lineTo(x + w, y + cornerLen)
      ctx.stroke()
      // Bottom-left
      ctx.beginPath()
      ctx.moveTo(x, y + h - cornerLen)
      ctx.lineTo(x, y + h)
      ctx.lineTo(x + cornerLen, y + h)
      ctx.stroke()
      // Bottom-right
      ctx.beginPath()
      ctx.moveTo(x + w - cornerLen, y + h)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x + w, y + h - cornerLen)
      ctx.stroke()
    }

    // Quality arc at bottom
    if (faceDetected && qualityScore > 0) {
      const arcRadius = 30
      const arcY = height - 50
      ctx.beginPath()
      ctx.arc(cx, arcY, arcRadius, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 4
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, arcY, arcRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * qualityScore)
      ctx.strokeStyle = qualityScore > 0.7 ? '#22c55e' : qualityScore > 0.4 ? '#eab308' : '#ef4444'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.stroke()

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${Math.round(qualityScore * 100)}%`, cx, arcY)
    }

    ctx.restore()
  }

  const calculateQuality = (detection: any, videoWidth: number, videoHeight: number): number => {
    if (!detection) return 0
    const box = detection.detection.box
    const score = detection.detection.score

    // Size quality: face should be 20-50% of frame
    const faceArea = box.width * box.height
    const frameArea = videoWidth * videoHeight
    const sizeRatio = faceArea / frameArea
    const sizeQuality = sizeRatio > 0.2 && sizeRatio < 0.5
      ? 1
      : sizeRatio > 0.1 && sizeRatio < 0.6
        ? 0.7
        : 0.3

    // Center quality: face should be centered
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const dx = (cx - videoWidth / 2) / (videoWidth / 2)
    const dy = (cy - videoHeight / 2) / (videoHeight / 2)
    const centerDist = Math.sqrt(dx * dx + dy * dy)
    const centerQuality = Math.max(0, 1 - centerDist)

    // Detection confidence
    const confQuality = score

    return sizeQuality * 0.35 + centerQuality * 0.35 + confQuality * 0.3
  }

  const detectLoop = useCallback(async () => {
    if (!faceapiRef.current) {
      rafRef.current = requestAnimationFrame(detectLoop)
      return
    }
    if (detectingRef.current) {
      rafRef.current = requestAnimationFrame(detectLoop)
      return
    }

    const video = videoRef.current
    if (!video || video.readyState !== 4) {
      rafRef.current = requestAnimationFrame(detectLoop)
      return
    }

    detectingRef.current = true
    try {
      const faceapi = faceapiRef.current
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptor()

      const overlayCanvas = overlayCanvasRef.current
      if (overlayCanvas && video) {
        overlayCanvas.width = video.videoWidth
        overlayCanvas.height = video.videoHeight
        const ctx = overlayCanvas.getContext('2d')
        if (ctx) {
          const q = calculateQuality(detection, video.videoWidth, video.videoHeight)
          drawOverlay(ctx, video.videoWidth, video.videoHeight, detection, q)
        }
      }

      if (detection) {
        setFaceDetected(true)
        const q = calculateQuality(detection, video.videoWidth, video.videoHeight)

        if (q > 0.65) {
          setFaceInfo('Cara bien posicionada')
          stableFramesRef.current++
        } else if (q > 0.4) {
          setFaceInfo('Ajusta la posición')
          stableFramesRef.current = 0
        } else {
          setFaceInfo('Centra tu cara en el óvalo')
          stableFramesRef.current = 0
        }

        // Auto-capture every ~1.5s when quality is good
        if (q > 0.65 && stableFramesRef.current >= 3) {
          const now = Date.now()
          if (now - lastCaptureTime.current > 1500 && samplesRef.current.length < SAMPLES_NEEDED) {
            lastCaptureTime.current = now
            stableFramesRef.current = 0
            const descriptor = Array.from(detection.descriptor as Float32Array)
            samplesRef.current.push(new Float32Array(descriptor))
            setSamples([...samplesRef.current])

            // Flash effect
            setCaptureFlash(true)
            setTimeout(() => setCaptureFlash(false), 200)

            if (samplesRef.current.length >= SAMPLES_NEEDED) {
              await processSamples()
            }
          }
        }
      } else {
        setFaceDetected(false)
        setFaceInfo('Posiciona tu cara en el óvalo')
        stableFramesRef.current = 0
      }
    } catch (e) {
      console.error('Detection error:', e)
    }
    detectingRef.current = false

    rafRef.current = requestAnimationFrame(detectLoop)
  }, [])

  const processSamples = async () => {
    setStep('processing')
    cancelAnimationFrame(rafRef.current)

    try {
      // Average the descriptors for better accuracy
      const allSamples = samplesRef.current
      const len = allSamples[0].length
      const avg = new Float32Array(len)
      for (const sample of allSamples) {
        for (let i = 0; i < len; i++) {
          avg[i] += sample[i]
        }
      }
      for (let i = 0; i < len; i++) {
        avg[i] /= allSamples.length
      }

      const descriptor = JSON.stringify(Array.from(avg))
      await api.employees.registerFace(employee.id, descriptor)
      setStep('success')
      setTimeout(() => {
        onSaved()
        onClose()
      }, 2000)
    } catch (err: any) {
      setFaceInfo('Error: ' + err.message)
      setStep('error')
    }
  }

  const startCamera = async () => {
    try {
      await loadModels()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setStep('detecting')
      rafRef.current = requestAnimationFrame(detectLoop)
    } catch (err: any) {
      setFaceInfo('No se pudo acceder a la cámara: ' + err.message)
      setStep('error')
    }
  }

  const resetCapture = () => {
    samplesRef.current = []
    setSamples([])
    setFaceDetected(false)
    stableFramesRef.current = 0
    lastCaptureTime.current = 0
    setStep('detecting')
    rafRef.current = requestAnimationFrame(detectLoop)
  }

  const handleClose = () => {
    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    onClose()
  }

  useEffect(() => {
    startCamera()
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const stepLabel = step === 'detecting'
    ? 'Detectando rostro...'
    : step === 'capturing'
      ? `Capturando muestras (${samples.length}/${SAMPLES_NEEDED})`
      : step === 'processing'
        ? 'Procesando...'
        : step === 'success'
          ? '¡Cara registrada!'
          : 'Error'

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h3 className="font-semibold text-white text-lg">Registrar rostro</h3>
            <p className="text-sm text-zinc-400">{employee.name}</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Camera area */}
        <div className="relative aspect-[4/3] bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Capture flash */}
          {captureFlash && (
            <div className="absolute inset-0 bg-white/30 animate-pulse pointer-events-none" />
          )}

          {/* Steps indicator */}
          <div className="absolute top-4 left-4 right-4 flex items-center gap-2">
            {Array.from({ length: SAMPLES_NEEDED }).map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-white/20">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    i < samples.length ? 'bg-green-400' : i === samples.length && step === 'detecting' ? 'bg-white/40 animate-pulse' : ''
                  }`}
                  style={{ width: i < samples.length ? '100%' : '0%' }}
                />
              </div>
            ))}
          </div>

          {/* Status overlay */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3">
              {step === 'success' ? (
                <Check size={20} className="text-green-400 flex-shrink-0" />
              ) : step === 'processing' ? (
                <Loader2 size={20} className="text-blue-400 animate-spin flex-shrink-0" />
              ) : step === 'error' ? (
                <X size={20} className="text-red-400 flex-shrink-0" />
              ) : (
                <Eye size={20} className={`${faceDetected ? 'text-green-400' : 'text-zinc-400'} flex-shrink-0`} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{stepLabel}</p>
                {faceInfo && step === 'detecting' && (
                  <p className="text-xs text-zinc-400 truncate">{faceInfo}</p>
                )}
              </div>
              {samples.length > 0 && step !== 'success' && (
                <span className="text-xs font-mono text-green-400">{samples.length}/{SAMPLES_NEEDED}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            {step === 'detecting'
              ? 'Mira directamente a la cámara'
              : step === 'success'
                ? 'Listo para usar el escáneo facial'
                : `${samples.length} de ${SAMPLES_NEEDED} muestras capturadas`}
          </p>
          <div className="flex gap-2">
            {step === 'error' && (
              <button
                onClick={resetCapture}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
              >
                <RotateCcw size={14} /> Reintentar
              </button>
            )}
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
