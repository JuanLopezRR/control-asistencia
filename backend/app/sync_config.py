import os
import json

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sync_config.json")


def get_supabase_url() -> str | None:
    try:
        with open(CONFIG_PATH) as f:
            data = json.load(f)
            return data.get("supabase_url")
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def set_supabase_url(url: str):
    with open(CONFIG_PATH, "w") as f:
        json.dump({"supabase_url": url}, f)
