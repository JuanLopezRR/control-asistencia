import threading
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.database import engine, Base, SessionLocal
from app.routers import employees, attendance, locations, sessions, geofence, presence, wifi, incidents, permissions
from app.sync_config import get_supabase_url, set_supabase_url
from app.config import get_settings

settings = get_settings()

Base.metadata.create_all(bind=engine)

SYNC_INTERVAL = 30


def auto_sync_loop():
    from app.sync_pull import pull_from_supabase
    from app.sync import push_to_supabase
    while True:
        time.sleep(SYNC_INTERVAL)
        try:
            url = get_supabase_url()
            if not url:
                continue
            db = SessionLocal()
            try:
                push_to_supabase(url, db)
                pull_from_supabase(url)
            finally:
                db.close()
        except Exception:
            pass


app = FastAPI(
    title="Control de Entrada y Salida",
    description="Sistema de registro de entrada, salida y descansos de empleados",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(locations.router)
app.include_router(sessions.router)
app.include_router(geofence.router)
app.include_router(presence.router)
app.include_router(wifi.router)
app.include_router(incidents.router)
app.include_router(permissions.router)


@app.on_event("startup")
def start_sync_thread():
    from app.sync_pull import pull_from_supabase
    url = get_supabase_url()
    if url:
        try:
            pull_from_supabase(url)
        except Exception:
            pass
        t = threading.Thread(target=auto_sync_loop, daemon=True)
        t.start()


class SupabaseConfig(BaseModel):
    url: str


@app.post("/api/sync/configure")
def configure_sync(data: SupabaseConfig):
    set_supabase_url(data.url)
    from app.sync_pull import pull_from_supabase
    try:
        pull_from_supabase(data.url)
    except Exception:
        pass
    t = threading.Thread(target=auto_sync_loop, daemon=True)
    t.start()
    return {"status": "ok", "message": "Sincronización automática activa (cada 30 segundos)"}


@app.get("/api/sync/status")
def sync_status():
    url = get_supabase_url()
    return {"configured": url is not None, "syncing": url is not None}


@app.get("/api/health")
def health():
    return {"status": "ok"}
