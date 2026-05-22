# KubeCrash

> **KubeCrash trains engineers to operate Kubernetes under pressure.**
> Run real `kubectl` commands. Diagnose realistic failures. Build production-grade instincts.

![Tech stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%20%2B%20xterm.js-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-green)
![Node](https://img.shields.io/badge/node-18%2B-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What is KubeCrash?

KubeCrash is a **Kubernetes incident training platform** designed to turn learners into confident operators.

It combines two modes in one experience:

- **Incident Game** — pressure-tested troubleshooting with real `kubectl` command flow
- **CKA Learning Journey** — structured domain-by-domain progression across the CKA blueprint

No local cluster setup required. Everything runs in the browser, with simulation logic tuned for practical decision-making.

---

## Quick start

Run KubeCrash locally in minutes.

### 1. Backend (FastAPI + WebSocket)

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Incident Game — Command loop

1. Pick an incident from the level select screen
2. Read the briefing like an on-call handoff
3. Run `kubectl` commands to isolate root cause
4. Apply the fix before the timer expires
5. Submit and compare results on the leaderboard

### Levels

| # | Title | Concept |
|---|-------|---------|
| 1 | The Crash at Dawn | CrashLoopBackOff, env vars |
| 2 | The Invisible Service | Label selectors, endpoints |
| 3 | The OOM Reaper | OOMKilled, resource limits |
| 4 | The Ghost Image | ImagePullBackOff, rollback |
| 5 | The Dead Node | Node lifecycle, drain |

---

## CKA Learning Journey

Structured CKA preparation built for operational fluency, not passive reading.

### Features

- 15 structured lessons across **Beginner → Foundation → Intermediate** tracks
- Interactive shell with **simulated `kubectl` output** for each command path
- Per-checkpoint **why-this-command** explanations for fast mental model building
- **Command syntax coach** with live verb/resource/flags breakdown
- **Lesson recap quiz** to lock in understanding before moving forward
- Timed **mini-mocks** and a full **120-minute weighted CKA mock**
- **Adaptive hint modes**: `beginner`, `standard`, `exam`, `adaptive`
- **Realtime architecture diagram** that updates per lesson domain
- Persistent score, streak, badges, and certificate state via localStorage
- Official Kubernetes docs linked directly from lessons
- Built-in 30-day study roadmap

### CKA blueprint coverage

| Domain | Weight |
|--------|--------|
| Troubleshooting | 30% |
| Cluster Architecture, Installation and Configuration | 25% |
| Services and Networking | 20% |
| Workloads and Scheduling | 15% |
| Storage | 10% |

### Lesson tracks

| Track | Lessons |
|-------|---------|
| Beginner | Lesson 0: Kubernetes from Zero |
| Foundation | Lessons 1–6: Env vars, Services, Resources, RBAC, PVCs, Ingress |
| Intermediate | Lessons 7–14: Taints, Rollouts, ConfigMaps, StatefulSets, DNS, Upgrades, TLS |

---

## KubeCrash Mastery Roadmap

KubeCrash began with focused incident scenarios to make onboarding approachable.
KubeCrash now expands into a full mastery platform with measurable skill growth, portfolio evidence, and role-based pathways.

### North-star goals

- Train learners for real production incidents, not trivia recall
- Build job-ready confidence across platform, security, operations, and delivery
- Produce portfolio artifacts that prove ability (retrospectives, runbooks, capstones)
- Measure mastery by demonstrated performance over time

### Product evolution map

| Stage | Experience | Scope |
|------|------------|-------|
| 1. Onboarding | Incident game intro | 5 fast starter incidents |
| 2. Core Training | CKA learning journey | 15 lessons + mocks |
| 3. Advanced Tracks | Incident case-study academy | 4 tracks x 4 lessons |
| 4. Mastery Platform | Role paths + capstones + skill graph | 60+ labs + 5 projects |

### Curriculum target

| Layer | Target count | Outcome |
|------|--------------|---------|
| Starter incidents | 10 | Build initial confidence in command fluency |
| Foundation labs | 30 | Strong CKA fundamentals across all blueprint domains |
| Advanced incidents | 24 | Multi-signal diagnosis under realistic constraints |
| Role-path missions | 16 | SRE, Platform, Security, DevOps specialization |
| Capstone projects | 5 | Portfolio-grade end-to-end Kubernetes projects |

### Role paths (new)

- SRE Path: observability, SLOs, alerting, incident command, postmortems
- Platform Engineer Path: cluster operations, cost controls, multi-tenant architecture
- Security Engineer Path: RBAC, policy, secrets, supply-chain and audit controls
- DevOps/GitOps Path: release strategy, progressive delivery, rollback governance

### Mastery model and progression rules

Learners unlock new content by proof of capability, not just completion.

#### Skill graph nodes

- Command fluency
- Debug workflow
- Workload reliability
- Networking diagnostics
- Storage reliability
- Security hardening
- Observability reasoning
- Delivery safety
- Cluster operations

#### Unlock logic (default)

1. Foundation Track unlocks immediately
2. Advanced Track requires:
    - 70%+ completion in Foundation
    - Minimum 60% average quiz score in completed lessons
3. Role Path requires:
    - One completed Advanced Track
    - At least 3 saved retrospectives
4. Capstone requires:
    - Two completed Role Paths
    - Mastery score >= 75 in at least 5 skill nodes

### Scoring model

Total score combines speed, correctness, and learning behavior.

$$
Mastery = 0.35C + 0.20S + 0.20R + 0.15Q + 0.10L
$$

Where:

- $C$ = command correctness score
- $S$ = scenario completion reliability score
- $R$ = retrospective quality/completion score
- $Q$ = quiz understanding score
- $L$ = long-term retention score (repeat challenge delta)

### Portfolio outputs (must-have)

Every advanced lesson and capstone should produce artifacts:

- Incident brief + timeline
- Root cause analysis
- Retrospective answers
- Action items
- Suggested runbook snippets
- Final score + elapsed time

### 12-week release plan

| Week | Delivery focus | Exit criteria |
|------|----------------|---------------|
| 1 | Expand starter incidents from 5 to 8 | New incidents playable end-to-end |
| 2 | Add 2 more starter incidents (10 total) | Starter onboarding complete |
| 3 | Add 8 foundation labs (phase A) | Lessons + checks + recap quizzes live |
| 4 | Add 8 foundation labs (phase B) | 16 new labs total in roadmap branch |
| 5 | Add 8 foundation labs (phase C) | 24 new labs total |
| 6 | Add 6 foundation labs + polish | 30 foundation labs complete |
| 7 | Build role path framework + progress rules | Path UI + unlock gating functional |
| 8 | Ship SRE + Platform paths | 8 role missions live |
| 9 | Ship Security + DevOps paths | 16 role missions complete |
| 10 | Implement skill graph + mastery scoring | Node scores visible in profile |
| 11 | Build first 3 capstones | Project rubrics + artifact export |
| 12 | Build final 2 capstones + launch prep | 5 capstones + launch readiness |

### Success metrics

- 7-day retention > 35%
- Lesson-to-lesson completion > 60%
- Advanced track completion > 30% of active learners
- Average mastery score gain of +20 points in 30 days
- At least 1 portfolio artifact exported per active learner each week

### Definition of done for KubeCrash

- 60+ labs live with stable validation
- 4 role paths with progression gates
- 5 capstone projects fully rubric-scored
- Skill graph and mastery score visible in UI
- Exportable learner portfolio artifacts

### Revamp execution docs

- [Execution plan](docs/revamp/EXECUTION_PLAN.md)
- [Sprint backlog](docs/revamp/SPRINT_BACKLOG.md)
- [Lab spec template](docs/revamp/LAB_SPEC_TEMPLATE.md)
- [Capstone rubric](docs/revamp/CAPSTONE_RUBRIC.md)

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Zustand, xterm.js |
| Backend | FastAPI, Uvicorn, WebSockets, Pydantic |
| Simulation | Custom kubectl parser + per-level state machines |
| Persistence | localStorage (client-side progress) |

---

## Project structure

```
KubeCrash/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket handler
│   ├── engine/              # Kubectl parser + scenario engine
│   ├── scenarios/           # Per-level incident definitions
│   └── routers/             # HTTP endpoints (leaderboard, session)
└── frontend/
    └── src/
        ├── components/      # LearningJourney, Terminal, LevelSelect
        ├── hooks/           # useTerminal (xterm lifecycle)
        ├── store/           # Zustand game state
        └── utils/           # kubectlParser (semantic matching)
```

---

## Contributing

Pull requests are welcome. For major changes, open an issue first so we can align scope and design.

---

## License

MIT
