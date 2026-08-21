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
        windows_root / "Fonts" / "nirmala.ttc",
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


def generate_pdf_from_8a_data(json_path: Path, pdf_path: Path):
    import json
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    report = json.loads(json_path.read_text(encoding="utf-8"))

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=landscape(A4),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    font_path = _find_reportlab_unicode_font()
    if font_path is None:
        font_path = "C:/Windows/Fonts/nirmala.ttc"
    
    font_name = "BhulekhUnicode"
    if font_name not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(font_name, str(font_path)))

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=12,
        leading=16,
        alignment=1
    )
    
    label_style = ParagraphStyle(
        'LabelStyle',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10,
        leading=14,
        alignment=0
    )

    label_right_style = ParagraphStyle(
        'LabelRightStyle',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10,
        leading=14,
        alignment=2
    )

    cell_style = ParagraphStyle(
        'CellStyle',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=9,
        leading=12,
        alignment=1
    )

    cell_left_style = ParagraphStyle(
        'CellLeftStyle',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=9,
        leading=12,
        alignment=0
    )

    story = []

    header = report.get("header", {})
    khata = report.get("khata_details", {})
    records = report.get("land_records", [])
    totals = report.get("totals", {})

    meta_data = [
        [
            Paragraph(f"<b>वर्ष:</b> {header.get('year') or ''}", label_style),
            Paragraph("<b>गाव नमुना आठ-अ</b><br/><b>धारण जमिनींची नोंदवही (कृषिक)</b><br/>( आसामीवार खातेवणी -- जमाबंदी पत्रक )", title_style),
            Paragraph(f"<b>दिनांक:</b> {header.get('report_date') or ''}", label_right_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[150, 470, 150])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    loc_data = [
        [
            Paragraph(f"<b>गाव:</b> {header.get('village') or ''}", label_style),
            Paragraph(f"<b>तालुका:</b> {header.get('taluka') or ''}", title_style),
            Paragraph(f"<b>जिल्हा:</b> {header.get('district') or ''}", label_right_style)
        ]
    ]
    loc_table = Table(loc_data, colWidths=[250, 270, 250])
    loc_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(loc_table)
    story.append(Spacer(1, 10))

    table_data = []

    table_data.append([
        Paragraph("<b>गाव नमुना सहा मधील नोंद</b>", cell_style),
        Paragraph("<b>भूमापन क्रमांक व उपविभाग क्रमांक</b>", cell_style),
        Paragraph("<b>धारण क्षेत्र</b>", cell_style),
        "", "",
        Paragraph("<b>वसुलीसाठी</b>", cell_style),
        "", "",
        Paragraph("<b>एकूण</b>", cell_style)
    ])

    table_data.append([
        "", "",
        Paragraph("<b>लागवडी योग्य क्षेत्र</b>", cell_style),
        Paragraph("<b>पोटखराब क्षेत्र</b>", cell_style),
        Paragraph("<b>एकूण क्षेत्र</b>", cell_style),
        Paragraph("<b>आकारणी किंवा जुडी</b>", cell_style),
        Paragraph("<b>दुमाला जमिनीवरील नुकसान</b>", cell_style),
        Paragraph("<b>स्थानिक उपकर</b>", cell_style),
        ""
    ])

    table_data.append([
        "", "",
        Paragraph("(हे.आर.चौ.मी)", cell_style),
        Paragraph("(हे.आर.चौ.मी)", cell_style),
        Paragraph("(हे.आर.चौ.मी)", cell_style),
        Paragraph("रु.पै.", cell_style),
        Paragraph("रु.पै.", cell_style),
        Paragraph("<b>जि.प. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ग्रा.प.</b><br/><b>रु.पै. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; रु.पै.</b>", cell_style),
        Paragraph("रु.पै.", cell_style)
    ])

    table_data.append([
        Paragraph("(१)", cell_style),
        Paragraph("(२)", cell_style),
        Paragraph("(३अ)", cell_style),
        Paragraph("(३ब)", cell_style),
        Paragraph("(३क)", cell_style),
        Paragraph("(४)", cell_style),
        Paragraph("(५)", cell_style),
        Paragraph("(६अ) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (६ब)", cell_style),
        Paragraph("(७)", cell_style)
    ])

    khata_text = f"<b>खाते क्र.</b> {khata.get('khata_number') or ''} &nbsp;&nbsp;&nbsp;&nbsp; <b>व्यक्तिगत खातेदार</b> &nbsp;&nbsp;&nbsp;&nbsp; <b>{khata.get('holder_name') or ''}</b>"
    table_data.append([
        Paragraph(khata_text, cell_left_style),
        "", "", "", "", "", "", "", ""
    ])

    for r in records:
        zp = r.get("zp_cess") or ""
        gp = r.get("gp_cess") or ""
        cess_text = f"{zp} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {gp}"
        table_data.append([
            Paragraph("", cell_style),
            Paragraph(r.get("survey_subdivision_number") or "", cell_style),
            Paragraph(r.get("cultivable_area") or "", cell_style),
            Paragraph(r.get("pot_kharab") or "", cell_style),
            Paragraph(r.get("total_area") or "", cell_style),
            Paragraph(r.get("assessment") or "", cell_style),
            Paragraph(r.get("judi") or "0", cell_style),
            Paragraph(cess_text, cell_style),
            Paragraph(r.get("total_assessment") or "", cell_style),
        ])

    t_zp = totals.get("total_zp_cess") or ""
    t_gp = totals.get("total_gp_cess") or ""
    t_cess_text = f"{t_zp} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {t_gp}"
    table_data.append([
        Paragraph("<b>एकूण</b>", cell_style),
        "",
        Paragraph(f"<b>{totals.get('total_cultivable_area') or ''}</b>", cell_style),
        Paragraph(f"<b>{totals.get('total_pot_kharab') or ''}</b>", cell_style),
        Paragraph(f"<b>{totals.get('total_area') or ''}</b>", cell_style),
        Paragraph(f"<b>{totals.get('total_assessment') or ''}</b>", cell_style),
        Paragraph(f"<b>{totals.get('total_judi') or '0'}</b>", cell_style),
        Paragraph(f"<b>{t_cess_text}</b>", cell_style),
        Paragraph(f"<b>{totals.get('total_aggregate') or ''}</b>", cell_style),
    ])

    col_widths = [100, 90, 80, 80, 80, 70, 70, 110, 90]
    main_table = Table(table_data, colWidths=col_widths)

    style_commands = [
        ('SPAN', (0, 0), (0, 2)),
        ('SPAN', (1, 0), (1, 2)),
        ('SPAN', (2, 0), (4, 0)),
        ('SPAN', (5, 0), (7, 0)),
        ('SPAN', (8, 0), (8, 2)),
        ('SPAN', (0, 4), (8, 4)),
        ('SPAN', (0, -1), (1, -1)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, 3), 0.5, colors.black),
        ('GRID', (0, 4), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (-1, 3), colors.HexColor("#f8f9fa")),
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor("#f1f3f5")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]
    main_table.setStyle(TableStyle(style_commands))
    story.append(main_table)
    story.append(Spacer(1, 15))

    disclaimer_style = ParagraphStyle(
        'DisclaimerStyle',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#333333")
    )
    story.append(Paragraph("<b>टिप:</b> उक्त रकाना क्र.(३अ) मधील लागवडी योग्य क्षेत्र हेच आकारणीस पात्र क्षेत्र राहील, पोट-खराब क्षेत्रावर आकारणी लागू नाही.", disclaimer_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>सुचना:</b> या संकेतस्थळावर दर्शविलेली माहिती ही कोणत्याही शासकीय अथवा कायदेशीर बाबींसाठी वापरता येणार नाही.", disclaimer_style))

    def add_watermark(canvas, doc):
        canvas.saveState()
        canvas.setFont(font_name, 48)
        canvas.setFillColor(colors.HexColor("#eaeaea"))
        canvas.drawCentredString(421, 297, "ई महाभूमि")
        canvas.setFont(font_name, 28)
        canvas.drawCentredString(421, 250, "For View Only")
        canvas.restoreState()

    doc.build(story, onFirstPage=add_watermark)


def generate_pdf_via_chrome(html_path: Path, pdf_path: Path, logger) -> bool:
    chrome_path = Path("C:/Program Files/Google/Chrome/Application/chrome.exe")
    if not chrome_path.exists():
        chrome_path = Path("C:/Program Files (x86)/Google/Chrome/Application/chrome.exe")
    if not chrome_path.exists():
        logger.info("Chrome executable not found in standard locations. Skipping Chrome PDF strategy.")
        return False

    try:
        from bs4 import BeautifulSoup
        html_content = html_path.read_text(encoding="utf-8", errors="ignore")
        soup = BeautifulSoup(html_content, "html.parser")
        popup_div = soup.find(id="ContentPlaceHolder1_showPopUp1")
        if not popup_div:
            logger.warning("ContentPlaceHolder1_showPopUp1 not found in HTML. Skipping Chrome PDF strategy.")
            return False

        # Hide/remove close button if it exists
        btn = popup_div.find("input", id="ContentPlaceHolder1_btn8aback")
        if btn:
            btn.decompose()

        # Wrap in a clean printable layout
        clean_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <base href="https://bhulekh.mahabhumi.gov.in/">
    <link rel="stylesheet" href="css/bootstrap.min.css" />
    <link rel="stylesheet" href="css/base.css" />
    <link rel="stylesheet" href="css/style.css" />
    <style>
        body {{
            font-family: 'Sakal Marathi', 'Nirmala UI', sans-serif;
            background: white;
            color: black;
            padding: 20px;
        }}
        .show8a {{
            position: static !important;
            transform: none !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow-y: visible !important;
            padding: 0 !important;
        }}
        .report-page table {{
            width: 100%;
            text-align: center;
            border-collapse: collapse;
        }}
        .report-page td, .report-page th {{
            padding: 6px;
            border: 0.5px solid #000;
        }}
        #background {{
            display: block;
            position: fixed;
            z-index: -1;
            opacity: 0.2;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }}
        @media print {{
            @page {{
                size: A4 landscape;
                margin: 0.5cm;
            }}
            body {{
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }}
        }}
    </style>
</head>
<body>
    {str(popup_div)}
</body>
</html>
"""
        clean_html_path = html_path.parent / "final_record_clean.html"
        clean_html_path.write_text(clean_html, encoding="utf-8")

        import subprocess
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            str(chrome_path),
            "--headless",
            "--disable-gpu",
            f"--print-to-pdf={pdf_path.resolve().absolute()}",
            "--print-to-pdf-no-header",
            str(clean_html_path.resolve().absolute())
        ]
        logger.info("Running headless Chrome print: %s", " ".join(cmd))
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0 and pdf_path.exists() and pdf_path.stat().st_size > 0:
            logger.info("Successfully generated high-fidelity PDF via headless Chrome.")
            return True
        else:
            logger.error("Chrome print failed. returncode: %s, stderr: %s", result.returncode, result.stderr)
            return False
    except Exception as exc:
        logger.exception("Error in Chrome print-to-pdf strategy: %s", exc)
        return False


def generate_final_pdf(
    run_dir: Path,
    final_html_path: Path | None,
    source_image_paths: list[Path],
    final_text_path: Path | None,
    logger,
) -> PdfGenerationResult:
    pdf_path = run_dir / "pdfs" / "final_record.pdf"
    pdf_logger = logger.bind_step("pdf_generation") if hasattr(logger, "bind_step") else logger

    # Try Chrome Headless Print first!
    if final_html_path and final_html_path.exists():
        pdf_logger.info("Attempting Chrome Headless PDF generation using %s", final_html_path)
        if generate_pdf_via_chrome(final_html_path, pdf_path, pdf_logger):
            return PdfGenerationResult(
                success=True,
                pdf_path=str(pdf_path),
                strategy="chrome_headless",
                source_files=[str(final_html_path)],
            )

    # Check if we have parsed 8A data to generate the structured table PDF
    parsed_json_path = run_dir / "results" / "parsed_final_record.json"
    if parsed_json_path.exists():
        pdf_logger.info("Found parsed record data. Attempting structured ReportLab Table PDF generation.")
        try:
            generate_pdf_from_8a_data(parsed_json_path, pdf_path)
            return PdfGenerationResult(
                success=True,
                pdf_path=str(pdf_path),
                strategy="structured_table",
                source_files=[str(parsed_json_path)],
            )
        except Exception as exc:
            pdf_logger.exception("Structured ReportLab Table PDF generation failed: %s", exc)

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
