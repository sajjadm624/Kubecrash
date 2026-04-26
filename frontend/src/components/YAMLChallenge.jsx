import { useState } from 'react'
import { YAML_CHALLENGES, validateYamlChallenge } from '../data/learning/yamlChallenges'

function getWorkflowTemplate(challenge, workflow) {
  const workflows = challenge?.workflows || {}

  // Preferred shape: workflows.template.template / workflows.broken.template
  if (workflows[workflow]?.template) return workflows[workflow].template

  // Backward-compatible shape used in current dataset:
  // workflows.blank.template and workflows.blank.broken
  if (workflow === 'template' && workflows.blank?.template) return workflows.blank.template
  if (workflow === 'broken' && workflows.blank?.broken) return workflows.blank.broken

  // "blank" mode should start from an empty editor.
  if (workflow === 'blank') return ''

  return ''
}

export default function YAMLChallenge({ challengeId, onBack, progress, recordProgress }) {
  const challenge = YAML_CHALLENGES.find((c) => c.id === challengeId)
  if (!challenge) return <div>Challenge not found</div>

  const [workflow, setWorkflow] = useState('blank')
  const [yamlText, setYamlText] = useState(getWorkflowTemplate(challenge, 'blank'))
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [validationResults, setValidationResults] = useState(null)

  const handleWorkflowChange = (newWorkflow) => {
    setWorkflow(newWorkflow)
    setYamlText(getWorkflowTemplate(challenge, newWorkflow))
    setValidationResults(null)
    setQuizAnswers({})
    setQuizSubmitted(false)
  }

  const handleValidate = () => {
    const results = validateYamlChallenge(challengeId, yamlText)
    setValidationResults(results)
  }

  const handleQuizSubmit = () => {
    setQuizSubmitted(true)
    const score = challenge.quiz.reduce((acc, q) => (quizAnswers[q.id] === q.correct ? acc + 1 : acc), 0)
    recordProgress({
      completedYamlChallenge: challengeId,
      yamlChallengeScore: score,
      yamlChallengeTotal: challenge.quiz.length,
    })
  }

  const workflowDescriptions = {
    blank: '✍️ Start from zero — write the entire manifest yourself',
    template: '📋 Fill-in-the-blanks approach — guided structure with key details omitted',
    broken: '🔧 Fix the broken manifest — find and correct the errors',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', padding: '24px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <button onClick={onBack} style={{ marginBottom: 16, fontSize: 12 }}>
          ← Back to Menu
        </button>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'JetBrains Mono', fontSize: 18, color: '#e6edf3', marginBottom: 8 }}>
            {challenge.title}
          </h2>
          <p style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 11, marginBottom: 8 }}>
            Difficulty: <strong>{challenge.difficulty.toUpperCase()}</strong> | Domain: {challenge.domain}
          </p>
          <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 16 }}>{challenge.objective}</p>

          {challenge.brief && (
            <div style={{ border: '1px solid #21262d', borderLeft: '3px solid #f85149', borderRadius: 8, padding: '12px 14px', background: '#110d0d', marginBottom: 16 }}>
              <div style={{ color: '#f85149', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>◉ INCIDENT BRIEF</div>
              <p style={{ color: '#e6edf3', fontSize: 12, margin: 0, lineHeight: 1.6 }}>{challenge.brief}</p>
            </div>
          )}

          {challenge.philosophy && (
            <div style={{ border: '1px solid #21262d', borderLeft: '3px solid #58a6ff', borderRadius: 8, padding: '12px 14px', background: '#0a0d17', marginBottom: 16 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>💡 PHILOSOPHY</div>
              <p style={{ color: '#8b949e', fontSize: 12, margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>{challenge.philosophy}</p>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 16 }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 12 }}>WORKFLOW MODE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {['blank', 'template', 'broken'].map((mode) => (
                  <button
                    key={mode}
                    className={workflow === mode ? 'primary' : ''}
                    onClick={() => handleWorkflowChange(mode)}
                    style={{
                      padding: '12px 10px',
                      textAlign: 'left',
                      fontSize: 12,
                      border: workflow === mode ? '1px solid #58a6ff' : '1px solid #30363d',
                      background: workflow === mode ? '#0a2c5c' : '#0f1722',
                      color: workflow === mode ? '#58a6ff' : '#8b949e',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{mode.toUpperCase()}</div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{workflowDescriptions[mode]}</div>
                  </button>
                ))}
              </div>

              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 12 }}>CLUSTER CONTEXT</div>
              <div style={{ border: '1px solid #21262d', borderRadius: 6, padding: '10px 12px', background: '#0f1722', marginBottom: 16 }}>
                <p style={{ color: '#8b949e', fontFamily: 'JetBrains Mono', fontSize: 10, lineHeight: 1.6, margin: 0 }}>
                  {challenge.clusterOverview}
                </p>
              </div>

              <button onClick={handleValidate} style={{ width: '100%', padding: '10px', fontSize: 12, marginBottom: 12 }}>
                ▶ Validate YAML
              </button>

              {validationResults && (
                <div style={{ border: '1px solid #30363d', borderRadius: 8, padding: 12, background: '#0f1722' }}>
                  <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
                    VALIDATION RESULTS ({validationResults.score.passed}/{validationResults.score.total})
                  </div>
                  {validationResults.results.map((result, idx) => (
                    <div key={idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #21262d' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ color: result.pass ? '#3fb950' : '#f85149', fontWeight: 700 }}>
                          {result.pass ? '✓' : '✗'}
                        </span>
                        <span style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{result.rule}</span>
                      </div>
                      {result.error && <div style={{ color: '#f85149', fontSize: 10, marginLeft: 20 }}>{result.error}</div>}
                      {result.hint && <div style={{ color: '#3fb950', fontSize: 10, marginLeft: 20 }}>{result.hint}</div>}
                    </div>
                  ))}
                  {validationResults.valid ? (
                    <div style={{ color: '#3fb950', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, marginTop: 10 }}>
                      ✓ All checks passed! Proceed to recap quiz.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 12 }}>YAML EDITOR</div>
              <textarea
                value={yamlText}
                onChange={(e) => setYamlText(e.target.value)}
                style={{
                  flex: 1,
                  minHeight: 400,
                  padding: 12,
                  fontFamily: 'JetBrains Mono',
                  fontSize: 11,
                  background: '#0f1722',
                  color: '#e6edf3',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  resize: 'none',
                  marginBottom: 12,
                }}
                placeholder="Write your YAML manifests here..."
              />

              {validationResults?.valid && (
                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 16 }}>
                  <div style={{ color: '#58a6ff', fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 12 }}>RECAP QUIZ</div>
                  {challenge.quiz.map((q, idx) => (
                    <div key={q.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #30363d' }}>
                      <div style={{ color: '#e6edf3', fontSize: 12, marginBottom: 8, fontWeight: 700 }}>
                        {idx + 1}. {q.prompt}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {q.options.map((option, optIdx) => {
                          const selected = quizAnswers[q.id] === optIdx
                          const showCorrect = quizSubmitted && optIdx === q.correct
                          const showWrong = quizSubmitted && selected && optIdx !== q.correct
                          return (
                            <button
                              key={optIdx}
                              onClick={() => {
                                if (!quizSubmitted) {
                                  setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                                }
                              }}
                              style={{
                                padding: '10px 12px',
                                textAlign: 'left',
                                fontSize: 11,
                                border: selected ? '1px solid #58a6ff' : '1px solid #30363d',
                                background:
                                  showCorrect ? '#0a2d1a' : showWrong ? '#2d0a0a' : selected ? '#0a1c35' : '#0f1722',
                                color: showCorrect ? '#3fb950' : showWrong ? '#f85149' : '#e6edf3',
                                borderRadius: 6,
                                cursor: quizSubmitted ? 'default' : 'pointer',
                              }}
                            >
                              {showCorrect ? '✓ ' : showWrong ? '✗ ' : '◯ '}
                              {option}
                            </button>
                          )
                        })}
                      </div>
                      {quizSubmitted && (
                        <div style={{ color: '#8b949e', fontSize: 10, marginTop: 8, fontStyle: 'italic' }}>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={handleQuizSubmit}
                    disabled={quizSubmitted || challenge.quiz.some((q) => quizAnswers[q.id] === undefined)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: 12,
                      marginTop: 12,
                      opacity: quizSubmitted || challenge.quiz.some((q) => quizAnswers[q.id] === undefined) ? 0.5 : 1,
                    }}
                  >
                    {quizSubmitted ? '✓ Quiz Complete' : 'Submit Quiz'}
                  </button>
                  {quizSubmitted ? (
                    <div style={{ color: '#3fb950', textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: 11, marginTop: 12, fontWeight: 700 }}>
                      Challenge Complete! 🎉
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
