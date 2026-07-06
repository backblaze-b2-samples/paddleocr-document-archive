import logging

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.config import settings
from app.service import documents as docs
from app.service import ocr as ocr_service
from app.types import (
    ArchiveStats,
    DailyProcessedCount,
    DocumentDetail,
    DocumentRecord,
    OcrConfig,
)

logger = logging.getLogger(__name__)

router = APIRouter()


async def _read_upload(request: Request, file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > settings.max_file_size:
            raise HTTPException(status_code=413, detail="Scan too large")
        chunks.append(chunk)
    return b"".join(chunks)


@router.get("/documents", response_model=list[DocumentRecord])
async def list_documents_endpoint():
    return docs.list_documents()


@router.get("/documents/stats", response_model=ArchiveStats)
async def archive_stats_endpoint():
    return docs.archive_stats()


@router.get("/documents/stats/activity", response_model=list[DailyProcessedCount])
async def processing_activity_endpoint(days: int = 7):
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 90")
    return docs.processing_activity(days=days)


@router.post("/documents", response_model=DocumentRecord)
async def ingest_document_endpoint(
    request: Request,
    file: UploadFile = File(...),
    lang: str = Form("en"),
    detect_orientation: bool = Form(True),
    collection: str = Form("general"),
):
    file_data = await _read_upload(request, file)
    config = OcrConfig(
        lang=lang, detect_orientation=detect_orientation, collection=collection
    )
    try:
        record = docs.ingest(
            file_data=file_data,
            filename=file.filename or "",
            content_type=file.content_type or "application/octet-stream",
            config=config,
        )
    except docs.DocumentError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None
    logger.info("Ingested document: doc_id=%s", record.doc_id)
    return record


@router.get("/documents/{doc_id}", response_model=DocumentDetail)
async def get_document_endpoint(doc_id: str):
    try:
        return docs.get_document(doc_id)
    except docs.DocumentNotFound as e:
        raise HTTPException(status_code=404, detail=e.detail) from None


@router.patch("/documents/{doc_id}", response_model=DocumentRecord)
async def edit_document_endpoint(doc_id: str, config: OcrConfig):
    try:
        return docs.edit_document(doc_id, config)
    except docs.DocumentNotFound as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except docs.DocumentError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None


@router.post("/documents/{doc_id}/ocr", response_model=DocumentDetail)
async def run_ocr_endpoint(doc_id: str):
    try:
        return ocr_service.run_document_ocr(doc_id)
    except docs.DocumentNotFound as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except docs.DocumentError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None
    except (ImportError, ModuleNotFoundError) as e:
        logger.error("OCR engine unavailable: %s", e)
        raise HTTPException(
            status_code=503,
            detail=(
                "OCR engine not installed. Install services/api/requirements-ml.txt "
                "(paddleocr + paddlepaddle) and retry."
            ),
        ) from None


@router.delete("/documents/{doc_id}")
async def delete_document_endpoint(doc_id: str):
    try:
        docs.delete_document(doc_id)
    except docs.DocumentNotFound as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    return {"deleted": True, "doc_id": doc_id}
