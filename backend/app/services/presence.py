import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models import WorkSession, PresenceCheck, Employee, SpecialStatus


def schedule_random_checks(db: Session, work_session_id: int, employee_id: int, work_start: datetime, work_end: datetime, count: int = 4):
    duration = (work_end - work_start).total_seconds()
    if duration <= 0:
        return []

    min_interval = 1800
    if duration / count < min_interval:
        count = max(1, int(duration / min_interval))

    existing = db.query(PresenceCheck).filter(
        PresenceCheck.work_session_id == work_session_id
    ).count()
    if existing > 0:
        return []

    checks = []
    for _ in range(count):
        offset = random.randint(int(min_interval), int(duration - 300))
        scheduled_at = work_start + timedelta(seconds=offset)
        check = PresenceCheck(
            employee_id=employee_id,
            work_session_id=work_session_id,
            scheduled_at=scheduled_at,
            timeout_seconds=120
        )
        db.add(check)
        checks.append(check)

    db.flush()
    return checks


def respond_to_check(db: Session, check_id: int, response_method: str = "selfie_face_gps",
                     selfie_url: str = None, response_lat: float = None,
                     response_lng: float = None, response_wifi_ssid: str = None,
                     tz_offset: int = None) -> PresenceCheck:
    check = db.query(PresenceCheck).filter(PresenceCheck.id == check_id).first()
    if not check:
        raise ValueError("Verificación no encontrada")
    if check.status != "pending":
        raise ValueError("Esta verificación ya fue respondida")

    if tz_offset is not None:
        utc_now = datetime.utcnow()
        now = utc_now - timedelta(minutes=tz_offset)
    else:
        now = datetime.now()

    time_diff = (now - check.scheduled_at).total_seconds()

    if time_diff > check.timeout_seconds:
        check.status = "expired"
        check.responded_at = now
        db.flush()
        return check

    check.responded_at = now
    check.status = "confirmed"
    check.response_method = response_method
    check.selfie_url = selfie_url
    check.response_lat = response_lat
    check.response_lng = response_lng
    check.response_wifi_ssid = response_wifi_ssid
    db.flush()
    return check


def check_missed_verifications(db: Session) -> list:
    now = datetime.utcnow()
    pending = db.query(PresenceCheck).filter(
        PresenceCheck.status == "pending",
        PresenceCheck.scheduled_at < now,
    ).all()

    missed = []
    for check in pending:
        elapsed = (now - check.scheduled_at).total_seconds()
        if elapsed > (check.timeout_seconds or 120):
            check.status = "missed"
            check.responded_at = None
            missed.append(check)

    if missed:
        db.flush()
    return missed


def get_pending_checks(db: Session, employee_id: int = None) -> list:
    now = datetime.utcnow()
    query = db.query(PresenceCheck).filter(
        PresenceCheck.status == "pending",
        PresenceCheck.scheduled_at <= now,
    )
    if employee_id:
        query = query.filter(PresenceCheck.employee_id == employee_id)
    all_pending = query.all()
    return [c for c in all_pending if (now - c.scheduled_at).total_seconds() <= (c.timeout_seconds or 120)]


def is_employee_exempt(db: Session, employee_id: int) -> bool:
    now = datetime.utcnow()
    return db.query(SpecialStatus).filter(
        SpecialStatus.employee_id == employee_id,
        SpecialStatus.check_exempt == True,
        SpecialStatus.start_datetime <= now,
        (SpecialStatus.end_datetime == None) | (SpecialStatus.end_datetime >= now)
    ).first() is not None
