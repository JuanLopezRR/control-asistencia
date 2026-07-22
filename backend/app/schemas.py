from datetime import date, time, datetime
from pydantic import BaseModel
from typing import Optional, List


class EmployeeCreate(BaseModel):
    name: str
    email: str
    position: Optional[str] = None
    phone: Optional[str] = None
    work_location_id: Optional[int] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    active: Optional[bool] = None
    work_location_id: Optional[int] = None


class EmployeeResponse(BaseModel):
    id: int
    name: str
    email: str
    position: Optional[str] = None
    phone: Optional[str] = None
    active: bool
    work_location_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceCreate(BaseModel):
    employee_id: int
    date: date
    entry_time: Optional[time] = None
    exit_time: Optional[time] = None
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    notes: Optional[str] = None


class AttendanceUpdate(BaseModel):
    entry_time: Optional[time] = None
    exit_time: Optional[time] = None
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    notes: Optional[str] = None
    justification: Optional[str] = None
    late: Optional[bool] = None


class AttendanceResponse(BaseModel):
    id: int
    employee_id: int
    date: date
    entry_time: Optional[time] = None
    exit_time: Optional[time] = None
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    notes: Optional[str] = None
    justification: Optional[str] = None
    late: bool = False
    created_at: datetime
    employee: Optional[EmployeeResponse] = None

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    present_today: int
    on_break: int
    late_today: int


# ============= Work Location Schemas =============

class WorkLocationCreate(BaseModel):
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    radius_meters: int = 100
    wifi_ssid: Optional[str] = None
    active: bool = True


class WorkLocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_meters: Optional[int] = None
    wifi_ssid: Optional[str] = None
    active: Optional[bool] = None


class WorkLocationResponse(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    radius_meters: int
    wifi_ssid: Optional[str] = None
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class GeofenceCheckRequest(BaseModel):
    latitude: float
    longitude: float
    work_location_id: Optional[int] = None


class GeofenceCheckResponse(BaseModel):
    inside: bool
    distance_meters: float
    work_location: Optional[WorkLocationResponse] = None


# ============= Work Session Schemas =============

class WorkSessionCreate(BaseModel):
    employee_id: int
    work_location_id: Optional[int] = None
    entry_method: Optional[str] = None
    entry_location_lat: Optional[float] = None
    entry_location_lng: Optional[float] = None
    entry_wifi_ssid: Optional[str] = None


class WorkSessionEnd(BaseModel):
    exit_method: Optional[str] = None
    exit_location_lat: Optional[float] = None
    exit_location_lng: Optional[float] = None
    exit_wifi_ssid: Optional[str] = None


class WorkSessionResponse(BaseModel):
    id: int
    employee_id: int
    work_location_id: Optional[int] = None
    date: date
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str
    entry_method: Optional[str] = None
    entry_location_lat: Optional[float] = None
    entry_location_lng: Optional[float] = None
    entry_wifi_ssid: Optional[str] = None
    exit_method: Optional[str] = None
    exit_location_lat: Optional[float] = None
    exit_location_lng: Optional[float] = None
    exit_wifi_ssid: Optional[str] = None
    total_hours: Optional[float] = None
    created_at: datetime
    employee: Optional[EmployeeResponse] = None
    work_location: Optional[WorkLocationResponse] = None

    class Config:
        from_attributes = True


# ============= Perimeter Event Schemas =============

class PerimeterEventCreate(BaseModel):
    work_session_id: int
    employee_id: int
    event_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    reason: Optional[str] = None
    authorized_by: Optional[str] = None


class PerimeterEventResponse(BaseModel):
    id: int
    work_session_id: int
    employee_id: int
    event_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: datetime
    reason: Optional[str] = None
    authorized_by: Optional[str] = None
    created_at: datetime
    employee: Optional[EmployeeResponse] = None

    class Config:
        from_attributes = True


# ============= Presence Check Schemas =============

class PresenceCheckSchedule(BaseModel):
    employee_id: int
    work_session_id: int
    timeout_seconds: int = 120


class PresenceCheckRespond(BaseModel):
    check_id: int
    response_method: str = "selfie_face_gps"
    selfie_url: Optional[str] = None
    response_lat: Optional[float] = None
    response_lng: Optional[float] = None
    response_wifi_ssid: Optional[str] = None


class PresenceCheckResponse(BaseModel):
    id: int
    employee_id: int
    work_session_id: int
    scheduled_at: datetime
    responded_at: Optional[datetime] = None
    status: str
    response_method: Optional[str] = None
    selfie_url: Optional[str] = None
    response_lat: Optional[float] = None
    response_lng: Optional[float] = None
    response_wifi_ssid: Optional[str] = None
    timeout_seconds: int
    created_at: datetime
    employee: Optional[EmployeeResponse] = None

    class Config:
        from_attributes = True


# ============= WiFi Check Schemas =============

class WifiCheckCreate(BaseModel):
    work_session_id: int
    employee_id: int
    expected_ssid: str
    actual_ssid: Optional[str] = None
    is_connected: Optional[bool] = None


class WifiCheckResponse(BaseModel):
    id: int
    work_session_id: int
    employee_id: int
    checked_at: datetime
    expected_ssid: str
    actual_ssid: Optional[str] = None
    is_connected: Optional[bool] = None
    created_at: datetime
    employee: Optional[EmployeeResponse] = None

    class Config:
        from_attributes = True


# ============= Incident Schemas =============

class IncidentCreate(BaseModel):
    employee_id: int
    work_session_id: Optional[int] = None
    incident_type: str
    severity: str = "warning"
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class IncidentResolve(BaseModel):
    resolved_by: str


class IncidentResponse(BaseModel):
    id: int
    employee_id: int
    work_session_id: Optional[int] = None
    incident_type: str
    severity: str
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: datetime
    resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    employee: Optional[EmployeeResponse] = None

    class Config:
        from_attributes = True


# ============= Special Status Schemas =============

class SpecialStatusCreate(BaseModel):
    employee_id: int
    status_type: str
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    reason: Optional[str] = None
    authorized_by: Optional[str] = None
    geofence_exempt: bool = False
    wifi_exempt: bool = False
    check_exempt: bool = False


class SpecialStatusUpdate(BaseModel):
    status_type: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    reason: Optional[str] = None
    authorized_by: Optional[str] = None
    geofence_exempt: Optional[bool] = None
    wifi_exempt: Optional[bool] = None
    check_exempt: Optional[bool] = None


class SpecialStatusResponse(BaseModel):
    id: int
    employee_id: int
    status_type: str
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    reason: Optional[str] = None
    authorized_by: Optional[str] = None
    geofence_exempt: bool
    wifi_exempt: bool
    check_exempt: bool
    created_at: datetime
    employee: Optional[EmployeeResponse] = None

    class Config:
        from_attributes = True


# ============= System Config Schemas =============

class SystemConfigCreate(BaseModel):
    config_key: str
    config_value: str
    description: Optional[str] = None


class SystemConfigUpdate(BaseModel):
    config_value: str
    description: Optional[str] = None


class SystemConfigResponse(BaseModel):
    id: int
    config_key: str
    config_value: str
    description: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True
