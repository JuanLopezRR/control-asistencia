from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from app.models import Employee, AttendanceRecord, Base


def get_unsynced(db: Session) -> dict:
    employees = db.query(Employee).filter(Employee.synced == False).all()
    records = db.query(AttendanceRecord).filter(AttendanceRecord.synced == False).all()
    return {
        "employees": [
            {
                "id": e.id,
                "name": e.name,
                "email": e.email,
                "position": e.position,
                "phone": e.phone,
                "active": e.active,
                "created_at": e.created_at.isoformat(),
                "updated_at": e.updated_at.isoformat(),
            }
            for e in employees
        ],
        "records": [
            {
                "id": r.id,
                "employee_id": r.employee_id,
                "date": r.date.isoformat(),
                "entry_time": r.entry_time.isoformat() if r.entry_time else None,
                "exit_time": r.exit_time.isoformat() if r.exit_time else None,
                "break_start": r.break_start.isoformat() if r.break_start else None,
                "break_end": r.break_end.isoformat() if r.break_end else None,
                "notes": r.notes,
                "justification": r.justification,
                "late": r.late,
                "created_at": r.created_at.isoformat(),
                "updated_at": r.updated_at.isoformat(),
            }
            for r in records
        ],
    }


def mark_synced(db: Session, employee_ids: list[int], record_ids: list[int]):
    if employee_ids:
        db.query(Employee).filter(Employee.id.in_(employee_ids)).update(
            {"synced": True}, synchronize_session=False
        )
    if record_ids:
        db.query(AttendanceRecord).filter(AttendanceRecord.id.in_(record_ids)).update(
            {"synced": True}, synchronize_session=False
        )
    db.commit()


def push_to_supabase(supabase_url: str, local_db: Session) -> dict:
    supabase_engine = create_engine(supabase_url)
    Base.metadata.create_all(bind=supabase_engine)
    SupabaseSession = sessionmaker(bind=supabase_engine)
    sb_db = SupabaseSession()

    try:
        unsynced = get_unsynced(local_db)
        pushed = {"employees": 0, "records": 0, "deleted_employees": 0}

        for emp_data in unsynced["employees"]:
            existing = sb_db.query(Employee).filter(Employee.id == emp_data["id"]).first()
            if existing:
                for k, v in emp_data.items():
                    setattr(existing, k, v)
            else:
                sb_db.add(Employee(**emp_data))
            pushed["employees"] += 1

        for rec_data in unsynced["records"]:
            existing = sb_db.query(AttendanceRecord).filter(AttendanceRecord.id == rec_data["id"]).first()
            if existing:
                for k, v in rec_data.items():
                    setattr(existing, k, v)
            else:
                sb_db.add(AttendanceRecord(**rec_data))
            pushed["records"] += 1

        sb_db.commit()

        local_emp_ids = {e.id for e in local_db.query(Employee).all()}
        supa_emp_ids = {e.id for e in sb_db.query(Employee).all()}
        to_delete = supa_emp_ids - local_emp_ids
        if to_delete:
            sb_db.query(AttendanceRecord).filter(AttendanceRecord.employee_id.in_(to_delete)).delete(synchronize_session=False)
            sb_db.query(Employee).filter(Employee.id.in_(to_delete)).delete(synchronize_session=False)
            sb_db.commit()
            pushed["deleted_employees"] = len(to_delete)

        emp_ids = [e["id"] for e in unsynced["employees"]]
        rec_ids = [r["id"] for r in unsynced["records"]]
        mark_synced(local_db, emp_ids, rec_ids)

        return pushed
    finally:
        sb_db.close()
