from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers.terminal import router as terminal_router
from backend.routers.leaderboard import router as leaderboard_router
from backend.routers.labs import router as labs_router

app = FastAPI(title="KubeCrash API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(terminal_router, prefix="/api")
app.include_router(leaderboard_router, prefix="/api")
app.include_router(labs_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
