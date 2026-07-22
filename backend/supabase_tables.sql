-- Tabla de ubicaciones de trabajo (geocerca)
CREATE TABLE IF NOT EXISTS work_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER DEFAULT 100,
    wifi_ssid VARCHAR(200),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de sesiones de trabajo
CREATE TABLE IF NOT EXISTS work_sessions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    work_location_id INTEGER REFERENCES work_locations(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    entry_method VARCHAR(50),
    entry_location_lat DOUBLE PRECISION,
    entry_location_lng DOUBLE PRECISION,
    entry_wifi_ssid VARCHAR(200),
    exit_method VARCHAR(50),
    exit_location_lat DOUBLE PRECISION,
    exit_location_lng DOUBLE PRECISION,
    exit_wifi_ssid VARCHAR(200),
    total_hours DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de eventos de perímetro
CREATE TABLE IF NOT EXISTS perimeter_events (
    id SERIAL PRIMARY KEY,
    work_session_id INTEGER REFERENCES work_sessions(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timestamp TIMESTAMP NOT NULL,
    reason TEXT,
    authorized_by VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de validaciones aleatorias
CREATE TABLE IF NOT EXISTS presence_checks (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    work_session_id INTEGER REFERENCES work_sessions(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP NOT NULL,
    responded_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    response_method VARCHAR(50),
    selfie_url TEXT,
    response_lat DOUBLE PRECISION,
    response_lng DOUBLE PRECISION,
    response_wifi_ssid VARCHAR(200),
    timeout_seconds INTEGER DEFAULT 120,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de verificaciones Wi-Fi
CREATE TABLE IF NOT EXISTS wifi_checks (
    id SERIAL PRIMARY KEY,
    work_session_id INTEGER REFERENCES work_sessions(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    checked_at TIMESTAMP NOT NULL,
    expected_ssid VARCHAR(200) NOT NULL,
    actual_ssid VARCHAR(200),
    is_connected BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de incidencias
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    work_session_id INTEGER REFERENCES work_sessions(id) ON DELETE SET NULL,
    incident_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning',
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timestamp TIMESTAMP NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(200),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de permisos especiales
CREATE TABLE IF NOT EXISTS special_statuses (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    status_type VARCHAR(30) NOT NULL,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP,
    reason TEXT,
    authorized_by VARCHAR(200),
    geofence_exempt BOOLEAN DEFAULT FALSE,
    wifi_exempt BOOLEAN DEFAULT FALSE,
    check_exempt BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_work_sessions_employee ON work_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_date ON work_sessions(date);
CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON work_sessions(status);
CREATE INDEX IF NOT EXISTS idx_perimeter_events_session ON perimeter_events(work_session_id);
CREATE INDEX IF NOT EXISTS idx_presence_checks_employee ON presence_checks(employee_id);
CREATE INDEX IF NOT EXISTS idx_presence_checks_status ON presence_checks(status);
CREATE INDEX IF NOT EXISTS idx_incidents_employee ON incidents(employee_id);
CREATE INDEX IF NOT EXISTS idx_incidents_resolved ON incidents(resolved);
CREATE INDEX IF NOT EXISTS idx_special_statuses_employee ON special_statuses(employee_id);
