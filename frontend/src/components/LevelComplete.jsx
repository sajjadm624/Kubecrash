import { useState } from 'react'
import useGameStore from '../store/gameStore'

export default function LevelComplete() {
  const { winTime, commandsRun, selectedLevel, levelMeta, reset } = useGameStore()
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [rank, setRank] = useState(null)

  const submitScore = async () => {
    if (!name.trim()) return
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), level: selectedLevel, time: winTime, commands: commandsRun })
    })
    const data = await res.json()
    setRank(data.rank)
    setSubmitted(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 32 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 48, color: '#3fb950', marginBottom: 8 }}>OK</div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 8 }}>
          INCIDENT RESOLVED
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: '#8b949e', marginBottom: 32 }}>
          {levelMeta?.title}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
          {[
            { label: 'Time', value: `${winTime}s` },
            { label: 'Commands', value: commandsRun },
          ].map(m => (
            <div key={m.label} style={{
              background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
              padding: '16px 28px', minWidth: 110
            }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 24, fontWeight: 700, color: '#3fb950' }}>{m.value}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#8b949e', marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {!submitted ? (
          <div style={{ marginBottom: 24 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter name for leaderboard"
              onKeyDown={e => e.key === 'Enter' && submitScore()}
              style={{
                background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
                padding: '10px 14px', color: '#e6edf3', fontFamily: 'JetBrains Mono',
                fontSize: 14, width: '100%', marginBottom: 10, outline: 'none'
              }}
            />
            <button className="primary" onClick={submitScore} style={{ width: '100%' }}>
              Submit Score
            </button>
          </div>
        ) : (
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: '#3fb950', marginBottom: 24 }}>
            Rank #{rank} on leaderboard!
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reset}>Level Select</button>
          <button className="primary" onClick={() => {
            const next = selectedLevel + 1
            if (next <= 5) {
              useGameStore.getState().setSelectedLevel(null)
              useGameStore.getState().setScreen('levelSelect')
            } else {
              reset()
            }
          }}>
            Next Level
          </button>
        </div>
      </div>
    </div>
  )
}
