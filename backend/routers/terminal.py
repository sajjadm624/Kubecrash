from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.engine.session import create_session, get_session, delete_session
from backend.scenarios import LEVEL_META
import json
import time

router = APIRouter()


@router.get("/levels")
def list_levels():
    return LEVEL_META


@router.post("/session")
def new_session(body: dict):
    level = body.get("level", 1)
    if level not in LEVEL_META:
        return {"error": "Invalid level"}
    session_id = create_session(level)
    meta = LEVEL_META[level]
    return {
        "session_id": session_id,
        "level": level,
        "title": meta["title"],
        "tagline": meta["tagline"],
        "time_limit": meta["time_limit"],
    }


@router.websocket("/ws/{session_id}")
async def terminal_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session = get_session(session_id)
    if not session:
        await websocket.send_text(json.dumps({"type": "error", "output": "Session not found."}))
        await websocket.close()
        return

    machine = session["machine"]
    meta = LEVEL_META[session["level"]]

    # Send intro
    intro = _build_intro(meta, machine)
    await websocket.send_text(json.dumps({"type": "intro", "output": intro}))

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            cmd = data.get("command", "").strip()

            if not cmd:
                continue

            result = machine.handle_command(cmd)
            remaining = machine.remaining()

            payload = {
                "type": "output",
                "output": result.get("output", ""),
                "win": result.get("win", False),
                "fail": result.get("fail", False),
                "hint": result.get("hint"),
                "remaining": remaining,
                "commands_run": machine.state.commands_run,
            }
            if result.get("win"):
                payload["win_time"] = result.get("win_time", 0)

            await websocket.send_text(json.dumps(payload))

            if result.get("win") or result.get("fail"):
                break

    except WebSocketDisconnect:
        pass
    finally:
        delete_session(session_id)


def _build_intro(meta: dict, machine) -> str:
    from backend.scenarios.base import c, ANSI
    lines = [
        c("red", f"\n{'='*56}"),
        c("bold", f"  INCIDENT: {meta['title'].upper()}"),
        c("red", f"{'='*56}"),
        f"  {meta['tagline']}",
        "",
        f"  Concepts: {', '.join(meta['concepts'])}",
        f"  Time limit: {meta['time_limit']}s",
        c("red", f"{'='*56}"),
        "",
        c("yellow", "  Type 'help' for useful commands. Good luck."),
        "",
    ]
    return "\n".join(lines)
