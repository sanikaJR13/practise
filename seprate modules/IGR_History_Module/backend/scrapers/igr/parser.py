"""HTML and AJAX parsing helpers for the IGR scraper."""

from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.core.delta_parser import parse_delta_response
from scrapers.core.exceptions import DeltaParseError

from .constants import BASE_URL, CAPTCHA_IMAGE_ID, NO_RECORDS_LABEL_ID, RESULT_TABLE_ID


@dataclass(slots=True)
class AjaxParseResult:
    raw_text: str
    panels: dict[str, str] = field(default_factory=dict)
    fields: dict[str, str] = field(default_factory=dict)
    is_full_page: bool = False
    full_html: str | None = None
    messages: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def parse_ajax_response(text: str) -> AjaxParseResult:
    payload = text or ""
    if payload.startswith("0|error|"):
        return AjaxParseResult(raw_text=payload, errors=[payload])

    try:
        delta = parse_delta_response(payload)
    except DeltaParseError as exc:
        return AjaxParseResult(raw_text=payload, errors=[str(exc)])

    return AjaxParseResult(
        raw_text=payload,
        panels=dict(delta.update_panels),
        fields=dict(delta.hidden_fields),
        is_full_page=delta.is_full_page,
        full_html=delta.full_html,
        messages=list(delta.messages),
        errors=list(delta.errors),
    )


def extract_form_fields(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html or "", "html.parser")
    fields: dict[str, str] = {}

    for inp in soup.find_all("input"):
        name = inp.get("name")
        if not name:
            continue

        input_type = inp.get("type", "text").lower()
        if input_type in {"submit", "button", "image", "file", "reset"}:
            continue

        if input_type in {"checkbox", "radio"}:
            if inp.has_attr("checked"):
                fields[name] = inp.get("value", "on")
            continue

        fields[name] = inp.get("value", "")

    for select in soup.find_all("select"):
        name = select.get("name")
        if not name:
            continue
        selected = select.find("option", selected=True) or select.find("option")
        fields[name] = "" if selected is None else selected.get("value", "")

    for textarea in soup.find_all("textarea"):
        name = textarea.get("name")
        if name:
            fields[name] = textarea.get_text()

    return fields


def extract_dropdown_options(html: str, dropdown_id: str) -> dict[str, str]:
    soup = BeautifulSoup(html or "", "html.parser")
    select = soup.find("select", {"id": dropdown_id})
    if select is None:
        return {}

    options: dict[str, str] = {}
    for option in select.find_all("option"):
        raw_value = option.get("value", "")
        value = raw_value.strip()
        text = option.get_text(strip=True)
        if not value or value in {"0", "-1"}:
            continue
        if text.startswith("---") or text.startswith("Select ") or text.startswith("Choose "):
            continue
        options[raw_value] = text
    return options


def find_dropdown_options(result: AjaxParseResult, dropdown_id: str) -> dict[str, str]:
    html_candidates = []
    if result.full_html:
        html_candidates.append(result.full_html)
    html_candidates.extend(result.panels.values())

    for html in html_candidates:
        options = extract_dropdown_options(html, dropdown_id)
        if options:
            return options
    return {}


def find_captcha_image_url(result: AjaxParseResult) -> str | None:
    html_candidates = []
    if result.full_html:
        html_candidates.append(result.full_html)
    html_candidates.extend(result.panels.values())

    for html in html_candidates:
        soup = BeautifulSoup(html or "", "html.parser")
        image = soup.find("img", {"id": CAPTCHA_IMAGE_ID})
        if image and image.get("src"):
            return urljoin(BASE_URL, image["src"])
    return None


def extract_transactions(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html or "", "html.parser")
    table = soup.find("table", {"id": RESULT_TABLE_ID})
    if table is None:
        return []

    transactions: list[dict[str, str]] = []
    rows = table.find_all("tr")[1:]
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 9:
            continue
        transactions.append(
            {
                "DocNo": cells[0].get_text(strip=True),
                "DName": cells[1].get_text(strip=True),
                "RDate": cells[2].get_text(strip=True),
                "SROName": cells[3].get_text(strip=True),
                "SellerName": cells[4].get_text(strip=True),
                "PurchaserName": cells[5].get_text(strip=True),
                "PropertyDescription": cells[6].get_text(strip=True),
                "SROCode": cells[7].get_text(strip=True),
                "Status": cells[8].get_text(strip=True),
            }
        )
    return transactions


def extract_transactions_from_ajax(result: AjaxParseResult) -> list[dict[str, str]]:
    html_candidates = []
    if result.full_html:
        html_candidates.append(result.full_html)
    html_candidates.extend(result.panels.values())

    for html in html_candidates:
        transactions = extract_transactions(html)
        if transactions:
            return transactions
    return []


def extract_no_records_message(html: str) -> str | None:
    soup = BeautifulSoup(html or "", "html.parser")
    msg_span = soup.find("span", {"id": NO_RECORDS_LABEL_ID})
    if msg_span is None:
        return None

    message = msg_span.get_text(strip=True)
    if (
        "नाही" in message
        or "आढळून आलेली नाही" in message
        or "not found" in message.lower()
        or "no records" in message.lower()
    ):
        return "NO_RECORDS"
    return None


def ajax_has_no_records(result: AjaxParseResult) -> bool:
    html_candidates = []
    if result.full_html:
        html_candidates.append(result.full_html)
    html_candidates.extend(result.panels.values())
    return any(extract_no_records_message(html) == "NO_RECORDS" for html in html_candidates)


def primary_html(result: AjaxParseResult) -> str:
    if result.full_html:
        return result.full_html
    if result.panels:
        return "\n".join(result.panels.values())
    return result.raw_text
