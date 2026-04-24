import { useEffect, useState } from 'react'
import useGameStore from '../store/gameStore'

export default function Leaderboard() {
  const [scores, setScores] = useState([])
  const [activeLevel, setActiveLevel] = useState(null)

  useEffect(() => {
    const url = activeLevel ? `/api/scores?level=${activeLevel}` : '/api/scores'
    fetch(url).then(r => r.json()).then(setScores)
  }, [activeLevel])

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', padding: '40px 24px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <button onClick={() => useGameStore.getState().setScreen('levelSelect')} style={{ marginBottom: 24, fontSize: 13 }}>
          Back
        </button>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 24 }}>
          Leaderboard
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[null, 1, 2, 3, 4, 5].map(l => (
            <button key={l} onClick={() => setActiveLevel(l)}
              style={{ fontSize: 12, padding: '5px 14px', background: activeLevel === l ? '#1c2128' : 'transparent', borderColor: activeLevel === l ? '#58a6ff' : '#30363d' }}>
              {l === null ? 'All' : `Level ${l}`}
            </button>
          ))}
        </div>

        {scores.length === 0 ? (
          <div style={{ fontFamily: 'JetBrains Mono', color: '#8b949e', fontSize: 14 }}>
            No scores yet. Be the first.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scores.map((s, i) => (
              <div key={i} style={{
                background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
                padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'JetBrains Mono', color: i < 3 ? '#d29922' : '#484f58', fontWeight: 700, width: 24 }}>
                    #{i + 1}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono', color: '#e6edf3', fontSize: 14 }}>{s.name}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', color: '#58a6ff', fontSize: 12 }}>L{s.level}</span>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontFamily: 'JetBrains Mono', color: '#3fb950', fontSize: 13 }}>{s.time}s</span>
                  <span style={{ fontFamily: 'JetBrains Mono', color: '#8b949e', fontSize: 12 }}>{s.commands} cmds</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
