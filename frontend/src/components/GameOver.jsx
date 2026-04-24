import useGameStore from '../store/gameStore'

export default function GameOver() {
  const { levelMeta, reset } = useGameStore()
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 32 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 48, color: '#f85149', marginBottom: 8 }}>FAIL</div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color: '#f85149', marginBottom: 8 }}>
          SLA BREACHED
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: '#8b949e', marginBottom: 8 }}>
          {levelMeta?.title}
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#8b949e', marginBottom: 32, lineHeight: 1.7 }}>
          Time's up. The on-call gods are displeased.<br />The SLA breach notification has been sent.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reset}>Level Select</button>
          <button className="primary" onClick={async () => {
            const store = useGameStore.getState()
            const res = await fetch('/api/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ level: store.selectedLevel })
            })
            const data = await res.json()
            store.setSession(data.session_id, data)
            store.setScreen('game')
          }}>
            Retry
          </button>
        </div>
      </div>
    </div>
  )
}
