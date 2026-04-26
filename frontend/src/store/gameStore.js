import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const GAME_STORE_SCHEMA_VERSION = 1

const initialState = {
  screen: 'levelSelect',   // 'levelSelect' | 'game' | 'complete' | 'gameover' | 'leaderboard' | 'learning'
  selectedLevel: null,
  sessionId: null,
  levelMeta: null,
  winTime: null,
  commandsRun: 0,
  playerName: '',
}

const useGameStore = create(persist((set, get) => ({
  ...initialState,
  setScreen: (screen) => set({ screen }),
  setSelectedLevel: (level) => set({ selectedLevel: level }),
  setSession: (sessionId, levelMeta) => set({ sessionId, levelMeta }),
  setWin: (winTime, commandsRun) => set({ screen: 'complete', winTime, commandsRun }),
  setGameOver: () => set({ screen: 'gameover' }),
  setPlayerName: (name) => set({ playerName: name }),
  reset: () => set({ ...initialState, playerName: get().playerName }),
}), {
  name: 'kubecrash-game-store',
  version: GAME_STORE_SCHEMA_VERSION,
  storage: createJSONStorage(() => localStorage),
  migrate: (persistedState) => ({
    ...initialState,
    ...(persistedState && typeof persistedState === 'object' ? persistedState : {}),
  }),
}))

export default useGameStore
