import os
import sqlite3
import tempfile
from pathlib import Path


def default_db_path() -> str:
    return os.getenv("PUFFIN_DB_PATH", str(Path(tempfile.gettempdir()) / "puffin.db"))


def connect_db(path: str) -> sqlite3.Connection:
    connection = sqlite3.connect(path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(path: str) -> None:
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)

    with connect_db(path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_settings (
                user_id TEXT PRIMARY KEY,
                units TEXT NOT NULL DEFAULT 'metric',
                telemetry_history_limit INTEGER NOT NULL DEFAULT 600,
                ws_url TEXT NOT NULL DEFAULT '/ws/telemetry',
                api_base_url TEXT NOT NULL DEFAULT '/api',
                terminal_x REAL NOT NULL DEFAULT 0,
                terminal_y REAL NOT NULL DEFAULT 0,
                terminal_minimized INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )
        # dbs created before the terminal layout columns existed
        for ddl in (
            "ALTER TABLE user_settings ADD COLUMN terminal_x REAL NOT NULL DEFAULT 0",
            "ALTER TABLE user_settings ADD COLUMN terminal_y REAL NOT NULL DEFAULT 0",
            "ALTER TABLE user_settings ADD COLUMN terminal_minimized INTEGER NOT NULL DEFAULT 0",
        ):
            try:
                connection.execute(ddl)
            except sqlite3.OperationalError:
                pass
