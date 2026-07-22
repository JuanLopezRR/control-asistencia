from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import PerimeterEvent, WorkSession, Employee
from app.schemas import PerimeterEventCreate, PerimeterEventResponse
from app.services.geofence import register_perimeter_event, create_incident, has_active_permission, check_inside_geofence

router = APIRouter(prefix="/api/geofence", tags=["geofence"])


@router.get("/events", response_model=List[PerimeterEventResponse])
def list_events(
    employee_id: Optional[int] = Query(None),
    session_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(PerimeterEvent)
    if employee_id:
        q = q.filter(PerimeterEvent.employee_id == employee_id)
    if session_id:
        q = q.filter(PerimeterEvent.work_session_id == session_id)
    return q.order_by(PerimeterEvent.timestamp.desc()).limit(200).all()


@router.post("/check")
def check_location(latitude: float, longitude: float, employee_id: int, db: Session = Depends(get_db)):
    session = db.query(WorkSession).filter(
        WorkSession.employee_id == employee_id,
        WorkSession.status == "active"
    ).first()
    if not session:
        return {"inside": True, "message": "Sin sesión activa"}

    if has_active_permission(db, employee_id, "geofence"):
        return {"inside": True, "message": "Exento por permiso especial"}

    result = check_inside_geofence(db, latitude, longitude, session.work_location_id)
    return result


@router.post("/exit", response_model=PerimeterEventResponse)
def register_exit(data: PerimeterEventCreate, db: Session = Depends(get_db)):
    if has_active_permission(db, data.employee_id, "geofence"):
        event = register_perimeter_event(db, data.work_session_id, data.employee_id, "authorized_exit",
                                         data.latitude, data.longitude, data.reason, data.authorized_by)
        db.commit()
        db.refresh(event)
        return event

    event = register_perimeter_event(db, data.work_session_id, data.employee_id, "exit",
                                     data.latitude, data.longitude, data.reason, data.authorized_by)
    create_incident(db, data.employee_id, data.work_session_id, "perimeter_exit",
                    "Empleado salió del perímetro de trabajo",
                    latitude=data.latitude, longitude=data.longitude)
    db.commit()
    db.refresh(event)
    return event


@router.post("/return", response_model=PerimeterEventResponse)
def register_return(data: PerimeterEventCreate, db: Session = Depends(get_db)):
    event = register_perimeter_event(db, data.work_session_id, data.employee_id, "return",
                                     data.latitude, data.longitude)
    db.commit()
    db.refresh(event)
    return event
