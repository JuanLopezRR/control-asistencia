from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import WorkLocation
from app.schemas import WorkLocationCreate, WorkLocationUpdate, WorkLocationResponse, GeofenceCheckRequest, GeofenceCheckResponse
from app.services.geofence import check_inside_geofence

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("/", response_model=List[WorkLocationResponse])
def list_locations(db: Session = Depends(get_db)):
    return db.query(WorkLocation).filter(WorkLocation.active == True).all()


@router.post("/", response_model=WorkLocationResponse)
def create_location(data: WorkLocationCreate, db: Session = Depends(get_db)):
    loc = WorkLocation(**data.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.get("/{location_id}", response_model=WorkLocationResponse)
def get_location(location_id: int, db: Session = Depends(get_db)):
    loc = db.query(WorkLocation).filter(WorkLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    return loc


@router.put("/{location_id}", response_model=WorkLocationResponse)
def update_location(location_id: int, data: WorkLocationUpdate, db: Session = Depends(get_db)):
    loc = db.query(WorkLocation).filter(WorkLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(loc, k, v)
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/{location_id}")
def delete_location(location_id: int, db: Session = Depends(get_db)):
    loc = db.query(WorkLocation).filter(WorkLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    loc.active = False
    db.commit()
    return {"ok": True}


@router.post("/check", response_model=GeofenceCheckResponse)
def check_geofence(data: GeofenceCheckRequest, db: Session = Depends(get_db)):
    result = check_inside_geofence(db, data.latitude, data.longitude, data.work_location_id)
    return GeofenceCheckResponse(
        inside=result["inside"],
        distance_meters=result["distance_meters"],
        work_location=result["work_location"]
    )
