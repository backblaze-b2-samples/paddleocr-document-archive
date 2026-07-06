"""PaddleOCR engine adapter — the ONLY place `paddleocr` / `paddlepaddle`
are imported.

Imports are lazy (inside functions) so the module can be imported — and the
service layer unit-tested with the engine mocked — without the heavy ML wheels
installed. Install those from `services/api/requirements-ml.txt`; the first real
run downloads the detection/recognition/classification models to `~/.paddleocr`
(one-time, a few hundred MB).

Device policy (deployment: local): auto-detect CUDA and fall back to CPU.
PaddlePaddle has no usable Apple MPS backend, so the MPS rung of the generic
CUDA -> MPS -> CPU rule is skipped for this sample; selection is CUDA -> CPU and
defaults to CPU. A GPU is never required.
"""

import functools
import io
import logging

from app.types.documents import OcrRegion

logger = logging.getLogger(__name__)


def detect_use_gpu() -> bool:
    """Return True only if PaddlePaddle was built with CUDA AND a GPU is present.

    Never raises: any import/probe failure means "no GPU" and we run on CPU.
    """
    try:
        import paddle

        if not paddle.device.is_compiled_with_cuda():
            return False
        try:
            return paddle.device.cuda.device_count() > 0
        except Exception:
            return False
    except Exception:
        return False


@functools.lru_cache(maxsize=4)
def _get_engine(lang: str, detect_orientation: bool):
    """Cached PaddleOCR engine, keyed by (lang, detect_orientation).

    Uses the PaddleOCR 2.x API (`use_angle_cls`, `use_gpu`, `.ocr(..., cls=)`),
    which this sample pins against — do not upgrade to 3.x, whose renamed
    `.predict()` API drops these kwargs.
    """
    from paddleocr import PaddleOCR

    use_gpu = detect_use_gpu()
    logger.info(
        "Initializing PaddleOCR (lang=%s, angle_cls=%s, gpu=%s)",
        lang,
        detect_orientation,
        use_gpu,
    )
    return PaddleOCR(
        use_angle_cls=detect_orientation,
        lang=lang,
        use_gpu=use_gpu,
        show_log=False,
    )


def run_ocr(
    image_bytes: bytes,
    lang: str = "en",
    detect_orientation: bool = True,
) -> list[OcrRegion]:
    """Detect + recognize text in a page image.

    Returns one OcrRegion per detected text line (4-point box, text, confidence).
    """
    import numpy as np
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    # PaddleOCR expects a BGR ndarray (cv2 convention); reverse the channels.
    arr = np.asarray(image)[:, :, ::-1]

    engine = _get_engine(lang, detect_orientation)
    raw = engine.ocr(arr, cls=detect_orientation)

    regions: list[OcrRegion] = []
    # 2.x returns [ [ [box, (text, conf)], ... ] ] — one list per image.
    page = raw[0] if raw else None
    if not page:
        return regions
    for line in page:
        box, (text, conf) = line[0], line[1]
        regions.append(
            OcrRegion(
                text=text,
                confidence=float(conf),
                box=[[float(pt[0]), float(pt[1])] for pt in box],
            )
        )
    return regions
