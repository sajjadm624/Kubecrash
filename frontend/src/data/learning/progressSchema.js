export const LEARNING_PROGRESS_SCHEMA_VERSION = 3

const STORAGE_KEY_BASE = 'kubecrash-learning-progress'
const STORAGE_KEY_CURRENT = `${STORAGE_KEY_BASE}-v${LEARNING_PROGRESS_SCHEMA_VERSION}`
const LEGACY_STORAGE_KEYS = [
  `${STORAGE_KEY_BASE}-v2`,
  'kubecrash-learning-progress-v1',
  STORAGE_KEY_BASE,
]

export const DEFAULT_LEARNING_PROGRESS = {
  schemaVersion: LEARNING_PROGRESS_SCHEMA_VERSION,
  completedLessons: {},
  completedMocks: {},
  completedAdvanced: {},   // { [lessonId]: { elapsed, quizScore, completedAt } }
  retroNotes: {},          // { [lessonId]: { answers, actionItems, savedAt } }
  streak: 0,
  totalPoints: 0,
  certifiedAt: null,
  preferredLabMode: 'simulation',
  commandMastery: {},
}

function normalizeProgress(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LEARNING_PROGRESS }

  return {
    schemaVersion: LEARNING_PROGRESS_SCHEMA_VERSION,
    completedLessons:
      raw.completedLessons && typeof raw.completedLessons === 'object'
        ? raw.completedLessons
        : {},
    completedMocks:
      raw.completedMocks && typeof raw.completedMocks === 'object'
        ? raw.completedMocks
        : {},
    completedAdvanced:
      raw.completedAdvanced && typeof raw.completedAdvanced === 'object'
        ? raw.completedAdvanced
        : {},
    retroNotes:
      raw.retroNotes && typeof raw.retroNotes === 'object'
        ? raw.retroNotes
        : {},
    streak: Number.isFinite(raw.streak) ? raw.streak : 0,
    totalPoints: Number.isFinite(raw.totalPoints) ? raw.totalPoints : 0,
    certifiedAt: typeof raw.certifiedAt === 'string' ? raw.certifiedAt : null,
    preferredLabMode:
      raw.preferredLabMode === 'realCluster' ? 'realCluster' : 'simulation',
    commandMastery:
      raw.commandMastery && typeof raw.commandMastery === 'object'
        ? raw.commandMastery
        : {},
  }
}

function parseStoredProgress(storageKey) {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function loadLearningProgress() {
  const current = parseStoredProgress(STORAGE_KEY_CURRENT)
  if (current) {
    const normalized = normalizeProgress(current)
    saveLearningProgress(normalized)
    return normalized
  }

  for (const key of LEGACY_STORAGE_KEYS) {
    const legacy = parseStoredProgress(key)
    if (!legacy) continue

    const normalized = normalizeProgress(legacy)
    saveLearningProgress(normalized)
    return normalized
  }

  return { ...DEFAULT_LEARNING_PROGRESS }
}

export function saveLearningProgress(progress) {
  const normalized = normalizeProgress(progress)
  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(normalized))
  return normalized
}
