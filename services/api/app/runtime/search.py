import logging

from fastapi import APIRouter

from app.service import search as search_service
from app.types import SearchHit

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/search", response_model=list[SearchHit])
async def search_endpoint(q: str = "", limit: int = 50):
    limit = max(1, min(limit, 200))
    return search_service.search(q, limit=limit)


@router.post("/search/reindex")
async def reindex_endpoint():
    """Rebuild the local search index from the OCR artifacts stored in B2."""
    count = search_service.reindex()
    return {"reindexed": count}
