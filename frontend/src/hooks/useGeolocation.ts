import { useState, useCallback } from 'react'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
}

export function useGeolocation() {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const getLocation = useCallback((): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError('Geolocalización no soportada')
        resolve(null)
        return
      }
      setLoading(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const data: LocationData = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }
          setLocation(data)
          setLoading(false)
          setError('')
          resolve(data)
        },
        (err) => {
          setError(err.message)
          setLoading(false)
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      )
    })
  }, [])

  return { location, error, loading, getLocation }
}
