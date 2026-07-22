import sqlite3

db = sqlite3.connect(r"C:\Users\Juan LR\Documents\ENTRADA Y SALIDA\backend\attendance.db")
c = db.cursor()

# Check which columns exist and add missing ones
for table in ["employees", "attendance_records"]:
    c.execute(f"PRAGMA table_info({table})")
    existing = {col[1] for col in c.fetchall()}
    
    for col_name, col_type in [("updated_at", "DATETIME"), ("synced", "BOOLEAN")]:
        if col_name not in existing:
            c.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")
            print(f"Added {table}.{col_name}")
        else:
            print(f"{table}.{col_name} already exists")

# Set defaults for existing rows
c.execute("UPDATE employees SET synced = 0 WHERE synced IS NULL")
c.execute("UPDATE attendance_records SET synced = 0 WHERE synced IS NULL")
c.execute("UPDATE employees SET updated_at = created_at WHERE updated_at IS NULL")
c.execute("UPDATE attendance_records SET updated_at = created_at WHERE updated_at IS NULL")

db.commit()
db.close()
print("Done")
