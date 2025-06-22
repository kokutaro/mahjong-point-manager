'use client'

interface GameState {
  gameId: string
  players: any[]
  currentRound: number
  currentOya: number
  honba: number
  kyotaku: number
  gamePhase: 'waiting' | 'playing' | 'finished'
}

interface GameInfoProps {
  gameState: GameState
  isConnected: boolean
  gameType: 'TONPUU' | 'HANCHAN'
}

export default function GameInfo({ gameState, isConnected, gameType }: GameInfoProps) {
  const getRoundName = (round: number) => {
    if (round <= 4) {
      const roundNames = ['東一局', '東二局', '東三局', '東四局']
      return roundNames[round - 1] || `東${round}局`
    } else if (round <= 8) {
      const roundNames = ['南一局', '南二局', '南三局', '南四局']
      return roundNames[round - 5] || `南${round - 4}局`
    } else if (round <= 12) {
      const roundNames = ['西一局', '西二局', '西三局', '西四局']
      return roundNames[round - 9] || `西${round - 8}局`
    } else {
      const roundNames = ['北一局', '北二局', '北三局', '北四局']
      return roundNames[round - 13] || `北${round - 12}局`
    }
  }

  const getPositionName = (position: number) => {
    const positions = ['東', '南', '西', '北']
    return positions[position] || '?'
  }

  const getDealerName = () => {
    const dealer = gameState.players.find(p => p.position === gameState.currentOya)
    return dealer ? dealer.name : '不明'
  }

  const getGamePhaseText = (phase: string) => {
    switch (phase) {
      case 'waiting': return '待機中'
      case 'playing': return '対局中'
      case 'finished': return '終了'
      default: return phase
    }
  }

  const getGamePhaseColor = (phase: string) => {
    switch (phase) {
      case 'waiting': return 'bg-yellow-100 text-yellow-800'
      case 'playing': return 'bg-green-100 text-green-800'
      case 'finished': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const maxRound = gameType === 'TONPUU' ? 4 : 8

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
            {getRoundName(gameState.currentRound)}
            {gameState.honba > 0 && (
              <span className="text-base sm:text-lg font-medium text-orange-600 ml-2">
                {gameState.honba}本場
              </span>
            )}
          </h1>
          <div className="flex items-center flex-wrap gap-2 sm:space-x-4 sm:gap-0 text-xs sm:text-sm text-gray-600">
            <span>
              親: {getPositionName(gameState.currentOya)} {getDealerName()}
            </span>
            {gameState.kyotaku > 0 && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                供託 {gameState.kyotaku}本
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-3 mt-3 sm:mt-0 w-full sm:w-auto justify-end">
          {/* 接続状態 */}
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm font-medium ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-1 sm:mr-2 ${
              isConnected ? 'bg-green-400' : 'bg-red-400'
            }`} />
            {isConnected ? '接続中' : '切断'}
          </div>
          
          {/* ゲーム状態 */}
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm font-medium ${
            getGamePhaseColor(gameState.gamePhase)
          }`}>
            {getGamePhaseText(gameState.gamePhase)}
          </div>
        </div>
      </div>

      {/* 進行状況バー */}
      <div className="mb-3 sm:mb-4">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>進行状況</span>
          <span>{gameState.currentRound}/{maxRound}局</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min((gameState.currentRound / maxRound) * 100, 100)}%` }}
        />
      </div>
      </div>

      {/* 詳細情報 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
        <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
          <div className="text-gray-600 text-xs">現在局</div>
          <div className="font-semibold text-gray-800 text-xs sm:text-sm">
            {getRoundName(gameState.currentRound)}
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
          <div className="text-gray-600 text-xs">親</div>
          <div className="font-semibold text-gray-800">
            {getPositionName(gameState.currentOya)}
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
          <div className="text-gray-600 text-xs">本場</div>
          <div className="font-semibold text-gray-800">
            {gameState.honba}本場
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
          <div className="text-gray-600 text-xs">供託</div>
          <div className="font-semibold text-gray-800">
            {gameState.kyotaku}本
          </div>
        </div>
      </div>

      {/* リーチ中のプレイヤー表示 */}
      {gameState.players.some(p => p.isReach) && (
        <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-xs sm:text-sm font-medium text-red-800 mb-1">
            リーチ宣言中
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {gameState.players
              .filter(p => p.isReach)
              .map(player => (
                <span 
                  key={player.playerId}
                  className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs sm:text-sm"
                >
                  {getPositionName(player.position)} {player.name}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* ゲーム終了条件の表示 */}
      {gameState.gamePhase === 'playing' && (
        <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs text-blue-700">
            <div className="flex justify-between">
              <span>オーラス条件</span>
              <span>
                {gameState.currentRound >= maxRound ? 'オーラス圏内' : '通常進行'}
              </span>
            </div>
            {gameState.players.some(p => p.points <= 0) && (
              <div className="text-red-600 mt-1">
                ⚠ トビ発生中
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}