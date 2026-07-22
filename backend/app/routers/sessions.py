from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import WorkSession, Employee
from app.schemas import WorkSessionCreate, WorkSessionEnd, WorkSessionResponse

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("/", response_model=List[WorkSessionResponse])
def list_sessions(
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(WorkSession)
    if employee_id:
        q = q.filter(WorkSession.employee_id == employee_id)
    if status:
        q = q.filter(WorkSession.status == status)
    if date_from:
        q = q.filter(WorkSession.date >= date_from)
    if date_to:
        q = q.filter(WorkSession.date <= date_to)
    return q.order_by(WorkSession.start_time.desc()).limit(200).all()


@router.get("/active", response_model=List[WorkSessionResponse])
def active_sessions(db: Session = Depends(get_db)):
    return db.query(WorkSession).filter(WorkSession.status == "active").all()


@router.get("/{session_id}", response_model=WorkSessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(WorkSession).filter(WorkSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return s


@router.post("/start", response_model=WorkSessionResponse)
def start_session(data: WorkSessionCreate, db: Session = Depends(get_db)):
    today = date.today()
    existing = db.query(WorkSession).filter(
        WorkSession.employee_id == data.employee_id,
        WorkSession.date == today,
        WorkSession.status == "active"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="El empleado ya tiene una sesión activa hoy")

    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    session = WorkSession(
        employee_id=data.employee_id,
        work_location_id=data.work_location_id,
        date=today,
        start_time=datetime.now(),
        status="active",
        entry_method=data.entry_method,
        entry_location_lat=data.entry_location_lat,
        entry_location_lng=data.entry_location_lng,
        entry_wifi_ssid=data.entry_wifi_ssid
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/end", response_model=WorkSessionResponse)
def end_session(session_id: int, data: WorkSessionEnd, db: Session = Depends(get_db)):
    session = db.query(WorkSession).filter(WorkSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada")

    now = datetime.now()
    session.end_time = now
    session.status = "completed"
    session.exit_method = data.exit_method
    session.exit_location_lat = data.exit_location_lat
    session.exit_location_lng = data.exit_location_lng
    session.exit_wifi_ssid = data.exit_wifi_ssid
    session.total_hours = round((now - session.start_time).total_seconds() / 3600, 2)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(WorkSession).filter(WorkSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    db.delete(session)
    db.commit()
    return {"ok": True}
