import { useEffect, useState } from 'react'
import { Shield, Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../api/client'

interface SpecialStatus {
  id: number
  employee_id: number
  status_type: string
  start_datetime: string
  end_datetime: string | null
  reason: string | null
  authorized_by: string | null
  geofence_exempt: boolean
  wifi_exempt: boolean
  check_exempt: boolean
  employee?: { id: number; name: string }
}

interface Employee { id: number; name: string }

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<SpecialStatus[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SpecialStatus | null>(null)
  const [form, setForm] = useState({
    employee_id: 0, status_type: 'authorized_exit', start_datetime: '', end_datetime: '',
    reason: '', authorized_by: '', geofence_exempt: false, wifi_exempt: false, check_exempt: false
  })

  const load = async () => {
    const [p, e] = await Promise.all([api.permissions.list(), api.employees.list()])
    setPermissions(p)
    setEmployees(e)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    const payload = { ...form, employee_id: Number(form.employee_id), start_datetime: form.start_datetime || new Date().toISOString(), end_datetime: form.end_datetime || null }
    if (editing) {
      await api.permissions.update(editing.id, payload)
    } else {
      await api.permissions.create(payload)
    }
    setShowForm(false)
    setEditing(null)
    await load()
  }

  const handleEdit = (p: SpecialStatus) => {
    setEditing(p)
    setForm({
      employee_id: p.employee_id, status_type: p.status_type,
      start_datetime: p.start_datetime.slice(0, 16), end_datetime: p.end_datetime?.slice(0, 16) || '',
      reason: p.reason || '', authorized_by: p.authorized_by || '',
      geofence_exempt: p.geofence_exempt, wifi_exempt: p.wifi_exempt, check_exempt: p.check_exempt
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este permiso?')) return
    await api.permissions.delete(id)
    await load()
  }

  const getStatusLabel = (t: string) => {
    const labels: Record<string, string> = {
      authorized_exit: 'Salida autorizada', field_work: 'Trabajo de campo',
      remote_work: 'Teletrabajo', vacation: 'Vacaciones', sick_leave: 'Incapacidad'
    }
    return labels[t] || t
  }

  const getStatusColor = (t: string) => {
    const colors: Record<string, string> = {
      authorized_exit: 'bg-blue-50 text-blue-700', field_work: 'bg-amber-50 text-amber-700',
      remote_work: 'bg-purple-50 text-purple-700', vacation: 'bg-green-50 text-green-700', sick_leave: 'bg-red-50 text-red-700'
    }
    return colors[t] || 'bg-zinc-50 text-zinc-700'
  }

  const isActive = (p: SpecialStatus) => {
    const now = new Date()
    const start = new Date(p.start_datetime)
    const end = p.end_datetime ? new Date(p.end_datetime) : null
    return start <= now && (!end || end >= now)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Permisos Especiales</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{permissions.length} permisos registrados</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ employee_id: 0, status_type: 'authorized_exit', start_datetime: '', end_datetime: '', reason: '', authorized_by: '', geofence_exempt: false, wifi_exempt: false, check_exempt: false }); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors">
          <Plus size={16} /> Nuevo permiso
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
          <h3 className="font-semibold text-zinc-800">{editing ? 'Editar permiso' : 'Nuevo permiso'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Empleado</label>
              <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: Number(e.target.value) })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white">
                <option value={0}>Seleccionar</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Tipo</label>
              <select value={form.status_type} onChange={e => setForm({ ...form, status_type: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white">
                <option value="authorized_exit">Salida autorizada</option>
                <option value="field_work">Trabajo de campo</option>
                <option value="remote_work">Teletrabajo</option>
                <option value="vacation">Vacaciones</option>
                <option value="sick_leave">Incapacidad</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Inicio</label>
              <input type="datetime-local" value={form.start_datetime} onChange={e => setForm({ ...form, start_datetime: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Fin (opcional)</label>
              <input type="datetime-local" value={form.end_datetime} onChange={e => setForm({ ...form, end_datetime: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Razón</label>
              <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" placeholder="Motivo del permiso" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Autorizado por</label>
              <input value={form.authorized_by} onChange={e => setForm({ ...form, authorized_by: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.geofence_exempt} onChange={e => setForm({ ...form, geofence_exempt: e.target.checked })} className="rounded" /> Exento de geocerca</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.wifi_exempt} onChange={e => setForm({ ...form, wifi_exempt: e.target.checked })} className="rounded" /> Exento de Wi-Fi</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.check_exempt} onChange={e => setForm({ ...form, check_exempt: e.target.checked })} className="rounded" /> Exento de validaciones</label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800">Guardar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {permissions.length === 0 && (
          <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-8 text-center">
            <Shield size={40} className="mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-400 text-sm">No hay permisos registrados</p>
          </div>
        )}
        {permissions.map(p => (
          <div key={p.id} className={`bg-white rounded-xl border p-5 flex items-center justify-between ${isActive(p) ? 'border-green-200' : 'border-zinc-200 opacity-60'}`}>
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${isActive(p) ? 'bg-green-100' : 'bg-zinc-100'}`}>
                <Shield size={16} className={isActive(p) ? 'text-green-600' : 'text-zinc-400'} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(p.status_type)}`}>{getStatusLabel(p.status_type)}</span>
                  {isActive(p) && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Activo</span>}
                </div>
                <p className="font-medium text-zinc-800">{p.employee?.name || `Empleado #${p.employee_id}`}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {new Date(p.start_datetime).toLocaleDateString('es-MX')} — {p.end_datetime ? new Date(p.end_datetime).toLocaleDateString('es-MX') : 'Indefinido'}
                  {p.reason && ` · ${p.reason}`}
                </p>
                <div className="flex gap-3 mt-1 text-xs text-zinc-400">
                  {p.geofence_exempt && <span>✓ Geocerca</span>}
                  {p.wifi_exempt && <span>✓ Wi-Fi</span>}
                  {p.check_exempt && <span>✓ Validaciones</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => handleEdit(p)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"><Pencil size={14} /></button>
              <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
