import { prisma } from '@/lib/prisma'
import { ScoreCalculationResult } from '@/lib/score'

// 型定義
interface GameSettings {
  initialPoints: number
  basePoints?: number
  uma: number[] | string | unknown
  hasTobi?: boolean
  gameType?: string
}

interface GameWithSettings {
  id: string
  currentRound: number
  currentOya: number
  honba: number
  kyotaku: number
  status: string
  settings?: GameSettings | null
}

interface ParticipantWithPlayer {
  id: string
  playerId: string
  position: number
  currentPoints: number
  isReach: boolean
  finalRank?: number | null
  settlement?: number | null
  player?: {
    name: string
  }
}

interface SettlementResult {
  playerId: string
  finalPoints: number
  rank: number
  pointDiff: number
  roundedDiff: number
  uma: number
  settlement: number
}

export interface PointTransaction {
  id: string
  gameId: string
  fromPlayerId?: string
  toPlayerId: string
  amount: number
  type: 'WIN' | 'LOSE' | 'RIICHI' | 'HONBA' | 'KYOTAKU'
  description: string
  timestamp: Date
}

export interface PlayerPointState {
  playerId: string
  currentPoints: number
  isReach: boolean
  reachRound?: number
}

export class PointManager {
  private gameId: string

  constructor(gameId: string) {
    this.gameId = gameId
  }

  /**
   * アガリ時の点数分配
   */
  async distributeWinPoints(
    winnerId: string,
    scoreResult: ScoreCalculationResult,
    isTsumo: boolean,
    loserId?: string
  ): Promise<{ gameEnded: boolean; reason?: string }> {
    const participants = await this.getParticipants()
    const winner = participants.find(p => p.playerId === winnerId)
    
    if (!winner) {
      throw new Error('Winner not found')
    }

    const game = await prisma.game.findUnique({ 
      where: { id: this.gameId },
      select: { currentOya: true, kyotaku: true }
    })
    
    const isOya = winner.position === (game?.currentOya || 0)

    // scoreResult.totalScoreには既に供託分が含まれているため、そのまま使用
    if (isTsumo) {
      await this.handleTsumoDistribution(winnerId, scoreResult, isOya)
    } else {
      await this.handleRonDistribution(winnerId, loserId!, scoreResult)
    }

    // トランザクション内でリーチ状態解除と供託クリアを実行
    await prisma.$transaction(async (tx) => {
      // 全プレイヤーのリーチ状態を解除
      await tx.gameParticipant.updateMany({
        where: {
          gameId: this.gameId,
          isReach: true
        },
        data: {
          isReach: false,
          reachRound: null
        }
      })

      // 供託をクリア（点数分配は既に上で行った）
      if (game?.kyotaku && game.kyotaku > 0) {
        await tx.game.update({
          where: { id: this.gameId },
          data: { kyotaku: 0 }
        })
      }
    })

    // 親ローテーション処理とゲーム終了判定
    const rotateResult = await this.rotateDealer(winnerId)
    return rotateResult
  }

  /**
   * ツモ時の点数分配
   */
  private async handleTsumoDistribution(
    winnerId: string,
    scoreResult: ScoreCalculationResult,
    isOya: boolean
  ): Promise<void> {
    const participants = await this.getParticipants()
    
    // 現在の親の位置を取得
    const game = await prisma.game.findUnique({
      where: { id: this.gameId },
      select: { currentOya: true }
    })
    
    const currentOya = game?.currentOya || 0
    
    for (const participant of participants) {
      if (participant.playerId === winnerId) {
        // 勝者の点数加算
        await this.updatePoints(
          participant.playerId,
          participant.currentPoints + scoreResult.totalScore,
          'WIN',
          `ツモ和了 ${scoreResult.totalScore}点`
        )
      } else {
        // 敗者の点数減算
        let payment: number
        const isThisPlayerOya = participant.position === currentOya
        
        if (isOya) {
          // 親ツモ: 子全員が同額
          payment = scoreResult.payments.fromKo || 0
        } else {
          // 子ツモ: 親と子で異なる
          payment = isThisPlayerOya ? 
            (scoreResult.payments.fromOya || 0) : 
            (scoreResult.payments.fromKo || 0)
        }
        
        console.log(`Player position ${participant.position}, currentOya: ${currentOya}, isThisPlayerOya: ${isThisPlayerOya}, payment: ${payment}`)
        
        await this.updatePoints(
          participant.playerId,
          participant.currentPoints - payment,
          'LOSE',
          `ツモ支払い -${payment}点`
        )
      }
    }
  }

  /**
   * ロン時の点数分配
   */
  private async handleRonDistribution(
    winnerId: string,
    loserId: string,
    scoreResult: ScoreCalculationResult
  ): Promise<void> {
    // 勝者の点数加算
    const winner = await prisma.gameParticipant.findFirst({
      where: { gameId: this.gameId, playerId: winnerId }
    })
    
    if (winner) {
      await this.updatePoints(
        winnerId,
        winner.currentPoints + scoreResult.totalScore,
        'WIN',
        `ロン和了 ${scoreResult.totalScore}点`
      )
    }

    // 敗者の点数減算
    const loser = await prisma.gameParticipant.findFirst({
      where: { gameId: this.gameId, playerId: loserId }
    })
    
    if (loser) {
      const paymentAmount = scoreResult.payments.fromLoser || scoreResult.totalScore
      await this.updatePoints(
        loserId,
        loser.currentPoints - paymentAmount,
        'LOSE',
        `ロン支払い -${paymentAmount}点`
      )
    }
  }

  /**
   * リーチ宣言処理
   */
  async declareReach(playerId: string): Promise<void> {
    const participant = await prisma.gameParticipant.findFirst({
      where: { gameId: this.gameId, playerId }
    })

    if (!participant) {
      throw new Error('Player not found')
    }

    if (participant.currentPoints < 1000) {
      throw new Error('リーチするには1000点以上必要です')
    }

    if (participant.isReach) {
      throw new Error('既にリーチ宣言済みです')
    }

    // リーチ宣言
    await prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        isReach: true,
        currentPoints: participant.currentPoints - 1000
      }
    })

    // 供託を増加
    await prisma.game.update({
      where: { id: this.gameId },
      data: {
        kyotaku: { increment: 1 }
      }
    })

    // 取引記録
    await this.recordTransaction({
      fromPlayerId: playerId,
      toPlayerId: 'KYOTAKU',
      amount: 1000,
      type: 'RIICHI',
      description: 'リーチ宣言'
    })
  }

  /**
   * 流局時の処理
   */
  async handleRyukyoku(reason: string, tenpaiPlayers: string[] = []): Promise<{ gameEnded: boolean; reason?: string }> {
    const game = await prisma.game.findUnique({
      where: { id: this.gameId },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: 'asc' }
        }
      }
    })

    if (!game) {
      throw new Error('Game not found')
    }

    // 現在の親プレイヤーを取得
    const currentOya = game.participants.find(p => p.position === game.currentOya)
    if (!currentOya) {
      throw new Error('親プレイヤーが見つかりません')
    }

    // 親がテンパイかどうか
    const isOyaTenpai = tenpaiPlayers.includes(currentOya.playerId)

    // 更新後の状態計算
    const newHonba = game.honba + 1
    const newOya = isOyaTenpai ? game.currentOya : (game.currentOya + 1) % 4
    const newRound = isOyaTenpai ? game.currentRound : game.currentRound + 1

    await prisma.$transaction(async (tx) => {

      // テンパイ料の処理
      if (tenpaiPlayers.length > 0 && tenpaiPlayers.length < 4) {
        const tenpaiCount = tenpaiPlayers.length
        const notienpaiCount = 4 - tenpaiCount
        const pointPerTenpai = Math.floor(3000 / tenpaiCount)
        const pointPerNoten = Math.floor(3000 / notienpaiCount)

        for (const participant of game.participants) {
          if (tenpaiPlayers.includes(participant.playerId)) {
            // テンパイプレイヤー：受け取り
            await tx.gameParticipant.update({
              where: { id: participant.id },
              data: {
                currentPoints: participant.currentPoints + pointPerTenpai
              }
            })
          } else {
            // ノーテンプレイヤー：支払い
            await tx.gameParticipant.update({
              where: { id: participant.id },
              data: {
                currentPoints: participant.currentPoints - pointPerNoten
              }
            })
          }
        }
      }

      // リーチ宣言をリセット（供託はそのまま持ち越し）
      await tx.gameParticipant.updateMany({
        where: {
          gameId: this.gameId,
          isReach: true
        },
        data: {
          isReach: false,
          reachRound: null
        }
      })

      // ゲーム状態更新（本場増加と親移動判定）
      await tx.game.update({
        where: { id: this.gameId },
        data: {
          honba: newHonba,
          currentOya: newOya,
          currentRound: newRound,
          updatedAt: new Date()
        }
      })

      // イベント記録
      await tx.gameEvent.create({
        data: {
          gameId: this.gameId,
          eventType: 'RYUKYOKU',
          eventData: {
            reason,
            tenpaiPlayers,
            newHonba,
            kyotaku: game.kyotaku,
            oyaContinued: isOyaTenpai
          },
          round: game.currentRound,
          honba: game.honba
        }
      })
    })

    // ゲーム終了判定
    const endResult = await this.checkGameEnd()
    if (endResult.shouldEnd) {
      await this.finishGame(endResult.reason || '規定局数終了')
      return { gameEnded: true, reason: endResult.reason }
    }

    return { gameEnded: false }
  }

  /**
   * 親ローテーション処理
   */
  async rotateDealer(winnerId?: string): Promise<{ gameEnded: boolean; reason?: string }> {
    const game = await prisma.game.findUnique({
      where: { id: this.gameId }
    })

    if (!game) {
      throw new Error('Game not found')
    }

    const winner = winnerId ? await prisma.gameParticipant.findFirst({
      where: { gameId: this.gameId, playerId: winnerId }
    }) : null

    const isOyaWin = winner?.position === game.currentOya

    let newOya = game.currentOya
    let newHonba = game.honba
    let newRound = game.currentRound

    if (winnerId && isOyaWin) {
      // 親の和了：連荘
      newHonba += 1
      // 親の和了なので局は進まない
      console.log(`親連荘: 親=${game.currentOya}継続, 本場=${game.honba} → ${newHonba}, 局=${game.currentRound}`)
    } else if (winnerId && !isOyaWin) {
      // 子の和了：親交代
      newOya = (game.currentOya + 1) % 4
      newHonba = 0
      newRound += 1
      console.log(`子和了: 旧親=${game.currentOya} → 新親=${newOya}, 旧局=${game.currentRound} → 新局=${newRound}, 本場リセット`)
    } else {
      // 流局：親交代
      newOya = (game.currentOya + 1) % 4
      newHonba = 0
      newRound += 1
      console.log(`流局: 旧親=${game.currentOya} → 新親=${newOya}, 旧局=${game.currentRound} → 新局=${newRound}, 本場リセット`)
    }

    await prisma.game.update({
      where: { id: this.gameId },
      data: {
        currentOya: newOya,
        honba: newHonba,
        currentRound: newRound
      }
    })

    // ゲーム終了判定
    const endResult = await this.checkGameEnd()
    if (endResult.shouldEnd) {
      await this.finishGame(endResult.reason || '規定局数終了')
      return { gameEnded: true, reason: endResult.reason }
    }

    return { gameEnded: false }
  }

  /**
   * ゲーム終了処理
   */
  async finishGame(reason: string): Promise<void> {
    console.log('🏁 finishGame called with reason:', reason, 'gameId:', this.gameId)
    
    await prisma.game.update({
      where: { id: this.gameId },
      data: {
        status: 'FINISHED',
        endedAt: new Date()
      }
    })

    console.log('🏁 Game status updated to FINISHED, calling calculateFinalResults')
    
    // 最終結果計算
    await this.calculateFinalResults()

    console.log('🏁 calculateFinalResults completed, updating session statistics')
    
    // セッション統計更新
    await this.updateSessionStatistics()

    console.log('🏁 Session statistics updated, creating game end event')

    // イベント記録
    await prisma.gameEvent.create({
      data: {
        gameId: this.gameId,
        eventType: 'GAME_END',
        eventData: { 
          reason,
          finalResults: true
        },
        round: 0,
        honba: 0
      }
    })
    
    console.log('🏁 Game end event created')
  }

  /**
   * 最終結果計算（ウマ・オカ含む）
   */
  async calculateFinalResults(): Promise<void> {
    console.log('🏁 calculateFinalResults called for gameId:', this.gameId)
    const participants = await this.getParticipants()
    const game = await prisma.game.findUnique({
      where: { id: this.gameId },
      include: { settings: true }
    })

    console.log('🏁 Game and participants:', { 
      game: game ? { 
        id: game.id, 
        settings: game.settings ? {
          initialPoints: game.settings.initialPoints,
          basePoints: (game.settings as GameSettings)?.basePoints || 30000,
          uma: game.settings.uma
        } : null
      } : null,
      participants: participants.length 
    })

    if (!game) {
      console.log('🏁 No game found, returning')
      return
    }

    if (!game.settings) {
      console.log('🏁 No settings found, creating default settings')
      // デフォルト設定で処理を続行
      const defaultSettings = {
        initialPoints: 25000,
        basePoints: 30000,
        uma: [20, 10, -10, -20]
      }
      
      console.log('🏁 Using default settings:', defaultSettings)
      
      const finalResults = this.calculateSettlement(participants, defaultSettings)
      await this.saveFinalResults(finalResults, participants)
      return
    }

    // ウマの処理：JSON型またはstring型の可能性があるため適切にパース
    let umaArray: number[] = [20, 10, -10, -20] // デフォルト値
    if (game.settings.uma) {
      if (Array.isArray(game.settings.uma)) {
        umaArray = game.settings.uma as number[]
      } else if (typeof game.settings.uma === 'string') {
        try {
          umaArray = JSON.parse(game.settings.uma as string)
        } catch (e) { // eslint-disable-line @typescript-eslint/no-unused-vars
          console.log('🏁 Failed to parse uma JSON, using default')
        }
      } else if (typeof game.settings.uma === 'object') {
        // Prisma JSON型の場合
        umaArray = game.settings.uma as unknown as number[]
      }
    }

    const settings = {
      initialPoints: game.settings.initialPoints || 25000,
      basePoints: (game.settings as GameSettings)?.basePoints || 30000,
      uma: umaArray
    }
    
    console.log('🏁 Processed settings:', settings)
    
    const finalResults = this.calculateSettlement(participants, settings)
    await this.saveFinalResults(finalResults, participants)
  }

  /**
   * 正確な精算計算（基準点方式）
   */
  private calculateSettlement(participants: ParticipantWithPlayer[], settings: {
    initialPoints: number
    basePoints: number
    uma: number[]
  }) {
    console.log('🏁 Starting settlement calculation with settings:', settings)
    
    // 1. 順位計算（点数→上家優先）
    const sortedParticipants = participants
      .map((p, originalIndex) => ({ ...p, originalIndex }))
      .sort((a, b) => {
        // 点数で比較
        if (b.currentPoints !== a.currentPoints) {
          return b.currentPoints - a.currentPoints
        }
        // 同点の場合は上家優先（position小さい方が上位）
        return a.position - b.position
      })

    console.log('🏁 Sorted participants:', sortedParticipants.map(p => ({
      name: p.player?.name || 'Unknown',
      points: p.currentPoints,
      position: p.position
    })))

    // 2. 基準点からの差分計算
    const resultsWithDiff = sortedParticipants.map((participant, index) => {
      const rank = index + 1
      const pointDiff = participant.currentPoints - settings.basePoints
      
      // 3. 1000点単位での精算計算
      let roundedDiff: number
      if (pointDiff >= 0) {
        // プラスの場合：切り捨て
        roundedDiff = Math.floor(pointDiff / 1000)
      } else {
        // マイナスの場合：切り上げ
        roundedDiff = Math.ceil(pointDiff / 1000)
      }

      const uma = settings.uma[index] || 0
      
      // 1位以外の精算計算：精算点数 + ウマ
      let settlement: number
      if (rank === 1) {
        // 1位は後で調整
        settlement = 0
      } else {
        settlement = roundedDiff + uma
      }

      return {
        playerId: participant.playerId,
        finalPoints: participant.currentPoints,
        rank,
        pointDiff,
        roundedDiff,
        uma,
        settlement
      }
    })

    console.log('🏁 Results before adjustment:', resultsWithDiff)

    // 4. 1位のプレイヤーの精算計算
    // 1位の精算点数 = 他のプレイヤーの精算点数の合計の符号反転
    const othersRoundedDiffTotal = resultsWithDiff.slice(1).reduce((sum, r) => sum + r.roundedDiff, 0)
    const firstPlaceRoundedDiff = -othersRoundedDiffTotal
    
    // 1位の精算点数を更新
    resultsWithDiff[0].roundedDiff = firstPlaceRoundedDiff
    
    const firstPlaceUma = resultsWithDiff[0].uma
    resultsWithDiff[0].settlement = firstPlaceRoundedDiff + firstPlaceUma
    
    console.log(`🏁 Others rounded diff total: ${othersRoundedDiffTotal}`)
    console.log(`🏁 First place rounded diff: ${firstPlaceRoundedDiff} (= -${othersRoundedDiffTotal})`)
    console.log(`🏁 First place uma: ${firstPlaceUma}`)
    console.log(`🏁 First place settlement: ${firstPlaceRoundedDiff} + ${firstPlaceUma} = ${resultsWithDiff[0].settlement}`)
    
    // 最終チェック：ゼロサム確認
    const finalTotal = resultsWithDiff.reduce((sum, r) => sum + r.settlement, 0)
    console.log(`🏁 Final total check (should be 0): ${finalTotal}`)

    console.log('🏁 Final results:', resultsWithDiff)
    return resultsWithDiff
  }

  /**
   * 最終結果をデータベースに保存
   */
  private async saveFinalResults(results: SettlementResult[], participants: ParticipantWithPlayer[]) {
    // 各参加者の最終結果を更新
    for (const result of results) {
      const participant = participants.find(p => p.playerId === result.playerId)
      
      if (participant) {
        console.log(`🏁 Updating participant ${result.playerId}:`, result)
        await prisma.gameParticipant.update({
          where: { id: participant.id },
          data: {
            finalPoints: result.finalPoints,
            finalRank: result.rank,
            uma: result.uma,
            settlement: result.settlement
          }
        })
      }
    }

    // 最終結果テーブルに保存（既存の場合は更新）
    await prisma.gameResult.upsert({
      where: { gameId: this.gameId },
      create: {
        gameId: this.gameId,
        results: JSON.parse(JSON.stringify(results))
      },
      update: {
        results: JSON.parse(JSON.stringify(results))
      }
    })
  }

  /**
   * 点数更新と記録
   */
  private async updatePoints(
    playerId: string,
    newPoints: number,
    type: 'WIN' | 'LOSE' | 'RIICHI' | 'HONBA' | 'KYOTAKU',
    description: string
  ): Promise<void> {
    const participant = await prisma.gameParticipant.findFirst({
      where: { gameId: this.gameId, playerId }
    })

    if (!participant) {
      throw new Error('Participant not found')
    }

    const pointChange = newPoints - participant.currentPoints

    // 点数更新
    await prisma.gameParticipant.update({
      where: { id: participant.id },
      data: { currentPoints: newPoints }
    })

    // 取引記録
    await this.recordTransaction({
      fromPlayerId: type === 'WIN' ? undefined : playerId,
      toPlayerId: type === 'WIN' ? playerId : 'GAME',
      amount: Math.abs(pointChange),
      type,
      description
    })
  }


  /**
   * 取引記録
   */
  private async recordTransaction(data: {
    fromPlayerId?: string
    toPlayerId: string
    amount: number
    type: 'WIN' | 'LOSE' | 'RIICHI' | 'HONBA' | 'KYOTAKU'
    description: string
  }): Promise<void> {
    // TODO: 点数履歴テーブルが必要な場合は実装
    console.log('Transaction recorded:', data)
  }

  /**
   * 参加者一覧取得
   */
  private async getParticipants() {
    return await prisma.gameParticipant.findMany({
      where: { gameId: this.gameId },
      orderBy: { position: 'asc' }
    })
  }

  /**
   * ゲーム終了判定
   */
  async checkGameEnd(): Promise<{ shouldEnd: boolean; reason?: string }> {
    const participants = await this.getParticipants()
    const game = await prisma.game.findUnique({
      where: { id: this.gameId },
      include: { settings: true }
    })

    if (!game) return { shouldEnd: false }

    // 1. トビ判定（誰かが0点以下）
    const tobiPlayer = participants.find(p => p.currentPoints <= 0)
    if (tobiPlayer && game.settings?.hasTobi) {
      return { 
        shouldEnd: true, 
        reason: `トビ終了: ${tobiPlayer.playerId}がマイナス点数` 
      }
    }

    // 2. 規定局数終了判定
    const gameEndResult = this.checkRoundEnd(game, game.settings?.gameType)
    if (gameEndResult.shouldEnd) {
      return gameEndResult
    }

    return { shouldEnd: false }
  }

  /**
   * 局数による終了判定
   */
  private checkRoundEnd(game: GameWithSettings, gameType?: string): { shouldEnd: boolean; reason?: string } {
    const { currentRound, currentOya } = game
    
    console.log(`🎯 Game end check: gameType=${gameType}, currentRound=${currentRound}, currentOya=${currentOya}`)

    if (gameType === 'TONPUU') {
      // 東風戦: 東4局終了条件
      console.log(`🎯 TONPUU check: currentRound=${currentRound} > 4?`, currentRound > 4)
      if (currentRound > 4) {
        // 東4局が終了した後（親ローテーション後にround=5になった時点）
        console.log(`🎯 TONPUU ending: round ${currentRound}`)
        return { 
          shouldEnd: true, 
          reason: '東風戦終了: 東4局完了' 
        }
      }
    } else if (gameType === 'HANCHAN') {
      // 半荘戦: 南4局終了条件
      console.log(`🎯 HANCHAN check: currentRound=${currentRound} > 8?`, currentRound > 8)
      if (currentRound > 8) {
        // 南4局が終了した後（親ローテーション後にround=9になった時点）
        console.log(`🎯 HANCHAN ending: round ${currentRound}`)
        return { 
          shouldEnd: true, 
          reason: '半荘戦終了: 南4局完了' 
        }
      }
    } else {
      console.log(`🎯 Unknown gameType: ${gameType}`)
    }

    console.log(`🎯 Game continues: gameType=${gameType}, round=${currentRound}`)
    return { shouldEnd: false }
  }

  /**
   * 強制終了処理
   */
  async forceEndGame(reason: string = '強制終了'): Promise<void> {
    console.log('🏁 forceEndGame called with reason:', reason, 'gameId:', this.gameId)

    await prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id: this.gameId },
        data: {
          status: 'FINISHED',
          endedAt: new Date()
        }
      })

      const game = await tx.game.findUnique({
        where: { id: this.gameId },
        select: { sessionId: true }
      })

      if (game?.sessionId) {
        await tx.gameSession.update({
          where: { id: game.sessionId },
          data: {
            status: 'FINISHED',
            endedAt: new Date()
          }
        })
      }

      await tx.gameEvent.create({
        data: {
          gameId: this.gameId,
          eventType: 'GAME_END',
          eventData: {
            reason,
            forcedEnd: true
          },
          round: 0,
          honba: 0
        }
      })
    })

    console.log('🏁 Game status updated to FINISHED in forceEndGame, calling calculateFinalResults')
    
    // 最終結果計算
    await this.calculateFinalResults()

    console.log('🏁 calculateFinalResults completed in forceEndGame, updating session statistics')
    
    // セッション統計更新
    await this.updateSessionStatistics()

    console.log('🏁 Session statistics updated in forceEndGame')
  }

  /**
   * セッション統計更新
   */
  async updateSessionStatistics(): Promise<void> {
    console.log('📊 Updating session statistics for gameId:', this.gameId)
    
    // ゲームのセッション情報を取得
    const game = await prisma.game.findUnique({
      where: { id: this.gameId },
      include: {
        participants: true,
        session: true
      }
    })

    if (!game || !game.sessionId) {
      console.log('📊 No session found for game, skipping session statistics update')
      return
    }

    console.log('📊 Found session:', game.sessionId, 'updating statistics for', game.participants.length, 'participants')

    // 各参加者のセッション統計を更新
    for (const participant of game.participants) {
      const finalRank = participant.finalRank
      const settlement = participant.settlement || 0

      console.log('📊 Updating participant:', participant.playerId, 'rank:', finalRank, 'settlement:', settlement)
      
      if (finalRank === null || finalRank === undefined) {
        console.log('📊 Warning: finalRank is null for participant:', participant.playerId, 'skipping statistics update')
        continue
      }

      // セッション参加者が存在しない場合は作成
      const sessionParticipant = await prisma.sessionParticipant.upsert({
        where: {
          sessionId_playerId: {
            sessionId: game.sessionId,
            playerId: participant.playerId
          }
        },
        create: {
          sessionId: game.sessionId,
          playerId: participant.playerId,
          position: participant.position,
          totalGames: 1,
          totalSettlement: settlement,
          firstPlace: finalRank === 1 ? 1 : 0,
          secondPlace: finalRank === 2 ? 1 : 0,
          thirdPlace: finalRank === 3 ? 1 : 0,
          fourthPlace: finalRank === 4 ? 1 : 0
        },
        update: {
          totalGames: { increment: 1 },
          totalSettlement: { increment: settlement },
          firstPlace: finalRank === 1 ? { increment: 1 } : undefined,
          secondPlace: finalRank === 2 ? { increment: 1 } : undefined,
          thirdPlace: finalRank === 3 ? { increment: 1 } : undefined,
          fourthPlace: finalRank === 4 ? { increment: 1 } : undefined
        }
      })

      console.log('📊 Updated session participant:', sessionParticipant.id)
    }

    console.log('📊 Session statistics update completed')
  }

  /**
   * ゲーム情報取得
   */
  async getGameInfo() {
    const game = await prisma.game.findUnique({
      where: { id: this.gameId },
      select: {
        id: true,
        roomCode: true,
        status: true,
        currentRound: true,
        currentOya: true,
        honba: true,
        kyotaku: true,
        sessionId: true
      }
    })
    return game
  }

  /**
   * 現在のゲーム状態取得
   */
  async getGameState() {
    const game = await prisma.game.findUnique({
      where: { id: this.gameId },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: 'asc' }
        }
      }
    })

    if (!game) {
      throw new Error('Game not found')
    }

    return {
      gameId: game.id,
      players: game.participants.map(p => ({
        playerId: p.playerId,
        name: p.player.name,
        position: p.position,
        points: p.currentPoints,
        isReach: p.isReach,
        isConnected: true // TODO: セッション管理
      })),
      currentRound: game.currentRound,
      currentOya: game.currentOya,
      honba: game.honba,
      kyotaku: game.kyotaku,
      gamePhase: game.status.toLowerCase() as 'waiting' | 'playing' | 'finished'
    }
  }
}