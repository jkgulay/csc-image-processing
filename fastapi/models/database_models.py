from sqlalchemy import (Boolean, Column, DateTime, Integer,
                        String, Text, func, ForeignKey, UniqueConstraint)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import JSONB

Base = declarative_base()

# 3) Filtered Images Table (Processed Images)
class FilteredImage(Base):
    __tablename__ = "filtered_images"

    id = Column(Integer, primary_key=True, index=True)

    # Original source image
    original_document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_document = relationship("Document", back_populates="filtered_images")

    # Parameters used for this specific processing (overrides defaults)
    params = Column(JSONB, nullable=True)
    # Output object storage identifiers and metadata
    filtered_file_id = Column(String(255), unique=True, nullable=False, index=True)  # MinIO key for processed image
    filtered_file_name = Column(String(255), nullable=False)
    filtered_file_type = Column(String(255), nullable=False)
    filtered_file_size = Column(Integer, nullable=False)

    # Optional dedup/hash to avoid recompute (e.g., sha256(original_id + filter_id + params))
    params_hash = Column(String(128), nullable=True, index=True)

    # Many-to-many with batches via association table
    batches = relationship(
        "Batch",
        secondary="batch_filtered_images",
        back_populates="filtered_images",
        lazy="selectin",
    )

    status = Column(String(50), nullable=False, server_default="completed")  # e.g., queued, processing, completed, failed
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    __table_args__ = (
        # Optional uniqueness across same original/filter/params_hash if provided
        UniqueConstraint(
            "original_document_id", "params_hash",
            name="uq_filtered_image_source_paramshash"
        ),
    )

# ... existing code ...
# 4) Batches Table (Batch Creation)
class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Many-to-many with original documents
    documents = relationship(
        "Document",
        secondary="document_batches",
        back_populates="batches",
        lazy="selectin",
    )

    # Many-to-many with filtered images
    filtered_images = relationship(
        "FilteredImage",
        secondary="batch_filtered_images",
        back_populates="batches",
        lazy="selectin",
    )

    # One-to-many exports
    exports = relationship(
        "ImageExport",
        back_populates="batches",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

# 1) Documents Table (Images Uploaded)
class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    # Object storage identifiers and metadata
    file_id = Column(String(255), unique=True, nullable=False, index=True)  # MinIO key
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    checksum = Column(String(128), nullable=True, index=True)  # optional integrity tracking (e.g., sha256)
    # NOTE: 'metadata' is reserved by SQLAlchemy Declarative API; use a different attribute name
    extra_metadata = Column(JSONB, nullable=True)  # any extra metadata (dimensions, EXIF, etc.)

    # Many-to-many with batches via association table
    batches = relationship(
        "Batch",
        secondary="document_batches",
        back_populates="documents",
        lazy="selectin",
    )

    # One-to-many to filtered images generated from this document
    filtered_images = relationship(
        "FilteredImage",
        back_populates="original_document",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return f"Document(id={self.id!r}, file_id={self.file_id!r})"



# ... existing code ...
# 5) Batch Documents Table (Batch-Image Mapping)
class DocumentBatch(Base):
    __tablename__ = "document_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("batch_id", "document_id", name="uq_batch_document"),
    )

# ... existing code ...
# 6) Batch Filtered Images Table (Batch-Filtered Image Mapping)
class BatchFilteredImage(Base):
    __tablename__ = "batch_filtered_images"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    filtered_image_id = Column(Integer, ForeignKey("filtered_images.id", ondelete="CASCADE"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("batch_id", "filtered_image_id", name="uq_batch_filtered_image"),
    )

# ... existing code ...
# 7) Image Export Table (Batch Export Tracking)
class ImageExport(Base):
    __tablename__ = "image_exports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    export_type = Column(String(50), nullable=False)  # e.g., originals, filtered, mixed
    status = Column(String(50), nullable=False, server_default="queued")  # queued, processing, completed, failed
    download_url = Column(Text, nullable=True)  # URL to the exported archive/object
    meta = Column(JSONB, nullable=True)  # any additional info (counts, duration, etc.)

    requested_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    batches = relationship("Batch", back_populates="exports")

    def __repr__(self) -> str:
        return f"ImageExport(id={self.id!r}, batch_id={self.batch_id!r}, status={self.status!r})"