import { useEffect, useState, useRef } from 'react'
import { ScanLine, Camera, CameraOff, CheckCircle2, XCircle, Clock, LogOut, Coffee, LogIn } from 'lucide-react'
import { api } from '../api/client'
import { getGeoAndWifi } from '../utils/location'

type EmployeeStatus = 'none' | 'working' | 'on_break'

interface ScanAction {
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  label: string
  icon: any
  color: string
}

export default function QRScanPage() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'late'; message: string; employee?: string; time?: string } | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [pendingAction, setPendingAction] = useState<{ empId: number; empName: string; actions: ScanAction[] } | null>(null)
  const scannerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const processingRef = useRef(false)

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

  const executeAction = async (empId: number, action: ScanAction) => {
    setPendingAction(null)
    processingRef.current = true

    try {
      const extras = await getGeoAndWifi()

      if (action.type === 'clock_in') {
        const lateCheck = await api.attendance.checkLate(empId)
        const justification = lateCheck.is_late ? 'Escaneo QR - Tarde' : undefined
        await api.attendance.clockIn(empId, justification, extras)
        setResult({
          type: lateCheck.is_late ? 'late' : 'success',
          message: lateCheck.is_late ? 'Entrada registrada (TARDE)' : 'Entrada registrada',
          employee: pendingAction?.empName,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })
      } else if (action.type === 'clock_out') {
        await api.attendance.clockOut(empId)
        setResult({
          type: 'success',
          message: 'Salida registrada',
          employee: pendingAction?.empName,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })
      } else if (action.type === 'break_start') {
        await api.attendance.breakStart(empId)
        setResult({
          type: 'success',
          message: 'Descanso iniciado',
          employee: pendingAction?.empName,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })
      } else if (action.type === 'break_end') {
        await api.attendance.breakEnd(empId)
        setResult({
          type: 'success',
          message: 'Descanso finalizado',
          employee: pendingAction?.empName,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })
      }
    } catch (e: any) {
      setResult({ type: 'error', message: e.message || 'Error al registrar' })
    }

    processingRef.current = false
    setTimeout(() => setResult(null), 4000)
  }

  const startScanner = async () => {
    setResult(null)
    setCameraError('')
    setPendingAction(null)

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
          if (processingRef.current) return
          const empId = parseInt(decodedText.replace('AS:', ''))
          if (isNaN(empId)) return

          try { await scanner.stop() } catch {}
          setScanning(false)
          processingRef.current = true

          try {
            const appData = await api.employees.appData(empId)
            const empName = appData.employee?.name || 'Empleado'
            const hasSession = !!appData.active_session_id
            const onBreak = !!appData.today_record?.break_start && !appData.today_record?.break_end
            const hasEntry = !!appData.today_record?.entry_time

            let status: EmployeeStatus = 'none'
            if (hasSession && onBreak) status = 'on_break'
            else if (hasSession) status = 'working'

            const actions = getActionsForStatus(status, hasEntry)

            if (actions.length === 1) {
              await executeAction(empId, actions[0])
            } else {
              processingRef.current = false
              setPendingAction({ empId, empName, actions })
            }
          } catch (e: any) {
            processingRef.current = false
            setResult({ type: 'error', message: e.message || 'Error al consultar empleado' })
            setTimeout(() => setResult(null), 4000)
          }
        },
        () => {}
      )
      setScanning(true)
    } catch (err: any) {
      setCameraError(err.message || 'No se pudo acceder a la camara')
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
        <p className="text-sm text-zinc-400 mt-0.5">Escanea el codigo QR del empleado para registrar entrada, salida o descanso</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-zinc-200 p-6 flex flex-col items-center">
          <div
            id="qr-reader"
            ref={containerRef}
            className="w-full max-w-sm rounded-xl overflow-hidden mb-4"
            style={{ minHeight: scanning ? 300 : 0 }}
          />

          {!scanning && !pendingAction && (
            <button
              onClick={startScanner}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              <Camera size={18} /> Iniciar escaner
            </button>
          )}

          {scanning && (
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
                      onClick={() => executeAction(pendingAction.empId, action)}
                      className={`flex items-center justify-center gap-2 px-6 py-3 ${colors[action.color as keyof typeof colors]} text-white rounded-xl text-sm font-medium transition-colors`}
                    >
                      <Icon size={18} /> {action.label}
                    </button>
                  )
                })}
                <button
                  onClick={() => { setPendingAction(null); startScanner() }}
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
                Presiona "Iniciar escaner" y apunta la camara<br />al codigo QR del empleado
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-zinc-400">
                <div className="flex items-center gap-1"><LogIn size={12} className="text-green-500" /> Entrada</div>
                <div className="flex items-center gap-1"><Coffee size={12} className="text-amber-500" /> Descanso</div>
                <div className="flex items-center gap-1"><LogOut size={12} className="text-red-500" /> Salida</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
