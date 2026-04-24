import useGameStore from './store/gameStore'
import LevelSelect from './components/LevelSelect'
import Terminal from './components/Terminal'
import LevelComplete from './components/LevelComplete'
import GameOver from './components/GameOver'
import Leaderboard from './components/Leaderboard'
import LearningJourney from './components/LearningJourney'

export default function App() {
  const { screen, sessionId, levelMeta } = useGameStore()

  if (screen === 'levelSelect') return <LevelSelect />
  if (screen === 'game' && sessionId) return <Terminal sessionId={sessionId} levelMeta={levelMeta} />
  if (screen === 'complete') return <LevelComplete />
  if (screen === 'gameover') return <GameOver />
  if (screen === 'leaderboard') return <Leaderboard />
  if (screen === 'learning') return <LearningJourney />

  return <LevelSelect />
}
