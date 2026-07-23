import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from app.models import (
    Employee, AttendanceRecord, WorkLocation, WorkSession,
    PerimeterEvent, PresenceCheck, WifiCheck, Incident,
    SpecialStatus, SystemConfig, Base
)

log = logging.getLogger(__name__)


def push_to_supabase(supabase_url: str, local_db: Session) -> dict:
    supabase_engine = create_engine(supabase_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=supabase_engine)
    SupabaseSession = sessionmaker(bind=supabase_engine)
    sb_db = SupabaseSession()

    pushed = {"employees": 0, "records": 0, "locations": 0, "sessions": 0, "deleted": 0}

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
                local_rows = local_db.query(model).all()
                for row in local_rows:
                    data = {c.name: getattr(row, c.name) for c in model.__table__.columns}
                    existing = sb_db.query(model).filter(model.id == data["id"]).first()
                    if existing:
                        for k, v in data.items():
                            if k != "id":
                                setattr(existing, k, v)
                    else:
                        sb_db.merge(model(**data))
                sb_db.commit()
                if table_name in pushed:
                    pushed[table_name] = len(local_rows)
            except Exception as e:
                log.warning(f"Error pushing {table_name}: {e}")
                sb_db.rollback()

        return pushed
    except Exception as e:
        log.error(f"Error pushing to Supabase: {e}")
        return {"error": str(e)}
    finally:
        sb_db.close()
