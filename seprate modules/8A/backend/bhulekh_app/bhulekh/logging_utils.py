"""Structured logging helpers with run-id awareness."""

from __future__ import annotations

import logging
from pathlib import Path


class RunLoggerAdapter(logging.LoggerAdapter):
    def process(self, msg: str, kwargs: dict) -> tuple[str, dict]:
        run_id = self.extra.get("run_id", "-")
        step = self.extra.get("step", "-")
        return f"[run_id={run_id}] [step={step}] {msg}", kwargs

    def bind_step(self, step: str) -> "RunLoggerAdapter":
        merged = dict(self.extra)
        merged["step"] = step
        return RunLoggerAdapter(self.logger, merged)


def configure_logger(run_id: str, log_dir: Path, level: int = logging.INFO) -> RunLoggerAdapter:
    log_dir.mkdir(parents=True, exist_ok=True)
    logger_name = f"bhulekh.{run_id}"
    logger = logging.getLogger(logger_name)
    logger.setLevel(level)
    logger.propagate = False

    if not logger.handlers:
        formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

        stream_handler = logging.StreamHandler()
        stream_handler.setLevel(level)
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

        file_handler = logging.FileHandler(log_dir / "workflow.log", encoding="utf-8")
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return RunLoggerAdapter(logger, {"run_id": run_id, "step": "initialized"})
