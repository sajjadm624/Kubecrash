import { create } from 'zustand'

const useGameStore = create((set, get) => ({
  screen: 'levelSelect',   // 'levelSelect' | 'game' | 'complete' | 'gameover' | 'leaderboard' | 'learning'
  selectedLevel: null,
  sessionId: null,
  levelMeta: null,
  winTime: null,
  commandsRun: 0,
  playerName: '',

  setScreen: (screen) => set({ screen }),
  setSelectedLevel: (level) => set({ selectedLevel: level }),
  setSession: (sessionId, levelMeta) => set({ sessionId, levelMeta }),
  setWin: (winTime, commandsRun) => set({ screen: 'complete', winTime, commandsRun }),
  setGameOver: () => set({ screen: 'gameover' }),
  setPlayerName: (name) => set({ playerName: name }),
  reset: () => set({ screen: 'levelSelect', sessionId: null, levelMeta: null, winTime: null, commandsRun: 0 }),
}))

export default useGameStore
