from fastapi import APIRouter
router = APIRouter()

_scores: list[dict] = []


@router.post("/score")
def submit_score(body: dict):
    entry = {
        "name": body.get("name", "Anonymous")[:20],
        "level": body.get("level", 1),
        "time": body.get("time", 9999),
        "commands": body.get("commands", 0),
    }
    _scores.append(entry)
    _scores.sort(key=lambda x: (x["level"], x["time"]))
    return {"ok": True, "rank": _scores.index(entry) + 1}


@router.get("/scores")
def get_scores(level: int = None):
    if level:
        return [s for s in _scores if s["level"] == level][:20]
    return _scores[:50]
