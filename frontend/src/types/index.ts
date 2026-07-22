export interface Employee {
  id: number
  name: string
  email: string
  position: string | null
  phone: string | null
  active: boolean
  created_at: string
}

export interface AttendanceRecord {
  id: number
  employee_id: number
  date: string
  entry_time: string | null
  exit_time: string | null
  break_start: string | null
  break_end: string | null
  notes: string | null
  justification: string | null
  late: boolean
  created_at: string
  employee: Employee | null
}

export interface DashboardStats {
  total_employees: number
  active_employees: number
  present_today: number
  on_break: number
  late_today: number
}

export interface EmployeeFormData {
  name: string
  email: string
  position: string
  phone: string
}
