from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models import Incident
from app.schemas import IncidentCreate, IncidentResolve, IncidentResponse

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("/", response_model=List[IncidentResponse])
def list_incidents(
    employee_id: Optional[int] = Query(None),
    incident_type: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(Incident)
    if employee_id:
        q = q.filter(Incident.employee_id == employee_id)
    if incident_type:
        q = q.filter(Incident.incident_type == incident_type)
    if resolved is not None:
        q = q.filter(Incident.resolved == resolved)
    if severity:
        q = q.filter(Incident.severity == severity)
    return q.order_by(Incident.timestamp.desc()).limit(200).all()


@router.post("/", response_model=IncidentResponse)
def create_incident(data: IncidentCreate, db: Session = Depends(get_db)):
    incident = Incident(
        employee_id=data.employee_id,
        work_session_id=data.work_session_id,
        incident_type=data.incident_type,
        severity=data.severity,
        description=data.description,
        latitude=data.latitude,
        longitude=data.longitude,
        timestamp=datetime.now()
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.put("/{incident_id}/resolve", response_model=IncidentResponse)
def resolve_incident(incident_id: int, data: IncidentResolve, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    incident.resolved = True
    incident.resolved_by = data.resolved_by
    incident.resolved_at = datetime.now()
    db.commit()
    db.refresh(incident)
    return incident


@router.get("/stats")
def incident_stats(db: Session = Depends(get_db)):
    total = db.query(Incident).count()
    pending = db.query(Incident).filter(Incident.resolved == False).count()
    by_type = db.query(Incident.incident_type, func.count(Incident.id)).group_by(Incident.incident_type).all()
    by_severity = db.query(Incident.severity, func.count(Incident.id)).group_by(Incident.severity).all()
    return {
        "total": total,
        "pending": pending,
        "resolved": total - pending,
        "by_type": {t: c for t, c in by_type},
        "by_severity": {s: c for s, c in by_severity}
    }
