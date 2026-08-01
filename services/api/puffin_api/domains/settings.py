from fastapi import APIRouter

from ..deps import CurrentUser, Db
from ..models import UserSettings, UserSettingsUpdate

router = APIRouter()


def read_settings(db: Db, user_id: str) -> UserSettings:
    row = db.execute(
        """
        SELECT units, telemetry_history_limit, ws_url, api_base_url
        FROM user_settings
        WHERE user_id = ?
        """,
        (user_id,),
    ).fetchone()
    return UserSettings(**dict(row))


@router.get("/settings", response_model=UserSettings)
def get_settings(user: CurrentUser, db: Db) -> UserSettings:
    return read_settings(db, user.id)


@router.put("/settings", response_model=UserSettings)
def update_settings(
    body: UserSettingsUpdate, user: CurrentUser, db: Db
) -> UserSettings:
    db.execute(
        """
        UPDATE user_settings
        SET units = ?, telemetry_history_limit = ?, ws_url = ?, api_base_url = ?
        WHERE user_id = ?
        """,
        (
            body.units,
            body.telemetry_history_limit,
            body.ws_url,
            body.api_base_url,
            user.id,
        ),
    )
    db.commit()
    return read_settings(db, user.id)
