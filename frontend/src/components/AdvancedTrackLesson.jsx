/**
 * AdvancedTrackLesson — Full lesson renderer for Observability, Security, GitOps, Cluster Ops tracks
 * Supports: incident brief, philosophy, checkpoints, custom quiz, retrospective, track-specific tools
 */
import { useState, useEffect, useCallback } from 'react'
import MetricsDashboard from './MetricsDashboard'
import { ADVANCED_TRACKS } from '../data/learning/advancedTracks'

const CARD = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 10,
  padding: 16,
}

const TRACK_META = {
  observability: {
    color: '#58a6ff',
    bg: '#0c1929',
    icon: '📊',
    label: 'Observability',
    tools: ['metrics', 'logs', 'traces'],
  },
  security: {
    color: '#f85149',
    bg: '#1c0a0a',
    icon: '🔐',
    label: 'Security',
    tools: ['rbac', 'policy', 'audit'],
  },
  gitops: {
    color: '#3fb950',
    bg: '#0a1c0a',
    icon: '⎇',
    label: 'GitOps',
    tools: ['git', 'argocd'],
  },
  'cluster-ops': {
    color: '#d29922',
    bg: '#1a1500',
    icon: '⚙',
    label: 'Cluster Ops',
    tools: ['metrics', 'quota'],
  },
}

// ── Checkpoint list ────────────────────────────────────────────────────────
function CheckpointList({ checkpoints, completed, revealed, onReveal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {checkpoints.map((cp, idx) => {
        const done = !!completed[cp.id]
        const isNext = !done && checkpoints.slice(0, idx).every((c) => !!completed[c.id])
        const isRevealed = !!revealed[cp.id]

        return (
          <div
            key={cp.id}
            style={{
              border: `1px solid ${done ? '#3fb950' : isNext ? '#58a6ff' : '#30363d'}`,
              borderRadius: 8,
              padding: '10px 12px',
              background: done ? '#0a1c0a' : isNext ? '#0c1929' : 'transparent',
              opacity: !done && !isNext && idx > 0 ? 0.6 : 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: done ? '#3fb950' : '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                {done ? '✓ ' : isNext ? '→ ' : '○ '}{cp.title}
              </span>
              {isNext && !isRevealed && (
                <button
                  style={{ fontSize: 10, padding: '3px 8px', color: '#d29922', border: '1px solid #d29922', background: 'transparent', borderRadius: 4 }}
                  onClick={() => onReveal(cp.id)}
                >
                  Reveal Answer
                </button>
              )}
            </div>
            <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 11, marginTop: 4 }}>
              {cp.concept}
            </div>
            {isRevealed && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #d29922',
                  background: '#1a1500',
                }}
              >
                <div style={{ color: '#d29922', fontFamily: 'JetBrains Mono', fontSize: 10, marginBottom: 4 }}>
                  HINT (−5 points)
                </div>
                <pre
                  style={{
                    color: '#3fb950',
                    fontFamily: 'JetBrains Mono',
                    fontSize: 11,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                  }}
                >
                  {cp.command}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Quiz ──────────────────────────────────────────────────────────────────
function QuizPanel({ quiz, answers, setAnswers, submitted, onSubmit }) {
  const score = quiz.reduce((acc, q) => (answers[q.id] === q.correct ? acc + 1 : acc), 0)
  const allAnswered = quiz.every((q) => answers[q.id] !== undefined)

  return (
    <div style={CARD}>
      <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 12 }}>
        Lesson Recap Quiz
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {quiz.map((q, idx) => (
          <div key={q.id} style={{ border: '1px solid #30363d', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#e6edf3', fontSize: 12, fontFamily: 'JetBrains Mono', marginBottom: 8 }}>
              Q{idx + 1}. {q.prompt}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {q.options.map((opt, optIdx) => {
                const selected = answers[q.id] === optIdx
                const correct = submitted && optIdx === q.correct
                const wrong = submitted && selected && optIdx !== q.correct
                return (
                  <button
                    key={optIdx}
                    disabled={submitted}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                    style={{
                      textAlign: 'left',
                      padding: '7px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'JetBrains Mono',
                      border: `1px solid ${correct ? '#3fb950' : wrong ? '#f85149' : selected ? '#58a6ff' : '#30363d'}`,
                      background: correct ? '#0a1c0a' : wrong ? '#1c0a0a' : selected ? '#0c1929' : 'transparent',
                      color: correct ? '#3fb950' : wrong ? '#f85149' : selected ? '#58a6ff' : '#8b949e',
                    }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            {submitted && (
              <div style={{ color: '#8b949e', fontSize: 11, fontFamily: 'JetBrains Mono', marginTop: 8, padding: '6px 8px', borderRadius: 6, background: '#0d1117' }}>
                💡 {q.explanation}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <button
          disabled={!allAnswered || submitted}
          style={{ fontSize: 12, padding: '8px 16px', opacity: allAnswered && !submitted ? 1 : 0.5 }}
          onClick={onSubmit}
        >
          Submit & Continue
        </button>
        {submitted && (
          <span style={{ color: '#3fb950', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
            Score: {score}/{quiz.length}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Retrospective Panel ──────────────────────────────────────────────────
const RETRO_PROMPTS = [
  {
    id: 'what_happened',
    label: 'What happened? (in your own words)',
    placeholder: 'Describe the incident and root cause in plain English...',
  },
  {
    id: 'first_signal',
    label: 'What was the first signal that something was wrong?',
    placeholder: 'e.g., alert fired, user report, anomaly in metrics...',
  },
  {
    id: 'key_command',
    label: 'What was the single most important command you ran?',
    placeholder: 'e.g., kubectl describe pod / kubectl top nodes...',
  },
  {
    id: 'differently',
    label: 'What would you do differently next time?',
    placeholder: 'Faster diagnosis? Better alerting? Different first step?',
  },
  {
    id: 'prevention',
    label: 'What process or tooling would have prevented this?',
    placeholder: 'e.g., liveness probes, resource limits, audit logging, runbook...',
  },
]

function RetroPanel({ lesson, sessionStats, onComplete }) {
  const trackLessons = ADVANCED_TRACKS.filter((l) => l.track === lesson.track)
  const currentLessonIndex = trackLessons.findIndex((l) => l.id === lesson.id)
  const nextTrackOrder = ['observability', 'security', 'gitops', 'cluster-ops']
  const currentTrackIndex = nextTrackOrder.indexOf(lesson.track)
  const nextTrackId = currentTrackIndex >= 0 ? nextTrackOrder[currentTrackIndex + 1] : null
  const nextLessonInTrack = currentLessonIndex >= 0 ? trackLessons[currentLessonIndex + 1] : null
  const nextTrackFirstLesson = nextTrackId ? ADVANCED_TRACKS.find((l) => l.track === nextTrackId) : null
  const nextLesson = nextLessonInTrack || nextTrackFirstLesson
  const suggestedActionItems = [
    lesson.checkpoints?.[0] ? `Re-run checkpoint: ${lesson.checkpoints[0].title}` : '',
    lesson.docs?.[0] ? `Review docs: ${lesson.docs[0].title}` : '',
    lesson.checkpoints?.[lesson.checkpoints.length - 1]
      ? `Practice command: ${lesson.checkpoints[lesson.checkpoints.length - 1].command.split('\n')[0]}`
      : '',
  ].filter(Boolean).slice(0, 3)

  const [answers, setAnswers] = useState({})
  const [actionItems, setActionItems] = useState([
    suggestedActionItems[0] || '',
    suggestedActionItems[1] || '',
    suggestedActionItems[2] || '',
  ])
  const [activePrompt, setActivePrompt] = useState(0)
  const [saved, setSaved] = useState(false)

  const allAnswered = RETRO_PROMPTS.every((p) => (answers[p.id] || '').trim().length > 0)

  function setAnswer(id, val) {
    setAnswers((prev) => ({ ...prev, [id]: val }))
  }

  function setActionItem(idx, val) {
    setActionItems((prev) => prev.map((item, i) => (i === idx ? val : item)))
  }

  function handleSave() {
    setSaved(true)
    onComplete({
      answers,
      actionItems: actionItems.filter((a) => a.trim()),
      savedAt: Date.now(),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div
        style={{
          ...CARD,
          background: '#0c1929',
          border: '1px solid #58a6ff',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>
              POST-INCIDENT RETROSPECTIVE
            </div>
            <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 16 }}>{lesson.title}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'TIME', value: sessionStats.time, color: '#e6edf3' },
              { label: 'CHECKPOINTS', value: `${sessionStats.checkpoints}/${sessionStats.totalCheckpoints}`, color: '#3fb950' },
              { label: 'QUIZ', value: `${sessionStats.quizScore}/${sessionStats.quizTotal}`, color: '#d29922' },
            ].map((stat) => (
              <div key={stat.label} style={{ textAlign: 'center', padding: '8px 14px', background: '#161b22', borderRadius: 8, border: '1px solid #21262d' }}>
                <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 9, marginBottom: 3 }}>{stat.label}</div>
                <div style={{ color: stat.color, fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700 }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Incident quick recap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ ...CARD, padding: 12 }}>
          <div style={{ color: '#f85149', fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>ROOT CAUSE</div>
          <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 11, lineHeight: 1.5 }}>
            {lesson.checkpoints?.slice(-1)[0]?.concept || lesson.briefTitle}
          </div>
        </div>
        <div style={{ ...CARD, padding: 12 }}>
          <div style={{ color: '#3fb950', fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>KEY FIX</div>
          <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 11, lineHeight: 1.5 }}>
            {lesson.checkpoints?.slice(-1)[0]?.title || '–'}
          </div>
        </div>
        <div style={{ ...CARD, padding: 12 }}>
          <div style={{ color: '#d29922', fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>MENTAL MODEL</div>
          <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 11, lineHeight: 1.5 }}>
            {lesson.philosophy?.split('.')[0]}.
          </div>
        </div>
      </div>

      {/* Reflection prompts */}
      <div style={CARD}>
        <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
          Reflection ({Object.keys(answers).filter((k) => answers[k]?.trim()).length}/{RETRO_PROMPTS.length} answered)
        </div>

        {/* Prompt tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {RETRO_PROMPTS.map((p, idx) => {
            const answered = (answers[p.id] || '').trim().length > 0
            return (
              <button
                key={p.id}
                onClick={() => setActivePrompt(idx)}
                style={{
                  fontSize: 10,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${activePrompt === idx ? '#58a6ff' : answered ? '#3fb950' : '#30363d'}`,
                  background: activePrompt === idx ? '#0c1929' : 'transparent',
                  color: activePrompt === idx ? '#58a6ff' : answered ? '#3fb950' : '#8b949e',
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {answered ? '✓ ' : ''}{idx + 1}. {p.label.split(' ').slice(0, 3).join(' ')}…
              </button>
            )
          })}
        </div>

        {/* Active prompt */}
        {(() => {
          const prompt = RETRO_PROMPTS[activePrompt]
          return (
            <div>
              <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 8 }}>
                {prompt.label}
              </div>
              <textarea
                value={answers[prompt.id] || ''}
                onChange={(e) => setAnswer(prompt.id, e.target.value)}
                placeholder={prompt.placeholder}
                rows={5}
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  color: '#e6edf3',
                  fontFamily: 'JetBrains Mono',
                  fontSize: 12,
                  padding: '10px 12px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: 1.6,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                {activePrompt < RETRO_PROMPTS.length - 1 && (
                  <button
                    style={{ fontSize: 11, padding: '5px 12px' }}
                    onClick={() => setActivePrompt((p) => p + 1)}
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Action items */}
      <div style={CARD}>
        <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
          Action Items (what you will do next)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actionItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, width: 20 }}>{idx + 1}.</span>
              <input
                value={item}
                onChange={(e) => setActionItem(idx, e.target.value)}
                placeholder={`Action item ${idx + 1}...`}
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
            </div>
          ))}
        </div>
      </div>

      {/* What to practice next */}
      <div style={CARD}>
        <div style={{ color: '#d29922', fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
          Recommended Practice
        </div>
        {nextLesson ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #21262d',
              background: '#0d1117',
            }}
          >
            <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
              {nextLessonInTrack
                ? 'Next lesson in this track'
                : 'Track complete. Suggested next track lesson'}
            </div>
            <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
              {nextLesson.title}
            </div>
            <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10, lineHeight: 1.5 }}>
              {nextLesson.objective}
            </div>
          </div>
        ) : (
          <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
            You completed all advanced tracks. Re-run the hard lessons and compare your retrospective notes.
          </div>
        )}
      </div>

      {/* Docs quick links */}
      {lesson.docs?.length > 0 && (
        <div style={CARD}>
          <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 11, marginBottom: 8 }}>Reference material to revisit</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {lesson.docs.map((d) => (
              <a
                key={d.url}
                href={d.url}
                target='_blank'
                rel='noreferrer'
                style={{
                  color: '#58a6ff',
                  fontFamily: 'JetBrains Mono',
                  fontSize: 11,
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  padding: '4px 8px',
                  textDecoration: 'none',
                }}
              >
                {d.title} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!allAnswered && (
          <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
            Answer all {RETRO_PROMPTS.length} reflection questions to complete
          </span>
        )}
        <button
          className={allAnswered ? 'primary' : ''}
          disabled={!allAnswered || saved}
          onClick={handleSave}
          style={{ fontSize: 13, padding: '10px 24px', marginLeft: 'auto', opacity: allAnswered && !saved ? 1 : 0.6 }}
        >
          {saved ? '✓ Retrospective Saved' : 'Save & Complete Lesson →'}
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AdvancedTrackLesson({ lesson, onBack, progress, onComplete }) {
  const meta = TRACK_META[lesson.track] || TRACK_META.observability
  const [phase, setPhase] = useState('intro') // 'intro' | 'lesson' | 'quiz' | 'retro' | 'done'
  const [completed, setCompleted] = useState({})
  const [revealed, setRevealed] = useState({})
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const [commandInput, setCommandInput] = useState('')
  const [termLog, setTermLog] = useState([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [timerActive, setTimerActive] = useState(true)

  const checkpoints = lesson.checkpoints || []
  const allDone = checkpoints.every((cp) => !!completed[cp.id])

  const timerStarted = phase !== 'intro'

  useEffect(() => {
    if (!timerActive || !timerStarted) return
    const iv = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => clearInterval(iv)
  }, [timerActive])

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const runCommand = useCallback(() => {
    const cmd = commandInput.trim()
    if (!cmd) return
    const pending = checkpoints.find((cp) => !completed[cp.id])
    if (!pending) {
      setTermLog((l) => [...l, `$ ${cmd}`, '✓ All checkpoints complete'])
      setCommandInput('')
      return
    }

    // Simulate command matching for checkpoints
    const normalize = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()
    const baseCmd = normalize(cmd).split(' ').slice(0, 4).join(' ')
    const refCmd = normalize(pending.command).split(' ').slice(0, 4).join(' ')
    const match = baseCmd === refCmd || normalize(cmd).includes(normalize(pending.command.split('\n')[0].slice(0, 30)))
    const simulatedOutput = match
      ? `(Simulated output)\n${pending.validation({ includes: (s) => true }) ? 'Success' : 'done'}`
      : null

    const logLines = [`$ ${cmd}`]
    if (simulatedOutput) {
      logLines.push(simulatedOutput)
      setCompleted((prev) => ({ ...prev, [pending.id]: true }))
    } else {
      logLines.push('Command not matched. Verify your target and resource names.')
    }
    setTermLog((l) => [...l.slice(-60), ...logLines])
    setCommandInput('')
  }, [commandInput, checkpoints, completed])

  function handleReveal(cpId) {
    setRevealed((r) => ({ ...r, [cpId]: true }))
  }

  function handleQuizSubmit() {
    setQuizSubmitted(true)
    setTimerActive(false)
    setTimeout(() => setPhase('retro'), 800)
  }

  function handleRetroComplete(retroNotes) {
    const quizScore = (lesson.quiz || []).reduce((acc, q) => (quizAnswers[q.id] === q.correct ? acc + 1 : acc), 0)
    setPhase('done')
    onComplete({ lessonId: lesson.id, elapsed: elapsedSeconds, quizScore, quizAnswers, retroNotes })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {showMetrics && lesson.track === 'observability' && (
        <MetricsDashboard onClose={() => setShowMetrics(false)} />
      )}

      {/* ── INTRO SCREEN ─────────────────────────────────────── */}
      {phase === 'intro' && (
        <>
          {/* Track + title banner */}
          <div
            style={{
              ...CARD,
              background: meta.bg,
              border: `1px solid ${meta.color}`,
              padding: '20px 24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <button style={{ fontSize: 11, padding: '4px 10px' }} onClick={onBack}>
                  ← Back
                </button>
                <div>
                  <div style={{ color: meta.color, fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
                    {lesson.trackTitle?.toUpperCase()} › {lesson.domain?.toUpperCase()}
                  </div>
                  <h2 style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 20, margin: 0 }}>
                    {lesson.title}
                  </h2>
                </div>
              </div>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: lesson.difficulty === 'hard' ? '#1c0a0a' : lesson.difficulty === 'intermediate' ? '#1a1500' : '#0a1c0a',
                  color: lesson.difficulty === 'hard' ? '#f85149' : lesson.difficulty === 'intermediate' ? '#d29922' : '#3fb950',
                  fontFamily: 'JetBrains Mono',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {lesson.difficulty?.toUpperCase()}
              </span>
            </div>

            <p style={{ color: '#8b949e', fontSize: 13, margin: '14px 0 0', lineHeight: 1.6 }}>
              {lesson.objective}
            </p>
          </div>

          {/* Incident brief + Philosophy side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ ...CARD, border: `1px solid ${meta.color}33` }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottom: '1px solid #21262d',
                }}
              >
                <span style={{ fontSize: 16 }}>🚨</span>
                <div>
                  <div style={{ color: meta.color, fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>INCIDENT BRIEF</div>
                  <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12, marginTop: 1 }}>{lesson.briefTitle}</div>
                </div>
              </div>
              <p style={{ color: '#8b949e', fontSize: 12, lineHeight: 1.7, margin: 0 }}>
                {lesson.brief}
              </p>
            </div>

            <div style={{ ...CARD, border: '1px solid #30363d' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottom: '1px solid #21262d',
                }}
              >
                <span style={{ fontSize: 16 }}>🧠</span>
                <div>
                  <div style={{ color: '#d29922', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>MENTAL MODEL</div>
                  <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12, marginTop: 1 }}>The right way to think about this</div>
                </div>
              </div>
              <p style={{ color: '#8b949e', fontSize: 12, lineHeight: 1.7, margin: 0 }}>
                {lesson.philosophy}
              </p>
            </div>
          </div>

          {/* Cluster overview */}
          <div style={CARD}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                paddingBottom: 10,
                borderBottom: '1px solid #21262d',
              }}
            >
              <span style={{ fontSize: 16 }}>☸</span>
              <div>
                <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>CLUSTER CONTEXT</div>
                <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 12, marginTop: 1 }}>Your environment for this lesson</div>
              </div>
            </div>
            <pre
              style={{
                color: '#e6edf3',
                fontFamily: 'JetBrains Mono',
                fontSize: 11,
                background: '#0d1117',
                borderRadius: 6,
                padding: 12,
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {lesson.clusterOverview}
            </pre>
          </div>

          {/* What you will do + Time estimate row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
            <div style={CARD}>
              <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, marginBottom: 10 }}>What you will do</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(lesson.checkpoints || []).map((cp, idx) => (
                  <div key={cp.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: '#21262d',
                        border: `1px solid ${meta.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: meta.color,
                        fontFamily: 'JetBrains Mono',
                        fontSize: 10,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{cp.title}</div>
                      <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10, marginTop: 2 }}>{cp.concept}</div>
                    </div>
                  </div>
                ))}
              </div>
              {lesson.docs?.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #21262d' }}>
                  <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10, marginBottom: 6 }}>Reference docs</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {lesson.docs.map((d) => (
                      <a
                        key={d.url}
                        href={d.url}
                        target='_blank'
                        rel='noreferrer'
                        style={{
                          color: '#58a6ff',
                          fontFamily: 'JetBrains Mono',
                          fontSize: 10,
                          border: '1px solid #30363d',
                          borderRadius: 6,
                          padding: '3px 7px',
                          textDecoration: 'none',
                        }}
                      >
                        {d.title} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <div style={{ ...CARD, padding: '14px 20px', textAlign: 'center', minWidth: 130 }}>
                <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 9, marginBottom: 4 }}>ESTIMATED TIME</div>
                <div style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700 }}>{Math.round((lesson.timeLimit || 900) / 60)}<span style={{ fontSize: 12, fontWeight: 400 }}>m</span></div>
              </div>
              <div style={{ ...CARD, padding: '14px 20px', textAlign: 'center', minWidth: 130 }}>
                <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 9, marginBottom: 4 }}>CHECKPOINTS</div>
                <div style={{ color: meta.color, fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700 }}>{lesson.checkpoints?.length || 0}</div>
              </div>
              <div style={{ ...CARD, padding: '14px 20px', textAlign: 'center', minWidth: 130 }}>
                <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 9, marginBottom: 4 }}>QUIZ QUESTIONS</div>
                <div style={{ color: '#d29922', fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700 }}>{lesson.quiz?.length || 0}</div>
              </div>
              <button
                className='primary'
                onClick={() => { setPhase('lesson'); setTimerActive(true) }}
                style={{ width: '100%', fontSize: 13, padding: '12px 0', marginTop: 4 }}
              >
                Start Lesson →
              </button>
            </div>
          </div>
        </>
      )}

      {phase !== 'intro' && (
      <>
      <div
        style={{
          ...CARD,
          background: meta.bg,
          border: `1px solid ${meta.color}`,
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button style={{ fontSize: 11, padding: '4px 10px' }} onClick={onBack}>
              ← Back
            </button>
            <span style={{ color: meta.color, fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700 }}>
              {meta.icon} {lesson.trackTitle}
            </span>
            <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
              › {lesson.domain}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Track-specific tool buttons */}
            {lesson.track === 'observability' && (
              <button
                style={{ fontSize: 10, padding: '4px 10px', borderColor: '#58a6ff', color: '#58a6ff' }}
                onClick={() => setShowMetrics(true)}
              >
                Open Metrics Dashboard
              </button>
            )}
            <span
              style={{
                color: elapsedSeconds > lesson.timeLimit * 0.8 ? '#f85149' : '#8b949e',
                fontFamily: 'JetBrains Mono',
                fontSize: 12,
              }}
            >
              {formatTime(elapsedSeconds)}
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                background: lesson.difficulty === 'hard' ? '#1c0a0a' : lesson.difficulty === 'intermediate' ? '#1a1500' : '#0a1c0a',
                color: lesson.difficulty === 'hard' ? '#f85149' : lesson.difficulty === 'intermediate' ? '#d29922' : '#3fb950',
                fontFamily: 'JetBrains Mono',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {lesson.difficulty?.toUpperCase()}
            </span>
          </div>
        </div>
        <h2 style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 16, margin: '10px 0 4px' }}>
          {lesson.title}
        </h2>
        <p style={{ color: '#8b949e', fontSize: 12, margin: 0 }}>{lesson.objective}</p>
      </div>

      {phase !== 'done' && (
        <>
          {/* Checkpoints + Terminal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={CARD}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 10 }}>
                Checkpoints ({Object.keys(completed).length}/{checkpoints.length})
              </div>
              <CheckpointList
                checkpoints={checkpoints}
                completed={completed}
                revealed={revealed}
                onReveal={handleReveal}
              />
              {allDone && phase === 'lesson' && (
                <button
                  className='primary'
                  style={{ width: '100%', marginTop: 12, fontSize: 12 }}
                  onClick={() => setPhase('quiz')}
                >
                  Proceed to Recap Quiz →
                </button>
              )}
            </div>

            <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 8 }}>
                Practice Terminal
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 220,
                  maxHeight: 300,
                  overflowY: 'auto',
                  background: '#0d1117',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontFamily: 'JetBrains Mono',
                  fontSize: 11,
                  color: '#3fb950',
                  marginBottom: 8,
                }}
              >
                {termLog.length === 0 && (
                  <span style={{ color: '#8b949e' }}>
                    {`# ${lesson.clusterOverview?.split('\n')[1]?.trim() || 'kubecrash-lab'}\n# Type kubectl commands to complete checkpoints`}
                  </span>
                )}
                {termLog.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      color: line.startsWith('$') ? '#e6edf3' : line.startsWith('✓') ? '#3fb950' : line.startsWith('Command') ? '#d29922' : '#3fb950',
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runCommand()}
                  placeholder='kubectl ...'
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
                <button style={{ fontSize: 11, padding: '6px 12px' }} onClick={runCommand}>
                  Run
                </button>
              </div>
            </div>
          </div>

          {/* Docs */}
          {lesson.docs?.length > 0 && (
            <div style={{ ...CARD, padding: 12 }}>
              <div style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 11, marginBottom: 8 }}>
                Official References
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {lesson.docs.map((d) => (
                  <a
                    key={d.url}
                    href={d.url}
                    target='_blank'
                    rel='noreferrer'
                    style={{
                      color: '#58a6ff',
                      fontFamily: 'JetBrains Mono',
                      fontSize: 11,
                      border: '1px solid #30363d',
                      borderRadius: 6,
                      padding: '4px 8px',
                      textDecoration: 'none',
                    }}
                  >
                    {d.title} ↗
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Quiz phase */}
          {phase === 'quiz' && lesson.quiz?.length > 0 && (
            <QuizPanel
              quiz={lesson.quiz}
              answers={quizAnswers}
              setAnswers={setQuizAnswers}
              submitted={quizSubmitted}
              onSubmit={handleQuizSubmit}
            />
          )}

          {/* Retro phase */}
          {phase === 'retro' && (
            <RetroPanel
              lesson={lesson}
              sessionStats={{
                time: formatTime(elapsedSeconds),
                checkpoints: Object.keys(completed).length,
                totalCheckpoints: checkpoints.length,
                quizScore: (lesson.quiz || []).reduce((acc, q) => (quizAnswers[q.id] === q.correct ? acc + 1 : acc), 0),
                quizTotal: lesson.quiz?.length || 0,
              }}
              onComplete={handleRetroComplete}
            />
          )}
        </>
      )}

      {/* Done screen */}
      {phase === 'done' && (
        <div style={{ ...CARD, textAlign: 'center', padding: 40, border: `1px solid ${meta.color}`, background: meta.bg }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{meta.icon}</div>
          <h2 style={{ color: meta.color, fontFamily: 'JetBrains Mono', fontSize: 20, marginBottom: 8 }}>
            Incident Resolved
          </h2>
          <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 20 }}>{lesson.title}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ ...CARD, padding: '10px 20px', textAlign: 'center' }}>
              <div style={{ color: '#8b949e', fontSize: 10, fontFamily: 'JetBrains Mono' }}>TIME</div>
              <div style={{ color: '#3fb950', fontFamily: 'JetBrains Mono', fontSize: 18 }}>{formatTime(elapsedSeconds)}</div>
            </div>
            <div style={{ ...CARD, padding: '10px 20px', textAlign: 'center' }}>
              <div style={{ color: '#8b949e', fontSize: 10, fontFamily: 'JetBrains Mono' }}>CHECKPOINTS</div>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 18 }}>{checkpoints.length}/{checkpoints.length}</div>
            </div>
            <div style={{ ...CARD, padding: '10px 20px', textAlign: 'center' }}>
              <div style={{ color: '#8b949e', fontSize: 10, fontFamily: 'JetBrains Mono' }}>QUIZ</div>
              <div style={{ color: '#d29922', fontFamily: 'JetBrains Mono', fontSize: 18 }}>
                {lesson.quiz?.reduce((acc, q) => (quizAnswers[q.id] === q.correct ? acc + 1 : acc), 0)}/{lesson.quiz?.length || 0}
              </div>
            </div>
          </div>
          <button className='primary' onClick={onBack} style={{ fontSize: 13, padding: '10px 24px' }}>
            Back to Track
          </button>
        </div>
      )}
      </>
      )}
    </div>
  )
}
