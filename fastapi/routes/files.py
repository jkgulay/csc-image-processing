import io
import uuid
import cv2  # type: ignore
import numpy as np  # type: ignore
from fastapi import APIRouter, UploadFile
from fastapi import HTTPException, BackgroundTasks, Depends, Form
from fastapi.responses import StreamingResponse
from minio.error import S3Error
from sqlalchemy.orm import Session, sessionmaker

from core.db import engine
from core.minio_client import minio_client, BUCKET_NAME
from models.database_models import (
    Document, Batch, DocumentBatch
)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter()
@router.post("/upload")
async def upload_file(
    file: UploadFile,
    batch_id: int = Form(...),
    db: Session = Depends(get_db),
):
    # Validate batch exists
    batch = db.query(Batch).get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Upload to MinIO
    file_id = f"{uuid.uuid4()}_{file.filename}"
    content = await file.read()
    try:
        minio_client.put_object(
            BUCKET_NAME,
            file_id,
            data=io.BytesIO(content),
            length=len(content),
            content_type=file.content_type,
        )
    except S3Error as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

    # Create Document and link to Batch
    try:
        doc = Document(
            file_id=file_id,
            file_name=file.filename,
            file_type=file.content_type or "application/octet-stream",
            file_size=len(content),
            checksum=None,
            extra_metadata=None,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        link = DocumentBatch(batch_id=batch_id, document_id=doc.id)
        db.add(link)
        db.commit()
        db.refresh(link)
    except Exception as e:
        # Best-effort cleanup of the uploaded object if DB operations fail
        try:
            minio_client.remove_object(BUCKET_NAME, file_id)
        except Exception:
            pass
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "file_id": file_id,
        "url": f"/files/{file_id}",
        "document": {
            "id": doc.id,
            "file_name": doc.file_name,
            "file_type": doc.file_type,
            "file_size": doc.file_size,
        },
        "document_batch": {"id": link.id, "batch_id": link.batch_id, "document_id": link.document_id},
    }


@router.get("/{file_id}")
def download_file(file_id: str, background_tasks: BackgroundTasks):
    try:
        stat = minio_client.stat_object(BUCKET_NAME, file_id)
        obj = minio_client.get_object(BUCKET_NAME, file_id)
    except S3Error:
        raise HTTPException(status_code=404, detail="File not found")

    def iterfile():
        try:
            for chunk in iter(lambda: obj.read(1024 * 1024), b""):
                yield chunk
        finally:
            # Ensure the connection is closed after streaming
            try:
                obj.close()
            finally:
                try:
                    obj.release_conn()
                except Exception:
                    pass

    filename = file_id.split("_", 1)[-1] if "_" in file_id else file_id
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    media_type = getattr(stat, "content_type", None) or "application/octet-stream"
    return StreamingResponse(iterfile(), media_type=media_type, headers=headers)


@router.get("/{file_id}/preview")
def preview_file(file_id: str, background_tasks: BackgroundTasks):
    try:
        stat = minio_client.stat_object(BUCKET_NAME, file_id)
        obj = minio_client.get_object(BUCKET_NAME, file_id)
    except S3Error:
        raise HTTPException(status_code=404, detail="File not found")

    def iterfile():
        try:
            for chunk in iter(lambda: obj.read(1024 * 1024), b""):
                yield chunk
        finally:
            try:
                obj.close()
            finally:
                try:
                    obj.release_conn()
                except Exception:
                    pass

    filename = file_id.split("_", 1)[-1] if "_" in file_id else file_id
    headers = {
        # Inline preview in browser/viewers instead of download prompt
        "Content-Disposition": f'inline; filename="{filename}"'
    }
    media_type = getattr(stat, "content_type", None) or "application/octet-stream"
    return StreamingResponse(iterfile(), media_type=media_type, headers=headers)

