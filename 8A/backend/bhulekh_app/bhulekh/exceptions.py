"""Typed exceptions for the Bhulekh workflow."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class BhulekhError(Exception):
    """Base class for all workflow-specific failures."""

    message: str
    recoverable: bool = False
    details: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        return self.message


class NavigationError(BhulekhError):
    """Raised when navigation or transport fails."""


class DeltaParseError(BhulekhError):
    """Raised when Microsoft AJAX delta parsing fails."""


class InvalidStateError(BhulekhError):
    """Raised when workflow state is missing required data."""


class DistrictLoadError(BhulekhError):
    """Raised when district selection or downstream refresh fails."""


class TalukaLoadError(BhulekhError):
    """Raised when taluka selection or downstream refresh fails."""


class VillageLoadError(BhulekhError):
    """Raised when village selection or downstream refresh fails."""


class SurveySearchError(BhulekhError):
    """Raised when survey search cannot populate valid options."""


class SurveyNotFoundError(BhulekhError):
    """Raised when the requested survey is absent from dropdown results."""


class MobileValidationError(BhulekhError):
    """Raised when the server rejects the submitted mobile number."""


class LanguageSelectionError(BhulekhError):
    """Raised when the requested language cannot be applied safely."""


class CaptchaRequiredError(BhulekhError):
    """Raised when caller interaction is required for captcha entry."""


class InvalidCaptchaError(BhulekhError):
    """Raised when the server rejects the submitted captcha."""


class CaptchaExpiredError(BhulekhError):
    """Raised when captcha is missing or expired and must be refreshed."""


class ResultNotFoundError(BhulekhError):
    """Raised when no result is detected after an apparently successful submit."""


class SessionExpiredError(BhulekhError):
    """Raised when the ASP.NET session becomes invalid."""
