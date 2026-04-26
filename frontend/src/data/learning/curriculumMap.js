export const LEARNING_TRACKS = [
  {
    id: 'beginner',
    label: 'Beginner Track',
    description: 'Core kubectl orientation and Kubernetes object fundamentals.',
    prerequisites: [],
  },
  {
    id: 'foundation',
    label: 'Foundation Track',
    description: 'Day-one operations for workloads, services, RBAC, and storage.',
    prerequisites: ['beginner'],
  },
  {
    id: 'intermediate',
    label: 'Intermediate Track',
    description: 'Exam-grade troubleshooting, networking, and control-plane fluency.',
    prerequisites: ['foundation'],
  },
]

export const TRACK_ORDER = LEARNING_TRACKS.map((track) => track.id)

function trackCompleted(trackId, lessons, completedLessons) {
  const inTrack = lessons.filter((lesson) => lesson.track === trackId)
  if (inTrack.length === 0) return false
  return inTrack.every((lesson) => Boolean(completedLessons[String(lesson.id)]))
}

export function isLessonAccessible(lesson, lessons, completedLessons) {
  if (!lesson || !Array.isArray(lessons)) return false

  const lessonPrereqs = Array.isArray(lesson.prerequisites) ? lesson.prerequisites : []
  if (lessonPrereqs.some((lessonId) => !completedLessons[String(lessonId)])) {
    return false
  }

  const track = LEARNING_TRACKS.find((entry) => entry.id === lesson.track)
  if (!track) return true

  return track.prerequisites.every((trackId) => trackCompleted(trackId, lessons, completedLessons))
}

export function buildTrackSummary(lessons, completedLessons) {
  return LEARNING_TRACKS.map((track) => {
    const inTrack = lessons.filter((lesson) => lesson.track === track.id)
    const completed = inTrack.filter((lesson) => Boolean(completedLessons[String(lesson.id)])).length
    const unlocked = track.prerequisites.every((trackId) => trackCompleted(trackId, lessons, completedLessons))

    return {
      ...track,
      totalLessons: inTrack.length,
      completedLessons: completed,
      unlocked,
    }
  })
}
