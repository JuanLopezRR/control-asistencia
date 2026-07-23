import { useState, useEffect } from 'react'
import { Server, Wifi, WifiOff, Database, Check, RefreshCw, Settings } from 'lucide-react'
import { setApiUrl } from '../api/client'

export default function SettingsPage() {
  const [apiUrl, setApiUrlState] = useState('')
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [syncConfigured, setSyncConfigured] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [unsynced, setUnsynced] = useState({ employees: 0, records: 0 })
  const [syncMsg, setSyncMsg] = useState('')
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const saved = localStorage.getItem('api_url')
    setApiUrlState(saved && saved.startsWith('http') && !saved.includes('localhost') ? saved : '')
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    fetch(`${baseUrl()}/sync/status`).then(r => r.json()).then(d => {
      setSyncConfigured(d.configured)
    }).catch(() => {})
  }, [apiUrl])

  useEffect(() => {
    if (!syncConfigured) return
    const interval = setInterval(() => {
      fetch(`${baseUrl()}/attendance/sync/unsynced`).then(r => r.json()).then(d => {
        setUnsynced({
          employees: d.employees?.length || 0,
          records: d.records?.length || 0,
        })
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [syncConfigured, apiUrl])

  const RENDER_URL = 'https://control-asistencia-s090.onrender.com/api'
  const baseUrl = () => apiUrl || (import.meta.env.PROD ? RENDER_URL : '/api')

  const handleSaveApiUrl = () => {
    setApiUrl(apiUrl)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTestStatus('testing')
    try {
      const res = await fetch(`${baseUrl()}/health`)
      const data = await res.json()
      setTestStatus(data.status === 'ok' ? 'ok' : 'error')
    } catch {
      setTestStatus('error')
    }
    setTimeout(() => setTestStatus('idle'), 3000)
  }

  const handleResetApiUrl = () => {
    setApiUrl('')
    localStorage.removeItem('api_url')
    setApiUrlState('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleConfigureSync = async () => {
    if (!supabaseUrl.trim()) return
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch(`${baseUrl()}/sync/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: supabaseUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error')
      setSyncConfigured(true)
      setSyncMsg(data.message || 'Sincronización automática activada')
    } catch (e: any) {
      setSyncMsg(`Error: ${e.message}`)
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(''), 5000)
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`${baseUrl()}/attendance/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_url: supabaseUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error')
      setSyncMsg(`Sincronizado: ${data.pushed.employees} empleados, ${data.pushed.records} registros`)
    } catch (e: any) {
      setSyncMsg(`Error: ${e.message}`)
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(''), 5000)
  }

  const isLocal = !apiUrl || apiUrl === '/api'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">Configuración</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Conexión y sincronización</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-xl border p-5 ${isLocal ? 'bg-green-50 border-green-200' : 'bg-zinc-50 border-zinc-200'}`}>
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <WifiOff size={16} className="text-green-600" />
            <span className={isLocal ? 'text-green-800' : 'text-zinc-500'}>Local (SQLite)</span>
          </div>
          <p className="text-xs text-zinc-500">Datos en tu PC, sin internet</p>
        </div>
        <div className={`rounded-xl border p-5 ${online ? 'bg-blue-50 border-blue-200' : 'bg-zinc-50 border-zinc-200'}`}>
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <Wifi size={16} className={online ? 'text-blue-600' : 'text-zinc-400'} />
            <span className={online ? 'text-blue-800' : 'text-zinc-500'}>{online ? 'Con internet' : 'Sin conexión'}</span>
          </div>
          <p className="text-xs text-zinc-500">{syncConfigured ? 'Auto-sync activo' : 'No configurado'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-800">URL del Servidor (Backend)</h2>
        <p className="text-xs text-zinc-400">Dirección del servidor Python FastAPI. En modo local usa http://localhost:8000/api</p>
        <input
          value={apiUrl}
          onChange={(e) => setApiUrlState(e.target.value)}
          placeholder="http://localhost:8000/api"
          className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
        />
        <div className="flex gap-3">
          <button onClick={handleSaveApiUrl} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800">
            {saved ? <Check size={16} /> : <Server size={16} />}
            {saved ? 'Guardado' : 'Guardar'}
          </button>
          <button onClick={handleTest} disabled={testStatus === 'testing'} className="px-4 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">
            <Database size={15} className="inline mr-1" />
            {testStatus === 'testing' ? 'Probando...' : testStatus === 'ok' ? 'OK' : testStatus === 'error' ? 'Error' : 'Probar'}
          </button>
          <button onClick={handleResetApiUrl} className="px-4 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50">Local</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-800">Sincronización Automática con Supabase</h2>

        <p className="text-sm text-zinc-500">Configura UNA SOLA VEZ y el backend sincronizará solo cada 5 minutos cuando haya internet.</p>

        <div>
          <label className="text-xs text-zinc-500 mb-1 block">URL de conexión a la base de datos PostgreSQL (Supabase)</label>
          <input
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
            placeholder="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleConfigureSync}
            disabled={syncing || !supabaseUrl.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Settings size={16} />
            Activar auto-sync
          </button>
          <button
            onClick={handleSyncNow}
            disabled={syncing || !syncConfigured}
            className="flex items-center gap-2 px-4 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            {syncing ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Sincronizar ahora
          </button>
        </div>

        {syncMsg && (
          <div className={`text-sm px-3 py-2 rounded-lg ${syncMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {syncMsg}
          </div>
        )}

        {syncConfigured && (
          <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700 flex items-center gap-2">
            <Check size={16} />
            Auto-sync activo — los datos se sincronizan cada 5 minutos automáticamente
            {unsynced.employees + unsynced.records > 0 && (
              <span className="ml-auto text-xs">({unsynced.employees} emp, {unsynced.records} reg pendientes)</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
