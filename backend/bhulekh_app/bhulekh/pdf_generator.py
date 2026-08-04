"""Production-grade PDF generation with HTML, image, and text fallbacks."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import os
from pathlib import Path
import re
from typing import Iterable


@dataclass(slots=True)
class PdfGenerationResult:
    success: bool
    pdf_path: str | None
    strategy: str
    source_files: list[str]
    error: str | None = None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def natural_sort_key(path: Path) -> list[int | str]:
    parts = re.split(r"(\d+)", path.name)
    return [int(part) if part.isdigit() else part.lower() for part in parts]


def html_looks_like_record(html_text: str) -> bool:
    markers = [
        "गाव नमुना सात",
        "अधिकार अभिलेख पत्रक",
        "गाव नमुना बारा",
        "पिकांची नोंदवही",
        "तालुका",
        "जिल्हा",
        "भूमापन क्रमांक",
        "भोगवटादाराचे नांव",
    ]
    text = html_text or ""
    hits = sum(1 for marker in markers if marker in text)
    return hits >= 3


def find_source_images(results_dir: Path) -> list[Path]:
    if not results_dir.exists():
        return []

    found: list[Path] = []
    for pattern in (
        "final_record_source_*.png",
        "final_record_source_*.jpg",
        "final_record_source_*.jpeg",
        "final_record_source_*.webp",
    ):
        found.extend(results_dir.glob(pattern))

    return sorted(set(found), key=natural_sort_key)


def generate_pdf_from_html(html_path: Path, pdf_path: Path, logger) -> PdfGenerationResult:
    try:
        from weasyprint import HTML
    except Exception as exc:  # noqa: BLE001
        return PdfGenerationResult(
            success=False,
            pdf_path=None,
            strategy="html",
            source_files=[str(html_path)],
            error=f"WeasyPrint unavailable: {exc}",
        )

    try:
        html_text = html_path.read_text(encoding="utf-8", errors="ignore")
        if not html_looks_like_record(html_text):
            return PdfGenerationResult(
                success=False,
                pdf_path=None,
                strategy="html",
                source_files=[str(html_path)],
                error="HTML does not look like printable MahaBhulekh record content.",
            )

        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        HTML(filename=str(html_path), base_url=str(html_path.parent)).write_pdf(str(pdf_path))
        logger.info("Generated final PDF from HTML: %s", pdf_path)
        return PdfGenerationResult(
            success=True,
            pdf_path=str(pdf_path),
            strategy="html",
            source_files=[str(html_path)],
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("HTML-to-PDF generation failed for %s", html_path)
        return PdfGenerationResult(
            success=False,
            pdf_path=None,
            strategy="html",
            source_files=[str(html_path)],
            error=str(exc),
        )


def generate_pdf_from_images(image_paths: Iterable[Path], pdf_path: Path, logger) -> PdfGenerationResult:
    sorted_paths = sorted({Path(path) for path in image_paths}, key=natural_sort_key)
    if not sorted_paths:
        return PdfGenerationResult(
            success=False,
            pdf_path=None,
            strategy="images",
            source_files=[],
            error="No decoded source images available.",
        )

    try:
        import img2pdf  # type: ignore[import-not-found]
    except Exception:  # noqa: BLE001
        img2pdf = None

    if img2pdf is not None:
        try:
            pdf_path.parent.mkdir(parents=True, exist_ok=True)
            pdf_path.write_bytes(img2pdf.convert([str(path) for path in sorted_paths]))
            logger.info("Generated final PDF from decoded source images via img2pdf: %s", pdf_path)
            return PdfGenerationResult(
                success=True,
                pdf_path=str(pdf_path),
                strategy="images",
                source_files=[str(path) for path in sorted_paths],
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("img2pdf image-to-PDF generation failed")
            image_error = f"img2pdf failed: {exc}"
    else:
        image_error = "img2pdf unavailable"

    try:
        from PIL import Image
    except Exception as exc:  # noqa: BLE001
        return PdfGenerationResult(
            success=False,
            pdf_path=None,
            strategy="images",
            source_files=[str(path) for path in sorted_paths],
            error=f"{image_error}; Pillow unavailable: {exc}",
        )

    images = []
    try:
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        for image_path in sorted_paths:
            image = Image.open(image_path)
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.load()
            images.append(image)

        first, *rest = images
        first.save(
            pdf_path,
            "PDF",
            save_all=True,
            append_images=rest,
            resolution=300.0,
        )
        logger.info("Generated final PDF from decoded source images via Pillow: %s", pdf_path)
        return PdfGenerationResult(
            success=True,
            pdf_path=str(pdf_path),
            strategy="images",
            source_files=[str(path) for path in sorted_paths],
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Image-to-PDF generation failed")
        return PdfGenerationResult(
            success=False,
            pdf_path=None,
            strategy="images",
            source_files=[str(path) for path in sorted_paths],
            error=f"{image_error}; {exc}",
        )
    finally:
        for image in images:
            try:
                image.close()
            except Exception:  # noqa: BLE001
                pass


def _find_reportlab_unicode_font() -> Path | None:
    windows_root = Path(os.environ.get("WINDIR", r"C:\Windows"))
    candidates = [
        windows_root / "Fonts" / "Nirmala.ttf",
        windows_root / "Fonts" / "NirmalaS.ttf",
        windows_root / "Fonts" / "Mangal.ttf",
        windows_root / "Fonts" / "Aparaj.ttf",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def generate_pdf_from_text(text_path: Path, pdf_path: Path, logger) -> PdfGenerationResult:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.pdfgen import canvas
    except Exception as exc:  # noqa: BLE001
        return PdfGenerationResult(
            success=False,
            pdf_path=None,
            strategy="text",
            source_files=[str(text_path)],
            error=f"reportlab unavailable: {exc}",
        )

    try:
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        text = text_path.read_text(encoding="utf-8", errors="ignore")

        font_name = "Helvetica"
        font_path = _find_reportlab_unicode_font()
        if font_path is not None:
            font_name = "BhulekhUnicode"
            if font_name not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont(font_name, str(font_path)))

        pdf = canvas.Canvas(str(pdf_path), pagesize=A4)
        width, height = A4
        margin_x = 36
        margin_y = 36
        font_size = 10
        line_height = 14
        pdf.setFont(font_name, font_size)

        max_width = width - (margin_x * 2)
        y = height - margin_y
        for raw_line in text.splitlines() or [""]:
            current = raw_line.rstrip() or ""
            segments = [current] if current else [""]
            wrapped: list[str] = []
            for segment in segments:
                remaining = segment
                while remaining:
                    cut = len(remaining)
                    while cut > 1 and pdfmetrics.stringWidth(remaining[:cut], font_name, font_size) > max_width:
                        cut -= 1
                    wrapped.append(remaining[:cut])
                    remaining = remaining[cut:]
                if not segment:
                    wrapped.append("")

            for line in wrapped:
                if y < margin_y:
                    pdf.showPage()
                    pdf.setFont(font_name, font_size)
                    y = height - margin_y
                pdf.drawString(margin_x, y, line)
                y -= line_height

        pdf.save()
        logger.info("Generated final PDF from text fallback: %s", pdf_path)
        return PdfGenerationResult(
            success=True,
            pdf_path=str(pdf_path),
            strategy="text",
            source_files=[str(text_path)],
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Text-to-PDF generation failed")
        return PdfGenerationResult(
            success=False,
            pdf_path=None,
            strategy="text",
            source_files=[str(text_path)],
            error=str(exc),
        )


def generate_final_pdf(
    run_dir: Path,
    final_html_path: Path | None,
    source_image_paths: list[Path],
    final_text_path: Path | None,
    logger,
) -> PdfGenerationResult:
    pdf_path = run_dir / "pdfs" / "final_record.pdf"
    pdf_logger = logger.bind_step("pdf_generation") if hasattr(logger, "bind_step") else logger

    if final_html_path and final_html_path.exists():
        pdf_logger.info("Attempting HTML-first PDF generation using %s", final_html_path)
        html_result = generate_pdf_from_html(final_html_path, pdf_path, pdf_logger)
        if html_result.success:
            return html_result
        pdf_logger.warning("HTML PDF generation unavailable or unsuitable: %s", html_result.error)

    sorted_images = sorted({Path(path) for path in source_image_paths}, key=natural_sort_key)
    if sorted_images:
        pdf_logger.info("Attempting image-based PDF generation using %s", [str(path) for path in sorted_images])
        image_result = generate_pdf_from_images(sorted_images, pdf_path, pdf_logger)
        if image_result.success:
            return image_result
        pdf_logger.warning("Image PDF generation failed, falling back: %s", image_result.error)

    if final_text_path and final_text_path.exists():
        pdf_logger.info("Attempting text-based PDF fallback using %s", final_text_path)
        text_result = generate_pdf_from_text(final_text_path, pdf_path, pdf_logger)
        if text_result.success:
            return text_result
        pdf_logger.warning("Text PDF generation failed: %s", text_result.error)

    return PdfGenerationResult(
        success=False,
        pdf_path=None,
        strategy="none",
        source_files=[],
        error="All PDF generation strategies failed.",
    )
