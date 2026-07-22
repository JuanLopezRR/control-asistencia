export async function getGeoAndWifi(): Promise<{ latitude?: number; longitude?: number; wifi_ssid?: string }> {
  const extras: { latitude?: number; longitude?: number; wifi_ssid?: string } = {}
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
    })
    extras.latitude = pos.coords.latitude
    extras.longitude = pos.coords.longitude
  } catch {}
  return extras
}
