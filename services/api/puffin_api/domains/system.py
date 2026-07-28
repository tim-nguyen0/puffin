from fastapi import APIRouter

from .. import __version__
from ..models import Health

router = APIRouter(tags=["system"])


@router.get("/health")
def get_health() -> Health:
    return Health(version=__version__)
