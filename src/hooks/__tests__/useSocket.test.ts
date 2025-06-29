/* eslint-disable @typescript-eslint/no-require-imports */
import { renderHook, act } from "@testing-library/react"
import { useSocket } from "../useSocket"

// eslint-disable-next-line no-var
var socketClientMock: any
// eslint-disable-next-line no-var
var eventBus: any
// eslint-disable-next-line no-var
var mockSocket: any

jest.mock("@/lib/socket-client", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require("events")
  const bus = new EventEmitter()
  eventBus = bus
  mockSocket = {
    id: "s1",
    connected: true,
    on: bus.on.bind(bus),
    off: bus.off.bind(bus),
    emit: jest.fn(),
    disconnect: jest.fn(),
  }
  socketClientMock = {
    connect: jest.fn(() => mockSocket),
    onGameState: (cb: any) => eventBus.on("game_state", cb),
    onPlayerConnected: jest.fn(),
    onPlayerJoined: jest.fn(),
    onScoreUpdated: jest.fn(),
    onRiichiDeclared: jest.fn(),
    onRyukyoku: jest.fn(),
    onSeatOrderUpdated: jest.fn(),
    onError: jest.fn(),
    offGameState: jest.fn(),
    offPlayerConnected: jest.fn(),
    offPlayerJoined: jest.fn(),
    offScoreUpdated: jest.fn(),
    offRiichiDeclared: jest.fn(),
    offRyukyoku: jest.fn(),
    offSeatOrderUpdated: jest.fn(),
    offError: jest.fn(),
    joinRoom: jest.fn(),
    setReady: jest.fn(),
    calculateScore: jest.fn(),
    declareReach: jest.fn(),
    declareRyukyoku: jest.fn(),
  }
  return { socketClient: socketClientMock }
})

describe("useSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    eventBus.removeAllListeners()
  })

  test("connects and updates game state", () => {
    const { result, unmount } = renderHook(() => useSocket())

    expect(socketClientMock.connect).toHaveBeenCalled()

    act(() => {
      eventBus.emit("game_state", {
        gameId: "g1",
        players: [],
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
        gamePhase: "playing",
      })
    })

    expect(result.current.gameState?.gameId).toBe("g1")

    unmount()
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  test("reconnects on unexpected disconnect", () => {
    jest.useFakeTimers()
    renderHook(() => useSocket())

    act(() => {
      eventBus.emit("disconnect", "transport close")
    })

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(socketClientMock.connect.mock.calls.length).toBeGreaterThanOrEqual(2)
    jest.useRealTimers()
  })

  test("manual reconnect triggers new connection", () => {
    const { result } = renderHook(() => useSocket())

    act(() => {
      result.current.manualReconnect()
    })

    expect(socketClientMock.connect.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
