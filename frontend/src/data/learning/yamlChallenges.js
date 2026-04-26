import YAML from 'js-yaml'

export const YAML_CHALLENGES = [
  {
    id: 'yaml-1',
    track: 'foundation',
    type: 'yaml-challenge',
    domain: 'Services and Networking',
    title: 'YAML Challenge 1: Service + Deployment Selectors',
    objective: 'Write a Deployment and Service that work together via matching selectors.',
    brief: "You have two manifests that must coordinate: a Deployment running nginx and a Service that exposes it. The Deployment declares labels. The Service must use matching selectors to route traffic. Write both manifests — one wrong selector and the Service has zero endpoints.",
    philosophy: "In Kubernetes, coupling happens through labels. A Service that references a label nobody has declared will silently serve nothing. Label matching is one of the hardest bugs to see because the Service looks correct on paper.",
    clusterOverview: "Cluster: kubecrash-lab | Namespace: production | Goal: write Deployment + Service manifests | Validation: both must parse, Service selector must match Deployment pod labels, ports must align.",
    difficulty: 'medium',
    workflows: {
      blank: {
        prompt: 'Write a complete Deployment (3 replicas, nginx:1.21, label app=web) and a Service (type ClusterIP, port 80, selector matches deployment labels) from scratch.',
        template: `---
# Write your Deployment here
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-server
  namespace: production
spec:
  replicas: [ ]
  selector:
    matchLabels:
      [ ]: [ ]
  template:
    metadata:
      labels:
        [ ]: [ ]
    spec:
      containers:
      - name: nginx
        image: [ ]
        ports:
        - containerPort: [ ]
---
# Write your Service here
apiVersion: v1
kind: Service
metadata:
  name: web-service
  namespace: production
spec:
  type: [ ]
  selector:
    [ ]: [ ]
  ports:
  - protocol: TCP
    port: [ ]
    targetPort: [ ]
`,
        broken: `---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-server
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: web-service
  namespace: production
spec:
  type: ClusterIP
  selector:
    app: web
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
`,
      },
    },
    validationRules: [
      {
        id: 'syntax',
        name: 'YAML Syntax',
        check: (yaml) => {
          try {
            YAML.loadAll(yaml)
            return { pass: true }
          } catch (e) {
            return { pass: false, error: `YAML parse error: ${e.message}` }
          }
        },
      },
      {
        id: 'deployment-exists',
        name: 'Deployment Manifest',
        check: (yaml) => {
          try {
            const docs = []
            YAML.loadAll(yaml, (doc) => docs.push(doc))
            const deployment = docs.find((d) => d?.kind === 'Deployment')
            if (!deployment) return { pass: false, error: 'No Deployment manifest found' }
            if (!deployment.spec?.selector?.matchLabels) return { pass: false, error: 'Deployment missing spec.selector.matchLabels' }
            if (!deployment.spec?.template?.metadata?.labels) return { pass: false, error: 'Deployment pod template missing labels' }
            return { pass: true }
          } catch (e) {
            return { pass: false, error: `Validation error: ${e.message}` }
          }
        },
      },
      {
        id: 'service-exists',
        name: 'Service Manifest',
        check: (yaml) => {
          try {
            const docs = []
            YAML.loadAll(yaml, (doc) => docs.push(doc))
            const service = docs.find((d) => d?.kind === 'Service')
            if (!service) return { pass: false, error: 'No Service manifest found' }
            if (!service.spec?.selector) return { pass: false, error: 'Service missing spec.selector' }
            if (!service.spec?.ports) return { pass: false, error: 'Service missing spec.ports' }
            return { pass: true }
          } catch (e) {
            return { pass: false, error: `Validation error: ${e.message}` }
          }
        },
      },
      {
        id: 'selector-match',
        name: 'Selector Matching',
        check: (yaml) => {
          try {
            const docs = []
            YAML.loadAll(yaml, (doc) => docs.push(doc))
            const deployment = docs.find((d) => d?.kind === 'Deployment')
            const service = docs.find((d) => d?.kind === 'Service')
            if (!deployment || !service) return { pass: false, error: 'Missing Deployment or Service' }

            const depLabels = deployment.spec.template.metadata.labels || {}
            const svcSelector = service.spec.selector || {}

            // Check if service selector keys are subset of pod labels
            for (const key in svcSelector) {
              if (!(key in depLabels)) {
                return { pass: false, error: `Service selector key '${key}' not found in Deployment pod labels. Pod labels: ${Object.keys(depLabels).join(', ')}` }
              }
              if (depLabels[key] !== svcSelector[key]) {
                return { pass: false, error: `Service selector '${key}=${svcSelector[key]}' does not match pod label '${key}=${depLabels[key]}'` }
              }
            }
            return { pass: true, hint: 'Service selector matches Deployment pod labels ✓' }
          } catch (e) {
            return { pass: false, error: `Validation error: ${e.message}` }
          }
        },
      },
      {
        id: 'port-mapping',
        name: 'Port Mapping',
        check: (yaml) => {
          try {
            const docs = []
            YAML.loadAll(yaml, (doc) => docs.push(doc))
            const deployment = docs.find((d) => d?.kind === 'Deployment')
            const service = docs.find((d) => d?.kind === 'Service')
            if (!deployment || !service) return { pass: false, error: 'Missing Deployment or Service' }

            const depPorts = (deployment.spec.template.spec.containers?.[0]?.ports || []).map((p) => p.containerPort)
            const svcPorts = (service.spec.ports || []).map((p) => p.targetPort)

            for (const svcPort of svcPorts) {
              if (!depPorts.includes(svcPort)) {
                return {
                  pass: false,
                  error: `Service targetPort ${svcPort} not found in container ports. Available: ${depPorts.join(', ')}`,
                }
              }
            }
            return { pass: true, hint: 'All service targetPorts map to container ports ✓' }
          } catch (e) {
            return { pass: false, error: `Validation error: ${e.message}` }
          }
        },
      },
    ],
    quiz: [
      {
        id: 'q1',
        prompt: 'What happens if a Service selector does not match any Pod labels?',
        options: ['The Service becomes unhealthy', 'The Service has zero Endpoints and traffic is not routed to any pod', 'Kubernetes automatically creates matching labels'],
        correct: 1,
        explanation: 'A Service with no matching pods means zero endpoints. The Service object itself looks healthy, but it serves nothing — this silent failure is why label matching is critical.',
      },
      {
        id: 'q2',
        prompt: 'In a Deployment, where do you declare pod labels that a Service can select?',
        options: ['metadata.labels at the Deployment level', 'spec.template.metadata.labels (pod template labels)', 'spec.selector.matchLabels (selector, not labels)'],
        correct: 1,
        explanation: 'spec.selector.matchLabels tells the Deployment controller which pods to manage. spec.template.metadata.labels are the actual labels attached to each pod — those are what Services query.',
      },
      {
        id: 'q3',
        prompt: 'If a Service has port 80 but the container port is 8080, what should targetPort be?',
        options: ['80 (match the Service port)', '8080 (match the container port)', 'Leave it empty to auto-detect'],
        correct: 1,
        explanation: 'targetPort is the container port traffic routes to. It must match what the application inside the container is listening on. Service port 80 → targetPort 8080 means external traffic on 80 forwards to container:8080.',
      },
    ],
  },
  {
    id: 'yaml-2',
    track: 'intermediate',
    type: 'yaml-challenge',
    domain: 'Services and Networking',
    title: 'YAML Challenge 2: Ingress + TLS + NetworkPolicy',
    objective: 'Write an Ingress with TLS termination and enforce traffic with NetworkPolicy.',
    brief: "External users need HTTPS access to your service. The Ingress must reference a TLS secret. But you also need to restrict who can talk to the backend pods — deny by default except from the Ingress controller and monitoring. Write three manifests that work as a coherent traffic control system.",
    philosophy: "HTTPS at the edge and zero-trust networking at the pod level. This is production-grade security. Ingress without NetworkPolicy is wide open. NetworkPolicy without Ingress routing is pointless. They must be written as a pair.",
    clusterOverview: "Cluster: kubecrash-lab | External domain: app.kubecrash.local (needs HTTPS) | Backend: web-service:80 in production namespace | Security: TLS termination on Ingress, allow traffic only from ingress-nginx namespace and monitoring namespace.",
    difficulty: 'hard',
    workflows: {
      blank: {
        prompt: 'Write three manifests: (1) Ingress with TLS termination, (2) NetworkPolicy denying all ingress by default, (3) NetworkPolicy allowing traffic from ingress-nginx and monitoring namespaces.',
        template: `---
# Ingress with TLS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: [ ]
  namespace: [ ]
spec:
  ingressClassName: [ ]
  tls:
  - hosts:
    - [ ]
    secretName: [ ]
  rules:
  - host: [ ]
    http:
      paths:
      - path: [ ]
        pathType: [ ]
        backend:
          service:
            name: [ ]
            port:
              number: [ ]
---
# Deny all ingress NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: [ ]
  namespace: [ ]
spec:
  podSelector: [ ]
  policyTypes:
  - Ingress
---
# Allow from ingress and monitoring
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: [ ]
  namespace: [ ]
spec:
  podSelector:
    matchLabels:
      [ ]: [ ]
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: [ ]
    - namespaceSelector:
        matchLabels:
          name: [ ]
    ports:
    - protocol: TCP
      port: [ ]
`,
        broken: `---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: production
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - app.kubecrash.local
    secretName: app-tls
  rules:
  - host: app.kubecrash.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 80
`,
      },
    },
    validationRules: [
      {
        id: 'syntax',
        name: 'YAML Syntax',
        check: (yaml) => {
          try {
            YAML.loadAll(yaml)
            return { pass: true }
          } catch (e) {
            return { pass: false, error: `YAML parse error: ${e.message}` }
          }
        },
      },
      {
        id: 'ingress-exists',
        name: 'Ingress Manifest',
        check: (yaml) => {
          try {
            const docs = []
            YAML.loadAll(yaml, (doc) => docs.push(doc))
            const ingress = docs.find((d) => d?.kind === 'Ingress')
            if (!ingress) return { pass: false, error: 'No Ingress manifest found' }
            if (!ingress.spec?.tls) return { pass: false, error: 'Ingress missing spec.tls (TLS config required)' }
            if (!ingress.spec?.rules) return { pass: false, error: 'Ingress missing spec.rules' }
            return { pass: true }
          } catch (e) {
            return { pass: false, error: `Validation error: ${e.message}` }
          }
        },
      },
      {
        id: 'netpolicy-exists',
        name: 'NetworkPolicy Manifests',
        check: (yaml) => {
          try {
            const docs = []
            YAML.loadAll(yaml, (doc) => docs.push(doc))
            const policies = docs.filter((d) => d?.kind === 'NetworkPolicy')
            if (policies.length < 2) return { pass: false, error: 'Need at least 2 NetworkPolicies (deny-all + allow rules)' }
            return { pass: true }
          } catch (e) {
            return { pass: false, error: `Validation error: ${e.message}` }
          }
        },
      },
      {
        id: 'tls-secret-reference',
        name: 'TLS Secret Reference',
        check: (yaml) => {
          try {
            const docs = []
            YAML.loadAll(yaml, (doc) => docs.push(doc))
            const ingress = docs.find((d) => d?.kind === 'Ingress')
            if (!ingress) return { pass: false, error: 'Missing Ingress' }
            const secretName = ingress.spec?.tls?.[0]?.secretName
            if (!secretName) return { pass: false, error: 'Ingress TLS missing secretName' }
            if (!secretName.match(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/)) {
              return { pass: false, error: `Invalid secret name '${secretName}'. Must be lowercase alphanumeric with hyphens.` }
            }
            return { pass: true, hint: `TLS secret reference: ${secretName}` }
          } catch (e) {
            return { pass: false, error: `Validation error: ${e.message}` }
          }
        },
      },
      {
        id: 'backend-service-port',
        name: 'Backend Service Port',
        check: (yaml) => {
          try {
            const docs = []
            YAML.loadAll(yaml, (doc) => docs.push(doc))
            const ingress = docs.find((d) => d?.kind === 'Ingress')
            if (!ingress) return { pass: false, error: 'Missing Ingress' }
            const port = ingress.spec?.rules?.[0]?.http?.paths?.[0]?.backend?.service?.port?.number
            if (!port || port === 8080) {
              return {
                pass: false,
                error: `Ingress backend port should be 80 (service port), not ${port}. targetPort is handled by the Service, not Ingress.`,
              }
            }
            return { pass: true, hint: `Backend service port correctly set to ${port}` }
          } catch (e) {
            return { pass: false, error: `Validation error: ${e.message}` }
          }
        },
      },
      {
        id: 'netpolicy-deny-all',
        name: 'Deny-All Policy',
        check: (yaml) => {
          try {
            const docs = []
            YAML.loadAll(yaml, (doc) => docs.push(doc))
            const denyAll = docs.find((d) => d?.kind === 'NetworkPolicy' && Object.keys(d.spec?.podSelector || {}).length === 0)
            if (!denyAll) return { pass: false, error: 'Missing NetworkPolicy with empty podSelector (deny-all base policy)' }
            if (!denyAll.spec?.policyTypes?.includes('Ingress')) {
              return { pass: false, error: 'Deny-all policy missing Ingress in policyTypes' }
            }
            return { pass: true, hint: 'Deny-all ingress policy present' }
          } catch (e) {
            return { pass: false, error: `Validation error: ${e.message}` }
          }
        },
      },
    ],
    quiz: [
      {
        id: 'q1',
        prompt: 'In an Ingress TLS block, what does secretName refer to?',
        options: ['A Secret containing the certificate and private key', 'The name of the ingress-nginx deployment', 'A label selector for multiple secrets'],
        correct: 0,
        explanation: 'secretName points to a TLS-type Secret in the same namespace with keys tls.crt (certificate chain) and tls.key (private key). The Ingress controller reads it for HTTPS termination.',
      },
      {
        id: 'q2',
        prompt: 'What does the Ingress spec.rules[].backend.service.port refer to?',
        options: ['The container port inside the pod', 'The Service ClusterIP port (exposed port)', 'The node port for external access'],
        correct: 1,
        explanation: 'The port field in Ingress backend refers to the Service port, not the container port. The Service itself handles forwarding to targetPort on the container.',
      },
      {
        id: 'q3',
        prompt: 'A NetworkPolicy with empty podSelector and no ingress rules means?',
        options: ['All pods in the namespace can receive traffic from anywhere', 'All pods in the namespace are denied all ingress traffic', 'The policy applies only to pods without labels'],
        correct: 1,
        explanation: 'Empty podSelector = all pods. With policyTypes: [Ingress] and no ingress rules, it denies ALL ingress. This is the standard deny-all base policy; then add specific allow rules.',
      },
    ],
  },
]

export function validateYamlChallenge(challengeId, yamlText) {
  const challenge = YAML_CHALLENGES.find((c) => c.id === challengeId)
  if (!challenge) return { valid: false, errors: ['Challenge not found'] }

  const results = []
  let allPassed = true

  for (const rule of challenge.validationRules) {
    const result = rule.check(yamlText)
    results.push({
      rule: rule.name,
      pass: result.pass,
      error: result.error,
      hint: result.hint,
    })
    if (!result.pass) allPassed = false
  }

  return {
    valid: allPassed,
    results,
    score: {
      passed: results.filter((r) => r.pass).length,
      total: results.length,
      percent: Math.round((results.filter((r) => r.pass).length / results.length) * 100),
    },
  }
}
