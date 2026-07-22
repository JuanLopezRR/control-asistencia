import { useEffect, useState } from 'react'
import { MapPin, Plus, Pencil, Trash2, Wifi, Save } from 'lucide-react'
import { api } from '../api/client'

interface WorkLocation {
  id: number
  name: string
  address: string | null
  latitude: number
  longitude: number
  radius_meters: number
  wifi_ssid: string | null
  active: boolean
  created_at: string
}

export default function GeofencePage() {
  const [locations, setLocations] = useState<WorkLocation[]>([])
  const [editing, setEditing] = useState<WorkLocation | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ name: string; address: string; latitude: string; longitude: string; radius_meters: string; wifi_ssid: string }>({ name: '', address: '', latitude: '', longitude: '', radius_meters: '100', wifi_ssid: '' })

  const load = async () => {
    const data = await api.locations.list()
    setLocations(data)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    const payload = { ...form, latitude: parseFloat(form.latitude) || 0, longitude: parseFloat(form.longitude) || 0, radius_meters: parseInt(form.radius_meters) || 100 }
    if (editing) {
      await api.locations.update(editing.id, payload)
    } else {
      await api.locations.create(payload)
    }
    setShowForm(false)
    setEditing(null)
    setForm({ name: '', address: '', latitude: '', longitude: '', radius_meters: '100', wifi_ssid: '' })
    await load()
  }

  const handleEdit = (loc: WorkLocation) => {
    setEditing(loc)
    setForm({ name: loc.name, address: loc.address || '', latitude: String(loc.latitude), longitude: String(loc.longitude), radius_meters: String(loc.radius_meters), wifi_ssid: loc.wifi_ssid || '' })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta ubicación?')) return
    await api.locations.delete(id)
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Geocerca</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{locations.length} ubicaciones configuradas</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', address: '', latitude: '', longitude: '', radius_meters: '100', wifi_ssid: '' }); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors">
          <Plus size={16} /> Nueva ubicación
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
          <h3 className="font-semibold text-zinc-800">{editing ? 'Editar ubicación' : 'Nueva ubicación'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Nombre</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Dirección</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Latitud</label>
              <input type="text" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20" placeholder="ej. 20.659698" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Longitud</label>
              <input type="text" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20" placeholder="ej. -103.349609" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Radio (metros)</label>
              <input type="text" value={form.radius_meters} onChange={e => setForm({ ...form, radius_meters: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20" placeholder="100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Wi-Fi SSID</label>
              <input value={form.wifi_ssid} onChange={e => setForm({ ...form, wifi_ssid: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20" placeholder="Nombre de la red Wi-Fi" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50">Cancelar</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800"><Save size={14} /> Guardar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map(loc => (
          <div key={loc.id} className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg"><MapPin size={16} className="text-blue-600" /></div>
                <div>
                  <h3 className="font-medium text-zinc-800">{loc.name}</h3>
                  <p className="text-xs text-zinc-400">{loc.address || 'Sin dirección'}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleEdit(loc)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(loc.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-400">Coordenadas</span><span className="text-zinc-600 font-mono text-xs">{loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Radio</span><span className="text-zinc-600">{loc.radius_meters}m</span></div>
              {loc.wifi_ssid && (
                <div className="flex justify-between items-center"><span className="text-zinc-400">Wi-Fi</span><span className="flex items-center gap-1 text-zinc-600"><Wifi size={12} /> {loc.wifi_ssid}</span></div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
