"""Artifact storage layer for raw HTML, deltas, captcha images, and normalized output."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from .models import HttpExchange, RunArtifacts
from .utils import (
    decode_data_uri,
    dumps_pretty_json,
    find_high_fidelity_sources,
    guess_extension_from_mime,
    sanitize_filename,
)


class ArtifactStorage:
    """Persist run artifacts with source-preserving fidelity."""

    def __init__(self, root_dir: str | Path, run_id: str) -> None:
        self.root_dir = Path(root_dir)
        self.run_id = run_id
        self.run_dir = self.root_dir / run_id
        self.requests_dir = self.run_dir / "requests"
        self.responses_dir = self.run_dir / "responses"
        self.captchas_dir = self.run_dir / "captchas"
        self.results_dir = self.run_dir / "results"
        self.pdfs_dir = self.run_dir / "pdfs"
        self.debug_dir = self.run_dir / "debug"
        self.logs_dir = self.run_dir / "logs"
        for directory in (
            self.requests_dir,
            self.responses_dir,
            self.captchas_dir,
            self.results_dir,
            self.pdfs_dir,
            self.debug_dir,
            self.logs_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)
        self.artifacts = RunArtifacts(run_dir=str(self.run_dir))

    def _register(self, kind: str, path: Path) -> Path:
        self.artifacts.add(kind, path)
        return path

    def register_existing_path(self, kind: str, path: str | Path) -> Path:
        return self._register(kind, Path(path))

    def save_text(self, relative_path: str | Path, content: str, kind: str) -> Path:
        path = self.run_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return self._register(kind, path)

    def save_json(self, relative_path: str | Path, payload: Any, kind: str) -> Path:
        return self.save_text(relative_path, dumps_pretty_json(payload), kind)

    def save_binary(self, relative_path: str | Path, content: bytes, kind: str) -> Path:
        path = self.run_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return self._register(kind, path)

    def save_http_exchange(self, step: str, exchange: HttpExchange) -> tuple[Path, Path]:
        stem = sanitize_filename(step)
        request_path = self.save_json(
            self.requests_dir.relative_to(self.run_dir) / f"{stem}.request.json",
            {
                "method": exchange.method,
                "url": exchange.url,
                "headers": exchange.request_headers,
                "body": exchange.request_body,
                "started_at": exchange.started_at,
                "completed_at": exchange.completed_at,
            },
            kind="requests",
        )
        response_path = self.save_text(
            self.responses_dir.relative_to(self.run_dir) / f"{stem}.response.txt",
            exchange.response_text,
            kind="responses",
        )
        return request_path, response_path

    def save_metadata(self, payload: Any) -> Path:
        return self.save_json("metadata.json", payload, kind="metadata")

    def save_workflow_state(self, payload: Any) -> Path:
        return self.save_json("workflow_state.json", payload, kind="metadata")

    def save_normalized_result(self, payload: Any) -> Path:
        return self.save_json("normalized_result.json", payload, kind="normalized")

    def save_parsed_result(self, payload: Any, stem: str = "parsed_final_record") -> Path:
        return self.save_json(self.results_dir.relative_to(self.run_dir) / f"{sanitize_filename(stem)}.json", payload, kind="parsed")

    def save_captcha_bytes(self, filename: str, content: bytes) -> Path:
        return self.save_binary(self.captchas_dir.relative_to(self.run_dir) / filename, content, kind="captchas")

    def save_final_html(self, html: str, stem: str = "final_result") -> Path:
        return self.save_text(self.results_dir.relative_to(self.run_dir) / f"{sanitize_filename(stem)}.html", html, kind="results")

    def save_final_text(self, text: str, stem: str = "final_result") -> Path:
        return self.save_text(self.results_dir.relative_to(self.run_dir) / f"{sanitize_filename(stem)}.txt", text, kind="results")

    def save_delta(self, step: str, raw_delta: str) -> Path:
        return self.save_text(
            self.debug_dir.relative_to(self.run_dir) / f"{sanitize_filename(step)}.delta.txt",
            raw_delta,
            kind="debug",
        )

    def save_high_fidelity_sources(self, html: str, stem: str = "embedded_source") -> list[str]:
        saved: list[str] = []
        for index, source in enumerate(find_high_fidelity_sources(html), start=1):
            raw_src = source["src"]
            if "base64," not in raw_src:
                continue
            mime_type, content = decode_data_uri(raw_src)
            extension = guess_extension_from_mime(mime_type)
            filename = f"{sanitize_filename(stem)}_{index}{extension}"
            path = self.save_binary(self.results_dir.relative_to(self.run_dir) / filename, content, kind="results")
            saved.append(str(path))
        return saved

    def save_pdf_from_sources(self, stem: str, image_paths: list[str], text_fallback: str | None = None) -> str | None:
        pdf_path = self.pdfs_dir / f"{sanitize_filename(stem)}.pdf"

        if image_paths:
            images: list[Image.Image] = []
            try:
                for image_path in image_paths:
                    with Image.open(image_path) as image:
                        converted = image.convert("RGB")
                        converted.load()
                        images.append(converted)
                if images:
                    first, *rest = images
                    first.save(pdf_path, "PDF", save_all=True, append_images=rest)
                    self._register("pdfs", pdf_path)
                    return str(pdf_path)
            finally:
                for image in images:
                    image.close()

        if text_fallback:
            pages = self._render_text_pages(text_fallback)
            if pages:
                try:
                    first, *rest = pages
                    first.save(pdf_path, "PDF", save_all=True, append_images=rest)
                    self._register("pdfs", pdf_path)
                    return str(pdf_path)
                finally:
                    for page in pages:
                        page.close()

        return None

    def _render_text_pages(self, text: str) -> list[Image.Image]:
        normalized_lines = [line.rstrip() for line in text.splitlines()] or [text]
        font = ImageFont.load_default()
        page_width, page_height = 1654, 2339
        margin_x, margin_y = 90, 90
        line_height = 24
        max_lines = max(1, (page_height - (margin_y * 2)) // line_height)
        max_chars = 110

        wrapped_lines: list[str] = []
        for line in normalized_lines:
            current = line or ""
            while len(current) > max_chars:
                wrapped_lines.append(current[:max_chars])
                current = current[max_chars:]
            wrapped_lines.append(current)

        if not wrapped_lines:
            wrapped_lines = [""]

        pages: list[Image.Image] = []
        for start in range(0, len(wrapped_lines), max_lines):
            page = Image.new("RGB", (page_width, page_height), "white")
            draw = ImageDraw.Draw(page)
            for index, line in enumerate(wrapped_lines[start : start + max_lines]):
                draw.text((margin_x, margin_y + (index * line_height)), line, fill="black", font=font)
            pages.append(page)
        return pages
