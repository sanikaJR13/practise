"""Pure-function style adapter entrypoints for IGR execution."""

from __future__ import annotations

from .client import ClientConfig
from .constants import DEFAULT_ARTIFACT_ROOT
from .workflow import IGRInput, IGRWorkflow


class IGRAdapter:
    """Thin adapter for API/service layers."""

    def __init__(self, artifact_root: str = DEFAULT_ARTIFACT_ROOT, client_config: ClientConfig | None = None) -> None:
        self.artifact_root = artifact_root
        self.client_config = client_config or ClientConfig()

    def execute(self, payload: dict) -> dict:
        workflow = IGRWorkflow(
            IGRInput.from_dict(payload),
            artifact_root=self.artifact_root,
            client_config=self.client_config,
        )
        return workflow.run().to_dict()


def execute_igr(payload: dict, artifact_root: str = DEFAULT_ARTIFACT_ROOT, client_config: ClientConfig | None = None) -> dict:
    """Execute one IGR year/property lookup from a JSON-style payload."""
    return IGRAdapter(artifact_root=artifact_root, client_config=client_config).execute(payload)
