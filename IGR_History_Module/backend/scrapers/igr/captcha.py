"""OCR-backed captcha handling for the IGR scraper."""

from __future__ import annotations

import logging
import re
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, UnidentifiedImageError

from .constants import DEFAULT_MAX_OCR_ATTEMPTS, DEFAULT_TESSERACT_CMD

LOGGER = logging.getLogger(__name__)
OCR_CONFIGS = [
    "--psm 8 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    "--psm 10 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    "--psm 6 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    "--psm 8 --oem 1 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
]

try:
    RESAMPLE_LANCZOS = Image.Resampling.LANCZOS
except AttributeError:  # pragma: no cover - Pillow compatibility
    RESAMPLE_LANCZOS = Image.LANCZOS


class IGRCaptchaSolver:
    """Solve IGR captchas using Tesseract with multiple preprocessing variants."""

    def __init__(
        self,
        tesseract_cmd: str | None = None,
        ocr_attempts: int = DEFAULT_MAX_OCR_ATTEMPTS,
        debug_dir: str | Path | None = None,
    ) -> None:
        self.tesseract_cmd = tesseract_cmd or DEFAULT_TESSERACT_CMD
        self.ocr_attempts = max(1, int(ocr_attempts))
        self.debug_dir = Path(debug_dir) if debug_dir else None
        self.logger = LOGGER

    def _configure_tesseract(self) -> object | None:
        try:
            import pytesseract  # type: ignore[import-not-found]
        except Exception as exc:
            self.logger.warning("pytesseract is unavailable for IGR OCR: %s", exc)
            return None

        pytesseract.pytesseract.tesseract_cmd = self.tesseract_cmd
        return pytesseract

    def _load_image_from_bytes(self, image_bytes: bytes) -> Image.Image | None:
        if not image_bytes:
            self.logger.warning("Received empty captcha bytes for OCR.")
            return None
        try:
            with Image.open(BytesIO(image_bytes)) as source_image:
                image = source_image.copy()
                self.logger.info(
                    "Loaded captcha image for OCR. format=%s mode=%s size=%s",
                    source_image.format,
                    source_image.mode,
                    source_image.size,
                )
                return image
        except UnidentifiedImageError as exc:
            self.logger.warning("Could not identify captcha image bytes: %s", exc)
            return None
        except Exception as exc:  # noqa: BLE001
            self.logger.warning("Unexpected error loading captcha image bytes: %s", exc)
            return None

    def _normalize_image(self, image: Image.Image) -> Image.Image:
        """Convert palette/GIF inputs to a grayscale OCR-friendly image."""

        rgb_image = image.convert("RGB")
        return rgb_image.convert("L")

    def _threshold_and_denoise(
        self,
        image: Image.Image,
        *,
        contrast: float,
        threshold: int,
    ) -> Image.Image:
        processed = ImageEnhance.Contrast(image).enhance(contrast)
        processed = processed.point(lambda x: 0 if x < threshold else 255)
        return processed.filter(ImageFilter.MedianFilter(size=3))

    def _build_preprocessed_variants(self, image: Image.Image) -> list[tuple[str, Image.Image]]:
        gray = self._normalize_image(image)
        enlarged_gray = image.convert("RGB").resize(
            (image.width * 2, image.height * 2),
            RESAMPLE_LANCZOS,
        ).convert("L")
        return [
            ("contrast2_threshold128", self._threshold_and_denoise(gray.copy(), contrast=2.0, threshold=128)),
            ("contrast3_threshold140", self._threshold_and_denoise(gray.copy(), contrast=3.0, threshold=140)),
            ("contrast2_5_threshold100", self._threshold_and_denoise(gray.copy(), contrast=2.5, threshold=100)),
            ("enlarged2x_threshold128", self._threshold_and_denoise(enlarged_gray, contrast=2.3, threshold=128)),
        ]

    def _save_debug_variant(self, variant_name: str, image: Image.Image) -> None:
        if not self.debug_dir:
            return
        try:
            self.debug_dir.mkdir(parents=True, exist_ok=True)
            image.save(self.debug_dir / f"{variant_name}.png")
        except Exception as exc:  # noqa: BLE001
            self.logger.warning("Failed to save OCR debug variant %s: %s", variant_name, exc)

    def _clean_text(self, text: str) -> str:
        return re.sub(r"[^A-Z0-9]", "", text.strip().upper())

    def _is_valid_candidate(self, text: str) -> bool:
        return 4 <= len(text) <= 8 and text.isalnum()

    def preprocess_image(self, image: Image.Image) -> list[Image.Image]:
        """Backward-compatible variant list used by older callers/tests."""

        return [variant for _, variant in self._build_preprocessed_variants(image)]

    def solve_image(self, image: Image.Image, attempts: int | None = None) -> str | None:
        pytesseract = self._configure_tesseract()
        if pytesseract is None:
            return None

        try:
            self.logger.info(
                "Starting OCR solve. format=%s mode=%s size=%s",
                getattr(image, "format", None),
                image.mode,
                image.size,
            )
            variants = self._build_preprocessed_variants(image)
        except Exception as exc:  # noqa: BLE001
            self.logger.warning("Failed to preprocess captcha image: %s", exc)
            return None

        max_rounds = max(1, int(attempts or self.ocr_attempts))
        for variant_name, variant_image in variants:
            self._save_debug_variant(variant_name, variant_image)

        for round_index in range(max_rounds):
            for variant_name, variant_image in variants:
                for config in OCR_CONFIGS:
                    try:
                        raw_text = pytesseract.image_to_string(variant_image, config=config)
                    except Exception as exc:  # noqa: BLE001
                        self.logger.warning(
                            "Tesseract failed for variant=%s config=%s round=%s: %s",
                            variant_name,
                            config,
                            round_index + 1,
                            exc,
                        )
                        continue

                    cleaned_text = self._clean_text(raw_text)
                    self.logger.info(
                        "OCR attempt variant=%s config=%s round=%s raw=%r cleaned=%r",
                        variant_name,
                        config,
                        round_index + 1,
                        raw_text,
                        cleaned_text,
                    )
                    if self._is_valid_candidate(cleaned_text):
                        self.logger.info(
                            "Accepted OCR captcha candidate %r using variant=%s config=%s",
                            cleaned_text,
                            variant_name,
                            config,
                        )
                        return cleaned_text

        self.logger.info("No valid OCR captcha candidate found after %s round(s).", max_rounds)
        return None

    def solve_bytes(self, image_bytes: bytes, attempts: int | None = None) -> str | None:
        image = self._load_image_from_bytes(image_bytes)
        if image is None:
            return None
        return self.solve_image(image, attempts=attempts)

    def solve_file(self, image_path: str | Path, attempts: int | None = None) -> str | None:
        try:
            with Image.open(image_path) as source_image:
                image = source_image.copy()
        except (UnidentifiedImageError, OSError) as exc:
            self.logger.warning("Could not open captcha file %s: %s", image_path, exc)
            return None
        except Exception as exc:  # noqa: BLE001
            self.logger.warning("Unexpected error opening captcha file %s: %s", image_path, exc)
            return None
        return self.solve_image(image, attempts=attempts)
