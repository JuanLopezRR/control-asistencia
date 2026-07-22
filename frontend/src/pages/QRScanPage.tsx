import { useEffect, useState, useRef } from 'react'
import { ScanLine, Camera, CameraOff, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { api } from '../api/client'
import { getGeoAndWifi } from '../utils/location'

export default function QRScanPage() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'late'; message: string; employee?: string; time?: string } | null>(null)
  const [cameraError, setCameraError] = useState('')
  const scannerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const startScanner = async () => {
    setResult(null)
    setCameraError('')

    try {
      const { Html5Qrcode } = await import('html5-qrcode')

      if (scannerRef.current) {
        try { await scannerRef.current.stop() } catch {}
        scannerRef.current = null
      }

      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          const empId = parseInt(decodedText.replace('AS:', ''))
          if (isNaN(empId)) return

          try { await scanner.stop() } catch {}
          setScanning(false)

          try {
            const lateCheck = await api.attendance.checkLate(empId)
            const justification = lateCheck.is_late ? 'Escaneo QR - Tarde' : undefined
            const extras = await getGeoAndWifi()
            await api.attendance.clockIn(empId, justification, extras)

            const emp = await api.employees.get(empId)
            setResult({
              type: lateCheck.is_late ? 'late' : 'success',
              message: lateCheck.is_late ? 'Entrada registrada (TARDE)' : 'Entrada registrada',
              employee: emp.name,
              time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            })
          } catch (e: any) {
            setResult({ type: 'error', message: e.message || 'Error al registrar' })
          }

          setTimeout(() => setResult(null), 4000)
        },
        () => {}
      )
      setScanning(true)
    } catch (err: any) {
      setCameraError(err.message || 'No se pudo acceder a la cámara')
      setScanning(false)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    setScanning(false)
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop() } catch {}
      }
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">Escaneo QR</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Escanea el código QR del empleado para registrar entrada</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-zinc-200 p-6 flex flex-col items-center">
          <div
            id="qr-reader"
            ref={containerRef}
            className="w-full max-w-sm rounded-xl overflow-hidden mb-4"
            style={{ minHeight: scanning ? 300 : 0 }}
          />

          {!scanning ? (
            <button
              onClick={startScanner}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              <Camera size={18} /> Iniciar escáner
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <CameraOff size={18} /> Detener
            </button>
          )}

          {cameraError && (
            <p className="mt-3 text-sm text-red-500 text-center">{cameraError}</p>
          )}
        </div>

        <div className="flex flex-col items-center justify-center">
          {result ? (
            <div className={`flex flex-col items-center gap-3 p-8 rounded-2xl border-2 ${
              result.type === 'success' ? 'border-green-300 bg-green-50' :
              result.type === 'late' ? 'border-amber-300 bg-amber-50' :
              'border-red-300 bg-red-50'
            }`}>
              {result.type === 'success' && <CheckCircle2 size={64} className="text-green-500" />}
              {result.type === 'late' && <Clock size={64} className="text-amber-500" />}
              {result.type === 'error' && <XCircle size={64} className="text-red-500" />}

              <h2 className={`text-2xl font-bold ${
                result.type === 'success' ? 'text-green-700' :
                result.type === 'late' ? 'text-amber-700' :
                'text-red-700'
              }`}>
                {result.message}
              </h2>

              {result.employee && (
                <p className="text-lg font-medium text-zinc-700">{result.employee}</p>
              )}
              {result.time && (
                <p className="text-sm text-zinc-500">{result.time}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-zinc-300">
              <ScanLine size={80} />
              <p className="text-sm text-zinc-400 text-center">
                Presiona "Iniciar escáner" y apunta la cámara<br />al código QR del empleado
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
