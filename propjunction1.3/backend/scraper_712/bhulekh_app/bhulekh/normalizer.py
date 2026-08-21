"""Normalization and result classification helpers."""

from __future__ import annotations

from .constants import KNOWN_RESULT_MARKERS
from .final_record_parser import parse_final_record_html
from .models import BhulekhNormalizedResult, BhulekhRawResult, ErrorInfo, WorkflowState
from .storage import ArtifactStorage
from .utils import extract_visible_text, truncate_text


def detect_result_markers(text: str) -> list[str]:
    haystack = text or ""
    return [marker for marker in KNOWN_RESULT_MARKERS if marker.lower() in haystack.lower()]


def _report_has_substantive_record_data(report: dict) -> bool:
    header = report.get("header", {})
    ownership = report.get("ownership", {})
    rights = report.get("rights_and_mutation", {})
    crop_table = report.get("crop_table", {})

    return any(
        (
            bool(header.get("survey_subdivision_number") or header.get("pu_id") or header.get("village")),
            bool(ownership.get("historical_struck_entries")),
            bool(ownership.get("current_entries")),
            bool(rights),
            bool(crop_table.get("present")),
        )
    )


def result_exists(html: str) -> tuple[bool, list[str]]:
    markers = detect_result_markers(html)
    if not markers:
        return False, markers

    if "ContentPlaceHolder1_ImgPC" in (html or ""):
        return True, markers

    report = parse_final_record_html(html)
    source = report.get("source", {})
    if source.get("record_html_found") and _report_has_substantive_record_data(report):
        return True, markers
    return False, markers


def build_normalized_result(
    state: WorkflowState,
    raw_result: BhulekhRawResult,
    storage: ArtifactStorage,
    error: ErrorInfo | None = None,
    final_html_path: str | None = None,
    final_pdf_path: str | None = None,
    parsed_record_path: str | None = None,
    pdf_generation: dict | None = None,
) -> BhulekhNormalizedResult:
    final_text_excerpt = truncate_text(raw_result.final_text or extract_visible_text(raw_result.final_html))
    record_summary = None
    if raw_result.record_report:
        record_summary = {
            "record_html_found": raw_result.record_report.get("source", {}).get("record_html_found"),
            "crop_section_present": raw_result.record_report.get("crop_table", {}).get("present"),
            "crop_status": raw_result.record_report.get("crop_table", {}).get("status"),
        }
    return BhulekhNormalizedResult(
        run_id=state.run_id,
        status="success" if not error else "error",
        result_found=bool(raw_result.page_markers),
        workflow_step=state.step,
        input=state.input.to_dict(),
        selected_labels=state.selected_labels,
        survey_number=state.selected_survey or state.input.survey_number,
        mobile=state.mobile,
        language=state.language,
        captcha_status="submitted" if not error else error.category,
        result_classification=raw_result.classification,
        artifacts=storage.artifacts.to_dict(),
        markers=raw_result.page_markers,
        alerts=raw_result.alerts,
        metadata=state.metadata,
        final_text_excerpt=final_text_excerpt,
        final_html_path=final_html_path,
        final_pdf_path=final_pdf_path,
        parsed_record_path=parsed_record_path,
        record_summary=record_summary,
        pdf_generation=pdf_generation,
        error=error.to_dict() if error else None,
    )
