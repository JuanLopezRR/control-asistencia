import sqlite3

db = sqlite3.connect(r"C:\Users\Juan LR\Documents\ENTRADA Y SALIDA\backend\attendance.db")
c = db.cursor()

for table in ["attendance_records"]:
    c.execute(f"PRAGMA table_info({table})")
    existing = {col[1] for col in c.fetchall()}
    
    for col_name, col_type in [("justification", "TEXT"), ("late", "BOOLEAN")]:
        if col_name not in existing:
            c.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")
            print(f"Added {table}.{col_name}")

c.execute("UPDATE attendance_records SET late = 0 WHERE late IS NULL")
db.commit()
db.close()
print("Done")
