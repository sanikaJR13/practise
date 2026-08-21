"""Utility helpers for HTML extraction, text normalization, and file naming."""

from __future__ import annotations

import base64
import json
import mimetypes
import random
import re
from dataclasses import asdict, is_dataclass
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from .constants import (
    HTML_ID_CAPTCHA_IMAGE,
    HTML_ID_DISTRICT,
    HTML_ID_LANGUAGE,
    HTML_ID_RESULT_IMAGE,
    HTML_ID_SURVEY_DROPDOWN,
    HTML_ID_TALUKA,
    HTML_ID_VILLAGE,
)
from .models import LocationOption, SurveyOption

_WHITESPACE_RE = re.compile(r"\s+")
_ALERT_RE = re.compile(r"alert\((['\"])(.*?)\1\)", re.IGNORECASE | re.DOTALL)
_DATA_URI_RE = re.compile(
    r"data:(?P<mime>[-\w.+/]+);base64,(?P<data>[A-Za-z0-9+/=\s]+)",
    re.IGNORECASE,
)


def normalize_whitespace(value: str) -> str:
    return _WHITESPACE_RE.sub(" ", unescape(value or "")).strip()


def sanitize_filename(value: str, default: str = "artifact") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", value.strip())
    return cleaned.strip("._") or default


def generate_mobile_number(seed: int | None = None) -> str:
    rng = random.Random(seed)
    prefix = rng.choice(["98", "99", "88"])
    return prefix + "".join(str(rng.randint(0, 9)) for _ in range(8))


def validate_mobile_number(mobile: str | None) -> bool:
    if not mobile:
        return False
    return bool(re.fullmatch(r"\d{10}", mobile))


def validate_captcha_text(value: str, minimum: int = 4, maximum: int = 8) -> None:
    if not value:
        raise ValueError("Captcha text is required.")
    if len(value) < minimum:
        raise ValueError(f"Captcha text must be at least {minimum} characters.")
    if len(value) > maximum:
        raise ValueError(f"Captcha text must be at most {maximum} characters.")


def extract_alert_messages(text: str) -> list[str]:
    return [normalize_whitespace(match.group(2)) for match in _ALERT_RE.finditer(text or "")]


def guess_extension_from_mime(mime_type: str) -> str:
    if mime_type == "image/jpeg":
        return ".jpg"
    extension = mimetypes.guess_extension(mime_type) or ".bin"
    return extension


def decode_data_uri(data_uri: str) -> tuple[str, bytes]:
    match = _DATA_URI_RE.search(data_uri or "")
    if not match:
        raise ValueError("Not a supported base64 data URI.")
    mime_type = match.group("mime").lower()
    payload = re.sub(r"\s+", "", match.group("data"))
    return mime_type, base64.b64decode(payload)


def find_data_uris(text: str) -> list[tuple[str, str]]:
    results: list[tuple[str, str]] = []
    for match in _DATA_URI_RE.finditer(text or ""):
        results.append((match.group("mime").lower(), re.sub(r"\s+", "", match.group("data"))))
    return results


class _FormHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hidden_fields: dict[str, str] = {}
        self.images: list[dict[str, str]] = []
        self.selects: dict[str, list[dict[str, Any]]] = {}
        self._current_select: str | None = None
        self._current_option: dict[str, Any] | None = None
        self._option_text_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key: value or "" for key, value in attrs}
        if tag == "input":
            name = attributes.get("name")
            input_type = attributes.get("type", "").lower()
            if input_type == "hidden" and name:
                self.hidden_fields[name] = attributes.get("value", "")
        elif tag == "img":
            self.images.append(attributes)
        elif tag == "select":
            select_id = attributes.get("id") or attributes.get("name")
            if select_id:
                self._current_select = select_id
                self.selects.setdefault(select_id, [])
        elif tag == "option" and self._current_select:
            self._current_option = {
                "value": attributes.get("value", "").strip(),
                "selected": "selected" in attributes or attributes.get("selected") == "selected",
            }
            self._option_text_parts = []

    def handle_data(self, data: str) -> None:
        if self._current_option is not None:
            self._option_text_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "option" and self._current_select and self._current_option is not None:
            option = dict(self._current_option)
            option["text"] = normalize_whitespace("".join(self._option_text_parts))
            self.selects[self._current_select].append(option)
            self._current_option = None
            self._option_text_parts = []
        elif tag == "select":
            self._current_select = None


class _VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._ignore_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self._ignore_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self._ignore_depth:
            self._ignore_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._ignore_depth:
            text = normalize_whitespace(data)
            if text:
                self.parts.append(text)


def _parse_form_html(html: str) -> _FormHTMLParser:
    parser = _FormHTMLParser()
    parser.feed(html or "")
    parser.close()
    return parser


def extract_hidden_fields_from_html(html: str) -> dict[str, str]:
    return _parse_form_html(html).hidden_fields


def extract_select_options(html: str, select_id: str) -> list[LocationOption]:
    parser = _parse_form_html(html)
    options = []
    for option in parser.selects.get(select_id, []):
        value = option["value"].strip()
        text = option["text"].strip()
        if not value or value in {"0", "--निवडा--", "--à¤¨à¤¿à¤µà¤¡à¤¾--"}:
            continue
        options.append(LocationOption(value=value, text=text, selected=bool(option["selected"])))
    return options


def extract_survey_options(html: str) -> list[SurveyOption]:
    parser = _parse_form_html(html)
    options = []
    for option in parser.selects.get(HTML_ID_SURVEY_DROPDOWN, []):
        value = option["value"].strip()
        text = option["text"].strip()
        if not value or value.startswith("--"):
            continue
        options.append(SurveyOption(value=value, text=text, selected=bool(option["selected"])))
    return options


def extract_select_snapshot(html: str) -> dict[str, list[LocationOption]]:
    return {
        "district": extract_select_options(html, HTML_ID_DISTRICT),
        "taluka": extract_select_options(html, HTML_ID_TALUKA),
        "village": extract_select_options(html, HTML_ID_VILLAGE),
        "language": extract_select_options(html, HTML_ID_LANGUAGE),
    }


def extract_image_sources(html: str) -> dict[str, str]:
    parser = _parse_form_html(html)
    images: dict[str, str] = {}
    for image in parser.images:
        image_id = image.get("id") or image.get("name")
        if image_id and image.get("src"):
            images[image_id] = image["src"]
    return images


def extract_captcha_base64(html: str) -> tuple[str, str] | None:
    images = extract_image_sources(html)
    source = images.get(HTML_ID_CAPTCHA_IMAGE)
    if not source or "base64," not in source:
        return None
    mime_type, data = decode_data_uri(source)
    return mime_type, base64.b64encode(data).decode("ascii")


def extract_visible_text(html: str) -> str:
    parser = _VisibleTextParser()
    parser.feed(html or "")
    parser.close()
    return "\n".join(parser.parts)


def truncate_text(value: str, maximum: int = 600) -> str:
    value = value.strip()
    if len(value) <= maximum:
        return value
    return value[: maximum - 3].rstrip() + "..."


def select_label(options: list[LocationOption], value: str) -> str | None:
    for option in options:
        if option.value == value:
            return option.text
    return None


def selected_option_value(options: list[LocationOption | SurveyOption]) -> str | None:
    for option in options:
        if option.selected:
            return option.value
    return None


def structured_json_default(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    if is_dataclass(value):
        return asdict(value)
    raise TypeError(f"Object of type {type(value)!r} is not JSON serializable")


def dumps_pretty_json(payload: Any) -> str:
    return json.dumps(payload, indent=2, ensure_ascii=False, default=structured_json_default)


def find_high_fidelity_sources(html: str) -> list[dict[str, str]]:
    images = extract_image_sources(html)
    results: list[dict[str, str]] = []
    for image_id, source in images.items():
        if image_id == HTML_ID_CAPTCHA_IMAGE:
            continue
        if "base64," in source or image_id == HTML_ID_RESULT_IMAGE:
            results.append({"id": image_id, "src": source})
    return results
