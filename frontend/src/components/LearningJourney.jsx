import { useCallback, useEffect, useMemo, useState } from 'react'
import useGameStore from '../store/gameStore'
import useTerminal from '../hooks/useTerminal'
import { parseKubectl, semanticMatchByReference } from '../utils/kubectlParser'
import { buildTrackSummary, isLessonAccessible } from '../data/learning/curriculumMap'
import {
  buildCommandSignature,
  commandCoverageStats,
  isKnownCoverageCommand,
} from '../data/learning/commandCoverage'
import {
  DEFAULT_LEARNING_PROGRESS,
  loadLearningProgress,
  saveLearningProgress,
} from '../data/learning/progressSchema'
import { YAML_CHALLENGES } from '../data/learning/yamlChallenges'
import ADVANCED_TRACKS from '../data/learning/advancedTracks'
import YAMLChallenge from './YAMLChallenge'
import AdvancedTrackLesson from './AdvancedTrackLesson'

const CKA_BLUEPRINT = [
  { domain: 'Troubleshooting', weight: '30%' },
  { domain: 'Cluster Architecture, Installation and Configuration', weight: '25%' },
  { domain: 'Workloads and Scheduling', weight: '15%' },
  { domain: 'Services and Networking', weight: '20%' },
  { domain: 'Storage', weight: '10%' },
]

const STUDY_PLAN_30D = [
  'Days 1-5: Foundation lessons 1-3 + one mini-mock retry daily',
  'Days 6-10: Foundation lessons 4-6 + docs review notes',
  'Days 11-16: Intermediate lessons 7-10 + command speed drills',
  'Days 17-22: Intermediate lessons 11-14 + one mixed mini-mock daily',
  'Days 23-27: CKA full mock runs with strict exam hints',
  'Days 28-30: Weak-topic revision + final timed full mock',
]

const ARCHITECTURE_READING_PACK = [
  { label: 'Kubernetes Architecture', url: 'https://kubernetes.io/docs/concepts/architecture/' },
  { label: 'Cluster Administration Overview', url: 'https://kubernetes.io/docs/tasks/administer-cluster/' },
  { label: 'Control Plane Components', url: 'https://kubernetes.io/docs/concepts/architecture/#control-plane-components' },
  { label: 'etcd Deep Dive', url: 'https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/' },
  { label: 'API Concepts', url: 'https://kubernetes.io/docs/reference/using-api/api-concepts/' },
  { label: 'Scheduling, Preemption and Eviction', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/' },
]

const LESSONS = [
  {
    id: 0,
    track: 'beginner',
    domain: 'Cluster Architecture, Installation and Configuration',
    title: 'Lesson 0: Kubernetes from Zero (Core Objects)',
    objective: 'Understand pods, deployments, services, namespaces, and basic kubectl workflow.',
    brief: "You just got access to a production cluster for the first time. Nobody is on fire — yet. This is your one chance to explore before the chaos starts. A cluster full of namespaces, services, and pods is only useful if you can read it. Operators who panic under pressure all share one trait: they never learned to look first. Don't be that person.",
    philosophy: "Observation before action. Every expert incident response starts with a read-only recon phase. Muscle memory for get, describe, and logs saves lives at 3 AM.",
    clusterOverview: "Cluster: kubecrash-lab (3 nodes) | Namespace: production | Workloads: api-server, worker-processor | Services: api-service | Your role: On-call SRE, first day with cluster access.",
    quiz: [
      { id: 'q1', prompt: 'What is a Namespace in Kubernetes?', options: ['A container runtime environment', 'A virtual cluster for isolating resources within the same cluster', 'A physical separation between nodes'], correct: 1, explanation: 'Namespaces partition cluster resources — teams, environments, and apps each get their own scope, preventing name collisions and enabling quota control.' },
      { id: 'q2', prompt: 'Which flag scopes a kubectl command to a specific namespace?', options: ['-s', '--context', '-n'], correct: 2, explanation: '`-n` (or `--namespace`) tells kubectl to operate within the specified namespace. Without it, commands target the `default` namespace.' },
      { id: 'q3', prompt: 'Which command gives you the most diagnostic detail about a specific pod?', options: ['kubectl get pod', 'kubectl describe pod', 'kubectl logs pod'], correct: 1, explanation: '`kubectl describe pod` shows Events, Conditions, resource requests, node assignment, and restart history — everything you need to start diagnosing.' },
    ],
    docs: [
      { label: 'Kubernetes Concepts Overview', url: 'https://kubernetes.io/docs/concepts/overview/' },
      { label: 'kubectl Quick Reference', url: 'https://kubernetes.io/docs/reference/kubectl/quick-reference/' },
    ],
    envValues: ['NAMESPACE=production', 'APP_NAME=api-server', 'SERVICE_NAME=api-service'],
    prompt: 'Practice: list resources and inspect one pod to build command fluency.',
    timeLimit: 360,
    checkpoints: [
      {
        id: 'ns',
        hint: 'View namespaces: kubectl get ns',
        test: (c) => {
          const p = parseKubectl(c)
          return p?.verb === 'get' && p.resource === 'namespace'
        },
        success: 'Checkpoint 1/4: Namespaces discovered.',
      },
      {
        id: 'pods',
        hint: 'List pods: kubectl get pods -n production',
        test: (c) => {
          const p = parseKubectl(c)
          return p?.verb === 'get' && p.resource === 'pods' && p.namespace === 'production'
        },
        success: 'Checkpoint 2/4: Pods listed in production.',
      },
      {
        id: 'svc',
        hint: 'List services: kubectl get svc -n production',
        test: (c) => {
          const p = parseKubectl(c)
          return p?.verb === 'get' && p.resource === 'service' && p.namespace === 'production'
        },
        success: 'Checkpoint 3/4: Services listed in production.',
      },
      {
        id: 'describe',
        hint: 'Inspect pod details: kubectl describe pod api-server-7d9f4b -n production',
        test: (c) => {
          const p = parseKubectl(c)
          return p?.verb === 'describe' && p.resource === 'pods' && p.namespace === 'production'
        },
        success: 'Checkpoint 4/4: Pod inspection completed. You are ready for incident-based learning.',
      },
    ],
  },
  {
    id: 1,
    track: 'foundation',
    domain: 'Troubleshooting',
    title: 'Lesson 1: CrashLoopBackOff + Env Vars',
    objective: 'Diagnose pod crashes and patch missing environment variables.',
    brief: "It's 2:47 AM. PagerDuty fires. The api-server is in CrashLoopBackOff — 5 restarts in 4 minutes. Every transaction is failing silently. The on-call engineer before you tried restarting the pod. It crashed again. They gave up. You won't. The crash reason is in the logs, and the fix is one command away — but you have to look first.",
    philosophy: "Logs don't lie. Before you patch anything, you read the crash reason. Kubernetes tells you exactly why a container died. The only failure is not asking.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | Broken workload: api-server-7d9f4b (CrashLoopBackOff, 5 restarts) | Root cause: DATABASE_URL env var missing from deployment spec | Downstream impact: Payment service timeout.",
    quiz: [
      { id: 'q1', prompt: 'What does CrashLoopBackOff mean?', options: ['The image is missing from the registry', 'The container crashes on startup and Kubernetes is retrying with exponential backoff', 'The node ran out of memory'], correct: 1, explanation: 'CrashLoopBackOff means the container exits immediately after starting. Kubernetes retries with increasing delays (exponential backoff). The root cause is always inside the container logs.' },
      { id: 'q2', prompt: 'What is the fastest command to see why a pod crashed?', options: ['kubectl describe deployment', 'kubectl get events', 'kubectl logs <pod-name>'], correct: 2, explanation: '`kubectl logs` captures stdout/stderr from the container — where application-level crash reasons live. If the container is already restarted, use `--previous` to see the last crash.' },
      { id: 'q3', prompt: 'How do you inject an environment variable into a running Deployment without editing YAML?', options: ['kubectl edit pod', 'kubectl set env deployment/<name> KEY=VALUE', 'kubectl exec <pod> -- export KEY=VALUE'], correct: 1, explanation: '`kubectl set env` patches the Deployment spec directly, triggering a rolling update. This is the fastest, exam-safe method.' },
    ],
    docs: [
      { label: 'Kubernetes: Debug Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/' },
      { label: 'Kubernetes: Define Environment Variables', url: 'https://kubernetes.io/docs/tasks/inject-data-application/define-environment-variable-container/' },
    ],
    envValues: [
      'DATABASE_URL=postgres://db:5432/prod',
      'REDIS_URL=redis://redis:6379',
      'APP_ENV=production',
    ],
    prompt: 'Practice: fix api-server CrashLoopBackOff caused by missing DATABASE_URL.',
    timeLimit: 420,
    checkpoints: [
      {
        id: 'inspect',
        hint: 'Inspect failing workloads: kubectl get pods -n production',
        test: (c) => c.startsWith('kubectl get pods'),
        success: 'Checkpoint 1/3: You inspected pod status. CrashLoopBackOff confirmed.',
      },
      {
        id: 'logs',
        hint: 'Read crash reason: kubectl logs api-server-7d9f4b -n production',
        test: (c) => c.startsWith('kubectl logs api-server'),
        success: 'Checkpoint 2/3: Logs show DATABASE_URL is missing.',
      },
      {
        id: 'fix',
        hint: 'Patch env: kubectl set env deployment/api-server DATABASE_URL=postgres://db:5432/prod -n production',
        test: (c) => c.includes('set env deployment/api-server') && c.includes('DATABASE_URL=postgres://db:5432/prod'),
        success: 'Checkpoint 3/3: Env injected. Deployment recovers.',
      },
    ],
  },
  {
    id: 2,
    track: 'foundation',
    domain: 'Services and Networking',
    title: 'Lesson 2: Services, Selectors, Endpoints',
    objective: 'Fix service-to-pod routing mismatches.',
    brief: "The pods are Running. The service exists. But users get connection refused. No errors in application logs. This is the Kubernetes networking illusion: objects look healthy, but traffic hits a void. A single typo in a label selector means zero endpoints. The service is a ghost — present, but serving nothing.",
    philosophy: "In Kubernetes, a Service without Endpoints is worse than no service at all — it fails silently. Always verify endpoints, not just service existence.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | Service: api-service (ClusterIP 10.96.14.21) | Pods: api-server-7d9f4b (Running, label: app=api-server) | Problem: service selector uses wrong label key — endpoints: <none>.",
    quiz: [
      { id: 'q1', prompt: 'What connects a Kubernetes Service to its backing Pods?', options: ['Port numbers', 'Label selectors in spec.selector matching Pod labels', 'The Pod IP directly configured in the Service'], correct: 1, explanation: 'Services use label selectors to dynamically find Pods. If the selector does not match any Pod labels, the Endpoints object stays empty and traffic never reaches a pod.' },
      { id: 'q2', prompt: 'How do you verify a Service has live backend Pods?', options: ['kubectl describe service', 'kubectl get endpoints', 'kubectl get pods --show-labels'], correct: 1, explanation: '`kubectl get endpoints` shows the IPs behind a service. Empty or `<none>` means the selector matches nothing — this is your diagnosis confirmation.' },
      { id: 'q3', prompt: 'Safest way to update a Service selector without full YAML rewrite?', options: ['kubectl edit service', 'kubectl patch svc <name> -p with JSON merge', 'kubectl delete and recreate'], correct: 1, explanation: '`kubectl patch` applies a targeted JSON merge, changing only the specified fields. Safer than `kubectl edit` for scripted fixes and exam conditions.' },
    ],
    docs: [
      { label: 'Kubernetes: Service', url: 'https://kubernetes.io/docs/concepts/services-networking/service/' },
      { label: 'Kubernetes: Labels and Selectors', url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/' },
    ],
    envValues: [
      'APP_LABEL=api-server',
      'SERVICE_SELECTOR=app=api-server',
      'NAMESPACE=production',
    ],
    prompt: 'Practice: api-service has empty endpoints because selector is wrong.',
    timeLimit: 420,
    checkpoints: [
      {
        id: 'svc',
        hint: 'Inspect service: kubectl get svc -n production',
        test: (c) => c.startsWith('kubectl get svc') || c.startsWith('kubectl get service'),
        success: 'Checkpoint 1/3: Service object inspected.',
      },
      {
        id: 'ep',
        hint: 'Verify endpoint emptiness: kubectl get endpoints -n production',
        test: (c) => c.startsWith('kubectl get endpoints') || c.startsWith('kubectl get ep'),
        success: 'Checkpoint 2/3: Endpoints are empty due to selector mismatch.',
      },
      {
        id: 'patch',
        hint: 'Fix selector: kubectl patch svc api-service -n production -p "{\"spec\":{\"selector\":{\"app\":\"api-server\"}}}"',
        test: (c) => c.includes('patch svc api-service') && c.includes('api-server'),
        success: 'Checkpoint 3/3: Selector fixed, endpoints repopulated.',
      },
    ],
  },
  {
    id: 3,
    track: 'foundation',
    domain: 'Workloads and Scheduling',
    title: 'Lesson 3: Resource Limits and OOMKilled',
    objective: 'Set sane resource limits to stabilize workloads.',
    brief: "The data-processor keeps dying. Status: OOMKilled. It consumes all available node memory and the Linux kernel terminates it with zero warning. No crash log. No graceful exit. Without limits, one greedy workload can starve every other pod on the same node — taking down unrelated services in a cascade you didn't cause but have to fix.",
    philosophy: "Resource limits are not optional configuration — they are the contract between your workload and the cluster. Every pod that runs without limits is a loaded gun pointed at your neighbors.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | Broken workload: data-processor-7c4d2a (OOMKilled, 8 restarts) | Node: node-1 (memory pressure) | No limits set in deployment spec | Other pods at risk: api-server, worker-processor.",
    quiz: [
      { id: 'q1', prompt: 'What does OOMKilled mean?', options: ['The container image was not found', 'The container exceeded its memory limit and the Linux kernel forcefully killed it', 'The pod exceeded its CPU quota'], correct: 1, explanation: 'OOM stands for Out-Of-Memory. When a container uses more memory than its limit (or than the node has available), the Linux kernel OOM killer terminates it instantly with exit code 137.' },
      { id: 'q2', prompt: 'What is the difference between resource requests and limits?', options: ['They are the same thing', 'Requests are the guaranteed minimum used by the scheduler; limits are the enforced maximum', 'Requests are for CPU only; limits are for memory only'], correct: 1, explanation: 'Requests tell the scheduler how much resource to reserve on a node. Limits cap what the container can actually consume. A pod with no limits can burst and kill a node.' },
      { id: 'q3', prompt: 'Command to set resource limits on a running Deployment without rewriting YAML?', options: ['kubectl annotate deployment', 'kubectl set resources deployment/<name> --limits=memory=512Mi,cpu=500m', 'kubectl taint nodes'], correct: 1, explanation: '`kubectl set resources` patches the resource constraints in the Deployment spec and triggers a rolling update, applying limits to new pods immediately.' },
    ],
    docs: [
      { label: 'Kubernetes: Assign Memory Resources', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/' },
      { label: 'Kubernetes: Assign CPU Resources', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/assign-cpu-resource/' },
    ],
    envValues: [
      'LIMIT_MEMORY=512Mi',
      'LIMIT_CPU=500m',
      'REQUEST_MEMORY=256Mi',
    ],
    prompt: 'Practice: data-processor pods are OOMKilled; set deployment limits.',
    timeLimit: 480,
    checkpoints: [
      {
        id: 'top',
        hint: 'Measure usage: kubectl top pods -n production',
        test: (c) => c.startsWith('kubectl top pods'),
        success: 'Checkpoint 1/3: Memory usage observed above safe envelope.',
      },
      {
        id: 'describe',
        hint: 'Confirm OOM cause: kubectl describe pod data-processor-7c4d2a -n production',
        test: (c) => c.startsWith('kubectl describe pod data-processor'),
        success: 'Checkpoint 2/3: OOMKilled verified from pod details.',
      },
      {
        id: 'limit',
        hint: 'Set limits: kubectl set resources deployment/data-processor -n production --limits=memory=512Mi,cpu=500m',
        test: (c) => c.includes('set resources deployment/data-processor') && c.includes('memory=512Mi'),
        success: 'Checkpoint 3/3: Limits applied and workload stabilized.',
      },
    ],
  },
  {
    id: 4,
    track: 'foundation',
    domain: 'Cluster Architecture, Installation and Configuration',
    title: 'Lesson 4: RBAC Basics for CKA',
    objective: 'Grant least-privilege access with Role and RoleBinding.',
    brief: "Your CI pipeline is throwing 403 Forbidden every time it tries to inspect pods. The deploy is stuck. The service account exists — but it has no permissions. Someone deleted the RoleBinding in a cleanup sweep last week and nobody noticed. Security is broken in two directions: no access blocks deployments, too much access creates blast radius. Today you walk the tightrope.",
    philosophy: "Least-privilege is not paranoia — it is engineering discipline. A service account that can only read pods cannot accidentally delete your cluster. Every extra permission you grant is a risk you chose to accept.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | Service Account: ci-bot (exists, no roles bound) | Required: read-only pod access | CI pipeline: blocked at pod inspection step | Security posture: grant minimum viable permissions only.",
    quiz: [
      { id: 'q1', prompt: 'What is the difference between a Role and a ClusterRole?', options: ['Role is for apps; ClusterRole is for admins', 'Role is namespace-scoped; ClusterRole is cluster-wide and can apply to non-namespaced resources', 'ClusterRole is deprecated in favor of Role'], correct: 1, explanation: 'Role grants permissions within one namespace. ClusterRole grants permissions across all namespaces or to cluster-scoped resources like Nodes and PersistentVolumes.' },
      { id: 'q2', prompt: 'What object binds a Role to a subject (user, group, or service account)?', options: ['ServiceAccountBinding', 'RoleBinding', 'PolicyAttachment'], correct: 1, explanation: 'RoleBinding glues together a Role (what permissions) with a Subject (who gets them). Without a RoleBinding, a Role has no effect on anything.' },
      { id: 'q3', prompt: 'Which combination of verbs grants read-only Pod access?', options: ['get, list, watch', 'create, update, delete', 'exec, attach, port-forward'], correct: 0, explanation: 'get, list, and watch are non-destructive. get fetches a single object, list fetches all, and watch streams changes. This triad is the standard read-only permission set.' },
    ],
    docs: [
      { label: 'Kubernetes: RBAC', url: 'https://kubernetes.io/docs/reference/access-authn-authz/rbac/' },
      { label: 'Kubernetes: Service Accounts', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/' },
    ],
    envValues: [
      'SERVICE_ACCOUNT=ci-bot',
      'NAMESPACE=production',
      'ROLE=pod-reader',
    ],
    prompt: 'Practice: grant ci-bot read-only pod access in production.',
    timeLimit: 420,
    checkpoints: [
      {
        id: 'sa',
        hint: 'Create service account: kubectl create sa ci-bot -n production',
        test: (c) => c.includes('create sa ci-bot') || c.includes('create serviceaccount ci-bot'),
        success: 'Checkpoint 1/3: Service account created.',
      },
      {
        id: 'role',
        hint: 'Create role: kubectl create role pod-reader --verb=get,list,watch --resource=pods -n production',
        test: (c) => c.includes('create role pod-reader') && c.includes('pods'),
        success: 'Checkpoint 2/3: Role created with pod read permissions.',
      },
      {
        id: 'bind',
        hint: 'Bind role: kubectl create rolebinding ci-bot-read --role=pod-reader --serviceaccount=production:ci-bot -n production',
        test: (c) => c.includes('create rolebinding') && c.includes('pod-reader') && c.includes('ci-bot'),
        success: 'Checkpoint 3/3: RoleBinding applied. Access chain complete.',
      },
    ],
  },
  {
    id: 5,
    track: 'foundation',
    domain: 'Storage',
    title: 'Lesson 5: Persistent Volumes and Claims',
    objective: 'Validate PVC binding and mount troubleshooting flow.',
    brief: "The postgres pod won't start. Stuck at Pending — not scheduling, not running, just waiting. The PVC exists. The PV exists. Both are in the right namespace. And yet the claim won't bind. Storage in Kubernetes is a matching game: the claim has to agree with the volume on class, access mode, and capacity. One mismatch and data never reaches the pod.",
    philosophy: "Stateful applications are the hardest problems in Kubernetes. Storage failures are quiet — no crash, no log, just a pod that never starts. You have to chase the binding chain manually.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | PVC: data-pvc (Pending) | PV: pv-fast (Available, fast-ssd) | StorageClass: fast-ssd | Dependent workload: postgres pod blocked waiting for volume mount.",
    quiz: [
      { id: 'q1', prompt: 'What status does a PVC show when no matching PersistentVolume exists?', options: ['Bound', 'Pending', 'Failed'], correct: 1, explanation: 'A PVC stays Pending until a compatible PV is found. Compatibility requires matching StorageClass, accessModes, and sufficient capacity. Check all three when debugging.' },
      { id: 'q2', prompt: 'What three things must match between a PVC and PV for binding to succeed?', options: ['Image, namespace, labels', 'StorageClass, accessModes, and capacity', 'Node selector, port, and protocol'], correct: 1, explanation: 'The binding algorithm checks StorageClass name, access mode compatibility (e.g. ReadWriteOnce), and that the PV has >= capacity requested by the PVC.' },
      { id: 'q3', prompt: 'Best command to see why a PVC is not binding?', options: ['kubectl top pvc', 'kubectl describe pvc <name>', 'kubectl get storageclass'], correct: 1, explanation: '`kubectl describe pvc` shows Events — the provisioner logs exactly which condition failed the binding attempt: class mismatch, no available PV, etc.' },
    ],
    docs: [
      { label: 'Kubernetes: Persistent Volumes', url: 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/' },
      { label: 'Kubernetes: Configure a Pod to Use PVC', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-persistent-volume-storage/' },
    ],
    envValues: [
      'PVC_NAME=data-pvc',
      'STORAGE_CLASS=fast-ssd',
      'MOUNT_PATH=/var/lib/app',
    ],
    prompt: 'Practice: diagnose Pending PVC and validate mounted storage.',
    timeLimit: 480,
    checkpoints: [
      {
        id: 'pvc',
        hint: 'Check claims: kubectl get pvc -n production',
        test: (c) => c.startsWith('kubectl get pvc'),
        success: 'Checkpoint 1/3: PVC status inspected.',
      },
      {
        id: 'pv',
        hint: 'Inspect volumes: kubectl get pv',
        test: (c) => c.startsWith('kubectl get pv'),
        success: 'Checkpoint 2/3: PV inventory checked for matching class/capacity.',
      },
      {
        id: 'describe',
        hint: 'Diagnose: kubectl describe pvc data-pvc -n production',
        test: (c) => c.includes('describe pvc data-pvc'),
        success: 'Checkpoint 3/3: PVC events reviewed; binding cause identified.',
      },
    ],
  },
  {
    id: 6,
    track: 'foundation',
    domain: 'Services and Networking',
    title: 'Lesson 6: Ingress and NetworkPolicy',
    objective: 'Verify ingress routing and deny-by-default network controls.',
    brief: "External traffic is reaching the cluster but never hitting the pod. The Ingress rule looks fine on paper. The Service exists. The pods are Running. But requests disappear. There is a NetworkPolicy in place — deny by default with a single allow rule. Something in the chain is wrong. Networking failures are the hardest to see because there are no logs at the drop point.",
    philosophy: "Every layer of network security you add is another place traffic can silently die. Verify each hop: Ingress → Service → Endpoint → Pod → NetworkPolicy. Trust nothing until you see it with kubectl.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | Ingress: api (host: api.kubecrash.local) | Service: api-service:80 | NetworkPolicy: api-deny-default (allows monitoring namespace only) | Problem: traffic not arriving at pod despite healthy workload.",
    quiz: [
      { id: 'q1', prompt: 'What Kubernetes object routes external HTTP/HTTPS traffic to Services?', options: ['LoadBalancer Service', 'Ingress', 'NodePort'], correct: 1, explanation: 'Ingress is a layer 7 routing resource — it handles host-based and path-based routing of HTTP traffic. It requires an Ingress Controller (nginx, traefik, etc.) to be installed.' },
      { id: 'q2', prompt: 'What is the default NetworkPolicy behavior when NO policy exists in a namespace?', options: ['All traffic is blocked', 'All traffic is allowed', 'Only same-namespace traffic is allowed'], correct: 1, explanation: 'Without any NetworkPolicy, Kubernetes allows all pod-to-pod and ingress traffic. Policies are additive — applying even one deny-all policy starts restricting traffic.' },
      { id: 'q3', prompt: 'A NetworkPolicy with an empty ingress[] field means?', options: ['All ingress traffic is allowed', 'All ingress traffic to selected pods is denied', 'Only egress is controlled'], correct: 1, explanation: 'An empty `ingress: []` is a full deny for inbound traffic. This is the standard deny-all base policy. Any allowed traffic requires explicit ingress rules.' },
    ],
    docs: [
      { label: 'Kubernetes: Ingress', url: 'https://kubernetes.io/docs/concepts/services-networking/ingress/' },
      { label: 'Kubernetes: Network Policies', url: 'https://kubernetes.io/docs/concepts/services-networking/network-policies/' },
    ],
    envValues: [
      'INGRESS_HOST=api.kubecrash.local',
      'SERVICE_PORT=80',
      'ALLOWED_NS=monitoring',
    ],
    prompt: 'Practice: isolate API traffic with ingress + network policy checks.',
    timeLimit: 480,
    checkpoints: [
      {
        id: 'ingress',
        hint: 'Review ingress: kubectl get ingress -n production',
        test: (c) => c.startsWith('kubectl get ingress'),
        success: 'Checkpoint 1/3: Ingress object inspected.',
      },
      {
        id: 'svc',
        hint: 'Confirm backend service: kubectl get svc api-service -n production',
        test: (c) => c.includes('get svc api-service'),
        success: 'Checkpoint 2/3: Service backend verified.',
      },
      {
        id: 'np',
        hint: 'Validate policy: kubectl describe networkpolicy api-deny-default -n production',
        test: (c) => c.includes('describe networkpolicy') || c.includes('describe netpol'),
        success: 'Checkpoint 3/3: Policy rules reviewed against expected allowed sources.',
      },
    ],
  },
  {
    id: 7,
    track: 'intermediate',
    domain: 'Workloads and Scheduling',
    title: 'Lesson 7: Taints, Tolerations, and Node Fit',
    objective: 'Control pod placement during capacity incidents.',
    brief: "The batch-worker pods refuse to schedule. Not crashing — just Pending forever. node-3 is reserved for heavy batch workloads and carries a taint: `dedicated=batch:NoSchedule`. Without a matching toleration in the pod spec, the scheduler treats that node as invisible. Capacity exists but the scheduler can't see it. You are the bridge between the machine and the policy.",
    philosophy: "Kubernetes scheduling is a negotiation. Taints repel. Tolerations forgive. Node affinity attracts. Know which to use and when — because when capacity is tight, the difference between 'Pending' and 'Running' is one annotation.",
    clusterOverview: "Cluster: kubecrash-lab | Nodes: control-plane (Ready), node-1 (Ready, full), node-2 (Ready, full), node-3 (Ready, tainted: dedicated=batch:NoSchedule) | Pending workload: batch-worker pods | Fix: apply taint to node-3 and add toleration to pod spec.",
    quiz: [
      { id: 'q1', prompt: 'What does a NoSchedule taint effect do?', options: ['Evicts pods that are already running on the node', 'Prevents new pods without a matching toleration from being scheduled on the node', 'Marks the node as offline'], correct: 1, explanation: 'NoSchedule prevents pods from being placed on the node unless they declare a matching toleration. Existing pods already on the node are not affected.' },
      { id: 'q2', prompt: 'How do you remove a taint from a node?', options: ['kubectl untaint nodes <node> key', 'kubectl taint nodes <node> key:effect- (with trailing dash)', 'kubectl annotate nodes <node> taint-'], correct: 1, explanation: 'The trailing minus (`-`) is the remove operator in kubectl taint syntax. Example: `kubectl taint nodes node-3 dedicated:NoSchedule-` removes that specific taint.' },
      { id: 'q3', prompt: 'What is the key difference between taints/tolerations and nodeAffinity?', options: ['Taints are for CPU; nodeAffinity is for memory', 'Taints repel pods from nodes; nodeAffinity attracts pods toward specific nodes', 'They are identical in behavior'], correct: 1, explanation: 'Taints are set on nodes to push away unwanted pods. nodeAffinity is set on pods to pull them toward preferred nodes. They are complementary mechanisms for precise scheduling control.' },
    ],
    docs: [
      { label: 'Taints and Tolerations', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/' },
      { label: 'Assign Pods to Nodes', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/' },
    ],
    envValues: ['NODE_ROLE=worker', 'TAINT_KEY=dedicated', 'TAINT_EFFECT=NoSchedule'],
    prompt: 'Practice: isolate workload onto dedicated nodes using taints/tolerations.',
    timeLimit: 480,
    checkpoints: [
      { id: 'nodes', hint: 'Inspect nodes: kubectl get nodes', test: (c) => c.startsWith('kubectl get nodes'), success: 'Checkpoint 1/3: Node landscape reviewed.' },
      { id: 'taint', hint: 'Apply taint: kubectl taint nodes node-3 dedicated=batch:NoSchedule', test: (c) => c.includes('taint nodes') && c.includes('NoSchedule'), success: 'Checkpoint 2/3: Taint applied to target node.' },
      { id: 'verify', hint: 'Verify placement: kubectl describe pod batch-worker-0 -n production', test: (c) => c.includes('describe pod batch-worker-0'), success: 'Checkpoint 3/3: Scheduling policy validated.' },
    ],
  },
  {
    id: 8,
    track: 'intermediate',
    domain: 'Workloads and Scheduling',
    title: 'Lesson 8: Rollout Strategy and Rollback Safety',
    objective: 'Use rollout history/status/undo to recover safely.',
    brief: "v2.3.1 just deployed. Within 60 seconds, error rates spike to 40%. The new container image has a startup race condition — it works in staging but not under production load. Every second of delay costs transactions. You need to inspect the rollout history, confirm the bad revision, and undo it with surgical precision. The old version is intact in etcd. You just have to ask for it back.",
    philosophy: "Deployments are not one-way doors. Rollback is not failure — it is a deliberate, professional response to a bad signal. The engineer who reverts fast minimizes damage. The one who hesitates turns an incident into an outage.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | Deployment: api (revision 2 live, broken) | Revision 1: stable v2.2.0 | Current error rate: 40% 5xx | Rollout strategy: RollingUpdate | Your goal: verify history, check status, execute rollback.",
    quiz: [
      { id: 'q1', prompt: 'Command to view the revision history of a Deployment?', options: ['kubectl get deployment --history', 'kubectl rollout history deployment/<name>', 'kubectl describe deployment | grep revision'], correct: 1, explanation: '`kubectl rollout history` lists all stored revisions with change-cause annotations. Use `--revision=N` to inspect what changed in a specific revision.' },
      { id: 'q2', prompt: 'How do you roll back a Deployment to the previous revision?', options: ['kubectl revert deployment/<name>', 'kubectl rollout undo deployment/<name>', 'kubectl apply -f previous.yaml'], correct: 1, explanation: '`kubectl rollout undo` restores the previous revision instantly. Kubernetes updates the pod template and triggers a new rolling update to the old version.' },
      { id: 'q3', prompt: 'Which rolling update parameters control how many pods can be unavailable during a deployment?', options: ['minReadySeconds and progressDeadlineSeconds', 'maxSurge and maxUnavailable', 'replicas and revisionHistoryLimit'], correct: 1, explanation: 'maxUnavailable caps how many pods can be down at once. maxSurge allows temporary overage above desired replicas. Tuning these controls the speed and safety of each rollout.' },
    ],
    docs: [
      { label: 'Deployments', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/' },
    ],
    envValues: ['IMAGE_TAG=v2.3.1', 'REVISION=2'],
    prompt: 'Practice: detect bad rollout and revert fast.',
    timeLimit: 420,
    checkpoints: [
      { id: 'history', hint: 'Review revisions: kubectl rollout history deployment/api -n production', test: (c) => c.includes('rollout history deployment/api'), success: 'Checkpoint 1/3: Deployment history inspected.' },
      { id: 'status', hint: 'Check rollout: kubectl rollout status deployment/api -n production', test: (c) => c.includes('rollout status deployment/api'), success: 'Checkpoint 2/3: Rollout status confirmed unhealthy.' },
      { id: 'undo', hint: 'Rollback: kubectl rollout undo deployment/api -n production', test: (c) => c.includes('rollout undo deployment/api'), success: 'Checkpoint 3/3: Rollback executed.' },
    ],
  },
  {
    id: 9,
    track: 'intermediate',
    domain: 'Cluster Architecture, Installation and Configuration',
    title: 'Lesson 9: ConfigMaps and Secret Wiring',
    objective: 'Inject config and secrets reliably into workloads.',
    brief: "The api-server started and is Running — but it is behaving like it's in staging. Wrong feature flags. Wrong log level. The deployment spec references a ConfigMap that was updated to v3, but the pods were not restarted. Config is code. Untested config changes and missed restarts are responsible for more silent production degradations than most teams admit.",
    philosophy: "A ConfigMap that is mounted but stale is worse than no ConfigMap — the app runs confidently on wrong config. Understand how Kubernetes wires config into pods before you trust any running workload to have the right values.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | ConfigMap: api-config (v3) | Secret: api-secret (API token) | Deployment: api-server (still running v2 config) | Problem: envFrom not picking up new ConfigMap values until pod restart.",
    quiz: [
      { id: 'q1', prompt: 'Key difference between ConfigMap and Secret?', options: ['ConfigMap is cluster-scoped; Secret is namespace-scoped', 'Secrets are base64-encoded and meant for sensitive data; ConfigMaps store plaintext non-sensitive config', 'There is no functional difference'], correct: 1, explanation: 'ConfigMaps are for plain configuration data. Secrets encode values in base64 (not encryption — just encoding). For true security, combine Secrets with encryption at rest and RBAC restrictions.' },
      { id: 'q2', prompt: 'Two supported ways to inject a ConfigMap into a pod?', options: ['envFrom for env vars; volumeMount for file-based config', 'kubectl inject and kubectl mount', 'annotations and labels'], correct: 0, explanation: 'envFrom loads all ConfigMap keys as environment variables. Volume mounts expose ConfigMap keys as individual files. File-based config is better for dynamic reload without pod restart.' },
      { id: 'q3', prompt: 'If you update a ConfigMap, do running pods using envFrom automatically see the new values?', options: ['Yes, immediately', 'Only after pod restart', 'Only if the ConfigMap version label is changed'], correct: 1, explanation: 'Environment variables are injected at pod start time. To pick up ConfigMap changes via envFrom, you must restart the pod. Volume-mounted ConfigMaps update eventually (via kubelet sync) without restart.' },
    ],
    docs: [
      { label: 'ConfigMaps', url: 'https://kubernetes.io/docs/concepts/configuration/configmap/' },
      { label: 'Secrets', url: 'https://kubernetes.io/docs/concepts/configuration/secret/' },
    ],
    envValues: ['APP_MODE=production', 'API_TOKEN=***', 'CONFIG_VERSION=v3'],
    prompt: 'Practice: wire config and secret refs for api-server.',
    timeLimit: 480,
    checkpoints: [
      { id: 'cm', hint: 'Inspect configmap: kubectl get configmap api-config -n production -o yaml', test: (c) => c.includes('get configmap api-config'), success: 'Checkpoint 1/3: ConfigMap content reviewed.' },
      { id: 'secret', hint: 'Inspect secret refs: kubectl describe secret api-secret -n production', test: (c) => c.includes('describe secret api-secret'), success: 'Checkpoint 2/3: Secret reference checked.' },
      { id: 'env', hint: 'Patch envFrom/env: kubectl set env deployment/api-server CONFIG_VERSION=v3 -n production', test: (c) => c.includes('set env deployment/api-server') && c.includes('CONFIG_VERSION=v3'), success: 'Checkpoint 3/3: Config wiring updated.' },
    ],
  },
  {
    id: 10,
    track: 'intermediate',
    domain: 'Storage',
    title: 'Lesson 10: StatefulSet Storage Recovery',
    objective: 'Troubleshoot StatefulSet PVC attachment and readiness.',
    brief: "postgres-0 is stuck in ContainerCreating. The StatefulSet exists. The PVC exists. The PV is bound. But the pod just hangs. The previous node it was on went into NotReady state overnight and the volume detach did not complete cleanly. Data is safe — but the pod cannot attach to it from the new node. Stateful recovery requires patience, evidence, and knowing exactly which event to look for.",
    philosophy: "StatefulSets are the hardest thing in Kubernetes to debug because failure is silent and the fix is often counter-intuitive. The pod waits for its PVC. The PVC waits for the node. The node is gone. You have to understand the chain to break it.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | StatefulSet: postgres (1 replica) | Pod: postgres-0 (ContainerCreating) | PVC: data-postgres-0 (Bound) | Problem: volume attachment stuck after node-2 went NotReady | Data: intact on PV.",
    quiz: [
      { id: 'q1', prompt: 'How does a StatefulSet handle storage differently from a Deployment?', options: ['StatefulSet shares one PVC across all pods', 'Each StatefulSet pod gets its own dedicated PVC via volumeClaimTemplates', 'StatefulSets do not support persistent storage'], correct: 1, explanation: 'volumeClaimTemplates create a unique PVC per pod replica. Pod 0 gets data-podname-0, pod 1 gets data-podname-1. This ensures each stateful replica has its own isolated storage.' },
      { id: 'q2', prompt: 'What happens to StatefulSet PVCs when you delete the StatefulSet?', options: ['PVCs are deleted automatically', 'PVCs are NOT deleted — data persists and must be deleted manually', 'PVCs are moved to the default namespace'], correct: 1, explanation: 'This is a critical safety feature. PVCs created by volumeClaimTemplates survive StatefulSet deletion to prevent accidental data loss. Clean them up intentionally.' },
      { id: 'q3', prompt: 'Why would a StatefulSet pod be stuck in ContainerCreating?', options: ['The container image is too large', 'Volume attachment failed — often because the previous node is unhealthy or detach did not complete', 'The pod security policy blocked execution'], correct: 1, explanation: 'Volume attachment is node-bound. If a pod was on node-A and that node is unhealthy, the volume cannot detach and re-attach to node-B until the old node is confirmed removed or the attachment manually released.' },
    ],
    docs: [
      { label: 'StatefulSets', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/' },
      { label: 'Persistent Volumes', url: 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/' },
    ],
    envValues: ['CLAIM_TEMPLATE=data', 'ACCESS_MODE=ReadWriteOnce'],
    prompt: 'Practice: recover stateful pod stuck during volume attach.',
    timeLimit: 540,
    checkpoints: [
      { id: 'sts', hint: 'Inspect statefulset: kubectl get sts -n production', test: (c) => c.startsWith('kubectl get sts'), success: 'Checkpoint 1/3: StatefulSet state reviewed.' },
      { id: 'pvc', hint: 'Inspect bound claims: kubectl get pvc -n production', test: (c) => c.startsWith('kubectl get pvc'), success: 'Checkpoint 2/3: PVC attachment path checked.' },
      { id: 'pod', hint: 'Inspect pod events: kubectl describe pod postgres-0 -n production', test: (c) => c.includes('describe pod postgres-0'), success: 'Checkpoint 3/3: Pod-volume events analyzed.' },
    ],
  },
  {
    id: 11,
    track: 'intermediate',
    domain: 'Services and Networking',
    title: 'Lesson 11: CoreDNS and Service Discovery',
    objective: 'Debug in-cluster DNS resolution failures.',
    brief: "A microservice cannot reach the database by name. The URL is `api-service.production.svc.cluster.local` — it works on every other cluster. Here it returns NXDOMAIN. DNS is the nervous system of the cluster. When CoreDNS is down or misconfigured, every inter-service call collapses in silence. There are no application errors — just timeouts, retries, and cascading failures nobody can explain.",
    philosophy: "In-cluster DNS is invisible until it breaks. Every service URL that works is CoreDNS quietly resolving it. Build the habit of verifying DNS as the first networking hypothesis — not the last.",
    clusterOverview: "Cluster: kubecrash-lab | kube-system: CoreDNS pods (should be 2 replicas) | Namespace: production | Service: api-service (ClusterIP) | Problem: nslookup returns NXDOMAIN for api-service.production.svc.cluster.local | Possible causes: CoreDNS crash, kube-dns service misconfigured.",
    quiz: [
      { id: 'q1', prompt: 'What is the full in-cluster DNS name format for a Service?', options: ['<service>.<namespace>.cluster.local', '<service>.<namespace>.svc.cluster.local', '<namespace>.<service>.pod.cluster.local'], correct: 1, explanation: 'The canonical FQDN is `<service-name>.<namespace>.svc.cluster.local`. The `.svc` segment is required. Short names like `api-service` also work within the same namespace via the search domain.' },
      { id: 'q2', prompt: 'Which namespace do CoreDNS pods run in?', options: ['default', 'kube-system', 'kube-dns'], correct: 1, explanation: 'CoreDNS is a system component and runs in `kube-system`. The associated Service is named `kube-dns`. Both must be healthy for in-cluster DNS to work.' },
      { id: 'q3', prompt: 'Which command inside a debug pod tests DNS resolution?', options: ['dig or nslookup', 'kubectl resolve', 'curl --dns'], correct: 0, explanation: '`nslookup <service-fqdn>` or `dig <service-fqdn>` executed inside a pod confirms whether DNS resolution works from within the cluster network. Use `kubectl run -it --image=busybox` for a quick debug pod.' },
    ],
    docs: [
      { label: 'DNS for Services and Pods', url: 'https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/' },
    ],
    envValues: ['DNS_NAME=api-service.production.svc.cluster.local'],
    prompt: 'Practice: trace service discovery issue via DNS checks.',
    timeLimit: 420,
    checkpoints: [
      { id: 'coredns', hint: 'Check coredns pods: kubectl get pods -n kube-system -l k8s-app=kube-dns', test: (c) => c.includes('get pods -n kube-system') && c.includes('kube-dns'), success: 'Checkpoint 1/3: CoreDNS health checked.' },
      { id: 'svc', hint: 'Check kube-dns svc: kubectl get svc -n kube-system kube-dns', test: (c) => c.includes('get svc -n kube-system kube-dns'), success: 'Checkpoint 2/3: DNS service endpoint verified.' },
      { id: 'resolve', hint: 'Validate name: kubectl exec -n production dnsutils -- nslookup api-service.production.svc.cluster.local', test: (c) => c.includes('nslookup') && c.includes('api-service.production.svc.cluster.local'), success: 'Checkpoint 3/3: DNS resolution workflow executed.' },
    ],
  },
  {
    id: 12,
    track: 'intermediate',
    domain: 'Troubleshooting',
    title: 'Lesson 12: Control Plane Symptom Triage',
    objective: 'Interpret cluster-wide errors and isolate control-plane symptoms.',
    brief: "kubectl is slow. Pods are taking 90 seconds to schedule instead of 2. `kubectl get nodes` hangs for 30 seconds before responding. Something in the control plane is struggling — not dead, just degraded. This is the most dangerous state in Kubernetes: partially working. Applications appear fine until they don't. You need to triage at the cluster level: events → components → node conditions.",
    philosophy: "Control plane health is the foundation everything else rests on. An API server under load, an etcd with disk pressure, a scheduler with backlog — these degrade the entire cluster invisibly. Learn to read the symptoms before the cluster stops responding.",
    clusterOverview: "Cluster: kubecrash-lab | Node: control-plane (Ready but degraded) | kube-system pods: kube-apiserver, etcd, kube-scheduler, kube-controller-manager | Symptoms: slow kubectl responses, scheduling delays, burst of Warning events | Your goal: triage without causing additional disruption.",
    quiz: [
      { id: 'q1', prompt: 'Best command to see all cluster-wide events sorted by most recent?', options: ['kubectl get events --all-namespaces', 'kubectl get events -A --sort-by=.lastTimestamp', 'kubectl describe cluster'], correct: 1, explanation: '`kubectl get events -A --sort-by=.lastTimestamp` gives a timeline across all namespaces. This is typically your first command in any cluster-wide incident triage.' },
      { id: 'q2', prompt: 'Which namespace hosts all core control-plane component pods?', options: ['default', 'cluster-system', 'kube-system'], correct: 2, explanation: 'kube-system hosts the API server, etcd, scheduler, controller-manager, CoreDNS, and kube-proxy. Any pod failure here affects the entire cluster.' },
      { id: 'q3', prompt: 'What does `kubectl describe node` reveal about node health?', options: ['Only CPU and memory utilization', 'Conditions (MemoryPressure, DiskPressure, Ready), allocated resources, and recent events', 'Only running pod names'], correct: 1, explanation: 'Node Conditions are the health signal. MemoryPressure and DiskPressure are pre-failure warnings. A NotReady condition means the kubelet has lost contact with the API server.' },
    ],
    docs: [
      { label: 'Troubleshoot Clusters', url: 'https://kubernetes.io/docs/tasks/debug/debug-cluster/' },
    ],
    envValues: ['COMPONENT=kube-apiserver', 'NODE=control-plane'],
    prompt: 'Practice: triage API latency and node event spikes.',
    timeLimit: 480,
    checkpoints: [
      { id: 'events', hint: 'Check events: kubectl get events -A --sort-by=.lastTimestamp', test: (c) => c.includes('get events -A'), success: 'Checkpoint 1/3: Cluster event stream reviewed.' },
      { id: 'component', hint: 'Check control plane pods: kubectl get pods -n kube-system', test: (c) => c.includes('get pods -n kube-system'), success: 'Checkpoint 2/3: Control-plane pod status inspected.' },
      { id: 'node', hint: 'Check node conditions: kubectl describe node control-plane', test: (c) => c.includes('describe node control-plane'), success: 'Checkpoint 3/3: Node/control-plane symptom path narrowed.' },
    ],
  },
  {
    id: 13,
    track: 'intermediate',
    domain: 'Cluster Architecture, Installation and Configuration',
    title: 'Lesson 13: Cluster Upgrade Pre-Checks',
    objective: 'Run safe pre-upgrade checks for workloads and node readiness.',
    brief: "A cluster upgrade is scheduled for tonight. But teams have upgraded blindly before and killed running workloads. PodDisruptionBudgets exist for a reason — they block drains if minimum availability cannot be maintained. You need to verify current version skew, confirm all nodes are healthy, and map every PDB that could block the drain process. No surprises at 2 AM.",
    philosophy: "An upgrade without pre-checks is a gamble. An upgrade with pre-checks is engineering. The 30 minutes you spend verifying node readiness and PDB constraints will save you from a midnight rollback.",
    clusterOverview: "Cluster: kubecrash-lab | Current version: v1.29.x | Target: v1.30.x | Nodes: 3 (all Ready) | PodDisruptionBudgets: present in production namespace | Upgrade window: tonight 02:00 UTC | Risk: drain blockers, version skew issues.",
    quiz: [
      { id: 'q1', prompt: 'Why must you check PodDisruptionBudgets before a cluster upgrade?', options: ['PDBs control resource limits during upgrades', 'PDBs can block node drains if minimum availability requirements cannot be met', 'PDBs prevent kubeadm from running'], correct: 1, explanation: 'If a PDB requires minimum 2 replicas and only 2 exist, draining any node will violate the PDB and the drain will block or fail. Identify and plan around PDBs before touching nodes.' },
      { id: 'q2', prompt: 'What is the correct kubeadm upgrade order?', options: ['Worker nodes first, then control plane', 'Control plane first, then worker nodes one at a time', 'Upgrade all nodes simultaneously'], correct: 1, explanation: 'Control plane must be upgraded first to the new version. Kubelets and worker nodes can remain on the previous minor version (N-1) during the upgrade window, then upgraded sequentially.' },
      { id: 'q3', prompt: 'What does `kubectl drain` do during node maintenance?', options: ['Upgrades the kubelet on the node', 'Cordons the node and evicts all pods except DaemonSets', 'Resets the node to factory settings'], correct: 1, explanation: 'Drain = cordon (no new scheduling) + evict (move existing pods). DaemonSet pods are skipped by default unless `--ignore-daemonsets` is set. Use `--delete-emptydir-data` for pods using emptyDir volumes.' },
    ],
    docs: [
      { label: 'Upgrade kubeadm clusters', url: 'https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/' },
    ],
    envValues: ['TARGET_VERSION=v1.30.x', 'MAX_UNAVAILABLE=1'],
    prompt: 'Practice: execute pre-upgrade readiness checklist.',
    timeLimit: 420,
    checkpoints: [
      { id: 'versions', hint: 'Check versions: kubectl version --short', test: (c) => c.includes('kubectl version'), success: 'Checkpoint 1/3: Current cluster versions captured.' },
      { id: 'nodes', hint: 'Check nodes: kubectl get nodes', test: (c) => c.startsWith('kubectl get nodes'), success: 'Checkpoint 2/3: Node readiness confirmed.' },
      { id: 'pdb', hint: 'Check disruption budgets: kubectl get pdb -A', test: (c) => c.includes('get pdb -A'), success: 'Checkpoint 3/3: Upgrade disruption risk evaluated.' },
    ],
  },
  {
    id: 14,
    track: 'intermediate',
    domain: 'Services and Networking',
    title: 'Lesson 14: Ingress TLS and Cert Rotation',
    objective: 'Verify TLS secret wiring and ingress certificate rotation.',
    brief: "HTTPS is broken. Users see certificate warnings. The cert expired six days ago and nobody noticed because the monitoring alert was set to the wrong secret name. The TLS secret referenced in the Ingress either expired or has a mismatched CN. You need to trace the exact broken link: ingress TLS reference → secret → cert data → apply fix. Every minute HTTPS is down, users see security warnings and trust erodes.",
    philosophy: "TLS failures are highly visible to end users and invisible in application logs. Certificate expiry has an exact timestamp — it will always fail exactly when it says it will. Building the muscle to verify TLS chain manually is non-negotiable for production readiness.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | Ingress: api (host: api.kubecrash.local, TLS enabled) | Secret: api-tls (expired 6 days ago) | Problem: cert CN mismatch or expiry | Fix: apply updated TLS secret via ingress-api.yaml manifest.",
    quiz: [
      { id: 'q1', prompt: 'In an Ingress manifest, where is the TLS certificate referenced?', options: ['In metadata.annotations', 'In spec.tls[].secretName pointing to a TLS-type Secret', 'In spec.rules[].http.paths[].backend'], correct: 1, explanation: '`spec.tls[].secretName` maps a hostname to a TLS Secret containing `tls.crt` and `tls.key`. The Ingress controller reads this Secret to terminate HTTPS.' },
      { id: 'q2', prompt: 'What two data keys must a TLS-type Secret contain?', options: ['ca.crt and ca.key', 'tls.crt and tls.key', 'cert.pem and key.pem'], correct: 1, explanation: 'A Kubernetes TLS Secret must have exactly `tls.crt` (the certificate chain, base64-encoded) and `tls.key` (the private key, base64-encoded). Wrong key names mean the Ingress controller silently ignores the secret.' },
      { id: 'q3', prompt: 'Safest way to update a TLS secret in-place without downtime?', options: ['kubectl delete secret then recreate', 'kubectl create secret tls --dry-run=client -o yaml | kubectl apply -f -', 'kubectl edit secret and manually enter base64'], correct: 1, explanation: 'The dry-run+apply pattern generates a valid Secret manifest without touching the cluster, then applies it declaratively. This avoids the gap that delete+create creates and prevents operator errors from manual base64 encoding.' },
    ],
    docs: [
      { label: 'TLS in Ingress', url: 'https://kubernetes.io/docs/concepts/services-networking/ingress/#tls' },
      { label: 'Manage TLS Certificates in a Cluster', url: 'https://kubernetes.io/docs/tasks/tls/managing-tls-in-a-cluster/' },
    ],
    envValues: ['TLS_SECRET=api-tls', 'HOST=api.kubecrash.local'],
    prompt: 'Practice: restore ingress HTTPS after certificate mismatch.',
    timeLimit: 480,
    checkpoints: [
      { id: 'ing', hint: 'Inspect ingress TLS: kubectl describe ingress api -n production', test: (c) => c.includes('describe ingress api'), success: 'Checkpoint 1/3: Ingress TLS config reviewed.' },
      { id: 'secret', hint: 'Inspect cert secret: kubectl describe secret api-tls -n production', test: (c) => c.includes('describe secret api-tls'), success: 'Checkpoint 2/3: TLS secret details validated.' },
      { id: 'apply', hint: 'Apply updated manifest: kubectl apply -f ingress-api.yaml -n production', test: (c) => c.includes('apply -f') && c.includes('ingress-api.yaml'), success: 'Checkpoint 3/3: TLS config rollout initiated.' },
    ],
  },
]

const MOCKS = [
  {
    id: 'mock-1',
    domain: 'Troubleshooting + Services and Networking',
    title: 'Mini-Mock A: App Recovery Sprint',
    scenario: 'You are on-call. API is down from CrashLoopBackOff and service endpoint mismatch.',
    timeLimit: 600,
    docs: [
      { label: 'Debug Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/' },
      { label: 'Services', url: 'https://kubernetes.io/docs/concepts/services-networking/service/' },
    ],
    envValues: [
      'DATABASE_URL=postgres://db:5432/prod',
      'SERVICE_SELECTOR=app=api-server',
    ],
    checkpoints: [
      {
        id: 'pods',
        test: (c) => c.startsWith('kubectl get pods'),
        explanation: 'Checkpoint: you established blast radius by inspecting pod status.',
      },
      {
        id: 'logs',
        test: (c) => c.startsWith('kubectl logs api-server'),
        explanation: 'Checkpoint: logs confirmed env misconfiguration.',
      },
      {
        id: 'setenv',
        test: (c) => c.includes('set env deployment/api-server') && c.includes('DATABASE_URL=postgres://db:5432/prod'),
        explanation: 'Checkpoint: env repair command issued with production-safe value.',
      },
      {
        id: 'ep',
        test: (c) => c.startsWith('kubectl get endpoints') || c.startsWith('kubectl get ep'),
        explanation: 'Checkpoint: endpoint check validated service-to-pod routing.',
      },
      {
        id: 'patch',
        test: (c) => c.includes('patch svc api-service') && c.includes('api-server'),
        explanation: 'Checkpoint: selector corrected; traffic path restored.',
      },
    ],
  },
  {
    id: 'mock-2',
    domain: 'Workloads and Scheduling + Troubleshooting',
    title: 'Mini-Mock B: Node and Resource Stability',
    scenario: 'Pods are OOMKilled and one worker node is NotReady during business hours.',
    timeLimit: 660,
    docs: [
      { label: 'Assign Memory Resources', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/' },
      { label: 'Safely Drain a Node', url: 'https://kubernetes.io/docs/tasks/administer-cluster/safely-drain-node/' },
    ],
    envValues: [
      'LIMIT_MEMORY=512Mi',
      'LIMIT_CPU=500m',
      'DRAIN_FLAGS=--ignore-daemonsets --delete-emptydir-data',
    ],
    checkpoints: [
      {
        id: 'top',
        test: (c) => c.startsWith('kubectl top pods'),
        explanation: 'Checkpoint: usage evidence collected before remediation.',
      },
      {
        id: 'limits',
        test: (c) => c.includes('set resources deployment/data-processor') && c.includes('memory=512Mi'),
        explanation: 'Checkpoint: resource ceilings configured to stop OOM churn.',
      },
      {
        id: 'nodes',
        test: (c) => c.startsWith('kubectl get nodes'),
        explanation: 'Checkpoint: node health snapshot captured.',
      },
      {
        id: 'cordon',
        test: (c) => c.startsWith('kubectl cordon node-2'),
        explanation: 'Checkpoint: scheduling halted on unhealthy node.',
      },
      {
        id: 'drain',
        test: (c) => c.startsWith('kubectl drain node-2'),
        explanation: 'Checkpoint: pods evacuated and maintenance pattern followed.',
      },
      {
        id: 'uncordon',
        test: (c) => c.startsWith('kubectl uncordon node-2'),
        explanation: 'Checkpoint: node returned to service after recovery.',
      },
    ],
  },
  {
    id: 'mock-3',
    domain: 'All CKA Blueprint Domains',
    title: 'Mini-Mock C: CKA Blueprint Sprint',
    scenario: 'Mixed-domain rapid response simulation across all CKA blueprint areas.',
    timeLimit: 900,
    docs: [
      { label: 'CKA Candidate Handbook', url: 'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/' },
      { label: 'kubectl Cheat Sheet', url: 'https://kubernetes.io/docs/reference/kubectl/cheatsheet/' },
    ],
    envValues: [
      'DATABASE_URL=postgres://db:5432/prod',
      'LIMIT_MEMORY=512Mi',
      'SERVICE_SELECTOR=app=api-server',
    ],
    checkpoints: [
      {
        id: 'cka-pods',
        hint: 'Troubleshooting: kubectl get pods -n production',
        test: (c) => c.startsWith('kubectl get pods'),
        explanation: 'Blueprint/Troubleshooting: inventory and symptom confirmation.',
      },
      {
        id: 'cka-rbac',
        hint: 'Architecture/AuthZ: kubectl create role pod-reader --verb=get,list,watch --resource=pods -n production',
        test: (c) => c.includes('create role pod-reader') && c.includes('pods'),
        explanation: 'Blueprint/Architecture: least-privilege RBAC setup.',
      },
      {
        id: 'cka-resources',
        hint: 'Workloads: kubectl set resources deployment/data-processor -n production --limits=memory=512Mi,cpu=500m',
        test: (c) => c.includes('set resources deployment/data-processor') && c.includes('memory=512Mi'),
        explanation: 'Blueprint/Workloads: enforce scheduling and stability constraints.',
      },
      {
        id: 'cka-network',
        hint: 'Services/Networking: kubectl patch svc api-service -n production -p "{\"spec\":{\"selector\":{\"app\":\"api-server\"}}}"',
        test: (c) => c.includes('patch svc api-service') && c.includes('api-server'),
        explanation: 'Blueprint/Networking: restore service routing path.',
      },
      {
        id: 'cka-storage',
        hint: 'Storage: kubectl describe pvc data-pvc -n production',
        test: (c) => c.includes('describe pvc data-pvc'),
        explanation: 'Blueprint/Storage: diagnose claim-binding blockers.',
      },
    ],
  },
  {
    id: 'mock-full',
    domain: 'All CKA Blueprint Domains (Weighted)',
    title: 'CKA Full Mock: 120m Weighted Exam',
    scenario: 'Full exam-style sequence with weighted checkpoints across all domains.',
    timeLimit: 7200,
    docs: [
      { label: 'Kubernetes Official Documentation', url: 'https://kubernetes.io/docs/home/' },
      { label: 'kubectl Reference', url: 'https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands' },
    ],
    envValues: ['EXAM_MODE=true', 'KUBECONFIG=/root/.kube/config', 'NAMESPACE=production'],
    checkpoints: [
      { id: 'full-triage', hint: 'Troubleshooting: kubectl get pods -A', test: (c) => c.startsWith('kubectl get pods -A'), explanation: 'Weighted 30%: incident triage scope captured.' },
      { id: 'full-rbac', hint: 'Architecture: kubectl create role exam-reader --verb=get,list,watch --resource=pods -n production', test: (c) => c.includes('create role exam-reader') && c.includes('pods'), explanation: 'Weighted 25%: RBAC configuration task completed.' },
      { id: 'full-workload', hint: 'Workloads: kubectl set resources deployment/api-server -n production --limits=memory=512Mi,cpu=500m', test: (c) => c.includes('set resources deployment/api-server') && c.includes('memory=512Mi'), explanation: 'Weighted 15%: workload tuning task completed.' },
      { id: 'full-net', hint: 'Networking: kubectl describe ingress api -n production', test: (c) => c.includes('describe ingress api'), explanation: 'Weighted 20%: ingress/network validation completed.' },
      { id: 'full-storage', hint: 'Storage: kubectl describe pvc data-pvc -n production', test: (c) => c.includes('describe pvc data-pvc'), explanation: 'Weighted 10%: storage diagnosis completed.' },
    ],
  },
]

const CARD = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 10,
  padding: 16,
}

function checkpointReferenceCommand(cp) {
  const hint = cp.hint || ''
  if (!hint.includes(':')) return ''
  return hint.split(':').slice(1).join(':').trim()
}

// Returns only the conceptual action label — never exposes the actual kubectl command.
function getCheckpointConcept(cp) {
  const raw = cp.concept || cp.hint || cp.explanation || ''
  const colonIdx = raw.indexOf(':')
  if (colonIdx > -1) {
    const label = raw.slice(0, colonIdx).trim()
    if (label && !label.toLowerCase().startsWith('kubectl')) return label
  }
  // Fallback: strip anything after 'kubectl' if it slipped through
  const kubectlIdx = raw.toLowerCase().indexOf('kubectl')
  if (kubectlIdx > -1) return raw.slice(0, kubectlIdx).trim() || 'Complete this checkpoint.'
  return raw
}

function explainCheckpointWhy(cp) {
  const raw = checkpointReferenceCommand(cp)
  if (!raw) return 'This step verifies progress in a controlled, exam-relevant workflow.'
  const parsed = parseKubectl(raw)
  if (!parsed) return 'This command anchors the next decision with measurable cluster evidence.'

  const nsPart = parsed.namespace ? ` in namespace ${parsed.namespace}` : ''
  if (parsed.verb === 'get') return `Read-only reconnaissance${nsPart} to establish current cluster state before any change.`
  if (parsed.verb === 'describe') return `Pulls high-signal diagnostics${nsPart} (events, conditions, and object history) to isolate root cause.`
  if (parsed.verb === 'logs') return `Captures container runtime output${nsPart} so you can validate the failure mode quickly.`
  if (parsed.verb === 'set') return `Applies a targeted workload change${nsPart} with minimal blast radius.`
  if (parsed.verb === 'patch') return `Performs a focused JSON merge${nsPart} to correct specific fields safely.`
  if (parsed.verb === 'rollout') return `Controls deployment lifecycle${nsPart} for safer release verification or rollback.`
  if (parsed.verb === 'create') return `Introduces a required object${nsPart} to satisfy access, networking, or scheduling prerequisites.`
  if (parsed.verb === 'apply') return `Reconciles declarative config${nsPart} to align live state with intended manifests.`
  return `Validates the next operational milestone${nsPart} with an exam-style action.`
}

function buildSyntaxCoach(referenceCommand) {
  const parsed = parseKubectl(referenceCommand)
  if (!parsed) {
    return {
      synopsis: 'No structured command reference available for this checkpoint.',
      chips: [],
    }
  }

  const chips = [
    { label: 'verb', value: parsed.verb || 'unknown' },
    { label: 'resource', value: parsed.resource || 'unknown' },
  ]

  if (parsed.name) chips.push({ label: 'target', value: parsed.name })
  if (parsed.namespace) chips.push({ label: 'namespace', value: parsed.namespace })
  if (parsed.subcommand) chips.push({ label: 'subcommand', value: parsed.subcommand })
  const parsedFlags = parsed.flags && typeof parsed.flags === 'object' ? parsed.flags : {}
  for (const [flagName, flagValue] of Object.entries(parsedFlags)) {
    if (flagValue === true) {
      chips.push({ label: 'flag', value: `--${flagName}` })
    } else {
      chips.push({ label: 'flag', value: `--${flagName}=${String(flagValue)}` })
    }
  }

  return {
    synopsis: 'Command shape: kubectl <verb> <resource> [target] [flags]',
    chips,
  }
}

function buildRecapQuestions(lesson) {
  // Use lesson-specific quiz questions when available
  if (lesson.quiz && lesson.quiz.length > 0) return lesson.quiz

  // Fallback generic questions for mocks (which don't have quiz fields)
  const doc = lesson.docs?.[0]?.label || 'Kubernetes official docs'
  const cpCount = lesson.checkpoints.length

  return [
    {
      id: 'q1',
      prompt: 'What should usually come first in an incident workflow?',
      options: [
        'Apply a patch immediately',
        'Gather state with read-only inspection commands',
        'Delete and recreate workloads',
      ],
      correct: 1,
      explanation: 'In CKA-style troubleshooting, establish evidence first with get/describe/logs before mutating resources.',
    },
    {
      id: 'q2',
      prompt: `How many checkpoints are required in this lesson?`,
      options: ['1', String(cpCount), String(cpCount + 2)],
      correct: 1,
      explanation: 'Repetition against defined checkpoints builds exam speed and procedural confidence.',
    },
    {
      id: 'q3',
      prompt: 'Best source for exact command semantics during exam prep?',
      options: [
        doc,
        'Random forum snippets only',
        'Guessing from memory',
      ],
      correct: 0,
      explanation: 'Official docs are fastest for accurate syntax, edge-case flags, and object behavior.',
    },
  ]
}

function buildSimulatedOutput(rawCommand, lesson, sessionState) {
  const parsed = parseKubectl(rawCommand)
  if (!parsed) return ''

  if (parsed.verb === 'get' && parsed.resource === 'namespace') {
    return [
      'NAME              STATUS   AGE',
      'default           Active   42d',
      'kube-system       Active   42d',
      'kube-public       Active   42d',
      'production        Active   21d',
      'monitoring        Active   18d',
    ].join('\r\n')
  }

  if (parsed.verb === 'get' && parsed.resource === 'nodes') {
    return [
      'NAME            STATUS   ROLES           AGE   VERSION',
      'control-plane   Ready    control-plane   42d   v1.30.1',
      'node-1          Ready    <none>          42d   v1.30.1',
      'node-2          Ready    <none>          42d   v1.30.1',
    ].join('\r\n')
  }

  if (parsed.verb === 'get' && parsed.resource === 'pods') {
    if (lesson.id === 1) {
      const fixed = Boolean(sessionState.fix)
      if (!fixed) {
        return [
          'NAME                              READY   STATUS             RESTARTS   AGE',
          'api-server-7d9f4b                 0/1     CrashLoopBackOff   5          4m',
          'worker-processor-5f89d            1/1     Running            0          12m',
        ].join('\r\n')
      }
      return [
        'NAME                              READY   STATUS    RESTARTS   AGE',
        'api-server-7d9f4b                 1/1     Running   0          6m',
        'worker-processor-5f89d            1/1     Running   0          14m',
      ].join('\r\n')
    }

    return [
      'NAME                              READY   STATUS    RESTARTS   AGE',
      'api-server-7d9f4b                 1/1     Running   0          12m',
      'data-processor-7c4d2a             1/1     Running   0          10m',
    ].join('\r\n')
  }

  if (parsed.verb === 'get' && (parsed.resource === 'deployment' || parsed.resource === 'deployments')) {
    if (lesson.id === 1) {
      const fixed = Boolean(sessionState.fix)
      if (!fixed) {
        return [
          'NAME         READY   UP-TO-DATE   AVAILABLE   AGE',
          'api-server   0/1     1            0           8m',
          'worker-processor   1/1     1            1           14m',
        ].join('\r\n')
      }
      return [
        'NAME         READY   UP-TO-DATE   AVAILABLE   AGE',
        'api-server   1/1     1            1           10m',
        'worker-processor   1/1     1            1           16m',
      ].join('\r\n')
    }

    return [
      'NAME         READY   UP-TO-DATE   AVAILABLE   AGE',
      'api-server   1/1     1            1           12m',
      'data-processor   1/1     1            1           10m',
    ].join('\r\n')
  }

  if (parsed.verb === 'get' && parsed.resource === 'persistentvolumeclaim') {
    return [
      'NAME       STATUS    VOLUME    CAPACITY   ACCESS MODES   STORAGECLASS   AGE',
      'data-pvc    Pending                                     fast-ssd       5m',
    ].join('\r\n')
  }

  if (parsed.verb === 'get' && parsed.resource === 'persistentvolume') {
    return [
      'NAME      CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM   STORAGECLASS   AGE',
      'pv-fast   10Gi       RWO            Retain           Available            fast-ssd      2d',
    ].join('\r\n')
  }

  if (parsed.verb === 'get' && parsed.resource === 'ingress') {
    return [
      'NAME   CLASS   HOSTS                ADDRESS      PORTS   AGE',
      'api    nginx   api.kubecrash.local  10.0.0.120   80      2d',
    ].join('\r\n')
  }

  if (parsed.verb === 'get' && parsed.resource === 'events') {
    return [
      'LAST SEEN   TYPE      REASON      OBJECT                          MESSAGE',
      '22s         Warning   BackOff     pod/api-server-7d9f4b           Back-off restarting failed container',
      '15s         Normal    Scheduled   pod/worker-processor-5f89d      Successfully assigned production/worker-processor-5f89d to node-1',
    ].join('\r\n')
  }

  if (parsed.verb === 'logs' && parsed.name?.startsWith('api-server')) {
    return [
      '2026-04-25T09:45:13Z ERROR Failed to boot application',
      '2026-04-25T09:45:13Z ERROR DATABASE_URL is missing',
      '2026-04-25T09:45:13Z FATAL exiting with code 1',
    ].join('\r\n')
  }

  if (parsed.verb === 'get' && parsed.resource === 'service') {
    return [
      'NAME          TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)   AGE',
      'api-service   ClusterIP   10.96.14.21   <none>        80/TCP    2d',
    ].join('\r\n')
  }

  if (parsed.verb === 'get' && parsed.resource === 'endpoints') {
    const patched = Boolean(sessionState.patch)
    const endpoint = patched ? '10.42.0.23:8080,10.42.0.24:8080' : '<none>'
    return [
      'NAME          ENDPOINTS                         AGE',
      `api-service   ${endpoint}   2d`,
    ].join('\r\n')
  }

  if (parsed.verb === 'describe' && parsed.resource === 'pods') {
    return [
      `Name:         ${parsed.name || 'api-server-7d9f4b'}`,
      `Namespace:    ${parsed.namespace || 'production'}`,
      'Status:       Running',
      'Events:',
      '  Normal  Pulled  2m  kubelet  Container image already present',
    ].join('\r\n')
  }

  if (parsed.verb === 'describe' && parsed.resource === 'persistentvolumeclaim') {
    return [
      `Name:          ${parsed.name || 'data-pvc'}`,
      `Namespace:     ${parsed.namespace || 'production'}`,
      'Status:        Pending',
      'Events:',
      '  Warning  ProvisioningFailed  30s  persistentvolume-controller  storageclass "fast-ssd" waiting for provisioner',
    ].join('\r\n')
  }

  if (parsed.verb === 'describe' && parsed.resource === 'ingress') {
    return [
      `Name:             ${parsed.name || 'api'}`,
      `Namespace:        ${parsed.namespace || 'production'}`,
      'Rules:',
      '  Host                Path  Backends',
      '  api.kubecrash.local',
      '                      /     api-service:80',
      'TLS:',
      '  api-tls terminates api.kubecrash.local',
    ].join('\r\n')
  }

  if (parsed.verb === 'describe' && parsed.resource === 'networkpolicy') {
    return [
      `Name:         ${parsed.name || 'api-deny-default'}`,
      `Namespace:    ${parsed.namespace || 'production'}`,
      'Policy Types: Ingress',
      'Ingress:',
      '  From:',
      '    NamespaceSelector: kubernetes.io/metadata.name=monitoring',
      '  Ports: 80/TCP',
    ].join('\r\n')
  }

  if (parsed.verb === 'set' && parsed.subcommand === 'env') {
    return `deployment.apps/${parsed.resource?.split('/')[1] || 'api-server'} env updated`
  }

  if (parsed.verb === 'set' && parsed.subcommand === 'resources') {
    return `deployment.apps/${parsed.resource?.split('/')[1] || 'data-processor'} resource requirements updated`
  }

  if (parsed.verb === 'patch' && parsed.resource === 'service') {
    return 'service/api-service patched'
  }

  if (parsed.verb === 'create' && parsed.resource) {
    return `${parsed.resource}/${parsed.name || 'created-object'} created`
  }

  if (parsed.verb === 'apply') {
    return 'manifest applied successfully'
  }

  if (parsed.verb === 'rollout' && parsed.subcommand === 'status') {
    return `deployment "${parsed.resource?.split('/')[1] || 'api'}" successfully rolled out`
  }

  if (parsed.verb === 'rollout' && parsed.subcommand === 'history') {
    return [
      `deployment.apps/${parsed.resource?.split('/')[1] || 'api'} `,
      'REVISION  CHANGE-CAUSE',
      '1         kubectl apply --record=true',
      '2         kubectl set image deployment/api api=api:v2.3.1 --record=true',
    ].join('\r\n')
  }

  if (parsed.verb === 'rollout' && parsed.subcommand === 'undo') {
    return `deployment.apps/${parsed.resource?.split('/')[1] || 'api'} rolled back`
  }

  return 'command executed (simulation output condensed)'
}

export default function LearningJourney() {
  const [mode, setMode] = useState('lesson')
  const [lessonTrack, setLessonTrack] = useState('beginner')
  const [advancedTrack, setAdvancedTrack] = useState(null)   // 'observability' | 'security' | 'gitops' | 'cluster-ops'
  const [selectedAdvancedLesson, setSelectedAdvancedLesson] = useState(null) // lesson id
  const [hintMode, setHintMode] = useState('adaptive')
  const [activeId, setActiveId] = useState(0)
  const [selectedYamlChallenge, setSelectedYamlChallenge] = useState(null)
  const [sessionState, setSessionState] = useState({})
  const [sessionCommands, setSessionCommands] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [revealedCheckpoints, setRevealedCheckpoints] = useState({})
  const [labCapabilities, setLabCapabilities] = useState({
    loading: true,
    simulation: { enabled: true, label: 'Simulation' },
    realCluster: { enabled: false, label: 'Real Cluster (Beta)', reason: 'Loading capabilities...' },
  })
  const [progress, setProgress] = useState(() => {
    try {
      return loadLearningProgress()
    } catch {
      return DEFAULT_LEARNING_PROGRESS
    }
  })
  const [labMode, setLabMode] = useState(progress.preferredLabMode || 'simulation')

  const lesson = useMemo(() => {
    if (mode === 'lesson') return LESSONS.find((l) => l.id === activeId) || LESSONS[0]
    return MOCKS.find((m) => m.id === String(activeId)) || MOCKS[0]
  }, [activeId, mode])

  const updateProgress = useCallback((next) => {
    const normalized = saveLearningProgress(next)
    setProgress(normalized)
  }, [])

  const updateProgressWith = useCallback((project) => {
    setProgress((prev) => {
      const next = project(prev)
      return saveLearningProgress(next)
    })
  }, [])

  const calcLessonStreak = useCallback((completedLessons) => {
    let streak = 0
    for (const lessonDef of LESSONS) {
      if (completedLessons[String(lessonDef.id)]) {
        streak += 1
      } else {
        break
      }
    }
    return streak
  }, [])

  const isLessonUnlocked = useCallback((lessonDef) => {
    return isLessonAccessible(lessonDef, LESSONS, progress.completedLessons)
  }, [progress.completedLessons])

  const resetSession = useCallback(() => {
    const baseState = {}
    for (const cp of lesson.checkpoints) {
      baseState[cp.id] = false
    }
    setSessionState(baseState)
    setSessionCommands(0)
    setRemaining(lesson.timeLimit || 420)
    setQuizAnswers({})
    setQuizSubmitted(false)
    setRevealedCheckpoints({})
  }, [lesson])

  const resolveHintMode = useCallback(() => {
    if (hintMode !== 'adaptive') return hintMode
    if (progress.streak >= 6) return 'exam'
    if (progress.streak >= 3) return 'standard'
    return 'beginner'
  }, [hintMode, progress.streak])

  const getPendingHint = useCallback(() => {
    const pending = lesson.checkpoints.find((cp) => !sessionState[cp.id])
    if (!pending) {
      return 'All checkpoints complete. Review the recap quiz below.'
    }
    // Always show the conceptual action — never the actual kubectl command.
    return getCheckpointConcept(pending)
  }, [lesson, sessionState])

  const recordCommandAttempt = useCallback((signature, success) => {
    if (!signature || !isKnownCoverageCommand(signature)) return

    updateProgressWith((prev) => {
      const current = prev.commandMastery?.[signature] || { attempts: 0, successes: 0, lastSeen: null }
      const nextProgress = {
        ...prev,
        commandMastery: {
          ...(prev.commandMastery || {}),
          [signature]: {
            attempts: current.attempts + 1,
            successes: current.successes + (success ? 1 : 0),
            lastSeen: new Date().toISOString(),
          },
        },
      }
      return nextProgress
    })
  }, [updateProgressWith])

  const completeSession = useCallback(() => {
    const solvedBonus = Object.values(sessionState).filter(Boolean).length * 30
    const timeBonus = Math.max(0, remaining)
    const commandPenalty = Math.min(120, sessionCommands * 2)
    const score = Math.max(100, 400 + solvedBonus + timeBonus - commandPenalty)
    const elapsed = (lesson.timeLimit || 420) - remaining

    if (mode === 'lesson') {
      const current = progress.completedLessons[String(lesson.id)] || { bestScore: 0, bestTime: Number.MAX_SAFE_INTEGER }
      const mergedLessons = {
        ...progress.completedLessons,
        [String(lesson.id)]: {
          bestScore: Math.max(current.bestScore, score),
          bestTime: Math.min(current.bestTime, elapsed),
        },
      }
      const nextProgress = {
        ...progress,
        completedLessons: mergedLessons,
        totalPoints: progress.totalPoints + score,
        streak: calcLessonStreak(mergedLessons),
      }
      const lessonDone = LESSONS.every((l) => Boolean(mergedLessons[String(l.id)]))
      const mockDone = MOCKS.every((m) => Boolean(progress.completedMocks[m.id]))
      if (lessonDone && mockDone && !nextProgress.certifiedAt) {
        nextProgress.certifiedAt = new Date().toISOString()
      }
      updateProgress(nextProgress)
    } else {
      const current = progress.completedMocks[lesson.id] || { bestScore: 0, bestTime: Number.MAX_SAFE_INTEGER }
      const mergedMocks = {
        ...progress.completedMocks,
        [lesson.id]: {
          bestScore: Math.max(current.bestScore, score),
          bestTime: Math.min(current.bestTime, elapsed),
        },
      }
      const nextProgress = {
        ...progress,
        completedMocks: mergedMocks,
        totalPoints: progress.totalPoints + score,
      }
      const lessonDone = LESSONS.every((l) => Boolean(progress.completedLessons[String(l.id)]))
      const mockDone = MOCKS.every((m) => Boolean(mergedMocks[m.id]))
      if (lessonDone && mockDone && !nextProgress.certifiedAt) {
        nextProgress.certifiedAt = new Date().toISOString()
      }
      updateProgress(nextProgress)
    }

    write(`\r\n\x1b[32mSession Complete. Score: ${score} | Time: ${elapsed}s | Commands: ${sessionCommands}\x1b[0m\r\n`)
    write('\x1b[36mYou can continue practicing, switch chapter, or retry this timed run.\x1b[0m\r\n')
  }, [calcLessonStreak, lesson, mode, progress, remaining, sessionCommands, sessionState, updateProgress])

  const handleCommand = useCallback((cmd) => {
    const c = cmd.trim()
    if (!c) {
      showPrompt()
      return
    }

    setSessionCommands((prev) => prev + 1)

    if (c === 'clear') {
      clear()
      write(`\x1b[36m${lesson.prompt}\x1b[0m\r\n`)
      showPrompt()
      return
    }

    if (c === 'help') {
      write(`\r\n\x1b[33m${getPendingHint()}\x1b[0m\r\n`)
      showPrompt()
      return
    }

    if (c === 'status') {
      const done = Object.values(sessionState).filter(Boolean).length
      const total = lesson.checkpoints.length
      write(`\r\nCheckpoint progress: ${done}/${total} | Remaining: ${remaining}s | Commands: ${sessionCommands}\r\n`)
      showPrompt()
      return
    }

    const commandSignature = buildCommandSignature(c)
    const commandOutput = buildSimulatedOutput(c, lesson, sessionState)
    if (commandOutput) {
      write(`\r\n${commandOutput}\r\n`)
    }

    let matchedCheckpoint = null
    for (const cp of lesson.checkpoints) {
      const nativeMatch = !sessionState[cp.id] && cp.test(c, sessionState)
      const refText = (cp.hint || '').includes(':') ? (cp.hint || '').split(':').slice(1).join(':').trim() : ''
      const semanticMatch = !sessionState[cp.id] && refText && semanticMatchByReference(c, refText)
      if (nativeMatch || semanticMatch) {
        matchedCheckpoint = cp
        break
      }
    }

    if (matchedCheckpoint) {
      const nextState = { ...sessionState, [matchedCheckpoint.id]: true }
      setSessionState(nextState)
      const message = matchedCheckpoint.success || matchedCheckpoint.explanation || 'Checkpoint validated.'
      write(`\r\n\x1b[32m${message}\x1b[0m\r\n`)
      recordCommandAttempt(commandSignature, true)

      const completeNow = lesson.checkpoints.every((cp) => nextState[cp.id])
      if (completeNow) {
        completeSession()
      }
    } else {
      recordCommandAttempt(commandSignature, false)
      if (commandOutput) {
        write('\r\n\x1b[33mOutput shown above. Verify your target: resource name, namespace, and flags must be exact.\x1b[0m\r\n')
      } else if (!c.startsWith('kubectl')) {
        write('\r\n\x1b[31mUnrecognised command. All commands start with kubectl. Type help for guidance.\x1b[0m\r\n')
      } else {
        write('\r\n\x1b[33mCommand not matched. Check resource name and namespace. Type help for a concept nudge.\x1b[0m\r\n')
      }
    }

    showPrompt()
  }, [completeSession, getPendingHint, lesson, recordCommandAttempt, remaining, sessionCommands, sessionState])

  const { termRef, write, showPrompt, clear } = useTerminal({ onCommand: handleCommand })

  useEffect(() => {
    resetSession()
    clear()
    write(`\x1b[36m${lesson.prompt}\x1b[0m\r\n`)
    write(`\x1b[33mType help for checkpoint guidance, status for progress.\x1b[0m\r\n`)
    showPrompt()
  }, [lesson, mode])

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          write('\r\n\x1b[31mTime expired for this session. Retry to improve your CKA incident response speed.\x1b[0m\r\n')
          showPrompt()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [lesson.id, mode])

  useEffect(() => {
    let ignore = false

    fetch('/api/labs/capabilities')
      .then((r) => r.json())
      .then((data) => {
        if (ignore) return
        setLabCapabilities({ loading: false, ...data })
      })
      .catch(() => {
        if (ignore) return
        setLabCapabilities({
          loading: false,
          simulation: { enabled: true, label: 'Simulation' },
          realCluster: {
            enabled: false,
            label: 'Real Cluster (Beta)',
            reason: 'Capabilities endpoint unavailable. Backend may be offline.',
          },
        })
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    updateProgressWith((prev) => ({
      ...prev,
      preferredLabMode: labMode,
    }))
  }, [labMode, updateProgressWith])

  const trackSummary = useMemo(
    () => buildTrackSummary(LESSONS, progress.completedLessons),
    [progress.completedLessons],
  )
  const unlockedTrackIds = trackSummary.filter((track) => track.unlocked).map((track) => track.id)
  const effectiveTrack = unlockedTrackIds.includes(lessonTrack) ? lessonTrack : (unlockedTrackIds[0] || 'beginner')
  const filteredLessons = LESSONS.filter((l) => l.track === effectiveTrack)
  const items = mode === 'lesson' ? filteredLessons : MOCKS
  const completedMap = mode === 'lesson' ? progress.completedLessons : progress.completedMocks
  const lessonDocs = Array.isArray(lesson.docs) ? lesson.docs : []
  const lessonEnvValues = Array.isArray(lesson.envValues) ? lesson.envValues : []
  const lessonCheckpoints = Array.isArray(lesson.checkpoints) ? lesson.checkpoints : []
  const pendingCheckpoint = useMemo(() => lessonCheckpoints.find((cp) => !sessionState[cp.id]) || null, [lessonCheckpoints, sessionState])
  const syntaxCoach = useMemo(() => buildSyntaxCoach(checkpointReferenceCommand(pendingCheckpoint || {})), [pendingCheckpoint])
  const lessonRecap = useMemo(() => buildRecapQuestions(lesson), [lesson])
  const isSessionComplete = useMemo(() => lessonCheckpoints.every((cp) => sessionState[cp.id]), [lessonCheckpoints, sessionState])
  const recapScore = useMemo(() => {
    return lessonRecap.reduce((acc, q) => (quizAnswers[q.id] === q.correct ? acc + 1 : acc), 0)
  }, [lessonRecap, quizAnswers])
  const resolvedHintMode = resolveHintMode()
  const completedCheckpointCount = Object.values(sessionState).filter(Boolean).length
  const checkpointTotal = lessonCheckpoints.length || 1
  const architectureFlowPercent = Math.round((completedCheckpointCount / checkpointTotal) * 100)
  const urgencyColor = remaining < 90 ? '#f85149' : remaining < 180 ? '#d29922' : '#3fb950'

  const architectureFlow = useMemo(() => {
    const domain = lesson.domain || ''
    if (domain.includes('Troubleshooting')) return {
      nodes: ['Pod', 'Logs', 'Events', 'Fix'],
      description: 'Triage path: Pod failure -> Log capture -> Event inspection -> Remediation',
    }
    if (domain.includes('Services and Networking')) return {
      nodes: ['Ingress', 'Service', 'Endpoints', 'Pod'],
      description: 'Traffic path: Ingress rule -> Service ClusterIP -> Endpoint slice -> Pod',
    }
    if (domain.includes('Workloads and Scheduling')) return {
      nodes: ['Node', 'Scheduler', 'Deployment', 'ReplicaSet'],
      description: 'Scheduling path: Node taints -> Scheduler decision -> Deployment -> ReplicaSet',
    }
    if (domain.includes('Storage')) return {
      nodes: ['PVC', 'PV', 'StorageClass', 'Mount'],
      description: 'Storage path: PVC claim -> PV binding -> StorageClass provision -> Volume mount',
    }
    if (domain.includes('Cluster Architecture')) return {
      nodes: ['API Server', 'etcd', 'Controller', 'kubelet'],
      description: 'Control plane: API Server -> etcd state -> Controller loop -> kubelet reconcile',
    }
    return {
      nodes: ['Ingress', 'Service', 'Deployment', 'Pod'],
      description: 'Default path: Ingress -> Service -> Deployment -> Pod',
    }
  }, [lesson.domain])
  const coverageStats = useMemo(
    () => commandCoverageStats(progress.commandMastery || {}),
    [progress.commandMastery],
  )
  const lessonCompletionCount = Object.keys(progress.completedLessons).length
  const mockCompletionCount = Object.keys(progress.completedMocks).length
  const advancedCompletionCount = Object.keys(progress.completedAdvanced || {}).length
  const obsDone = ADVANCED_TRACKS.filter((l) => l.track === 'observability').every((l) => !!(progress.completedAdvanced || {})[l.id])
  const secDone = ADVANCED_TRACKS.filter((l) => l.track === 'security').every((l) => !!(progress.completedAdvanced || {})[l.id])
  const gitopsDone = ADVANCED_TRACKS.filter((l) => l.track === 'gitops').every((l) => !!(progress.completedAdvanced || {})[l.id])
  const clusterOpsDone = ADVANCED_TRACKS.filter((l) => l.track === 'cluster-ops').every((l) => !!(progress.completedAdvanced || {})[l.id])
  const badges = [
    { label: 'First Incident Solved', unlocked: lessonCompletionCount >= 1, color: '#3fb950' },
    { label: 'Service Surgeon', unlocked: lessonCompletionCount >= 2, color: '#3fb950' },
    { label: 'Resource Guardian', unlocked: lessonCompletionCount >= 3, color: '#3fb950' },
    { label: 'Networking Sentinel', unlocked: lessonCompletionCount >= 6, color: '#3fb950' },
    { label: 'Mock Sprint Finisher', unlocked: mockCompletionCount >= 1, color: '#3fb950' },
    { label: 'CKA Simulation Master', unlocked: mockCompletionCount >= 3, color: '#3fb950' },
    { label: 'Observability Engineer', unlocked: obsDone, color: '#58a6ff' },
    { label: 'Security Champion', unlocked: secDone, color: '#f85149' },
    { label: 'GitOps Practitioner', unlocked: gitopsDone, color: '#3fb950' },
    { label: 'Cluster Ops Specialist', unlocked: clusterOpsDone, color: '#d29922' },
    { label: 'Advanced Track Master', unlocked: advancedCompletionCount >= 16, color: '#a371f7' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', padding: '24px' }}>
      <style>
        {`@keyframes architecture-packet-flow {
            0% { transform: translateX(0px); opacity: 0.4; }
            25% { opacity: 1; }
            50% { transform: translateX(210px); opacity: 0.8; }
            100% { transform: translateX(420px); opacity: 0.35; }
          }
          @keyframes architecture-pulse {
            0% { transform: scale(1); opacity: 0.35; }
            50% { transform: scale(1.14); opacity: 0.95; }
            100% { transform: scale(1); opacity: 0.35; }
          }
          @keyframes revealFadeIn {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
          }`}
      </style>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h1 style={{ fontFamily: 'JetBrains Mono', color: '#e6edf3', fontSize: 24 }}>
              CKA Learning Journey
            </h1>
            <p style={{ color: '#8b949e', marginTop: 6, fontFamily: 'JetBrains Mono', fontSize: 12 }}>
              Lesson-wise Kubernetes prep with official docs, env patterns, timed drills, and mini-mocks.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
              Streak: <span style={{ color: '#3fb950' }}>{progress.streak}</span>
            </span>
            <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
              Points: <span style={{ color: '#58a6ff' }}>{progress.totalPoints}</span>
            </span>
            <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
              Hints: <span style={{ color: '#e6edf3' }}>{resolvedHintMode}</span>
            </span>
            <button onClick={() => useGameStore.getState().setScreen('levelSelect')}>Back to Game</button>
          </div>
        </div>

        {/* Overall progress bar */}
        {(() => {
          const ckaTotal = 15 + 4  // lessons + mocks
          const ckaDone = lessonCompletionCount + mockCompletionCount
          const advTotal = 16
          const ckaPct = Math.round((ckaDone / ckaTotal) * 100)
          const advPct = Math.round((advancedCompletionCount / advTotal) * 100)
          return (
            <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
              {[{
                label: 'CKA Track', pct: ckaPct, done: ckaDone, total: ckaTotal, color: '#3fb950',
              }, {
                label: 'Advanced Tracks', pct: advPct, done: advancedCompletionCount, total: advTotal, color: '#58a6ff',
              }].map((bar) => (
                <div key={bar.label} style={{ flex: 1, background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10 }}>{bar.label}</span>
                    <span style={{ color: bar.color, fontFamily: 'JetBrains Mono', fontSize: 10 }}>{bar.done}/{bar.total} ({bar.pct}%)</span>
                  </div>
                  <div style={{ background: '#21262d', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${bar.pct}%`, height: '100%', background: bar.color, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={mode === 'lesson' ? 'primary' : ''}
                style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
                onClick={() => {
                  const preferredTrack = unlockedTrackIds.includes(lessonTrack) ? lessonTrack : (unlockedTrackIds[0] || 'beginner')
                  setMode('lesson')
                  setLessonTrack(preferredTrack)
                  const nextId = (LESSONS.find((l) => l.track === preferredTrack) || LESSONS[0]).id
                  setActiveId(nextId)
                }}
              >
                Lessons
              </button>
              <button
                className={mode === 'mock' ? 'primary' : ''}
                style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
                onClick={() => {
                  setMode('mock')
                  setActiveId('mock-1')
                }}
              >
                Mini-Mocks
              </button>
              <button
                className={mode === 'yaml-challenge' ? 'primary' : ''}
                style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
                onClick={() => {
                  setMode('yaml-challenge')
                  setSelectedYamlChallenge(null)
                }}
              >
                YAML Challenges
              </button>
            </div>

            {mode === 'lesson' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {trackSummary.map((track) => {
                  const isActive = lessonTrack === track.id
                  const lockLabel = track.unlocked ? '' : ` (${track.prerequisites.join(' + ') || 'locked'})`

                  return (
                    <button
                      key={track.id}
                      className={isActive ? 'primary' : ''}
                      style={{
                        flex: '1 1 48%',
                        fontSize: 11,
                        padding: '4px 8px',
                        opacity: track.unlocked ? 1 : 0.55,
                      }}
                      disabled={!track.unlocked}
                      onClick={() => {
                        setLessonTrack(track.id)
                        const first = LESSONS.find((l) => l.track === track.id)
                        if (first) setActiveId(first.id)
                      }}
                    >
                      {track.label}{lockLabel}
                    </button>
                  )
                })}
              </div>
            ) : null}

            <div style={{ ...CARD, padding: 10 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 8 }}>Mastery Curriculum Map</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trackSummary.map((track) => (
                  <div key={track.id} style={{ border: '1px solid #30363d', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{track.label}</span>
                      <span style={{ color: track.unlocked ? '#3fb950' : '#d29922', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                        {track.unlocked ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                    <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10, marginTop: 4 }}>
                      {track.description}
                    </div>
                    <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 10, marginTop: 4 }}>
                      Progress: {track.completedLessons}/{track.totalLessons}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...CARD, padding: 10 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 6 }}>Hint Mode</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['adaptive', 'beginner', 'standard', 'exam'].map((hm) => (
                  <button
                    key={hm}
                    className={hintMode === hm ? 'primary' : ''}
                    onClick={() => setHintMode(hm)}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    {hm}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...CARD, padding: 10 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 6 }}>Lab Mode</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <button
                  className={labMode === 'simulation' ? 'primary' : ''}
                  onClick={() => setLabMode('simulation')}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  Simulation
                </button>
                <button
                  className={labMode === 'realCluster' ? 'primary' : ''}
                  onClick={() => {
                    if (labCapabilities.realCluster?.enabled) setLabMode('realCluster')
                  }}
                  disabled={!labCapabilities.realCluster?.enabled}
                  style={{ fontSize: 11, padding: '4px 8px', opacity: labCapabilities.realCluster?.enabled ? 1 : 0.55 }}
                >
                  Real Cluster (Beta)
                </button>
              </div>
              <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                {labCapabilities.loading
                  ? 'Loading lab capabilities...'
                  : (labMode === 'realCluster' ? 'Real cluster mode active.' : (labCapabilities.realCluster?.reason || 'Simulation mode active.'))}
              </div>
            </div>

            <div style={{ ...CARD, padding: 10 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 6 }}>
                Command Mastery Coverage: {coverageStats.done}/{coverageStats.total} ({coverageStats.percentage}%)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {coverageStats.byGroup.map((group) => (
                  <div key={group.id} style={{ border: '1px solid #30363d', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                      <span>{group.label}</span>
                      <span>{group.completed}/{group.total} ({group.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...CARD, padding: 10 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 6 }}>CKA Blueprint Coverage</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {CKA_BLUEPRINT.map((bp) => (
                  <div key={bp.domain} style={{ color: '#8b949e', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                    {bp.domain} - {bp.weight}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...CARD, padding: 10 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 6 }}>30-Day Path</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {STUDY_PLAN_30D.map((p) => (
                  <div key={p} style={{ color: '#8b949e', fontSize: 11, fontFamily: 'JetBrains Mono' }}>{p}</div>
                ))}
              </div>
            </div>

            <div style={{ ...CARD, padding: 10 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 8 }}>Architecture Reading Pack</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ARCHITECTURE_READING_PACK.map((r) => (
                  <a
                    key={r.url}
                    href={r.url}
                    target='_blank'
                    rel='noreferrer'
                    style={{
                      color: '#e6edf3',
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono',
                      border: '1px solid #30363d',
                      borderRadius: 6,
                      padding: '6px 8px',
                      textDecoration: 'none',
                    }}
                  >
                    {r.label}
                  </a>
                ))}
              </div>
            </div>

            {/* ── Advanced Tracks section ── */}
            <div
              style={{
                borderTop: '1px solid #21262d',
                paddingTop: 10,
                marginTop: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <span style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700 }}>
                  Advanced Tracks
                </span>
                <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 9 }}>
                  Observability · Security · GitOps · Ops
                </span>
              </div>
              <p style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10, margin: 0, lineHeight: 1.5 }}>
                Portfolio-grade incident case studies across four engineering domains.
                Complete the Foundation track first to unlock.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                {[
                  { id: 'observability', icon: '📊', label: 'Observability', color: '#58a6ff', sub: '4 lessons · metrics, logs, traces' },
                  { id: 'security',      icon: '🔐', label: 'Security',      color: '#f85149', sub: '4 lessons · RBAC, NetworkPolicy, forensics' },
                  { id: 'gitops',        icon: '⎇',  label: 'GitOps',        color: '#3fb950', sub: '4 lessons · ArgoCD, rollbacks, governance' },
                  { id: 'cluster-ops',   icon: '⚙',  label: 'Cluster Ops',   color: '#d29922', sub: '4 lessons · quotas, autoscaling, capacity' },
                ].map((t) => {
                  const isActive = mode === 'advanced' && advancedTrack === t.id
                  const completedCount = Object.keys(progress.completedAdvanced || {}).filter((id) =>
                    ADVANCED_TRACKS.find((l) => l.id === id && l.track === t.id)
                  ).length
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setMode('advanced')
                        setAdvancedTrack(t.id)
                        setSelectedAdvancedLesson(null)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: `1px solid ${isActive ? t.color : '#21262d'}`,
                        background: isActive ? '#0d1117' : 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>{t.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: isActive ? t.color : '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: isActive ? 700 : 400 }}>
                          {t.label}
                        </div>
                        <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 9, marginTop: 1 }}>{t.sub}</div>
                      </div>
                      <span
                        style={{
                          color: completedCount === 4 ? t.color : '#8b949e',
                          fontFamily: 'JetBrains Mono',
                          fontSize: 9,
                        }}
                      >
                        {completedCount}/4
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ ...CARD, padding: 10 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 6 }}>Milestone Badges</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {badges.map((b) => (
                  <span
                    key={b.label}
                    style={{
                      fontSize: 10,
                      fontFamily: 'JetBrains Mono',
                      padding: '3px 7px',
                      borderRadius: 6,
                      border: `1px solid ${b.unlocked ? b.color : '#30363d'}`,
                      color: b.unlocked ? b.color : '#8b949e',
                    }}
                  >
                    {b.unlocked ? '✓' : '○'} {b.label}
                  </span>
                ))}
              </div>
            </div>

            {items.map((item) => (
              (() => {
                const locked = mode === 'lesson' && !isLessonUnlocked(item)
                return (
              <button
                key={item.id}
                onClick={() => {
                  if (!locked) setActiveId(item.id)
                }}
                style={{
                  ...CARD,
                  textAlign: 'left',
                  borderColor: activeId === item.id ? '#58a6ff' : '#30363d',
                  background: activeId === item.id ? '#132238' : '#161b22',
                  opacity: locked ? 0.55 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12 }}>{item.title}</span>
                  {locked ? <span style={{ color: '#d29922', fontSize: 12 }}>Locked</span> : null}
                  {!locked && completedMap[String(item.id)] ? <span style={{ color: '#3fb950', fontSize: 12 }}>Done</span> : null}
                </div>
                <div style={{ color: '#8b949e', marginTop: 8, fontSize: 12 }}>
                  {item.objective || item.scenario}
                </div>
              </button>
                )
              })()
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'advanced' && selectedAdvancedLesson ? (
              <AdvancedTrackLesson
                lesson={ADVANCED_TRACKS.find((l) => l.id === selectedAdvancedLesson)}
                onBack={() => setSelectedAdvancedLesson(null)}
                progress={progress}
                onComplete={(result) => {
                  const existingAdvanced = progress.completedAdvanced || {}
                  const alreadyCompleted = !!existingAdvanced[result.lessonId]
                  const lessonMeta = ADVANCED_TRACKS.find((l) => l.id === result.lessonId)
                  const trackId = lessonMeta?.track
                  const trackLessons = trackId ? ADVANCED_TRACKS.filter((l) => l.track === trackId) : []
                  const trackWasComplete =
                    trackLessons.length > 0 && trackLessons.every((l) => !!existingAdvanced[l.id])

                  const nextCompletedAdvanced = {
                    ...existingAdvanced,
                    [result.lessonId]: {
                      elapsed: result.elapsed,
                      quizScore: result.quizScore,
                      completedAt: existingAdvanced[result.lessonId]?.completedAt || Date.now(),
                    },
                  }

                  const trackNowComplete =
                    trackLessons.length > 0 && trackLessons.every((l) => !!nextCompletedAdvanced[l.id])
                  const trackCompletionBonus = !trackWasComplete && trackNowComplete ? 25 : 0
                  const lessonPoints = alreadyCompleted ? 0 : 50
                  const pointsEarned = lessonPoints + trackCompletionBonus

                  const next = {
                    ...progress,
                    totalPoints: (progress.totalPoints || 0) + pointsEarned,
                    streak: (progress.streak || 0) + (alreadyCompleted ? 0 : 1),
                    completedAdvanced: nextCompletedAdvanced,
                    retroNotes: {
                      ...(progress.retroNotes || {}),
                      ...(result.retroNotes ? { [result.lessonId]: result.retroNotes } : {}),
                    },
                  }
                  saveLearningProgress(next)
                  setProgress(next)
                  setSelectedAdvancedLesson(null)
                }}
              />
            ) : mode === 'advanced' && advancedTrack ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(() => {
                  const META = {
                    observability: { color: '#58a6ff', bg: '#0c1929', icon: '📊', desc: 'Prometheus metrics, log aggregation, distributed tracing, and multi-signal incident analysis.' },
                    security:      { color: '#f85149', bg: '#1c0a0a', icon: '🔐', desc: 'RBAC, NetworkPolicy microsegmentation, secrets encryption, and forensic audit trail analysis.' },
                    gitops:        { color: '#3fb950', bg: '#0a1c0a', icon: '⎇',  desc: 'ArgoCD sync, git-driven rollbacks, release tags, and multi-environment governance.' },
                    'cluster-ops': { color: '#d29922', bg: '#1a1500', icon: '⚙',  desc: 'Resource requests/limits, cluster autoscaler, namespace quotas, and capacity planning.' },
                  }[advancedTrack] || { color: '#58a6ff', bg: '#0c1929', icon: '📊', desc: '' }
                  const trackLessons = ADVANCED_TRACKS.filter((l) => l.track === advancedTrack)
                  return (
                    <>
                      <div style={{ background: META.bg, border: `1px solid ${META.color}`, borderRadius: 10, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: 24 }}>{META.icon}</span>
                          <div>
                            <div style={{ color: META.color, fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700 }}>
                              {advancedTrack.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Track
                            </div>
                            <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2 }}>{META.desc}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'JetBrains Mono', color: '#8b949e' }}>
                          <span>{trackLessons.length} lessons</span>
                          <span>{Object.keys(progress.completedAdvanced || {}).filter((id) => trackLessons.find((l) => l.id === id)).length} completed</span>
                          <span>Portfolio-grade case studies</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {trackLessons.map((lesson) => {
                          const done = !!(progress.completedAdvanced || {})[lesson.id]
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => setSelectedAdvancedLesson(lesson.id)}
                              style={{
                                background: '#161b22',
                                border: `1px solid ${done ? META.color : '#30363d'}`,
                                borderRadius: 10,
                                padding: 14,
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
                                  {done ? '✓ ' : ''}{lesson.title}
                                </span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{
                                    color: lesson.difficulty === 'hard' ? '#f85149' : lesson.difficulty === 'intermediate' ? '#d29922' : '#3fb950',
                                    fontFamily: 'JetBrains Mono',
                                    fontSize: 10,
                                    fontWeight: 700,
                                  }}>{lesson.difficulty?.toUpperCase()}</span>
                                  {done && <span style={{ color: META.color, fontFamily: 'JetBrains Mono', fontSize: 10 }}>DONE</span>}
                                </div>
                              </div>
                              <div style={{ color: '#8b949e', fontSize: 12 }}>{lesson.objective}</div>
                              <div style={{ display: 'flex', gap: 10, marginTop: 8, color: '#58a6ff', fontSize: 10, fontFamily: 'JetBrains Mono' }}>
                                <span>📚 {lesson.checkpoints?.length || 0} checkpoints</span>
                                <span>❓ {lesson.quiz?.length || 0} quiz questions</span>
                                <span>🔥 {Math.round((lesson.timeLimit || 900) / 60)}m</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>
            ) : mode === 'yaml-challenge' && selectedYamlChallenge ? (
              <YAMLChallenge
                challengeId={selectedYamlChallenge}
                onBack={() => setSelectedYamlChallenge(null)}
                progress={progress}
                recordProgress={(updates) => {
                  saveLearningProgress({ ...progress, ...updates })
                }}
              />
            ) : mode === 'yaml-challenge' ? (
              <div style={CARD}>
                <h2 style={{ fontFamily: 'JetBrains Mono', fontSize: 16, color: '#e6edf3', marginBottom: 16 }}>
                  YAML Challenges
                </h2>
                <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 20 }}>
                  Manifest authoring labs with three workflow modes: write from scratch, scaffold with fill-in-the-blanks, or fix broken manifests. All challenges include full YAML validation and guided feedback.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {YAML_CHALLENGES.map((challenge) => (
                    <button
                      key={challenge.id}
                      onClick={() => setSelectedYamlChallenge(challenge.id)}
                      style={{
                        ...CARD,
                        textAlign: 'left',
                        borderColor: '#30363d',
                        background: '#161b22',
                        padding: 16,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                        <span style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700 }}>
                          {challenge.title}
                        </span>
                        <span
                          style={{
                            color: challenge.difficulty === 'medium' ? '#d29922' : '#f85149',
                            fontFamily: 'JetBrains Mono',
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {challenge.difficulty.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ color: '#8b949e', fontSize: 12, marginBottom: 8 }}>{challenge.objective}</p>
                      <p style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 10 }}>Domain: {challenge.domain}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
            <div style={CARD}>
              <h2 style={{ fontFamily: 'JetBrains Mono', fontSize: 16, color: '#e6edf3', marginBottom: 10 }}>
                {lesson.title}
              </h2>
              <p style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 11, marginBottom: 6 }}>
                Domain: {lesson.domain}
              </p>
              <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 14 }}>
                {lesson.objective || lesson.scenario}
              </p>

              {lesson.brief ? (
                <div style={{ marginBottom: 16, border: '1px solid #21262d', borderLeft: '3px solid #f85149', borderRadius: 8, padding: '14px 16px', background: '#110d0d' }}>
                  <div style={{ color: '#f85149', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>◉ INCIDENT BRIEF</div>
                  <p style={{ color: '#e6edf3', fontSize: 13, lineHeight: 1.7, marginBottom: lesson.philosophy ? 12 : 0 }}>{lesson.brief}</p>
                  {lesson.philosophy ? (
                    <div style={{ borderTop: '1px solid #21262d', paddingTop: 10 }}>
                      <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>💡 PHILOSOPHY</div>
                      <p style={{ color: '#8b949e', fontSize: 12, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{lesson.philosophy}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {lesson.clusterOverview ? (
                <div style={{ marginBottom: 16, border: '1px solid #21262d', borderLeft: '3px solid #3fb950', borderRadius: 8, padding: '10px 14px', background: '#0a110d' }}>
                  <div style={{ color: '#3fb950', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>🖥 CLUSTER CONTEXT</div>
                  <p style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 11, lineHeight: 1.7, margin: 0 }}>{lesson.clusterOverview}</p>
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                  Timer: <span style={{ color: remaining < 90 ? '#f85149' : '#3fb950' }}>{remaining}s</span>
                </span>
                <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                  Commands: <span style={{ color: '#e6edf3' }}>{sessionCommands}</span>
                </span>
                <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                  Checkpoints: <span style={{ color: '#58a6ff' }}>{Object.values(sessionState).filter(Boolean).length}/{lesson.checkpoints.length}</span>
                </span>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 7 }}>Official Documentation</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {lessonDocs.map((d) => (
                    <a
                      key={d.url}
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #30363d',
                        borderRadius: 6,
                        color: '#e6edf3',
                        textDecoration: 'none',
                        fontSize: 12,
                        fontFamily: 'JetBrains Mono',
                      }}
                    >
                      {d.label}
                    </a>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14, border: '1px solid #30363d', borderRadius: 8, padding: 10, background: '#0f1722' }}>
                <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 4 }}>
                  Realtime Architecture Flow
                </div>
                <div style={{ color: '#3fb950', fontFamily: 'JetBrains Mono', fontSize: 10, marginBottom: 8 }}>
                  {lesson.domain}
                </div>
                <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 11, marginBottom: 10 }}>
                  {architectureFlow.description}
                </div>

                <div style={{ position: 'relative', height: 78, marginBottom: 10, border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden', padding: '0 10px' }}>
                  {(() => {
                    const nodes = architectureFlow.nodes
                    const nodeCount = nodes.length
                    const slotW = 500 / nodeCount
                    const activeNodeIdx = Math.min(
                      Math.floor((completedCheckpointCount / checkpointTotal) * nodeCount),
                      nodeCount - 1,
                    )
                    return (
                      <svg width='100%' height='78' viewBox='0 0 500 78' preserveAspectRatio='none'>
                        <line x1='20' y1='40' x2='480' y2='40' stroke='#2f81f7' strokeWidth='2' strokeDasharray='6 5' />
                        {nodes.map((label, idx) => {
                          const cx = slotW * idx + slotW / 2
                          const isDone = idx < completedCheckpointCount
                          const isActive = idx === activeNodeIdx
                          const boxColor = isDone ? '#0f2d1a' : isActive ? '#132238' : '#0d1117'
                          const borderColor = isDone ? '#3fb950' : isActive ? '#58a6ff' : '#30363d'
                          const textColor = isDone ? '#3fb950' : isActive ? '#58a6ff' : '#8b949e'
                          return (
                            <g key={label}>
                              <rect
                                x={cx - 44}
                                y={22}
                                width={88}
                                height={34}
                                rx={6}
                                fill={boxColor}
                                stroke={borderColor}
                              />
                              <text
                                x={cx}
                                y={43}
                                fill={textColor}
                                fontSize={9}
                                fontFamily='JetBrains Mono'
                                textAnchor='middle'
                              >
                                {isDone ? '✓ ' : ''}{label}
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                    )
                  })()}

                  <div
                    style={{
                      position: 'absolute',
                      top: 34,
                      left: 16,
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: urgencyColor,
                      animation: 'architecture-packet-flow 3s linear infinite',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 30,
                      right: 10,
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      border: `1px solid ${urgencyColor}`,
                      background: '#0d1117',
                      animation: 'architecture-pulse 1.2s ease-in-out infinite',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 8 }}>
                  <div style={{ border: '1px solid #30363d', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ color: '#8b949e', fontSize: 10, fontFamily: 'JetBrains Mono' }}>Checkpoint Flow</div>
                    <div style={{ color: '#e6edf3', fontSize: 12, fontFamily: 'JetBrains Mono' }}>{architectureFlowPercent}%</div>
                  </div>
                  <div style={{ border: '1px solid #30363d', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ color: '#8b949e', fontSize: 10, fontFamily: 'JetBrains Mono' }}>Hint Strategy</div>
                    <div style={{ color: '#e6edf3', fontSize: 12, fontFamily: 'JetBrains Mono' }}>{resolvedHintMode}</div>
                  </div>
                  <div style={{ border: '1px solid #30363d', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ color: '#8b949e', fontSize: 10, fontFamily: 'JetBrains Mono' }}>Time Pressure</div>
                    <div style={{ color: urgencyColor, fontSize: 12, fontFamily: 'JetBrains Mono' }}>{remaining}s</div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 7 }}>Common Env Values</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {lessonEnvValues.map((v) => (
                    <span
                      key={v}
                      style={{
                        border: '1px solid #30363d',
                        padding: '5px 9px',
                        borderRadius: 6,
                        color: '#3fb950',
                        fontFamily: 'JetBrains Mono',
                        fontSize: 12,
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 7 }}>
                  Command Syntax Coach (Next Checkpoint)
                </div>
                <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 8, fontFamily: 'JetBrains Mono' }}>
                  {pendingCheckpoint ? getCheckpointConcept(pendingCheckpoint) : 'All checkpoints done. Review recap quiz below.'}
                </div>
                <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 8, fontFamily: 'JetBrains Mono' }}>
                  {syntaxCoach.synopsis}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {syntaxCoach.chips.map((chip, idx) => (
                    <span
                      key={`${chip.label}-${chip.value}-${idx}`}
                      style={{
                        border: '1px solid #30363d',
                        padding: '5px 8px',
                        borderRadius: 999,
                        color: '#e6edf3',
                        fontFamily: 'JetBrains Mono',
                        fontSize: 11,
                        background: '#0f1722',
                      }}
                    >
                      {chip.label}: <span style={{ color: '#58a6ff' }}>{chip.value}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 7 }}>Checkpoint Overview</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {lessonCheckpoints.map((cp, idx) => {
                    const done = sessionState[cp.id]
                    const isPending = !done && lessonCheckpoints.findIndex((c) => !sessionState[c.id]) === idx
                    const revealed = revealedCheckpoints[cp.id]
                    const refCmd = checkpointReferenceCommand(cp)
                    return (
                      <div key={cp.id} style={{ border: `1px solid ${done ? '#3fb950' : revealed ? '#d29922' : '#30363d'}`, borderRadius: 8, padding: '8px 10px', background: '#0f1722' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: done ? '#3fb950' : '#8b949e', fontSize: 12, fontFamily: 'JetBrains Mono' }}>
                            {done ? '✓' : `${idx + 1}.`} {getCheckpointConcept(cp)}
                          </div>
                          {isPending && !done && refCmd && !revealed ? (
                            <button
                              style={{ fontSize: 10, padding: '2px 7px', color: '#d29922', borderColor: '#d29922', background: 'transparent' }}
                              onClick={() => {
                                setRevealedCheckpoints((prev) => ({ ...prev, [cp.id]: true }))
                                // Deduct 100 points from session score via a negative command penalty marker
                                setSessionCommands((prev) => prev + 5)
                              }}
                            >
                              Reveal (−pts)
                            </button>
                          ) : null}
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                          {explainCheckpointWhy(cp)}
                        </div>
                        {revealed && refCmd ? (
                          <div
                            style={{
                              marginTop: 8,
                              padding: '8px 10px',
                              borderRadius: 6,
                              border: '1px solid #d29922',
                              background: '#1a1500',
                              animation: 'revealFadeIn 0.5s ease',
                            }}
                          >
                            <div style={{ color: '#d29922', fontFamily: 'JetBrains Mono', fontSize: 10, marginBottom: 4 }}>ANSWER REVEALED (points deducted)</div>
                            <div style={{ color: '#3fb950', fontFamily: 'JetBrains Mono', fontSize: 11, letterSpacing: 0.5 }}>
                              {refCmd}
                            </div>
                            <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>
                              {explainCheckpointWhy(cp)}{' '}Try to understand <em>why</em> this command works before typing it.
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              {progress.certifiedAt ? (
                <div style={{ marginTop: 14, border: '1px dashed #3fb950', borderRadius: 8, padding: 10 }}>
                  <div style={{ color: '#3fb950', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                    CKA Journey Certificate Ready
                  </div>
                  <div style={{ color: '#8b949e', fontSize: 12, marginTop: 4 }}>
                    Completed all lessons and mocks on {new Date(progress.certifiedAt).toLocaleDateString()}.
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ ...CARD, padding: 8, height: 390 }}>
              <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 12, padding: '4px 8px 8px' }}>
                Interactive Practice Shell (type help, status, clear)
              </div>
              <div ref={termRef} style={{ height: 350 }} />
            </div>

            {mode === 'lesson' && isSessionComplete ? (
              <div style={CARD}>
                <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 8 }}>
                  Lesson Recap Quiz
                </div>
                <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 10, fontFamily: 'JetBrains Mono' }}>
                  Quick knowledge lock-in: answer all questions before moving on.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {lessonRecap.map((q, idx) => (
                    <div key={q.id} style={{ border: '1px solid #30363d', borderRadius: 8, padding: 10 }}>
                      <div style={{ color: '#e6edf3', fontSize: 12, marginBottom: 8, fontFamily: 'JetBrains Mono' }}>
                        Q{idx + 1}. {q.prompt}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {q.options.map((option, optionIdx) => {
                          const selected = quizAnswers[q.id] === optionIdx
                          const showCorrect = quizSubmitted && optionIdx === q.correct
                          const showWrong = quizSubmitted && selected && optionIdx !== q.correct
                          return (
                            <button
                              key={`${q.id}-${option}`}
                              onClick={() => {
                                if (!quizSubmitted) {
                                  setQuizAnswers((prev) => ({ ...prev, [q.id]: optionIdx }))
                                }
                              }}
                              style={{
                                padding: '5px 8px',
                                borderRadius: 6,
                                border: `1px solid ${showCorrect ? '#3fb950' : showWrong ? '#f85149' : selected ? '#58a6ff' : '#30363d'}`,
                                background: showCorrect ? '#10251a' : showWrong ? '#2a1213' : selected ? '#132238' : '#0d1117',
                                color: '#e6edf3',
                                fontFamily: 'JetBrains Mono',
                                fontSize: 11,
                                cursor: quizSubmitted ? 'default' : 'pointer',
                              }}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                      {quizSubmitted ? (
                        <div style={{ marginTop: 8, color: '#9ca3af', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                          {q.explanation}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className='primary'
                    onClick={() => {
                      setQuizSubmitted(true)
                      // Auto-advance: find the next lesson after a short pause to show score
                      const currentIdx = LESSONS.findIndex((l) => l.id === lesson.id)
                      const nextLesson = LESSONS[currentIdx + 1]
                      if (nextLesson) {
                        setTimeout(() => {
                          setLessonTrack(nextLesson.track)
                          setActiveId(nextLesson.id)
                        }, 2000)
                      }
                    }}
                    disabled={quizSubmitted || lessonRecap.some((q) => quizAnswers[q.id] === undefined)}
                  >
                    Submit & Continue
                  </button>
                  {quizSubmitted ? (
                    <span style={{ color: '#3fb950', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                      Score: {recapScore}/{lessonRecap.length} — Loading next lesson...
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
