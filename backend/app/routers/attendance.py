from datetime import date, datetime, time, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from app.database import get_db
from app.models import Employee, AttendanceRecord, WorkSession, WorkLocation, Incident, PendingScan
from app.sync import push_to_supabase
from app.sync_config import get_supabase_url
from app.schemas import (
    AttendanceCreate,
    AttendanceUpdate,
    AttendanceResponse,
    DashboardStats,
)
from app.services.geofence import check_inside_geofence, has_active_permission, create_incident
from pydantic import BaseModel

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def _try_sync(db: Session):
    try:
        url = get_supabase_url()
        if url:
            push_to_supabase(url, db)
    except Exception:
        pass


def _record_to_response(record: AttendanceRecord) -> AttendanceResponse:
    emp = record.employee
    return AttendanceResponse(
        id=record.id,
        employee_id=record.employee_id,
        date=record.date,
        entry_time=record.entry_time,
        exit_time=record.exit_time,
        break_start=record.break_start,
        break_end=record.break_end,
        notes=record.notes,
        justification=record.justification,
        late=record.late,
        created_at=record.created_at,
        employee={
            "id": emp.id,
            "name": emp.name,
            "email": emp.email,
            "position": emp.position,
            "phone": emp.phone,
            "active": emp.active,
            "created_at": emp.created_at,
        } if emp else None,
    )


@router.get("/", response_model=List[AttendanceResponse])
def list_records(
    employee_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(AttendanceRecord)
        .options(joinedload(AttendanceRecord.employee))
    )
    if employee_id:
        query = query.filter(AttendanceRecord.employee_id == employee_id)
    if date_from:
        query = query.filter(AttendanceRecord.date >= date_from)
    if date_to:
        query = query.filter(AttendanceRecord.date <= date_to)
    return [_record_to_response(r) for r in query.order_by(AttendanceRecord.date.desc(), AttendanceRecord.id.desc()).all()]


@router.get("/today", response_model=List[AttendanceResponse])
def today_records(db: Session = Depends(get_db)):
    today = date.today()
    query = (
        db.query(AttendanceRecord)
        .options(joinedload(AttendanceRecord.employee))
        .filter(AttendanceRecord.date == today)
    )
    return [_record_to_response(r) for r in query.order_by(AttendanceRecord.id).all()]


@router.get("/dashboard", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    today = date.today()
    total = db.query(Employee).count()
    active = db.query(Employee).filter(Employee.active == True).count()
    today_recs = db.query(AttendanceRecord).filter(AttendanceRecord.date == today).count()
    on_break = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.date == today,
            AttendanceRecord.break_start.isnot(None),
            AttendanceRecord.break_end.is_(None),
        )
        .count()
    )
    late = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.date == today,
            AttendanceRecord.entry_time > time(8, 0),
        )
        .count()
    )
    return DashboardStats(
        total_employees=total,
        active_employees=active,
        present_today=today_recs,
        on_break=on_break,
        late_today=late,
    )


@router.post("/", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def create_record(data: AttendanceCreate, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    existing = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.employee_id == data.employee_id,
            AttendanceRecord.date == data.date,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un registro para este empleado en esta fecha",
        )
    record = AttendanceRecord(**data.model_dump(), synced=False)
    db.add(record)
    db.commit()
    db.refresh(record)
    record.employee = emp
    return _record_to_response(record)


@router.put("/{record_id}", response_model=AttendanceResponse)
def update_record(record_id: int, data: AttendanceUpdate, db: Session = Depends(get_db)):
    record = (
        db.query(AttendanceRecord)
        .options(joinedload(AttendanceRecord.employee))
        .filter(AttendanceRecord.id == record_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    record.synced = False
    db.commit()
    db.refresh(record)
    return _record_to_response(record)


SCHEDULE_START_HOUR = 8
SCHEDULE_START_MINUTE = 0
GRACE_MINUTES = 10


@router.post("/clock-in", response_model=AttendanceResponse)
def clock_in(
    employee_id: int = Query(...),
    justification: Optional[str] = Query(None),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    wifi_ssid: Optional[str] = Query(None),
    entry_method: Optional[str] = Query("manual"),
    tz_offset: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    utc_now = datetime.utcnow()
    if tz_offset is not None:
        local_now = utc_now - timedelta(minutes=tz_offset)
    else:
        local_now = utc_now
    today = local_now.date()
    now = local_now
    scheduled = now.replace(hour=SCHEDULE_START_HOUR, minute=SCHEDULE_START_MINUTE, second=0, microsecond=0)
    grace = scheduled.replace(minute=SCHEDULE_START_MINUTE + GRACE_MINUTES)
    is_late = now > grace

    existing = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date == today,
        )
        .order_by(AttendanceRecord.id.desc())
        .first()
    )
    if existing:
        if existing.entry_time and not existing.exit_time:
            raise HTTPException(status_code=400, detail="Ya tiene entrada activa, registre salida primero")
        if existing.entry_time and existing.exit_time:
            record = AttendanceRecord(
                employee_id=employee_id,
                date=today,
                entry_time=now.time(),
                late=is_late,
                justification=justification,
                synced=False,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            record.employee = emp
            _create_session_and_checks(db, employee_id, latitude, longitude, wifi_ssid, entry_method, local_now)
            _try_sync(db)
            return _record_to_response(record)
        existing.entry_time = now.time()
        existing.late = is_late
        existing.justification = justification
        existing.synced = False
        db.commit()
        db.refresh(existing)
        existing.employee = emp
        _create_session_and_checks(db, employee_id, latitude, longitude, wifi_ssid, entry_method, local_now)
        _try_sync(db)
        return _record_to_response(existing)
    record = AttendanceRecord(
        employee_id=employee_id,
        date=today,
        entry_time=now.time(),
        late=is_late,
        justification=justification,
        synced=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    record.employee = emp
    _create_session_and_checks(db, employee_id, latitude, longitude, wifi_ssid, entry_method, local_now)
    _try_sync(db)
    return _record_to_response(record)


def _create_session_and_checks(
    db: Session,
    employee_id: int,
    latitude: Optional[float],
    longitude: Optional[float],
    wifi_ssid: Optional[str],
    entry_method: Optional[str],
    local_now: Optional[datetime] = None,
):
    if local_now is None:
        local_now = datetime.utcnow()
    today = local_now.date()
    existing_session = db.query(WorkSession).filter(
        WorkSession.employee_id == employee_id,
        WorkSession.date == today,
        WorkSession.status == "active",
    ).first()
    if existing_session:
        return

    work_location_id = None
    if latitude is not None and longitude is not None:
        result = check_inside_geofence(db, latitude, longitude)
        if result.get("work_location"):
            work_location_id = result["work_location"].id

    session = WorkSession(
        employee_id=employee_id,
        work_location_id=work_location_id,
        date=today,
        start_time=local_now,
        status="active",
        entry_method=entry_method,
        entry_location_lat=latitude,
        entry_location_lng=longitude,
        entry_wifi_ssid=wifi_ssid,
    )
    db.add(session)
    db.flush()

    if latitude is not None and longitude is not None:
        if has_active_permission(db, employee_id, "geofence"):
            pass
        else:
            geo_result = check_inside_geofence(db, latitude, longitude, work_location_id)
            if not geo_result.get("inside", True):
                create_incident(
                    db, employee_id, session.id, "perimeter_exit",
                    f"Empleado fuera del perímetro al entrar. Distancia: {geo_result.get('distance_meters', '?')}m",
                    severity="warning", latitude=latitude, longitude=longitude,
                )

    if wifi_ssid:
        from app.models import WifiCheck
        corporate_ssid = db.query(WorkLocation).filter(
            WorkLocation.id == work_location_id
        ).first()
        expected = corporate_ssid.wifi_ssid if corporate_ssid else None
        wifi_check = WifiCheck(
            work_session_id=session.id,
            employee_id=employee_id,
            checked_at=local_now,
            expected_ssid=expected,
            actual_ssid=wifi_ssid,
            is_connected=True,
        )
        db.add(wifi_check)
        if expected and wifi_ssid != expected and not has_active_permission(db, employee_id, "wifi"):
            create_incident(
                db, employee_id, session.id, "wifi_disconnect",
                f"Wi-Fi incorrecto. Esperado: {expected}, Actual: {wifi_ssid}",
                severity="info",
            )

    from app.services.presence import schedule_random_checks, is_employee_exempt
    if not is_employee_exempt(db, employee_id):
        work_end = local_now + timedelta(hours=9)
        schedule_random_checks(db, session.id, employee_id, local_now, work_end, count=4)

    db.commit()


@router.get("/check-late/{employee_id}")
def check_late(employee_id: int, tz_offset: Optional[int] = Query(None)):
    utc_now = datetime.utcnow()
    now = utc_now - timedelta(minutes=tz_offset) if tz_offset is not None else utc_now
    scheduled = now.replace(hour=SCHEDULE_START_HOUR, minute=SCHEDULE_START_MINUTE, second=0, microsecond=0)
    grace = scheduled.replace(minute=SCHEDULE_START_MINUTE + GRACE_MINUTES)
    return {
        "is_late": now > grace,
        "scheduled": f"{SCHEDULE_START_HOUR:02d}:{SCHEDULE_START_MINUTE:02d}",
        "grace_end": f"{SCHEDULE_START_HOUR:02d}:{SCHEDULE_START_MINUTE + GRACE_MINUTES:02d}",
        "current_time": now.strftime("%H:%M"),
    }


@router.post("/clock-out", response_model=AttendanceResponse)
def clock_out(employee_id: int = Query(...), tz_offset: Optional[int] = Query(None), db: Session = Depends(get_db)):
    utc_now = datetime.utcnow()
    local_now = utc_now - timedelta(minutes=tz_offset) if tz_offset is not None else utc_now
    today = local_now.date()
    record = (
        db.query(AttendanceRecord)
        .options(joinedload(AttendanceRecord.employee))
        .filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date == today,
            AttendanceRecord.entry_time.isnot(None),
            AttendanceRecord.exit_time.is_(None),
        )
        .order_by(AttendanceRecord.id.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=400, detail="No tiene entrada activa para cerrar")
    record.exit_time = local_now.time()
    record.synced = False
    db.commit()
    db.refresh(record)

    session = db.query(WorkSession).filter(
        WorkSession.employee_id == employee_id,
        WorkSession.date == today,
        WorkSession.status == "active",
    ).first()
    if session:
        session.end_time = local_now
        session.status = "completed"
        session.total_hours = round((local_now - session.start_time).total_seconds() / 3600, 2)
        db.commit()

    _try_sync(db)
    return _record_to_response(record)


@router.post("/break-start", response_model=AttendanceResponse)
def break_start(employee_id: int = Query(...), tz_offset: Optional[int] = Query(None), db: Session = Depends(get_db)):
    utc_now = datetime.utcnow()
    local_now = utc_now - timedelta(minutes=tz_offset) if tz_offset is not None else utc_now
    today = local_now.date()
    record = (
        db.query(AttendanceRecord)
        .options(joinedload(AttendanceRecord.employee))
        .filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date == today,
            AttendanceRecord.entry_time.isnot(None),
            AttendanceRecord.exit_time.is_(None),
        )
        .order_by(AttendanceRecord.id.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=400, detail="No tiene entrada activa")
    if record.break_start and not record.break_end:
        raise HTTPException(status_code=400, detail="Ya está en descanso")
    record.break_start = local_now.time()
    record.break_end = None
    record.synced = False
    db.commit()
    db.refresh(record)
    _try_sync(db)
    return _record_to_response(record)


@router.post("/break-end", response_model=AttendanceResponse)
def break_end(employee_id: int = Query(...), tz_offset: Optional[int] = Query(None), db: Session = Depends(get_db)):
    utc_now = datetime.utcnow()
    local_now = utc_now - timedelta(minutes=tz_offset) if tz_offset is not None else utc_now
    today = local_now.date()
    record = (
        db.query(AttendanceRecord)
        .options(joinedload(AttendanceRecord.employee))
        .filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date == today,
            AttendanceRecord.entry_time.isnot(None),
            AttendanceRecord.exit_time.is_(None),
        )
        .order_by(AttendanceRecord.id.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=400, detail="No tiene entrada activa")
    if not record.break_start:
        raise HTTPException(status_code=400, detail="No inició descanso")
    if record.break_end:
        raise HTTPException(status_code=400, detail="Ya terminó el descanso")
    record.break_end = local_now.time()
    record.synced = False
    db.commit()
    db.refresh(record)
    _try_sync(db)
    return _record_to_response(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    db.delete(record)
    db.commit()


class SyncMark(BaseModel):
    employee_ids: list[int] = []
    record_ids: list[int] = []


@router.post("/sync/mark")
def mark_data(data: SyncMark, db: Session = Depends(get_db)):
    return {"status": "ok", "message": "Sync no longer needed - Supabase is primary"}


class SyncPush(BaseModel):
    supabase_url: str


@router.post("/sync/push")
def sync_push(data: SyncPush, db: Session = Depends(get_db)):
    try:
        result = push_to_supabase(data.supabase_url, db)
        return {"status": "ok", "pushed": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pending-scan")
def create_pending_scan(employee_id: int, db: Session = Depends(get_db)):
    db.query(PendingScan).filter(
        PendingScan.employee_id == employee_id,
        PendingScan.status == "pending"
    ).update({"status": "expired"})
    scan = PendingScan(employee_id=employee_id, status="pending")
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return {"id": scan.id, "employee_id": scan.employee_id, "status": scan.status}


@router.get("/pending-scan/{employee_id}")
def get_pending_scan(employee_id: int, db: Session = Depends(get_db)):
    scan = db.query(PendingScan).filter(
        PendingScan.employee_id == employee_id,
        PendingScan.status == "pending"
    ).first()
    if not scan:
        return {"pending": False}
    return {"pending": True, "scan_id": scan.id, "created_at": scan.created_at.isoformat()}


@router.post("/pending-scan/dismiss")
def dismiss_pending_scan(scan_id: int, employee_id: int, db: Session = Depends(get_db)):
    scan = db.query(PendingScan).filter(
        PendingScan.id == scan_id,
        PendingScan.employee_id == employee_id,
        PendingScan.status == "pending"
    ).first()
    if not scan:
        return {"status": "ok"}
    scan.status = "expired"
    db.commit()
    return {"status": "ok"}


@router.post("/pending-scan/respond")
def respond_pending_scan(scan_id: int, action: str, employee_id: int, tz_offset: Optional[int] = Query(None), db: Session = Depends(get_db)):
    scan = db.query(PendingScan).filter(
        PendingScan.id == scan_id,
        PendingScan.employee_id == employee_id,
        PendingScan.status == "pending"
    ).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Escaneo no encontrado o ya respondido")

    utc_now = datetime.utcnow()
    local_now = utc_now - timedelta(minutes=tz_offset) if tz_offset is not None else utc_now
    today = local_now.date()

    if action == "clock_in":
        late = local_now.time() > time(8, 10)
        record = AttendanceRecord(employee_id=employee_id, date=today, entry_time=local_now.time(), late=late, synced=False)
        db.add(record)
        db.flush()
        _create_session_and_checks(db, employee_id, None, None, None, "qr_scan", local_now)
        _try_sync(db)
        scan.status = "completed"
        scan.action_type = "clock_in"
        db.commit()
        return {"status": "ok", "action": "entrada"}

    elif action == "clock_out":
        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date == today,
            AttendanceRecord.entry_time.isnot(None),
            AttendanceRecord.exit_time.is_(None),
        ).order_by(AttendanceRecord.id.desc()).first()
        if record:
            record.exit_time = local_now.time()
            record.synced = False
        session = db.query(WorkSession).filter(WorkSession.employee_id == employee_id, WorkSession.date == today, WorkSession.status == "active").first()
        if session:
            session.end_time = local_now
            session.status = "completed"
            session.total_hours = round((local_now - session.start_time).total_seconds() / 3600, 2)
        _try_sync(db)
        scan.status = "completed"
        scan.action_type = "clock_out"
        db.commit()
        return {"status": "ok", "action": "salida"}

    elif action == "break_start":
        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date == today,
            AttendanceRecord.entry_time.isnot(None),
            AttendanceRecord.exit_time.is_(None),
        ).order_by(AttendanceRecord.id.desc()).first()
        if record:
            record.break_start = local_now.time()
            record.synced = False
        _try_sync(db)
        scan.status = "completed"
        scan.action_type = "break_start"
        db.commit()
        return {"status": "ok", "action": "descanso_iniciado"}

    elif action == "break_end":
        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date == today,
            AttendanceRecord.entry_time.isnot(None),
            AttendanceRecord.exit_time.is_(None),
        ).order_by(AttendanceRecord.id.desc()).first()
        if record:
            record.break_end = local_now.time()
            record.synced = False
        _try_sync(db)
        scan.status = "completed"
        scan.action_type = "break_end"
        db.commit()
        return {"status": "ok", "action": "descanso_finalizado"}

    else:
        raise HTTPException(status_code=400, detail="Accion no valida")
