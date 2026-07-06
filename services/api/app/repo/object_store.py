"""Generic byte-level B2 object I/O for the document archive.

Extends the S3 adapter in `b2_client.py` (it reuses the same cached client)
with the raw put/get/list/delete/presign operations the OCR pipeline needs.
All S3/boto3 access stays inside `repo/` per the layering invariant.
"""

import io

from botocore.exceptions import ClientError

from app.config import settings
from app.repo.b2_client import get_s3_client

_NOT_FOUND = ("404", "NoSuchKey", "NotFound")


def put_bytes(key: str, data: bytes, content_type: str) -> None:
    """Write raw bytes to B2. Raises RuntimeError on failure."""
    client = get_s3_client()
    try:
        client.put_object(
            Bucket=settings.b2_bucket_name,
            Key=key,
            Body=io.BytesIO(data),
            ContentType=content_type,
        )
    except ClientError as e:
        raise RuntimeError(f"B2 put failed for '{key}': {e}") from e


def get_bytes(key: str) -> bytes | None:
    """Read an object's bytes, or None if it does not exist."""
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=settings.b2_bucket_name, Key=key)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in _NOT_FOUND:
            return None
        raise RuntimeError(f"B2 get failed for '{key}': {e}") from e
    return response["Body"].read()


def object_exists(key: str) -> bool:
    """Return True if the object exists in the bucket."""
    client = get_s3_client()
    try:
        client.head_object(Bucket=settings.b2_bucket_name, Key=key)
        return True
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in _NOT_FOUND:
            return False
        raise


def list_prefix(prefix: str) -> list[dict]:
    """Paginate a prefix, returning [{key, size, last_modified}, ...]."""
    client = get_s3_client()
    out: list[dict] = []
    kwargs: dict = {
        "Bucket": settings.b2_bucket_name,
        "Prefix": prefix,
        "MaxKeys": 1000,
    }
    try:
        while True:
            response = client.list_objects_v2(**kwargs)
            for obj in response.get("Contents", []):
                out.append(
                    {
                        "key": obj["Key"],
                        "size": obj["Size"],
                        "last_modified": obj["LastModified"],
                    }
                )
            if not response.get("IsTruncated"):
                break
            kwargs["ContinuationToken"] = response["NextContinuationToken"]
    except ClientError as e:
        raise RuntimeError(f"B2 list failed for prefix '{prefix}': {e}") from e
    return out


def delete_keys(keys: list[str]) -> int:
    """Batch-delete keys (1000 per request). Returns the count deleted."""
    if not keys:
        return 0
    client = get_s3_client()
    deleted = 0
    try:
        for i in range(0, len(keys), 1000):
            batch = keys[i : i + 1000]
            client.delete_objects(
                Bucket=settings.b2_bucket_name,
                Delete={"Objects": [{"Key": k} for k in batch]},
            )
            deleted += len(batch)
    except ClientError as e:
        raise RuntimeError(f"B2 batch delete failed: {e}") from e
    return deleted


def delete_prefix(prefix: str) -> int:
    """Delete every object under a prefix. Returns the count removed.

    Scoped strictly to the given prefix — callers pass a per-document prefix so
    a delete can never reach another document's objects. Refuses an empty
    prefix as a guard against a full-bucket wipe.
    """
    if not prefix:
        raise ValueError("Refusing to delete an empty prefix")
    keys = [item["key"] for item in list_prefix(prefix)]
    return delete_keys(keys)


def get_inline_url(key: str, expires_in: int = 600) -> str:
    """Presigned URL for inline preview (rendered in-page, not a download)."""
    client = get_s3_client()
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.b2_bucket_name,
                "Key": key,
                "ResponseContentDisposition": "inline",
            },
            ExpiresIn=expires_in,
        )
    except ClientError as e:
        raise RuntimeError(f"B2 presign failed for '{key}': {e}") from e
