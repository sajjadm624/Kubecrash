from backend.engine.state_machine import StateMachine
from backend.engine.parser import parse
from backend.scenarios.base import c, table, not_found, unknown_command


class Level3(StateMachine):

    def get_time_limit(self): return 540

    def get_hints(self):
        return [
            "Hint: Use 'kubectl get pods -n production' - look for OOMKilled status.",
            "Hint: 'kubectl top pods -n production' shows actual memory usage.",
            "Hint: 'kubectl describe pod <name> -n production' - check Last State for OOMKilled reason.",
            "Hint: Fix with: kubectl set resources deployment/data-processor -n production --limits=memory=512Mi,cpu=500m",
        ]

    def get_win_message(self):
        return (
            c("green", "Resource limits set. Pods are stable. The OOM Reaper has been denied.\n") +
            c("dim", "Lesson: Always set resource requests AND limits. Unbounded memory usage is a ticking clock.\n")
        )

    def initial_resources(self):
        return {
            "pods": {
                "production": [
                    {"name": "data-processor-7c4d2a", "ready": "0/1", "status": "OOMKilled", "restarts": 12, "age": "30m"},
                    {"name": "data-processor-8b3e1f", "ready": "0/1", "status": "OOMKilled", "restarts": 11, "age": "30m"},
                    {"name": "api-server-9x2p", "ready": "1/1", "status": "Running", "restarts": 0, "age": "3h"},
                ]
            },
            "deployments": {
                "production": [
                    {"name": "data-processor", "ready": "0/2", "up_to_date": 2, "available": 0, "age": "30m",
                     "resources": {"requests": {}, "limits": {}}},
                    {"name": "api-server", "ready": "1/1", "up_to_date": 1, "available": 1, "age": "3h",
                     "resources": {"requests": {"memory": "256Mi", "cpu": "250m"}, "limits": {"memory": "512Mi", "cpu": "500m"}}},
                ]
            },
            "top": {
                "pods": [
                    {"name": "data-processor-7c4d2a", "cpu": "450m", "memory": "923Mi"},
                    {"name": "data-processor-8b3e1f", "cpu": "420m", "memory": "887Mi"},
                    {"name": "api-server-9x2p", "cpu": "45m", "memory": "128Mi"},
                ]
            }
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

        if v == "get" and r == "pods":
            pods = self.state.resources["pods"].get(ns, [])
            headers = ["NAME", "READY", "STATUS", "RESTARTS", "AGE"]
            rows = [[p["name"], p["ready"], p["status"], p["restarts"], p["age"]] for p in pods]
            return {"output": table(headers, rows, [28, 8, 12, 10, 6])}

        if v == "top" and r == "pods":
            top = self.state.resources["top"]["pods"]
            headers = ["NAME", "CPU(cores)", "MEMORY(bytes)"]
            rows = [[t["name"], t["cpu"], t["memory"]] for t in top]
            return {"output": table(headers, rows, [28, 12, 14])}

        if v == "top" and r == "nodes":
            return {"output": "NAME     CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%\nnode-1   1240m        31%    5.2Gi           65%\n"}

        if v == "describe" and r == "pods":
            pods = self.state.resources["pods"].get(ns, [])
            pod = next((p for p in pods if p["name"].startswith(name or "data")), None)
            if not pod:
                return {"output": not_found("pods", name or "", ns)}
            deploy = self.state.resources["deployments"]["production"][0]
            limits = deploy["resources"]["limits"]
            return {"output": (
                f"Name:         {pod['name']}\n"
                f"Namespace:    {ns}\n"
                f"Status:       {pod['status']}\n"
                f"Containers:\n"
                f"  data-processor:\n"
                f"    Last State: Terminated\n"
                f"      Reason:   OOMKilled\n"
                f"      Exit Code: 137\n"
                f"    Limits:\n"
                f"      {'<none>' if not limits else chr(10).join(f'      {k}: {v}' for k, v in limits.items())}\n"
                f"    Requests:\n"
                f"      <none>\n"
            )}

        if v == "describe" and r in ("deployment", "deployments"):
            deploy = self.state.resources["deployments"]["production"][0]
            limits = deploy["resources"]["limits"]
            return {"output": (
                f"Name:        data-processor\n"
                f"Namespace:   {ns}\n"
                f"Replicas:    2 desired | 0 available\n"
                f"Pod Template:\n"
                f"  Containers:\n"
                f"   data-processor:\n"
                f"    Limits:    {'<none>' if not limits else ', '.join(f'{k}: {v}' for k, v in limits.items())}\n"
                f"    Requests:  <none>\n"
            )}

        if v == "get" and r in ("deployment", "deployments"):
            deploys = self.state.resources["deployments"].get(ns, [])
            headers = ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"]
            rows = [[d["name"], d["ready"], d["up_to_date"], d["available"], d["age"]] for d in deploys]
            return {"output": table(headers, rows, [18, 8, 12, 10, 6])}

        if v == "set" and parsed.subcommand == "resources":
            raw = cmd
            has_memory = "memory=" in raw or "memory =" in raw
            if has_memory:
                self._apply_fix(raw)
                return {"output": "deployment.apps/data-processor resource requirements updated"}
            return {"output": c("yellow", "Usage: kubectl set resources deployment/data-processor --limits=memory=512Mi,cpu=500m -n production")}

        return {"output": c("yellow", "Command understood. Investigate why the pods are being killed.")}

    def _apply_fix(self, raw: str):
        deploy = self.state.resources["deployments"]["production"][0]
        deploy["resources"]["limits"] = {"memory": "512Mi", "cpu": "500m"}
        deploy["ready"] = "2/2"
        deploy["available"] = 2
        for pod in self.state.resources["pods"]["production"]:
            if "data-processor" in pod["name"]:
                pod["status"] = "Running"
                pod["ready"] = "1/1"
        self.state.flags["fixed"] = True

    def check_win(self) -> bool:
        return self.state.flags.get("fixed", False)
