from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import WifiCheck, WorkSession, Incident
from app.schemas import WifiCheckCreate, WifiCheckResponse

router = APIRouter(prefix="/api/wifi", tags=["wifi"])


@router.get("/history", response_model=List[WifiCheckResponse])
def list_history(
    employee_id: Optional[int] = Query(None),
    session_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(WifiCheck)
    if employee_id:
        q = q.filter(WifiCheck.employee_id == employee_id)
    if session_id:
        q = q.filter(WifiCheck.work_session_id == session_id)
    return q.order_by(WifiCheck.checked_at.desc()).limit(200).all()


@router.post("/check", response_model=WifiCheckResponse)
def check_wifi(data: WifiCheckCreate, db: Session = Depends(get_db)):
    check = WifiCheck(
        work_session_id=data.work_session_id,
        employee_id=data.employee_id,
        checked_at=datetime.now(),
        expected_ssid=data.expected_ssid,
        actual_ssid=data.actual_ssid,
        is_connected=data.is_connected
    )
    db.add(check)
    db.flush()

    if data.is_connected is False or (data.actual_ssid and data.actual_ssid != data.expected_ssid):
        session = db.query(WorkSession).filter(WorkSession.id == data.work_session_id).first()
        incident = Incident(
            employee_id=data.employee_id,
            work_session_id=data.work_session_id,
            incident_type="wifi_disconnect",
            severity="info",
            description=f"Desconectado del Wi-Fi corporativo. Esperado: {data.expected_ssid}, Actual: {data.actual_ssid or 'Ninguno'}",
            timestamp=datetime.now()
        )
        db.add(incident)

    db.commit()
    db.refresh(check)
    return check
