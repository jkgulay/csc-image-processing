from pydantic import BaseModel, Field
from typing import Optional

class FilterOptions(BaseModel):
    brightness: Optional[int] = Field(None, ge=0, le=100)   # 0-100 (50 means no change)
    contrast: Optional[int] = Field(None, ge=0, le=100)     # 0-100 (50 means no change)
    saturation: Optional[int] = Field(None, ge=0, le=100)   # 0-100 (50 means no change)
    blur: Optional[int] = Field(None, ge=0, le=50)          # kernel/px size
    sharpen: Optional[bool] = False
    vintage: Optional[bool] = False
    edgeDetection: Optional[bool] = False
    faceDetection: Optional[bool] = False

class ApplyFilterRequest(BaseModel):
    filters: FilterOptions
    output_format: Optional[str] = Field("png", pattern="^(png|jpg|jpeg|webp)$")
