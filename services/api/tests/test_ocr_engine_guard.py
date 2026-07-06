"""No-network signature guard for the PaddleOCR adapter.

Importing the adapter must NOT import the heavy engine (imports are lazy), and
device detection must return a plain bool without touching the network — so unit
tests stay fast and green without paddleocr/paddlepaddle installed.
"""

import inspect
import sys

import app.repo.ocr_engine as engine


def test_engine_import_is_lazy():
    # The adapter is already imported (above). paddleocr must not be pulled in
    # just by importing the module.
    assert "paddleocr" not in sys.modules


def test_detect_use_gpu_returns_bool():
    result = engine.detect_use_gpu()
    assert isinstance(result, bool)


def test_run_ocr_signature_is_stable():
    params = list(inspect.signature(engine.run_ocr).parameters)
    assert params == ["image_bytes", "lang", "detect_orientation"]
