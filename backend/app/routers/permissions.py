from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import SpecialStatus
from app.schemas import SpecialStatusCreate, SpecialStatusUpdate, SpecialStatusResponse

router = APIRouter(prefix="/api/permissions", tags=["permissions"])


@router.get("/", response_model=List[SpecialStatusResponse])
def list_permissions(
    employee_id: Optional[int] = Query(None),
    status_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(SpecialStatus)
    if employee_id:
        q = q.filter(SpecialStatus.employee_id == employee_id)
    if status_type:
        q = q.filter(SpecialStatus.status_type == status_type)
    return q.order_by(SpecialStatus.start_datetime.desc()).limit(200).all()


@router.get("/active", response_model=List[SpecialStatusResponse])
def active_permissions(db: Session = Depends(get_db)):
    now = datetime.now()
    return db.query(SpecialStatus).filter(
        SpecialStatus.start_datetime <= now,
        (SpecialStatus.end_datetime == None) | (SpecialStatus.end_datetime >= now)
    ).all()


@router.post("/", response_model=SpecialStatusResponse)
def create_permission(data: SpecialStatusCreate, db: Session = Depends(get_db)):
    perm = SpecialStatus(**data.model_dump())
    db.add(perm)
    db.commit()
    db.refresh(perm)
    return perm


@router.put("/{perm_id}", response_model=SpecialStatusResponse)
def update_permission(perm_id: int, data: SpecialStatusUpdate, db: Session = Depends(get_db)):
    perm = db.query(SpecialStatus).filter(SpecialStatus.id == perm_id).first()
    if not perm:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(perm, k, v)
    db.commit()
    db.refresh(perm)
    return perm


@router.delete("/{perm_id}")
def delete_permission(perm_id: int, db: Session = Depends(get_db)):
    perm = db.query(SpecialStatus).filter(SpecialStatus.id == perm_id).first()
    if not perm:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    db.delete(perm)
    db.commit()
    return {"ok": True}
