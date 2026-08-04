"""Main request-based workflow orchestration for Bhulekh Maharashtra."""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Callable
from uuid import uuid4

from .captcha import CaptchaManager
from .client import BhulekhClient, ClientConfig
from .constants import (
    BASE_URL,
    BUTTON_CAPTCHA_REFRESH,
    BUTTON_SEARCH,
    BUTTON_SEARCH_VALUE,
    BUTTON_SUBMIT,
    BUTTON_SUBMIT_VALUE,
    DEFAULT_ARTIFACT_ROOT,
    DEFAULT_CAPTCHA_IMAGE_CLICK_X,
    DEFAULT_CAPTCHA_IMAGE_CLICK_Y,
    DEFAULT_LANGUAGE,
    DEFAULT_MAX_WORKFLOW_REPLAYS,
    FIELD_CAPTCHA,
    FIELD_DISTRICT,
    FIELD_EVENTARGUMENT,
    FIELD_EVENTTARGET,
    FIELD_LANGUAGE,
    FIELD_LASTFOCUS,
    FIELD_MOBILE,
    FIELD_RBTN_ULPIN,
    FIELD_RECORD_TYPE,
    FIELD_SCRIPT_MANAGER,
    FIELD_SEARCH_TYPE_DROPDOWN,
    FIELD_SEARCH_TYPE_RADIO,
    FIELD_SURVEY_DROPDOWN,
    FIELD_SURVEY_TEXT,
    FIELD_TALUKA,
    FIELD_VILLAGE,
    FIELD_VIEWSTATE,
    KNOWN_CAPTCHA_ERROR_MARKERS,
    KNOWN_CAPTCHA_EXPIRED_MARKERS,
    KNOWN_MOBILE_ERROR_MARKERS,
    KNOWN_SESSION_EXPIRED_MARKERS,
    KNOWN_SUCCESS_ALERT_MARKERS,
    KNOWN_SURVEY_ERROR_MARKERS,
    UPDATE_PANEL_UNIQUE_ID,
)
from .delta_parser import parse_delta_response
from .exceptions import (
    CaptchaExpiredError,
    DistrictLoadError,
    InvalidCaptchaError,
    InvalidStateError,
    LanguageSelectionError,
    MobileValidationError,
    NavigationError,
    ResultNotFoundError,
    SessionExpiredError,
    SurveyNotFoundError,
    SurveySearchError,
    TalukaLoadError,
    VillageLoadError,
)
from .final_record_parser import parse_final_record_html
from .form_state import FormStateManager
from .logging_utils import configure_logger
from .models import BhulekhNormalizedResult, BhulekhRawResult, ErrorInfo, PropertyInput, WorkflowState
from .normalizer import build_normalized_result, result_exists
from .pdf_generator import find_source_images, generate_final_pdf
from .storage import ArtifactStorage
from .utils import extract_alert_messages, extract_visible_text, generate_mobile_number, validate_mobile_number


class BhulekhWorkflow:
    """Stateful backend-friendly workflow matching the proven Selenium flow."""

    def __init__(
        self,
        property_input: PropertyInput,
        artifact_root: str = DEFAULT_ARTIFACT_ROOT,
        run_id: str | None = None,
        client_config: ClientConfig | None = None,
        client_factory: Callable[[ArtifactStorage, object], BhulekhClient] | None = None,
    ) -> None:
        self.run_id = run_id or uuid4().hex
        self.storage = ArtifactStorage(artifact_root, self.run_id)
        self.logger = configure_logger(self.run_id, self.storage.logs_dir)
        self.client = (
            client_factory
            or (lambda storage, logger: BhulekhClient(storage, logger, config=client_config))
        )(self.storage, self.logger)
        self.captcha_manager = CaptchaManager()
        self.state = WorkflowState(
            run_id=self.run_id,
            input=property_input,
            mobile=property_input.mobile,
            language=property_input.language or DEFAULT_LANGUAGE,
            artifacts=self.storage.artifacts,
        )
        self.form = FormStateManager(self.state)
        self._record_metadata("workflow_initialized", property_input.to_dict())

    def load_home(self) -> WorkflowState:
        attempts = self.state.input.max_dropdown_refresh_attempts
        last_error: Exception | None = None

        for attempt in range(1, attempts + 1):
            try:
                exchange = self.client.get_homepage(step="load_home")
                self.form.refresh_from_html(exchange.response_text, fragment_name="home")
                self.state.cookies = self.client.snapshot_cookies()
                self.storage.save_text("results/homepage.html", exchange.response_text, kind="results")
                if not self.state.district_options:
                    raise NavigationError(
                        "Homepage loaded without district dropdown options.",
                        recoverable=True,
                        details={"attempt": attempt},
                    )
                self.form.mark_step("home_loaded", stable=True)
                self._record_metadata("home_loaded", {"cookies": self.state.cookies, "attempt": attempt})
                return self.state
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                self.state.dropdown_retry_counts["load_home"] = attempt
                self._record_metadata("home_load_retry", {"attempt": attempt, "error": str(exc)})

        if isinstance(last_error, NavigationError):
            raise last_error
        raise NavigationError("Failed to load homepage.", recoverable=True, details={"error": str(last_error)})

    def select_district(self, district: str | None = None) -> WorkflowState:
        self._ensure_home_loaded()
        district_value = (district or self.state.input.district).strip()
        if not any(option.value == district_value for option in self.state.district_options):
            raise DistrictLoadError("District value is not available on the current page.", details={"district": district_value})

        payload = self._build_postback_payload(
            source_control=FIELD_DISTRICT,
            event_target=FIELD_DISTRICT,
            updates={FIELD_DISTRICT: district_value},
        )
        delta = self._retry_step(
            "select_district",
            payload,
            success_check=lambda: bool(self.state.taluka_options)
            and (
                not self._has_concrete_value(self.state.input.taluka)
                or self._option_exists(self.state.taluka_options, self.state.input.taluka)
            ),
            error_factory=lambda: DistrictLoadError(
                "Taluka dropdown did not refresh after district selection.",
                recoverable=True,
                details={"district": district_value, "available_talukas": self._option_dicts(self.state.taluka_options)},
            ),
        )

        self.form.set_selected_district(district_value)
        self.form.mark_step("district_selected", stable=True)
        self._record_metadata("district_selected", {"district": district_value, "delta_tail": delta.tail})
        return self.state

    def select_taluka(self, taluka: str | None = None) -> WorkflowState:
        self._require_step("district_selected")
        taluka_value = (taluka or self.state.input.taluka).strip()
        if not any(option.value == taluka_value for option in self.state.taluka_options):
            raise TalukaLoadError("Requested taluka is not available after district refresh.", details={"taluka": taluka_value})

        payload = self._build_postback_payload(
            source_control=FIELD_TALUKA,
            event_target=FIELD_TALUKA,
            updates={FIELD_TALUKA: taluka_value},
        )
        self._retry_step(
            "select_taluka",
            payload,
            success_check=lambda: bool(self.state.village_options)
            and (
                not self._has_concrete_value(self.state.input.village)
                or self._option_exists(self.state.village_options, self.state.input.village)
            ),
            error_factory=lambda: TalukaLoadError(
                "Village dropdown did not refresh after taluka selection.",
                recoverable=True,
                details={"taluka": taluka_value, "available_villages": self._option_dicts(self.state.village_options)},
            ),
        )

        self.form.set_selected_taluka(taluka_value)
        self.form.mark_step("taluka_selected", stable=True)
        self._record_metadata("taluka_selected", {"taluka": taluka_value})
        return self.state

    def select_village(self, village: str | None = None) -> WorkflowState:
        self._require_step("taluka_selected")
        village_value = (village or self.state.input.village).strip()
        if not any(option.value == village_value for option in self.state.village_options):
            raise VillageLoadError("Requested village is not available after taluka refresh.", details={"village": village_value})

        payload = self._build_postback_payload(
            source_control=FIELD_VILLAGE,
            event_target=FIELD_VILLAGE,
            updates={FIELD_VILLAGE: village_value},
        )
        self._retry_step(
            "select_village",
            payload,
            success_check=lambda: bool(self.form.current_html()),
            error_factory=lambda: VillageLoadError(
                "Village selection postback did not return usable HTML.",
                recoverable=True,
                details={"village": village_value},
            ),
        )
        self.form.set_selected_village(village_value)
        self.form.mark_step("village_selected", stable=True)
        self._record_metadata("village_selected", {"village": village_value})
        return self.state

    def search_survey(self, survey_number: str | None = None) -> WorkflowState:
        self._require_step("village_selected")
        search_value = self.state.input.survey_number_part1.strip()
        target_survey = (survey_number or self.state.input.survey_number).strip()

        payload = self._build_postback_payload(
            source_control=BUTTON_SEARCH,
            event_target="",
            updates={
                FIELD_SURVEY_TEXT: search_value,
                BUTTON_SEARCH: BUTTON_SEARCH_VALUE,
            },
            include_submit_control=True,
        )
        self._retry_step(
            "search_survey",
            payload,
            success_check=lambda: bool(self.state.survey_options),
            error_factory=lambda: SurveySearchError(
                "Survey search returned no matching dropdown option.",
                recoverable=True,
                details={"survey": search_value, "available": self._option_dicts(self.state.survey_options)},
            ),
        )
        if not self._survey_exists(target_survey):
            raise SurveyNotFoundError(
                "Requested survey number is not present in survey dropdown.",
                details={"survey": target_survey, "available": self._option_dicts(self.state.survey_options)},
            )

        self.form.mark_step("survey_searched", stable=True)
        self._record_metadata("survey_searched", {"survey": target_survey})
        return self.state

    def select_survey(self, survey_number: str | None = None) -> WorkflowState:
        self._require_step("survey_searched")
        survey_value = (survey_number or self.state.input.survey_number).strip()
        if not self._survey_exists(survey_value):
            raise SurveyNotFoundError("Requested survey number is not available for selection.", details={"survey": survey_value})

        payload = self._build_postback_payload(
            source_control=FIELD_SURVEY_DROPDOWN,
            event_target=FIELD_SURVEY_DROPDOWN,
            updates={FIELD_SURVEY_DROPDOWN: survey_value, FIELD_SURVEY_TEXT: self.state.input.survey_number_part1},
        )
        self._retry_step(
            "select_survey",
            payload,
            success_check=lambda: self._survey_exists(survey_value),
            error_factory=lambda: SurveyNotFoundError(
                "Survey selection postback did not preserve the requested survey.",
                details={"survey": survey_value, "available": self._option_dicts(self.state.survey_options)},
            ),
        )
        self.form.set_selected_survey(survey_value)
        self.form.mark_step("survey_selected", stable=True)
        self._record_metadata("survey_selected", {"survey": survey_value})
        return self.state

    def set_mobile(self, mobile: str | None = None) -> WorkflowState:
        self._require_step("survey_selected")
        mobile_value = (mobile or self.state.mobile or "").strip()
        if not mobile_value and self.state.input.auto_generate_mobile:
            mobile_value = generate_mobile_number()
        if not validate_mobile_number(mobile_value):
            raise MobileValidationError("A valid 10-digit mobile number is required.", details={"mobile": mobile_value})
        self.state.mobile = mobile_value
        self.form.mark_step("mobile_set", stable=False)
        self._record_metadata("mobile_set", {"mobile": mobile_value})
        return self.state

    def set_language(self, language: str | None = None) -> WorkflowState:
        self._require_step("mobile_set")
        requested_language = (language or self.state.input.language or DEFAULT_LANGUAGE).strip()
        language_value = self._resolve_language_choice(requested_language)
        payload = self._build_postback_payload(
            source_control=FIELD_LANGUAGE,
            event_target=FIELD_LANGUAGE,
            updates={FIELD_LANGUAGE: language_value},
        )
        self._send_delta_step("set_language", payload)
        if self.state.language_options and not self._option_exists(self.state.language_options, language_value):
            raise LanguageSelectionError(
                "Language postback completed but the selected language is not present afterward.",
                recoverable=True,
                details={"requested_language": requested_language, "actual_language": language_value},
            )
        self.state.language = language_value
        self.form.mark_step("language_set", stable=False)
        self._record_metadata(
            "language_set",
            {
                "requested_language": requested_language,
                "language": language_value,
                "language_fallback_used": language_value != requested_language,
            },
        )
        return self.state

    def fetch_captcha(self):
        self._require_step("language_set")
        self._ensure_language_consistency()
        captcha = self.captcha_manager.extract_from_html(
            self.form.current_html(),
            refreshed_count=self.state.captcha_refresh_count,
        )
        captcha_path = self.storage.save_captcha_bytes(f"captcha_{self.run_id}.png", content=self._decode_captcha(captcha.image_base64))
        captcha.image_path = str(captcha_path)
        self.state.captcha = captcha
        self.state.status = "captcha_pending"
        self.form.mark_step("captcha_ready", stable=False)
        self._record_metadata(
            "captcha_ready",
            {
                "image_path": captcha.image_path,
                "refresh_count": self.state.captcha_refresh_count,
                "captcha_attempt_count": self.state.captcha_attempt_count,
            },
        )
        return captcha

    def refresh_captcha(self):
        self._require_step("captcha_ready")
        self._ensure_language_consistency()
        payload = self._build_postback_payload(
            source_control=BUTTON_CAPTCHA_REFRESH,
            event_target="",
            updates={
                f"{BUTTON_CAPTCHA_REFRESH}.x": DEFAULT_CAPTCHA_IMAGE_CLICK_X,
                f"{BUTTON_CAPTCHA_REFRESH}.y": DEFAULT_CAPTCHA_IMAGE_CLICK_Y,
            },
            include_submit_control=True,
        )
        self._send_delta_step("refresh_captcha", payload)
        self.state.captcha_refresh_count += 1
        captcha = self.captcha_manager.extract_from_html(
            self.form.current_html(),
            refreshed_count=self.state.captcha_refresh_count,
        )
        captcha_path = self.storage.save_captcha_bytes(
            f"captcha_{self.run_id}_{captcha.refreshed_count}.png",
            content=self._decode_captcha(captcha.image_base64),
        )
        captcha.image_path = str(captcha_path)
        self.state.captcha = captcha
        self.form.mark_step("captcha_ready", stable=False)
        self._record_metadata("captcha_refreshed", {"image_path": captcha.image_path, "refresh_count": captcha.refreshed_count})
        return captcha

    def submit_captcha_and_run(self, captcha_text: str) -> BhulekhNormalizedResult:
        self._require_step("captcha_ready")
        self.captcha_manager.validate_text(captcha_text)
        if self.state.captcha_attempt_count >= self.state.input.max_captcha_attempts:
            raise InvalidCaptchaError(
                "Captcha retry limit has been exhausted.",
                recoverable=False,
                details={"max_captcha_attempts": self.state.input.max_captcha_attempts},
            )

        self.state.captcha_attempt_count += 1
        self.state.submit_attempt_count += 1
        self._ensure_language_consistency()

        payload = self._build_postback_payload(
            source_control=BUTTON_SUBMIT,
            event_target="",
            updates={
                FIELD_CAPTCHA: captcha_text,
                BUTTON_SUBMIT: BUTTON_SUBMIT_VALUE,
                FIELD_SURVEY_TEXT: self.state.input.survey_number,
                FIELD_MOBILE: self.state.mobile or "",
                FIELD_LANGUAGE: self.state.language or self.state.input.language,
            },
            include_submit_control=True,
        )
        delta = self._send_delta_step("submit", payload)
        self.form.mark_step("submitted", stable=False)
        self._record_metadata(
            "submit_attempted",
            {
                "submit_attempt_count": self.state.submit_attempt_count,
                "captcha_attempt_count": self.state.captcha_attempt_count,
                "mobile": self.state.mobile,
                "language": self.state.language,
            },
        )

        raw_result = self.detect_result(delta)
        if raw_result:
            final_html_path = self.storage.save_final_html(raw_result.final_html, stem="final_record")
            final_text_path = self.storage.save_final_text(raw_result.final_text, stem="final_record")
            embedded = self.storage.save_high_fidelity_sources(raw_result.final_html, stem="final_record_source")
            raw_result.embedded_artifacts.extend(embedded)
            parsed_record_path = None
            if raw_result.record_report:
                parsed_record_path = str(self.storage.save_parsed_result(raw_result.record_report, stem="parsed_final_record"))
                self.state.parsed_record_path = parsed_record_path
            source_image_paths = find_source_images(self.storage.results_dir)
            pdf_result = generate_final_pdf(
                run_dir=self.storage.run_dir,
                final_html_path=Path(final_html_path),
                source_image_paths=source_image_paths,
                final_text_path=Path(final_text_path),
                logger=self.logger,
            )
            if pdf_result.pdf_path:
                self.storage.register_existing_path("pdfs", pdf_result.pdf_path)
            self.state.final_pdf_path = pdf_result.pdf_path
            self.state.pdf_generation = pdf_result.to_dict()
            self.state.result_classification = raw_result.classification
            self.state.status = "success"
            self.form.mark_step("result_ready", stable=False)
            normalized = self.normalize_output(
                raw_result,
                final_html_path=str(final_html_path),
                final_pdf_path=pdf_result.pdf_path,
                parsed_record_path=parsed_record_path,
                pdf_generation=pdf_result.to_dict(),
            )
            self.storage.save_normalized_result(normalized.to_dict())
            self._persist_state_snapshot()
            return normalized

        error = self.detect_alert_or_error(delta)
        if error.category == "mobile_error":
            self.form.mark_step("captcha_ready", stable=False)
            raise self._handle_mobile_error(error)
        if error.category == "captcha_expired":
            self.form.mark_step("captcha_ready", stable=False)
            refreshed = self.refresh_captcha()
            raise CaptchaExpiredError(
                error.message,
                recoverable=True,
                details={
                    **error.to_dict(),
                    "captcha_path": refreshed.image_path,
                    "captcha_refresh_count": refreshed.refreshed_count,
                    "auto_refreshed": True,
                },
            )
        if error.category == "captcha_error":
            self.form.mark_step("captcha_ready", stable=False)
            remaining = max(0, self.state.input.max_captcha_attempts - self.state.captcha_attempt_count)
            recoverable = remaining > 0
            details = {**error.to_dict(), "attempts_remaining": remaining}
            message = error.message if recoverable else "Captcha retry limit has been exhausted."
            if recoverable:
                refreshed = self.refresh_captcha()
                details.update(
                    {
                        "captcha_path": refreshed.image_path,
                        "captcha_refresh_count": refreshed.refreshed_count,
                        "auto_refreshed": True,
                    }
                )
                message = "Server rejected the captcha. A new captcha was loaded."
            raise InvalidCaptchaError(
                message,
                recoverable=recoverable,
                details=details,
            )
        if error.category == "session_expired":
            self.state.status = "error"
            raise SessionExpiredError(error.message, recoverable=True, details=error.to_dict())
        if error.category == "survey_error":
            self.state.status = "error"
            raise SurveySearchError(error.message, recoverable=False, details=error.to_dict())
        self.state.status = "error"
        raise ResultNotFoundError(error.message, recoverable=error.recoverable, details=error.to_dict())

    def detect_result(self, delta_or_html) -> BhulekhRawResult | None:
        if hasattr(delta_or_html, "full_html"):
            delta = delta_or_html
            candidate_htmls = [delta.full_html or self.form.current_html(), delta.raw_text]
            alerts = delta.messages
            delta_response = delta_or_html
        else:
            html = str(delta_or_html)
            candidate_htmls = [html]
            alerts = extract_alert_messages(html)
            delta_response = None

        html = None
        markers: list[str] = []
        record_report = None
        fallback_candidate = None
        fallback_markers: list[str] = []
        fallback_report = None
        for candidate in candidate_htmls:
            if not candidate:
                continue
            found, detected_markers = result_exists(candidate)
            if not found:
                continue
            parsed_report = parse_final_record_html(candidate)
            if parsed_report.get("source", {}).get("record_html_found"):
                html = candidate
                markers = detected_markers
                record_report = parsed_report
                break
            if fallback_candidate is None:
                fallback_candidate = candidate
                fallback_markers = detected_markers
                fallback_report = parsed_report

        if not html:
            if fallback_candidate is None:
                return None
            html = fallback_candidate
            markers = fallback_markers
            record_report = fallback_report

        if record_report is None:
            record_report = parse_final_record_html(html)
        source = record_report.get("source", {})
        crop_table = record_report.get("crop_table", {})
        if source.get("record_html_found") and crop_table.get("present"):
            classification = "success_record_with_crop"
        elif source.get("record_html_found"):
            classification = "success_record_without_crop"
        elif "ContentPlaceHolder1_ImgPC" in html:
            classification = "success_result_image_only"
        else:
            classification = "partial_result"
        return BhulekhRawResult(
            final_html=html,
            final_text=extract_visible_text(html),
            page_markers=markers,
            classification=classification,
            alerts=alerts,
            record_report=record_report,
            delta_response=delta_response,
        )

    def detect_alert_or_error(self, delta_or_html) -> ErrorInfo:
        if hasattr(delta_or_html, "raw_text"):
            raw_text = delta_or_html.raw_text
            alerts = list(dict.fromkeys(delta_or_html.messages + extract_alert_messages(delta_or_html.raw_text)))
        else:
            raw_text = str(delta_or_html)
            alerts = extract_alert_messages(raw_text)

        visible_text = extract_visible_text(self.form.current_html())
        alert_text = "\n".join(alerts).lower()
        visible_lower = visible_text.lower()
        raw_lower = raw_text.lower()
        combined = "\n".join([raw_lower, visible_lower, alert_text])

        targeted = "\n".join([alert_text, visible_lower])

        # Debug logging for marker matching
        self.logger.debug(f"Error detection - alerts: {alerts}")
        self.logger.debug(f"Alert text preview (first 150 chars): {alert_text[:150]}")
        self.logger.debug(f"Visible text preview (first 150 chars): {visible_lower[:150]}")

        # Mobile error detection
        if any(marker.lower() in targeted for marker in KNOWN_MOBILE_ERROR_MARKERS):
            matched = [m for m in KNOWN_MOBILE_ERROR_MARKERS if m.lower() in targeted]
            self.logger.info(f"Mobile error detected. Matched markers: {matched}")
            return self._remember_error("mobile_error", alerts, "Server rejected the mobile number.", recoverable=True)
        
        # Captcha error detection
        if any(marker.lower() in targeted for marker in KNOWN_CAPTCHA_ERROR_MARKERS):
            matched = [m for m in KNOWN_CAPTCHA_ERROR_MARKERS if m.lower() in targeted]
            self.logger.info(f"Captcha error detected. Matched markers: {matched}")
            return self._remember_error("captcha_error", alerts, "Server rejected the captcha.", recoverable=True)
        
        # Captcha expired detection
        if any(marker.lower() in combined for marker in KNOWN_CAPTCHA_EXPIRED_MARKERS):
            matched = [m for m in KNOWN_CAPTCHA_EXPIRED_MARKERS if m.lower() in combined]
            self.logger.info(f"Captcha expired detected (text markers). Matched markers: {matched}")
            return self._remember_error("captcha_expired", alerts, "Captcha expired and must be refreshed.", recoverable=True)
        
        # Captcha expired detection (HTML structure)
        if self.state.step == "submitted" and "captchaimage" not in self.form.current_html().lower():
            self.logger.info("Captcha expired detected (captchaimage element missing from HTML)")
            return self._remember_error("captcha_expired", alerts, "Captcha expired and must be refreshed.", recoverable=True)
        
        # Survey error detection
        if any(marker.lower() in targeted for marker in KNOWN_SURVEY_ERROR_MARKERS):
            matched = [m for m in KNOWN_SURVEY_ERROR_MARKERS if m.lower() in targeted]
            self.logger.info(f"Survey error detected. Matched markers: {matched}")
            return self._remember_error("survey_error", alerts, "Survey search or selection failed.", recoverable=False)
        
        # Session expired detection
        if any(marker.lower() in combined for marker in KNOWN_SESSION_EXPIRED_MARKERS):
            matched = [m for m in KNOWN_SESSION_EXPIRED_MARKERS if m.lower() in combined]
            self.logger.info(f"Session expired detected. Matched markers: {matched}")
            return self._remember_error("session_expired", alerts, "Session expired or ASP.NET state is invalid.", recoverable=True)
        
        # Success markers (informational)
        if alerts and any(marker.lower() in combined for marker in KNOWN_SUCCESS_ALERT_MARKERS):
            matched = [m for m in KNOWN_SUCCESS_ALERT_MARKERS if m.lower() in combined]
            self.logger.info(f"Success markers detected. Matched markers: {matched}")
            return self._remember_error("informational_alert", alerts, alerts[0], recoverable=False)
        
        # Unknown error (no markers matched)
        self.logger.warning(f"Unknown error - no markers matched. Alerts: {alerts}")
        return self._remember_error("unknown_error", alerts, "Bhulekh did not return a detectable result.", recoverable=True)

    def normalize_output(
        self,
        raw_result: BhulekhRawResult,
        final_html_path: str | None = None,
        final_pdf_path: str | None = None,
        parsed_record_path: str | None = None,
        pdf_generation: dict | None = None,
    ) -> BhulekhNormalizedResult:
        return build_normalized_result(
            self.state,
            raw_result,
            self.storage,
            final_html_path=final_html_path,
            final_pdf_path=final_pdf_path,
            parsed_record_path=parsed_record_path,
            pdf_generation=pdf_generation,
        )

    def start(self):
        self.load_home()
        self.select_district()
        self.select_taluka()
        self.select_village()
        self.search_survey()
        self.select_survey()
        self.set_mobile(self.state.mobile or self.state.input.mobile)
        self.set_language(self.state.language or self.state.input.language)
        return self.fetch_captcha()

    def replay_from_latest_stable_step(self):
        if self.state.replay_count >= DEFAULT_MAX_WORKFLOW_REPLAYS:
            raise InvalidStateError("Maximum workflow replays exceeded.", recoverable=False)
        self.state.replay_count += 1
        stable_step = self.state.latest_stable_step
        self.logger.bind_step("replay").warning("Replaying workflow from latest stable step: %s", stable_step)

        self.load_home()
        if stable_step in {"district_selected", "taluka_selected", "village_selected", "survey_searched", "survey_selected"}:
            self.select_district(self.state.input.district)
        if stable_step in {"taluka_selected", "village_selected", "survey_searched", "survey_selected"}:
            self.select_taluka(self.state.input.taluka)
        if stable_step in {"village_selected", "survey_searched", "survey_selected"}:
            self.select_village(self.state.input.village)
        if stable_step in {"survey_searched", "survey_selected"}:
            self.search_survey(self.state.input.survey_number)
        if stable_step in {"survey_selected"}:
            self.select_survey(self.state.input.survey_number)
        self._persist_state_snapshot()
        return self.state

    def _ensure_home_loaded(self) -> None:
        if self.state.step == "initialized":
            self.load_home()

    def _require_step(self, required_step: str) -> None:
        if self.state.step == "initialized" and required_step != "home_loaded":
            self.load_home()
        if self.state.step == required_step:
            return
        ordering = [
            "home_loaded",
            "district_selected",
            "taluka_selected",
            "village_selected",
            "survey_searched",
            "survey_selected",
            "mobile_set",
            "language_set",
            "captcha_ready",
            "submitted",
            "result_ready",
        ]
        current_index = ordering.index(self.state.step) if self.state.step in ordering else -1
        required_index = ordering.index(required_step)
        if current_index < required_index - 1:
            raise InvalidStateError(
                f"Workflow step '{self.state.step}' cannot satisfy required step '{required_step}'.",
                details={"current_step": self.state.step, "required_step": required_step},
            )

    def _build_postback_payload(
        self,
        source_control: str,
        updates: dict[str, str],
        event_target: str,
        include_submit_control: bool = False,
    ) -> dict[str, str]:
        selected_survey = self.state.selected_survey or ""
        payload = {
            FIELD_SCRIPT_MANAGER: f"{UPDATE_PANEL_UNIQUE_ID}|{source_control}",
            FIELD_EVENTTARGET: event_target,
            FIELD_EVENTARGUMENT: "",
            FIELD_LASTFOCUS: "",
            FIELD_VIEWSTATE: self.state.hidden_fields.get(FIELD_VIEWSTATE, ""),
            FIELD_RBTN_ULPIN: self.state.input.rbtn_ulpin,
            FIELD_RECORD_TYPE: self.state.input.record_type,
            FIELD_SEARCH_TYPE_RADIO: self.state.input.search_type_radio,
            FIELD_SEARCH_TYPE_DROPDOWN: self.state.input.search_type_dropdown,
            FIELD_DISTRICT: self.state.selected_district or "",
            FIELD_TALUKA: self.state.selected_taluka or "",
            FIELD_VILLAGE: self.state.selected_village or "",
            FIELD_SURVEY_TEXT: selected_survey or "",
            FIELD_SURVEY_DROPDOWN: selected_survey,
            FIELD_MOBILE: self.state.mobile or "",
            FIELD_LANGUAGE: self.state.language or self.state.input.language,
            FIELD_CAPTCHA: "",
        }
        for hidden_field, value in self.state.hidden_fields.items():
            payload.setdefault(hidden_field, value)
        payload.update(updates)
        if not include_submit_control:
            payload.pop(BUTTON_SEARCH, None)
            payload.pop(BUTTON_SUBMIT, None)
        return payload

    def _send_delta_step(self, step: str, payload: dict[str, str]):
        exchange = self.client.ajax_post(payload, step=step, referer=BASE_URL)
        self.storage.save_delta(step, exchange.response_text)
        delta = parse_delta_response(exchange.response_text)
        self.form.refresh_from_delta(delta)
        self.state.cookies = self.client.snapshot_cookies()
        if delta.is_full_page and delta.full_html:
            self.storage.save_text(f"results/{step}.html", delta.full_html, kind="results")
        self._persist_state_snapshot()
        return delta

    def _retry_step(self, step: str, payload: dict[str, str], success_check, error_factory):
        attempts = self.state.input.max_dropdown_refresh_attempts
        last_delta = None
        for attempt in range(1, attempts + 1):
            last_delta = self._send_delta_step(step, payload)
            if success_check():
                self.state.dropdown_retry_counts[step] = attempt - 1
                if attempt > 1:
                    self._record_metadata(f"{step}_retry_success", {"attempt": attempt})
                return last_delta
            self.state.dropdown_retry_counts[step] = attempt
            self._record_metadata(f"{step}_retry", {"attempt": attempt})
        raise error_factory()

    def _handle_mobile_error(self, error: ErrorInfo) -> MobileValidationError:
        if not self.state.input.auto_generate_mobile:
            self.state.status = "error"
            return MobileValidationError(error.message, recoverable=False, details=error.to_dict())

        if self.state.mobile_retry_count >= self.state.input.max_mobile_retries:
            self.state.status = "error"
            return MobileValidationError(
                "Server rejected the mobile number and retry limit was exhausted.",
                recoverable=False,
                details={**error.to_dict(), "mobile_retry_count": self.state.mobile_retry_count},
            )

        self.state.mobile_retry_count += 1
        next_mobile = generate_mobile_number()
        self.state.mobile = next_mobile
        self._record_metadata(
            "mobile_rotated_after_error",
            {
                "mobile": next_mobile,
                "mobile_retry_count": self.state.mobile_retry_count,
                "max_mobile_retries": self.state.input.max_mobile_retries,
            },
        )
        refreshed = self.refresh_captcha()
        return MobileValidationError(
            "Server rejected the mobile number. A new mobile was generated and captcha was refreshed.",
            recoverable=True,
            details={**error.to_dict(), "mobile": next_mobile, "captcha_path": refreshed.image_path},
        )

    def _resolve_language_choice(self, requested_language: str) -> str:
        if not self.state.language_options:
            return requested_language or DEFAULT_LANGUAGE
        if self._option_exists(self.state.language_options, requested_language):
            return requested_language
        if self.state.input.language_fallback_to_first and self.state.language_options:
            fallback = self.state.language_options[0].value
            self.logger.bind_step("set_language").warning(
                "Requested language %s is unavailable; falling back to %s",
                requested_language,
                fallback,
            )
            return fallback
        raise LanguageSelectionError(
            "Requested language is not available in the current language dropdown.",
            recoverable=False,
            details={"requested_language": requested_language, "available_languages": self._option_dicts(self.state.language_options)},
        )

    def _ensure_language_consistency(self) -> None:
        if not self.state.language_options:
            return
        available_values = {option.value for option in self.state.language_options}
        desired = self.state.language or self.state.input.language or DEFAULT_LANGUAGE
        if desired not in available_values:
            self.state.language = self._resolve_language_choice(desired)
            return
        selected = next((option.value for option in self.state.language_options if option.selected), None)
        if selected and selected != desired and self.state.step in {"language_set", "captcha_ready", "submitted"}:
            payload = self._build_postback_payload(
                source_control=FIELD_LANGUAGE,
                event_target=FIELD_LANGUAGE,
                updates={FIELD_LANGUAGE: desired},
            )
            self._send_delta_step("reapply_language", payload)
            self.state.language = desired
            self._record_metadata("language_reapplied", {"language": desired, "previous_language": selected})

    def _option_exists(self, options, value: str | None) -> bool:
        if not value:
            return False
        return any(getattr(option, "value", None) == value for option in options)

    def _has_concrete_value(self, value: str | None) -> bool:
        normalized = (value or "").strip().lower()
        return bool(normalized) and normalized != "interactive"

    def _survey_exists(self, survey_value: str) -> bool:
        return any(option.value == survey_value for option in self.state.survey_options)

    def _option_dicts(self, options) -> list[dict]:
        return [asdict(option) for option in options]

    def _remember_error(self, category: str, alerts: list[str], message: str, recoverable: bool) -> ErrorInfo:
        raw_message = alerts[0] if alerts else None
        error = ErrorInfo(category=category, message=message, raw_message=raw_message, recoverable=recoverable)
        self.state.last_error = error
        self.state.result_classification = category
        self.state.status = "error"
        self.state.touch()
        self._persist_state_snapshot()
        return error

    def _decode_captcha(self, image_base64: str) -> bytes:
        import base64

        return base64.b64decode(image_base64)

    def _record_metadata(self, key: str, value) -> None:
        self.state.metadata[key] = value
        self.state.touch()
        self._persist_state_snapshot()

    def _persist_state_snapshot(self) -> None:
        self.storage.save_workflow_state(self.state.to_public_dict())
