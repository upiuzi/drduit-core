"""The Antigravity CLI's model catalog — read from `agy models`, falling back to known models."""

from __future__ import annotations

import logging
import re
import shutil
import subprocess
import threading
import time

from backend.core.child_env import scrubbed_environ

logger = logging.getLogger(__name__)

# Fallback models matching Antigravity CLI catalog
FALLBACK_MODELS: tuple[str, ...] = (
    "gemini-3.8-flash-high",
    "gemini-3.8-flash-medium",
    "gemini-3.8-flash-low",
    "claude-opus-4-6-thinking",
    "claude-sonnet-4-6",
    "gpt-oss-120b-medium",
)

_REFRESH_TIMEOUT_S = 10.0
_CACHE_TTL_S = 3600.0  # 1 hour
_refresh_lock = threading.Lock()
_fetched_models: list[str] = []
_last_refresh: float = 0.0


def _parse_models_output(text: str) -> list[str]:
    """Parse output from `agy models`.

    Format is tab- or space-separated:
      gemini-3.8-flash-high\tGemini 3.8 Flash (High)
      claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)
    """
    models: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("⠋") or "fetching" in line.lower():
            continue
        parts = re.split(r"\s+", line, maxsplit=1)
        if not parts:
            continue
        model_id = parts[0].strip()
        if re.match(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]+$", model_id):
            if model_id.lower() not in ("id", "model", "model_id", "nama"):
                if model_id not in models:
                    models.append(model_id)
    return models


def refresh(binary: str = "agy", *, force: bool = False) -> bool:
    """Ask `agy models` for its model list now. True when it answered with valid models."""
    global _fetched_models, _last_refresh

    now = time.monotonic()
    if not force and _fetched_models and (now - _last_refresh < _CACHE_TTL_S):
        return True

    resolved = shutil.which(binary) if binary else shutil.which("agy")
    if not resolved:
        return False

    with _refresh_lock:
        if not force and _fetched_models and (now - _last_refresh < _CACHE_TTL_S):
            return True

        try:
            proc = subprocess.run(  # noqa: S603
                [resolved, "models"],
                capture_output=True,
                text=True,
                timeout=_REFRESH_TIMEOUT_S,
                env=scrubbed_environ(),
            )
            if proc.returncode != 0:
                logger.debug("agy models returned code %d: %s", proc.returncode, proc.stderr)
                return False
            parsed = _parse_models_output(proc.stdout)
            if parsed:
                _fetched_models = parsed
                _last_refresh = now
                logger.info("refreshed antigravity models: %s", parsed)
                return True
        except Exception as exc:
            logger.debug("could not refresh antigravity models: %s", exc)

    return False


def catalog_readable() -> bool:
    """True when the list comes from the CLI itself, False when it is the static floor."""
    return bool(_fetched_models)


def missing_catalog_message() -> str:
    """Note when only the fallback floor is on offer."""
    return (
        "Antigravity CLI could not fetch its live model list, so the default models are shown. "
        "Check that `agy` is installed and logged in."
    )


def model_ids() -> list[str]:
    """The pickable model ids — dynamic list if available, else fallback."""
    if not _fetched_models:
        refresh("agy", force=False)
    return list(_fetched_models) if _fetched_models else list(FALLBACK_MODELS)
