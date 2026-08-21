"""Typed models used across the request workflow."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .constants import (
    DEFAULT_LANGUAGE,
    DEFAULT_MAX_CAPTCHA_ATTEMPTS,
    DEFAULT_MAX_DROPDOWN_REFRESH_ATTEMPTS,
    DEFAULT_MAX_MOBILE_RETRIES,
    DEFAULT_RECORD_TYPE,
    DEFAULT_RBTN_ULPIN,
    DEFAULT_SEARCH_TYPE_DROPDOWN,
    DEFAULT_SEARCH_TYPE_RADIO,
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class LocationOption:
    value: str
    text: str
    selected: bool = False


@dataclass(slots=True)
class SurveyOption:
    value: str
    text: str
    selected: bool = False


@dataclass(slots=True)
class PropertyInput:
    district: str
    taluka: str
    village: str
    survey_number: str
    survey_number_part1: str = ""
    mobile: str | None = None
    language: str = DEFAULT_LANGUAGE
    record_type: str = DEFAULT_RECORD_TYPE
    search_type_radio: str = DEFAULT_SEARCH_TYPE_RADIO
    search_type_dropdown: str = DEFAULT_SEARCH_TYPE_DROPDOWN
    rbtn_ulpin: str = DEFAULT_RBTN_ULPIN
    auto_generate_mobile: bool = True
    max_mobile_retries: int = DEFAULT_MAX_MOBILE_RETRIES
    max_captcha_attempts: int = DEFAULT_MAX_CAPTCHA_ATTEMPTS
    max_dropdown_refresh_attempts: int = DEFAULT_MAX_DROPDOWN_REFRESH_ATTEMPTS
    language_fallback_to_first: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.district = self.district.strip()
        self.taluka = self.taluka.strip()
        self.village = self.village.strip()
        self.survey_number = self.survey_number.strip()
        self.survey_number_part1 = self.survey_number_part1.strip() if self.survey_number_part1 else ""
        if not self.survey_number_part1:
            import re
            match = re.match(r'^\d+', self.survey_number)
            self.survey_number_part1 = match.group(0) if match else self.survey_number
            
        self.mobile = self.mobile.strip() if self.mobile else None
        self.language = self.language.strip() or DEFAULT_LANGUAGE
        self.record_type = self.record_type.strip() or DEFAULT_RECORD_TYPE
        self.search_type_radio = self.search_type_radio.strip() or DEFAULT_SEARCH_TYPE_RADIO
        self.search_type_dropdown = self.search_type_dropdown.strip() or DEFAULT_SEARCH_TYPE_DROPDOWN
        self.rbtn_ulpin = self.rbtn_ulpin.strip() or DEFAULT_RBTN_ULPIN

        required = {
            "district": self.district,
            "taluka": self.taluka,
            "village": self.village,
            "survey_number": self.survey_number,
        }
        missing = [field_name for field_name, value in required.items() if not value]
        if missing:
            raise ValueError(f"Missing required input fields: {', '.join(missing)}")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class DeltaRecord:
    length: int
    kind: str
    name: str
    content: str


@dataclass(slots=True)
class DeltaResponse:
    raw_text: str
    records: list[DeltaRecord] = field(default_factory=list)
    update_panels: dict[str, str] = field(default_factory=dict)
    hidden_fields: dict[str, str] = field(default_factory=dict)
    scripts: list[str] = field(default_factory=list)
    messages: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    is_full_page: bool = False
    full_html: str | None = None
    tail: str = ""


@dataclass(slots=True)
class CaptchaPayload:
    image_base64: str
    mime_type: str
    image_path: str | None = None
    source_html_id: str | None = None
    refreshed_count: int = 0
    created_at: str = field(default_factory=utc_now_iso)


@dataclass(slots=True)
class ErrorInfo:
    category: str
    message: str
    raw_message: str | None = None
    recoverable: bool = False
    code: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class HttpExchange:
    method: str
    url: str
    request_headers: dict[str, str]
    request_body: str | None
    response_status: int
    response_headers: dict[str, str]
    response_text: str
    started_at: str = field(default_factory=utc_now_iso)
    completed_at: str = field(default_factory=utc_now_iso)


@dataclass(slots=True)
class RunArtifacts:
    run_dir: str
    files: dict[str, list[str]] = field(default_factory=dict)

    def add(self, kind: str, path: Path | str) -> None:
        normalized = str(path)
        self.files.setdefault(kind, []).append(normalized)

    def to_dict(self) -> dict[str, Any]:
        return {"run_dir": self.run_dir, "files": self.files}


@dataclass(slots=True)
class BhulekhRawResult:
    final_html: str
    final_text: str
    page_markers: list[str]
    classification: str = "result_found"
    embedded_artifacts: list[str] = field(default_factory=list)
    alerts: list[str] = field(default_factory=list)
    record_report: dict[str, Any] | None = None
    delta_response: DeltaResponse | None = None


@dataclass(slots=True)
class BhulekhNormalizedResult:
    run_id: str
    status: str
    result_found: bool
    workflow_step: str
    input: dict[str, Any]
    selected_labels: dict[str, str]
    survey_number: str
    mobile: str | None
    language: str
    captcha_status: str
    result_classification: str
    artifacts: dict[str, Any]
    markers: list[str]
    alerts: list[str]
    metadata: dict[str, Any]
    final_text_excerpt: str
    final_html_path: str | None = None
    final_pdf_path: str | None = None
    parsed_record_path: str | None = None
    record_summary: dict[str, Any] | None = None
    pdf_generation: dict[str, Any] | None = None
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class WorkflowState:
    run_id: str
    input: PropertyInput
    status: str = "initialized"
    step: str = "initialized"
    latest_stable_step: str = "initialized"
    hidden_fields: dict[str, str] = field(default_factory=dict)
    html_fragments: dict[str, str] = field(default_factory=dict)
    full_html: str | None = None
    district_options: list[LocationOption] = field(default_factory=list)
    taluka_options: list[LocationOption] = field(default_factory=list)
    village_options: list[LocationOption] = field(default_factory=list)
    language_options: list[LocationOption] = field(default_factory=list)
    survey_options: list[SurveyOption] = field(default_factory=list)
    selected_labels: dict[str, str] = field(default_factory=dict)
    selected_district: str | None = None
    selected_taluka: str | None = None
    selected_village: str | None = None
    selected_survey: str | None = None
    mobile: str | None = None
    language: str = DEFAULT_LANGUAGE
    captcha: CaptchaPayload | None = None
    last_delta: DeltaResponse | None = None
    last_error: ErrorInfo | None = None
    alerts: list[str] = field(default_factory=list)
    messages: list[str] = field(default_factory=list)
    cookies: dict[str, str] = field(default_factory=dict)
    replay_count: int = 0
    captcha_attempt_count: int = 0
    captcha_refresh_count: int = 0
    mobile_retry_count: int = 0
    submit_attempt_count: int = 0
    dropdown_retry_counts: dict[str, int] = field(default_factory=dict)
    parsed_record_path: str | None = None
    final_pdf_path: str | None = None
    result_classification: str | None = None
    pdf_generation: dict[str, Any] | None = None
    artifacts: RunArtifacts | None = None
    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)
    metadata: dict[str, Any] = field(default_factory=dict)

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
            "selected_survey": self.selected_survey,
            "mobile": self.mobile,
            "language": self.language,
            "cookies": self.cookies,
            "captcha_attempt_count": self.captcha_attempt_count,
            "captcha_refresh_count": self.captcha_refresh_count,
            "mobile_retry_count": self.mobile_retry_count,
            "submit_attempt_count": self.submit_attempt_count,
            "dropdown_retry_counts": self.dropdown_retry_counts,
            "parsed_record_path": self.parsed_record_path,
            "final_pdf_path": self.final_pdf_path,
            "result_classification": self.result_classification,
            "pdf_generation": self.pdf_generation,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metadata": self.metadata,
        }
        if self.captcha:
            payload["captcha"] = asdict(self.captcha)
        if self.last_error:
            payload["last_error"] = self.last_error.to_dict()
        if self.artifacts:
            payload["artifacts"] = self.artifacts.to_dict()
        return payload
