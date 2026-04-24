import { useCallback, useEffect, useMemo, useState } from 'react'
import useGameStore from '../store/gameStore'
import useTerminal from '../hooks/useTerminal'
import { parseKubectl, semanticMatchByReference } from '../utils/kubectlParser'

const STORAGE_KEY = 'kubecrash-learning-progress-v1'

const DEFAULT_PROGRESS = {
  completedLessons: {},
  completedMocks: {},
  streak: 0,
  totalPoints: 0,
  certifiedAt: null,
}

function normalizeProgress(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROGRESS
  return {
    completedLessons: raw.completedLessons && typeof raw.completedLessons === 'object' ? raw.completedLessons : {},
    completedMocks: raw.completedMocks && typeof raw.completedMocks === 'object' ? raw.completedMocks : {},
    streak: Number.isFinite(raw.streak) ? raw.streak : 0,
    totalPoints: Number.isFinite(raw.totalPoints) ? raw.totalPoints : 0,
    certifiedAt: typeof raw.certifiedAt === 'string' ? raw.certifiedAt : null,
  }
}

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
  const [hintMode, setHintMode] = useState('adaptive')
  const [activeId, setActiveId] = useState(0)
  const [sessionState, setSessionState] = useState({})
  const [sessionCommands, setSessionCommands] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [progress, setProgress] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DEFAULT_PROGRESS
      return normalizeProgress(JSON.parse(raw))
    } catch {
      return DEFAULT_PROGRESS
    }
  })

  const lesson = useMemo(() => {
    if (mode === 'lesson') return LESSONS.find((l) => l.id === activeId) || LESSONS[0]
    return MOCKS.find((m) => m.id === String(activeId)) || MOCKS[0]
  }, [activeId, mode])

  const updateProgress = useCallback((next) => {
    const normalized = normalizeProgress(next)
    setProgress(normalized)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
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
    if (lessonDef.track === 'beginner') return true
    if (lessonDef.track === 'foundation') {
      return Boolean(progress.completedLessons['0'])
    }
    // Intermediate track unlocks after all foundation lessons are done.
    const foundation = LESSONS.filter((l) => l.track === 'foundation')
    return foundation.every((l) => Boolean(progress.completedLessons[String(l.id)]))
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
      return 'All checkpoints complete. Use the final recovery command pattern to finish.'
    }
    const modeValue = resolveHintMode()
    const rawHint = pending.hint || 'Run the next diagnostic or remediation command.'

    if (modeValue === 'beginner') {
      return rawHint
    }
    if (modeValue === 'standard') {
      const idx = rawHint.indexOf(':')
      return idx > -1 ? rawHint.slice(0, idx + 1) + ' use the right command family and namespace.' : rawHint
    }
    const keyword = rawHint.split(':')[0]
    return `${keyword}: exam-mode hint active, infer the exact command and flags.`
  }, [lesson, resolveHintMode, sessionState])

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

      const completeNow = lesson.checkpoints.every((cp) => nextState[cp.id])
      if (completeNow) {
        completeSession()
      }
    } else {
      write('\r\nCommand received. Not the next expected checkpoint. Type help for guidance.\r\n')
    }

    showPrompt()
  }, [completeSession, getPendingHint, lesson, remaining, sessionCommands, sessionState])

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

  const filteredLessons = LESSONS.filter((l) => l.track === lessonTrack)
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
  const lessonCompletionCount = Object.keys(progress.completedLessons).length
  const mockCompletionCount = Object.keys(progress.completedMocks).length
  const badges = [
    { label: 'First Incident Solved', unlocked: lessonCompletionCount >= 1 },
    { label: 'Service Surgeon', unlocked: lessonCompletionCount >= 2 },
    { label: 'Resource Guardian', unlocked: lessonCompletionCount >= 3 },
    { label: 'Networking Sentinel', unlocked: lessonCompletionCount >= 6 },
    { label: 'Mock Sprint Finisher', unlocked: mockCompletionCount >= 1 },
    { label: 'CKA Simulation Master', unlocked: mockCompletionCount >= 3 },
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

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={mode === 'lesson' ? 'primary' : ''}
                style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
                onClick={() => {
                  setMode('lesson')
                  const nextId = (LESSONS.find((l) => l.track === lessonTrack) || LESSONS[0]).id
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
            </div>

            {mode === 'lesson' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={lessonTrack === 'beginner' ? 'primary' : ''}
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px' }}
                  onClick={() => {
                    setLessonTrack('beginner')
                    const first = LESSONS.find((l) => l.track === 'beginner')
                    if (first) setActiveId(first.id)
                  }}
                >
                  Beginner Track
                </button>
                <button
                  className={lessonTrack === 'foundation' ? 'primary' : ''}
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px' }}
                  onClick={() => {
                    setLessonTrack('foundation')
                    const first = LESSONS.find((l) => l.track === 'foundation')
                    if (first) setActiveId(first.id)
                  }}
                >
                  Foundation Track
                </button>
                <button
                  className={lessonTrack === 'intermediate' ? 'primary' : ''}
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px' }}
                  onClick={() => {
                    setLessonTrack('intermediate')
                    const first = LESSONS.find((l) => l.track === 'intermediate')
                    if (first) setActiveId(first.id)
                  }}
                >
                  Intermediate Track
                </button>
              </div>
            ) : null}

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

            <div style={{ ...CARD, padding: 10 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 6 }}>Milestone Badges</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {badges.map((b) => (
                  <span
                    key={b.label}
                    style={{
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono',
                      padding: '4px 6px',
                      borderRadius: 6,
                      border: `1px solid ${b.unlocked ? '#3fb950' : '#30363d'}`,
                      color: b.unlocked ? '#3fb950' : '#8b949e',
                    }}
                  >
                    {b.unlocked ? 'UNLOCKED' : 'LOCKED'} {b.label}
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
                  {pendingCheckpoint ? pendingCheckpoint.hint || 'No hint available.' : 'All checkpoints done. Review recap quiz below.'}
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
                <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 7 }}>Checkpoint Roadmap</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {lessonCheckpoints.map((cp, idx) => (
                    <div key={cp.id} style={{ border: '1px solid #30363d', borderRadius: 8, padding: '8px 10px', background: '#0f1722' }}>
                      <div style={{ color: sessionState[cp.id] ? '#3fb950' : '#8b949e', fontSize: 12, fontFamily: 'JetBrains Mono' }}>
                        {sessionState[cp.id] ? 'DONE' : 'TODO'} {idx + 1}. {cp.hint || cp.explanation}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                        Why: {explainCheckpointWhy(cp)}
                      </div>
                    </div>
                  ))}
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
                    onClick={() => setQuizSubmitted(true)}
                    disabled={quizSubmitted || lessonRecap.some((q) => quizAnswers[q.id] === undefined)}
                  >
                    Submit Recap
                  </button>
                  {quizSubmitted ? (
                    <span style={{ color: '#3fb950', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                      Score: {recapScore}/{lessonRecap.length}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
