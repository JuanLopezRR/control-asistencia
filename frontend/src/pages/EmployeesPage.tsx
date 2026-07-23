import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, QrCode, ScanLine } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'
import EmployeeModal from '../components/EmployeeModal'
import FaceCaptureModal from '../components/FaceCaptureModal'
import type { Employee } from '../types'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [qrEmployee, setQrEmployee] = useState<Employee | null>(null)
  const [faceEmployee, setFaceEmployee] = useState<Employee | null>(null)

  const load = async () => {
    const data = await api.employees.list(search)
    setEmployees(data)
  }

  useEffect(() => {
    load()
  }, [search])

  const handleSave = async (data: { name: string; email: string; position: string; phone: string }) => {
    try {
      if (editing) {
        await api.employees.update(editing.id, data)
      } else {
        await api.employees.create(data)
      }
      setModalOpen(false)
      setEditing(null)
      await load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este empleado?')) return
    try {
      await api.employees.delete(id)
      await load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setModalOpen(true)
  }

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Empleados</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{employees.length} registrados</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          <Plus size={16} /> <span className="hidden sm:inline">Nuevo</span>
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empleados..."
          className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
        />
      </div>

      <div className="hidden sm:block bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Puesto</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Cara</th>
                <th className="text-center px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Estado</th>
                <th className="text-right px-5 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-zinc-800">{emp.name}</td>
                  <td className="px-5 py-3 text-zinc-500">{emp.email}</td>
                  <td className="px-5 py-3 text-zinc-500">{emp.position || '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${(emp as any).face_descriptor ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {(emp as any).face_descriptor ? 'Registrada' : 'Sin registrar'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {emp.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setFaceEmployee(emp)} className="p-1.5 rounded-lg hover:bg-blue-50 text-zinc-400 hover:text-blue-500 transition-colors" title="Registrar cara"><ScanLine size={15} /></button>
                      <button onClick={() => setQrEmployee(emp)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="Ver QR"><QrCode size={15} /></button>
                      <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => handleDelete(emp.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-zinc-400 text-sm">No hay empleados registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sm:hidden space-y-3">
        {employees.map((emp) => (
          <div key={emp.id} className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-zinc-800">{emp.name}</p>
                <p className="text-xs text-zinc-400">{emp.email}</p>
                {emp.position && <p className="text-xs text-zinc-500">{emp.position}</p>}
              </div>
              <div className="flex gap-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(emp as any).face_descriptor ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                  {(emp as any).face_descriptor ? 'Cara OK' : 'Sin cara'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                {emp.active ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setFaceEmployee(emp)} className="p-2 rounded-lg hover:bg-blue-50 text-zinc-400 hover:text-blue-500"><ScanLine size={15} /></button>
                <button onClick={() => setQrEmployee(emp)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"><QrCode size={15} /></button>
                <button onClick={() => openEdit(emp)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"><Pencil size={15} /></button>
                <button onClick={() => handleDelete(emp.id)} className="p-2 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
        {employees.length === 0 && (
          <div className="text-center py-12 text-zinc-400 text-sm">No hay empleados registrados</div>
        )}
      </div>

      <EmployeeModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }} onSave={handleSave} initial={editing} title={editing ? 'Editar Empleado' : 'Nuevo Empleado'} />

      {qrEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setQrEmployee(null)}>
          <div className="bg-white rounded-2xl p-6 sm:p-8 flex flex-col items-center gap-4 shadow-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-zinc-800 text-lg">{qrEmployee.name}</h3>
            <QRCodeSVG value={`AS:${qrEmployee.id}`} size={180} level="H" />
            <p className="text-xs text-zinc-400">ID: {qrEmployee.id} — Escaneo para entrada</p>
            <button onClick={() => setQrEmployee(null)} className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800">Cerrar</button>
          </div>
        </div>
      )}

      {faceEmployee && <FaceCaptureModal employee={faceEmployee} onClose={() => setFaceEmployee(null)} onSaved={load} />}
    </div>
  )
}
