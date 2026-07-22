from datetime import date, time, datetime
from sqlalchemy import String, Integer, Float, Date, Time, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    position: Mapped[str] = mapped_column(String(200), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    face_descriptor: Mapped[str] = mapped_column(Text, nullable=True)
    work_location_id: Mapped[int] = mapped_column(Integer, ForeignKey("work_locations.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
    synced: Mapped[bool] = mapped_column(Boolean, default=True)

    records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    work_sessions: Mapped[list["WorkSession"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    perimeter_events: Mapped[list["PerimeterEvent"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    presence_checks: Mapped[list["PresenceCheck"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    wifi_checks: Mapped[list["WifiCheck"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    incidents: Mapped[list["Incident"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    special_statuses: Mapped[list["SpecialStatus"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    entry_time: Mapped[time] = mapped_column(Time, nullable=True)
    exit_time: Mapped[time] = mapped_column(Time, nullable=True)

    break_start: Mapped[time] = mapped_column(Time, nullable=True)
    break_end: Mapped[time] = mapped_column(Time, nullable=True)

    notes: Mapped[str] = mapped_column(Text, nullable=True)
    justification: Mapped[str] = mapped_column(Text, nullable=True)
    late: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
    synced: Mapped[bool] = mapped_column(Boolean, default=True)

    employee: Mapped["Employee"] = relationship(back_populates="records")


class WorkLocation(Base):
    __tablename__ = "work_locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    radius_meters: Mapped[int] = mapped_column(Integer, default=100)
    wifi_ssid: Mapped[str] = mapped_column(String(200), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    work_sessions: Mapped[list["WorkSession"]] = relationship(
        back_populates="work_location", cascade="all, delete-orphan"
    )


class WorkSession(Base):
    __tablename__ = "work_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    work_location_id: Mapped[int] = mapped_column(Integer, ForeignKey("work_locations.id"), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    entry_method: Mapped[str] = mapped_column(String(50), nullable=True)
    entry_location_lat: Mapped[float] = mapped_column(Float, nullable=True)
    entry_location_lng: Mapped[float] = mapped_column(Float, nullable=True)
    entry_wifi_ssid: Mapped[str] = mapped_column(String(200), nullable=True)
    exit_method: Mapped[str] = mapped_column(String(50), nullable=True)
    exit_location_lat: Mapped[float] = mapped_column(Float, nullable=True)
    exit_location_lng: Mapped[float] = mapped_column(Float, nullable=True)
    exit_wifi_ssid: Mapped[str] = mapped_column(String(200), nullable=True)
    total_hours: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    employee: Mapped["Employee"] = relationship(back_populates="work_sessions")
    work_location: Mapped["WorkLocation"] = relationship(back_populates="work_sessions")
    perimeter_events: Mapped[list["PerimeterEvent"]] = relationship(
        back_populates="work_session", cascade="all, delete-orphan"
    )
    presence_checks: Mapped[list["PresenceCheck"]] = relationship(
        back_populates="work_session", cascade="all, delete-orphan"
    )
    wifi_checks: Mapped[list["WifiCheck"]] = relationship(
        back_populates="work_session", cascade="all, delete-orphan"
    )
    incidents: Mapped[list["Incident"]] = relationship(
        back_populates="work_session", cascade="all, delete-orphan"
    )


class PerimeterEvent(Base):
    __tablename__ = "perimeter_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    work_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("work_sessions.id"), nullable=False)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    authorized_by: Mapped[str] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    work_session: Mapped["WorkSession"] = relationship(back_populates="perimeter_events")
    employee: Mapped["Employee"] = relationship(back_populates="perimeter_events")


class PresenceCheck(Base):
    __tablename__ = "presence_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    work_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("work_sessions.id"), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    responded_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    response_method: Mapped[str] = mapped_column(String(50), nullable=True)
    selfie_url: Mapped[str] = mapped_column(Text, nullable=True)
    response_lat: Mapped[float] = mapped_column(Float, nullable=True)
    response_lng: Mapped[float] = mapped_column(Float, nullable=True)
    response_wifi_ssid: Mapped[str] = mapped_column(String(200), nullable=True)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=120)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    employee: Mapped["Employee"] = relationship(back_populates="presence_checks")
    work_session: Mapped["WorkSession"] = relationship(back_populates="presence_checks")


class WifiCheck(Base):
    __tablename__ = "wifi_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    work_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("work_sessions.id"), nullable=False)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expected_ssid: Mapped[str] = mapped_column(String(200), nullable=False)
    actual_ssid: Mapped[str] = mapped_column(String(200), nullable=True)
    is_connected: Mapped[bool] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    work_session: Mapped["WorkSession"] = relationship(back_populates="wifi_checks")
    employee: Mapped["Employee"] = relationship(back_populates="wifi_checks")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    work_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("work_sessions.id"), nullable=True)
    incident_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="warning")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_by: Mapped[str] = mapped_column(String(200), nullable=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    employee: Mapped["Employee"] = relationship(back_populates="incidents")
    work_session: Mapped["WorkSession"] = relationship(back_populates="incidents")


class SpecialStatus(Base):
    __tablename__ = "special_statuses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    status_type: Mapped[str] = mapped_column(String(30), nullable=False)
    start_datetime: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_datetime: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    authorized_by: Mapped[str] = mapped_column(String(200), nullable=True)
    geofence_exempt: Mapped[bool] = mapped_column(Boolean, default=False)
    wifi_exempt: Mapped[bool] = mapped_column(Boolean, default=False)
    check_exempt: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    employee: Mapped["Employee"] = relationship(back_populates="special_statuses")


class SystemConfig(Base):
    __tablename__ = "system_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    config_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    config_value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
