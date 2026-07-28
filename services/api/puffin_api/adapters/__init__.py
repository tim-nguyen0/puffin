from dataclasses import dataclass
from typing import Any


@dataclass
class AdapterResult:
    """Uniform adapter return value: adapters never raise across the API boundary."""

    ok: bool
    detail: str = ""
    data: Any = None
