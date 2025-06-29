#!/usr/bin/env npx tsx

/**
 * セッション統計修正スクリプト
 *
 * 重複してカウントされたセッション統計を正しい値に修正します。
 * このスクリプトは、各セッションの統計を完了したゲームから再計算して更新します。
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface SessionStatsFix {
  sessionId: string
  sessionName: string | null
  participantsFixed: number
  totalGamesActual: number
}

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes("--dry-run")

  if (isDryRun) {
    console.log(
      "🔍 ドライランモード: 実際の修正は行わず、問題のあるデータのみを表示します"
    )
  } else {
    console.log("🔧 セッション統計修正スクリプトを開始します...")
  }

  try {
    // 全てのセッションを取得
    const sessions = await prisma.gameSession.findMany({
      include: {
        participants: {
          include: {
            player: {
              select: {
                name: true,
              },
            },
          },
        },
        games: {
          where: {
            status: "FINISHED",
          },
          include: {
            participants: {
              include: {
                player: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            sessionOrder: "asc",
          },
        },
      },
    })

    console.log(`📊 ${sessions.length}個のセッションを処理します...`)

    const fixes: SessionStatsFix[] = []

    for (const session of sessions) {
      console.log(
        `\n🎯 セッション処理中: ${session.name || session.sessionCode}`
      )
      console.log(`   完了したゲーム数: ${session.games.length}`)
      console.log(`   参加者数: ${session.participants.length}`)

      // セッション参加者の統計を再計算
      const participantStats = new Map<
        string,
        {
          playerId: string
          position: number
          totalGames: number
          totalSettlement: number
          firstPlace: number
          secondPlace: number
          thirdPlace: number
          fourthPlace: number
        }
      >()

      // 各ゲームの結果を集計
      for (const game of session.games) {
        for (const gameParticipant of game.participants) {
          const playerId = gameParticipant.playerId

          if (!participantStats.has(playerId)) {
            participantStats.set(playerId, {
              playerId,
              position: gameParticipant.position,
              totalGames: 0,
              totalSettlement: 0,
              firstPlace: 0,
              secondPlace: 0,
              thirdPlace: 0,
              fourthPlace: 0,
            })
          }

          const stats = participantStats.get(playerId)!

          // 最終結果がある場合のみ統計に含める
          if (
            gameParticipant.finalRank !== null &&
            gameParticipant.settlement !== null
          ) {
            stats.totalGames += 1
            stats.totalSettlement += gameParticipant.settlement

            // 順位別集計
            switch (gameParticipant.finalRank) {
              case 1:
                stats.firstPlace += 1
                break
              case 2:
                stats.secondPlace += 1
                break
              case 3:
                stats.thirdPlace += 1
                break
              case 4:
                stats.fourthPlace += 1
                break
            }
          }
        }
      }

      // 現在の統計と比較して修正が必要かチェック
      let needsUpdate = false
      let participantsFixed = 0

      for (const [playerId, correctStats] of participantStats.entries()) {
        const currentParticipant = session.participants.find(
          (p) => p.playerId === playerId
        )

        if (currentParticipant) {
          const hasDiscrepancy =
            currentParticipant.totalGames !== correctStats.totalGames ||
            currentParticipant.totalSettlement !==
              correctStats.totalSettlement ||
            currentParticipant.firstPlace !== correctStats.firstPlace ||
            currentParticipant.secondPlace !== correctStats.secondPlace ||
            currentParticipant.thirdPlace !== correctStats.thirdPlace ||
            currentParticipant.fourthPlace !== correctStats.fourthPlace

          if (hasDiscrepancy) {
            needsUpdate = true
            participantsFixed++

            console.log(
              `   ❌ ${currentParticipant.player?.name || playerId}: 修正が必要`
            )
            console.log(
              `      ゲーム数: ${currentParticipant.totalGames} → ${correctStats.totalGames}`
            )
            console.log(
              `      累計精算: ${currentParticipant.totalSettlement} → ${correctStats.totalSettlement}`
            )

            // 統計を修正（ドライランモードでは実行しない）
            if (!isDryRun) {
              await prisma.sessionParticipant.update({
                where: {
                  id: currentParticipant.id,
                },
                data: {
                  totalGames: correctStats.totalGames,
                  totalSettlement: correctStats.totalSettlement,
                  firstPlace: correctStats.firstPlace,
                  secondPlace: correctStats.secondPlace,
                  thirdPlace: correctStats.thirdPlace,
                  fourthPlace: correctStats.fourthPlace,
                },
              })
            }
          } else {
            console.log(
              `   ✅ ${currentParticipant.player?.name || playerId}: 統計は正確`
            )
          }
        }
      }

      if (needsUpdate) {
        fixes.push({
          sessionId: session.id,
          sessionName: session.name,
          participantsFixed,
          totalGamesActual: session.games.length,
        })
        if (isDryRun) {
          console.log(`   🔍 ${participantsFixed}名の統計に修正が必要です`)
        } else {
          console.log(`   🔧 ${participantsFixed}名の統計を修正しました`)
        }
      } else {
        console.log(`   ✅ このセッションの統計は正確でした`)
      }
    }

    // 修正結果のサマリー
    console.log("\n📋 修正結果サマリー:")
    console.log(`   処理したセッション数: ${sessions.length}`)
    console.log(`   修正が必要だったセッション数: ${fixes.length}`)

    if (fixes.length > 0) {
      console.log("\n修正されたセッション一覧:")
      for (const fix of fixes) {
        console.log(
          `   - ${fix.sessionName || fix.sessionId}: ${fix.participantsFixed}名修正`
        )
      }
    } else {
      console.log("   修正が必要なセッションはありませんでした ✅")
    }

    console.log("\n🎉 セッション統計修正スクリプトが完了しました!")
  } catch (error) {
    console.error("❌ スクリプト実行中にエラーが発生しました:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
