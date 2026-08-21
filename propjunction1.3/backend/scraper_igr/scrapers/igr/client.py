"""HTTP client and session state management for the IGR scraper."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import os
import time
from typing import Mapping
from urllib.parse import urljoin

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from scraper_igr.scrapers.core.storage import ArtifactStorage

from .constants import (
    BASE_URL,
    BROKEN_PROXY_TARGETS,
    BUTTON_OPEN_SEARCH,
    BUTTON_OPEN_SEARCH_VALUE,
    DEFAULT_CONNECT_TIMEOUT_SECONDS,
    DEFAULT_MAX_HTTP_RETRIES,
    DEFAULT_TIMEOUT_SECONDS,
    FIELD_ASYNCPOST,
    FIELD_EVENTARGUMENT,
    FIELD_EVENTTARGET,
    FIELD_LASTFOCUS,
    FIELD_SCRIPT_MANAGER,
    FULL_POSTBACK_CONTROLS,
    MAIN_UPDATE_PANEL,
    PROXY_ENV_VARS,
    REQUEST_ACCEPT,
    REQUEST_ACCEPT_ENCODING,
    REQUEST_ACCEPT_LANGUAGE,
    REQUEST_USER_AGENT,
)
from .parser import AjaxParseResult, extract_form_fields, find_dropdown_options, parse_ajax_response


@dataclass(slots=True)
class ClientConfig:
    connect_timeout_seconds: int = DEFAULT_CONNECT_TIMEOUT_SECONDS
    read_timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS
    max_retries: int = DEFAULT_MAX_HTTP_RETRIES
    verify_tls: bool = True
    request_delay_seconds: float = float(os.environ.get("IGR_REQUEST_DELAY", "0.3"))


@dataclass(slots=True)
class HttpExchange:
    method: str
    url: str
    request_headers: dict[str, str]
    request_body: str | None
    response_status: int
    response_headers: dict[str, str]
    response_text: str
    started_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class IGRClient:
    """Session-aware transport and form-state layer for the IGR site."""

    def __init__(self, storage: ArtifactStorage, logger, config: ClientConfig | None = None) -> None:
        self.storage = storage
        self.logger = logger
        self.config = config or ClientConfig()
        self.session = requests.Session()
        self.form_data: dict[str, str] = {}
        self.last_ajax = AjaxParseResult(raw_text="", panels={}, fields={})

        if any(os.environ.get(name, "").strip().lower() in BROKEN_PROXY_TARGETS for name in PROXY_ENV_VARS):
            self.session.trust_env = False

        retry = Retry(
            total=self.config.max_retries,
            read=self.config.max_retries,
            connect=self.config.max_retries,
            backoff_factor=0.6,
            status_forcelist=(408, 429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET", "POST"}),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self.session.headers.update(
            {
                "User-Agent": REQUEST_USER_AGENT,
                "Accept": REQUEST_ACCEPT,
                "Accept-Language": REQUEST_ACCEPT_LANGUAGE,
                "Accept-Encoding": REQUEST_ACCEPT_ENCODING,
                "Origin": BASE_URL.rstrip("/"),
                "Referer": BASE_URL,
            }
        )

    def snapshot_cookies(self) -> dict[str, str]:
        return self.session.cookies.get_dict()

    def initialize(self, step: str = "initialize") -> AjaxParseResult:
        exchange = self._request("GET", BASE_URL, step=step, headers={"Referer": BASE_URL})
        self.load_html_response(exchange.response_text)
        return self.last_ajax

    def open_search_form(self, step: str = "open_search_form") -> AjaxParseResult:
        return self.post_event(
            BUTTON_OPEN_SEARCH,
            extra_data={BUTTON_OPEN_SEARCH: BUTTON_OPEN_SEARCH_VALUE},
            step=step,
        )

    def load_html_response(self, html: str) -> None:
        self.last_ajax = AjaxParseResult(
            raw_text=html,
            panels={MAIN_UPDATE_PANEL: html},
            fields=extract_form_fields(html),
            is_full_page=True,
            full_html=html,
        )
        self.form_data = extract_form_fields(html)

    def fetch_dropdown(self, dropdown_id: str) -> dict[str, str]:
        return find_dropdown_options(self.last_ajax, dropdown_id)

    def resolve_url(self, url: str) -> str:
        """Resolve relative resource URLs returned by the ASP.NET page."""

        normalized = (url or "").strip()
        if not normalized:
            raise ValueError("Cannot resolve empty URL.")
        if normalized.startswith(("http://", "https://")):
            return normalized
        if normalized.startswith("~/"):
            return urljoin(BASE_URL, normalized[2:])
        return urljoin(BASE_URL, normalized)

    def post_event(self, target_control: str, extra_data: Mapping[str, str] | None = None, step: str | None = None) -> AjaxParseResult:
        step_name = step or target_control
        request_data = dict(self.form_data)
        request_data[FIELD_EVENTTARGET] = target_control
        request_data[FIELD_EVENTARGUMENT] = ""
        request_data[FIELD_ASYNCPOST] = "true"
        request_data[FIELD_SCRIPT_MANAGER] = f"{MAIN_UPDATE_PANEL}|{target_control}"
        if extra_data:
            request_data.update(dict(extra_data))

        if target_control not in FULL_POSTBACK_CONTROLS:
            exchange = self._request(
                "POST",
                BASE_URL,
                step=step_name,
                headers={
                    "X-Requested-With": "XMLHttpRequest",
                    "X-MicrosoftAjax": "Delta=true",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                },
                data=request_data,
            )
            parsed = parse_ajax_response(exchange.response_text)
            if exchange.response_status == 200 and not parsed.errors:
                self.last_ajax = parsed
                self.form_data.update(parsed.fields)
                for content in parsed.panels.values():
                    self.form_data.update(extract_form_fields(content))
                return parsed

        full_request_data = dict(self.form_data)
        full_request_data[FIELD_EVENTTARGET] = target_control
        full_request_data[FIELD_EVENTARGUMENT] = ""
        full_request_data[FIELD_LASTFOCUS] = ""
        full_request_data.pop(FIELD_ASYNCPOST, None)
        full_request_data.pop(FIELD_SCRIPT_MANAGER, None)
        if extra_data:
            full_request_data.update(dict(extra_data))

        exchange = self._request(
            "POST",
            BASE_URL,
            step=f"{step_name}_full",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data=full_request_data,
        )
        self.load_html_response(exchange.response_text)
        return self.last_ajax

    def submit_search(self, year: int, property_number: str, captcha_text: str, step: str = "submit") -> AjaxParseResult:
        request_data = dict(self.form_data)
        request_data.update(
            {
                "ScriptManager1": "UpMain|btnSearch_RestMaha",
                "ddlFromYear1": str(year),
                "txtAttributeValue1": str(property_number),
                "txtImg1": captcha_text,
                "FS_PropertyNumber": "",
                "FS_IGR_FLAG": "",
                "__EVENTTARGET": "",
                "__EVENTARGUMENT": "",
                "__LASTFOCUS": "",
                "__ASYNCPOST": "true",
                "btnSearch_RestMaha": "शोध / Search",
                "ctl00$ContentPlaceHolder1$rblSearchType": "2",
            }
        )
        # Using a structured logging format or logger from main.py
        self.logger.info(
            "Submitting IGR search. year=%s property_number=%s captcha_text=%s script_manager=%s cookies=%s",
            year,
            property_number,
            captcha_text,
            request_data.get("ScriptManager1"),
            list(self.session.cookies.get_dict().keys()),
        )
        exchange = self._request(
            "POST",
            BASE_URL,
            step=step,
            headers={
                "X-Requested-With": "XMLHttpRequest",
                "X-MicrosoftAjax": "Delta=true",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
            data=request_data,
        )
        parsed = parse_ajax_response(exchange.response_text)
        self.last_ajax = parsed
        self.form_data.update(parsed.fields)
        for content in parsed.panels.values():
            self.form_data.update(extract_form_fields(content))
        return parsed

    def download_binary(self, url: str, step: str) -> bytes:
        absolute_url = self.resolve_url(url)
        self.logger.info("Downloading binary. raw_url=%s resolved_url=%s", url, absolute_url)
        exchange, content = self._request_binary("GET", absolute_url, step=step, headers={"Referer": BASE_URL})
        if exchange.response_status >= 400:
            raise RuntimeError(
                f"Binary download failed with HTTP {exchange.response_status} for {absolute_url}."
            )
        content_type = exchange.response_headers.get("Content-Type", "")
        if len(content) < 200:
            self.logger.warning(
                "Downloaded binary is suspiciously small: %s bytes, content_type=%s, url=%s",
                len(content),
                content_type,
                absolute_url,
            )
        return content

    def _request(
        self,
        method: str,
        url: str,
        step: str,
        headers: Mapping[str, str] | None = None,
        data: Mapping[str, str] | None = None,
    ) -> HttpExchange:
        # Introduce rate-limiting delay to mimic human behavior and avoid server 500 errors
        time.sleep(self.config.request_delay_seconds)
        started_at = datetime.now(timezone.utc).isoformat()
        self.logger.info("Sending %s request to %s", method, url)
        response = self.session.request(
            method=method,
            url=url,
            headers=dict(headers or {}),
            data=data,
            timeout=(self.config.connect_timeout_seconds, self.config.read_timeout_seconds),
            verify=self.config.verify_tls,
        )
        completed_at = datetime.now(timezone.utc).isoformat()
        exchange = HttpExchange(
            method=method,
            url=url,
            request_headers=dict(response.request.headers),
            request_body=response.request.body.decode("utf-8", errors="replace")
            if isinstance(response.request.body, bytes)
            else response.request.body,
            response_status=response.status_code,
            response_headers=dict(response.headers),
            response_text=response.text,
            started_at=started_at,
            completed_at=completed_at,
        )
        self.storage.save_http_exchange(step, exchange)
        self.logger.info("Received HTTP %s with content-type %s", response.status_code, response.headers.get("Content-Type", ""))
        return exchange

    def _request_binary(
        self,
        method: str,
        url: str,
        step: str,
        headers: Mapping[str, str] | None = None,
        data: Mapping[str, str] | None = None,
    ) -> tuple[HttpExchange, bytes]:
        # Introduce rate-limiting delay
        time.sleep(self.config.request_delay_seconds)
        started_at = datetime.now(timezone.utc).isoformat()
        self.logger.info("Sending %s request to %s", method, url)
        response = self.session.request(
            method=method,
            url=url,
            headers=dict(headers or {}),
            data=data,
            timeout=(self.config.connect_timeout_seconds, self.config.read_timeout_seconds),
            verify=self.config.verify_tls,
        )
        completed_at = datetime.now(timezone.utc).isoformat()
        exchange = HttpExchange(
            method=method,
            url=url,
            request_headers=dict(response.request.headers),
            request_body=response.request.body.decode("utf-8", errors="replace")
            if isinstance(response.request.body, bytes)
            else response.request.body,
            response_status=response.status_code,
            response_headers=dict(response.headers),
            response_text=f"<binary {len(response.content)} bytes>",
            started_at=started_at,
            completed_at=completed_at,
        )
        self.storage.save_http_exchange(step, exchange)
        self.logger.info(
            "Received HTTP %s for %s with content-type %s and %s bytes",
            response.status_code,
            response.url,
            response.headers.get("Content-Type", ""),
            len(response.content),
        )
        return exchange, response.content
