import { prisma } from '@/lib/prisma'
import { ScoreCalculationResult } from '@/lib/score'

export interface SoloPointTransaction {
  id: string
  soloGameId: string
  fromPosition?: number
  toPosition: number
  amount: number
  type: 'WIN' | 'LOSE' | 'RIICHI' | 'HONBA' | 'KYOTAKU'
  description: string
  timestamp: Date
}

export interface SoloPlayerPointState {
  position: number
  currentPoints: number
  isReach: boolean
  reachRound?: number
}

export class SoloPointManager {
  private soloGameId: string

  constructor(soloGameId: string) {
    this.soloGameId = soloGameId
  }

  /**
   * アガリ時の点数分配
   */
  async distributeWinPoints(
    winnerPosition: number,
    scoreResult: ScoreCalculationResult,
    isTsumo: boolean,
    loserPosition?: number
  ): Promise<{ gameEnded: boolean; reason?: string }> {
    const players = await this.getPlayers()
    const winner = players.find(p => p.position === winnerPosition)
    
    if (!winner) {
      throw new Error('Winner not found')
    }

    const game = await prisma.soloGame.findUnique({ 
      where: { id: this.soloGameId },
      select: { currentOya: true, kyotaku: true }
    })
    
    const isOya = winner.position === (game?.currentOya || 0)

    // scoreResult.totalScoreには既に供託分が含まれているため、そのまま使用
    if (isTsumo) {
      await this.handleTsumoDistribution(winnerPosition, scoreResult, isOya)
    } else {
      await this.handleRonDistribution(winnerPosition, loserPosition!, scoreResult)
    }

    // トランザクション内でリーチ状態解除と供託クリアを実行
    await prisma.$transaction(async (tx) => {
      // 全プレイヤーのリーチ状態を解除
      await tx.soloPlayer.updateMany({
        where: {
          soloGameId: this.soloGameId,
          isReach: true
        },
        data: {
          isReach: false,
          reachRound: null
        }
      })

      // 供託をクリア（点数分配は既に上で行った）
      if (game?.kyotaku && game.kyotaku > 0) {
        await tx.soloGame.update({
          where: { id: this.soloGameId },
          data: { kyotaku: 0 }
        })
      }
    })

    // 親ローテーション処理とゲーム終了判定
    const rotateResult = await this.rotateDealer(winnerPosition)
    return rotateResult
  }

  /**
   * ツモ時の点数分配
   */
  private async handleTsumoDistribution(
    winnerPosition: number,
    scoreResult: ScoreCalculationResult,
    isOya: boolean
  ): Promise<void> {
    const players = await this.getPlayers()
    
    // 現在の親の位置を取得
    const game = await prisma.soloGame.findUnique({
      where: { id: this.soloGameId },
      select: { currentOya: true }
    })
    
    const currentOya = game?.currentOya || 0
    
    for (const player of players) {
      if (player.position === winnerPosition) {
        // 勝者の点数加算
        await this.updatePoints(
          player.position,
          player.currentPoints + scoreResult.totalScore,
          'TSUMO',
          `ツモ和了 ${scoreResult.totalScore}点`
        )
      } else {
        // 敗者の点数減算
        let payment: number
        const isThisPlayerOya = player.position === currentOya
        
        if (isOya) {
          // 親ツモ: 子全員が同額
          payment = scoreResult.payments.fromKo || 0
        } else {
          // 子ツモ: 親と子で異なる
          payment = isThisPlayerOya ? 
            (scoreResult.payments.fromOya || 0) : 
            (scoreResult.payments.fromKo || 0)
        }
        
        console.log(`Player position ${player.position}, currentOya: ${currentOya}, isThisPlayerOya: ${isThisPlayerOya}, payment: ${payment}`)
        
        await this.updatePoints(
          player.position,
          player.currentPoints - payment,
          'TSUMO',
          `ツモ支払い -${payment}点`
        )
      }
    }
  }

  /**
   * ロン時の点数分配
   */
  private async handleRonDistribution(
    winnerPosition: number,
    loserPosition: number,
    scoreResult: ScoreCalculationResult
  ): Promise<void> {
    // 勝者の点数加算
    const winner = await prisma.soloPlayer.findFirst({
      where: { soloGameId: this.soloGameId, position: winnerPosition }
    })
    
    if (winner) {
      await this.updatePoints(
        winnerPosition,
        winner.currentPoints + scoreResult.totalScore,
        'RON',
        `ロン和了 ${scoreResult.totalScore}点`
      )
    }

    // 敗者の点数減算
    const loser = await prisma.soloPlayer.findFirst({
      where: { soloGameId: this.soloGameId, position: loserPosition }
    })
    
    if (loser) {
      const paymentAmount = scoreResult.payments.fromLoser || scoreResult.totalScore
      await this.updatePoints(
        loserPosition,
        loser.currentPoints - paymentAmount,
        'RON',
        `ロン支払い -${paymentAmount}点`
      )
    }
  }

  /**
   * リーチ宣言処理
   */
  async declareReach(position: number): Promise<void> {
    const player = await prisma.soloPlayer.findFirst({
      where: { soloGameId: this.soloGameId, position }
    })

    if (!player) {
      throw new Error('Player not found')
    }

    if (player.currentPoints < 1000) {
      throw new Error('リーチするには1000点以上必要です')
    }

    if (player.isReach) {
      throw new Error('既にリーチ宣言済みです')
    }

    // リーチ宣言
    await prisma.soloPlayer.update({
      where: { id: player.id },
      data: {
        isReach: true,
        currentPoints: player.currentPoints - 1000
      }
    })

    // 供託を増加
    await prisma.soloGame.update({
      where: { id: this.soloGameId },
      data: {
        kyotaku: { increment: 1 }
      }
    })

    // イベント記録
    await this.recordEvent({
      position,
      eventType: 'REACH',
      eventData: {
        position,
        points: player.currentPoints - 1000
      }
    })
  }

  /**
   * 流局時の処理
   */
  async handleRyukyoku(reason: string, tenpaiPositions: number[] = []): Promise<{ gameEnded: boolean; reason?: string }> {
    const game = await prisma.soloGame.findUnique({
      where: { id: this.soloGameId },
      include: {
        players: {
          orderBy: { position: 'asc' }
        }
      }
    })

    if (!game) {
      throw new Error('Game not found')
    }

    // 現在の親プレイヤーを取得
    const currentOya = game.players.find(p => p.position === game.currentOya)
    if (!currentOya) {
      throw new Error('親プレイヤーが見つかりません')
    }

    // 親がテンパイかどうか
    const isOyaTenpai = tenpaiPositions.includes(currentOya.position)

    // 更新後の状態計算
    const newHonba = game.honba + 1
    const newOya = isOyaTenpai ? game.currentOya : (game.currentOya + 1) % 4
    const newRound = isOyaTenpai ? game.currentRound : game.currentRound + 1

    await prisma.$transaction(async (tx) => {

      // テンパイ料の処理
      if (tenpaiPositions.length > 0 && tenpaiPositions.length < 4) {
        const tenpaiCount = tenpaiPositions.length
        const notienpaiCount = 4 - tenpaiCount
        const pointPerTenpai = Math.floor(3000 / tenpaiCount)
        const pointPerNoten = Math.floor(3000 / notienpaiCount)

        for (const player of game.players) {
          if (tenpaiPositions.includes(player.position)) {
            // テンパイプレイヤー：受け取り
            await tx.soloPlayer.update({
              where: { id: player.id },
              data: {
                currentPoints: player.currentPoints + pointPerTenpai
              }
            })
          } else {
            // ノーテンプレイヤー：支払い
            await tx.soloPlayer.update({
              where: { id: player.id },
              data: {
                currentPoints: player.currentPoints - pointPerNoten
              }
            })
          }
        }
      }

      // リーチ宣言をリセット（供託はそのまま持ち越し）
      await tx.soloPlayer.updateMany({
        where: {
          soloGameId: this.soloGameId,
          isReach: true
        },
        data: {
          isReach: false,
          reachRound: null
        }
      })

      // ゲーム状態更新（本場増加と親移動判定）
      await tx.soloGame.update({
        where: { id: this.soloGameId },
        data: {
          honba: newHonba,
          currentOya: newOya,
          currentRound: newRound,
          updatedAt: new Date()
        }
      })

      // イベント記録
      await tx.soloGameEvent.create({
        data: {
          soloGameId: this.soloGameId,
          eventType: 'RYUKYOKU',
          eventData: {
            reason,
            tenpaiPositions,
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
  async rotateDealer(winnerPosition?: number): Promise<{ gameEnded: boolean; reason?: string }> {
    const game = await prisma.soloGame.findUnique({
      where: { id: this.soloGameId }
    })

    if (!game) {
      throw new Error('Game not found')
    }

    const isOyaWin = winnerPosition === game.currentOya

    let newOya = game.currentOya
    let newHonba = game.honba
    let newRound = game.currentRound

    if (winnerPosition !== undefined && isOyaWin) {
      // 親の和了：連荘
      newHonba += 1
      // 親の和了なので局は進まない
      console.log(`親連荘: 親=${game.currentOya}継続, 本場=${game.honba} → ${newHonba}, 局=${game.currentRound}`)
    } else if (winnerPosition !== undefined && !isOyaWin) {
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

    await prisma.soloGame.update({
      where: { id: this.soloGameId },
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
    console.log('🏁 Solo finishGame called with reason:', reason, 'soloGameId:', this.soloGameId)
    
    await prisma.soloGame.update({
      where: { id: this.soloGameId },
      data: {
        status: 'FINISHED',
        endedAt: new Date()
      }
    })

    console.log('🏁 Solo Game status updated to FINISHED, calling calculateFinalResults')
    
    // 最終結果計算
    await this.calculateFinalResults()

    console.log('🏁 Solo calculateFinalResults completed, creating game end event')

    // イベント記録
    await prisma.soloGameEvent.create({
      data: {
        soloGameId: this.soloGameId,
        eventType: 'GAME_END',
        eventData: { 
          reason,
          finalResults: true
        },
        round: 0,
        honba: 0
      }
    })
    
    console.log('🏁 Solo Game end event created')
  }

  /**
   * 最終結果計算（ウマ・オカ含む）
   */
  async calculateFinalResults(): Promise<void> {
    console.log('🏁 Solo calculateFinalResults called for soloGameId:', this.soloGameId)
    const players = await this.getPlayers()
    const game = await prisma.soloGame.findUnique({
      where: { id: this.soloGameId }
    })

    console.log('🏁 Solo Game and players:', { 
      game: game ? { 
        id: game.id, 
        gameType: game.gameType,
        initialPoints: game.initialPoints
      } : null,
      players: players.length 
    })

    if (!game) {
      console.log('🏁 No solo game found, returning')
      return
    }

    // ゲーム設定を使用（データベースに保存された値）
    const gameSettings = {
      initialPoints: game.initialPoints,
      basePoints: game.basePoints || 30000,
      uma: (() => {
        let umaArray: number[] = [15000, 5000, -5000, -15000]; // デフォルト値
        if (game.uma) {
          if (Array.isArray(game.uma)) {
            umaArray = game.uma as number[];
          } else if (typeof game.uma === 'string') {
            try {
              umaArray = JSON.parse(game.uma as string);
            } catch (e) {
              console.log('🏁 Solo Failed to parse uma JSON, using default');
            }
          } else if (typeof game.uma === 'object') {
            // Prisma JSON型の場合
            umaArray = game.uma as unknown as number[];
          }
        }
        return umaArray;
      })()
    }
    
    console.log('🏁 Using settings:', gameSettings)
    
    const finalResults = this.calculateSettlement(players, gameSettings)
    await this.saveFinalResults(finalResults, players)
  }

  /**
   * 正確な精算計算（基準点方式）
   */
  private calculateSettlement(players: any[], settings: {
    initialPoints: number
    basePoints: number
    uma: number[]
  }) {
    console.log('🏁 Solo Starting settlement calculation with settings:', settings)
    
    // 1. 順位計算（点数→上家優先）
    const sortedPlayers = players
      .map((p, originalIndex) => ({ ...p, originalIndex }))
      .sort((a, b) => {
        // 点数で比較
        if (b.currentPoints !== a.currentPoints) {
          return b.currentPoints - a.currentPoints
        }
        // 同点の場合は上家優先（position小さい方が上位）
        return a.position - b.position
      })

    console.log('🏁 Solo Sorted players:', sortedPlayers.map(p => ({
      name: p.name,
      points: p.currentPoints,
      position: p.position
    })))

    // 2. 基準点からの差分計算
    const resultsWithDiff = sortedPlayers.map((player, index) => {
      const rank = index + 1
      const pointDiff = player.currentPoints - settings.basePoints
      
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
        position: player.position,
        finalPoints: player.currentPoints,
        rank,
        pointDiff,
        roundedDiff,
        uma,
        settlement
      }
    })

    console.log('🏁 Solo Results before adjustment:', resultsWithDiff)

    // 4. 1位のプレイヤーの精算計算
    // 1位の精算点数 = 他のプレイヤーの精算点数の合計の符号反転
    const othersRoundedDiffTotal = resultsWithDiff.slice(1).reduce((sum, r) => sum + r.roundedDiff, 0)
    const firstPlaceRoundedDiff = -othersRoundedDiffTotal
    
    // 1位の精算点数を更新
    resultsWithDiff[0].roundedDiff = firstPlaceRoundedDiff
    
    const firstPlaceUma = resultsWithDiff[0].uma
    resultsWithDiff[0].settlement = firstPlaceRoundedDiff + firstPlaceUma
    
    console.log(`🏁 Solo Others rounded diff total: ${othersRoundedDiffTotal}`)
    console.log(`🏁 Solo First place rounded diff: ${firstPlaceRoundedDiff} (= -${othersRoundedDiffTotal})`)
    console.log(`🏁 Solo First place uma: ${firstPlaceUma}`)
    console.log(`🏁 Solo First place settlement: ${firstPlaceRoundedDiff} + ${firstPlaceUma} = ${resultsWithDiff[0].settlement}`)
    
    // 最終チェック：ゼロサム確認
    const finalTotal = resultsWithDiff.reduce((sum, r) => sum + r.settlement, 0)
    console.log(`🏁 Solo Final total check (should be 0): ${finalTotal}`)

    console.log('🏁 Solo Final results:', resultsWithDiff)
    return resultsWithDiff
  }

  /**
   * 最終結果をデータベースに保存
   */
  private async saveFinalResults(results: any[], players: any[]) {
    // 各参加者の最終結果を更新
    for (const result of results) {
      const player = players.find(p => p.position === result.position)
      
      if (player) {
        console.log(`🏁 Solo Updating player ${result.position}:`, result)
        await prisma.soloPlayer.update({
          where: { id: player.id },
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
    await prisma.soloGameResult.upsert({
      where: { soloGameId: this.soloGameId },
      create: {
        soloGameId: this.soloGameId,
        results: results
      },
      update: {
        results: results
      }
    })
  }

  /**
   * 点数更新と記録
   */
  private async updatePoints(
    position: number,
    newPoints: number,
    type: 'TSUMO' | 'RON' | 'REACH' | 'RYUKYOKU',
    description: string
  ): Promise<void> {
    const player = await prisma.soloPlayer.findFirst({
      where: { soloGameId: this.soloGameId, position }
    })

    if (!player) {
      throw new Error('Player not found')
    }

    const pointChange = newPoints - player.currentPoints

    // 点数更新
    await prisma.soloPlayer.update({
      where: { id: player.id },
      data: { currentPoints: newPoints }
    })

    // イベント記録
    await this.recordEvent({
      position: position,
      eventType: type,
      eventData: {
        position,
        pointChange: Math.abs(pointChange),
        description,
        newPoints
      }
    })
  }

  /**
   * イベント記録
   */
  private async recordEvent(data: {
    position?: number
    eventType: string
    eventData: any
  }): Promise<void> {
    const game = await prisma.soloGame.findUnique({
      where: { id: this.soloGameId },
      select: { currentRound: true, honba: true }
    })

    await prisma.soloGameEvent.create({
      data: {
        soloGameId: this.soloGameId,
        position: data.position,
        eventType: data.eventType as any,
        eventData: data.eventData,
        round: game?.currentRound || 0,
        honba: game?.honba || 0
      }
    })
  }

  /**
   * プレイヤー一覧取得
   */
  private async getPlayers() {
    return await prisma.soloPlayer.findMany({
      where: { soloGameId: this.soloGameId },
      orderBy: { position: 'asc' }
    })
  }

  /**
   * ゲーム終了判定
   */
  async checkGameEnd(): Promise<{ shouldEnd: boolean; reason?: string }> {
    const players = await this.getPlayers()
    const game = await prisma.soloGame.findUnique({
      where: { id: this.soloGameId }
    })

    if (!game) return { shouldEnd: false }

    // 1. トビ判定（誰かが0点以下）- 一人プレイでもトビ終了はありえる
    const tobiPlayer = players.find(p => p.currentPoints <= 0)
    if (tobiPlayer) {
      return { 
        shouldEnd: true, 
        reason: `トビ終了: ${tobiPlayer.name}がマイナス点数` 
      }
    }

    // 2. 規定局数終了判定
    const gameEndResult = this.checkRoundEnd(game, game.gameType)
    if (gameEndResult.shouldEnd) {
      return gameEndResult
    }

    return { shouldEnd: false }
  }

  /**
   * 局数による終了判定
   */
  private checkRoundEnd(game: any, gameType?: string): { shouldEnd: boolean; reason?: string } {
    const { currentRound, currentOya } = game
    
    console.log(`🎯 Solo Game end check: gameType=${gameType}, currentRound=${currentRound}, currentOya=${currentOya}`)

    if (gameType === 'TONPUU') {
      // 東風戦: 東4局終了条件
      console.log(`🎯 Solo TONPUU check: currentRound=${currentRound} > 4?`, currentRound > 4)
      if (currentRound > 4) {
        // 東4局が終了した後（親ローテーション後にround=5になった時点）
        console.log(`🎯 Solo TONPUU ending: round ${currentRound}`)
        return { 
          shouldEnd: true, 
          reason: '東風戦終了: 東4局完了' 
        }
      }
    } else if (gameType === 'HANCHAN') {
      // 半荘戦: 南4局終了条件
      console.log(`🎯 Solo HANCHAN check: currentRound=${currentRound} > 8?`, currentRound > 8)
      if (currentRound > 8) {
        // 南4局が終了した後（親ローテーション後にround=9になった時点）
        console.log(`🎯 Solo HANCHAN ending: round ${currentRound}`)
        return { 
          shouldEnd: true, 
          reason: '半荘戦終了: 南4局完了' 
        }
      }
    } else {
      console.log(`🎯 Solo Unknown gameType: ${gameType}`)
    }

    console.log(`🎯 Solo Game continues: gameType=${gameType}, round=${currentRound}`)
    return { shouldEnd: false }
  }

  /**
   * 強制終了処理
   */
  async forceEndGame(reason: string = '強制終了'): Promise<void> {
    console.log('🏁 Solo forceEndGame called with reason:', reason, 'soloGameId:', this.soloGameId)

    await prisma.soloGame.update({
      where: { id: this.soloGameId },
      data: {
        status: 'FINISHED',
        endedAt: new Date()
      }
    })

    await prisma.soloGameEvent.create({
      data: {
        soloGameId: this.soloGameId,
        eventType: 'GAME_END',
        eventData: {
          reason,
          forcedEnd: true
        },
        round: 0,
        honba: 0
      }
    })

    console.log('🏁 Solo Game status updated to FINISHED in forceEndGame, calling calculateFinalResults')
    
    // 最終結果計算
    await this.calculateFinalResults()

    console.log('🏁 Solo calculateFinalResults completed in forceEndGame')
  }

  /**
   * ゲーム情報取得
   */
  async getGameInfo() {
    const game = await prisma.soloGame.findUnique({
      where: { id: this.soloGameId },
      select: {
        id: true,
        gameType: true,
        status: true,
        currentRound: true,
        currentOya: true,
        honba: true,
        kyotaku: true,
        initialPoints: true
      }
    })
    return game
  }

  /**
   * 現在のゲーム状態取得
   */
  async getGameState() {
    const game = await prisma.soloGame.findUnique({
      where: { id: this.soloGameId },
      include: {
        players: {
          orderBy: { position: 'asc' }
        }
      }
    })

    if (!game) {
      throw new Error('Solo Game not found')
    }

    return {
      gameId: game.id,
      players: game.players.map(p => ({
        id: `${p.position}`, // positionを文字列IDとして使用
        name: p.name,
        position: p.position,
        points: p.currentPoints,
        isReach: p.isReach
      })),
      currentRound: game.currentRound,
      currentOya: game.currentOya,
      honba: game.honba,
      kyotaku: game.kyotaku,
      status: game.status,
      gameType: game.gameType,
      initialPoints: game.initialPoints
    }
  }
}