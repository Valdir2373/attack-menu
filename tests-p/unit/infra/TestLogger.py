import os
import sys
import pytest
from io import StringIO
from unittest.mock import patch

os.environ.setdefault("KEY_CRIP_DATA", "test-key")

from infra.utils.Logger import Logger, LogLevel


class TestLogLevel:

    def test_debug_value(self):
        assert LogLevel.DEBUG.value == "DEBUG"

    def test_info_value(self):
        assert LogLevel.INFO.value == "INFO"

    def test_warn_value(self):
        assert LogLevel.WARN.value == "WARN"

    def test_error_value(self):
        assert LogLevel.ERROR.value == "ERROR"

    def test_has_4_members(self):
        assert len(LogLevel) == 4


class TestLoggerCreation:

    def test_creates_with_default_context(self):
        logger = Logger()
        assert logger.context == "App"

    def test_creates_with_custom_context(self):
        logger = Logger(context="WsServer")
        assert logger.context == "WsServer"

    def test_debug_flag_defaults_to_false(self):
        logger = Logger()
        assert logger._debug is False

    def test_debug_flag_can_be_enabled(self):
        logger = Logger(debug=True)
        assert logger._debug is True


class TestLoggerOutput:

    def test_info_writes_to_stdout(self):
        logger = Logger(context="Test")
        captured = StringIO()
        with patch("sys.stdout", captured):
            logger.info("hello world")
        output = captured.getvalue()
        assert "[INFO]" in output
        assert "[Test]" in output
        assert "hello world" in output

    def test_warn_writes_to_stdout(self):
        logger = Logger(context="Test")
        captured = StringIO()
        with patch("sys.stdout", captured):
            logger.warn("caution")
        output = captured.getvalue()
        assert "[WARN]" in output
        assert "caution" in output

    def test_error_writes_to_stderr(self):
        logger = Logger(context="Test")
        captured = StringIO()
        with patch("sys.stderr", captured):
            logger.error("failure")
        output = captured.getvalue()
        assert "[ERROR]" in output
        assert "failure" in output

    def test_debug_suppressed_when_flag_is_false(self):
        logger = Logger(context="Test", debug=False)
        captured = StringIO()
        with patch("sys.stdout", captured):
            logger.debug("should not appear")
        output = captured.getvalue()
        assert output == ""

    def test_debug_prints_when_flag_is_true(self):
        logger = Logger(context="Test", debug=True)
        captured = StringIO()
        with patch("sys.stdout", captured):
            logger.debug("visible debug")
        output = captured.getvalue()
        assert "[DEBUG]" in output
        assert "visible debug" in output

    def test_output_contains_timestamp_format(self):
        logger = Logger(context="Test")
        captured = StringIO()
        with patch("sys.stdout", captured):
            logger.info("timestamp test")
        output = captured.getvalue()
        import re
        assert re.search(r"\d{2}:\d{2}:\d{2}", output) is not None

    def test_output_contains_ansi_color_codes(self):
        logger = Logger(context="Test")
        captured = StringIO()
        with patch("sys.stdout", captured):
            logger.info("colored")
        output = captured.getvalue()
        assert "\033[" in output


class TestLoggerChild:

    def test_child_creates_sub_logger(self):
        parent = Logger(context="App")
        child = parent.child("WsHandler")
        assert child.context == "App:WsHandler"

    def test_child_inherits_debug_flag(self):
        parent = Logger(context="App", debug=True)
        child = parent.child("Module")
        assert child._debug is True

    def test_child_debug_flag_false_inherited(self):
        parent = Logger(context="App", debug=False)
        child = parent.child("Module")
        assert child._debug is False

    def test_nested_children(self):
        root = Logger(context="Root")
        child1 = root.child("Level1")
        child2 = child1.child("Level2")
        assert child2.context == "Root:Level1:Level2"

    def test_child_is_independent_instance(self):
        parent = Logger(context="App")
        child = parent.child("Service")
        assert parent is not child
        assert parent.context != child.context
