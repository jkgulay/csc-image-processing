import hashlib
import io
import json
import uuid
from typing import Optional
from typing_extensions import TypedDict
import cv2
import numpy as np
from fastapi import APIRouter
from fastapi import HTTPException, Depends
from minio.error import S3Error
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, load_only
from core.db import SessionLocal
from core.minio_client import minio_client, BUCKET_NAME
from models.database_models import (
    Document, FilteredImage,
    Batch, BatchFilteredImage
)
from utils.opencv_utils import (
    _apply_filters_cv2,
    _encode_image,
    _guess_content_type
)
from dto.opencv_dto import ApplyFilterRequest
from fastapi.responses import StreamingResponse
import tempfile
import zipfile


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter()


class BatchCreate(BaseModel):
    name: str
    description: Optional[str] = None


class BatchSummary(TypedDict):
    id: int
    name: str
    description: Optional[str]

def serialize_batch(batch: "Batch") -> BatchSummary:
    """Map a Batch ORM entity to an API-safe summary dict."""
    return {
        "id": batch.id,
        "name": batch.name,
        "description": batch.description,
    }

@router.post("", response_model=dict)
def create_batch(payload: BatchCreate, db: Session = Depends(get_db)):
    batch = Batch(**payload.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return {"id": batch.id, "name": batch.name}

@router.get("", response_model=list[BatchSummary])
def list_batches(db: Session = Depends(get_db)):
    batch_entities = (
        db.query(Batch)
        .options(load_only(Batch.id, Batch.name, Batch.description))
        .all()
    )

    return [serialize_batch(b) for b in batch_entities]
@router.get("/{batch_id}", response_model=dict)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"id": batch.id, "name": batch.name, "description": batch.description}

@router.get("/{batch_id}/filtered-images/zip")
def download_filtered_images_zip(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    filtered_images = list(batch.filtered_images or [])
    if not filtered_images:
        raise HTTPException(status_code=404, detail="No filtered images in this batch")

    # Build a ZIP archive using a spooled temp file (keeps memory usage low, spills to disk after threshold)
    spooled = tempfile.SpooledTemporaryFile(max_size=50 * 1024 * 1024)  # 50MB in-memory threshold
    added = 0
    with zipfile.ZipFile(spooled, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for fi in filtered_images:
            # Ensure unique names inside the archive even if duplicates exist
            arcname = f"{fi.id}_{fi.filtered_file_name}" if getattr(fi, "filtered_file_name", None) else f"{fi.id}"
            try:
                obj = minio_client.get_object(BUCKET_NAME, fi.filtered_file_id)
                try:
                    data = obj.read()
                finally:
                    try:
                        obj.close()
                    finally:
                        try:
                            obj.release_conn()
                        except Exception:
                            pass
                # Write the file bytes into the zip archive
                zf.writestr(arcname, data)
                added += 1
            except S3Error:
                # Skip missing objects; continue packing what is available
                continue

    if added == 0:
        spooled.close()
        raise HTTPException(status_code=404, detail="No filtered images available for download")

    spooled.seek(0)

    def iter_zip():
        try:
            while True:
                chunk = spooled.read(1024 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                spooled.close()
            except Exception:
                pass

    filename = f"batch_{batch_id}_filtered_images.zip"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(iter_zip(), media_type="application/zip", headers=headers)


@router.delete("/{batch_id}", status_code=204)
def delete_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.delete(batch)
    db.commit()
    return None

@router.post("/{batch_id}/documents/{document_id}/apply-filters", response_model=dict)
def apply_filters_to_image(
    batch_id: int,
    document_id: int,
    payload: ApplyFilterRequest,
    db: Session = Depends(get_db),
):
    # Validate batch and document
    batch = db.query(Batch).get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    doc = db.query(Document).get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Compute params hash for dedupe and check if already exists
    params_json = json.dumps(payload.filters.model_dump(exclude_none=True), sort_keys=True)
    params_hash = hashlib.sha256(f"{document_id}:{params_json}".encode("utf-8")).hexdigest()

    existing_fi = (
        db.query(FilteredImage)
        .filter(
            FilteredImage.original_document_id == doc.id,
            FilteredImage.params_hash == params_hash,
        )
        .first()
    )
    if existing_fi:
        # If the filtered image already exists, ensure it's linked to this batch; if not, link it
        existing_link = (
            db.query(BatchFilteredImage)
            .filter(
                BatchFilteredImage.batch_id == batch_id,
                BatchFilteredImage.filtered_image_id == existing_fi.id,
            )
            .first()
        )
        if not existing_link:
            try:
                link = BatchFilteredImage(batch_id=batch_id, filtered_image_id=existing_fi.id)
                db.add(link)
                db.commit()
                db.refresh(link)
                return {
                    "status": "skipped_linked_existing",
                    "filtered_image": {
                        "id": existing_fi.id,
                        "filtered_file_id": existing_fi.filtered_file_id,
                        "filtered_file_name": existing_fi.filtered_file_name,
                        "filtered_file_type": existing_fi.filtered_file_type,
                        "filtered_file_size": existing_fi.filtered_file_size,
                    },
                    "batch_filtered_image": {
                        "id": link.id,
                        "batch_id": link.batch_id,
                        "filtered_image_id": link.filtered_image_id,
                    },
                    "url": f"/files/{existing_fi.filtered_file_id}/preview",
                }
            except Exception as e:
                db.rollback()
                # Even if linking fails, return a clear response without recomputing
                return {
                    "status": "skipped_existing_link_failed",
                    "error": f"db_link_error: {str(e)}",
                    "filtered_image": {
                        "id": existing_fi.id,
                        "filtered_file_id": existing_fi.filtered_file_id,
                        "filtered_file_name": existing_fi.filtered_file_name,
                        "filtered_file_type": existing_fi.filtered_file_type,
                        "filtered_file_size": existing_fi.filtered_file_size,
                    },
                    "url": f"/files/{existing_fi.filtered_file_id}/preview",
                }
        # Already exists and linked
        return {
            "status": "skipped_already_applied",
            "filtered_image": {
                "id": existing_fi.id,
                "filtered_file_id": existing_fi.filtered_file_id,
                "filtered_file_name": existing_fi.filtered_file_name,
                "filtered_file_type": existing_fi.filtered_file_type,
                "filtered_file_size": existing_fi.filtered_file_size,
            },
            "url": f"/files/{existing_fi.filtered_file_id}/preview",
        }

    # Fetch original image from object storage
    try:
        obj = minio_client.get_object(BUCKET_NAME, doc.file_id)
        original_bytes = obj.read()
        obj.close()
        obj.release_conn()
    except S3Error:
        raise HTTPException(status_code=404, detail="Original file not found in storage")

    # Decode image with OpenCV
    np_arr = np.frombuffer(original_bytes, np.uint8)
    img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Unsupported or corrupted image")

    # Apply filters
    processed_bgr = _apply_filters_cv2(img_bgr, payload.filters)

    # Encode processed output
    out_bytes = _encode_image(processed_bgr, payload.output_format or "png")
    out_ct = _guess_content_type(payload.output_format or "png")

    # Create storage key
    filtered_file_name = f"filtered_{doc.file_name.rsplit('.', 1)[0]}.{(payload.output_format or 'png').lower()}"
    filtered_file_id = f"{uuid.uuid4()}_{filtered_file_name}"

    # Upload processed image to storage
    try:
        minio_client.put_object(
            BUCKET_NAME,
            filtered_file_id,
            data=io.BytesIO(out_bytes),
            length=len(out_bytes),
            content_type=out_ct,
        )
    except S3Error as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

    # Persist FilteredImage and mapping
    try:
        fi = FilteredImage(
            original_document_id=doc.id,
            params=payload.filters.model_dump(exclude_none=True),
            filtered_file_id=filtered_file_id,
            filtered_file_name=filtered_file_name,
            filtered_file_type=out_ct,
            filtered_file_size=len(out_bytes),
            params_hash=params_hash,
            status="completed",
            error_message="",
        )
        db.add(fi)
        db.commit()
        db.refresh(fi)

        link = BatchFilteredImage(batch_id=batch_id, filtered_image_id=fi.id)
        db.add(link)
        db.commit()
        db.refresh(link)
    except Exception as e:
        # Cleanup stored object if DB fails
        try:
            minio_client.remove_object(BUCKET_NAME, filtered_file_id)
        except Exception:
            pass
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "status": "ok",
        "filtered_image": {
            "id": fi.id,
            "filtered_file_id": fi.filtered_file_id,
            "filtered_file_name": fi.filtered_file_name,
            "filtered_file_type": fi.filtered_file_type,
            "filtered_file_size": fi.filtered_file_size,
            "status": fi.status,
        },
        "batch_filtered_image": {"id": link.id, "batch_id": link.batch_id, "filtered_image_id": link.filtered_image_id},
        "url": f"/files/{fi.filtered_file_id}/preview",
    }

# Apply the same filter settings to ALL original images in a batch and persist results
@router.post("/{batch_id}/apply-filters", response_model=dict)
def apply_filters_to_all_in_batch(
    batch_id: int,
    payload: ApplyFilterRequest,
    db: Session = Depends(get_db),
):
    # Validate batch
    batch = db.query(Batch).get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    documents = list(batch.documents or [])
    if not documents:
        raise HTTPException(status_code=404, detail="No documents in this batch")

    results: list[dict] = []
    processed = 0
    failed = 0

    # Precompute content-type/format
    fmt = (payload.output_format or "png").lower()
    out_ct = _guess_content_type(fmt)

    # Stable params hash base
    import hashlib, json
    params_json = json.dumps(payload.filters.model_dump(exclude_none=True), sort_keys=True)

    for doc in documents:
        try:
            # Skip if already applied for this doc with the same params (dedupe)
            params_hash = hashlib.sha256(f"{doc.id}:{params_json}".encode("utf-8")).hexdigest()
            existing_fi = (
                db.query(FilteredImage)
                .filter(
                    FilteredImage.original_document_id == doc.id,
                    FilteredImage.params_hash == params_hash,
                )
                .first()
            )
            if existing_fi:
                # Check if this filtered image is already linked to this batch
                existing_link = (
                    db.query(BatchFilteredImage)
                    .filter(
                        BatchFilteredImage.batch_id == batch_id,
                        BatchFilteredImage.filtered_image_id == existing_fi.id,
                    )
                    .first()
                )
                if not existing_link:
                    # Link the already-existing filtered image to this batch without recomputing/uploading
                    try:
                        link = BatchFilteredImage(batch_id=batch_id, filtered_image_id=existing_fi.id)
                        db.add(link)
                        db.commit()
                        db.refresh(link)
                        results.append({
                            "document_id": doc.id,
                            "status": "skipped_linked_existing",
                            "filtered_image": {
                                "id": existing_fi.id,
                                "filtered_file_id": existing_fi.filtered_file_id,
                                "filtered_file_name": existing_fi.filtered_file_name,
                                "filtered_file_type": existing_fi.filtered_file_type,
                                "filtered_file_size": existing_fi.filtered_file_size,
                            },
                            "batch_filtered_image": {
                                "id": link.id,
                                "batch_id": link.batch_id,
                                "filtered_image_id": link.filtered_image_id,
                            },
                            "url": f"/files/{existing_fi.filtered_file_id}/preview",
                        })
                    except Exception as e:
                        db.rollback()
                        # Even if linking failed, treat as skipped (no recompute) and report the issue
                        results.append({
                            "document_id": doc.id,
                            "status": "skipped_existing_link_failed",
                            "error": f"db_link_error: {str(e)}",
                            "filtered_image": {
                                "id": existing_fi.id,
                                "filtered_file_id": existing_fi.filtered_file_id,
                                "filtered_file_name": existing_fi.filtered_file_name,
                                "filtered_file_type": existing_fi.filtered_file_type,
                                "filtered_file_size": existing_fi.filtered_file_size,
                            },
                            "url": f"/files/{existing_fi.filtered_file_id}/preview",
                        })
                else:
                    results.append({
                        "document_id": doc.id,
                        "status": "skipped_already_applied",
                        "filtered_image": {
                            "id": existing_fi.id,
                            "filtered_file_id": existing_fi.filtered_file_id,
                            "filtered_file_name": existing_fi.filtered_file_name,
                            "filtered_file_type": existing_fi.filtered_file_type,
                            "filtered_file_size": existing_fi.filtered_file_size,
                        },
                        "url": f"/files/{existing_fi.filtered_file_id}/preview",
                    })
                continue

            # Fetch original
            try:
                obj = minio_client.get_object(BUCKET_NAME, doc.file_id)
                original_bytes = obj.read()
            except S3Error as e:
                failed += 1
                results.append({
                    "document_id": doc.id,
                    "status": "failed",
                    "error": f"storage_read: {str(e)}",
                })
                continue
            finally:
                try:
                    obj.close()
                except Exception:
                    pass
                try:
                    obj.release_conn()
                except Exception:
                    pass

            # Decode
            np_arr = np.frombuffer(original_bytes, np.uint8)
            img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if img_bgr is None:
                failed += 1
                results.append({
                    "document_id": doc.id,
                    "status": "failed",
                    "error": "decode_error",
                })
                continue

            # Process
            processed_bgr = _apply_filters_cv2(img_bgr, payload.filters)

            # Encode
            out_bytes = _encode_image(processed_bgr, fmt)

            # Names/keys
            base_name = doc.file_name.rsplit(".", 1)[0] if "." in doc.file_name else doc.file_name
            filtered_file_name = f"filtered_{base_name}.{fmt}"
            filtered_file_id = f"{uuid.uuid4()}_{filtered_file_name}"

            # Upload
            try:
                minio_client.put_object(
                    BUCKET_NAME,
                    filtered_file_id,
                    data=io.BytesIO(out_bytes),
                    length=len(out_bytes),
                    content_type=out_ct,
                )
            except S3Error as e:
                failed += 1
                results.append({
                    "document_id": doc.id,
                    "status": "failed",
                    "error": f"storage_write: {str(e)}",
                })
                continue

            # Persist FilteredImage + link (using the same params_hash computed above)
            try:
                fi = FilteredImage(
                    original_document_id=doc.id,
                    params=payload.filters.model_dump(exclude_none=True),
                    filtered_file_id=filtered_file_id,
                    filtered_file_name=filtered_file_name,
                    filtered_file_type=out_ct,
                    filtered_file_size=len(out_bytes),
                    params_hash=params_hash,
                    status="completed",
                    error_message="",
                )
                db.add(fi)
                db.commit()
                db.refresh(fi)

                link = BatchFilteredImage(batch_id=batch_id, filtered_image_id=fi.id)
                db.add(link)
                db.commit()
                db.refresh(link)
            except Exception as e:
                # Cleanup stored object if DB fails for this item
                try:
                    minio_client.remove_object(BUCKET_NAME, filtered_file_id)
                except Exception:
                    pass
                db.rollback()
                failed += 1
                results.append({
                    "document_id": doc.id,
                    "status": "failed",
                    "error": f"db_error: {str(e)}",
                })
                continue

            processed += 1
            results.append({
                "document_id": doc.id,
                "filtered_image": {
                    "id": fi.id,
                    "filtered_file_id": fi.filtered_file_id,
                    "filtered_file_name": fi.filtered_file_name,
                    "filtered_file_type": fi.filtered_file_type,
                    "filtered_file_size": fi.filtered_file_size,
                },
                "batch_filtered_image": {
                    "id": link.id,
                    "batch_id": link.batch_id,
                    "filtered_image_id": link.filtered_image_id,
                },
                "url": f"/files/{fi.filtered_file_id}/preview",
                "status": "ok",
            })

        except Exception as e:
            # Unknown per-item failure safeguard
            failed += 1
            results.append({
                "document_id": doc.id,
                "status": "failed",
                "error": f"unexpected: {str(e)}",
            })

    return {
        "batch_id": batch_id,
        "processed": processed,
        "failed": failed,
        "items": results,
    }

