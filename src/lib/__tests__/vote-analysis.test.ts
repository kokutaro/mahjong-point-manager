import {
  analyzeVotes,
  isValidVote,
  getVoteDisplayName,
  getVoteIcon,
} from "../vote-analysis"
import { VoteState } from "@/components/VotingProgress"

describe("Vote Analysis", () => {
  describe("analyzeVotes", () => {
    test("全員が終了投票の場合、終了アクションを返す", () => {
      const votes: VoteState = {
        player1: "end",
        player2: "end",
        player3: "end",
        player4: "end",
      }

      const result = analyzeVotes(votes, 4)

      expect(result.action).toBe("end")
      expect(result.message).toContain("全員がセッション終了に合意")
      expect(result.details.endVotes).toBe(4)
      expect(result.details.continueVotes).toBe(0)
      expect(result.details.pauseVotes).toBe(0)
    })

    test("継続投票がある場合、継続アクションを返す", () => {
      const votes: VoteState = {
        player1: "continue",
        player2: "end",
        player3: "end",
        player4: "end",
      }

      const result = analyzeVotes(votes, 4)

      expect(result.action).toBe("continue")
      expect(result.message).toContain("継続を希望")
      expect(result.details.continueVotes).toBe(1)
      expect(result.details.endVotes).toBe(3)
    })

    test("全員が保留の場合、待機アクションを返す", () => {
      const votes: VoteState = {
        player1: "pause",
        player2: "pause",
        player3: "pause",
        player4: "pause",
      }

      const result = analyzeVotes(votes, 4)

      expect(result.action).toBe("wait")
      expect(result.message).toContain("全員が保留を選択")
      expect(result.details.pauseVotes).toBe(4)
    })

    test("投票が未完了の場合、待機アクションを返す", () => {
      const votes: VoteState = {
        player1: "continue",
        player2: "end",
      }

      const result = analyzeVotes(votes, 4)

      expect(result.action).toBe("wait")
      expect(result.message).toContain("投票待機中 (2/4)")
      expect(result.details.votedPlayers).toBe(2)
      expect(result.details.totalPlayers).toBe(4)
    })

    test("混合投票で継続が優先される", () => {
      const votes: VoteState = {
        player1: "continue",
        player2: "end",
        player3: "pause",
        player4: "pause",
      }

      const result = analyzeVotes(votes, 4)

      expect(result.action).toBe("continue")
      expect(result.details.continueVotes).toBe(1)
      expect(result.details.endVotes).toBe(1)
      expect(result.details.pauseVotes).toBe(2)
    })
  })

  describe("isValidVote", () => {
    test("有効な投票選択肢を正しく判定", () => {
      expect(isValidVote("continue")).toBe(true)
      expect(isValidVote("end")).toBe(true)
      expect(isValidVote("pause")).toBe(true)
    })

    test("無効な投票選択肢を正しく判定", () => {
      expect(isValidVote("invalid")).toBe(false)
      expect(isValidVote(null)).toBe(false)
      expect(isValidVote(undefined)).toBe(false)
      expect(isValidVote("")).toBe(false)
      expect(isValidVote(123)).toBe(false)
    })
  })

  describe("getVoteDisplayName", () => {
    test("投票選択肢の表示名を取得", () => {
      expect(getVoteDisplayName("continue")).toBe("セッション継続")
      expect(getVoteDisplayName("end")).toBe("セッション終了")
      expect(getVoteDisplayName("pause")).toBe("保留・様子見")
    })
  })

  describe("getVoteIcon", () => {
    test("投票選択肢のアイコンを取得", () => {
      expect(getVoteIcon("continue")).toBe("🔄")
      expect(getVoteIcon("end")).toBe("✋")
      expect(getVoteIcon("pause")).toBe("⏸️")
    })
  })

  describe("Edge Cases", () => {
    test("空の投票状態", () => {
      const votes: VoteState = {}
      const result = analyzeVotes(votes, 4)

      expect(result.action).toBe("wait")
      expect(result.details.votedPlayers).toBe(0)
      expect(result.details.totalPlayers).toBe(4)
    })

    test("プレイヤー数0の場合", () => {
      const votes: VoteState = {}
      const result = analyzeVotes(votes, 0)

      // プレイヤー数が0の場合、全員投票済み条件 (0 === 0) が成立するため、
      // 実際の動作を確認
      expect(result.details.totalPlayers).toBe(0)
      expect(result.details.votedPlayers).toBe(0)
      // 実際の動作: 全員投票済み & 全員終了投票（0票）で終了判定
      expect(result.action).toBe("end")
    })

    test("投票数が総プレイヤー数を超える場合", () => {
      const votes: VoteState = {
        player1: "end",
        player2: "end",
        player3: "end",
        player4: "end",
        player5: "end",
      }

      const result = analyzeVotes(votes, 4)

      // 投票数が総プレイヤー数を超える場合の実際の動作
      expect(result.details.votedPlayers).toBe(5)
      expect(result.details.totalPlayers).toBe(4)
      // 実際の動作: votedPlayers !== totalPlayers なので「まだ投票中」
      expect(result.action).toBe("wait")
      expect(result.message).toContain("投票待機中 (5/4)")
    })
  })
})
