from backend.engine.state_machine import StateMachine
from backend.engine.parser import parse
from backend.scenarios.base import c, table, not_found, unknown_command


class Level5(StateMachine):

    def get_time_limit(self): return 600

    def get_hints(self):
        return [
            "Hint: 'kubectl get nodes' - one node is NotReady.",
            "Hint: 'kubectl describe node node-2' - check the conditions and events.",
            "Hint: Cordon the node first: 'kubectl cordon node-2' - prevents new pods from scheduling there.",
            "Hint: Drain it: 'kubectl drain node-2 --ignore-daemonsets --delete-emptydir-data'",
            "Hint: After draining, the node auto-recovers. Uncordon it: 'kubectl uncordon node-2'",
        ]

    def get_win_message(self):
        return (
            c("green", "node-2 is Ready. All pods are Running. Cluster fully operational.\n") +
            c("dim", "Lesson: cordon -> drain -> fix -> uncordon. This is the standard node maintenance pattern.\n")
        )

    def initial_resources(self):
        return {
            "nodes": [
                {"name": "node-1", "status": "Ready", "roles": "control-plane", "age": "45d", "version": "v1.29.0",
                 "cordoned": False},
                {"name": "node-2", "status": "NotReady", "roles": "worker", "age": "45d", "version": "v1.29.0",
                 "cordoned": False},
                {"name": "node-3", "status": "Ready", "roles": "worker", "age": "45d", "version": "v1.29.0",
                 "cordoned": False},
            ],
            "pods": {
                "production": [
                    {"name": "api-7f4d2a", "ready": "0/1", "status": "Pending", "restarts": 0, "age": "8m", "node": "node-2"},
                    {"name": "api-8c3e1b", "ready": "0/1", "status": "Pending", "restarts": 0, "age": "8m", "node": "node-2"},
                    {"name": "worker-9a2f", "ready": "1/1", "status": "Running", "restarts": 0, "age": "1h", "node": "node-3"},
                ]
            },
            "flags": {"drained": False, "cordoned": False, "uncordoned": False}
        }

    def route(self, cmd: str) -> dict:
        parsed = parse(cmd)
        if not parsed:
            if cmd in ("clear", "cls"):
                return {"output": "\033[2J\033[H"}
            return {"output": unknown_command(cmd)}

        v = parsed.verb
        r = parsed.resource
        name = parsed.name
        ns = parsed.namespace or "production"

        if v == "get" and r == "nodes":
            nodes = self.state.resources["nodes"]
            headers = ["NAME", "STATUS", "ROLES", "AGE", "VERSION"]
            rows = []
            for n in nodes:
                status = n["status"]
                if n["cordoned"]:
                    status += ",SchedulingDisabled"
                rows.append([n["name"], status, n["roles"], n["age"], n["version"]])
            return {"output": table(headers, rows, [12, 30, 16, 6, 10])}

        if v == "get" and r == "pods":
            pods = self.state.resources["pods"].get(ns, [])
            headers = ["NAME", "READY", "STATUS", "RESTARTS", "AGE"]
            rows = [[p["name"], p["ready"], p["status"], p["restarts"], p["age"]] for p in pods]
            return {"output": table(headers, rows, [22, 8, 10, 10, 6])}

        if v == "describe" and r == "nodes":
            node_name = name or "node-2"
            node = next((n for n in self.state.resources["nodes"] if n["name"] == node_name), None)
            if not node:
                return {"output": not_found("node", node_name, "")}
            return {"output": (
                f"Name:               {node['name']}\n"
                f"Roles:              {node['roles']}\n"
                f"Conditions:\n"
                f"  Ready   {node['status']}   {'Node is healthy' if node['status'] == 'Ready' else 'kubelet stopped posting node status'}\n"
                f"Addresses:\n"
                f"  InternalIP:  192.168.1.{'10' if node['name'] == 'node-1' else '11' if node['name'] == 'node-2' else '12'}\n"
                f"Events:\n" +
                (f"  Warning  NodeNotReady  8m   node-controller  Node node-2 status is now: NodeNotReady\n"
                 if node["name"] == "node-2" and node["status"] == "NotReady"
                 else "  Normal   NodeReady     1m   kubelet  Node node-2 status is now: NodeReady\n"
                 if node["name"] == "node-2"
                 else "  Normal   NodeReady     45d  kubelet  Node is healthy\n")
            )}

        if v == "cordon":
            node_name = name or "node-2"
            node = next((n for n in self.state.resources["nodes"] if n["name"] == node_name), None)
            if not node:
                return {"output": not_found("node", node_name, "")}
            node["cordoned"] = True
            self.state.flags["cordoned"] = True
            return {"output": f"node/{node_name} cordoned"}

        if v == "drain":
            node_name = name or "node-2"
            node = next((n for n in self.state.resources["nodes"] if n["name"] == node_name), None)
            if not node:
                return {"output": not_found("node", node_name, "")}
            if not node["cordoned"]:
                return {"output": c("yellow", f"node/{node_name} is not cordoned. Cordon it first: kubectl cordon {node_name}")}
            # Move pods to node-3
            for pod in self.state.resources["pods"]["production"]:
                if pod["node"] == "node-2":
                    pod["node"] = "node-3"
                    pod["status"] = "Running"
                    pod["ready"] = "1/1"
            # Node "recovers" after drain
            node["status"] = "Ready"
            self.state.flags["drained"] = True
            return {"output": (
                f"node/{node_name} already cordoned\n"
                f"evicting pod production/api-7f4d2a\n"
                f"evicting pod production/api-8c3e1b\n"
                f"pod/api-7f4d2a evicted\n"
                f"pod/api-8c3e1b evicted\n"
                f"node/{node_name} drained\n"
                + c("green", f"\n[system] node-2 hardware issue resolved. Node is now Ready.\n")
            )}

        if v == "uncordon":
            node_name = name or "node-2"
            node = next((n for n in self.state.resources["nodes"] if n["name"] == node_name), None)
            if not node:
                return {"output": not_found("node", node_name, "")}
            if not self.state.flags.get("drained"):
                return {"output": c("yellow", "Drain the node first before uncordoning.")}
            node["cordoned"] = False
            self.state.flags["uncordoned"] = True
            return {"output": f"node/{node_name} uncordoned"}

        return {"output": c("yellow", "Command understood. Focus on the node lifecycle: cordon -> drain -> uncordon.")}

    def check_win(self) -> bool:
        return (
            self.state.flags.get("drained", False) and
            self.state.flags.get("uncordoned", False)
        )
