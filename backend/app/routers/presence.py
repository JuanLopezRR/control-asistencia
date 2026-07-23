from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import PresenceCheck, WorkSession, Employee
from app.schemas import PresenceCheckSchedule, PresenceCheckRespond, PresenceCheckResponse
from app.services.presence import respond_to_check, check_missed_verifications, get_pending_checks

router = APIRouter(prefix="/api/presence", tags=["presence"])


@router.get("/pending", response_model=List[PresenceCheckResponse])
def list_pending(employee_id: Optional[int] = Query(None), tz_offset: Optional[int] = Query(None), db: Session = Depends(get_db)):
    check_missed_verifications(db)
    db.commit()
    return get_pending_checks(db, employee_id)


@router.get("/history", response_model=List[PresenceCheckResponse])
def list_history(
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(PresenceCheck)
    if employee_id:
        q = q.filter(PresenceCheck.employee_id == employee_id)
    if status:
        q = q.filter(PresenceCheck.status == status)
    return q.order_by(PresenceCheck.scheduled_at.desc()).limit(200).all()


@router.post("/respond", response_model=PresenceCheckResponse)
def respond_check(data: PresenceCheckRespond, tz_offset: Optional[int] = Query(None), db: Session = Depends(get_db)):
    try:
        check = respond_to_check(db, data.check_id, data.response_method,
                                 data.selfie_url, data.response_lat,
                                 data.response_lng, data.response_wifi_ssid,
                                 tz_offset=tz_offset)
        db.commit()
        db.refresh(check)
        return check
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/check-missed")
def check_missed(db: Session = Depends(get_db)):
    missed = check_missed_verifications(db)
    db.commit()
    return {"missed_count": len(missed)}


@router.post("/schedule")
def schedule_check(
    employee_id: int = Query(...),
    timeout_seconds: int = Query(120),
    tz_offset: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    if tz_offset is not None:
        utc_now = datetime.utcnow()
        local_now = utc_now - timedelta(minutes=tz_offset)
    else:
        local_now = datetime.utcnow()

    session = db.query(WorkSession).filter(
        WorkSession.employee_id == employee_id,
        WorkSession.date == local_now.date(),
        WorkSession.status == "active",
    ).first()
    if not session:
        raise HTTPException(status_code=400, detail="El empleado no tiene sesion activa hoy")

    check = PresenceCheck(
        employee_id=employee_id,
        work_session_id=session.id,
        scheduled_at=local_now,
        timeout_seconds=timeout_seconds,
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    return {"status": "ok", "check_id": check.id, "employee": emp.name, "scheduled_at": check.scheduled_at.isoformat()}


@router.options("/schedule")
def schedule_check_options():
    return {}
