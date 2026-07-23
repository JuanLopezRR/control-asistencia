import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from app.models import (
    Employee, AttendanceRecord, WorkLocation, WorkSession,
    PerimeterEvent, PresenceCheck, WifiCheck, Incident,
    SpecialStatus, SystemConfig, Base
)

log = logging.getLogger(__name__)

SQLITE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "attendance.db"
)


def get_sqlite_engine():
    return create_engine(f"sqlite:///{SQLITE_PATH}", connect_args={"check_same_thread": False})


def pull_from_supabase(supabase_url: str) -> dict:
    supa_engine = create_engine(supabase_url, pool_pre_ping=True)
    SupaSession = sessionmaker(bind=supa_engine)
    supa_db = SupaSession()

    sqlite_engine = get_sqlite_engine()
    Base.metadata.create_all(bind=sqlite_engine)
    LiteSession = sessionmaker(bind=sqlite_engine)
    lite_db = LiteSession()

    pulled = {"employees": 0, "records": 0, "locations": 0, "sessions": 0}

    try:
        models = [
            (Employee, "employees"),
            (AttendanceRecord, "attendance_records"),
            (WorkLocation, "work_locations"),
            (WorkSession, "work_sessions"),
            (PerimeterEvent, "perimeter_events"),
            (PresenceCheck, "presence_checks"),
            (WifiCheck, "wifi_checks"),
            (Incident, "incidents"),
            (SpecialStatus, "special_statuses"),
            (SystemConfig, "system_config"),
        ]

        for model, table_name in models:
            try:
                remote_rows = supa_db.query(model).all()
                for row in remote_rows:
                    data = {c.name: getattr(row, c.name) for c in model.__table__.columns}
                    existing = lite_db.query(model).filter(model.id == data["id"]).first()
                    if existing:
                        for k, v in data.items():
                            if k != "id":
                                setattr(existing, k, v)
                    else:
                        lite_db.merge(model(**data))
                lite_db.commit()
                if table_name in ["employees", "attendance_records", "work_locations", "work_sessions"]:
                    pulled[table_name] = len(remote_rows)
            except Exception as e:
                log.warning(f"Error pulling {table_name}: {e}")
                lite_db.rollback()

        local_emp_ids = {e.id for e in lite_db.query(Employee).all()}
        remote_emp_ids = {e.id for e in supa_db.query(Employee).all()}
        to_delete = local_emp_ids - remote_emp_ids
        if to_delete:
            lite_db.query(AttendanceRecord).filter(
                AttendanceRecord.employee_id.in_(to_delete)
            ).delete(synchronize_session=False)
            lite_db.query(Employee).filter(
                Employee.id.in_(to_delete)
            ).delete(synchronize_session=False)
            lite_db.commit()
            log.info(f"Deleted {len(to_delete)} orphaned employees from SQLite backup")

        return pulled
    except Exception as e:
        log.error(f"Error pulling from Supabase: {e}")
        return {"error": str(e)}
    finally:
        supa_db.close()
        lite_db.close()
