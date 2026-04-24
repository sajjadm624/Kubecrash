from backend.scenarios.level1 import Level1
from backend.scenarios.level2 import Level2
from backend.scenarios.level3 import Level3
from backend.scenarios.level4 import Level4
from backend.scenarios.level5 import Level5


SCENARIOS = {
    1: Level1,
    2: Level2,
    3: Level3,
    4: Level4,
    5: Level5,
}

LEVEL_META = {
    1: {
        "title": "The Crash at Dawn",
        "tagline": "3 pods down. Missing env var. SLA breach in 8 minutes.",
        "difficulty": "Beginner",
        "concepts": ["kubectl logs", "kubectl describe", "env vars", "CrashLoopBackOff"],
        "time_limit": 480,
        "free": True,
    },
    2: {
        "title": "The Invisible Service",
        "tagline": "Traffic not reaching pods. The selector is lying.",
        "difficulty": "Beginner",
        "concepts": ["kubectl get svc", "kubectl get endpoints", "label selectors", "kubectl patch"],
        "time_limit": 480,
        "free": True,
    },
    3: {
        "title": "The OOM Reaper",
        "tagline": "Pods keep dying. Memory has no limits. Chaos reigns.",
        "difficulty": "Intermediate",
        "concepts": ["kubectl top", "OOMKilled", "resource limits", "kubectl set resources"],
        "time_limit": 540,
        "free": True,
    },
    4: {
        "title": "The Ghost Image",
        "tagline": "Friday 5pm deploy. Wrong image tag. Rollback. Now.",
        "difficulty": "Intermediate",
        "concepts": ["ImagePullBackOff", "kubectl rollout history", "kubectl rollout undo"],
        "time_limit": 480,
        "free": False,
    },
    5: {
        "title": "The Dead Node",
        "tagline": "A node went NotReady. Pods are stuck Pending. Fix it.",
        "difficulty": "Advanced",
        "concepts": ["kubectl get nodes", "kubectl cordon", "kubectl drain", "kubectl uncordon"],
        "time_limit": 600,
        "free": False,
    },
}


def get_scenario(level: int) -> object:
    cls = SCENARIOS.get(level)
    if not cls:
        raise ValueError(f"Level {level} not found")
    return cls()
