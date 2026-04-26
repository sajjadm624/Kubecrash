/**
 * Advanced Learning Tracks: Observability, Security, GitOps, Cluster Ops
 * Portfolio-grade incident case studies with metrics, logs, traces, and retrospectives
 */

export const ADVANCED_TRACKS = [
  // ============================================
  // OBSERVABILITY TRACK
  // ============================================
  {
    id: 'obs-1',
    track: 'observability',
    trackTitle: 'Observability & Monitoring',
    trackColor: '#58a6ff',
    domain: 'Monitoring & Metrics',
    title: 'Prometheus 101: Query Basics & Alerting',
    objective: 'Learn to write PromQL queries, understand rate calculations, and craft effective alert rules',
    difficulty: 'beginner',
    briefTitle: 'The Silent Spike',
    brief: `Your API is responding slower than usual, but there are no error logs. The ops team is pointing at a dashboard showing 85% CPU utilization on prod-api nodes, but they can't find which process is consuming it. You check the monitoring system—Prometheus is running, but the on-call engineer admits they've never written a custom query. Your job: pull metrics that show exactly which container is hogging CPU, then set up an alert that would have caught this earlier.`,
    philosophy: `Metrics are time-series data points: (timestamp, value, labels). A "query" is asking "Show me all CPU measurements where instance=prod-api in the last hour." The magic is in aggregation functions—rate() calculates slope (bytes per second), sum() combines them, histogram_quantile() finds percentiles. Without queries, you're blind in your own cluster.`,
    clusterOverview: `
Cluster: obs-lab-prod
Namespace: production
Nodes: 3 (prod-api-1, prod-api-2, prod-api-3)
Running: Prometheus scrapes every 15s

Current Metrics Available:
- container_cpu_usage_seconds_total (counter)
- container_memory_usage_bytes (gauge)
- http_request_duration_seconds_bucket (histogram)
- http_requests_total (counter)

Your task: Query CPU spike root cause and create alert rule.
    `,
    quiz: [
      {
        id: 'obs-1-q1',
        prompt: 'What does rate(http_requests_total[5m]) calculate?',
        options: [
          'Average requests across all 5-minute intervals',
          'Number of requests in the last 5 minutes',
          'Average request rate (requests/second) over the last 5 minutes',
          'Maximum requests per second in the last 5 minutes',
        ],
        correct: 2,
        explanation:
          'rate() calculates the per-second rate of change, extrapolating from the time window. rate(x[5m]) = slope of x over 5 minutes converted to /sec. Essential for understanding throughput spikes.',
      },
      {
        id: 'obs-1-q2',
        prompt: 'You see cpu_usage at 85%. What query would show which pod caused it?',
        options: [
          'cpu_usage where pod=prod-api',
          'sum(rate(container_cpu_usage_seconds_total[5m])) by (pod)',
          'avg(cpu_usage) by (pod)',
          'histogram_quantile(0.95, cpu_usage)',
        ],
        correct: 1,
        explanation:
          'sum() aggregates CPU seconds by pod name. The rate() converts counter (cumulative) to per-second consumption. By (pod) groups results. This shows which pod owns the CPU.',
      },
      {
        id: 'obs-1-q3',
        prompt: 'What does an alert rule need to prevent false positives?',
        options: [
          'Multiple data points (for=2m prevents flakiness)',
          'Static threshold only',
          'External webhook notification',
          'Manual email to team',
        ],
        correct: 0,
        explanation:
          'A single spike can trigger noise. Using for=2m says "only alert if this condition is true for 2 minutes." Prevents single-blip alerts. Professional SLO practice.',
      },
    ],
    checkpoints: [
      {
        id: 'obs-1-cp1',
        title: 'Query container CPU usage by pod',
        concept: 'Write a PromQL query to find which pod uses most CPU',
        command:
          'kubectl exec prometheus-0 -- promtool query instant "sum(rate(container_cpu_usage_seconds_total{namespace=\\"production\\"}[5m])) by (pod)"',
        validation: (output) => output.includes('prod-api-0') && output.includes('cpu'),
        hint: 'Use sum() with rate() to aggregate CPU seconds into per-second usage. Group by pod.',
      },
      {
        id: 'obs-1-cp2',
        title: 'Write alert rule for CPU > 75%',
        concept: 'Create PrometheusRule that fires when CPU stays high for 2+ minutes',
        command:
          'kubectl apply -f - <<EOF\napiVersion: monitoring.coreos.com/v1\nkind: PrometheusRule\nmetadata:\n  name: cpu-alert\nspec:\n  groups:\n  - name: prod\n    interval: 30s\n    rules:\n    - alert: HighCPU\n      expr: sum(rate(container_cpu_usage_seconds_total{namespace="production"}[5m])) by (pod) > 0.75\n      for: 2m\nEOF',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'Alert rules need: expr (threshold), for (duration), and action. for=2m prevents noise.',
      },
      {
        id: 'obs-1-cp3',
        title: 'Verify alert rule in Prometheus',
        concept: 'Check the alert rule fired and shows in pending state',
        command: 'kubectl port-forward -n monitoring prometheus-0 9090:9090 &\n# Visit http://localhost:9090/alerts',
        validation: (output) => output.includes('HighCPU'),
        hint: 'Prometheus web UI at /alerts shows all rules. Pending = threshold exceeded but for= not yet reached.',
      },
    ],
    envValues: [
      { key: 'PROMETHEUS_URL', value: 'http://prometheus:9090', env: 'all' },
      { key: 'ALERT_THRESHOLD_CPU', value: '0.75', env: 'production' },
    ],
    docs: [
      { title: 'PromQL Tutorial', url: 'https://prometheus.io/docs/prometheus/latest/querying/basics/' },
      { title: 'rate() Function', url: 'https://prometheus.io/docs/prometheus/latest/querying/functions/#rate' },
      { title: 'Alerting Rules', url: 'https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/' },
    ],
    timeLimit: 900,
  },

  {
    id: 'obs-2',
    track: 'observability',
    trackTitle: 'Observability & Monitoring',
    trackColor: '#58a6ff',
    domain: 'Log Aggregation',
    title: 'Log Aggregation Crisis: Finding the Needle',
    objective: 'Correlate logs across multiple services to find the root cause of a transaction failure',
    difficulty: 'intermediate',
    briefTitle: 'Payment Processing Blackhole',
    brief: `Users report payments are failing silently—no error in the UI, but money never arrives. Your logs are split across three services: API gateway (100 req/s), payment-service (50 req/s), and db-audit (async writes). Logs span JSON, plain text, and structured formats. You need to find: (1) the failed transaction ID, (2) where it failed (API? payment? DB?), (3) the error message. Total log volume: 50MB in the last 5 minutes. Manual scrolling is impossible.`,
    philosophy: `Distributed systems emit logs everywhere, but raw logs without correlation are noise. The bridge is the request ID (or transaction ID)—a unique string that flows through every service. By searching "txn_id=abc123" across all services, you see the entire journey. Logs are your audit trail and debugging superhero when combined with correlation IDs.`,
    clusterOverview: `
Cluster: prod-payments
Namespace: payments
Running: ELK Stack (Elasticsearch, Logstash, Kibana)

Logs from:
- api-gateway (requests, correlationID)
- payment-service (transaction processing, errors)
- db-audit (database writes, checksums)
- payment-processor (external API calls)

Failing transaction: txn_id=TXN-2024-04-26-00847
All logs available in Elasticsearch index 'logs-payments-*'
    `,
    quiz: [
      {
        id: 'obs-2-q1',
        prompt: 'Why is a correlation ID essential in microservices logging?',
        options: [
          'It tags every log entry from a single request across all services',
          'It encrypts sensitive data in logs',
          'It compresses log file sizes',
          'It notifies the team of errors',
        ],
        correct: 0,
        explanation:
          'A correlation ID (or trace ID) is injected into a request and propagated through all services. Each log entry includes it. Searching by ID shows the entire flow: API → payment-service → DB. Without it, you\'re lost in 50MB of logs.',
      },
      {
        id: 'obs-2-q2',
        prompt: 'You search for txn_id=TXN-123 and find logs from api-gateway but nothing from payment-service. What does this mean?',
        options: [
          'Transaction never reached payment-service (failed in API)',
          'Payment-service logs are in a different index',
          'Payment-service is down',
          'Transaction succeeded (no errors logged)',
        ],
        correct: 0,
        explanation:
          'If logs stop at the API, the transaction never progressed downstream. This is your root cause: API layer rejected it. Check API logs for the error message and status code.',
      },
      {
        id: 'obs-2-q3',
        prompt: 'Best practice for log aggregation query language?',
        options: [
          'Full-text search to find any mention of the transaction ID',
          'Structure logs with fields (level, service, txn_id, error) and query fields precisely',
          'Search only error logs (reduces noise)',
          'Tail live logs from each service manually',
        ],
        correct: 1,
        explanation:
          'Structured logging (JSON with parsed fields) enables precise queries. ELK Kibana KQL: level:ERROR AND txn_id:TXN-123 AND service:payment-service. Unstructured text search is slow and unreliable.',
      },
    ],
    checkpoints: [
      {
        id: 'obs-2-cp1',
        title: 'Query logs by transaction ID',
        concept: 'Find all log entries for failed transaction across all services',
        command:
          'kubectl exec -it elasticsearch-0 -- curl -X GET "localhost:9200/logs-payments-*/_search" -H "Content-Type: application/json" -d\'{"query":{"match":{"txn_id":"TXN-2024-04-26-00847"}}}\'',
        validation: (output) => output.includes('TXN-2024-04-26-00847'),
        hint: 'Use Elasticsearch match query on txn_id field. Response shows all services that logged this transaction.',
      },
      {
        id: 'obs-2-cp2',
        title: 'Identify which service logged the error',
        concept: 'Find which service has level:ERROR and txn_id match',
        command:
          'kubectl exec -it elasticsearch-0 -- curl -X GET "localhost:9200/logs-payments-*/_search" -H "Content-Type: application/json" -d\'{"query":{"bool":{"must":[{"match":{"txn_id":"TXN-2024-04-26-00847"}},{"match":{"level":"ERROR"}}]}}}\'',
        validation: (output) => output.includes('error') || output.includes('payment-service'),
        hint: 'Use bool query with must clauses: txn_id AND level=ERROR. Response shows which service threw the error.',
      },
      {
        id: 'obs-2-cp3',
        title: 'Extract root cause from error message',
        concept: 'Pull error message from logs and understand failure reason',
        command: 'kubectl logs -l app=payment-service --tail=500 | grep TXN-2024-04-26-00847 | head -5',
        validation: (output) => output.includes('error') || output.includes('insufficient'),
        hint: 'Once you know which service failed, grep logs for the error message. Look for: insufficient funds, network timeout, database constraint, etc.',
      },
    ],
    envValues: [
      { key: 'ELASTICSEARCH_URL', value: 'http://elasticsearch:9200', env: 'all' },
      { key: 'CORRELATION_ID_HEADER', value: 'X-Correlation-ID', env: 'all' },
    ],
    docs: [
      { title: 'Structured Logging Best Practices', url: 'https://www.elastic.co/blog/what-is-structured-logging' },
      { title: 'ELK Stack Query DSL', url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html' },
    ],
    timeLimit: 1200,
  },

  {
    id: 'obs-3',
    track: 'observability',
    trackTitle: 'Observability & Monitoring',
    trackColor: '#58a6ff',
    domain: 'Distributed Tracing',
    title: 'Distributed Tracing: End-to-End Request Flow',
    objective: 'Use trace spans to find which service is causing 500ms latency in an otherwise fast request',
    difficulty: 'intermediate',
    briefTitle: 'The Slow API Mystery',
    brief: `Your frontend reports API calls taking 700ms to complete, but individual services (API gateway, auth, business logic, database) all show < 200ms latency. The slowness is somewhere in the choreography—either network delays, serialization overhead, or queuing. You need traces: atomic units of work (spans) with timestamps showing when each service started and stopped. By examining span timing and dependencies, you'll find the bottleneck.`,
    philosophy: `A request flows through multiple services. Each service should emit a span (startTime, endTime, service_name, operation). Spans nest: API gateway → auth service → business logic → DB. By analyzing span duration and dependencies, you see where time is spent. A trace is the tree of all spans for one request ID. Latency often hides in the tree structure—network roundtrips, serialization, or queueing.`,
    clusterOverview: `
Cluster: prod-trace
Namespace: production
Tracing Backend: Jaeger (all spans exported here)

Services (each emits spans):
- api-gateway (receives request, orchestrates)
- auth-service (validates JWT, 10ms avg)
- product-service (fetches product data, 20ms avg)
- inventory-service (checks stock, 15ms avg)
- cart-service (calculates totals, 25ms avg)
- payment-service (charges card, 30ms avg)

Problem request trace ID: trace-2024-04-26-xyz789
Expected total: ~140ms. Actual: 700ms.
    `,
    quiz: [
      {
        id: 'obs-3-q1',
        prompt: 'What is a span in distributed tracing?',
        options: [
          'A log entry from one service',
          'An atomic unit of work: (service, operation_name, startTime, endTime, tags)',
          'A network packet between services',
          'A CPU measurement over time',
        ],
        correct: 1,
        explanation:
          'A span represents one operation in one service. It has timestamps (when it started and stopped), a name (what operation), and tags (contextual data like user_id). Spans combine into a trace.',
      },
      {
        id: 'obs-3-q2',
        prompt: 'Your trace shows: API→Auth (10ms) → Product (50ms) → Inventory (15ms) → Cart (100ms). Cart is slow. What\'s the first thing to check?',
        options: [
          'Optimize cart-service code',
          'Check if cart-service is calling other services (nested spans)',
          'Increase Cart pod CPU',
          'Buy faster servers',
        ],
        correct: 1,
        explanation:
          'A 100ms cart operation might be fast for what it does (e.g., calling 5 services in sequence = 100ms total). Check cart-service spans: is it waiting on auth again? DB? Network? The nested spans reveal the truth.',
      },
      {
        id: 'obs-3-q3',
        prompt: 'You see a trace with a gap (no span) between Auth (10ms) and Product (50ms). What likely happened?',
        options: [
          'There\'s a 40ms network delay between services',
          'The trace is incomplete (Product service didn\'t emit span)',
          'Auth service crashed',
          'A bug in the tracing library',
        ],
        correct: 0,
        explanation:
          'If Auth finishes at T=10ms and Product starts at T=50ms, there\'s 40ms of unaccounted time. This is likely network + serialization overhead. Spans show service work; gaps show infrastructure delays.',
      },
    ],
    checkpoints: [
      {
        id: 'obs-3-cp1',
        title: 'Retrieve full trace from Jaeger',
        concept: 'Pull trace ID and examine all spans in order',
        command:
          'curl -X GET "http://jaeger:16686/api/traces/trace-2024-04-26-xyz789" | jq \'.data[0].spans[] | {operationName, duration, serviceName}\'',
        validation: (output) => output.includes('duration') && output.includes('serviceName'),
        hint: 'Jaeger API returns spans for a trace ID. Extract duration and service name to see the timeline.',
      },
      {
        id: 'obs-3-cp2',
        title: 'Identify slowest span in trace',
        concept: 'Find which service consumed the most time',
        command:
          'curl -X GET "http://jaeger:16686/api/traces/trace-2024-04-26-xyz789" | jq -r \'.data[0].spans | sort_by(.duration) | .[-1] | "Service: \\(.process.serviceName), Duration: \\(.duration)us"\'',
        validation: (output) => output.includes('Duration') && output.includes('Service'),
        hint: 'Sort spans by duration (microseconds). The last one is slowest. Compare to expected latency to find the outlier.',
      },
      {
        id: 'obs-3-cp3',
        title: 'Check for nested calls in slow span',
        concept: 'Inspect what the slow service was doing (child spans)',
        command:
          'curl -X GET "http://jaeger:16686/api/traces/trace-2024-04-26-xyz789" | jq \'.data[0].spans[] | select(.operationName=="cart.calculate") | {spanID, references}\'',
        validation: (output) => output.includes('spanID') || output.includes('references'),
        hint: 'Slow span might have child spans (references field). Analyze children to see if they called other services.',
      },
    ],
    envValues: [
      { key: 'JAEGER_AGENT_HOST', value: 'jaeger-agent', env: 'all' },
      { key: 'JAEGER_SAMPLER_TYPE', value: 'const', env: 'all' },
      { key: 'JAEGER_SAMPLER_PARAM', value: '1', env: 'all' },
    ],
    docs: [
      { title: 'Jaeger Tracing Overview', url: 'https://www.jaegertracing.io/docs/latest/' },
      { title: 'OpenTelemetry Tracing', url: 'https://opentelemetry.io/docs/concepts/signals/traces/' },
      { title: 'Span Naming Best Practices', url: 'https://opentelemetry.io/docs/specs/otel/trace/semantic_conventions/' },
    ],
    timeLimit: 1200,
  },

  {
    id: 'obs-4',
    track: 'observability',
    trackTitle: 'Observability & Monitoring',
    trackColor: '#58a6ff',
    domain: 'Multi-Signal Analysis',
    title: 'Multi-Signal Analysis: Metrics + Logs + Traces',
    objective: 'Combine metrics, logs, and traces to diagnose a complex, multi-layer failure',
    difficulty: 'hard',
    briefTitle: 'The Perfect Storm: Cascading Failure',
    brief: `Production outage: 40% of requests fail with 504 Gateway Timeout. Your SRE team is overwhelmed. You have three data streams: (1) Prometheus metrics show node CPU throttling at 95% on db-leader, (2) Elasticsearch logs show connection pool exhaustion in payment-service, (3) Jaeger traces show requests hanging in cart-service waiting for database connections. The truth: database load spike → connection pool depleted → services queue requests → timeout. You need to correlate all three signals to present a clear root cause and remediation plan.`,
    philosophy: `No single signal tells the whole story. Metrics show "what" (high CPU, timeouts). Logs show "why" (connection pool error, which request failed). Traces show "where" (which service is blocking). Combining all three: "Database is overloaded (metrics) because of connection exhaustion (logs) because cart-service is holding connections too long (traces). Fix: optimize cart queries or increase connection pool (remediation)."`,
    clusterOverview: `
Cluster: prod-critical
Namespace: production

Components:
- Prometheus: Metrics (CPU, memory, connections, query time)
- ELK Stack: Logs (errors, warnings, transaction details)
- Jaeger: Traces (end-to-end request flow)

Incident:
- Start time: 2024-04-26T14:30:00Z
- Duration: 45 minutes
- Impact: 40% error rate, 504 timeouts
- Root: Database connection pool exhaustion

Your job: Pull data from all three systems and present unified diagnosis.
    `,
    quiz: [
      {
        id: 'obs-4-q1',
        prompt: 'You see metrics (CPU spike) + logs (connection error) + traces (hanging). What\'s the correct diagnosis?',
        options: [
          'CPU spike caused the errors (CPU is the root)',
          'Connection pool error caused CPU spike (connection exhaustion → queuing → CPU)',
          'They\'re unrelated (correlation ≠ causation)',
          'Database crashed',
        ],
        correct: 1,
        explanation:
          'Timeline is key. If connection pool exhaustion happened first, services queue requests, CPU increases. The true root: connection management. Metrics and logs must align in time to establish causation.',
      },
      {
        id: 'obs-4-q2',
        prompt: 'How do you link a Prometheus alert to a specific request in Elasticsearch?',
        options: [
          'Use the timestamp and service name to find logs in the same time window',
          'Prometheus and Elasticsearch are separate (no linking)',
          'Add correlation ID in the alert and search logs for it',
          'Ask the ops team to manually correlate',
        ],
        correct: 0,
        explanation:
          'Time-based correlation: Prometheus alert fires at T=14:30. Search ELK logs for errors in T=14:29:50 to 14:30:10. Same timeframe + service name usually finds the corresponding log events.',
      },
      {
        id: 'obs-4-q3',
        prompt: 'What should your incident summary include?',
        options: [
          'Just the error messages from logs',
          'Metrics showing the problem + logs explaining why + trace showing where + timeline',
          'Just the Jaeger trace ID',
          'A guess about what happened',
        ],
        correct: 1,
        explanation:
          'Professional incident reports include: (1) what broke (metrics/dashboard), (2) why (logs/error details), (3) where (traces/service map), (4) timeline (when each signal peaked). This enables fast diagnosis and prevents recurrence.',
      },
    ],
    checkpoints: [
      {
        id: 'obs-4-cp1',
        title: 'Pull metrics showing resource spike',
        concept: 'Query Prometheus for CPU/memory/connection metrics at incident time',
        command:
          'curl -X GET \'http://prometheus:9090/api/v1/query\' --data-urlencode \'query=max(node_cpu_seconds_total{node="db-leader"}) - min(node_cpu_seconds_total{node="db-leader"})\' --data-urlencode \'time=1714156200\'',
        validation: (output) => output.includes('value') && output.includes('db-leader'),
        hint: 'Query at the incident timestamp (14:30 UTC). Extract CPU/memory/connections to establish baseline metrics.',
      },
      {
        id: 'obs-4-cp2',
        title: 'Find error logs in ELK at incident time',
        concept: 'Search logs for connection pool errors in the incident window',
        command:
          'curl -X GET "http://elasticsearch:9200/logs-*/_search" -H "Content-Type: application/json" -d\'{"query":{"bool":{"must":[{"range":{"timestamp":{"gte":"2024-04-26T14:29:50Z","lte":"2024-04-26T14:30:10Z"}}},{"match":{"message":"connection pool"}}]}}}\'',
        validation: (output) => output.includes('connection pool') || output.includes('exhausted'),
        hint: 'Use time range (±20s around incident start) + keyword. Response should show connection errors.',
      },
      {
        id: 'obs-4-cp3',
        title: 'Retrieve traces with errors in window',
        concept: 'Find traces that errored during incident and analyze span hierarchy',
        command:
          'curl -X GET "http://jaeger:16686/api/traces" --data-urlencode "service=payment-service" --data-urlencode "tags=error=true" | jq \'.data[] | select(.duration > 30000) | {traceID, duration, spanCount}\'',
        validation: (output) => output.includes('traceID') && output.includes('duration'),
        hint: 'Filter traces by service + error tag + long duration (>30s = timeout). This shows requests that timed out.',
      },
      {
        id: 'obs-4-cp4',
        title: 'Correlate signals: write incident summary',
        concept: 'Synthesize metrics + logs + traces into clear root cause + remediation',
        command:
          'kubectl exec -it admin-pod -- cat > /tmp/incident_summary.txt << EOF\nIncident: 504 Timeout Outage\nTime: 2024-04-26 14:30 UTC\nDuration: 45 minutes\n\nMetrics:\n- db-leader CPU: 95% (spike)\n- Connection pool: 100/100 (exhausted)\n\nLogs:\n- payment-service: "connection pool exhausted, rejecting requests"\n- cart-service: "waiting for DB connection (30s+)"\n\nTraces:\n- 40% of requests timeout in cart → DB span\n- Normal cart → DB latency: 20ms. Incident: 35,000ms\n\nRoot Cause: Cart queries taking too long (DB overload) → connection pool filled → timeouts\nRemediation: (1) Optimize cart queries (add index), (2) Increase connection pool, (3) Add circuit breaker\nEOF',
        validation: (output) => output.includes('Root Cause') || output.includes('Remediation'),
        hint: 'Incident summary should connect the dots: metrics → logs → traces → root cause → fix.',
      },
    ],
    envValues: [
      { key: 'INCIDENT_TIMESTAMP', value: '2024-04-26T14:30:00Z', env: 'all' },
      { key: 'CORRELATION_WINDOW', value: '60s', env: 'all' },
    ],
    docs: [
      { title: 'Observability Best Practices', url: 'https://www.observability.engineering/' },
      { title: 'SRE Incident Response', url: 'https://sre.google/books/' },
    ],
    timeLimit: 1800,
  },

  // ============================================
  // SECURITY TRACK
  // ============================================
  {
    id: 'sec-1',
    track: 'security',
    trackTitle: 'Security & Access Control',
    trackColor: '#f85149',
    domain: 'RBAC & Authorization',
    title: 'RBAC Foundations: Roles, Bindings & Service Accounts',
    objective: 'Design and implement fine-grained access control using Kubernetes RBAC',
    difficulty: 'beginner',
    briefTitle: 'The Unauthorized Data Access',
    brief: `A junior developer accidentally accessed production database secrets that shouldn't be available to them. Investigation reveals: no RBAC policy restricted what they could view. Everyone had cluster-admin role. Your job: (1) create a custom Role limiting devs to read-only pods/logs in namespace "development", (2) create a service account for the app, (3) bind the role to the service account via RoleBinding. Result: developers can debug their pods but can't modify resources or access secrets.`,
    philosophy: `RBAC is the principle of least privilege: each user/service gets only permissions they need. Three components: (1) Role defines what actions (verbs: get, list, create) are allowed on what resources (pods, secrets, services). (2) ServiceAccount is an identity in Kubernetes. (3) RoleBinding connects them: "ServiceAccount X can perform Role Y in namespace Z". Without RBAC, any pod can read all secrets—disaster.`,
    clusterOverview: `
Cluster: secure-prod
Namespaces: production, staging, development

Problem:
- Developers role currently has: "*" (all verbs) on "*" (all resources)
- No enforcement of read-only vs write

Solution:
- Create Role: dev-readonly (get, list, watch on pods, logs)
- Create ServiceAccount: dev-app
- Create RoleBinding: dev-app → dev-readonly in namespace development
    `,
    quiz: [
      {
        id: 'sec-1-q1',
        prompt: 'What does a ClusterRole do vs a Role?',
        options: [
          'Role is namespace-scoped, ClusterRole is cluster-wide',
          'They\'re identical (just different names)',
          'ClusterRole can only grant cluster-admin',
          'Role is for users, ClusterRole is for service accounts',
        ],
        correct: 0,
        explanation:
          'Role grants permissions in one namespace. ClusterRole is cluster-wide (all namespaces). RoleBinding uses Role; ClusterRoleBinding uses ClusterRole. Security best practice: use Role + RoleBinding (least privilege = most namespaces).',
      },
      {
        id: 'sec-1-q2',
        prompt: 'You want to let a developer read pod logs but NOT delete pods. What should you do?',
        options: [
          'Give them admin role (trust them not to delete)',
          'Create a custom Role with verbs: [get, list, watch] on resources: [pods, pods/log]',
          'Tell them to ask ops for permissions each time',
          'Give them read-only role on entire cluster',
        ],
        correct: 1,
        explanation:
          'Custom Role with specific verbs (get, list, watch = read operations) on specific resources (pods, pods/log). The verb "delete" is not included. This enforces the policy technically, not by trust.',
      },
      {
        id: 'sec-1-q3',
        prompt: 'A user has a RoleBinding in namespace "development" but tries to access a pod in "production". What happens?',
        options: [
          'Access granted (RBAC is global)',
          'Access denied (RoleBinding is namespace-scoped)',
          'Access denied for 5 minutes then granted',
          'User is prompted for extra authentication',
        ],
        correct: 1,
        explanation:
          'RoleBinding grants permissions in one namespace only. To access production, they need a separate RoleBinding in the production namespace. This is the foundation of namespace isolation.',
      },
    ],
    checkpoints: [
      {
        id: 'sec-1-cp1',
        title: 'Create custom Role for read-only developers',
        concept: 'Define a Role with get/list/watch on pods and logs',
        command:
          'kubectl apply -f - <<EOF\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: dev-readonly\n  namespace: development\nrules:\n- apiGroups: [""]\n  resources: [pods, pods/log]\n  verbs: [get, list, watch]\nEOF',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'Role specifies apiGroups (empty "" = core), resources (pods, pods/log), verbs (read operations only).',
      },
      {
        id: 'sec-1-cp2',
        title: 'Create ServiceAccount for dev app',
        concept: 'Create a service account that the app will use',
        command:
          'kubectl apply -f - <<EOF\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: dev-app\n  namespace: development\nEOF',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'ServiceAccount is the identity. The app will authenticate using this account\'s token.',
      },
      {
        id: 'sec-1-cp3',
        title: 'Bind Role to ServiceAccount',
        concept: 'Create RoleBinding connecting dev-app to dev-readonly role',
        command:
          'kubectl apply -f - <<EOF\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: dev-app-bind\n  namespace: development\nroleRef:\n  apiGroup: rbac.authorization.k8s.io\n  kind: Role\n  name: dev-readonly\nsubjects:\n- kind: ServiceAccount\n  name: dev-app\n  namespace: development\nEOF',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'RoleBinding is the glue: it says "dev-app (subject) can perform dev-readonly (role) actions in development namespace".',
      },
      {
        id: 'sec-1-cp4',
        title: 'Verify RBAC policy by testing',
        concept: 'Confirm dev-app can list pods but cannot delete them',
        command:
          'kubectl auth can-i list pods --as=system:serviceaccount:development:dev-app --namespace=development && kubectl auth can-i delete pods --as=system:serviceaccount:development:dev-app --namespace=development',
        validation: (output) => output.includes('yes') && output.includes('no'),
        hint: 'kubectl auth can-i tests if a subject can perform an action. Should show: yes (list) + no (delete).',
      },
    ],
    envValues: [
      { key: 'DEV_NAMESPACE', value: 'development', env: 'all' },
      { key: 'SERVICE_ACCOUNT', value: 'dev-app', env: 'all' },
    ],
    docs: [
      { title: 'Kubernetes RBAC', url: 'https://kubernetes.io/docs/reference/access-authn-authz/rbac/' },
      { title: 'RBAC Best Practices', url: 'https://kubernetes.io/docs/concepts/security/rbac-good-practices/' },
    ],
    timeLimit: 900,
  },

  {
    id: 'sec-2',
    track: 'security',
    trackTitle: 'Security & Access Control',
    trackColor: '#f85149',
    domain: 'Network Security',
    title: 'NetworkPolicy Deep Dive: Microsegmentation',
    objective: 'Implement deny-all policies and whitelist allowed traffic between services',
    difficulty: 'intermediate',
    briefTitle: 'Ransomware Lateral Movement',
    brief: `Security audit reveals: if one pod is compromised, it can reach any other pod (database, secrets, everything) due to flat network. A ransomware attack could spread pod-to-pod in seconds. Your task: implement NetworkPolicy to (1) deny all ingress by default, (2) allow only necessary traffic (API ← frontend, DB ← API, auth ← API), (3) log policy violations. Result: compromised pod is isolated—can't move laterally.`,
    philosophy: `Kubernetes networking is open by default: any pod can reach any other pod. NetworkPolicy is a firewall inside the cluster. It enforces: "traffic from X to Y on port Z is allowed; all else denied." This is microsegmentation—breaking the cluster into security zones. A compromised pod can't "spray and pray" to find secrets; it's walled off.`,
    clusterOverview: `
Cluster: secure-prod
Namespace: production

Services:
- frontend (port 3000, needs to reach api-gateway)
- api-gateway (port 8080, needs to reach auth, payment, product)
- auth-service (port 5000, only auth needs to reach it)
- product-service (port 6000, only api needs to reach it)
- postgres-db (port 5432, only api needs to reach it)
- redis-cache (port 6379, shared access)

Current: No NetworkPolicy (flat network)
Goal: Whitelist only necessary paths
    `,
    quiz: [
      {
        id: 'sec-2-q1',
        prompt: 'What does a deny-all NetworkPolicy do?',
        options: [
          'Blocks traffic from specific IPs',
          'Allows all traffic by default',
          'Denies ALL ingress traffic unless explicitly allowed by other policies',
          'Encrypts traffic between pods',
        ],
        correct: 2,
        explanation:
          'A default deny NetworkPolicy has no rules (empty ingress list). Any pod with this policy selected won\'t accept traffic unless another NetworkPolicy explicitly allows it. It\'s the security default.',
      },
      {
        id: 'sec-2-q2',
        prompt: 'You want to allow traffic from frontend pod to api-gateway pod. How do you specify this?',
        options: [
          'Use NetworkPolicy with podSelector: {app: api-gateway} and from: {podSelector: {app: frontend}}',
          'Open all ports on api-gateway',
          'Create firewall rule in the cloud provider',
          'Tell both pods to trust each other',
        ],
        correct: 0,
        explanation:
          'NetworkPolicy specifies: to (podSelector selects destination), from (podSelector selects source), ports. This says "pods labeled app=api-gateway accept traffic from pods labeled app=frontend on port 8080".',
      },
      {
        id: 'sec-2-q3',
        prompt: 'A compromise: frontend is breached. It tries to reach postgres-db directly. What stops it?',
        options: [
          'RBAC (role-based access control)',
          'NetworkPolicy: postgres-db only allows traffic from api-gateway, not frontend',
          'Firewall at OS level',
          'The database password',
        ],
        correct: 1,
        explanation:
          'NetworkPolicy is the network firewall. Even if the frontend pod is compromised, the kernel enforces NetworkPolicy rules: traffic to postgres-db is denied (not in whitelist), so the packet is dropped.',
      },
    ],
    checkpoints: [
      {
        id: 'sec-2-cp1',
        title: 'Create default deny NetworkPolicy',
        concept: 'Apply a deny-all ingress policy to the namespace',
        command:
          'kubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny-ingress\n  namespace: production\nspec:\n  podSelector: {}\n  policyTypes:\n  - Ingress\nEOF',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'Empty podSelector {} applies to all pods. Ingress: [] (implicit deny all). No pod can receive traffic without explicit allow.',
      },
      {
        id: 'sec-2-cp2',
        title: 'Allow frontend → api-gateway traffic',
        concept: 'Whitelist traffic from frontend to api-gateway on port 8080',
        command:
          'kubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-frontend-to-api\n  namespace: production\nspec:\n  podSelector:\n    matchLabels:\n      app: api-gateway\n  policyTypes:\n  - Ingress\n  ingress:\n  - from:\n    - podSelector:\n        matchLabels:\n          app: frontend\n    ports:\n    - protocol: TCP\n      port: 8080\nEOF',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'Destination: api-gateway. From: frontend. Port: 8080. This creates the whitelist.',
      },
      {
        id: 'sec-2-cp3',
        title: 'Allow api-gateway → postgres-db traffic',
        concept: 'Whitelist traffic from api-gateway to database on port 5432',
        command:
          'kubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-api-to-db\n  namespace: production\nspec:\n  podSelector:\n    matchLabels:\n      app: postgres\n  policyTypes:\n  - Ingress\n  ingress:\n  - from:\n    - podSelector:\n        matchLabels:\n          app: api-gateway\n    ports:\n    - protocol: TCP\n      port: 5432\nEOF',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'Database only accepts from api-gateway. Blocks direct access from frontend or other services.',
      },
      {
        id: 'sec-2-cp4',
        title: 'Test policy isolation',
        concept: 'Verify frontend can reach api-gateway but not postgres-db',
        command:
          'kubectl run test-pod --image=busybox -n production -it -- sh -c "nc -zv api-gateway 8080" 2>&1 | head -1 && kubectl run test-pod2 --image=busybox -n production -it -- sh -c "nc -zv postgres-db 5432" 2>&1 | head -1',
        validation: (output) => (output.includes('succeeded') || output.includes('open')) && output.includes('refused'),
        hint: 'First command should succeed (8080 allowed). Second should fail/timeout (5432 denied). Tests the policy.',
      },
    ],
    envValues: [
      { key: 'NETWORK_POLICY_ENABLED', value: 'true', env: 'production' },
      { key: 'DEFAULT_DENY', value: 'true', env: 'production' },
    ],
    docs: [
      { title: 'Kubernetes NetworkPolicy', url: 'https://kubernetes.io/docs/concepts/services-networking/network-policies/' },
      { title: 'NetworkPolicy Best Practices', url: 'https://kubernetes.io/docs/concepts/security/network-policies/' },
    ],
    timeLimit: 1200,
  },

  {
    id: 'sec-3',
    track: 'security',
    trackTitle: 'Security & Access Control',
    trackColor: '#f85149',
    domain: 'Secrets Management',
    title: 'Secrets Management: Encryption & Rotation',
    objective: 'Secure sensitive data using encrypted secrets and implement rotation policies',
    difficulty: 'intermediate',
    briefTitle: 'Plaintext Secrets in Version Control',
    brief: `Audit discovers: database passwords stored in plain-text YAML files committed to git. Anyone with repo access can read them. Your fix: (1) move secrets to Kubernetes Secret objects with encryption at rest, (2) remove secrets from git, (3) implement a rotation policy (new password every 30 days), (4) audit who accessed secrets. Result: passwords are encrypted, rotated regularly, and access is logged.`,
    philosophy: `Never commit secrets to git. Kubernetes Secrets encrypt data at rest (when configured). Secret objects are referenced by pods via environment variables or volume mounts. A rotation policy means: regenerate passwords periodically, distribute new ones to services, revoke old ones. Audit logs track: who requested the secret, when, from which pod.`,
    clusterOverview: `
Cluster: secure-prod
Namespace: production

Current state:
- database.yaml committed to git with password: "postgres123" (plaintext)
- All pods read the password from the file

New state:
- Move password to Secret object
- Enable encryption at rest (EncryptionConfig)
- Implement secret rotation (every 30 days)
- Enable audit logging for secret access

Secret rotation schedule: Deploy new secret → update pod environment → revoke old secret
    `,
    quiz: [
      {
        id: 'sec-3-q1',
        prompt: 'What does "encryption at rest" for Kubernetes Secrets mean?',
        options: [
          'Passwords are hashed so they can\'t be read even by admins',
          'Data is encrypted in etcd storage, decrypted only when pod reads it',
          'Secrets are invisible to kubectl commands',
          'Secrets are encrypted during network transmission',
        ],
        correct: 1,
        explanation:
          'Encryption at rest means: data stored in etcd (Kubernetes database) is encrypted. When a pod mounts the secret, the kubelet decrypts it in memory. Without this, a cluster admin could read raw etcd data and see all secrets.',
      },
      {
        id: 'sec-3-q2',
        prompt: 'How do you implement secret rotation without downtime?',
        options: [
          'Delete the old secret, create a new one, restart all pods',
          'Create new secret → distribute to pods via rolling update → revoke old secret',
          'Have developers manually update passwords',
          'Rotation isn\'t possible without service disruption',
        ],
        correct: 1,
        explanation:
          'Rolling update: (1) create new secret, (2) update pod spec to use it, (3) k8s rolls out pods gradually (some read old, some read new), (4) once all pods updated, delete old secret. Zero downtime if done carefully.',
      },
      {
        id: 'sec-3-q3',
        prompt: 'You need to audit who accessed a database secret. Where is this logged?',
        options: [
          'In the Secret object itself',
          'In Kubernetes audit logs (if enabled)',
          'Secrets don\'t log access',
          'Only in database connection logs',
        ],
        correct: 1,
        explanation:
          'Enable Kubernetes audit logging with policy rules for "get secret" events. Audit logs show: which subject (user/pod), which secret, when, from which API call. This is essential for compliance (SOC2, HIPAA).',
      },
    ],
    checkpoints: [
      {
        id: 'sec-3-cp1',
        title: 'Create encrypted Secret for database password',
        concept: 'Move plaintext password from YAML to Kubernetes Secret',
        command:
          'kubectl create secret generic db-credentials --from-literal=password="postgres123" --from-literal=username="postgres" -n production',
        validation: (output) => output.includes('created'),
        hint: 'kubectl create secret stores password in Secret object. Data is encrypted at rest (if EncryptionConfig enabled).',
      },
      {
        id: 'sec-3-cp2',
        title: 'Verify secret is encrypted in etcd',
        concept: 'Check etcd directly (or via kubectl) to confirm encryption',
        command:
          'kubectl get secret db-credentials -n production -o jsonpath="{.data.password}" | base64 -d',
        validation: (output) => output.includes('postgres123'),
        hint: 'Kubectl automatically decodes base64. You see the plaintext. But in etcd storage, it\'s encrypted.',
      },
      {
        id: 'sec-3-cp3',
        title: 'Rotate secret: create new password',
        concept: 'Generate new secret and update pod environment',
        command:
          'kubectl create secret generic db-credentials-v2 --from-literal=password="postgres456" --from-literal=username="postgres" -n production --dry-run=client -o yaml | kubectl apply -f -',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'Create new secret with v2 suffix. Next step: update Deployment to reference it.',
      },
      {
        id: 'sec-3-cp4',
        title: 'Enable audit logging for secret access',
        concept: 'Configure audit policy to log get/list secrets events',
        command:
          'cat <<EOF | kubectl apply -f -\napiVersion: audit.k8s.io/v1\nkind: Policy\nrules:\n- level: RequestResponse\n  verbs: [get, list]\n  resources: [secrets]\n  omitStages:\n  - RequestReceived\nEOF',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'Audit policy logs all secret access events. View logs to see who accessed what.',
      },
    ],
    envValues: [
      { key: 'ENCRYPTION_AT_REST_ENABLED', value: 'true', env: 'production' },
      { key: 'SECRET_ROTATION_DAYS', value: '30', env: 'production' },
      { key: 'AUDIT_LOGGING_ENABLED', value: 'true', env: 'production' },
    ],
    docs: [
      { title: 'Kubernetes Secrets', url: 'https://kubernetes.io/docs/concepts/configuration/secret/' },
      { title: 'Encryption at Rest', url: 'https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/' },
      { title: 'Audit Logging', url: 'https://kubernetes.io/docs/tasks/debug-application-cluster/audit/' },
    ],
    timeLimit: 1200,
  },

  {
    id: 'sec-4',
    track: 'security',
    trackTitle: 'Security & Access Control',
    trackColor: '#f85149',
    domain: 'Audit & Forensics',
    title: 'Audit Trail Forensics: Investigating Unauthorized Access',
    objective: 'Analyze audit logs to identify who accessed sensitive resources and when',
    difficulty: 'hard',
    briefTitle: 'Insider Threat: Who Accessed Production Secrets?',
    brief: `Suspicious activity detected: production database credentials were accessed from a pod during off-hours (11 PM), and 500MB of data was exfiltrated. You must investigate: (1) Was this a human or an automated process? (2) Which pod/user accessed the secrets? (3) What was accessed? (4) Any lateral movement? You'll query Kubernetes audit logs, trace the pod to a user/service account, and identify the attack vector. Your goal: prevent recurrence by identifying the root cause (e.g., leaked service account token, misconfigured RBAC).`,
    philosophy: `Audit logs are your incident investigation tool. Every API call to kube-apiserver is logged: who (user/service account), what (verb like get/create/delete), which resource (secret, pod, node), when (timestamp), from where (source IP). By correlating audit entries, you can reconstruct a timeline of attacker actions: accessed secret → connected to internal pod → copied data → deleted audit logs (maybe?). Audit logs are the truth; if logs are deleted, that's also suspicious.`,
    clusterOverview: `
Cluster: prod-critical
Namespace: production

Incident:
- Time: 2024-04-26 23:00 UTC (off-hours)
- Event: Secret "db-credentials" accessed
- Result: 500MB data exfiltrated from database
- Discovery: Backup audit logs show access

Your tools:
- Kubernetes audit logs (search by user, resource, timestamp)
- Pod logs (see if pod made suspicious connections)
- Network logs (traffic to external IPs)
- RBAC policy (trace user permissions)

Goal: Answer the 5 Ws: Who, What, When, Where, Why
    `,
    quiz: [
      {
        id: 'sec-4-q1',
        prompt: 'You see audit log: verb=get, resource=secrets, user=system:serviceaccount:production:backup-job. What does this mean?',
        options: [
          'A human user named "backup-job" read secrets',
          'A service account "backup-job" in namespace "production" accessed secrets',
          'An admin used the backup tool to access secrets',
          'A secret was backed up',
        ],
        correct: 1,
        explanation:
          'Audit log shows the subject (service account) and action. The format system:serviceaccount:ns:name identifies the service account uniquely. This tells you which pod made the request.',
      },
      {
        id: 'sec-4-q2',
        prompt: 'Audit shows: get secret (11:00 PM) → list pods (11:05 PM) → get pod logs (11:10 PM). What pattern is this?',
        options: [
          'Normal operations',
          'Reconnaissance: attacker gathering info before attacking',
          'A bug in the audit system',
          'Automated backup process',
        ],
        correct: 1,
        explanation:
          'Timeline: read secret (password) → list pods (find targets) → read logs (find vulnerabilities). This is classic reconnaissance. A legitimate backup wouldn\'t list all pods; it would read specific resources.',
      },
      {
        id: 'sec-4-q3',
        prompt: 'How do you prevent an attacker from deleting audit logs to hide their tracks?',
        options: [
          'Store audit logs outside the cluster (e.g., S3, syslog server)',
          'Encrypt audit logs',
          'Only admins can view audit logs',
          'Audit logs can\'t be deleted',
        ],
        correct: 0,
        explanation:
          'Kubernetes audit logs are stored on the control plane. A compromised admin could delete them. Best practice: stream logs to external storage (S3, Splunk, ELK) where they\'re immutable and centrally managed.',
      },
    ],
    checkpoints: [
      {
        id: 'sec-4-cp1',
        title: 'Query audit logs for secret access',
        concept: 'Find all audit events where secrets were accessed',
        command:
          'kubectl logs -n kube-system kube-apiserver-* | grep "secret" | grep "get" | tail -20',
        validation: (output) => output.includes('secret') || output.includes('verb'),
        hint: 'Audit logs show API calls. Search for verb=get, resource=secrets, narrow by timestamp.',
      },
      {
        id: 'sec-4-cp2',
        title: 'Identify the service account that accessed the secret',
        concept: 'Extract user info from audit log entry',
        command:
          'kubectl logs -n kube-system kube-apiserver-* | grep "secret" | grep "get" | jq ".user.username" 2>/dev/null | sort | uniq',
        validation: (output) => output.includes('system:serviceaccount') || output.includes('user'),
        hint: 'Audit log contains user field. Format: system:serviceaccount:namespace:name. This is your suspect.',
      },
      {
        id: 'sec-4-cp3',
        title: 'Check pod logs for external data transfer',
        concept: 'Find if the pod uploaded data to an external IP',
        command:
          'kubectl logs -l app=backup-job -n production | grep -E "(curl|wget|POST|exfil)" | head -10',
        validation: (output) => output.includes('http') || output.includes('error'),
        hint: 'Look for outbound connections (curl, wget) to external servers. DNS or IP indicates exfiltration attempt.',
      },
      {
        id: 'sec-4-cp4',
        title: 'Write forensic timeline and remediation',
        concept: 'Synthesize audit logs into a clear attack narrative',
        command:
          'cat > /tmp/forensics.txt << EOF\nINCIDENT FORENSICS\n\nTimeline:\n11:00 PM: service account "backup-job" accessed secret "db-credentials" (verb=get)\n11:05 PM: Listed all pods in namespace production (verb=list)\n11:10 PM: Read logs from pod "data-exfil-xxxx" (verb=get, resource=pods/log)\n11:15 PM: Pod established connection to 203.0.113.42 (external IP, found in network logs)\n\nAttack Vector:\n- Service account token was compromised (leaked in code/config)\n- Token had overly broad permissions (should have been read-only, had list/get all)\n- No network policy to block external traffic\n\nRemediation:\n1. Revoke backup-job service account token\n2. Create new token with minimal permissions\n3. Enable NetworkPolicy to deny egress to external IPs\n4. Scan code repos for leaked tokens\n5. Enable audit log export to external storage\nEOF',
        validation: (output) => output.includes('Timeline') || output.includes('Remediation'),
        hint: 'Professional incident report includes: timeline, attack vector, immediate remediation, and long-term prevention.',
      },
    ],
    envValues: [
      { key: 'AUDIT_LOG_RETENTION_DAYS', value: '90', env: 'all' },
      { key: 'AUDIT_LOG_BACKEND', value: 's3://audit-logs-prod', env: 'production' },
    ],
    docs: [
      { title: 'Kubernetes Audit Logging', url: 'https://kubernetes.io/docs/tasks/debug-application-cluster/audit/' },
      { title: 'Security Best Practices', url: 'https://kubernetes.io/docs/concepts/security/security-best-practices/' },
    ],
    timeLimit: 1800,
  },

  // ============================================
  // GITOPS TRACK
  // ============================================
  {
    id: 'gitops-1',
    track: 'gitops',
    trackTitle: 'GitOps & Declarative Deployment',
    trackColor: '#3fb950',
    domain: 'ArgoCD & Sync Strategies',
    title: 'ArgoCD Basics: Desired vs Actual State',
    objective: 'Understand GitOps principles and use ArgoCD to sync cluster state from git',
    difficulty: 'beginner',
    briefTitle: 'Accidental Manual Change Breaks Desired State',
    brief: `A team member manually applied a patch to the Deployment in production, thinking it was temporary. Now the running state differs from git: Deployment has 5 replicas, but git says 3. This creates ambiguity: What's the source of truth? If someone restarts the pod, does it revert to 3 or stay at 5? Your fix: use ArgoCD to enforce git as the single source of truth. Any manual change will be detected as "OutOfSync" and can be auto-corrected or require a PR to fix.`,
    philosophy: `GitOps is a principle: the git repository is the single source of truth for cluster state. Any change to the cluster (Deployment, Service, ConfigMap) must come from a git commit. ArgoCD continuously compares: "What's in git?" vs "What's running in the cluster?" If they differ, it's a drift—someone made a manual change. ArgoCD can auto-sync (revert to git) or alert. Benefits: audit trail (git history), rollback (git revert), code review (PR gates), reproducibility.`,
    clusterOverview: `
Cluster: prod-gitops
Namespace: production

Current state:
- Deployment running 5 replicas (manual kubectl patch)
- Git repo says 3 replicas

Setup:
- ArgoCD installed in kube-system namespace
- Git repo: https://github.com/team/cluster-config
- Branch: main (source of truth)

Your task:
1. Create ArgoCD Application pointing to git repo
2. Sync cluster to git (revert manual change)
3. Enable auto-sync to prevent drift
    `,
    quiz: [
      {
        id: 'gitops-1-q1',
        prompt: 'What is the GitOps principle?',
        options: [
          'Use git for version control of code only',
          'Git repository is the single source of truth for cluster state; all changes come from git commits',
          'All team members must use GitHub',
          'GitOps is only for Kubernetes',
        ],
        correct: 1,
        explanation:
          'GitOps: (1) declarative infra defined in git, (2) automated tool (ArgoCD) syncs cluster to git, (3) any manual change is detected as drift. Benefits: audit (git history), rollback (git revert), reproducibility.',
      },
      {
        id: 'gitops-1-q2',
        prompt: 'You manually scale a Deployment to 10 replicas, but git says 3. ArgoCD detects this as "OutOfSync". What happens next?',
        options: [
          'ArgoCD automatically scales back to 3 (auto-sync disabled = manual confirm required)',
          'Cluster stays at 10 replicas (no change)',
          'Both 3 and 10 are correct (no problem)',
          'ArgoCD deletes the Deployment',
        ],
        correct: 0,
        explanation:
          'If auto-sync is disabled (default), OutOfSync is detected but not corrected—it alerts you. If auto-sync is enabled, ArgoCD automatically patches the cluster to match git (scale to 3). Manual confirmation depends on policy.',
      },
      {
        id: 'gitops-1-q3',
        prompt: 'What\'s the advantage of GitOps over manual kubectl apply?',
        options: [
          'GitOps is faster to deploy',
          'Git history is audit trail, changes need review (PR), rollback is git revert',
          'GitOps only works with ArgoCD',
          'No real advantage; both are the same',
        ],
        correct: 1,
        explanation:
          'With kubectl apply, anyone can make changes directly (hard to track). With GitOps: all changes are git commits (audit trail), require PR review, easy to revert (git revert), and cluster state is reproducible.',
      },
    ],
    checkpoints: [
      {
        id: 'gitops-1-cp1',
        title: 'Create ArgoCD Application',
        concept: 'Configure ArgoCD to watch git repo and sync to cluster',
        command:
          'kubectl apply -f - <<EOF\napiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: prod-app\n  namespace: argocd\nspec:\n  project: default\n  source:\n    repoURL: https://github.com/team/cluster-config\n    targetRevision: main\n    path: manifests/production\n  destination:\n    server: https://kubernetes.default.svc\n    namespace: production\n  syncPolicy:\n    syncOptions:\n    - CreateNamespace=true\nEOF',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'Application resource tells ArgoCD: fetch from git repo, deploy to cluster namespace. Source=git, destination=cluster.',
      },
      {
        id: 'gitops-1-cp2',
        title: 'Check sync status in ArgoCD',
        concept: 'Verify ArgoCD detects git vs cluster state',
        command: 'argocd app get prod-app --refresh',
        validation: (output) => output.includes('Status') && (output.includes('Synced') || output.includes('OutOfSync')),
        hint: 'argocd app get shows status. OutOfSync = drift detected. Synced = cluster matches git.',
      },
      {
        id: 'gitops-1-cp3',
        title: 'Manually create drift (scale pod)',
        concept: 'Apply a manual change to demonstrate GitOps drift detection',
        command: 'kubectl scale deployment api-gateway --replicas=5 -n production',
        validation: (output) => output.includes('scaled'),
        hint: 'Git says 3 replicas. We just set it to 5. This creates OutOfSync state.',
      },
      {
        id: 'gitops-1-cp4',
        title: 'Enable auto-sync to enforce git state',
        concept: 'Configure ArgoCD to auto-correct drift',
        command:
          'kubectl patch application prod-app -n argocd --type merge -p \'{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}\' ',
        validation: (output) => output.includes('patched') || output.includes('Application'),
        hint: 'Auto-sync enabled: ArgoCD will automatically scale cluster back to 3 to match git.',
      },
    ],
    envValues: [
      { key: 'GIT_REPO', value: 'https://github.com/team/cluster-config', env: 'all' },
      { key: 'GIT_BRANCH', value: 'main', env: 'all' },
      { key: 'ARGOCD_AUTO_SYNC', value: 'true', env: 'production' },
    ],
    docs: [
      { title: 'ArgoCD Getting Started', url: 'https://argo-cd.readthedocs.io/en/stable/getting_started/' },
      { title: 'GitOps Principles', url: 'https://www.gitops.tech/' },
    ],
    timeLimit: 900,
  },

  {
    id: 'gitops-2',
    track: 'gitops',
    trackTitle: 'GitOps & Declarative Deployment',
    trackColor: '#3fb950',
    domain: 'Git-Driven Deployments',
    title: 'Git History & Rollback: Reverting Bad Deployments',
    objective: 'Use git revert to quickly rollback to a known good state',
    difficulty: 'intermediate',
    briefTitle: 'Wrong API Version Deployed, Users Screaming',
    brief: `At 2 PM, a developer pushed a commit that bumped API to apiVersion: batch/v1beta1 (deprecated). Kubernetes rejects the resource, and all jobs fail to run. Users complain. Your fix: (1) identify the bad commit (git log), (2) revert it (git revert), (3) ArgoCD auto-syncs to the new state, (4) 30 seconds later, jobs are running again. Rollback is as simple as a git revert commit.`,
    philosophy: `With git as source of truth, rollback is git revert. No need to remember kubectl rollout undo or pod restart commands. You just: git revert <commit-sha>, push, and ArgoCD handles the cluster sync. This is clean, auditable, and fast. Plus, your audit trail shows: "bad commit at 2 PM, reverted at 2:01 PM, reason: apiVersion deprecated." All in git history.`,
    clusterOverview: `
Cluster: prod-gitops
Namespace: production

Timeline:
- 2:00 PM: Commit "Update to apiVersion batch/v1beta1" pushed
- 2:01 PM: ArgoCD detects new commit, syncs to cluster
- 2:02 PM: Jobs fail (apiVersion deprecated)
- 2:03 PM: Users report outage
- 2:04 PM: You investigate, find bad commit
- 2:05 PM: You run git revert, push
- 2:06 PM: ArgoCD syncs, jobs run again
- 2:07 PM: Outage resolved

Git repo: https://github.com/team/cluster-config
Branch: main
Bad commit: abc123 "Update to apiVersion batch/v1beta1"
    `,
    quiz: [
      {
        id: 'gitops-2-q1',
        prompt: 'You want to rollback a bad deployment. What\'s the GitOps way?',
        options: [
          'kubectl rollout undo deployment/api-gateway',
          'git revert <commit-sha> && git push',
          'Manually revert the YAML and kubectl apply',
          'Delete the pod to restart it',
        ],
        correct: 1,
        explanation:
          'git revert creates a new commit that undoes the bad commit. When you push, ArgoCD sees the new state and syncs the cluster. This leaves a full audit trail: bad commit + revert commit.',
      },
      {
        id: 'gitops-2-q2',
        prompt: 'git revert vs git reset: which should you use for rollback in GitOps?',
        options: [
          'git reset (erases history)',
          'git revert (creates new commit that undoes the bad one)',
          'Both are the same',
          'Neither (use kubectl)',
        ],
        correct: 1,
        explanation:
          'git revert: good for production (creates explicit undo commit, audit trail). git reset: erases history (not good for production). In team repos, always revert to keep history clean and auditable.',
      },
      {
        id: 'gitops-2-q3',
        prompt: 'How do you identify which commit caused the outage?',
        options: [
          'Check ArgoCD UI for last sync',
          'Run git log, look for timestamp around outage time + review commit message',
          'Ask the developer who was working',
          'Check Kubernetes events',
        ],
        correct: 1,
        explanation:
          'git log shows timestamp of each commit. Match to outage time. Commit message should indicate what changed. For critical issues, always check: "What changed?" (git log) → "Was it this commit?" (review diff) → "Revert it" (git revert).',
      },
    ],
    checkpoints: [
      {
        id: 'gitops-2-cp1',
        title: 'Find the bad commit in git history',
        concept: 'Identify the commit that changed apiVersion',
        command: 'git log --oneline | head -20 && git log --grep="apiVersion" --oneline | head -5',
        validation: (output) => output.includes('apiVersion') || output.includes('Update'),
        hint: 'git log shows recent commits. Grep for "apiVersion" or search by time to find the culprit.',
      },
      {
        id: 'gitops-2-cp2',
        title: 'Review the bad commit diff',
        concept: 'See exactly what changed in the bad commit',
        command: 'git show abc123 | head -30',
        validation: (output) => output.includes('diff') || output.includes('apiVersion'),
        hint: 'git show <commit> displays the diff. Confirm this is the bad change.',
      },
      {
        id: 'gitops-2-cp3',
        title: 'Revert the bad commit',
        concept: 'Create a new commit that undoes the change',
        command: 'git revert abc123 --no-edit && git push origin main',
        validation: (output) => output.includes('Revert') || output.includes('push'),
        hint: 'git revert creates commit: "Revert: Update to apiVersion...". This undo commit is new history, not erasure.',
      },
      {
        id: 'gitops-2-cp4',
        title: 'Verify ArgoCD synced the rollback',
        concept: 'Confirm cluster updated to new git state',
        command: 'argocd app wait prod-app --sync && kubectl get jobs -n production',
        validation: (output) => output.includes('Synced') && output.includes('job'),
        hint: 'argocd app wait watches sync. kubectl get jobs should show jobs running again (apiVersion fixed).',
      },
    ],
    envValues: [
      { key: 'GIT_REPO', value: 'https://github.com/team/cluster-config', env: 'all' },
      { key: 'AUTO_SYNC_INTERVAL', value: '30s', env: 'production' },
    ],
    docs: [
      { title: 'Git Revert vs Reset', url: 'https://git-scm.com/docs/git-revert' },
      { title: 'ArgoCD Sync Policies', url: 'https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/' },
    ],
    timeLimit: 1200,
  },

  {
    id: 'gitops-3',
    track: 'gitops',
    trackTitle: 'GitOps & Declarative Deployment',
    trackColor: '#3fb950',
    domain: 'Version Control & Releases',
    title: 'Release Tags & Promotion: Staging → Production',
    objective: 'Use git tags to version releases and promote across environments safely',
    difficulty: 'intermediate',
    briefTitle: 'Promoting Staging Code to Production Safely',
    brief: `Your staging cluster runs code that passed QA testing. Now you need to promote it to production without accidentally deploying experimental features. Solution: use git tags for releases. Tag v1.2.3 in staging, test thoroughly, then promote tag v1.2.3 to production. If bugs are found, revert is simple: just update the tag pointer in production config. Result: clear version boundaries, traceable releases, and safe promotion.`,
    philosophy: `Tags mark milestones: v1.2.3 is a specific commit, never changes (unlike branches which move). Each environment (staging, production) pulls from a specific tag. To promote: update production config to point to the tag tested in staging. To rollback: revert tag pointer. Tags are lightweight version markers; combined with git history, they're the source of truth for "which code is running where?"`,
    clusterOverview: `
Cluster: prod-promotion
Namespaces: staging, production

Git structure:
- Branch: main (development)
- Tags: v1.2.1 (in staging), v1.2.0 (in production)

Deployment config:
- staging/kustomization.yaml: image: api:v1.2.1@commit-abc
- production/kustomization.yaml: image: api:v1.2.0@commit-xyz

Goal:
1. Tag new release v1.2.3 from main
2. Update staging config to use v1.2.3
3. Test in staging
4. Update production config to use v1.2.3
5. ArgoCD promotes to production
    `,
    quiz: [
      {
        id: 'gitops-3-q1',
        prompt: 'Why use git tags for releases instead of branch names?',
        options: [
          'Tags are shorter to type',
          'Tags mark immutable points in history; branches move. Tags ensure "this code is v1.2.3" forever.',
          'Tags are faster to deploy',
          'No difference',
        ],
        correct: 1,
        explanation:
          'Branch names move (main points to the latest commit). Tags are fixed to a specific commit (v1.2.3 = commit abc forever). This immutability is crucial for production—you know exactly what v1.2.3 means.',
      },
      {
        id: 'gitops-3-q2',
        prompt: 'You have v1.2.2 in production. A bug is found. How do you rollback?',
        options: [
          'Revert all commits in main',
          'Update production config to point to the previous tag (e.g., v1.2.1) and push',
          'Manually restart pods',
          'Delete the tag',
        ],
        correct: 1,
        explanation:
          'Production config has imageTag: v1.2.2. To rollback: change to v1.2.1 in the config file, push to git, ArgoCD syncs. Fast, auditable, reversible.',
      },
      {
        id: 'gitops-3-q3',
        prompt: 'What\'s a safe promotion workflow?',
        options: [
          'Deploy directly from main to production',
          'Tag release → deploy to staging → test → tag validated → update production config → deploy',
          'Ask the ops team before deploying',
          'Wait 1 day before promoting',
        ],
        correct: 1,
        explanation:
          'Safe workflow: (1) tag in git, (2) stage deployment, (3) test, (4) if OK, promote (update prod config, push), (5) ArgoCD syncs. Each stage has approval gates (PR review, test pass, etc.).',
      },
    ],
    checkpoints: [
      {
        id: 'gitops-3-cp1',
        title: 'Create a release tag',
        concept: 'Tag the current main commit as v1.2.3',
        command: 'git tag -a v1.2.3 -m "Release v1.2.3: bug fixes and improvements" && git push origin v1.2.3',
        validation: (output) => output.includes('v1.2.3'),
        hint: 'git tag creates immutable marker at this commit. Push to share with team.',
      },
      {
        id: 'gitops-3-cp2',
        title: 'Update staging config to use new tag',
        concept: 'Point staging deployment to v1.2.3',
        command:
          'cd manifests/staging && sed -i "s/image: api:.*/image: api:v1.2.3/" kustomization.yaml && git add . && git commit -m "Staging: promote to v1.2.3" && git push origin main',
        validation: (output) => output.includes('commit') || output.includes('promote'),
        hint: 'Update image tag in staging config. Commit and push so ArgoCD picks it up.',
      },
      {
        id: 'gitops-3-cp3',
        title: 'Verify staging deployed new version',
        concept: 'Confirm staging cluster synced to v1.2.3',
        command: 'kubectl get deployment -n staging -o jsonpath="{.items[0].spec.template.spec.containers[0].image}" && kubectl rollout status deployment/api -n staging',
        validation: (output) => output.includes('v1.2.3'),
        hint: 'Check image tag and rollout status. Should show v1.2.3 running.',
      },
      {
        id: 'gitops-3-cp4',
        title: 'Promote to production after testing',
        concept: 'Update production config to use v1.2.3',
        command:
          'cd manifests/production && sed -i "s/image: api:.*/image: api:v1.2.3/" kustomization.yaml && git add . && git commit -m "Production: promote to v1.2.3" && git push origin main',
        validation: (output) => output.includes('commit') || output.includes('promote'),
        hint: 'Same as staging, but in production folder. After push, ArgoCD auto-syncs and deploys.',
      },
    ],
    envValues: [
      { key: 'GIT_REPO', value: 'https://github.com/team/cluster-config', env: 'all' },
      { key: 'STAGING_TAG', value: 'latest', env: 'staging' },
      { key: 'PRODUCTION_TAG', value: 'stable', env: 'production' },
    ],
    docs: [
      { title: 'Git Tagging', url: 'https://git-scm.com/docs/git-tag' },
      { title: 'Semantic Versioning', url: 'https://semver.org/' },
    ],
    timeLimit: 1200,
  },

  {
    id: 'gitops-4',
    track: 'gitops',
    trackTitle: 'GitOps & Declarative Deployment',
    trackColor: '#3fb950',
    domain: 'Multi-Environment GitOps',
    title: 'Multi-Env Governance: Approval Gates & Change Control',
    objective: 'Implement change approval process for production deployments via Git + ArgoCD',
    difficulty: 'hard',
    briefTitle: 'Preventing Accidental Production Changes',
    brief: `Your team is growing; mistakes happen. A developer accidentally committed a change to production manifests directly, bypassing code review. By the time it was caught, the change had already synced to production, causing a brief outage. Solution: implement GitOps governance: (1) require PR review before merging to main, (2) separate git branch for production deployments (e.g., production-releases), (3) only release managers can merge to production branch, (4) ArgoCD watches production branch for syncs. Result: no change reaches production without approval.`,
    philosophy: `GitOps governance layers access control. Each environment has a branch or directory protected by different rules. Production changes require: (1) code review (PR approval), (2) merge permission (release manager), (3) automated deployment (ArgoCD). This creates a paper trail: who approved what and when. It's stronger than manual review because it's enforced by git permissions and ArgoCD logic, not trust.`,
    clusterOverview: `
Cluster: prod-critical
Namespaces: staging, production

Git structure:
- Branch: main (staging, fast-moving)
- Branch: production-releases (protected, requires PR review + release manager approval)
- Directories: manifests/staging/, manifests/production/

Git permissions:
- Developers: can commit to main, open PRs
- Release managers: can approve PRs, merge to production-releases
- CI/CD: only read permission (ArgoCD pulls from these branches)

ArgoCD applications:
- staging-app: watches main branch
- production-app: watches production-releases branch (high-trust, gated)
    `,
    quiz: [
      {
        id: 'gitops-4-q1',
        prompt: 'What\'s the GitOps way to prevent accidental production changes?',
        options: [
          'Hope developers are careful',
          'Separate git branch for prod + branch protection + require PR review + limited merge permissions',
          'Only ops team can push anything',
          'Use kubectl directly (don\'t use git)',
        ],
        correct: 1,
        explanation:
          'Governance: (1) production-releases branch, (2) enforce PR review (GitHub settings), (3) only release managers can merge, (4) ArgoCD watches this branch. Multi-layer protection: access control + human review + automation.',
      },
      {
        id: 'gitops-4-q2',
        prompt: 'A developer pushes to main (staging). Should it auto-sync?',
        options: [
          'No, staging is too important',
          'Yes, staging is fast-moving and experimental; auto-sync is OK',
          'Only on Wednesdays',
          'Depends on the team size',
        ],
        correct: 1,
        explanation:
          'Staging is for testing; rapid feedback is good. Auto-sync staging: push → 30s sync → test. Production is different: auto-sync only after multi-layer review. Different rules for different environments.',
      },
      {
        id: 'gitops-4-q3',
        prompt: 'How do you audit production changes in a GitOps workflow?',
        options: [
          'Check kubectl history (not reliable)',
          'Review git history (commits, PR approvals, who merged)',
          'Ask the ops team (memory is unreliable)',
          'Check Kubernetes events (incomplete)',
        ],
        correct: 1,
        explanation:
          'Git is the audit trail. Each production change is a PR (who proposed) + approval (who reviewed) + merge (who approved merge) + timestamp. This is better than any other audit trail.',
      },
    ],
    checkpoints: [
      {
        id: 'gitops-4-cp1',
        title: 'Create protected production-releases branch',
        concept: 'Set up git branch protection on GitHub',
        command:
          'curl -X POST https://api.github.com/repos/team/cluster-config/branches/production-releases/protection -H "Authorization: token $GITHUB_TOKEN" -d \'{"required_pull_request_reviews":{"required_approving_review_count":1},"enforce_admins":true}\'',
        validation: (output) => output.includes('protection') || output.includes('branch'),
        hint: 'GitHub branch protection: requires PR, code review approval, enforced for admins. Prevents direct pushes.',
      },
      {
        id: 'gitops-4-cp2',
        title: 'Create ArgoCD app watching production-releases',
        concept: 'Configure production sync to watch gated branch',
        command:
          'kubectl apply -f - <<EOF\napiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: prod-app-gated\n  namespace: argocd\nspec:\n  project: production\n  source:\n    repoURL: https://github.com/team/cluster-config\n    targetRevision: production-releases\n    path: manifests/production\n  destination:\n    server: https://kubernetes.default.svc\n    namespace: production\n  syncPolicy:\n    automated:\n      prune: true\n      selfHeal: true\nEOF',
        validation: (output) => output.includes('created') || output.includes('unchanged'),
        hint: 'Key difference: targetRevision is production-releases (protected branch), not main.',
      },
      {
        id: 'gitops-4-cp3',
        title: 'Test change workflow: push to main → PR to production-releases',
        concept: 'Simulate a production change requiring approval',
        command:
          'git checkout -b fix/my-feature && echo "replicas: 4" >> manifests/production/deployment.yaml && git add . && git commit -m "Increase replicas" && git push origin fix/my-feature',
        validation: (output) => output.includes('fix/my-feature') || output.includes('push'),
        hint: 'Developer commits to feature branch, pushes. Next: create PR to production-releases (which requires approval).',
      },
      {
        id: 'gitops-4-cp4',
        title: 'Document governance policy',
        concept: 'Write the team\'s GitOps governance rules',
        command:
          'cat > GOVERNANCE.md << EOF\n# GitOps Governance Policy\n\n## Branches\n- **main**: Staging + development (fast-moving, auto-syncs every 30s)\n- **production-releases**: Production (protected, requires PR + review + release manager approval)\n\n## Permissions\n- Developers: commit to main, open PRs\n- Release Managers: approve + merge PRs to production-releases\n- CI/CD: read-only access\n\n## Change Process\n1. Developer commits to feature branch\n2. Opens PR to main (code review)\n3. Once merged to main: auto-syncs to staging\n4. After staging testing: create PR to production-releases\n5. Release manager reviews + approves\n6. Merge to production-releases: auto-syncs to production\n\n## Audit\n- All changes visible in git history (PR + merge commit)\n- ArgoCD logs show when cluster synced\n- Combined: who, what, when, why\nEOF',
        validation: (output) => output.includes('Governance') || output.includes('Permissions'),
        hint: 'Document policy so team knows the rules. This is the playbook for safe deployments.',
      },
    ],
    envValues: [
      { key: 'GIT_REPO', value: 'https://github.com/team/cluster-config', env: 'all' },
      { key: 'PRODUCTION_BRANCH', value: 'production-releases', env: 'production' },
      { key: 'REQUIRE_APPROVAL', value: 'true', env: 'production' },
    ],
    docs: [
      { title: 'GitHub Branch Protection', url: 'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches' },
      { title: 'ArgoCD AppProject RBAC', url: 'https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/' },
    ],
    timeLimit: 1800,
  },

  // ============================================
  // CLUSTER OPS TRACK
  // ============================================
  {
    id: 'clops-1',
    track: 'cluster-ops',
    trackTitle: 'Cluster Operations & Resource Management',
    trackColor: '#d29922',
    domain: 'Resource Requests & Limits',
    title: 'Resource Requests & Limits: CPU & Memory Allocation',
    objective: 'Properly set resource requests/limits to ensure fair scheduling and prevent resource starvation',
    difficulty: 'beginner',
    briefTitle: 'One Pod Hogging All CPU, Starving Others',
    brief: `A data processing pod with no resource limits starts consuming 90% of a node's CPU. Other critical services (API, database) become sluggish. Investigation shows: the data pod has no requests/limits, so Kubernetes scheduler gave it low priority, but once running, nothing stops it from consuming resources. Fix: (1) set request (reservation for scheduling), (2) set limit (hard cap on consumption), (3) set appropriate QoS class (guaranteed for critical services), (4) reschedule pods. Result: fair sharing—each pod gets its fair share, and limits prevent runaway consumption.`,
    philosophy: `Kubernetes scheduling works in layers. (1) Requests: "I need at least this much CPU/memory; schedule me only on nodes with this capacity available." (2) Limits: "I'm capped at this maximum; if I exceed it, I'm throttled or killed." (3) QoS classes: Guaranteed (both request/limit) gets priority; Burstable (only request) gets middle; BestEffort (neither) gets killed first. Without requests, the scheduler can overfill a node. Without limits, a runaway pod kills the node.`,
    clusterOverview: `
Cluster: ops-lab
Namespace: production

Pods:
- api-gateway: needs 500m CPU / 512Mi memory (guaranteed SLA)
- database-replica: needs 1 CPU / 2Gi memory (guaranteed SLA)
- data-processor: no requests/limits (runaway consumer)
- cache-service: needs 200m CPU / 256Mi memory

Node capacity: 4 CPU, 8Gi memory
Current: data-processor consuming 3.5 CPU, starving others

Fix:
- Set requests/limits on all pods
- Use QoS classes appropriately
- Reschedule pods to balance load
    `,
    quiz: [
      {
        id: 'clops-1-q1',
        prompt: 'What\'s the difference between requests and limits?',
        options: [
          'Same thing (no difference)',
          'Request = scheduler reservation, Limit = hard cap on consumption',
          'Request = how much CPU is slow, Limit = how much is fast',
          'Requests are for users, limits are for admins',
        ],
        correct: 1,
        explanation:
          'Request: "Reserve this for me when scheduling." Limit: "Don\'t let me exceed this." Example: request=1CPU (scheduler picks node with ≥1CPU free), limit=2CPU (if I exceed 2CPU, I\'m throttled).',
      },
      {
        id: 'clops-1-q2',
        prompt: 'A pod has no requests/limits. Where can Kubernetes schedule it?',
        options: [
          'Only on nodes with lots of free resources',
          'Anywhere (no reservation requirement, but limits don\'t apply)',
          'Nowhere (error)',
          'On the master node only',
        ],
        correct: 1,
        explanation:
          'No requests = scheduler places it anywhere with available space. No limits = pod can consume unlimited resources (bad for neighbors). This pod could starve others on the same node.',
      },
      {
        id: 'clops-1-q3',
        prompt: 'What happens if a pod exceeds its memory limit?',
        options: [
          'Pod is throttled (slowed down)',
          'Memory is allocated automatically (no cap)',
          'Pod is OOMKilled (out of memory, killed)',
          'Kubernetes removes the limit',
        ],
        correct: 2,
        explanation:
          'Memory is different from CPU. CPU can be throttled (soft limit). Memory is hard: if limit is 1Gi and pod uses 1.1Gi, kubelet kills it (OOMKill). No throttling for memory; it\'s binary.',
      },
    ],
    checkpoints: [
      {
        id: 'clops-1-cp1',
        title: 'Find the runaway pod consuming CPU',
        concept: 'Identify which pod is using excessive CPU',
        command: 'kubectl top pods -n production --sort-by=cpu | head -10',
        validation: (output) => output.includes('CPU') && output.includes('m'),
        hint: 'kubectl top shows CPU/memory usage. Look for pod with much higher CPU than others.',
      },
      {
        id: 'clops-1-cp2',
        title: 'Add requests/limits to the runaway pod',
        concept: 'Set CPU/memory requests and limits',
        command:
          'kubectl set resources deployment data-processor -n production --requests=cpu=500m,memory=512Mi --limits=cpu=1000m,memory=1Gi',
        validation: (output) => output.includes('deployment.apps') || output.includes('set'),
        hint: 'kubectl set resources updates pod spec. Requests = reservation, limits = hard cap.',
      },
      {
        id: 'clops-1-cp3',
        title: 'Set requests/limits on all pods in namespace',
        concept: 'Ensure all pods have proper resource specifications',
        command:
          'kubectl apply -f - <<EOF\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: production\nspec:\n  limits:\n  - max:\n      cpu: "2"\n      memory: 2Gi\n    default:\n      cpu: 500m\n      memory: 512Mi\n    defaultRequest:\n      cpu: 100m\n      memory: 128Mi\nEOF',
        validation: (output) => output.includes('namespace') || output.includes('LimitRange'),
        hint: 'LimitRange enforces defaults on all pods in namespace. Prevents pods without limits.',
      },
      {
        id: 'clops-1-cp4',
        title: 'Verify pods rescheduled with limits enforced',
        concept: 'Confirm pods are balanced and limits are set',
        command:
          'kubectl describe node node-1 -n production | grep -A 10 "Allocated" && kubectl get pods -n production -o json | jq \'.items[] | {name:.metadata.name, requests:.spec.containers[0].resources.requests, limits:.spec.containers[0].resources.limits}\'',
        validation: (output) => output.includes('Allocated') && (output.includes('limits') || output.includes('requests')),
        hint: 'Describe nodes shows allocated resources. Pod JSON shows limits/requests set.',
      },
    ],
    envValues: [
      { key: 'DEFAULT_CPU_REQUEST', value: '100m', env: 'all' },
      { key: 'DEFAULT_CPU_LIMIT', value: '500m', env: 'all' },
      { key: 'DEFAULT_MEMORY_REQUEST', value: '128Mi', env: 'all' },
      { key: 'DEFAULT_MEMORY_LIMIT', value: '512Mi', env: 'all' },
    ],
    docs: [
      { title: 'Resource Requests and Limits', url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/' },
      { title: 'LimitRange API', url: 'https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#limitrange-v1-core' },
    ],
    timeLimit: 900,
  },

  {
    id: 'clops-2',
    track: 'cluster-ops',
    trackTitle: 'Cluster Operations & Resource Management',
    trackColor: '#d29922',
    domain: 'Node Autoscaling',
    title: 'Cluster Autoscaler: Scale Nodes Based on Demand',
    objective: 'Configure autoscaling to add/remove nodes automatically when pod demand changes',
    difficulty: 'intermediate',
    briefTitle: 'Cluster Full, New Pods Stuck in Pending',
    brief: `Traffic spike hits your service. More pods need to be scheduled, but all nodes are at capacity (100% CPU/memory allocated). New pods sit Pending, waiting for resources. Solution: enable Cluster Autoscaler. When pods are Pending due to insufficient resources, autoscaler automatically provisions a new node (from cloud provider). Pending pods are scheduled on the new node. When traffic dies down, underutilized nodes are deprovisioned. Result: cluster grows and shrinks automatically.`,
    philosophy: `Cluster autoscaling is different from pod autoscaling (HPA). HPA scales pods (replicas) based on metrics. Cluster autoscaler scales nodes (infrastructure) based on pod scheduling constraints. Together: HPA increases pods (e.g., from 3 to 6 replicas), autoscaler provisions nodes if needed to fit them. It's the feedback loop: "pods need resources → request more nodes → nodes arrive → pods scheduled → latency drops."`,
    clusterOverview: `
Cluster: ops-autoscale
Namespace: production

Cloud provider: AWS (EC2 auto-scaling group)
Node type: t3.medium (2 CPU, 4Gi memory)
Min nodes: 1, Max nodes: 10

Scenario:
- Normal: 3 nodes, 20 running pods
- Spike: 100 new pods spawn (HPA triggered)
- Problem: 80 pods Pending (no node space)
- Solution: Autoscaler sees Pending pods, provisions new nodes
- Result: 10 new nodes added in ~2 minutes, all pods scheduled

Configuration:
- Autoscaler watches for Pending pods
- Scale-up: provision new node per 10 pending pods
- Scale-down: remove nodes with <50% utilization after 10 min
    `,
    quiz: [
      {
        id: 'clops-2-q1',
        prompt: 'What triggers Cluster Autoscaler to add a new node?',
        options: [
          'CPU usage > 80%',
          'Pods stuck in Pending state due to insufficient resources',
          'Manual request from ops team',
          'Node is taking longer than 5 seconds to respond',
        ],
        correct: 1,
        explanation:
          'Cluster autoscaler watches pod scheduling. If a pod is Pending (due to request exceeding available resources), autoscaler provisions a new node to fit it. It\'s pull-based, not push-based.',
      },
      {
        id: 'clops-2-q2',
        prompt: 'How is Cluster Autoscaler different from HPA (Horizontal Pod Autoscaler)?',
        options: [
          'Same thing (different names)',
          'HPA scales pods (replicas), autoscaler scales nodes (infrastructure)',
          'Autoscaler is for development, HPA for production',
          'HPA is faster than autoscaler',
        ],
        correct: 1,
        explanation:
          'HPA: watches metrics (CPU, custom), scales pod replicas (e.g., 3 → 5). Autoscaler: watches pod scheduling, scales nodes (add infrastructure). Together: HPA scales pods, autoscaler ensures nodes exist.',
      },
      {
        id: 'clops-2-q3',
        prompt: 'When does Cluster Autoscaler remove a node?',
        options: [
          'Every 5 minutes',
          'When a node has <50% utilization for 10+ minutes (and pods can be evicted)',
          'When CPU drops below 20%',
          'Only during maintenance windows',
        ],
        correct: 1,
        explanation:
          'Scale-down is conservative to avoid thrashing. Node must be underutilized and all pods must be able to move (not node-bound). This prevents churn and ensures stability.',
      },
    ],
    checkpoints: [
      {
        id: 'clops-2-cp1',
        title: 'Deploy Cluster Autoscaler (if not installed)',
        concept: 'Install autoscaler in kube-system namespace',
        command:
          'kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml',
        validation: (output) => output.includes('deployment') || output.includes('created'),
        hint: 'Autoscaler runs as a deployment in kube-system. It talks to cloud provider API to provision/destroy nodes.',
      },
      {
        id: 'clops-2-cp2',
        title: 'Configure autoscaler scale-up/scale-down policies',
        concept: 'Set min/max nodes and scaling thresholds',
        command:
          'kubectl set env deployment cluster-autoscaler -n kube-system --containers=cluster-autoscaler SCALE_DOWN_UTILIZATION_THRESHOLD="0.5" SCALE_DOWN_DELAY_AFTER_FAILURE="10m"',
        validation: (output) => output.includes('deployment.apps'),
        hint: 'Environment variables control behavior: utilization threshold (50%), scale-down delay after failure.',
      },
      {
        id: 'clops-2-cp3',
        title: 'Trigger scale-up by creating pods',
        concept: 'Generate pod load that exceeds node capacity',
        command: 'kubectl create deployment load-test --image=busybox --replicas=50 -n production -- sleep 3600',
        validation: (output) => output.includes('deployment.apps'),
        hint: 'Create 50 pod replicas. Scheduler will see insufficient resources, autoscaler provisions nodes.',
      },
      {
        id: 'clops-2-cp4',
        title: 'Monitor autoscaler logs and node scaling',
        concept: 'Watch nodes being added and pod scheduling',
        command:
          'kubectl logs -l app=cluster-autoscaler -n kube-system --tail=20 -f & sleep 5 && kubectl get nodes && kubectl get pods -n production | grep load-test',
        validation: (output) => output.includes('Running') || output.includes('Pending'),
        hint: 'Autoscaler logs show provisioning progress. kubectl get nodes shows new nodes appearing. Pods should transition from Pending → Running.',
      },
    ],
    envValues: [
      { key: 'MIN_NODES', value: '1', env: 'all' },
      { key: 'MAX_NODES', value: '10', env: 'all' },
      { key: 'SCALE_DOWN_ENABLED', value: 'true', env: 'all' },
      { key: 'SCALE_DOWN_DELAY_AFTER_FAILURE', value: '3m', env: 'all' },
    ],
    docs: [
      { title: 'Cluster Autoscaler', url: 'https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler' },
      { title: 'AWS Autoscaling Group Integration', url: 'https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/cloudprovider/aws/README.md' },
    ],
    timeLimit: 1200,
  },

  {
    id: 'clops-3',
    track: 'cluster-ops',
    trackTitle: 'Cluster Operations & Resource Management',
    trackColor: '#d29922',
    domain: 'Quotas & Fair Sharing',
    title: 'Namespace Quotas: Fair Resource Sharing',
    objective: 'Implement ResourceQuota and PodDisruptionBudget to ensure fair sharing between teams',
    difficulty: 'intermediate',
    briefTitle: 'Team A Consumed 90% of Cluster, Team B Starved',
    brief: `Your cluster runs workloads for three teams. Team A has a runaway training job that consumed 90% of cluster resources. Team B can't deploy their critical service; pods are Pending. Solution: implement Namespace ResourceQuota. Each namespace (team-a, team-b, team-c) gets a quota: "max 40% CPU, 40% memory, 50 pods." If Team A hits its quota, new pods are rejected (not scheduled), forcing them to optimize. Result: fair sharing—no team monopolizes the cluster.`,
    philosophy: `Quotas enforce fairness. Without them, a greedy workload (runaway loop, memory leak, resource hog) can starve the entire cluster. With quotas, each namespace is isolated: "Your quota is X resources; once hit, you can't spawn more pods until you free resources." This is called resource isolation. Combined with requests/limits at pod level, it creates a multi-layer protection: pod limit (individual pod cap), namespace quota (team cap), cluster-wide fairness.`,
    clusterOverview: `
Cluster: ops-quotas
Namespaces: team-a, team-b, team-c (30 total teams)
Cluster capacity: 100 CPU, 200Gi memory, 2000 pods max

Quota policy:
- Each team namespace: 30 CPU, 60Gi memory, 500 pods max
- Overhead: 10 CPU, 20Gi for system pods

Current problem:
- team-a: using 90 CPU (exceeded quota), pods still Pending
- team-b: 5 CPU quota remaining, can't scale
- team-c: within quota

Fix:
- Enable ResourceQuota in each namespace
- Set limits on CPU, memory, pods, PersistentVolumeClaims
- Monitor quota usage, alert when near limit
    `,
    quiz: [
      {
        id: 'clops-3-q1',
        prompt: 'What does ResourceQuota enforce?',
        options: [
          'Maximum requests/limits per pod',
          'Maximum total resources per namespace (hard limit)',
          'Minimum resources per pod',
          'Network bandwidth per pod',
        ],
        correct: 1,
        explanation:
          'ResourceQuota limits namespace-level resources: "namespace team-a can use max 30 CPU and 60Gi memory total." Once quota is hit, new pods are rejected. Pod-level limits are different (LimitRange).',
      },
      {
        id: 'clops-3-q2',
        prompt: 'Team A has quota: 30 CPU, 60Gi. They use 25 CPU, 50Gi. Can they create a pod requesting 10 CPU?',
        options: [
          'Yes (they have 5 CPU left)',
          'No (10 > 5 remaining)',
          'Yes (they have 10Gi memory left)',
          'Maybe (depends on node availability)',
        ],
        correct: 1,
        explanation:
          'Quota check: used (25 CPU) + request (10 CPU) = 35 CPU > quota (30 CPU). Pod is rejected. Scheduler won\'t schedule it; quota is enforced at API server level (before scheduling).',
      },
      {
        id: 'clops-3-q3',
        prompt: 'How do you respond when a team says "Our quota is too small"?',
        options: [
          'Increase the quota immediately',
          'Audit their usage (are they leaking resources? can they optimize?), then increase if justified',
          'Tell them to delete other pods',
          'Remove quotas (they\'re too restrictive)',
        ],
        correct: 1,
        explanation:
          'Quota is a capacity management tool. Before increasing, investigate: Are they hitting quota due to runaway processes? Memory leaks? Unnecessary replicas? Optimize first, then justify quota increase.',
      },
    ],
    checkpoints: [
      {
        id: 'clops-3-cp1',
        title: 'Create ResourceQuota for a namespace',
        concept: 'Define quota limits for CPU, memory, pods',
        command:
          'kubectl apply -f - <<EOF\napiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: team-quota\n  namespace: team-a\nspec:\n  hard:\n    cpu: "30"\n    memory: 60Gi\n    pods: "500"\n    persistentvolumeclaims: "10"\nEOF',
        validation: (output) => output.includes('resourcequota') || output.includes('created'),
        hint: 'ResourceQuota specifies hard limits. Once namespace hits these, new pods are rejected.',
      },
      {
        id: 'clops-3-cp2',
        title: 'Check ResourceQuota usage',
        concept: 'Monitor how much quota each namespace is using',
        command: 'kubectl describe resourcequota team-quota -n team-a',
        validation: (output) => output.includes('Used') || output.includes('Hard'),
        hint: 'kubectl describe shows current usage vs hard limit. Helps identify teams approaching their quota.',
      },
      {
        id: 'clops-3-cp3',
        title: 'Attempt to exceed quota (should fail)',
        concept: 'Create pod that exceeds namespace quota',
        command: 'kubectl create deployment quota-test --image=busybox --replicas=100 -n team-a -- sleep 3600',
        validation: (output) => output.includes('admission') || output.includes('quota'),
        hint: 'Deployment creation might succeed, but pods fail to schedule (quota exceeded). Check pod status: kubectl get pods -n team-a.',
      },
      {
        id: 'clops-3-cp4',
        title: 'Set up quota alerts',
        concept: 'Monitor quota usage and alert at 80% threshold',
        command:
          'kubectl apply -f - <<EOF\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: quota-alert-rules\n  namespace: monitoring\ndata:\n  rules.yaml: |\n    - alert: NamespaceQuotaWarning\n      expr: (kube_resourcequota_used / kube_resourcequota_hard) > 0.8\n      for: 5m\n      annotations:\n        summary: "Namespace {{ $labels.namespace }} at 80% quota"\nEOF',
        validation: (output) => output.includes('configmap') || output.includes('created'),
        hint: 'Alert rule monitors quota usage. At 80%, it fires. Helps teams see when they\'re approaching limits.',
      },
    ],
    envValues: [
      { key: 'NAMESPACE_CPU_QUOTA', value: '30', env: 'all' },
      { key: 'NAMESPACE_MEMORY_QUOTA', value: '60Gi', env: 'all' },
      { key: 'NAMESPACE_POD_QUOTA', value: '500', env: 'all' },
    ],
    docs: [
      { title: 'Resource Quotas', url: 'https://kubernetes.io/docs/concepts/policy/resource-quotas/' },
      { title: 'PodDisruptionBudget', url: 'https://kubernetes.io/docs/tasks/run-application/configure-pdb/' },
    ],
    timeLimit: 1200,
  },

  {
    id: 'clops-4',
    track: 'cluster-ops',
    trackTitle: 'Cluster Operations & Resource Management',
    trackColor: '#d29922',
    domain: 'Capacity Planning',
    title: 'Capacity Planning: Forecasting & Rightsizing',
    objective: 'Predict cluster growth and right-size infrastructure to avoid overprovisioning or underprovisioning',
    difficulty: 'hard',
    briefTitle: 'Cluster Growth Curve: How Many Nodes Do We Need Next Quarter?',
    brief: `Your cluster started with 3 nodes, now has 15. Growth rate: +2 nodes/month. Next quarter, you'll need ~21 nodes. But infrastructure costs are rising. Your job: (1) analyze historical pod deployment trends (growth rate, peak/average usage), (2) forecast next quarter's demand, (3) right-size nodes (use smaller/larger instances?), (4) identify cost optimization opportunities (unused resources, right-sizing, spot instances). Result: confident capacity plan with cost optimization.`,
    philosophy: `Capacity planning is prediction + optimization. Prediction: "Based on growth trends, we'll need X resources." Optimization: "How do we provision X at lowest cost?" It's a balance: overprovision = wasted $$, underprovision = performance issues. Tools: historical metrics (usage over time), forecasting models (linear, exponential), cost analysis (instance types, reserved instances vs spot).`,
    clusterOverview: `
Cluster: ops-capacity
Timeline: Last 12 months

Historical data:
- Month 1: 3 nodes, 30 pods avg, 50% CPU utilization
- Month 6: 10 nodes, 80 pods avg, 60% CPU utilization
- Month 12: 15 nodes, 120 pods avg, 70% CPU utilization

Growth rate analysis:
- Node count: linear growth, +1 node/month (trend)
- Pod count: exponential growth, doubling every 4 months (traffic spike expected)
- CPU utilization: increasing (pods getting heavier, app changes)

Next quarter forecast (linear):
- Month 13-15: +3 nodes per month = 24 nodes by month 15

Cost analysis (current):
- Node type: m5.2xlarge (8 CPU, 32Gi), $0.384/hour, $2,764/month each
- 15 nodes: $41,460/month
- Spot instances available at 70% discount

Optimization opportunities:
- Use spot instances for non-critical workloads (save 70%)
- Right-size nodes (smaller instances for light workloads)
- Reserved instances for predictable baseline

Your task:
1. Forecast capacity
2. Analyze cost
3. Recommend optimization
    `,
    quiz: [
      {
        id: 'clops-4-q1',
        prompt: 'How do you forecast future capacity needs?',
        options: [
          'Guess based on team feedback',
          'Analyze historical usage trends (growth rate) and extrapolate',
          'Wait until out of capacity, then provision',
          'Provision triple current capacity (always safe)',
        ],
        correct: 1,
        explanation:
          'Data-driven forecasting: collect historical metrics (pod count, CPU, memory over months), fit a trend line (linear, exponential), extrapolate forward. E.g., if growing 20% per month, in 12 months you\'ll be 9.6x current size.',
      },
      {
        id: 'clops-4-q2',
        prompt: 'Spot instances cost 70% less but can be terminated. When should you use them?',
        options: [
          'Never (unreliable)',
          'Only for batch jobs, stateless workloads, with PodDisruptionBudget',
          'For all workloads (save money)',
          'Only for testing clusters',
        ],
        correct: 1,
        explanation:
          'Spot instances are risky (can terminate any time), but cheap. Use for fault-tolerant workloads: batch processing, cron jobs, stateless replicas (PDB ensures graceful shutdown). Not for single-pod critical services.',
      },
      {
        id: 'clops-4-q3',
        prompt: 'Your cluster uses 60% capacity on average but 90% at peak. What\'s a good strategy?',
        options: [
          'Provision for average (60%)',
          'Provision for peak (90%) to avoid shortage',
          'Provision for 70% (between average + peak) + use HPA + autoscaler for bursts',
          'Wait for peak, then scale',
        ],
        correct: 2,
        explanation:
          'Balanced approach: baseline capacity for 70% (covers most usage), HPA scales pods (cost-efficient), autoscaler adds nodes if needed (handles unpredictable spikes). Avoids overprovisioning (wasted $) and underprovisioning (poor performance).',
      },
    ],
    checkpoints: [
      {
        id: 'clops-4-cp1',
        title: 'Collect historical metrics from Prometheus',
        concept: 'Query cluster capacity metrics over time',
        command:
          'curl -X GET \'http://prometheus:9090/api/v1/query_range\' --data-urlencode \'query=count(kube_node_info)\' --data-urlencode \'start=1609459200\' --data-urlencode \'end=1641168000\' --data-urlencode \'step=86400\' | jq \'.data.result[0].values\'',
        validation: (output) => output.includes('result') || output.includes('values'),
        hint: 'Query historical node count (kube_node_info). Response is [timestamp, value] pairs over 12 months.',
      },
      {
        id: 'clops-4-cp2',
        title: 'Analyze growth trend',
        concept: 'Calculate growth rate and forecast next quarter',
        command:
          'python3 - << \'PYTHON\'\nimport json\n# Historical data: month -> nodes\ndata = {1: 3, 3: 5, 6: 10, 9: 12, 12: 15}\nmonths = list(data.keys())\nnodes = list(data.values())\n\n# Linear regression\nfrom numpy import polyfit, poly1d\ncoeffs = polyfit(months, nodes, 1)\npoly = poly1d(coeffs)\n\n# Forecast months 13-15\nforecast_months = [13, 14, 15]\nforecast_nodes = [round(poly(m)) for m in forecast_months]\nprint(f"Forecast: {dict(zip(forecast_months, forecast_nodes))} nodes")\nprint(f"Trend: +{coeffs[0]:.2f} nodes/month")\nPYTHON',
        validation: (output) => output.includes('Forecast') || output.includes('Trend'),
        hint: 'Linear regression predicts trend. Example: if growing +1 node/month, in 3 months add 3 nodes.',
      },
      {
        id: 'clops-4-cp3',
        title: 'Calculate cost impact of capacity plan',
        concept: 'Estimate budget for projected node count',
        command:
          'python3 - << \'PYTHON\'\n# Node specs\nnode_cost_per_hour = 0.384  # m5.2xlarge\nnode_cost_per_month = node_cost_per_hour * 730  # 730 hours/month\n\n# Current vs forecast\ncurrent_nodes = 15\nforecast_nodes = 21\ncurrent_cost = current_nodes * node_cost_per_month\nforecast_cost = forecast_nodes * node_cost_per_month\nincrease = forecast_cost - current_cost\n\nprint(f"Current cost: ${current_cost:,.0f}/month ({current_nodes} nodes)")\nprint(f"Forecast cost: ${forecast_cost:,.0f}/month ({forecast_nodes} nodes)")\nprint(f"Cost increase: ${increase:,.0f}/month")\nprint(f"\\nOptimization (70% spot discount on half): ${forecast_cost * 0.5 * 0.3:,.0f}/month")\nPYTHON',
        validation: (output) => output.includes('cost') || output.includes('$'),
        hint: 'Calculate: nodes × cost_per_node × 12 months = annual budget. Compare: current vs projected vs optimized.',
      },
      {
        id: 'clops-4-cp4',
        title: 'Write capacity plan document',
        concept: 'Document forecast, assumptions, and recommendations',
        command:
          'cat > /tmp/capacity_plan.md << EOF\n# Capacity Plan: Next Quarter\n\n## Executive Summary\nForecasted 40% cluster growth (15 → 21 nodes). Recommended investment: spot instances + right-sizing to mitigate cost.\n\n## Historical Analysis\n- Growth rate: +1 node/month (linear trend)\n- Peak utilization: 90% (during traffic spike)\n- Average utilization: 60%\n- Node type: m5.2xlarge (8 CPU, 32Gi)\n\n## Q2 Forecast (3 months)\n- Month 1: 18 nodes\n- Month 2: 19 nodes\n- Month 3: 21 nodes\n\n## Cost Impact\n- Current: $41,460/month\n- Forecast: $62,190/month (+50% increase)\n- Optimized (with spot + right-sizing): $46,000/month (+10%)\n\n## Recommendations\n1. Use spot instances for non-critical workloads (70% savings on ~50% of cluster)\n2. Right-size: split between m5.large (4 CPU, 16Gi) for light workloads + m5.2xlarge for heavy\n3. Reserve core baseline capacity (reserved instances at 40% discount)\n4. Implement chargeback (teams pay for usage) to incentivize optimization\n5. Review pod efficiency: rightsizing requests/limits\n\n## Budget Request\n- Current: $41,460/month\n- Proposed: $46,000/month (+10%)\n- Rationale: 40% more capacity, but optimization reduces cost increase to 10%\nEOF\ncat /tmp/capacity_plan.md',
        validation: (output) => output.includes('Forecast') || output.includes('Recommendations'),
        hint: 'Professional capacity plan: historical trends + forecast + cost analysis + optimization recommendations + budget justification.',
      },
    ],
    envValues: [
      { key: 'FORECAST_MONTHS', value: '3', env: 'all' },
      { key: 'CURRENT_NODES', value: '15', env: 'all' },
      { key: 'SPOT_DISCOUNT_PERCENT', value: '70', env: 'all' },
    ],
    docs: [
      { title: 'Kubernetes Cluster Autoscaler', url: 'https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler' },
      { title: 'Cost Optimization Best Practices', url: 'https://www.cncf.io/blog/2022/09/22/kubernetes-cost-optimization-tips-from-the-cncf/' },
    ],
    timeLimit: 1800,
  },
];

export default ADVANCED_TRACKS;
