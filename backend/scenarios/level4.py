from backend.engine.state_machine import StateMachine
from backend.engine.parser import parse
from backend.scenarios.base import c, table, not_found, unknown_command


class Level4(StateMachine):

    def get_time_limit(self): return 480

    def get_hints(self):
        return [
            "Hint: 'kubectl get pods -n production' - ImagePullBackOff means the image can't be pulled.",
            "Hint: 'kubectl describe pod <name>' - check the image name. Does it look right?",
            "Hint: 'kubectl rollout history deployment/api -n production' - see what was deployed.",
            "Hint: 'kubectl rollout undo deployment/api -n production' - roll back to the last working version.",
        ]

    def get_win_message(self):
        return (
            c("green", "Rollback complete. Previous stable image is running. The Friday deploy is undone.\n") +
            c("dim", "Lesson: Never deploy on Friday afternoon. If you must, always have a rollback plan ready.\n")
        )

    def initial_resources(self):
        return {
            "pods": {
                "production": [
                    {"name": "api-6f9b2d", "ready": "0/1", "status": "ImagePullBackOff", "restarts": 0, "age": "5m"},
                    {"name": "api-7c4e3a", "ready": "0/1", "status": "ImagePullBackOff", "restarts": 0, "age": "5m"},
                    {"name": "api-8d5f4b", "ready": "0/1", "status": "ImagePullBackOff", "restarts": 0, "age": "5m"},
                ]
            },
            "deployments": {
                "production": [
                    {
                        "name": "api",
                        "ready": "0/3",
                        "up_to_date": 3,
                        "available": 0,
                        "age": "5m",
                        "current_image": "registry.company.com/api:latest-broken",
                        "rollout_history": [
                            {"revision": 1, "change_cause": "Initial deployment - api:v1.0.0"},
                            {"revision": 2, "change_cause": "Feature release - api:v2.3.1"},
                            {"revision": 3, "change_cause": "Friday hotfix - api:latest-broken"},
                        ]
                    }
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
            return {"output": table(headers, rows, [22, 8, 20, 10, 6])}

        if v == "get" and r in ("deployment", "deployments"):
            deploys = self.state.resources["deployments"].get(ns, [])
            headers = ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"]
            rows = [[d["name"], d["ready"], d["up_to_date"], d["available"], d["age"]] for d in deploys]
            return {"output": table(headers, rows, [12, 8, 12, 10, 6])}

        if v == "describe" and r == "pods":
            pods = self.state.resources["pods"].get(ns, [])
            pod = next((p for p in pods if p["name"].startswith(name or "api")), None)
            if not pod:
                return {"output": not_found("pods", name or "", ns)}
            image = self.state.resources["deployments"]["production"][0]["current_image"]
            return {"output": (
                f"Name:          {pod['name']}\n"
                f"Namespace:     {ns}\n"
                f"Status:        {pod['status']}\n"
                f"Containers:\n"
                f"  api:\n"
                f"    Image:     {image}\n"
                f"    State:     Waiting\n"
                f"      Reason:  ImagePullBackOff\n"
                f"Events:\n"
                f"  Warning  Failed     3m   kubelet  Failed to pull image \"{image}\": not found\n"
                f"  Warning  BackOff    2m   kubelet  Back-off pulling image \"{image}\"\n"
            )}

        if v == "rollout" and parsed.subcommand == "history":
            deploy = self.state.resources["deployments"]["production"][0]
            lines = ["REVISION  CHANGE-CAUSE"]
            for h in deploy["rollout_history"]:
                lines.append(f"{h['revision']}         {h['change_cause']}")
            return {"output": "\n".join(lines)}

        if v == "rollout" and parsed.subcommand == "undo":
            self._apply_fix()
            return {"output": 'deployment.apps/api rolled back'}

        if v == "rollout" and parsed.subcommand == "status":
            if self.state.flags.get("fixed"):
                return {"output": 'deployment "api" successfully rolled out'}
            return {"output": 'Waiting for rollout to finish: 0 of 3 new replicas have been updated...'}

        return {"output": c("yellow", "Command understood. Focus: why can't the image be pulled? How do you revert?")}

    def _apply_fix(self):
        deploy = self.state.resources["deployments"]["production"][0]
        deploy["current_image"] = "registry.company.com/api:v2.3.1"
        deploy["ready"] = "3/3"
        deploy["available"] = 3
        for pod in self.state.resources["pods"]["production"]:
            pod["status"] = "Running"
            pod["ready"] = "1/1"
        self.state.flags["fixed"] = True

    def check_win(self) -> bool:
        return self.state.flags.get("fixed", False)
