"""Tests for HermesCliProvider (`hermes chat`).

Hermetic: a fake `hermes` executable script is used to verify CLI invocation,
tool call parsing, error handling, and timeout behavior.
"""

from __future__ import annotations

import asyncio
import os
import sys
import textwrap
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from backend.ai.models.hermes_cli_provider import HermesCliProvider
from backend.core.errors import ConfigurationError, ExternalServiceError
from tests.fake_exe import python_cli


def _make_fake_hermes(directory: Path, behavior: str = "ok") -> Path:
    script_path = directory / "hermes"
    code = f"""
    #!{sys.executable}
    import sys

    args = sys.argv[1:]
    if "{behavior}" == "error":
        sys.stderr.write("Hermes agent initialization error\\n")
        sys.exit(1)

    if "{behavior}" == "tool":
        sys.stdout.write('I will check that for you.\\n<tool_call>\\n{{"id": "call_1", "name": "get_balance", "input": {{"account_id": "acc_1"}}}}\\n</tool_call>\\n')
        sys.exit(0)

    sys.stdout.write("Hello from Hermes Agent!\\n")
    sys.exit(0)
    """
    return python_cli(script_path, textwrap.dedent(code).strip())


class TestHermesCliProvider(unittest.TestCase):
    def test_missing_binary_raises_configuration_error(self):
        provider = HermesCliProvider(cli_path="/nonexistent/path/to/hermes")
        with self.assertRaises(ConfigurationError):
            asyncio.run(provider.complete(prompt="Hi"))

    def test_complete_success_with_fake_cli(self):
        with TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            fake_exe = _make_fake_hermes(tmp_path, behavior="ok")
            provider = HermesCliProvider(cli_path=str(fake_exe))

            result = asyncio.run(provider.complete(prompt="Hello"))
            self.assertIn("Hello from Hermes Agent!", result)

    def test_stream_chat_tool_call_parsed(self):
        with TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            fake_exe = _make_fake_hermes(tmp_path, behavior="tool")
            provider = HermesCliProvider(cli_path=str(fake_exe))

            async def run_chat():
                events = []
                async for event in provider.stream_chat(
                    messages=[{"role": "user", "content": "Balance?"}],
                    tools=[{"name": "get_balance", "description": "get balance", "parameters": {}}],
                    system="",
                    model="hermes-3-llama-3.1-8b",
                ):
                    events.append(event)
                return events

            events = asyncio.run(run_chat())
            tool_events = [e for e in events if e.get("type") == "tool_use"]
            self.assertEqual(len(tool_events), 1)
            self.assertEqual(tool_events[0]["name"], "get_balance")
            self.assertEqual(tool_events[0]["input"], {"account_id": "acc_1"})

    def test_cli_error_raises_external_service_error(self):
        with TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            fake_exe = _make_fake_hermes(tmp_path, behavior="error")
            provider = HermesCliProvider(cli_path=str(fake_exe))

            with self.assertRaises(ExternalServiceError):
                asyncio.run(provider.complete(prompt="Hello"))

    def test_stream_complete_yields_deltas_and_usage(self):
        with TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            fake_exe = _make_fake_hermes(tmp_path, behavior="ok")
            provider = HermesCliProvider(cli_path=str(fake_exe))

            async def run_stream():
                events = []
                async for event in provider.stream_complete(prompt="Hello", model="hermes-3-llama-3.1-8b"):
                    events.append(event)
                return events

            events = asyncio.run(run_stream())
            self.assertTrue(any(e.get("type") == "delta" for e in events))
            self.assertTrue(any(e.get("type") == "usage" for e in events))


if __name__ == "__main__":
    unittest.main()
