from backend.engine.state_machine import StateMachine
from backend.engine.parser import parse
from backend.scenarios.base import c, table, not_found, unknown_command


class Level1(StateMachine):

    def get_time_limit(self): return 480

    def get_hints(self):
        return [
            "Hint: Start with 'kubectl get pods -n production' to see what's broken.",
            "Hint: Use 'kubectl logs <pod-name> -n production' to read the crash output.",
            "Hint: The logs mention a missing environment variable. Check the deployment.",
            "Hint: Fix it with: kubectl set env deployment/api-server DATABASE_URL=postgres://db:5432/prod -n production",
        ]

    def get_win_message(self):
        return (
            c("green", "All pods are Running. DATABASE_URL is set. The engineers can go back to sleep.\n") +
            c("dim", "Lesson: Always check logs first. CrashLoopBackOff almost always has a clear error message.\n")
        )

    def initial_resources(self):
        return {
            "pods": {
                "production": [
                    {"name": "api-server-7d9f4b", "ready": "0/1", "status": "CrashLoopBackOff", "restarts": 7, "age": "12m"},
                    {"name": "api-server-8c2a1d", "ready": "0/1", "status": "CrashLoopBackOff", "restarts": 6, "age": "12m"},
                    {"name": "api-server-3e5f2c", "ready": "0/1", "status": "CrashLoopBackOff", "restarts": 5, "age": "11m"},
                    {"name": "worker-b4x1-9p2qr", "ready": "1/1", "status": "Running", "restarts": 0, "age": "2h"},
                    {"name": "redis-0", "ready": "1/1", "status": "Running", "restarts": 0, "age": "2h"},
                ]
            },
            "deployments": {
                "production": [
                    {"name": "api-server", "ready": "0/3", "up_to_date": 3, "available": 0, "age": "12m",
                     "env": {}},  # no DATABASE_URL
                    {"name": "worker", "ready": "1/1", "up_to_date": 1, "available": 1, "age": "2h",
                     "env": {"DATABASE_URL": "postgres://db:5432/prod", "REDIS_URL": "redis://redis:6379"}},
                ]
            },
            "logs": {
                "api-server-7d9f4b": (
                    "Starting api-server v2.4.1\n"
                    "Loading configuration...\n" +
                    c("red", "FATAL: DATABASE_URL environment variable is not set\n") +
                    c("red", "Error: Cannot connect to database - missing connection string\n") +
                    "Process exited with code 1\n"
                ),
                "api-server-8c2a1d": (
                    "Starting api-server v2.4.1\n"
                    "Loading configuration...\n" +
                    c("red", "FATAL: DATABASE_URL environment variable is not set\n") +
                    c("red", "Error: Cannot connect to database - missing connection string\n") +
                    "Process exited with code 1\n"
                ),
                "api-server-3e5f2c": (
                    "Starting api-server v2.4.1\n"
                    "Loading configuration...\n" +
                    c("red", "FATAL: DATABASE_URL environment variable is not set\n") +
                    c("red", "Error: Cannot connect to database - missing connection string\n") +
                    "Process exited with code 1\n"
                ),
                "worker-b4x1-9p2qr": "Worker started. Processing jobs...\nJob queue connected.\n",
                "redis-0": "Redis 7.2.0 started\nReady to accept connections\n",
            }
        }

    def route(self, cmd: str) -> dict:
        parsed = parse(cmd)
        if not parsed:
            if cmd in ("clear", "cls"):
                return {"output": "\033[2J\033[H"}
            if cmd == "help" or cmd == "kubectl help":
                return {"output": self._help()}
            return {"output": unknown_command(cmd)}

        ns = parsed.namespace or "production"
        v = parsed.verb
        r = parsed.resource
        name = parsed.name

        # kubectl get pods
        if v == "get" and r == "pods":
            pods = self.state.resources["pods"].get(ns, [])
            if not pods:
                return {"output": f"No resources found in {ns} namespace."}
            headers = ["NAME", "READY", "STATUS", "RESTARTS", "AGE"]
            rows = [[p["name"], p["ready"], p["status"], p["restarts"], p["age"]] for p in pods]
            return {"output": table(headers, rows, [28, 8, 22, 10, 6])}

        # kubectl get deployments
        if v == "get" and r in ("deployment", "deployments"):
            deploys = self.state.resources["deployments"].get(ns, [])
            headers = ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"]
            rows = [[d["name"], d["ready"], d["up_to_date"], d["available"], d["age"]] for d in deploys]
            return {"output": table(headers, rows, [18, 8, 12, 10, 6])}

        # kubectl logs <pod>
        if v == "logs":
            if not name:
                return {"output": c("red", "error: pod name required\nUsage: kubectl logs <pod-name>")}
            logs = self.state.resources["logs"]
            # fuzzy match pod name prefix
            match = next((k for k in logs if k.startswith(name) or name.startswith(k.split("-")[0])), None)
            if not match:
                return {"output": not_found("pods", name, ns)}
            return {"output": logs[match]}

        # kubectl describe pod <name>
        if v == "describe" and r == "pods":
            pods = self.state.resources["pods"].get(ns, [])
            pod = next((p for p in pods if p["name"].startswith(name or "")), None)
            if not pod:
                return {"output": not_found("pods", name or "", ns)}
            deploy_env = self.state.resources["deployments"]["production"][0]["env"]
            env_section = "\n".join(f"    {k}:\t{v}" for k, v in deploy_env.items()) if deploy_env else "    <none>"
            return {"output": (
                f"Name:         {pod['name']}\n"
                f"Namespace:    {ns}\n"
                f"Status:       {pod['status']}\n"
                f"Containers:\n"
                f"  api-server:\n"
                f"    Image:    registry.company.com/api-server:v2.4.1\n"
                f"    State:    Waiting\n"
                f"      Reason: CrashLoopBackOff\n"
                f"    Environment:\n"
                f"{env_section}\n"
                f"Events:\n"
                f"  Warning  BackOff  2m  kubelet  Back-off restarting failed container\n"
            )}

        # kubectl describe deployment <name>
        if v == "describe" and r in ("deployment", "deployments"):
            deploys = self.state.resources["deployments"].get(ns, [])
            deploy = next((d for d in deploys if d["name"] == (name or "api-server")), None)
            if not deploy:
                return {"output": not_found("deployment", name or "", ns)}
            env_section = "\n".join(f"    {k}:\t{v}" for k, v in deploy["env"].items()) if deploy["env"] else "    <none>"
            return {"output": (
                f"Name:               {deploy['name']}\n"
                f"Namespace:          {ns}\n"
                f"Replicas:           3 desired | 3 updated | 3 total | 0 available | 3 unavailable\n"
                f"Pod Template:\n"
                f"  Containers:\n"
                f"   api-server:\n"
                f"    Image:   registry.company.com/api-server:v2.4.1\n"
                f"    Environment:\n"
                f"{env_section}\n"
                f"Conditions:\n"
                f"  Available   False   MinimumReplicasUnavailable\n"
            )}

        # kubectl set env deployment/api-server DATABASE_URL=...
        if v == "set" and parsed.subcommand == "env":
            # parse remaining tokens from raw cmd
            parts = cmd.split()
            env_pairs = [p for p in parts if "=" in p]
            if not env_pairs:
                return {"output": c("red", "error: must specify at least one env var as KEY=VALUE")}
            deploy = self.state.resources["deployments"]["production"][0]
            for pair in env_pairs:
                k, val = pair.split("=", 1)
                deploy["env"][k] = val
            self._apply_fix_if_correct()
            return {"output": f'deployment.apps/api-server env updated'}

        # kubectl edit deployment
        if v == "edit" and r in ("deployment", "deployments"):
            return {"output": (
                c("yellow", "# kubectl edit is not interactive in KubeCrash.\n") +
                "# Use: kubectl set env deployment/api-server DATABASE_URL=postgres://db:5432/prod -n production\n"
            )}

        # kubectl rollout status
        if v == "rollout" and parsed.subcommand == "status":
            if self.state.flags.get("fixed"):
                return {"output": 'deployment "api-server" successfully rolled out'}
            return {"output": 'Waiting for deployment "api-server" rollout to finish: 0 of 3 updated replicas are available...'}

        # kubectl get events
        if v == "get" and r == "events":
            return {"output": (
                "LAST SEEN   TYPE      REASON      OBJECT                         MESSAGE\n"
                "2m          Warning   BackOff     pod/api-server-7d9f4b          Back-off restarting failed container\n"
                "2m          Warning   BackOff     pod/api-server-8c2a1d          Back-off restarting failed container\n"
                "12m         Normal    Scheduled   pod/api-server-7d9f4b          Successfully assigned to node-1\n"
            )}

        return {"output": c("yellow", f"Command understood but not applicable here.\nFocus: the pods are crashing. Check logs.")}

    def _apply_fix_if_correct(self):
        deploy = self.state.resources["deployments"]["production"][0]
        if "DATABASE_URL" in deploy["env"]:
            self.state.flags["fixed"] = True
            # Update pods to Running
            for pod in self.state.resources["pods"]["production"]:
                if "api-server" in pod["name"]:
                    pod["status"] = "Running"
                    pod["ready"] = "1/1"
                    pod["restarts"] = 0

    def check_win(self) -> bool:
        return self.state.flags.get("fixed", False)

    def _help(self) -> str:
        return (
            "Useful commands for this incident:\n"
            "  kubectl get pods -n production\n"
            "  kubectl logs <pod-name> -n production\n"
            "  kubectl describe pod <pod-name> -n production\n"
            "  kubectl describe deployment api-server -n production\n"
            "  kubectl set env deployment/api-server KEY=VALUE -n production\n"
            "  kubectl rollout status deployment/api-server -n production\n"
        )
