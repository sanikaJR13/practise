"""Backend-ready IGR scraper package."""

from .adapter import IGRAdapter, execute_igr
from .workflow import IGRInput, IGRResult, IGRWorkflow

__all__ = [
    "execute_igr",
    "IGRAdapter",
    "IGRInput",
    "IGRResult",
    "IGRWorkflow",
]
