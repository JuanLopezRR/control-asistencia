import os
import uvicorn
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    reload_enabled = os.getenv("APP_ENV") != "production"
    uvicorn.run("app.main:app", host=host, port=port, reload=reload_enabled)
