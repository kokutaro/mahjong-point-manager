import {
  validateMultiPlayerId,
  validateRoomCode,
  validateSessionVote,
} from "../multi"

describe("multi utils", () => {
  test("validateMultiPlayerId", () => {
    expect(validateMultiPlayerId("550e8400-e29b-41d4-a716-446655440000")).toBe(
      true
    )
    expect(validateMultiPlayerId("invalid")).toBe(false)
  })

  test("validateRoomCode", () => {
    expect(validateRoomCode("ABC123")).toBe(true)
    expect(validateRoomCode("abc123")).toBe(false)
    expect(validateRoomCode("AAA11")).toBe(false)
  })

  test("validateSessionVote", () => {
    const players = ["p1", "p2"]
    const votes = { p1: "end" }
    expect(validateSessionVote("p3", votes, players)).toEqual({
      isValid: false,
      reason: "プレイヤーがセッションに参加していません",
    })
    expect(validateSessionVote("p1", votes, players)).toEqual({
      isValid: false,
      reason: "既に投票済みです",
    })
    expect(validateSessionVote("p2", votes, players)).toEqual({ isValid: true })
  })
})
