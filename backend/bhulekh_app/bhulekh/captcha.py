"""Captcha extraction, validation, and persistence helpers."""

from __future__ import annotations

import base64
from pathlib import Path

from .constants import DEFAULT_CAPTCHA_MAX_LENGTH, DEFAULT_CAPTCHA_MIN_LENGTH, HTML_ID_CAPTCHA_IMAGE
from .exceptions import CaptchaExpiredError
from .models import CaptchaPayload
from .utils import extract_captcha_base64, validate_captcha_text


class CaptchaManager:
    """Manage case-sensitive captcha extraction and storage."""

    def __init__(self, minimum_length: int = DEFAULT_CAPTCHA_MIN_LENGTH, maximum_length: int = DEFAULT_CAPTCHA_MAX_LENGTH) -> None:
        self.minimum_length = minimum_length
        self.maximum_length = maximum_length

    def extract_from_html(self, html: str, refreshed_count: int = 0) -> CaptchaPayload:
        """
        Extract CAPTCHA image from HTML.
        
        Args:
            html: HTML content to search for CAPTCHA image
            refreshed_count: Number of times CAPTCHA has been refreshed
            
        Raises:
            CaptchaExpiredError: If CAPTCHA image not found in HTML
            
        Returns:
            CaptchaPayload: Extracted CAPTCHA image and metadata
        """
        extracted = extract_captcha_base64(html)
        
        if not extracted:
            # Debug: Check if CAPTCHA-related HTML is present
            debug_info = {
                "html_contains_captcha_tag": "captcha" in html.lower()[:50000],
                "html_contains_img_tag": "<img" in html[:50000],
                "html_length": len(html),
                "refreshed_count": refreshed_count,
            }
            raise CaptchaExpiredError(
                "Captcha image is missing from the current HTML.",
                recoverable=True,
                details=debug_info,
            )
        
        mime_type, image_base64 = extracted
        return CaptchaPayload(
            image_base64=image_base64,
            mime_type=mime_type,
            source_html_id=HTML_ID_CAPTCHA_IMAGE,
            refreshed_count=refreshed_count,
        )

    def validate_text(self, value: str) -> str:
        """
        Validate captcha text format, length, and character constraints.
        
        Raises:
            ValueError: If validation fails
            
        Returns:
            str: Validated captcha text (trimmed)
        """
        if not value:
            raise ValueError("CAPTCHA text cannot be empty")
        
        # Check for leading/trailing spaces before stripping
        if value != value.strip():
            raise ValueError(f"CAPTCHA has leading/trailing spaces: '{value}'")
        
        value = value.strip()
        
        if len(value) < self.minimum_length:
            raise ValueError(
                f"CAPTCHA too short: {len(value)} chars (minimum {self.minimum_length} required). "
                f"Entered: '{value}'"
            )
        
        if len(value) > self.maximum_length:
            raise ValueError(
                f"CAPTCHA too long: {len(value)} chars (maximum {self.maximum_length} allowed). "
                f"Entered: '{value}'"
            )
        
        # Check for invalid whitespace within the string
        if "\n" in value or "\t" in value:
            raise ValueError(f"CAPTCHA contains invalid whitespace: '{repr(value)}'")
        
        return value

    def save_png(self, payload: CaptchaPayload, destination: Path) -> Path:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(base64.b64decode(payload.image_base64))
        payload.image_path = str(destination)
        return destination
