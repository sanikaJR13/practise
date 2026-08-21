"""Production-grade parser for MahaBhulekh 8A final record HTML."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup, Tag

DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
WHITESPACE_RE = re.compile(r"\s+")
DATE_RE = re.compile(r"(\d{2}/\d{2}/\d{4})")


def normalize_text(value: str | None) -> str:
    if value is None:
        return ""
    value = html.unescape(value).replace("\xa0", " ")
    return WHITESPACE_RE.sub(" ", value).strip()


def nullable_text(value: str | None) -> str | None:
    text = normalize_text(value)
    if not text or text == "-":
        return None
    return text


def repair_mojibake_if_needed(value: str) -> str:
    devanagari_count = len(DEVANAGARI_RE.findall(value))
    mojibake_count = value.count("à¤") + value.count("à¥")
    if mojibake_count > devanagari_count and mojibake_count > 5:
        try:
            return value.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return value
    return value


def build_empty_report() -> dict[str, Any]:
    return {
        "record_type": "8A",
        "source": {},
        "header": {},
        "khata_details": {
            "khata_number": None,
            "holder_name": None,
            "other_holders": [],
        },
        "land_records": [],
        "totals": {
            "total_pot_kharab": None,
            "total_cultivable_area": None,
            "total_area": None,
            "total_assessment": None,
        },
        "disclaimer": {},
        "alerts": [],
    }


def looks_like_record_html(raw_html: str) -> bool:
    probes = [
        "गाव नमुना आठ-अ",
        "गाव नमुना ८अ",
        "गाव नमुना ८-अ",
        "एकत्रित खाते",
        "खातेदार",
        "खाते क्रमांक",
        "आकारणी",
    ]
    haystack = repair_mojibake_if_needed(raw_html)
    return sum(1 for probe in probes if probe in haystack) >= 2


def extract_record_html(raw_html: str) -> tuple[str, dict[str, Any]]:
    raw_html = repair_mojibake_if_needed(raw_html)
    source_info = {
        "record_html_found": False,
        "extraction_mode": "unresolved",
    }

    start = raw_html.find("alert('<head")
    if start != -1:
        content_start = start + len("alert('")
        for terminator in ("')|", "');", "')"):
            end = raw_html.find(terminator, content_start)
            if end != -1:
                candidate = raw_html[content_start:end].replace("\\'", "'")
                candidate = repair_mojibake_if_needed(candidate)
                if looks_like_record_html(candidate):
                    source_info["record_html_found"] = True
                    source_info["extraction_mode"] = "embedded_alert_html"
                    return candidate, source_info

    if looks_like_record_html(raw_html):
        source_info["record_html_found"] = True
        source_info["extraction_mode"] = "direct_html"
        return raw_html, source_info

    source_info["extraction_mode"] = "no_record_html_found"
    return raw_html, source_info


def parse_final_record_html(raw_html: str) -> dict[str, Any]:
    record_html, source_info = extract_record_html(raw_html)
    report = build_empty_report()
    report["source"] = source_info

    if not source_info["record_html_found"]:
        return report

    soup = BeautifulSoup(record_html, "html.parser")

    # Parse Report Date
    report_date = None
    date_el = soup.find(id="ContentPlaceHolder1_lblDate1")
    if date_el:
        report_date = normalize_text(date_el.get_text())

    year_el = soup.find(id="ContentPlaceHolder1_lblYear1")
    year = normalize_text(year_el.get_text()) if year_el else None

    village_el = soup.find(id="ContentPlaceHolder1_lblVillage1")
    village = normalize_text(village_el.get_text()) if village_el else None

    taluka_el = soup.find(id="ContentPlaceHolder1_lblTaluka1")
    taluka = normalize_text(taluka_el.get_text()) if taluka_el else None

    district_el = soup.find(id="ContentPlaceHolder1_lblDistrict1")
    district = normalize_text(district_el.get_text()) if district_el else None

    # Parse QR payload summary
    qr_img = soup.find("img", id="QRcode")
    qr_payload_summary = None
    if qr_img and qr_img.get("src"):
        parsed = urlparse(qr_img["src"])
        query_data = parse_qs(parsed.query).get("data", [])
        qr_payload_summary = nullable_text(query_data[0]) if query_data else nullable_text(qr_img["src"])

    report["header"] = {
        "report_date": report_date,
        "district": district,
        "taluka": taluka,
        "village": village,
        "year": year,
        "qr_payload_summary": qr_payload_summary,
    }

    # Parse Khata details
    khata_no = None
    khata_el = soup.find(id="ContentPlaceHolder1_lblKhataNo1")
    if khata_el:
        khata_no = normalize_text(khata_el.get_text())

    holder_name = None
    holder_el = soup.find(id="ContentPlaceHolder1_lblNames1")
    if holder_el:
        holder_name = normalize_text(holder_el.get_text())

    khata_type = None
    type_el = soup.find(id="ContentPlaceHolder1_lblKhataType1")
    if type_el:
        khata_type = normalize_text(type_el.get_text())

    report["khata_details"] = {
        "khata_number": khata_no,
        "holder_name": holder_name,
        "khata_type": khata_type,
        "other_holders": [],
    }

    # Parse land records from Table1
    land_records = []
    table1 = soup.find("table", id="ContentPlaceHolder1_Table1")
    if table1:
        for tr in table1.find_all("tr"):
            cells = [normalize_text(td.get_text(" ", strip=True)) for td in tr.find_all(["td", "th"])]
            if len(cells) >= 9:
                land_records.append({
                    "survey_subdivision_number": cells[0],
                    "holding_type": "", # placeholder for compatibility
                    "area_unit": "Hectare/Are",
                    "cultivable_area": cells[1],
                    "pot_kharab": cells[2],
                    "total_area": cells[3],
                    "assessment": cells[4],
                    "judi": cells[5],
                    "zp_cess": cells[6],
                    "gp_cess": cells[7],
                    "total_assessment": cells[8],
                })
    report["land_records"] = land_records

    # Parse totals from Table2
    table2 = soup.find("table", id="ContentPlaceHolder1_Table2") or soup.find("table", id="ContentPlaceHolder2_Table2")
    if table2:
        tr = table2.find("tr")
        if tr:
            cells = [normalize_text(td.get_text(" ", strip=True)) for td in tr.find_all(["td", "th"])]
            if len(cells) >= 8:
                report["totals"] = {
                    "total_cultivable_area": cells[0],
                    "total_pot_kharab": cells[1],
                    "total_area": cells[2],
                    "total_assessment": cells[3],
                    "total_judi": cells[4],
                    "total_zp_cess": cells[5],
                    "total_gp_cess": cells[6],
                    "total_aggregate": cells[7],
                }

    # Parse disclaimer
    disclaimers: list[str] = []
    for text in soup.stripped_strings:
        normalized = normalize_text(text)
        if "या संकेतस्थळावर दर्शविलेली माहिती" in normalized and "वापरता येणार नाही" in normalized:
            if normalized not in disclaimers:
                disclaimers.append(normalized)

    report["disclaimer"] = {
        "legal_use_allowed": False,
        "text": disclaimers[0] if disclaimers else None,
    }

    # Parse alerts
    alerts: list[dict[str, Any]] = []
    for script in soup.find_all("script"):
        script_text = script.string or script.get_text(" ", strip=True)
        if "alert(" not in script_text:
            continue
        for match in re.finditer(r"alert\('(?P<message>.*?)'\)", script_text, re.S):
            message = normalize_text(match.group("message").replace("\\\"", '"').replace("\\'", "'"))
            alerts.append({
                "type": "site_alert",
                "message": message,
            })
    report["alerts"] = alerts

    return report


def parse_final_record_file(input_path: str | Path, output_path: str | Path | None = None) -> dict[str, Any]:
    input_path = Path(input_path)
    raw_html = input_path.read_text(encoding="utf-8")
    report = parse_final_record_html(raw_html)
    if output_path is not None:
        output_path = Path(output_path)
        output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def format_record_as_text(report: dict[str, Any]) -> str:
    header = report.get("header", {})
    khata = report.get("khata_details", {})
    records = report.get("land_records", [])
    totals = report.get("totals", {})
    disclaimer = report.get("disclaimer", {}).get("text") or "सुचना : या संकेतस्थळावर दर्शविलेली माहिती ही कोणत्याही शासकीय अथवा कायदेशीर बाबींसाठी वापरता येणार नाही."

    lines = []
    lines.append("गाव नमुना आठ-अ")
    lines.append("धारण जमिनींची नोंदवही (कृषिक)")
    lines.append("( आसामीवार खतावणी -- जमाबंदी पत्रक )")
    lines.append("")
    lines.append(f"वर्ष: {header.get('year') or ''}    दिनांक: {header.get('report_date') or ''}")
    lines.append(f"जिल्हा: {header.get('district') or ''}    तालुका: {header.get('taluka') or ''}    गाव: {header.get('village') or ''}")
    lines.append("-" * 90)
    lines.append(f"खाते क्र.: {khata.get('khata_number') or ''}    खातेदाराचे नाव: {khata.get('holder_name') or ''} ({khata.get('khata_type') or ''})")
    lines.append("-" * 90)
    lines.append("भूमापन क्रमांक व    धारण क्षेत्र (हे.आर.चौ.मी)                वसुलीसाठी (रु.पै.)")
    lines.append("उपविभाग क्रमांक     लागवडीयोग्य   पोटखराब     एकूण क्षेत्र    आकारणी/जुडी  स्थानिक उपकर ZP/GP   एकूण आकारणी")
    lines.append("-" * 90)

    for r in records:
        survey = (r.get("survey_subdivision_number") or "").ljust(18)
        cult = (r.get("cultivable_area") or "").ljust(13)
        pot = (r.get("pot_kharab") or "").ljust(11)
        tot = (r.get("total_area") or "").ljust(15)
        tax = (r.get("assessment") or "").ljust(13)
        cess = f"{r.get('zp_cess') or ''}/{r.get('gp_cess') or ''}".ljust(21)
        tot_tax = r.get("total_assessment") or ""
        lines.append(f"{survey}{cult}{pot}{tot}{tax}{cess}{tot_tax}")

    lines.append("-" * 90)
    total_lbl = "एकूण:".ljust(18)
    t_cult = (totals.get("total_cultivable_area") or "").ljust(13)
    t_pot = (totals.get("total_pot_kharab") or "").ljust(11)
    t_area = (totals.get("total_area") or "").ljust(15)
    t_tax = (totals.get("total_assessment") or "").ljust(13)
    t_cess = f"{totals.get('total_zp_cess') or ''}/{totals.get('total_gp_cess') or ''}".ljust(21)
    t_aggregate = totals.get("total_aggregate") or ""
    lines.append(f"{total_lbl}{t_cult}{t_pot}{t_area}{t_tax}{t_cess}{t_aggregate}")
    lines.append("-" * 90)
    lines.append("")
    lines.append("टिप : उक्त रकाना क्र.(३अ) मधील लागवडी योग्य क्षेत्र हेच आकारणीस पात्र क्षेत्र राहील, पोट-खराब क्षेत्रावर आकारणी लागू नाही.")
    lines.append(disclaimer)

    return "\n".join(lines)

