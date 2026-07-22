import { useState, useCallback } from 'react'

export interface WifiData {
  ssid: string | null
  connected: boolean
}

export function useWifi() {
  const [wifi, setWifi] = useState<WifiData | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const getWifi = useCallback(async (): Promise<WifiData | null> => {
    setLoading(true)
    setError('')

    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { invoke } = (window as any).__TAURI__.core
        try {
          const result = await invoke('get_wifi_ssid')
          const data: WifiData = { ssid: result, connected: !!result }
          setWifi(data)
          setLoading(false)
          return data
        } catch {
          const data: WifiData = { ssid: null, connected: false }
          setWifi(data)
          setLoading(false)
          return data
        }
      }

      if ('connection' in navigator) {
        const conn = (navigator as any).connection
        if (conn) {
          const data: WifiData = { ssid: 'Navegador (no disponible)', connected: conn.downlink !== 0 }
          setWifi(data)
          setLoading(false)
          return data
        }
      }

      const data: WifiData = { ssid: null, connected: navigator.onLine }
      setWifi(data)
      setLoading(false)
      return data
    } catch (e: any) {
      setError(e.message || 'No se pudo detectar Wi-Fi')
      setLoading(false)
      return { ssid: null, connected: false }
    }
  }, [])

  return { wifi, error, loading, getWifi }
}
