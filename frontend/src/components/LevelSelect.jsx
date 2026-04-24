import { useState, useEffect } from 'react'
import useGameStore from '../store/gameStore'

const DIFFICULTY_COLOR = {
  'Beginner': '#3fb950',
  'Intermediate': '#d29922',
  'Advanced': '#f85149',
}

export default function LevelSelect() {
  const [levels, setLevels] = useState({})
  const [loading, setLoading] = useState(true)
  const { setScreen, setSession, setSelectedLevel } = useGameStore()

  useEffect(() => {
    fetch('/api/levels')
      .then(r => r.json())
      .then(data => { setLevels(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const startLevel = async (levelNum) => {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: levelNum })
    })
    const data = await res.json()
    setSelectedLevel(levelNum)
    setSession(data.session_id, data)
    setScreen('game')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <span style={{ fontFamily: 'JetBrains Mono', color: '#3fb950' }}>Loading...</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 36, fontWeight: 700, color: '#f85149', letterSpacing: 2 }}>
          KUBECRASH
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: '#8b949e', marginTop: 8 }}>
          Learn Kubernetes by surviving production incidents
        </div>
      </div>

      {/* Level cards */}
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.entries(levels).map(([num, meta]) => {
          const locked = !meta.free
          return (
            <div key={num} style={{
              background: '#161b22',
              border: `1px solid ${locked ? '#21262d' : '#30363d'}`,
              borderRadius: 10,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: locked ? 0.6 : 1,
              gap: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 8,
                  background: locked ? '#21262d' : '#1c2128',
                  border: `1px solid ${locked ? '#30363d' : '#3fb950'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 16,
                  color: locked ? '#484f58' : '#3fb950', flexShrink: 0,
                }}>
                  {num}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 15, color: locked ? '#484f58' : '#e6edf3' }}>
                      {meta.title}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
                      background: `${DIFFICULTY_COLOR[meta.difficulty]}22`,
                      color: DIFFICULTY_COLOR[meta.difficulty],
                      border: `1px solid ${DIFFICULTY_COLOR[meta.difficulty]}44`,
                    }}>
                      {meta.difficulty}
                    </span>
                    {locked && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}>
                        Locked
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#8b949e' }}>
                    {meta.tagline}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {meta.concepts.map(c => (
                      <span key={c} style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 4,
                        background: '#1c2128', border: '1px solid #30363d',
                        fontFamily: 'JetBrains Mono', color: '#58a6ff'
                      }}>{c}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#8b949e' }}>
                  {Math.floor(meta.time_limit / 60)}m limit
                </span>
                <button
                  onClick={() => !locked && startLevel(parseInt(num))}
                  disabled={locked}
                  className={locked ? '' : 'primary'}
                  style={{ minWidth: 90, fontSize: 13 }}
                >
                  {locked ? 'Locked' : 'Start'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 40 }}>
        <button
          onClick={() => useGameStore.getState().setScreen('learning')}
          style={{ fontSize: 13, color: '#58a6ff', marginRight: 10 }}
        >
          CKA Learning Journey
        </button>
        <button onClick={() => useGameStore.getState().setScreen('leaderboard')} style={{ fontSize: 13, color: '#8b949e' }}>
          View Leaderboard
        </button>
      </div>
    </div>
  )
}
