import sqlite3

db = sqlite3.connect(r"C:\Users\Juan LR\Documents\ENTRADA Y SALIDA\backend\attendance.db")
c = db.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = c.fetchall()
print("Tables:", tables)

for t in tables:
    c.execute(f"PRAGMA table_info({t[0]})")
    cols = c.fetchall()
    print(f"\n{t[0]}:")
    for col in cols:
        print(f"  {col[1]} ({col[2]})")

db.close()
