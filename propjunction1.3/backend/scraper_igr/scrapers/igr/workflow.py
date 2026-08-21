"""Workflow orchestration for backend-ready IGR scraping."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable
from uuid import uuid4

from scraper_igr.scrapers.core.logging_utils import configure_logger
from scraper_igr.scrapers.core.storage import ArtifactStorage

from .captcha import IGRCaptchaSolver
from .client import ClientConfig, IGRClient
from .constants import (
    CAPTCHA_IMAGE_ID,
    DEFAULT_ARTIFACT_ROOT,
    DEFAULT_MAX_CAPTCHA_ATTEMPTS,
    DEFAULT_MAX_OCR_ATTEMPTS,
    FIELD_DISTRICT,
    FIELD_TALUKA,
    FIELD_VILLAGE,
)
from .parser import (
    ajax_has_no_records,
    extract_transactions_from_ajax,
    find_captcha_image_url,
    primary_html,
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class IGRInput:
    district: str
    taluka: str
    village: str
    year: int
    property_number: str
    max_captcha_attempts: int = DEFAULT_MAX_CAPTCHA_ATTEMPTS
    max_ocr_attempts: int = DEFAULT_MAX_OCR_ATTEMPTS
    tesseract_cmd: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.property_number = self.property_number.strip()
        if (
            not self.district.strip()
            or not self.taluka.strip()
            or not self.village.strip()
            or not self.property_number
        ):
            raise ValueError("district, taluka, village, and property_number are required.")

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "IGRInput":
        return cls(
            district=str(payload["district"]),
            taluka=str(payload["taluka"]),
            village=str(payload["village"]),
            year=int(payload["year"]),
            property_number=str(payload["property_number"]),
            max_captcha_attempts=int(payload.get("max_captcha_attempts", DEFAULT_MAX_CAPTCHA_ATTEMPTS)),
            max_ocr_attempts=int(payload.get("max_ocr_attempts", DEFAULT_MAX_OCR_ATTEMPTS)),
            tesseract_cmd=payload.get("tesseract_cmd"),
            metadata=dict(payload.get("metadata", {})),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class IGRCaptchaPayload:
    image_path: str
    image_url: str
    source_html_id: str = CAPTCHA_IMAGE_ID
    ocr_text: str | None = None
    attempt: int = 0
    created_at: str = field(default_factory=utc_now_iso)


@dataclass(slots=True)
class IGRResult:
    year: int
    transactions: list[dict[str, str]]
    status: str
    run_id: str
    workflow_step: str
    selected_labels: dict[str, str]
    artifacts: dict[str, Any]
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class IGRWorkflowState:
    run_id: str
    input: IGRInput
    status: str = "initialized"
    step: str = "initialized"
    latest_stable_step: str = "initialized"
    form_data: dict[str, str] = field(default_factory=dict)
    panels: dict[str, str] = field(default_factory=dict)
    ajax_fields: dict[str, str] = field(default_factory=dict)
    selected_labels: dict[str, str] = field(default_factory=dict)
    selected_district: str | None = None
    selected_taluka: str | None = None
    selected_village: str | None = None
    year: int | None = None
    property_number: str | None = None
    captcha: IGRCaptchaPayload | None = None
    last_html: str | None = None
    captcha_attempt_count: int = 0
    submit_attempt_count: int = 0
    artifacts: Any = None
    metadata: dict[str, Any] = field(default_factory=dict)
    cookies: dict[str, str] = field(default_factory=dict)
    updated_at: str = field(default_factory=utc_now_iso)

    def touch(self) -> None:
        self.updated_at = utc_now_iso()

    def to_public_dict(self) -> dict[str, Any]:
        payload = {
            "run_id": self.run_id,
            "status": self.status,
            "step": self.step,
            "latest_stable_step": self.latest_stable_step,
            "selected_labels": self.selected_labels,
            "selected_district": self.selected_district,
            "selected_taluka": self.selected_taluka,
            "selected_village": self.selected_village,
            "year": self.year,
            "property_number": self.property_number,
            "captcha_attempt_count": self.captcha_attempt_count,
            "submit_attempt_count": self.submit_attempt_count,
            "cookies": self.cookies,
            "metadata": self.metadata,
            "updated_at": self.updated_at,
        }
        if self.captcha:
            payload["captcha"] = asdict(self.captcha)
        if self.artifacts:
            payload["artifacts"] = self.artifacts.to_dict()
        return payload


class IGRWorkflow:
    """Modular workflow for one-year IGR execution."""

    def __init__(
        self,
        igr_input: IGRInput,
        artifact_root: str = DEFAULT_ARTIFACT_ROOT,
        run_id: str | None = None,
        client_config: ClientConfig | None = None,
        client_factory: Callable[[ArtifactStorage, object], IGRClient] | None = None,
        captcha_solver: IGRCaptchaSolver | None = None,
    ) -> None:
        self.run_id = run_id or uuid4().hex
        self.storage = ArtifactStorage(artifact_root, self.run_id)
        self.logger = configure_logger(self.run_id, self.storage.logs_dir)
        self.client = (
            client_factory
            or (lambda storage, logger: IGRClient(storage, logger, config=client_config))
        )(self.storage, self.logger)
        self.captcha_solver = captcha_solver or IGRCaptchaSolver(
            tesseract_cmd=igr_input.tesseract_cmd,
            ocr_attempts=igr_input.max_ocr_attempts,
        )
        self.state = IGRWorkflowState(
            run_id=self.run_id,
            input=igr_input,
            artifacts=self.storage.artifacts,
            year=igr_input.year,
            property_number=igr_input.property_number,
        )
        self._record_metadata("workflow_initialized", igr_input.to_dict())

    def initialize(self) -> None:
        self.client.initialize()
        self.client.open_search_form()
        self._sync_state_from_client()
        self._persist_state_snapshot()

    def select_district(self, district: str | None = None) -> None:
        self._ensure_initialized()
        district_value = district if district is not None else self.state.input.district
        options = self.client.fetch_dropdown(FIELD_DISTRICT)
        if district_value not in options:
            raise ValueError(f"District value {district_value!r} is not available.")
        self.client.post_event(FIELD_DISTRICT, {FIELD_DISTRICT: district_value}, step="select_district")
        self._sync_state_from_client()
        self.state.selected_district = district_value
        self.state.selected_labels["district"] = options[district_value]
        self._mark_step("district_selected", stable=True)
        self._record_metadata("district_selected", {"district": district_value})

    def select_taluka(self, taluka: str | None = None) -> None:
        self._require_step("district_selected")
        taluka_value = taluka if taluka is not None else self.state.input.taluka
        options = self.client.fetch_dropdown(FIELD_TALUKA)
        if taluka_value not in options:
            raise ValueError(f"Taluka value {taluka_value!r} is not available.")
        self.client.post_event(FIELD_TALUKA, {FIELD_TALUKA: taluka_value}, step="select_taluka")
        self._sync_state_from_client()
        self.state.selected_taluka = taluka_value
        self.state.selected_labels["taluka"] = options[taluka_value]
        self._mark_step("taluka_selected", stable=True)
        self._record_metadata("taluka_selected", {"taluka": taluka_value})

    def select_village(self, village: str | None = None) -> None:
        self._require_step("taluka_selected")
        village_value = village if village is not None else self.state.input.village
        options = self.client.fetch_dropdown(FIELD_VILLAGE)
        if village_value not in options:
            raise ValueError(f"Village value {village_value!r} is not available.")
        self.client.post_event(FIELD_VILLAGE, {FIELD_VILLAGE: village_value}, step="select_village")
        self._sync_state_from_client()
        self.state.selected_village = village_value
        self.state.selected_labels["village"] = options[village_value]
        self._mark_step("village_selected", stable=True)
        self._record_metadata("village_selected", {"village": village_value})

    def prepare_year(self, year: int | None = None, property_number: str | None = None) -> None:
        self._require_step("village_selected")
        self.state.year = int(year if year is not None else self.state.input.year)
        self.state.property_number = (property_number or self.state.input.property_number).strip()
        self._mark_step("year_processing", stable=True)
        self._record_metadata(
            "year_processing",
            {"year": self.state.year, "property_number": self.state.property_number},
        )

    def fetch_captcha(self) -> IGRCaptchaPayload:
        self._require_step("year_processing")
        ajax_state = getattr(self.client, "last_ajax", None)
        if not ajax_state:
            message = (
                "No AJAX state available before captcha fetch. "
                "Initialize and prepare the workflow before fetching a captcha."
            )
            self.logger.error(
                "Workflow %s cannot fetch captcha at step=%s: %s",
                self.run_id,
                self.state.step,
                message,
            )
            raise RuntimeError(message)

        image_url = find_captcha_image_url(ajax_state)
        if not image_url:
            message = (
                "Captcha image URL was not found in the current response. "
                "The current AJAX state does not contain captcha markup."
            )
            self.logger.error(
                "Workflow %s cannot fetch captcha at step=%s: %s",
                self.run_id,
                self.state.step,
                message,
            )
            raise RuntimeError(message)

        resolve_url = getattr(self.client, "resolve_url", None)
        resolved_url = resolve_url(image_url) if callable(resolve_url) else image_url
        self.logger.info(
            "Workflow %s fetching captcha. raw_url=%s resolved_url=%s year=%s",
            self.run_id,
            image_url,
            resolved_url,
            self.state.year,
        )
        image_bytes = self.client.download_binary(image_url, step="download_captcha")
        filename = (
            f"igr_captcha_{self.run_id}_{self.state.captcha_attempt_count}.png"
            if self.state.captcha_attempt_count
            else f"igr_captcha_{self.run_id}.png"
        )
        image_path = self.storage.save_captcha_bytes(filename, image_bytes)
        self.logger.info(
            "Workflow %s saved captcha image to %s (%s bytes)",
            self.run_id,
            image_path,
            len(image_bytes),
        )
        ocr_text = self.captcha_solver.solve_bytes(image_bytes, attempts=self.state.input.max_ocr_attempts)
        self.logger.info("Workflow %s OCR captcha candidate: %s", self.run_id, ocr_text)
        captcha = IGRCaptchaPayload(
            image_path=str(image_path),
            image_url=image_url,
            ocr_text=ocr_text,
            attempt=self.state.captcha_attempt_count,
        )
        self.state.captcha = captcha
        self.state.status = "captcha_pending"
        self._mark_step("captcha_ready", stable=False)
        self._record_metadata(
            "captcha_ready",
            {
                "captcha_path": captcha.image_path,
                "captcha_url": captcha.image_url,
                "ocr_text": captcha.ocr_text,
                "captcha_attempt_count": self.state.captcha_attempt_count,
            },
        )
        self.logger.info(
            "Workflow %s captcha ready for year=%s at attempt=%s",
            self.run_id,
            self.state.year,
            self.state.captcha_attempt_count,
        )
        return captcha

    def refresh_captcha(self) -> IGRCaptchaPayload:
        self._require_step("captcha_ready")
        self.logger.info(
            "Workflow %s refreshing captcha for year=%s after failed attempt=%s",
            self.run_id,
            self.state.year,
            self.state.captcha_attempt_count,
        )
        self.client.post_event("imgCaptcha_new", {"imgCaptcha_new.x": "12", "imgCaptcha_new.y": "12"}, step="refresh_captcha")
        self._sync_state_from_client()
        return self.fetch_captcha()

    def submit_captcha_and_run(self, captcha_text: str | None = None) -> IGRResult:
        self._require_step("captcha_ready")
        self.state.captcha_attempt_count += 1
        solved_text = (captcha_text or (self.state.captcha.ocr_text if self.state.captcha else "") or "").strip().upper()
        if not solved_text:
            return self._error_result(
                "Captcha could not be solved.",
                recoverable=self.state.captcha_attempt_count < self.state.input.max_captcha_attempts,
            )

        self.state.submit_attempt_count += 1
        ajax_result = self.client.submit_search(
            year=int(self.state.year),
            property_number=str(self.state.property_number),
            captcha_text=solved_text,
            step="submit",
        )
        self._sync_state_from_client()
        self._mark_step("submitted", stable=False)
        self._record_metadata(
            "submit_attempted",
            {
                "year": self.state.year,
                "property_number": self.state.property_number,
                "submit_attempt_count": self.state.submit_attempt_count,
            },
        )

        if ajax_result.errors:
            error_msg = ajax_result.errors[0]
            if "error|500" in error_msg or "error|501" in error_msg:
                raise RuntimeError(f"Government server returned unrecoverable error: {error_msg}")

        transactions = extract_transactions_from_ajax(ajax_result)
        if transactions:
            return self._success_result(transactions)

        if ajax_has_no_records(ajax_result):
            return self._empty_result()

        return self._error_result(
            "IGR search did not return records or a no-records message.",
            recoverable=self.state.captcha_attempt_count < self.state.input.max_captcha_attempts,
        )

    def start(self) -> IGRCaptchaPayload:
        self.initialize()
        self.select_district()
        self.select_taluka()
        self.select_village()
        self.prepare_year()
        return self.fetch_captcha()

    def run(self) -> IGRResult:
        """Execute from scratch or continue from an existing captcha-ready state."""

        if self.state.step != "captcha_ready":
            self.start()

        while self.state.captcha_attempt_count < self.state.input.max_captcha_attempts:
            try:
                result = self.submit_captcha_and_run()
                if result.status in {"success", "empty"}:
                    return result
                if self.state.captcha_attempt_count >= self.state.input.max_captcha_attempts:
                    return result
                self.refresh_captcha()
            except Exception as e:
                self.logger.warning(
                    "Encountered error during search execution: %s. Re-initializing session...",
                    e,
                    exc_info=True
                )
                # Re-initialize the whole session from scratch to acquire new cookies/viewstate
                self.initialize()
                self.select_district()
                self.select_taluka()
                self.select_village()
                self.prepare_year()
                self.fetch_captcha()
        return self._error_result("Captcha retry limit exhausted.", recoverable=False)

    def _sync_state_from_client(self) -> None:
        self.state.form_data = dict(self.client.form_data)
        self.state.panels = dict(self.client.last_ajax.panels)
        self.state.ajax_fields = dict(self.client.last_ajax.fields)
        self.state.last_html = primary_html(self.client.last_ajax)
        self.state.cookies = self.client.snapshot_cookies()
        self.state.touch()

    def _mark_step(self, step: str, stable: bool) -> None:
        self.state.step = step
        if self.state.status not in {"success", "captcha_pending", "error"}:
            self.state.status = "running"
        if stable:
            self.state.latest_stable_step = step
        self.state.touch()
        self._persist_state_snapshot()

    def _ensure_initialized(self) -> None:
        if not self.state.form_data:
            self.initialize()

    def _require_step(self, required_step: str) -> None:
        if self.state.step == required_step:
            return
        ordering = [
            "initialized",
            "district_selected",
            "taluka_selected",
            "village_selected",
            "year_processing",
            "captcha_ready",
            "submitted",
            "result_ready",
        ]
        current_index = ordering.index(self.state.step) if self.state.step in ordering else 0
        required_index = ordering.index(required_step)
        if current_index < required_index - 1:
            raise RuntimeError(f"Workflow step {self.state.step!r} cannot satisfy {required_step!r}.")

    def _success_result(self, transactions: list[dict[str, str]]) -> IGRResult:
        self.state.status = "success"
        self.state.step = "result_ready"
        payload = {"year": self.state.year, "transactions": transactions, "status": "success"}
        result_path = self.storage.save_json(
            self.storage.results_dir.relative_to(self.storage.run_dir) / f"transactions_{self.state.year}.json",
            payload,
            kind="results",
        )
        result = IGRResult(
            year=int(self.state.year),
            transactions=transactions,
            status="success",
            run_id=self.run_id,
            workflow_step=self.state.step,
            selected_labels=dict(self.state.selected_labels),
            artifacts=self.storage.artifacts.to_dict(),
        )
        self._record_metadata("result_ready", {"result_path": str(result_path), "transaction_count": len(transactions)})
        self.storage.save_normalized_result(result.to_dict())
        self._persist_state_snapshot()
        return result

    def _empty_result(self) -> IGRResult:
        self.state.status = "success"
        self.state.step = "result_ready"
        payload = {"year": self.state.year, "transactions": [], "status": "empty"}
        result_path = self.storage.save_json(
            self.storage.results_dir.relative_to(self.storage.run_dir) / f"transactions_{self.state.year}.json",
            payload,
            kind="results",
        )
        result = IGRResult(
            year=int(self.state.year),
            transactions=[],
            status="empty",
            run_id=self.run_id,
            workflow_step=self.state.step,
            selected_labels=dict(self.state.selected_labels),
            artifacts=self.storage.artifacts.to_dict(),
        )
        self._record_metadata("result_ready", {"result_path": str(result_path), "transaction_count": 0})
        self.storage.save_normalized_result(result.to_dict())
        self._persist_state_snapshot()
        return result

    def _error_result(self, message: str, recoverable: bool) -> IGRResult:
        self.state.status = "error"
        error = {
            "message": message,
            "recoverable": recoverable,
            "captcha_attempt_count": self.state.captcha_attempt_count,
            "submit_attempt_count": self.state.submit_attempt_count,
        }
        payload = {"year": self.state.year, "transactions": [], "status": "error", "error": error}
        self.storage.save_json(
            self.storage.results_dir.relative_to(self.storage.run_dir) / f"transactions_{self.state.year}.json",
            payload,
            kind="results",
        )
        result = IGRResult(
            year=int(self.state.year),
            transactions=[],
            status="error",
            run_id=self.run_id,
            workflow_step=self.state.step,
            selected_labels=dict(self.state.selected_labels),
            artifacts=self.storage.artifacts.to_dict(),
            error=error,
        )
        self._record_metadata("error", error)
        self.storage.save_normalized_result(result.to_dict())
        self._persist_state_snapshot()
        return result

    def _record_metadata(self, key: str, value: Any) -> None:
        self.state.metadata[key] = value
        self.state.touch()
        self._persist_state_snapshot()

    def _persist_state_snapshot(self) -> None:
        self.storage.save_workflow_state(self.state.to_public_dict())
