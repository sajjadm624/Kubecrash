from backend.engine.state_machine import StateMachine
from backend.engine.parser import parse
from backend.scenarios.base import c, table, not_found, unknown_command


class Level2(StateMachine):

    def get_time_limit(self): return 480

    def get_hints(self):
        return [
            "Hint: Use 'kubectl get svc -n production' to inspect the service.",
            "Hint: Check endpoints: 'kubectl get endpoints -n production' - if empty, selectors don't match.",
            "Hint: Use 'kubectl get pods --show-labels -n production' to see actual pod labels.",
            "Hint: Fix with: kubectl patch svc api-service -n production -p '{\"spec\":{\"selector\":{\"app\":\"api-server\"}}}'",
        ]

    def get_win_message(self):
        return (
            c("green", "Service endpoints are populated. Traffic is flowing. The 502s are gone.\n") +
            c("dim", "Lesson: Label selector mismatches are silent - no error, just empty endpoints. Always check 'kubectl get ep'.\n")
        )

    def initial_resources(self):
        return {
            "pods": {
                "production": [
                    {"name": "api-server-5f7d2a", "ready": "1/1", "status": "Running", "restarts": 0, "age": "1h", "labels": {"app": "api-server", "version": "v3"}},
                    {"name": "api-server-6e8c3b", "ready": "1/1", "status": "Running", "restarts": 0, "age": "1h", "labels": {"app": "api-server", "version": "v3"}},
                    {"name": "api-server-7a9d4c", "ready": "1/1", "status": "Running", "restarts": 0, "age": "1h", "labels": {"app": "api-server", "version": "v3"}},
                    {"name": "postgres-0", "ready": "1/1", "status": "Running", "restarts": 0, "age": "3h", "labels": {"app": "postgres"}},
                ]
            },
            "services": {
                "production": [
                    {"name": "api-service", "type": "ClusterIP", "cluster_ip": "10.96.45.12", "port": "80/TCP", "age": "2h",
                     "selector": {"app": "api"}},  # BUG: should be "api-server"
                    {"name": "postgres", "type": "ClusterIP", "cluster_ip": "10.96.12.34", "port": "5432/TCP", "age": "3h",
                     "selector": {"app": "postgres"}},
                ]
            },
            "endpoints": {
                "production": {
                    "api-service": [],  # empty because selector doesn't match
                    "postgres": ["10.244.1.5:5432"],
                }
            },
            "flags": {}
        }

    def route(self, cmd: str) -> dict:
        parsed = parse(cmd)
        if not parsed:
            if cmd in ("clear", "cls"):
                return {"output": "\033[2J\033[H"}
            return {"output": unknown_command(cmd)}

        ns = parsed.namespace or "production"
        v = parsed.verb
        r = parsed.resource
        name = parsed.name

        # kubectl get pods
        if v == "get" and r == "pods":
            pods = self.state.resources["pods"].get(ns, [])
            show_labels = "show-labels" in parsed.flags or "show_labels" in parsed.flags
            if show_labels:
                headers = ["NAME", "READY", "STATUS", "RESTARTS", "AGE", "LABELS"]
                rows = [[p["name"], p["ready"], p["status"], p["restarts"], p["age"],
                         ",".join(f"{k}={v}" for k, v in p["labels"].items())] for p in pods]
                return {"output": table(headers, rows, [26, 8, 10, 10, 6, 30])}
            headers = ["NAME", "READY", "STATUS", "RESTARTS", "AGE"]
            rows = [[p["name"], p["ready"], p["status"], p["restarts"], p["age"]] for p in pods]
            return {"output": table(headers, rows, [26, 8, 10, 10, 6])}

        # kubectl get svc / service
        if v == "get" and r in ("service", "services", "svc"):
            svcs = self.state.resources["services"].get(ns, [])
            headers = ["NAME", "TYPE", "CLUSTER-IP", "PORT(S)", "AGE"]
            rows = [[s["name"], s["type"], s["cluster_ip"], s["port"], s["age"]] for s in svcs]
            return {"output": table(headers, rows, [18, 12, 16, 12, 6])}

        # kubectl get endpoints / ep
        if v == "get" and r in ("endpoints", "endpoint", "ep"):
            eps = self.state.resources["endpoints"].get(ns, {})
            headers = ["NAME", "ENDPOINTS", "AGE"]
            rows = []
            for svc_name, addrs in eps.items():
                rows.append([svc_name, ",".join(addrs) if addrs else "<none>", "2h"])
            return {"output": table(headers, rows, [18, 30, 6])}

        # kubectl describe svc
        if v == "describe" and r in ("service", "services", "svc"):
            svcs = self.state.resources["services"].get(ns, [])
            svc = next((s for s in svcs if s["name"] == (name or "api-service")), None)
            if not svc:
                return {"output": not_found("service", name or "", ns)}
            selector_str = ", ".join(f"{k}={v}" for k, v in svc["selector"].items())
            eps = self.state.resources["endpoints"][ns].get(svc["name"], [])
            ep_str = ",".join(eps) if eps else "<none>"
            return {"output": (
                f"Name:              {svc['name']}\n"
                f"Namespace:         {ns}\n"
                f"Type:              {svc['type']}\n"
                f"IP:                {svc['cluster_ip']}\n"
                f"Port:              {svc['port']}\n"
                f"Endpoints:         {ep_str}\n"
                f"Selector:          {selector_str}\n"
                f"Session Affinity:  None\n"
            )}

        # kubectl patch svc
        if v == "patch" and r in ("service", "services", "svc"):
            raw_lower = cmd.lower()
            if "api-server" in raw_lower or '"app":"api-server"' in raw_lower.replace(" ", "") or "'api-server'" in raw_lower:
                self._apply_fix()
                return {"output": 'service/api-service patched'}
            return {"output": c("yellow", "Patch applied but selector unchanged. Make sure you set app=api-server.")}

        # kubectl edit svc
        if v == "edit" and r in ("service", "services", "svc"):
            return {"output": (
                c("yellow", "# kubectl edit is not interactive in KubeCrash.\n") +
                '# Use: kubectl patch svc api-service -n production -p \'{"spec":{"selector":{"app":"api-server"}}}\'\n'
            )}

        return {"output": c("yellow", "Command understood. Focus: why is the service not routing traffic to pods?")}

    def _apply_fix(self):
        svcs = self.state.resources["services"]["production"]
        svc = next(s for s in svcs if s["name"] == "api-service")
        svc["selector"] = {"app": "api-server"}
        self.state.resources["endpoints"]["production"]["api-service"] = [
            "10.244.1.2:8080", "10.244.1.3:8080", "10.244.1.4:8080"
        ]
        self.state.flags["fixed"] = True

    def check_win(self) -> bool:
        return self.state.flags.get("fixed", False)
