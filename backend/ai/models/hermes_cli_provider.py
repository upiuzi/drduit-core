"""Hermes Agent headless-CLI provider.

Runs the locally-installed ``hermes`` CLI (Nous Research Hermes Agent) as an AI
provider, allowing a self-hoster with a Hermes setup or local model to use that
for Dr Duit / Lucius instead of separate cloud API subscriptions.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import time
from typing import AsyncGenerator, List, Optional

from backend.core.child_env import scrubbed_environ
from backend.core.errors import ConfigurationError, ExternalServiceError, ProviderTimeoutError
from backend.core.process_tree import kill_and_reap, spawn_kwargs

from .base import AIProvider, log_text_cap
from .cli_tool_protocol import (
    ToolCallScanner,
    flatten_messages_with_images,
    render_tool_manifest,
)
from .pricing import cost_usd_openai

log = logging.getLogger(__name__)

DEFAULT_CLI_PATH = "hermes"
_DEFAULT_MAX_CONCURRENCY = 2
_DEFAULT_TIMEOUT_SECONDS = 600.0


def cost_basis_for(api_key: str) -> str:
    """Attributes cost basis: 'api_billed' when an API key is present, else 'plan_included'."""
    return "api_billed" if (api_key or "").strip() else "plan_included"


class HermesCliProvider(AIProvider):
    """AIProvider implementation backed by the local `hermes` CLI binary."""

    def __init__(self, cli_path: str = "", api_key: str = "") -> None:
        self.cli_path = (cli_path or "").strip()
        self.api_key = (api_key or "").strip()
        self._semaphore = asyncio.Semaphore(_DEFAULT_MAX_CONCURRENCY)

    def _resolve_binary(self) -> str:
        from backend.db.model_config_store import cli_binary_path

        resolved = cli_binary_path("hermes_cli", self.cli_path)
        if resolved:
            return resolved
        lookup = shutil.which(self.cli_path or DEFAULT_CLI_PATH)
        if lookup:
            return lookup
        raise ConfigurationError(
            f"Hermes CLI ({self.cli_path or DEFAULT_CLI_PATH}) not found on PATH. "
            "Install it from https://hermes-agent.nousresearch.com or configure its path in Settings → AI Models."
        )

    def supports_images(self, model: str) -> bool:
        return False

    def _build_argv(self, model: str, prompt_text: str) -> list[str]:
        binary = self._resolve_binary()
        argv = [binary, "chat", "-q", prompt_text, "--oneshot"]
        clean_model = (model or "").strip()
        if clean_model:
            argv.extend(["--model", clean_model])
        return argv

    async def _execute_subprocess(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
    ) -> str:
        full_prompt = f"# System instructions\n\n{system.strip()}\n\n---\n\n{prompt}" if system.strip() else prompt
        argv = self._build_argv(model, full_prompt)
        env = scrubbed_environ()
        t0 = time.monotonic()

        async with self._semaphore:
            proc = None
            try:
                proc = await asyncio.create_subprocess_exec(
                    *argv,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env,
                    **spawn_kwargs(),
                )
                stdout_data, stderr_data = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=_DEFAULT_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                if proc is not None:
                    kill_and_reap(proc.pid)
                raise ProviderTimeoutError(
                    f"Hermes CLI timed out after {_DEFAULT_TIMEOUT_SECONDS:.0f}s"
                ) from None
            except Exception as exc:
                if proc is not None:
                    kill_and_reap(proc.pid)
                raise ExternalServiceError(f"Failed to execute Hermes CLI: {exc}") from exc

            if proc.returncode != 0:
                err_msg = (stderr_data or b"").decode("utf-8", errors="replace").strip()
                out_msg = (stdout_data or b"").decode("utf-8", errors="replace").strip()
                detail = err_msg or out_msg or f"process exited with code {proc.returncode}"
                raise ExternalServiceError(f"Hermes CLI returned error: {detail}")

            duration_s = time.monotonic() - t0
            output_text = (stdout_data or b"").decode("utf-8", errors="replace").strip()
            log.info("hermes_cli call completed in %.2fs (%d chars)", duration_s, len(output_text))
            return output_text

    async def stream_chat(
        self,
        messages: List[dict],
        tools: List[dict],
        system: str,
        model: str,
        effort: str = "medium",
    ) -> AsyncGenerator[dict, None]:
        t0 = time.monotonic()
        transcript, _ = flatten_messages_with_images(messages)
        manifest = render_tool_manifest(tools or [])
        combined_system = f"{system}\n\n{manifest}".strip() if manifest else system

        output = await self._execute_subprocess(transcript, system=combined_system, model=model)
        duration_ms = (time.monotonic() - t0) * 1000.0

        scanner = ToolCallScanner()
        emitted = list(scanner.feed(output))
        emitted.extend(list(scanner.flush()))

        for chunk in emitted:
            if chunk:
                yield {"type": "text_delta", "text": chunk}

        for i, call in enumerate(scanner.calls):
            yield {
                "type": "tool_use",
                "id": call.get("id") or f"hermes_{int(t0 * 1000)}_{i}",
                "name": call["name"],
                "input": call["input"],
            }

        input_tokens = max(1, len(transcript) // 4)
        output_tokens = max(1, len(output) // 4)
        cost_usd = cost_usd_openai(model, input_tokens, output_tokens)

        yield {
            "type": "usage",
            "cost_basis": cost_basis_for(self.api_key),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost_usd,
            "model": model or "hermes-3-llama-3.1-8b",
            "duration_ms": duration_ms,
        }
        yield {"type": "done", "stop_reason": "tool_use" if scanner.calls else "end_turn"}

    async def complete(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1000,
        tools: Optional[List[dict]] = None,
        source: str = "chat",
        effort: str = "",
        images: Optional[List[dict]] = None,
        response_format: Optional[dict] = None,
    ) -> str:
        manifest = render_tool_manifest(tools) if tools else ""
        combined_system = f"{system}\n\n{manifest}".strip() if manifest else system
        output = await self._execute_subprocess(prompt, system=combined_system, model=model)

        scanner = ToolCallScanner()
        emitted = list(scanner.feed(output))
        emitted.extend(list(scanner.flush()))
        return "".join(emitted) if emitted else output

    async def stream_complete(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1000,
        tools: Optional[List[dict]] = None,
        source: str = "chat",
        effort: str = "",
        images: Optional[List[dict]] = None,
    ) -> AsyncGenerator[dict, None]:
        manifest = render_tool_manifest(tools) if tools else ""
        combined_system = f"{system}\n\n{manifest}".strip() if manifest else system
        t0 = time.monotonic()

        output = await self._execute_subprocess(prompt, system=combined_system, model=model)
        duration_ms = (time.monotonic() - t0) * 1000.0

        scanner = ToolCallScanner()
        chunks = list(scanner.feed(output))
        chunks.extend(list(scanner.flush()))

        for chunk in chunks:
            if chunk:
                yield {"type": "delta", "text": chunk}

        input_tokens = max(1, len(prompt) // 4)
        output_tokens = max(1, len(output) // 4)
        cost_usd = cost_usd_openai(model, input_tokens, output_tokens)

        yield {
            "type": "usage",
            "cost_basis": cost_basis_for(self.api_key),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost_usd,
            "model": model or "hermes-3-llama-3.1-8b",
            "duration_ms": duration_ms,
        }
        yield {"type": "done"}
