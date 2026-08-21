"""Workflow state management and HTML/delta-derived state hydration."""

from __future__ import annotations

from .constants import DEFAULT_STATE_HIDDEN_FIELDS
from .models import DeltaResponse, WorkflowState
from .utils import (
    extract_hidden_fields_from_html,
    extract_select_snapshot,
    extract_survey_options,
    selected_option_value,
    select_label,
)


class FormStateManager:
    """Keep ASP.NET hidden fields and dropdown state synchronized across requests."""

    def __init__(self, state: WorkflowState) -> None:
        self.state = state
        for field_name in DEFAULT_STATE_HIDDEN_FIELDS:
            self.state.hidden_fields.setdefault(field_name, "")

    def refresh_from_html(self, html: str, fragment_name: str = "full_html") -> None:
        self.state.full_html = html
        self.state.html_fragments = {fragment_name: html}
        self.state.hidden_fields.update(extract_hidden_fields_from_html(html))

        snapshot = extract_select_snapshot(html)
        if snapshot["district"]:
            self.state.district_options = snapshot["district"]
        if snapshot["taluka"]:
            self.state.taluka_options = snapshot["taluka"]
        if snapshot["village"]:
            self.state.village_options = snapshot["village"]
        if snapshot["language"]:
            self.state.language_options = snapshot["language"]
            selected_language = selected_option_value(snapshot["language"])
            if selected_language:
                self.state.language = selected_language
                label = select_label(snapshot["language"], selected_language)
                if label:
                    self.state.selected_labels["language"] = label
        survey_options = extract_survey_options(html)
        if survey_options:
            self.state.survey_options = survey_options

        self.state.touch()

    def refresh_from_delta(self, delta: DeltaResponse) -> None:
        self.state.last_delta = delta
        self.state.messages.extend(delta.messages)
        self.state.alerts.extend(delta.messages)
        self.state.hidden_fields.update(delta.hidden_fields)

        if delta.is_full_page and delta.full_html:
            self.refresh_from_html(delta.full_html, fragment_name="full_html")
            return

        for panel_name, panel_html in delta.update_panels.items():
            self.state.html_fragments[panel_name] = panel_html
            self.state.hidden_fields.update(extract_hidden_fields_from_html(panel_html))
            snapshot = extract_select_snapshot(panel_html)
            if snapshot["district"]:
                self.state.district_options = snapshot["district"]
            if snapshot["taluka"]:
                self.state.taluka_options = snapshot["taluka"]
            if snapshot["village"]:
                self.state.village_options = snapshot["village"]
            if snapshot["language"]:
                self.state.language_options = snapshot["language"]
                selected_language = selected_option_value(snapshot["language"])
                if selected_language:
                    self.state.language = selected_language
                    label = select_label(snapshot["language"], selected_language)
                    if label:
                        self.state.selected_labels["language"] = label
            survey_options = extract_survey_options(panel_html)
            if survey_options:
                self.state.survey_options = survey_options

        self.state.touch()

    def current_html(self) -> str:
        if self.state.html_fragments:
            return "\n".join(self.state.html_fragments.values())
        return self.state.full_html or ""

    def set_selected_district(self, value: str) -> None:
        self.state.selected_district = value
        label = select_label(self.state.district_options, value)
        if label:
            self.state.selected_labels["district"] = label
        self.state.touch()

    def set_selected_taluka(self, value: str) -> None:
        self.state.selected_taluka = value
        label = select_label(self.state.taluka_options, value)
        if label:
            self.state.selected_labels["taluka"] = label
        self.state.touch()

    def set_selected_village(self, value: str) -> None:
        self.state.selected_village = value
        label = select_label(self.state.village_options, value)
        if label:
            self.state.selected_labels["village"] = label
        self.state.touch()

    def set_selected_survey(self, value: str) -> None:
        self.state.selected_survey = value
        for option in self.state.survey_options:
            if option.value == value:
                self.state.selected_labels["survey"] = option.text
                break
        self.state.touch()

    def mark_step(self, step: str, stable: bool = False) -> None:
        self.state.step = step
        self.state.status = "running"
        if stable:
            self.state.latest_stable_step = step
        self.state.touch()
