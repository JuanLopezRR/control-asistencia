import math
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import WorkLocation, WorkSession, PerimeterEvent, Incident, SpecialStatus


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def check_inside_geofence(db: Session, latitude: float, longitude: float, work_location_id: int = None) -> dict:
    if work_location_id:
        location = db.query(WorkLocation).filter(WorkLocation.id == work_location_id, WorkLocation.active == True).first()
        if not location:
            return {"inside": False, "distance_meters": 999999, "work_location": None}
        dist = haversine_distance(latitude, longitude, location.latitude, location.longitude)
        return {"inside": dist <= location.radius_meters, "distance_meters": round(dist, 2), "work_location": location}

    locations = db.query(WorkLocation).filter(WorkLocation.active == True).all()
    for loc in locations:
        dist = haversine_distance(latitude, longitude, loc.latitude, loc.longitude)
        if dist <= loc.radius_meters:
            return {"inside": True, "distance_meters": round(dist, 2), "work_location": loc}

    min_dist = float('inf')
    closest = None
    for loc in locations:
        dist = haversine_distance(latitude, longitude, loc.latitude, loc.longitude)
        if dist < min_dist:
            min_dist = dist
            closest = loc
    return {"inside": False, "distance_meters": round(min_dist, 2), "work_location": closest}


def has_active_permission(db: Session, employee_id: int, check_type: str = "geofence") -> bool:
    now = datetime.now()
    statuses = db.query(SpecialStatus).filter(
        SpecialStatus.employee_id == employee_id,
        SpecialStatus.start_datetime <= now,
        (SpecialStatus.end_datetime == None) | (SpecialStatus.end_datetime >= now)
    ).all()
    for s in statuses:
        if check_type == "geofence" and s.geofence_exempt:
            return True
        if check_type == "wifi" and s.wifi_exempt:
            return True
        if check_type == "check" and s.check_exempt:
            return True
    return False


def register_perimeter_event(db: Session, work_session_id: int, employee_id: int, event_type: str,
                             latitude: float = None, longitude: float = None,
                             reason: str = None, authorized_by: str = None) -> PerimeterEvent:
    event = PerimeterEvent(
        work_session_id=work_session_id,
        employee_id=employee_id,
        event_type=event_type,
        latitude=latitude,
        longitude=longitude,
        timestamp=datetime.now(),
        reason=reason,
        authorized_by=authorized_by
    )
    db.add(event)
    db.flush()
    return event


def create_incident(db: Session, employee_id: int, work_session_id: int, incident_type: str,
                    description: str, severity: str = "warning",
                    latitude: float = None, longitude: float = None) -> Incident:
    incident = Incident(
        employee_id=employee_id,
        work_session_id=work_session_id,
        incident_type=incident_type,
        severity=severity,
        description=description,
        latitude=latitude,
        longitude=longitude,
        timestamp=datetime.now()
    )
    db.add(incident)
    db.flush()
    return incident
