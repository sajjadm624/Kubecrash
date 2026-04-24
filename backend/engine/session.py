import uuid
import time
from typing import Optional
from backend.engine.state_machine import StateMachine


_sessions: dict[str, dict] = {}


def create_session(level: int) -> str:
    """Create a new game session for a given level. Returns session_id."""
    from backend.scenarios import get_scenario
    session_id = str(uuid.uuid4())
    machine = get_scenario(level)
    _sessions[session_id] = {
        "machine": machine,
        "level": level,
        "created_at": time.time(),
    }
    return session_id


def get_session(session_id: str) -> Optional[dict]:
    return _sessions.get(session_id)


def delete_session(session_id: str):
    _sessions.pop(session_id, None)


def all_sessions() -> dict:
    return _sessions
