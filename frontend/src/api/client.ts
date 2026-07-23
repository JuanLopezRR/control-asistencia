const RENDER_URL = 'https://control-asistencia-s090.onrender.com/api'

const DEFAULT_API_URL = import.meta.env.PROD ? RENDER_URL : '/api'

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('api_url')
    if (saved && saved.startsWith('http') && !saved.includes('localhost')) return saved
  }
  return DEFAULT_API_URL
}

export function setApiUrl(url: string) {
  localStorage.setItem('api_url', url)
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Error del servidor')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  employees: {
    list: (search = '', active?: boolean) => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (active !== undefined) params.set('active', String(active))
      return request<any[]>(`/employees/?${params}`)
    },
    get: (id: number) => request<any>(`/employees/${id}`),
    create: (data: any) =>
      request<any>('/employees/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/employees/${id}`, { method: 'DELETE' }),
    registerFace: (id: number, descriptor: string) =>
      request<any>(`/employees/${id}/face`, { method: 'POST', body: JSON.stringify({ descriptor }) }),
    appData: (id: number) => request<any>(`/employees/${id}/app`),
  },
  attendance: {
    getAllFaces: () => request<any[]>('/employees/faces/all'),
    list: (params?: { employee_id?: number; date_from?: string; date_to?: string }) => {
      const q = new URLSearchParams()
      if (params?.employee_id) q.set('employee_id', String(params.employee_id))
      if (params?.date_from) q.set('date_from', params.date_from)
      if (params?.date_to) q.set('date_to', params.date_to)
      return request<any[]>(`/attendance/?${q}`)
    },
    today: () => request<any[]>('/attendance/today'),
    dashboard: () => request<any>('/attendance/dashboard'),
    clockIn: (employeeId: number, justification?: string, extras?: { latitude?: number; longitude?: number; wifi_ssid?: string; entry_method?: string }) => {
      const q = new URLSearchParams()
      q.set('employee_id', String(employeeId))
      if (justification) q.set('justification', justification)
      if (extras?.latitude !== undefined) q.set('latitude', String(extras.latitude))
      if (extras?.longitude !== undefined) q.set('longitude', String(extras.longitude))
      if (extras?.wifi_ssid) q.set('wifi_ssid', extras.wifi_ssid)
      if (extras?.entry_method) q.set('entry_method', extras.entry_method)
      return request<any>(`/attendance/clock-in?${q}`, { method: 'POST' })
    },
    checkLate: (employeeId: number) => request<any>(`/attendance/check-late/${employeeId}`),
    clockOut: (employeeId: number) =>
      request<any>(`/attendance/clock-out?employee_id=${employeeId}`, { method: 'POST' }),
    breakStart: (employeeId: number) =>
      request<any>(`/attendance/break-start?employee_id=${employeeId}`, { method: 'POST' }),
    breakEnd: (employeeId: number) =>
      request<any>(`/attendance/break-end?employee_id=${employeeId}`, { method: 'POST' }),
    create: (data: any) =>
      request<any>('/attendance/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/attendance/${id}`, { method: 'DELETE' }),
  },
  locations: {
    list: () => request<any[]>('/locations/'),
    get: (id: number) => request<any>(`/locations/${id}`),
    create: (data: any) => request<any>('/locations/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/locations/${id}`, { method: 'DELETE' }),
    check: (data: { latitude: number; longitude: number; work_location_id?: number }) =>
      request<any>('/locations/check', { method: 'POST', body: JSON.stringify(data) }),
  },
  sessions: {
    list: (params?: { employee_id?: number; status?: string; date_from?: string; date_to?: string }) => {
      const q = new URLSearchParams()
      if (params?.employee_id) q.set('employee_id', String(params.employee_id))
      if (params?.status) q.set('status', params.status)
      if (params?.date_from) q.set('date_from', params.date_from)
      if (params?.date_to) q.set('date_to', params.date_to)
      return request<any[]>(`/sessions/?${q}`)
    },
    active: () => request<any[]>('/sessions/active'),
    get: (id: number) => request<any>(`/sessions/${id}`),
    start: (data: any) => request<any>('/sessions/start', { method: 'POST', body: JSON.stringify(data) }),
    end: (id: number, data: any) => request<any>(`/sessions/${id}/end`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  },
  geofence: {
    events: (params?: { employee_id?: number; session_id?: number }) => {
      const q = new URLSearchParams()
      if (params?.employee_id) q.set('employee_id', String(params.employee_id))
      if (params?.session_id) q.set('session_id', String(params.session_id))
      return request<any[]>(`/geofence/events?${q}`)
    },
    check: (latitude: number, longitude: number, employee_id: number) =>
      request<any>(`/geofence/check?latitude=${latitude}&longitude=${longitude}&employee_id=${employee_id}`, { method: 'POST' }),
    exit: (data: any) => request<any>('/geofence/exit', { method: 'POST', body: JSON.stringify(data) }),
    return: (data: any) => request<any>('/geofence/return', { method: 'POST', body: JSON.stringify(data) }),
  },
  presence: {
    pending: (employee_id?: number) => {
      const q = employee_id ? `?employee_id=${employee_id}` : ''
      return request<any[]>(`/presence/pending${q}`)
    },
    history: (params?: { employee_id?: number; status?: string }) => {
      const q = new URLSearchParams()
      if (params?.employee_id) q.set('employee_id', String(params.employee_id))
      if (params?.status) q.set('status', params.status)
      return request<any[]>(`/presence/history?${q}`)
    },
    respond: (data: any) => request<any>('/presence/respond', { method: 'POST', body: JSON.stringify(data) }),
    checkMissed: () => request<any>('/presence/check-missed', { method: 'POST' }),
  },
  wifi: {
    history: (params?: { employee_id?: number; session_id?: number }) => {
      const q = new URLSearchParams()
      if (params?.employee_id) q.set('employee_id', String(params.employee_id))
      if (params?.session_id) q.set('session_id', String(params.session_id))
      return request<any[]>(`/wifi/history?${q}`)
    },
    check: (data: any) => request<any>('/wifi/check', { method: 'POST', body: JSON.stringify(data) }),
  },
  incidents: {
    list: (params?: { employee_id?: number; incident_type?: string; resolved?: boolean; severity?: string }) => {
      const q = new URLSearchParams()
      if (params?.employee_id) q.set('employee_id', String(params.employee_id))
      if (params?.incident_type) q.set('incident_type', params.incident_type)
      if (params?.resolved !== undefined) q.set('resolved', String(params.resolved))
      if (params?.severity) q.set('severity', params.severity)
      return request<any[]>(`/incidents/?${q}`)
    },
    create: (data: any) => request<any>('/incidents/', { method: 'POST', body: JSON.stringify(data) }),
    resolve: (id: number, data: any) => request<any>(`/incidents/${id}/resolve`, { method: 'PUT', body: JSON.stringify(data) }),
    stats: () => request<any>('/incidents/stats'),
  },
  permissions: {
    list: (params?: { employee_id?: number; status_type?: string }) => {
      const q = new URLSearchParams()
      if (params?.employee_id) q.set('employee_id', String(params.employee_id))
      if (params?.status_type) q.set('status_type', params.status_type)
      return request<any[]>(`/permissions/?${q}`)
    },
    active: () => request<any[]>('/permissions/active'),
    create: (data: any) => request<any>('/permissions/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/permissions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/permissions/${id}`, { method: 'DELETE' }),
  },
}
