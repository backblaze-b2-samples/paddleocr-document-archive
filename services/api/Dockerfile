FROM --platform=linux/arm64 python:3.11-slim
WORKDIR /app
# Native libs paddle/paddleocr/python-magic need on slim Debian:
#  libgomp1 (paddle OpenMP), libgl1+libglib2.0-0 (paddleocr pulls non-headless
#  opencv → needs libGL), libmagic1 (python-magic MIME sniffing).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgomp1 libgl1 libglib2.0-0 libmagic1 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt requirements-ml.txt ./
# cython<3.1 is REQUIRED: paddleocr's deps otherwise pull cython 3.2.x which
# makes `import paddle` segfault. Validated in the spike.
RUN pip install --no-cache-dir -r requirements.txt -r requirements-ml.txt
# Pre-bake the OCR models into the image so the first request doesn't pay the
# ~120s download. Must match the engine params used at runtime (en, angle_cls).
# `import pyclipper` FIRST: paddlepaddle loads its own bundled zlib globally, so
# pyclipper's C-extension decompression crashes ("zlib.error: Error -2 ...
# inconsistent stream state") if first imported after paddle. Importing it up
# front caches it so paddleocr's later `import pyclipper` is a no-op. Mirrors the
# same-reason preload in app/repo/ocr_engine.py. Validated 2026-07-06.
RUN python -c "import pyclipper; from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='en')"
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
