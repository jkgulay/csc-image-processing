from fastapi import FastAPI
from routes.files import router as files_router
from routes.batches import router as batches_router
from core.db import engine
from models import database_models
from fastapi.middleware.cors import CORSMiddleware

database_models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="FastAPI + MinIO + PostgreSQL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(files_router, prefix="/files", tags=["files"])
app.include_router(batches_router, prefix="/batches", tags=["batches"])
@app.get("/")
def root():
    return {"message": "Service running with MinIO and PostgreSQL!"}
