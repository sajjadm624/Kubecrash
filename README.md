# KubeCrash

> **Learn Kubernetes by surviving real production incidents.**
> Type real `kubectl` commands. Fix a simulated broken cluster. Beat the clock.

![Tech stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%20%2B%20xterm.js-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-green)
![Node](https://img.shields.io/badge/node-18%2B-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What is KubeCrash?

KubeCrash is an **interactive Kubernetes learning simulator** with two modes:

- **Incident Game** — survive timed production incidents using real `kubectl` syntax
- **CKA Learning Journey** — structured lesson-wise prep covering all CKA blueprint domains

No cluster needed. Everything runs in your browser.

---

## Quick start

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

## Incident Game — How to play

1. Pick a level from the level select screen
2. Read the incident briefing
3. Type `kubectl` commands to diagnose and fix the cluster
4. Resolve before the timer hits zero
5. Submit your score to the leaderboard

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

A complete interactive CKA preparation mode built into the same app.

### Features

- 15 structured lessons across **Beginner → Foundation → Intermediate** tracks
- Interactive practice shell with **simulated `kubectl` output** per command
- Per-checkpoint **"why this command"** teaching explanations
- **Command syntax coach** — live breakdown of verb/resource/flags per checkpoint
- **Lesson-end recap quiz** — knowledge lock-in after each session
- Timed **mini-mocks** and a full **120-minute weighted CKA mock exam**
- **Adaptive hint modes** — `beginner`, `standard`, `exam`, `adaptive`
- **Realtime architecture diagram** that changes per lesson domain
- Persistent score, streak, badges, and certificate state (localStorage)
- Official Kubernetes documentation links per lesson
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

Pull requests are welcome. Open an issue first for major changes.

---

## License

MIT
