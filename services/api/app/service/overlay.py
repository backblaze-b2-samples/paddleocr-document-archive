"""Render an OCR overlay: detected bounding boxes drawn over the scan.

Pure Pillow (no ML deps) so it can run and be tested without the heavy engine.
The resulting PNG is stored on B2 as `ocr-results/<doc-id>/overlay.png` and shown
in the detail view for visual QA of detection quality.
"""

import io

from PIL import Image, ImageDraw

from app.types import OcrRegion

# Backblaze red — high-contrast on typical document scans.
_BOX_COLOR = (228, 44, 57)


def draw_overlay(image_bytes: bytes, regions: list[OcrRegion]) -> bytes:
    """Draw each region's polygon over the scan and return PNG bytes."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    draw = ImageDraw.Draw(image)
    for region in regions:
        points = [(float(p[0]), float(p[1])) for p in region.box if len(p) >= 2]
        if len(points) >= 2:
            draw.line([*points, points[0]], fill=_BOX_COLOR, width=2)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
