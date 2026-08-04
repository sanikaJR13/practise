"""Parser for Microsoft AJAX delta responses returned by ASP.NET WebForms."""

from __future__ import annotations

from .exceptions import DeltaParseError
from .models import DeltaRecord, DeltaResponse
from .utils import extract_alert_messages, extract_hidden_fields_from_html


def looks_like_full_html(payload: str) -> bool:
    probe = (payload or "").lstrip()
    return probe.startswith("<!DOCTYPE") or probe.startswith("<html") or probe.startswith("<body")


def parse_delta_response(payload: str) -> DeltaResponse:
    """Parse the ASP.NET AJAX partial-postback wire format."""

    raw_text = payload or ""
    stripped = raw_text.lstrip("\ufeff")

    if looks_like_full_html(stripped):
        return DeltaResponse(
            raw_text=raw_text,
            full_html=stripped,
            hidden_fields=extract_hidden_fields_from_html(stripped),
            messages=extract_alert_messages(stripped),
            is_full_page=True,
        )

    records: list[DeltaRecord] = []
    position = 0
    length = len(stripped)
    parse_error: str | None = None

    while position < length:
        while position < length and stripped[position] in "\r\n\t ":
            position += 1
        if position >= length:
            break

        digits_start = position
        while position < length and stripped[position].isdigit():
            position += 1
        if position == digits_start or position >= length or stripped[position] != "|":
            parse_error = stripped[digits_start : min(length, digits_start + 200)]
            break
        chunk_length = int(stripped[digits_start:position])
        position += 1

        kind_start = position
        while position < length and stripped[position] != "|":
            position += 1
        if position >= length:
            parse_error = "Unexpected end while reading delta record kind."
            break
        kind = stripped[kind_start:position]
        position += 1

        name_start = position
        while position < length and stripped[position] != "|":
            position += 1
        if position >= length:
            parse_error = "Unexpected end while reading delta record name."
            break
        name = stripped[name_start:position]
        position += 1

        chunk_end = position + chunk_length
        if chunk_end > length:
            raise DeltaParseError(
                "Malformed delta response: declared chunk length exceeds payload.",
                details={"position": position, "chunk_length": chunk_length, "payload_length": length},
            )
        content = stripped[position:chunk_end]
        position = chunk_end
        if position < length and stripped[position] == "|":
            position += 1

        records.append(DeltaRecord(length=chunk_length, kind=kind, name=name, content=content))

    if not records:
        if looks_like_full_html(stripped):
            return DeltaResponse(
                raw_text=raw_text,
                full_html=stripped,
                hidden_fields=extract_hidden_fields_from_html(stripped),
                messages=extract_alert_messages(stripped),
                is_full_page=True,
            )
        raise DeltaParseError(
            "Unable to parse delta response.",
            details={"preview": stripped[:500], "parse_error": parse_error or "No records found."},
        )

    update_panels = {record.name: record.content for record in records if record.kind == "updatePanel"}
    hidden_fields = {record.name: record.content for record in records if record.kind == "hiddenField"}
    scripts = [
        record.content
        for record in records
        if record.kind in {"scriptBlock", "scriptStartupBlock", "scriptDispose", "scriptPath"}
    ]
    messages = extract_alert_messages(raw_text)
    errors = [record.content for record in records if record.kind == "error"]

    if not update_panels:
        html_candidates = [
            record.content
            for record in records
            if "<html" in record.content.lower() or "<body" in record.content.lower()
        ]
        full_html = html_candidates[0] if html_candidates else None
        if full_html:
            return DeltaResponse(
                raw_text=raw_text,
                records=records,
                update_panels=update_panels,
                hidden_fields={**extract_hidden_fields_from_html(full_html), **hidden_fields},
                scripts=scripts,
                messages=messages,
                errors=errors,
                is_full_page=True,
                full_html=full_html,
                tail=stripped[position:].strip(),
            )

    return DeltaResponse(
        raw_text=raw_text,
        records=records,
        update_panels=update_panels,
        hidden_fields=hidden_fields,
        scripts=scripts,
        messages=messages,
        errors=errors,
        is_full_page=False,
        tail=stripped[position:].strip(),
    )
