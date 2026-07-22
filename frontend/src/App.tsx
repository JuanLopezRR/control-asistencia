import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import EmployeesPage from './pages/EmployeesPage'
import AttendancePage from './pages/AttendancePage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import QRScanPage from './pages/QRScanPage'
import FaceScanPage from './pages/FaceScanPage'
import GeofencePage from './pages/GeofencePage'
import SessionsPage from './pages/SessionsPage'
import PresencePage from './pages/PresencePage'
import IncidentsPage from './pages/IncidentsPage'
import PermissionsPage from './pages/PermissionsPage'
import EmployeeAppPage from './pages/EmployeeAppPage'

function App() {
  const [view, setView] = useState('dashboard')

  const getEmployeeIdFromUrl = (): number | null => {
    const match = window.location.pathname.match(/^\/empleado\/(\d+)/)
    return match ? parseInt(match[1]) : null
  }

  const [employeeId, setEmployeeId] = useState<number | null>(getEmployeeIdFromUrl())

  useEffect(() => {
    const handleUrlChange = () => {
      setEmployeeId(getEmployeeIdFromUrl())
    }
    window.addEventListener('popstate', handleUrlChange)
    return () => window.removeEventListener('popstate', handleUrlChange)
  }, [])

  useEffect(() => {
    if (employeeId) {
      window.location.hash = ''
    }
  }, [employeeId])

  if (employeeId) {
    return <EmployeeAppPage employeeId={employeeId} />
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <DashboardPage />
      case 'employees': return <EmployeesPage />
      case 'attendance': return <AttendancePage />
      case 'qr-scan': return <QRScanPage />
      case 'face-scan': return <FaceScanPage />
      case 'reports': return <ReportsPage />
      case 'geofence': return <GeofencePage />
      case 'sessions': return <SessionsPage />
      case 'presence': return <PresencePage />
      case 'incidents': return <IncidentsPage />
      case 'permissions': return <PermissionsPage />
      case 'settings': return <SettingsPage />
      default: return <DashboardPage />
    }
  }

  return (
    <Layout currentView={view} onNavigate={setView}>
      {renderView()}
    </Layout>
  )
}

export default App
