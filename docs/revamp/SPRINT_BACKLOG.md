# Revamp Sprint Backlog

## Epic A: Incident Content Expansion

### Story A1: Expand starter incidents
Acceptance criteria:
1. Add 5 new starter incidents (total 10).
2. Each incident includes briefing, checkpoint flow, and final recap quiz.
3. Validation returns actionable feedback on failed attempts.

### Story A2: Expand foundation curriculum
Acceptance criteria:
1. Add 12 new foundation labs.
2. Coverage spans networking, storage, RBAC, scheduling, and troubleshooting.
3. Each lab includes at least 3 checkpoints and 3 quiz items.

## Epic B: Mastery Scoring and Progression

### Story B1: Score breakdown UI
Acceptance criteria:
1. Show score components: correctness, speed, quiz, retrospective quality.
2. Persist score breakdown with lesson completion.
3. Replays update skill confidence but do not duplicate first-time points.

### Story B2: Unlock gate engine
Acceptance criteria:
1. Implement unlock checks for Advanced, Role Path, and Capstone.
2. Expose clear lock reason to learner when gated.
3. Add tests for pass/fail gate logic.

## Epic C: Portfolio Artifact System

### Story C1: Retro artifact standardization
Acceptance criteria:
1. Save structured answers, action items, and timestamp.
2. Attach lesson metadata and score summary.
3. Make artifacts queryable by lesson and track.

### Story C2: Runbook snippet generation
Acceptance criteria:
1. Generate "first checks" and "resolution pattern" snippets per completed lesson.
2. Save snippets into learner artifact history.
3. Allow copy/export from UI.

## Epic D: Role Paths and Capstones

### Story D1: Role path learning map
Acceptance criteria:
1. Add SRE, Platform, Security, and DevOps paths.
2. Each path has 4 missions with progression order.
3. Path completion updates mastery profile.

### Story D2: Capstone rubric system
Acceptance criteria:
1. Add rubric scoring for 5 capstones.
2. Require pass threshold before "capstone complete" is awarded.
3. Store rubric result in progress history.

## Implementation Priority
1. A1
2. A2
3. B1
4. B2
5. C1
6. C2
7. D1
8. D2
