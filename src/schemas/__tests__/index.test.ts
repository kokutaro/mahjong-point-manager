import {
  getScoreCalculationSchema,
  getRyukyokuSchema,
  getRiichiSchema,
  validateScoreCalculation,
  validateRyukyoku,
  validateRiichi,
  isMultiPlayerIdentifier,
  isSoloPlayerIdentifier,
  determineGameMode,
  getSchemaInfo,
} from "../index"
import {
  MultiScoreCalculationSchema,
  MultiRyukyokuSchema,
  MultiRiichiSchema,
} from "../multi"
import {
  SoloScoreCalculationSchema,
  SoloRyukyokuSchema,
  SoloRiichiSchema,
} from "../solo"

describe("schemas/index", () => {
  test("schema getters", () => {
    expect(getScoreCalculationSchema("MULTIPLAYER")).toBe(
      MultiScoreCalculationSchema
    )
    expect(getScoreCalculationSchema("SOLO")).toBe(SoloScoreCalculationSchema)
    expect(getRyukyokuSchema("MULTIPLAYER")).toBe(MultiRyukyokuSchema)
    expect(getRyukyokuSchema("SOLO")).toBe(SoloRyukyokuSchema)
    expect(getRiichiSchema("MULTIPLAYER")).toBe(MultiRiichiSchema)
    expect(getRiichiSchema("SOLO")).toBe(SoloRiichiSchema)
  })

  test("validation helpers", () => {
    const multiData = {
      winnerId: "550e8400-e29b-41d4-a716-446655440000",
      han: 2,
      fu: 30,
      isTsumo: false,
      loserId: "550e8400-e29b-41d4-a716-446655440001",
    }
    expect(validateScoreCalculation(multiData, "MULTIPLAYER")).toMatchObject(
      multiData
    )
    const soloData = {
      winnerId: 0,
      han: 1,
      fu: 40,
      isTsumo: true,
      isOya: false,
      isDora: false,
      isUraDora: false,
      isAkaDora: false,
    }
    const parsedSolo = validateScoreCalculation(soloData, "SOLO")
    expect(parsedSolo).toMatchObject({
      winnerId: 0,
      han: 1,
      fu: 40,
      isTsumo: true,
    })
    const rData = { reason: "流局", tenpaiPlayers: [] }
    expect(validateRyukyoku(rData, "SOLO")).toMatchObject(rData)
    const riichiData = { playerId: "550e8400-e29b-41d4-a716-446655440000" }
    expect(validateRiichi(riichiData, "MULTIPLAYER")).toEqual(riichiData)
  })

  test("identifier guards", () => {
    expect(isMultiPlayerIdentifier("abc")).toBe(true)
    expect(isMultiPlayerIdentifier(1 as any)).toBe(false)
    expect(isSoloPlayerIdentifier(2)).toBe(true)
    expect(isSoloPlayerIdentifier("x" as any)).toBe(false)
  })

  test("determineGameMode and schema info", () => {
    expect(determineGameMode({ gameMode: "SOLO" })).toBe("SOLO")
    expect(determineGameMode({})).toBe("MULTIPLAYER")
    const info = getSchemaInfo("SOLO")
    expect(info.gameMode).toBe("SOLO")
    expect(info.schemaNames).toContain("scoreCalculation")
  })
})
