import { validatePlayerPositions, getPlayerPosition } from "../common"

describe("common utils", () => {
  test("validatePlayerPositions", () => {
    expect(validatePlayerPositions([0, 1, 2, 3])).toBe(true)
    expect(validatePlayerPositions([0, 0, 1, 2])).toBe(false)
    expect(validatePlayerPositions([-1, 1, 2, 3])).toBe(false)
    expect(validatePlayerPositions([0, 1, 2, 4])).toBe(false)
  })

  test("getPlayerPosition solo", () => {
    expect(getPlayerPosition(1, "SOLO")).toBe(1)
    expect(getPlayerPosition("x", "SOLO")).toBe(0)
  })

  test("getPlayerPosition multiplayer always 0", () => {
    expect(getPlayerPosition("abc", "MULTIPLAYER")).toBe(0)
    expect(getPlayerPosition(2 as any, "MULTIPLAYER")).toBe(0)
  })
})
