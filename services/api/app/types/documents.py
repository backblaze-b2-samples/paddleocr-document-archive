from datetime import datetime

from pydantic import BaseModel, Field

# Supported PaddleOCR language codes surfaced in the UI selector.
SUPPORTED_LANGS = ("en", "ch", "fr", "german", "es", "japan", "korean")


class OcrConfig(BaseModel):
    """Per-document OCR configuration used by the NEXT run."""

    lang: str = "en"
    detect_orientation: bool = True
    collection: str = "general"


class OcrRegion(BaseModel):
    """One recognized text line: its 4-point box, text, and confidence."""

    text: str
    confidence: float
    box: list[list[float]] = Field(default_factory=list)


class DocumentRecord(BaseModel):
    """Summary of one archived scan (one page), for list/table views."""

    doc_id: str
    filename: str
    ext: str
    collection: str = "general"
    status: str = "pending"  # "pending" | "processed"
    lang: str = "en"
    detect_orientation: bool = True
    confidence: float | None = None
    region_count: int | None = None
    size_bytes: int = 0
    size_human: str = "0 B"
    uploaded_at: datetime | None = None
    processed_at: datetime | None = None
    scan_url: str | None = None
    overlay_url: str | None = None


class DocumentDetail(DocumentRecord):
    """A single document with its full recognized text and per-region boxes."""

    text: str = ""
    regions: list[OcrRegion] = Field(default_factory=list)


class SearchHit(BaseModel):
    doc_id: str
    collection: str
    confidence: float | None = None
    snippet: str
    updated_at: str | None = None


class ArchiveStats(BaseModel):
    total_documents: int
    processed: int
    pending: int
    pages_processed: int
    avg_confidence: float | None = None
    storage_bytes: int
    storage_human: str


class DailyProcessedCount(BaseModel):
    date: str
    processed: int
