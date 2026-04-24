from dataclasses import dataclass, field
from typing import Any, Callable, Optional
import time


@dataclass
class ClusterState:
    """Represents the simulated Kubernetes cluster state for a scenario."""
    resources: dict = field(default_factory=dict)
    flags: dict = field(default_factory=dict)  # internal scenario flags
    hints_unlocked: int = 0
    commands_run: int = 0
    start_time: float = field(default_factory=time.time)
    completed: bool = False
    failed: bool = False


class StateMachine:
    """
    Base state machine for a KubeCrash scenario.
    Subclasses define resources, command handlers, win condition, and hints.
    """

    def __init__(self):
        self.state = ClusterState(resources=self.initial_resources())
        self.hints = self.get_hints()
        self.win_message = self.get_win_message()
        self.fail_message = self.get_fail_message()
        self.time_limit = self.get_time_limit()

    def initial_resources(self) -> dict:
        raise NotImplementedError

    def get_hints(self) -> list[str]:
        raise NotImplementedError

    def get_win_message(self) -> str:
        raise NotImplementedError

    def get_fail_message(self) -> str:
        return "Time's up. The SLA is breached. The on-call gods are not pleased."

    def get_time_limit(self) -> int:
        return 600  # 10 minutes default

    def handle_command(self, raw: str) -> dict:
        """
        Parse and handle a raw kubectl command.
        Returns: { output: str, win: bool, fail: bool, hint: str | None }
        """
        self.state.commands_run += 1
        cmd = raw.strip()

        # Check time limit
        elapsed = time.time() - self.state.start_time
        if elapsed > self.time_limit:
            self.state.failed = True
            return {
                "output": self.fail_message,
                "win": False,
                "fail": True,
                "hint": None
            }

        # Route command
        result = self.route(cmd)

        # Check win condition after every command
        if self.check_win():
            self.state.completed = True
            elapsed = time.time() - self.state.start_time
            result["win"] = True
            result["win_time"] = round(elapsed)
            result["output"] += f"\n\n\033[32m✓ INCIDENT RESOLVED in {round(elapsed)}s\033[0m\n{self.win_message}"

        # Unlock hints progressively
        hint = None
        if self.state.commands_run % 4 == 0 and self.state.hints_unlocked < len(self.hints):
            hint = self.hints[self.state.hints_unlocked]
            self.state.hints_unlocked += 1

        result["hint"] = hint
        result.setdefault("win", False)
        result.setdefault("fail", False)
        return result

    def route(self, cmd: str) -> dict:
        raise NotImplementedError

    def check_win(self) -> bool:
        raise NotImplementedError

    def elapsed(self) -> float:
        return time.time() - self.state.start_time

    def remaining(self) -> int:
        return max(0, self.time_limit - int(self.elapsed()))
