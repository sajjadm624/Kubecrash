import shlex
from dataclasses import dataclass
from typing import Optional


@dataclass
class KubectlCommand:
    verb: str           # get, describe, logs, edit, set, patch, rollout, cordon, drain, uncordon, top, apply, delete
    resource: str       # pods, deployment, svc, nodes, ep, etc.
    name: Optional[str] = None
    namespace: Optional[str] = "production"
    flags: dict = None
    subcommand: Optional[str] = None  # for rollout history/undo/status

    def __post_init__(self):
        if self.flags is None:
            self.flags = {}


def parse(raw: str) -> Optional[KubectlCommand]:
    """
    Parse a raw kubectl command string into a structured KubectlCommand.
    Returns None if not a kubectl command.
    """
    raw = raw.strip()
    if not raw.startswith("kubectl"):
        return None

    try:
        tokens = shlex.split(raw)
    except ValueError:
        return None

    if len(tokens) < 2:
        return None

    tokens = tokens[1:]  # drop 'kubectl'
    flags = {}
    namespace = "production"
    args = []

    i = 0

    # Parse kubectl global flags before the verb (e.g. `kubectl -n production logs ...`).
    while i < len(tokens):
        t = tokens[i]
        if t in ("-n", "--namespace") and i + 1 < len(tokens):
            namespace = tokens[i + 1]
            i += 2
        elif t.startswith("--namespace="):
            namespace = t.split("=", 1)[1]
            i += 1
        elif t.startswith("-"):
            key = t.lstrip("-")
            if i + 1 < len(tokens) and not tokens[i + 1].startswith("-"):
                flags[key] = tokens[i + 1]
                i += 2
            else:
                flags[key] = True
                i += 1
        else:
            break

    if i >= len(tokens):
        return None

    verb = tokens[i]
    i += 1

    while i < len(tokens):
        t = tokens[i]
        if t in ("-n", "--namespace") and i + 1 < len(tokens):
            namespace = tokens[i + 1]
            i += 2
        elif t.startswith("--namespace="):
            namespace = t.split("=", 1)[1]
            i += 1
        elif t.startswith("-") or t.startswith("--"):
            key = t.lstrip("-")
            if i + 1 < len(tokens) and not tokens[i + 1].startswith("-"):
                flags[key] = tokens[i + 1]
                i += 2
            else:
                flags[key] = True
                i += 1
        else:
            args.append(t)
            i += 1

    resource = args[0] if len(args) > 0 else ""
    name = args[1] if len(args) > 1 else None
    subcommand = None

    # Handle `kubectl rollout history/undo/status <resource> <name>`
    if verb == "rollout" and len(args) >= 1:
        subcommand = args[0]
        resource = args[1] if len(args) > 1 else ""
        name = args[2] if len(args) > 2 else None

    # Handle `kubectl set resources/env <resource> <name>`
    if verb == "set" and len(args) >= 1:
        subcommand = args[0]
        resource = args[1] if len(args) > 1 else ""
        name = args[2] if len(args) > 2 else None

    # Handle `kubectl logs <pod-name>`
    if verb == "logs":
        resource = "pods"
        name = args[0] if len(args) > 0 else None

    # Handle `kubectl cordon|drain|uncordon <node-name>`
    if verb in ("cordon", "drain", "uncordon"):
        resource = "nodes"
        name = args[0] if len(args) > 0 else None

    # Normalize resource aliases
    aliases = {
        "po": "pods", "pod": "pods",
        "deploy": "deployment", "deployments": "deployment",
        "svc": "service", "services": "service",
        "no": "nodes", "node": "nodes",
        "ep": "endpoints", "endpoint": "endpoints",
        "ns": "namespace",
    }
    resource = aliases.get(resource, resource)

    return KubectlCommand(
        verb=verb,
        resource=resource,
        name=name,
        namespace=namespace,
        flags=flags,
        subcommand=subcommand,
    )
