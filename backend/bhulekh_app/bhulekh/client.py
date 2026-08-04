"""Stateful requests client for the Bhulekh ASP.NET workflow."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping

import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .constants import (
    BASE_URL,
    DEFAULT_CONNECT_TIMEOUT_SECONDS,
    DEFAULT_MAX_HTTP_RETRIES,
    DEFAULT_TIMEOUT_SECONDS,
    REQUEST_ACCEPT,
    REQUEST_ACCEPT_ENCODING,
    REQUEST_ACCEPT_LANGUAGE,
    REQUEST_CACHE_CONTROL,
    REQUEST_ORIGIN,
    REQUEST_PRAGMA,
    REQUEST_USER_AGENT,
    RETRYABLE_HTTP_STATUS_CODES,
)
from .exceptions import NavigationError
from .models import HttpExchange
from .storage import ArtifactStorage


@dataclass(slots=True)
class ClientConfig:
    connect_timeout_seconds: int = DEFAULT_CONNECT_TIMEOUT_SECONDS
    read_timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS
    max_retries: int = DEFAULT_MAX_HTTP_RETRIES
    verify_tls: bool = True


class BhulekhClient:
    """Thin transport layer with cookie continuity and delta-friendly headers."""

    def __init__(self, storage: ArtifactStorage, logger, config: ClientConfig | None = None) -> None:
        self.storage = storage
        self.logger = logger
        self.config = config or ClientConfig()
        self.session = requests.Session()

        # Route requests through a proxy if configured in env variables
        proxy_url = os.environ.get("PROXY_URL")
        if proxy_url:
            self.session.proxies = {
                "http": proxy_url,
                "https": proxy_url,
            }
            # Disable SSL/TLS validation so ScraperAPI's HTTPS proxy interception works
            self.config.verify_tls = False
            logger.info("Proxy configured using PROXY_URL, SSL verification disabled")

        retry = Retry(
            total=self.config.max_retries,
            read=self.config.max_retries,
            connect=self.config.max_retries,
            backoff_factor=0.6,
            status_forcelist=RETRYABLE_HTTP_STATUS_CODES,
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
                "Cache-Control": REQUEST_CACHE_CONTROL,
                "Pragma": REQUEST_PRAGMA,
            }
        )

    def snapshot_cookies(self) -> dict[str, str]:
        return self.session.cookies.get_dict()

    def get_homepage(self, step: str = "load_home") -> HttpExchange:
        return self._request("GET", BASE_URL, step=step, headers={"Referer": BASE_URL})

    def ajax_post(self, payload: Mapping[str, str], step: str, referer: str | None = None) -> HttpExchange:
        headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-MicrosoftAjax": "Delta=true",
            "X-Requested-With": "XMLHttpRequest",
            "Origin": REQUEST_ORIGIN,
            "Referer": referer or BASE_URL,
        }
        return self._request("POST", BASE_URL, step=step, headers=headers, data=dict(payload))

    def _request(
        self,
        method: str,
        url: str,
        step: str,
        headers: Mapping[str, str] | None = None,
        data: Mapping[str, str] | None = None,
    ) -> HttpExchange:
        started_at = datetime.now(timezone.utc).isoformat()
        scoped_logger = self.logger.bind_step(step)
        scoped_logger.info("Sending %s request to %s", method, url)

        try:
            response = self.session.request(
                method=method,
                url=url,
                headers=dict(headers or {}),
                data=data,
                timeout=(self.config.connect_timeout_seconds, self.config.read_timeout_seconds),
                verify=self.config.verify_tls,
            )
        except requests.RequestException as exc:
            raise NavigationError("HTTP request failed.", recoverable=True, details={"step": step, "error": str(exc)}) from exc

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

        if response.status_code >= 400:
            raise NavigationError(
                f"Bhulekh returned HTTP {response.status_code}.",
                recoverable=response.status_code >= 500,
                details={"step": step, "status_code": response.status_code},
            )

        scoped_logger.info("Received HTTP %s with content-type %s", response.status_code, response.headers.get("Content-Type", ""))
        return exchange
