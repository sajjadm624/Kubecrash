/**
 * MetricsDashboard - Simulated Prometheus/Grafana-style metrics visualization
 * Used in the Observability track lessons
 */
import { useState, useEffect, useMemo } from 'react'

const CARD = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 10,
  padding: 16,
}

// ── Fake time-series data generator ──────────────────────────────────────────
function generateTimeSeries(points = 60, baseVal, noiseAmp, trend = 0, spike = null) {
  return Array.from({ length: points }, (_, i) => {
    const base = baseVal + trend * i
    const noise = (Math.random() - 0.5) * noiseAmp
    const s = spike && i >= spike.start && i < spike.start + spike.duration ? spike.amplitude : 0
    return Math.max(0, base + noise + s)
  })
}

const DATASETS = {
  cpu: {
    label: 'CPU Usage (%)',
    color: '#58a6ff',
    unit: '%',
    series: {
      'prod-api-0': generateTimeSeries(60, 25, 5, 0.3, { start: 38, duration: 12, amplitude: 60 }),
      'prod-api-1': generateTimeSeries(60, 22, 4, 0.2),
      'prod-api-2': generateTimeSeries(60, 20, 4, 0.1),
    },
  },
  memory: {
    label: 'Memory Usage (Mi)',
    color: '#3fb950',
    unit: 'Mi',
    series: {
      'prod-api-0': generateTimeSeries(60, 340, 20, 1.5),
      'prod-api-1': generateTimeSeries(60, 280, 15, 0.8),
      'prod-api-2': generateTimeSeries(60, 260, 15, 0.7),
    },
  },
  latency: {
    label: 'Request Latency (ms)',
    color: '#d29922',
    unit: 'ms',
    series: {
      p50: generateTimeSeries(60, 45, 8, 0, { start: 38, duration: 12, amplitude: 200 }),
      p95: generateTimeSeries(60, 95, 12, 0, { start: 38, duration: 12, amplitude: 450 }),
      p99: generateTimeSeries(60, 160, 20, 0, { start: 38, duration: 12, amplitude: 800 }),
    },
  },
  errorRate: {
    label: 'Error Rate (errors/s)',
    color: '#f85149',
    unit: 'err/s',
    series: {
      'http-500': generateTimeSeries(60, 0.5, 0.3, 0, { start: 38, duration: 12, amplitude: 45 }),
      'http-502': generateTimeSeries(60, 0.2, 0.1, 0, { start: 38, duration: 10, amplitude: 20 }),
    },
  },
}

const CANNED_QUERIES = [
  {
    label: 'CPU by pod',
    query: 'sum(rate(container_cpu_usage_seconds_total{namespace="production"}[5m])) by (pod)',
    metric: 'cpu',
  },
  {
    label: 'Memory by pod',
    query: 'container_memory_usage_bytes{namespace="production"}',
    metric: 'memory',
  },
  {
    label: 'Latency percentiles',
    query: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
    metric: 'latency',
  },
  {
    label: 'Error rate',
    query: 'rate(http_requests_total{status=~"5.."}[5m])',
    metric: 'errorRate',
  },
]

// ── SVG Line Chart ─────────────────────────────────────────────────────────
function LineChart({ series, colors, width = 560, height = 120, unit = '' }) {
  const allVals = Object.values(series).flat()
  const minVal = Math.min(...allVals)
  const maxVal = Math.max(...allVals) || 1
  const range = maxVal - minVal || 1

  const points = 60
  const padLeft = 48
  const padRight = 12
  const padTop = 10
  const padBottom = 24
  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const toX = (i) => padLeft + (i / (points - 1)) * chartW
  const toY = (v) => padTop + chartH - ((v - minVal) / range) * chartH

  const colorList = ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#a371f7']
  const seriesEntries = Object.entries(series)

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padTop + chartH * (1 - t),
    label: (minVal + range * t).toFixed(0),
  }))

  // X-axis labels (time offset)
  const xTicks = [0, 15, 30, 45, 59].map((i) => ({
    x: toX(i),
    label: `-${(59 - i)}m`,
  }))

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {/* Grid */}
      {yTicks.map(({ y, label }) => (
        <g key={y}>
          <line x1={padLeft} y1={y} x2={padLeft + chartW} y2={y} stroke='#21262d' strokeWidth={1} />
          <text x={padLeft - 4} y={y + 4} fill='#8b949e' fontSize={9} textAnchor='end'>{label}</text>
        </g>
      ))}
      {xTicks.map(({ x, label }) => (
        <text key={label} x={x} y={height - 2} fill='#8b949e' fontSize={9} textAnchor='middle'>{label}</text>
      ))}

      {/* Spike marker at i=38 */}
      <line x1={toX(38)} y1={padTop} x2={toX(38)} y2={padTop + chartH} stroke='#f85149' strokeWidth={1} strokeDasharray='3,3' opacity={0.6} />
      <text x={toX(38)} y={padTop - 2} fill='#f85149' fontSize={8} textAnchor='middle'>spike</text>

      {/* Series lines */}
      {seriesEntries.map(([name, vals], idx) => {
        const color = colors ? colors[idx] : colorList[idx % colorList.length]
        const d = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`).join(' ')
        return (
          <g key={name}>
            <path d={d} fill='none' stroke={color} strokeWidth={1.5} strokeLinejoin='round' />
          </g>
        )
      })}

      {/* Legend */}
      {seriesEntries.map(([name], idx) => {
        const color = colors ? colors[idx] : colorList[idx % colorList.length]
        return (
          <g key={name} transform={`translate(${padLeft + 8 + idx * 100}, ${padTop + 4})`}>
            <rect width={8} height={8} rx={2} fill={color} />
            <text x={12} y={8} fill='#e6edf3' fontSize={9}>{name}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Query Builder ──────────────────────────────────────────────────────────
function QueryBuilder({ activeMetric, setActiveMetric, customQuery, setCustomQuery, onRun }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 11, marginBottom: 4 }}>
        Query Builder
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CANNED_QUERIES.map((q) => (
          <button
            key={q.metric}
            className={activeMetric === q.metric ? 'primary' : ''}
            style={{ fontSize: 10, padding: '4px 8px' }}
            onClick={() => {
              setActiveMetric(q.metric)
              setCustomQuery(q.query)
            }}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          placeholder='Enter PromQL query...'
          style={{
            flex: 1,
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: 6,
            color: '#e6edf3',
            fontFamily: 'JetBrains Mono',
            fontSize: 11,
            padding: '6px 10px',
          }}
        />
        <button
          style={{ fontSize: 11, padding: '6px 12px' }}
          onClick={onRun}
        >
          Run
        </button>
      </div>
    </div>
  )
}

// ── Alert Rules Panel ──────────────────────────────────────────────────────
const MOCK_ALERTS = [
  { name: 'HighCPU', expr: 'sum(rate(container_cpu_usage_seconds_total[5m])) > 0.75', status: 'firing', since: '14:30' },
  { name: 'HighLatencyP95', expr: 'histogram_quantile(0.95, ...) > 500', status: 'pending', since: '14:32' },
  { name: 'HighErrorRate', expr: 'rate(http_requests_total{status=~"5.."}[5m]) > 5', status: 'firing', since: '14:31' },
  { name: 'LowPodCount', expr: 'kube_deployment_spec_replicas < 3', status: 'inactive', since: '' },
]

function AlertRulesPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 11, marginBottom: 4 }}>
        Alert Rules
      </div>
      {MOCK_ALERTS.map((alert) => (
        <div
          key={alert.name}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 10px',
            borderRadius: 6,
            border: `1px solid ${alert.status === 'firing' ? '#f85149' : alert.status === 'pending' ? '#d29922' : '#30363d'}`,
            background: alert.status === 'firing' ? '#1c0a0a' : alert.status === 'pending' ? '#1a1500' : 'transparent',
          }}
        >
          <div>
            <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{alert.name}</div>
            <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 9, marginTop: 2 }}>{alert.expr}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                color: alert.status === 'firing' ? '#f85149' : alert.status === 'pending' ? '#d29922' : '#8b949e',
                fontFamily: 'JetBrains Mono',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {alert.status.toUpperCase()}
            </div>
            {alert.since && (
              <div style={{ color: '#8b949e', fontSize: 9, fontFamily: 'JetBrains Mono' }}>since {alert.since}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function MetricsDashboard({ onClose }) {
  const [activeMetric, setActiveMetric] = useState('cpu')
  const [customQuery, setCustomQuery] = useState(CANNED_QUERIES[0].query)
  const [queryResult, setQueryResult] = useState(null)
  const [tab, setTab] = useState('graphs') // 'graphs' | 'alerts' | 'query'
  const [liveOffset, setLiveOffset] = useState(0)

  // Simulate live data advancing by 1 point every 2 seconds
  useEffect(() => {
    const iv = setInterval(() => setLiveOffset((o) => (o + 1) % 60), 2000)
    return () => clearInterval(iv)
  }, [])

  const dataset = DATASETS[activeMetric]

  // Rotate series to simulate live scrolling
  const liveSeries = useMemo(() => {
    const out = {}
    Object.entries(dataset.series).forEach(([k, v]) => {
      out[k] = [...v.slice(liveOffset), ...v.slice(0, liveOffset)]
    })
    return out
  }, [dataset.series, liveOffset])

  function runQuery() {
    const matched = CANNED_QUERIES.find((q) => customQuery.includes(q.query.slice(0, 20)))
    setQueryResult(
      matched
        ? `Matched: ${matched.label}\n\nResult (instant vector at T-now):\n${Object.entries(DATASETS[matched.metric].series)
            .map(([k, v]) => `${k}: ${v[59].toFixed(2)} ${DATASETS[matched.metric].unit}`)
            .join('\n')}`
        : `Query executed.\nNo matching data for this query.\n\nTip: Use one of the preset queries to see results.`,
    )
    if (matched) setActiveMetric(matched.metric)
  }

  const currentVals = Object.entries(liveSeries).map(([k, v]) => ({ name: k, val: v[59] }))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          ...CARD,
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          border: '1px solid #58a6ff',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700 }}>
              Prometheus Dashboard
            </div>
            <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10, marginTop: 2 }}>
              Cluster: obs-lab-prod | Namespace: production | Live
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#3fb950',
                  marginLeft: 6,
                  verticalAlign: 'middle',
                  animation: 'architecture-pulse 2s infinite',
                }}
              />
            </div>
          </div>
          <button style={{ fontSize: 11, padding: '4px 10px' }} onClick={onClose}>
            Close
          </button>
        </div>

        {/* Current values summary */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(DATASETS).map(([key, ds]) => {
            const seriesVals = Object.values(ds.series).map((v) => v[59])
            const maxNow = Math.max(...seriesVals)
            const isActive = activeMetric === key
            return (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                style={{
                  flex: '1 1 140px',
                  background: isActive ? '#0d1117' : '#0d1117',
                  border: `1px solid ${isActive ? ds.color : '#30363d'}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 9, marginBottom: 4 }}>{ds.label}</div>
                <div style={{ color: ds.color, fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 700 }}>
                  {maxNow.toFixed(1)}
                  <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 4 }}>{ds.unit}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['graphs', 'alerts', 'query'].map((t) => (
            <button
              key={t}
              className={tab === t ? 'primary' : ''}
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'graphs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...CARD, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                  {dataset.label}
                </span>
                <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                  Range: last 60m (1 point/min)
                </span>
              </div>
              <LineChart series={liveSeries} width={700} height={160} unit={dataset.unit} />
            </div>

            {/* Current values table */}
            <div style={{ ...CARD, padding: 12 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 11, marginBottom: 8 }}>
                Instant Vector (T=now)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(liveSeries).map(([name, vals]) => {
                  const current = vals[59]
                  const max = Math.max(...vals)
                  const pct = (current / max) * 100
                  return (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 100, color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{name}</span>
                      <div style={{ flex: 1, background: '#21262d', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: pct > 80 ? '#f85149' : pct > 60 ? '#d29922' : '#3fb950',
                            borderRadius: 4,
                            transition: 'width 0.5s',
                          }}
                        />
                      </div>
                      <span style={{ width: 70, color: dataset.color, fontFamily: 'JetBrains Mono', fontSize: 11, textAlign: 'right' }}>
                        {current.toFixed(1)} {dataset.unit}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'alerts' && (
          <div style={CARD}>
            <AlertRulesPanel />
          </div>
        )}

        {tab === 'query' && (
          <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <QueryBuilder
              activeMetric={activeMetric}
              setActiveMetric={setActiveMetric}
              customQuery={customQuery}
              setCustomQuery={setCustomQuery}
              onRun={runQuery}
            />
            {queryResult && (
              <pre
                style={{
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  padding: 12,
                  color: '#3fb950',
                  fontFamily: 'JetBrains Mono',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}
              >
                {queryResult}
              </pre>
            )}
            <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
              Tip: Try rate(container_cpu_usage_seconds_total[5m]) or histogram_quantile(0.95, ...)
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
