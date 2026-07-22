from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.models import Employee, AttendanceRecord, WorkSession, WorkLocation, Incident
from app.schemas import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from app.services.geofence import check_inside_geofence, has_active_permission

router = APIRouter(prefix="/api/employees", tags=["employees"])


@router.get("/", response_model=List[EmployeeResponse])
def list_employees(search: str = "", active: bool = None, db: Session = Depends(get_db)):
    query = db.query(Employee)
    if search:
        query = query.filter(
            Employee.name.ilike(f"%{search}%") | Employee.email.ilike(f"%{search}%")
        )
    if active is not None:
        query = query.filter(Employee.active == active)
    return query.order_by(Employee.name).all()


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return employee


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    existing = db.query(Employee).filter(Employee.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    employee = Employee(**data.model_dump(), synced=False)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: int, data: EmployeeUpdate, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(employee, key, value)
    employee.synced = False
    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    db.delete(employee)
    db.commit()


class FaceData(BaseModel):
    descriptor: str


@router.post("/{employee_id}/face")
def register_face(employee_id: int, data: FaceData, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    employee.face_descriptor = data.descriptor
    employee.synced = False
    db.commit()
    return {"status": "ok", "message": f"Cara registrada para {employee.name}"}


@router.get("/{employee_id}/face")
def get_face(employee_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return {"descriptor": employee.face_descriptor}


@router.get("/faces/all")
def get_all_faces(db: Session = Depends(get_db)):
    employees = db.query(Employee).filter(Employee.active == True, Employee.face_descriptor.isnot(None)).all()
    return [
        {"id": e.id, "name": e.name, "descriptor": e.face_descriptor}
        for e in employees
    ]


@router.get("/{employee_id}/app")
def employee_app_data(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    today = date.today()
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.employee_id == employee_id,
        AttendanceRecord.date == today,
    ).first()

    session = db.query(WorkSession).filter(
        WorkSession.employee_id == employee_id,
        WorkSession.status == "active",
    ).first()

    total_hours_today = 0.0
    if session:
        elapsed = (datetime.now() - session.start_time).total_seconds() / 3600
        total_hours_today = round(elapsed, 2)

    completed_sessions = db.query(WorkSession).filter(
        WorkSession.employee_id == employee_id,
        WorkSession.date == today,
        WorkSession.status == "completed",
    ).all()
    for s in completed_sessions:
        total_hours_today += s.total_hours or 0

    pending_incidents = db.query(Incident).filter(
        Incident.employee_id == employee_id,
        Incident.resolved == False,
    ).count()

    locations = db.query(WorkLocation).filter(WorkLocation.active == True).all()
    location_list = [
        {"id": l.id, "name": l.name, "latitude": l.latitude, "longitude": l.longitude, "radius_meters": l.radius_meters}
        for l in locations
    ]

    return {
        "employee": {
            "id": emp.id,
            "name": emp.name,
            "email": emp.email,
            "position": emp.position,
            "phone": emp.phone,
            "active": emp.active,
        },
        "today_record": {
            "entry_time": record.entry_time.isoformat() if record and record.entry_time else None,
            "exit_time": record.exit_time.isoformat() if record and record.exit_time else None,
            "break_start": record.break_start.isoformat() if record and record.break_start else None,
            "break_end": record.break_end.isoformat() if record and record.break_end else None,
            "late": record.late if record else False,
            "justification": record.justification if record else None,
        } if record else None,
        "active_session_id": session.id if session else None,
        "total_hours_today": total_hours_today,
        "pending_incidents": pending_incidents,
        "work_locations": location_list,
    }
