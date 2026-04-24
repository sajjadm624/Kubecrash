export default function HUD({ title, commandsRun, timeLabel, onExit }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px', borderBottom: '1px solid #30363d', background: '#161b22', flexShrink: 0
    }}>
      <div>
        <span style={{ color: '#f85149', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 13 }}>
          KUBECRASH
        </span>
        <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 12, marginLeft: 16 }}>
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#8b949e' }}>
          cmds: <span style={{ color: '#e6edf3' }}>{commandsRun}</span>
        </span>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color: '#3fb950' }}>
          {timeLabel}
        </span>
        <button onClick={onExit} style={{ fontSize: 12, padding: '4px 12px' }}>
          exit
        </button>
      </div>
    </div>
  )
}
