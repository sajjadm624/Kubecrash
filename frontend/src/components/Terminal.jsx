import { useEffect, useRef, useState, useCallback } from 'react'
import useTerminal from '../hooks/useTerminal'
import useGameStore from '../store/gameStore'

export default function Terminal({ sessionId, levelMeta }) {
  const wsRef = useRef(null)
  const { setWin, setGameOver } = useGameStore()
  const [remaining, setRemaining] = useState(levelMeta?.time_limit || 600)
  const [commandsRun, setCommandsRun] = useState(0)
  const [hint, setHint] = useState(null)
  const timerRef = useRef(null)

  const handleCommand = useCallback((cmd) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: cmd }))
    }
  }, [])

  const { termRef, write, writeln, showPrompt, clear } = useTerminal({ onCommand: handleCommand })

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'localhost:8000'
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${wsProtocol}://${apiBase}/api/ws/${sessionId}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)

      if (data.type === 'intro' || data.type === 'output') {
        write(data.output.replace(/\n/g, '\r\n'))
      }
      if (data.type === 'error') {
        write('\r\n\x1b[31m' + data.output + '\x1b[0m\r\n')
      }

      if (data.hint) {
        setHint(data.hint)
        setTimeout(() => setHint(null), 8000)
        write('\r\n\x1b[33m' + data.hint + '\x1b[0m\r\n')
      }

      if (data.remaining !== undefined) setRemaining(data.remaining)
      if (data.commands_run !== undefined) setCommandsRun(data.commands_run)

      if (data.win) {
        setWin(data.win_time, data.commands_run)
        return
      }
      if (data.fail) {
        setGameOver()
        return
      }

      if (data.type !== 'intro') showPrompt()
      if (data.type === 'intro') showPrompt()
    }

    ws.onerror = () => write('\r\n\x1b[31mConnection error.\x1b[0m\r\n')
    ws.onclose = () => {}

    return () => ws.close()
  }, [sessionId])

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(timerRef.current)
          setGameOver()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const mins = Math.floor(remaining / 60)
  const secs = String(remaining % 60).padStart(2, '0')
  const timerColor = remaining < 60 ? '#f85149' : remaining < 180 ? '#d29922' : '#3fb950'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117' }}>
      {/* HUD */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid #30363d', background: '#161b22', flexShrink: 0
      }}>
        <div>
          <span style={{ color: '#f85149', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 13 }}>
            KUBECRASH
          </span>
          <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 12, marginLeft: 16 }}>
            {levelMeta?.title}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#8b949e' }}>
            cmds: <span style={{ color: '#e6edf3' }}>{commandsRun}</span>
          </span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color: timerColor }}>
            {mins}:{secs}
          </span>
          <button
            onClick={() => useGameStore.getState().reset()}
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            exit
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div ref={termRef} style={{ flex: 1, padding: '8px 4px', overflow: 'hidden' }} />
    </div>
  )
}
