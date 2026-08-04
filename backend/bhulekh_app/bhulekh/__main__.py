"""CLI for request-based Bhulekh workflow execution and interactive selection."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from .client import ClientConfig
from .exceptions import BhulekhError, CaptchaExpiredError, InvalidCaptchaError, MobileValidationError
from .final_record_parser import parse_final_record_file
from .models import LocationOption, PropertyInput, SurveyOption
from .workflow import BhulekhWorkflow


def load_input(path: Path) -> PropertyInput:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return PropertyInput(
        district=str(payload["district"]),
        taluka=str(payload["taluka"]),
        village=str(payload["village"]),
        survey_number=str(payload["survey_number"]),
        mobile=str(payload["mobile"]) if payload.get("mobile") else None,
        language=str(payload.get("language", "mr_in")),
        record_type=str(payload.get("record_type", "SelectSatbara")),
        search_type_radio=str(payload.get("search_type_radio", "17")),
        search_type_dropdown=str(payload.get("search_type_dropdown", "2")),
        auto_generate_mobile=bool(payload.get("auto_generate_mobile", True)),
        max_mobile_retries=int(payload.get("max_mobile_retries", 3)),
        max_captcha_attempts=int(payload.get("max_captcha_attempts", 10)),
        max_dropdown_refresh_attempts=int(payload.get("max_dropdown_refresh_attempts", 3)),
        language_fallback_to_first=bool(payload.get("language_fallback_to_first", True)),
    )


def build_placeholder_input() -> PropertyInput:
    """Create a valid placeholder input for interactive selection mode."""

    return PropertyInput(
        district="interactive",
        taluka="interactive",
        village="interactive",
        survey_number="interactive",
        mobile=None,
        language="mr_in",
        record_type="SelectSatbara",
        search_type_radio="17",
        search_type_dropdown="2",
    )


def prompt_text(prompt: str, default: str | None = None, required: bool = True) -> str:
    while True:
        suffix = f" [{default}]" if default else ""
        value = input(f"{prompt}{suffix}: ").strip()
        if value:
            return value
        if default is not None:
            return default
        if not required:
            return ""
        print("A value is required.")


def prompt_option(label: str, options: Sequence[LocationOption | SurveyOption]) -> LocationOption | SurveyOption:
    if not options:
        raise ValueError(f"No options available for {label}.")

    print(f"\nAvailable {label} options:")
    for index, option in enumerate(options, start=1):
        selected_marker = " [selected]" if getattr(option, "selected", False) else ""
        print(f"{index}. {option.text} ({option.value}){selected_marker}")

    while True:
        choice = input(f"Select {label} by number or exact value: ").strip()
        if not choice:
            print("A selection is required.")
            continue
        if choice.isdigit():
            index = int(choice)
            if 1 <= index <= len(options):
                return options[index - 1]
        for option in options:
            if option.value == choice:
                return option
        print(f"Invalid {label} selection. Use a listed number or an exact option value.")


def run_interactive_selection(workflow: BhulekhWorkflow) -> None:
    workflow.load_home()

    district = prompt_option("district", workflow.state.district_options)
    workflow.state.input.district = district.value
    workflow.select_district(district.value)

    taluka = prompt_option("taluka", workflow.state.taluka_options)
    workflow.state.input.taluka = taluka.value
    workflow.select_taluka(taluka.value)

    village = prompt_option("village", workflow.state.village_options)
    workflow.state.input.village = village.value
    workflow.select_village(village.value)

    survey_query = prompt_text("Enter survey number to search")
    workflow.search_survey(survey_query)
    survey = prompt_option("survey", workflow.state.survey_options)
    workflow.state.input.survey_number = survey.value
    workflow.select_survey(survey.value)

    mobile = prompt_text("Enter mobile number, or press Enter to auto-generate", required=False)
    workflow.state.input.mobile = mobile or None
    workflow.state.mobile = mobile or None
    workflow.set_mobile(workflow.state.mobile or workflow.state.input.mobile)

    language = prompt_text("Enter language code", default=workflow.state.language or workflow.state.input.language)
    workflow.state.input.language = language
    workflow.set_language(language)


def maybe_parse_final_record(workflow: BhulekhWorkflow, requested_output: str | None = None) -> str | None:
    submit_response_path = workflow.storage.responses_dir / "submit.response.txt"
    final_html_path = workflow.storage.results_dir / "final_record.html"

    if submit_response_path.exists():
        parser_input = submit_response_path
    elif final_html_path.exists():
        parser_input = final_html_path
    else:
        return None

    output_path = Path(requested_output) if requested_output else workflow.storage.run_dir / "parsed_final_record.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    parse_final_record_file(parser_input, output_path)
    return str(output_path)


def prompt_captcha_retry_action() -> str:
    print("\nCaptcha was rejected.")
    print("1. Retry same captcha")
    print("2. Refresh captcha")
    print("3. Abort")

    while True:
        choice = input("Choose an action [1/2/3]: ").strip().lower()
        if choice in {"1", "retry", "retry same", "same"}:
            return "retry_same"
        if choice in {"2", "refresh", "new"}:
            return "refresh"
        if choice in {"3", "abort", "quit", "exit"}:
            return "abort"
        print("Enter 1, 2, or 3.")


def submit_with_interactive_captcha_retry(workflow: BhulekhWorkflow, auto_refresh_on_expiration: bool = True):
    """
    Submit CAPTCHA with interactive retry and automatic refresh on expiration.
    
    Args:
        workflow: BhulekhWorkflow instance with CAPTCHA ready
        auto_refresh_on_expiration: If True, auto-refresh expired CAPTCHA up to max_captcha_attempts
    """
    while True:
        captcha = workflow.state.captcha
        attempt_num = workflow.state.captcha_attempt_count + 1
        max_attempts = workflow.state.input.max_captcha_attempts
        
        print(json.dumps({
            "run_id": workflow.run_id,
            "status": "captcha_ready",
            "attempt": attempt_num,
            "max_attempts": max_attempts,
            "captcha_path": captcha.image_path if captcha else None,
            "refresh_count": workflow.state.captcha_refresh_count,
        }, indent=2, ensure_ascii=False))
        
        captcha_text = input("Enter CAPTCHA exactly as shown (or press Ctrl+C to abort): ").strip()
        
        try:
            return workflow.submit_captcha_and_run(captcha_text)
        
        except CaptchaExpiredError as exc:
            print(json.dumps({
                "event": "captcha_expired_auto_refreshed",
                "message": exc.message,
                "details": exc.details,
                "captcha_path": exc.details.get("captcha_path"),
                "refresh_count": exc.details.get("captcha_refresh_count", workflow.state.captcha_refresh_count),
            }, indent=2, ensure_ascii=False))
            if auto_refresh_on_expiration and exc.recoverable:
                continue
            raise
        
        except InvalidCaptchaError as exc:
            print(json.dumps({
                "event": "captcha_rejected_auto_refreshed" if exc.details.get("auto_refreshed") else "captcha_rejected",
                "message": exc.message,
                "details": exc.details,
                "attempts_remaining": max(0, max_attempts - workflow.state.captcha_attempt_count),
                "captcha_path": exc.details.get("captcha_path"),
                "refresh_count": exc.details.get("captcha_refresh_count", workflow.state.captcha_refresh_count),
            }, indent=2, ensure_ascii=False))
            
            if not exc.recoverable:
                raise
            continue
        
        except MobileValidationError as exc:
            print(json.dumps({
                "error": exc.message,
                "recoverable": exc.recoverable,
                "details": exc.details,
            }, indent=2, ensure_ascii=False))
            if exc.recoverable:
                continue
            raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Request-based Bhulekh Maharashtra 7/12 workflow")
    parser.add_argument("--input", help="Path to JSON input file")
    parser.add_argument("--interactive", action="store_true", help="Interactively select district, taluka, village, and survey")
    parser.add_argument("--parse-final-record", action="store_true", help="Parse final record into structured JSON after successful submit")
    parser.add_argument("--parsed-output", help="Optional path for parsed final-record JSON output")
    parser.add_argument("--artifacts", default="runs", help="Root folder for run artifacts")
    parser.add_argument("--connect-timeout", type=int, default=20, help="HTTP connect timeout in seconds")
    parser.add_argument("--read-timeout", type=int, default=90, help="HTTP read timeout in seconds")
    parser.add_argument("--http-retries", type=int, default=4, help="Retry count for transient HTTP failures")
    args = parser.parse_args()

    if not args.interactive and not args.input:
        parser.error("--input is required unless --interactive is used.")

    property_input = build_placeholder_input() if args.interactive else load_input(Path(args.input))
    workflow = BhulekhWorkflow(
        property_input,
        artifact_root=args.artifacts,
        client_config=ClientConfig(
            connect_timeout_seconds=args.connect_timeout,
            read_timeout_seconds=args.read_timeout,
            max_retries=args.http_retries,
        ),
    )

    try:
        if args.interactive:
            run_interactive_selection(workflow)
            workflow.fetch_captcha()
        else:
            workflow.start()
        result = submit_with_interactive_captcha_retry(workflow)
        response_payload = result.to_dict()
        if args.parse_final_record:
            parsed_output_path = maybe_parse_final_record(workflow, args.parsed_output)
            response_payload["parsed_final_record_path"] = parsed_output_path
        print(json.dumps(response_payload, indent=2, ensure_ascii=False))
        return 0
    except BhulekhError as exc:
        print(json.dumps({"error": exc.message, "recoverable": exc.recoverable, "details": exc.details}, indent=2, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
