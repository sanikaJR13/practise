"""Production-grade parser for MahaBhulekh final record HTML."""

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
YEAR_RE = re.compile(r"^\d{4}-\d{2}$")
MUTATION_NUMBER_RE = re.compile(r"\(\s*([^)]+?)\s*\)")
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
        "record_type": "7_12",
        "source": {},
        "header": {},
        "tenure_and_identity": {},
        "area_assessment": {},
        "ownership": {
            "historical_struck_entries": [],
            "current_entries": [],
        },
        "rights_and_mutation": {},
        "alerts": [],
        "disclaimer": {},
        "crop_table": {
            "present": False,
            "section_title": None,
            "header_context": {
                "village": None,
                "village_local_code": None,
                "taluka": None,
                "district": None,
            },
            "columns": [],
            "rows": [],
            "status": "crop_section_not_found",
        },
    }


def looks_like_record_html(raw_html: str) -> bool:
    probes = [
        "गाव नमुना सात",
        "अधिकार अभिलेख पत्रक",
        "खाते क्र.",
        "गाव नमुना&nbsp; बारा",
        "पिकांची&nbsp;नोंदवही",
    ]
    haystack = raw_html
    return sum(1 for probe in probes if probe in haystack) >= 2


def extract_record_html(raw_html: str) -> tuple[str, dict[str, Any]]:
    """Return the actual record HTML from direct HTML or embedded delta/alert payload."""

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


def parse_sections(raw_html: str) -> dict[str, Any]:
    """Split the raw payload into 7/12 and crop fragments."""

    record_html, source_info = extract_record_html(raw_html)
    marker_match = re.search(r"गाव\s+नमुना(?:&nbsp;|\s)+बारा", record_html)
    crop_html = ""
    main_html = record_html
    crop_section_found = False

    if marker_match:
        crop_start = record_html.rfind("<table", 0, marker_match.start())
        if crop_start != -1:
            crop_html = record_html[crop_start:]
            main_html = record_html[:crop_start]
            crop_section_found = True

    return {
        "record_html": record_html,
        "main_html": main_html,
        "crop_html": crop_html,
        "main_soup": BeautifulSoup(main_html, "html.parser"),
        "crop_soup": BeautifulSoup(crop_html, "html.parser") if crop_html else BeautifulSoup("", "html.parser"),
        "source_info": source_info,
        "crop_section_found": crop_section_found,
    }


def get_row_texts(soup: BeautifulSoup) -> list[tuple[int, Tag, list[str], str]]:
    rows: list[tuple[int, Tag, list[str], str]] = []
    for index, tr in enumerate(soup.find_all("tr")):
        direct_cells = tr.find_all(["td", "th"], recursive=False)
        cell_texts = [normalize_text(cell.get_text(" ", strip=True)) for cell in direct_cells]
        row_text = normalize_text(" ".join(cell_texts) if direct_cells else tr.get_text(" ", strip=True))
        rows.append((index, tr, cell_texts, row_text))
    return rows


def extract_first_match(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, re.S)
    return nullable_text(match.group(1)) if match else None


def clean_owner_value(value: str | None) -> str | None:
    text = nullable_text(value)
    if text is None:
        return None
    text = text.strip("[]").strip()
    text = re.sub(r"^-+", "", text).strip()
    text = re.sub(r"-+$", "", text).strip()
    return nullable_text(text)


def clean_scalar_value(value: str | None) -> str | None:
    text = nullable_text(value)
    if text is None:
        return None
    text = text.strip("[]").strip()
    return nullable_text(text)


def extract_mutation_refs(value: str | None) -> list[str]:
    text = normalize_text(value)
    refs = [normalize_text(match.group(1)) for match in MUTATION_NUMBER_RE.finditer(text)]
    return [ref for ref in refs if ref]


def classify_alert_type(message: str) -> str:
    if "फेरफार क्रमांक" in message and ("Confirmation" in message or "बाकी आहे" in message):
        return "mutation_confirmation_pending"
    if "फेरफार" in message:
        return "mutation_alert"
    return "site_alert"


def parse_header(main_soup: BeautifulSoup) -> dict[str, Any]:
    rows = get_row_texts(main_soup)
    full_text = normalize_text(main_soup.get_text(" ", strip=True))
    title_row = next((row_text for _, _, _, row_text in rows if "गाव नमुना" in row_text and "अधिकार" in row_text), "")

    qr_img = main_soup.find("img", id="QRcode")
    qr_payload_summary = None
    if qr_img and qr_img.get("src"):
        parsed = urlparse(qr_img["src"])
        query_data = parse_qs(parsed.query).get("data", [])
        qr_payload_summary = nullable_text(query_data[0]) if query_data else nullable_text(qr_img["src"])

    village_match = re.search(r"गाव\s*:-\s*(.*?)\s*\(\s*(\d+)\s*\)", full_text)

    return {
        "report_date": extract_first_match(full_text, r"अहवाल दिनांक\s*:\s*([0-9/]+)"),
        "form_title_marathi": extract_first_match(title_row, r"(गाव नमुना .*?पत्रक\s*\))"),
        "rules_reference": extract_first_match(title_row, r"\[\s*(.*?)\s*\]"),
        "district": extract_first_match(full_text, r"जिल्हा\s*:-\s*(.*?)(?=\s+(?:PU-ID|ULPIN|भूमापन|गट क्रमांक|भू-धारणा)|\s*$)"),
        "taluka": extract_first_match(full_text, r"तालुका\s*:-\s*(.*?)(?=\s+जिल्हा\s*:-)"),
        "village": nullable_text(village_match.group(1)) if village_match else None,
        "village_local_code": nullable_text(village_match.group(2)) if village_match else None,
        "pu_id": extract_first_match(full_text, r"(?:PU-ID|ULPIN)\s*:\s*([A-Za-z0-9*-]+)"),
        "survey_subdivision_number": extract_first_match(full_text, r"(?:भूमापन|गट) क्रमांक व उपविभाग\s*:\s*([0-9A-Za-z/*-]+)"),
        "qr_payload_summary": qr_payload_summary,
    }


def parse_tenure_and_identity(main_soup: BeautifulSoup) -> dict[str, Any]:
    rows = get_row_texts(main_soup)
    holding_type = None
    field_local_name = None
    for _, _, cell_texts, _ in rows:
        if len(cell_texts) != 2:
            continue
        label = normalize_text(cell_texts[0])
        value = clean_scalar_value(cell_texts[1])
        if "भू-धारणा पध्दती" in label and holding_type is None:
            holding_type = value
        elif "शेताचे स्थानिक नाव" in label and field_local_name is None:
            field_local_name = value
    return {
        "holding_type": holding_type,
        "field_local_name": field_local_name,
    }


def parse_area_assessment(main_soup: BeautifulSoup) -> dict[str, Any]:
    rows = get_row_texts(main_soup)
    full_text = normalize_text(main_soup.get_text(" ", strip=True))
    target_labels = {
        "क्षेत्राचे एकक": "क्षेत्राचे एकक",
        "जिरायत": "जिरायत",
        "बागायत": "बागायत",
        "वरकस": "वरकस",
        "एकुण ला.यो. क्षेत्र": "एकुण ला.यो. क्षेत्र",
        "वर्ग (अ)": "वर्ग (अ)",
        "वर्ग (ब)": "वर्ग (ब)",
        "एकुण पो.ख.": "एकुण पो.ख.",
        "एकुण क्षेत्र (अ+ब)": "एकुण क्षेत्र (अ+ब)",
        "आकारणी": "आकारणी",
        "जुडी किंवा विशेष आकारणी": "जुडी किंवा विशेष आकारणी",
    }
    parsed: dict[str, Any] = {value: None for value in target_labels.values()}

    for _, _, cell_texts, _ in rows:
        if len(cell_texts) != 2:
            continue
        label = normalize_text(cell_texts[0])
        value = clean_scalar_value(cell_texts[1])
        mapped = target_labels.get(label)
        if mapped:
            parsed[mapped] = value
            continue
        for target_label, mapped_name in target_labels.items():
            if target_label in label:
                parsed[mapped_name] = value
                break

    if parsed["एकुण ला.यो. क्षेत्र"] is None:
        parsed["एकुण ला.यो. क्षेत्र"] = extract_first_match(full_text, r"एकुण\s+ला\.यो\.\s+क्षेत्र\s*([0-9.\-]+)")

    return parsed


def is_struck_row(tr: Tag) -> bool:
    if tr.find(["strike", "del", "s"]):
        return True
    for node in tr.find_all(True):
        style = node.get("style", "")
        if "line-through" in style:
            return True
    return False


def parse_ownership(main_soup: BeautifulSoup) -> dict[str, Any]:
    rows = get_row_texts(main_soup)
    header_idx = next(
        (
            index
            for index, _, cell_texts, _ in rows
            if len(cell_texts) == 6 and cell_texts[0] == "खाते क्र." and "भोगवटादाराचे नांव" in cell_texts[1]
        ),
        None,
    )
    result = {
        "historical_struck_entries": [],
        "current_entries": [],
    }
    if header_idx is None:
        return result

    current_entry: dict[str, Any] | None = None
    for row_index, tr, cell_texts, row_text in rows[header_idx + 1 :]:
        if any(marker in row_text for marker in ("कुळाचे नाव", "प्रलंबित फेरफार", "शेवटचा फेरफार")) and len(cell_texts) <= 2:
            break
        if len(cell_texts) != 6:
            continue
        if not any(nullable_text(value) for value in cell_texts):
            continue

        account_number = clean_owner_value(cell_texts[0])
        owner_name = clean_owner_value(cell_texts[1])
        area = clean_scalar_value(cell_texts[2])
        assessment = clean_scalar_value(cell_texts[3])
        pot_kharab = clean_scalar_value(cell_texts[4])
        mutation_references = extract_mutation_refs(cell_texts[5])

        if owner_name and "सामाईक क्षेत्र" in owner_name:
            if current_entry is not None:
                current_entry["common_area_summary"] = {
                    "label": "सामाईक क्षेत्र",
                    "area": area,
                    "assessment": assessment,
                    "pot_kharab": pot_kharab,
                }
            continue

        row_payload = {
            "account_number": account_number,
            "owner_name": owner_name,
            "continuation_owner_names": [],
            "all_owner_names": [owner_name] if owner_name else [],
            "area": area,
            "assessment": assessment,
            "pot_kharab": pot_kharab,
            "mutation_references": mutation_references,
            "raw_row_text": row_text,
        }

        if is_struck_row(tr):
            result["historical_struck_entries"].append(row_payload)
            continue

        if account_number and owner_name:
            current_entry = row_payload
            result["current_entries"].append(current_entry)
            continue

        if not account_number and owner_name and current_entry is not None:
            current_entry["continuation_owner_names"].append(owner_name)
            current_entry["all_owner_names"].append(owner_name)
            if mutation_references:
                for reference in mutation_references:
                    if reference not in current_entry["mutation_references"]:
                        current_entry["mutation_references"].append(reference)

    return result


def parse_rights_and_mutation(main_soup: BeautifulSoup) -> dict[str, Any]:
    rows = get_row_texts(main_soup)
    row_texts = [row_text for _, _, _, row_text in rows if row_text]

    def row_index(needle: str) -> int | None:
        for idx, text in enumerate(row_texts):
            if text == needle:
                return idx
        return None

    def between(start_idx: int | None, end_idx: int | None) -> str | None:
        if start_idx is None or end_idx is None or end_idx <= start_idx:
            return None
        collected = [
            text
            for text in row_texts[start_idx + 1 : end_idx]
            if text and "-----" not in text and "खाते क्र." not in text and "क्षेत्र, एकक व आकारणी" not in text
        ]
        return nullable_text(" ".join(collected))

    kul_idx = row_index("कुळाचे नाव व खंड")
    rights_idx = row_index("इतर अधिकार")
    pending_idx = row_index("प्रलंबित")

    full_text = normalize_text(main_soup.get_text(" ", strip=True))
    pending_mutation_raw = next((text for text in row_texts if "प्रलंबित" in text), None)
    pending_mutation = extract_first_match(pending_mutation_raw or "", r"प्रलंबित\s+[फफ़]ेर[फफ़]ार\s*:\s*(.*)")

    old_mutation_numbers = []
    old_mutation_raw = next((text for text in row_texts if text.startswith("जुने फेरफार क्र.")), "")
    if old_mutation_raw:
        old_mutation_numbers = [match.strip() for match in MUTATION_NUMBER_RE.findall(old_mutation_raw)]

    boundary_and_survey_marks = extract_first_match(old_mutation_raw, r"सीमा आणि भुमापन चिन्हे\s*:\s*(.*)")

    tenancy_name_and_rent = between(kul_idx, rights_idx)
    other_rights = between(rights_idx, pending_idx)
    if other_rights is None:
        other_rights = _extract_rights_text_fallback(full_text)

    return {
        "tenancy_name_and_rent": tenancy_name_and_rent,
        "other_rights": other_rights,
        "other_right_entries": _split_other_right_entries(other_rights),
        "transfer_restriction": _extract_transfer_restriction(other_rights),
        "institutional_land": _extract_institutional_land(other_rights),
        "cooperative_or_society_reference": _extract_cooperative_reference(other_rights),
        "pending_mutation": pending_mutation,
        "pending_mutation_raw": nullable_text(pending_mutation_raw),
        "last_mutation_number": extract_first_match(full_text, r"शेवटचा फेरफार क्रमांक\s*:\s*([0-9A-Za-z/-]+)"),
        "last_mutation_date": extract_first_match(full_text, r"शेवटचा फेरफार क्रमांक\s*:.*?दिनांक\s*:\s*([0-9/]+)"),
        "old_mutation_numbers": old_mutation_numbers,
        "boundary_and_survey_marks": boundary_and_survey_marks,
    }


def _extract_rights_text_fallback(full_text: str) -> str | None:
    patterns = (
        r"कुळाचे नाव व खंड\s+इतर अधिकार\s+(.*?)(?=\s+प्रलंबित\s+[फफ़]ेर[फफ़]ार\s*:)",
        r"इतर अधिकार\s+(.*?)(?=\s+प्रलंबित\s+[फफ़]ेर[फफ़]ार\s*:)",
    )
    for pattern in patterns:
        value = extract_first_match(full_text, pattern)
        if value:
            return value
    return None


def _split_other_right_entries(other_rights: str | None) -> list[dict[str, Any]]:
    text = normalize_text(other_rights)
    if not text:
        return []
    markers = re.split(r"\s+(?=इतर\s+)", text)
    entries = []
    for index, entry in enumerate(markers, start=1):
        normalized = nullable_text(entry)
        if not normalized:
            continue
        entries.append(
            {
                "index": index,
                "text": normalized,
                "mutation_references": extract_mutation_refs(normalized),
            }
        )
    return entries


def _extract_transfer_restriction(other_rights: str | None) -> str | None:
    text = normalize_text(other_rights)
    if not text:
        return None
    if "पूर्व परवानगी" in text and "हस्तांतरास बंदी" in text:
        return extract_first_match(text, r"(सक्षम प्राधिकार्यांच्या पूर्व परवानगी शिवाय हस्तांतरास बंदी[^[]*)") or "सक्षम प्राधिकार्यांच्या पूर्व परवानगी शिवाय हस्तांतरास बंदी"
    return None


def _extract_institutional_land(other_rights: str | None) -> str | None:
    text = normalize_text(other_rights)
    if not text:
        return None
    if "देवस्थान" in text or "इनाम" in text:
        return extract_first_match(text, r"((?:देवस्थान|दे\.?इनाम|इनाम)[^[]*)") or text
    return None


def _extract_cooperative_reference(other_rights: str | None) -> str | None:
    text = normalize_text(other_rights)
    if not text:
        return None
    if "वि.का.से.सो" in text or "सो.इकरार" in text or "इकरार" in text:
        return extract_first_match(text, r"([^।]*?(?:वि\.का\.से\.सो|सो\.इकरार|इकरार)[^।]*?)(?=\s+इतर\s+|\s*$)") or text
    return None


def parse_alerts(record_html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(record_html, "html.parser")
    alerts: list[dict[str, Any]] = []
    for script in soup.find_all("script"):
        script_text = script.string or script.get_text(" ", strip=True)
        if "alert(" not in script_text:
            continue
        for match in re.finditer(r"alert\('(?P<message>.*?)'\)", script_text, re.S):
            message = normalize_text(match.group("message").replace("\\\"", '"').replace("\\'", "'"))
            alerts.append(
                {
                    "type": classify_alert_type(message),
                    "mutation_number": extract_first_match(message, r"फेरफार क्रमांक\s*:\s*([0-9A-Za-z/-]+)"),
                    "message": message,
                }
            )
    return alerts


def parse_disclaimer(record_html: str) -> dict[str, Any]:
    soup = BeautifulSoup(record_html, "html.parser")
    disclaimers: list[str] = []
    for text in soup.stripped_strings:
        normalized = normalize_text(text)
        if "या संकेतस्थळावर दर्शविलेली माहिती" in normalized and "वापरता येणार नाही" in normalized:
            if normalized not in disclaimers:
                disclaimers.append(normalized)

    return {
        "legal_use_allowed": False,
        "text": disclaimers[0] if disclaimers else None,
    }


def parse_crop_table(crop_soup: BeautifulSoup) -> dict[str, Any]:
    result = {
        "present": False,
        "section_title": None,
        "header_context": {
            "village": None,
            "village_local_code": None,
            "taluka": None,
            "district": None,
        },
        "columns": [],
        "rows": [],
        "status": "crop_section_not_found",
    }

    if not crop_soup.get_text(" ", strip=True):
        return result

    rows = get_row_texts(crop_soup)
    title_row = next((row_text for _, _, _, row_text in rows if "गाव नमुना" in row_text and "पिकांची" in row_text), None)
    result["present"] = title_row is not None
    if not title_row:
        return result

    result["status"] = "crop_rows_not_visible"
    result["section_title"] = extract_first_match(title_row, r"(गाव नमुना .*?\))") or title_row

    crop_text = normalize_text(crop_soup.get_text(" ", strip=True))
    village_match = re.search(r"गाव\s*:-\s*(.*?)\s*\(\s*(\d+)\s*\)", crop_text)
    result["header_context"] = {
        "village": nullable_text(village_match.group(1)) if village_match else None,
        "village_local_code": nullable_text(village_match.group(2)) if village_match else None,
        "taluka": extract_first_match(crop_text, r"तालुका\s*:-\s*(.*?)(?=\s+जिल्हा\s*:-)"),
        "district": extract_first_match(crop_text, r"जिल्हा\s*:-\s*(.*?)(?=\s+भूमापन|\s*$)"),
    }

    group_header_row = next((cell_texts for _, _, cell_texts, row_text in rows if "पिकाखालील क्षेत्राचा तपशील" in row_text and len(cell_texts) == 4), [])
    data_header_row = next((cell_texts for _, _, cell_texts, row_text in rows if len(cell_texts) == 10 and cell_texts[:2] == ["वर्षं", "हंगाम"]), [])
    if data_header_row:
        result["columns"] = [*data_header_row, group_header_row[3] if len(group_header_row) >= 4 else "शेरा"]

    for _, _, cell_texts, _ in rows:
        if len(cell_texts) != 11:
            continue
        if not cell_texts[0] or not YEAR_RE.match(cell_texts[0]):
            continue
        row_map = {}
        columns = result["columns"] or [f"column_{index + 1}" for index in range(11)]
        for column_name, value in zip(columns, cell_texts):
            row_map[column_name] = nullable_text(value)
        result["rows"].append(row_map)

    if result["rows"]:
        result["status"] = "ok"

    return result


def parse_final_record_html(raw_html: str) -> dict[str, Any]:
    sections = parse_sections(raw_html)
    report = build_empty_report()
    report["source"] = sections["source_info"]
    report["source"]["crop_section_found"] = sections["crop_section_found"]

    if not sections["source_info"]["record_html_found"]:
        return report

    main_soup = sections["main_soup"]
    report["header"] = parse_header(main_soup)
    report["tenure_and_identity"] = parse_tenure_and_identity(main_soup)
    report["area_assessment"] = parse_area_assessment(main_soup)
    report["ownership"] = parse_ownership(main_soup)
    report["rights_and_mutation"] = parse_rights_and_mutation(main_soup)
    report["alerts"] = parse_alerts(sections["record_html"])
    report["disclaimer"] = parse_disclaimer(sections["record_html"])
    report["crop_table"] = parse_crop_table(sections["crop_soup"])
    return report


def parse_final_record_file(input_path: str | Path, output_path: str | Path | None = None) -> dict[str, Any]:
    input_path = Path(input_path)
    raw_html = input_path.read_text(encoding="utf-8")
    report = parse_final_record_html(raw_html)
    if output_path is not None:
        output_path = Path(output_path)
        output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report
