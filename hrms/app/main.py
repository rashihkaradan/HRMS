from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.bootstrap import ensure_default_admin
from app.routers import auth, employees, recruitment, assistant
from app.routers import interviews


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_default_admin()
    yield


app = FastAPI(title="HRMS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # add your deployed frontend URL here too
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(employees.dept_router)
app.include_router(recruitment.router)
app.include_router(assistant.router)
app.include_router(interviews.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
