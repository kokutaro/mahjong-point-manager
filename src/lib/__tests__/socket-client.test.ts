import { socketClient } from "../socket-client"
import { io as ioClient } from "socket.io-client"
import { EventEmitter } from "events"

jest.mock("socket.io-client", () => ({
  io: jest.fn(),
}))

const mockedIo = ioClient as jest.Mock

function createMockSocket() {
  const emitter = new EventEmitter() as any
  emitter.connected = false
  emitter.emit = jest.fn(emitter.emit.bind(emitter))
  emitter.on = jest.fn(emitter.on.bind(emitter))
  emitter.off = jest.fn()
  emitter.disconnect = jest.fn()
  emitter.id = "sock1"
  return emitter
}

describe("SocketClient", () => {
  let mockSocket: any

  beforeEach(() => {
    mockSocket = createMockSocket()
    mockedIo.mockReturnValue(mockSocket)
    socketClient.disconnect()
    jest.clearAllMocks()
  })

  test("connects using provided url", () => {
    const socket = socketClient.connect("http://test")
    expect(socket).toBe(mockSocket)
    expect(mockedIo).toHaveBeenCalledWith("http://test", expect.any(Object))
  })

  test("reuses existing connection when already connected", () => {
    mockSocket.connected = true
    socketClient.connect("http://first")
    mockedIo.mockClear()
    const socket = socketClient.connect("http://second")
    expect(socket).toBe(mockSocket)
    expect(mockedIo).not.toHaveBeenCalled()
  })

  test("disconnect closes socket and clears instance", () => {
    socketClient.connect("http://test")
    socketClient.disconnect()
    expect(mockSocket.disconnect).toHaveBeenCalled()
    expect(socketClient.getSocket()).toBeNull()
  })

  test("joinRoom emits correct event", () => {
    socketClient.connect("http://test")
    socketClient.joinRoom("ROOM1", "P1")
    expect(mockSocket.emit).toHaveBeenCalledWith("join_room", {
      roomCode: "ROOM1",
      playerId: "P1",
    })
  })

  test("on/off game state listener", () => {
    socketClient.connect("http://test")
    const cb = jest.fn()
    socketClient.onGameState(cb)
    expect(mockSocket.on).toHaveBeenCalledWith("game_state", cb)
    socketClient.offGameState(cb)
    expect(mockSocket.off).toHaveBeenCalledWith("game_state", cb)
  })

  test("getSocket returns instance", () => {
    socketClient.connect("http://test")
    expect(socketClient.getSocket()).toBe(mockSocket)
  })

  test("emitters for actions", () => {
    socketClient.connect("http://test")
    socketClient.setReady("g1", "p1")
    socketClient.calculateScore({
      gameId: "g1",
      winnerId: "p1",
      han: 1,
      fu: 30,
      isTsumo: true,
    })
    socketClient.declareReach("g1", "p1")
    socketClient.declareRyukyoku("g1", "r", ["p1"])
    expect(mockSocket.emit).toHaveBeenCalledWith("player_ready", {
      gameId: "g1",
      playerId: "p1",
    })
    expect(mockSocket.emit).toHaveBeenCalledWith("calculate_score", {
      gameId: "g1",
      winnerId: "p1",
      han: 1,
      fu: 30,
      isTsumo: true,
    })
    expect(mockSocket.emit).toHaveBeenCalledWith("declare_reach", {
      gameId: "g1",
      playerId: "p1",
    })
    expect(mockSocket.emit).toHaveBeenCalledWith("ryukyoku", {
      gameId: "g1",
      reason: "r",
      tenpaiPlayers: ["p1"],
    })
  })

  test("on/off other listeners", () => {
    socketClient.connect("http://test")
    const cb = jest.fn()
    socketClient.onPlayerJoined(cb)
    socketClient.onPlayerConnected(cb)
    socketClient.onGameStart(cb)
    socketClient.onScoreUpdated(cb)
    socketClient.onRiichiDeclared(cb)
    socketClient.onRyukyoku(cb)
    socketClient.onSeatOrderUpdated(cb)
    socketClient.onError(cb)

    expect(mockSocket.on).toHaveBeenCalledWith("player_joined", cb)
    expect(mockSocket.on).toHaveBeenCalledWith("player_connected", cb)
    expect(mockSocket.on).toHaveBeenCalledWith("game_start", cb)
    expect(mockSocket.on).toHaveBeenCalledWith("game_started", cb)
    expect(mockSocket.on).toHaveBeenCalledWith("score_updated", cb)
    expect(mockSocket.on).toHaveBeenCalledWith("riichi_declared", cb)
    expect(mockSocket.on).toHaveBeenCalledWith("ryukyoku", cb)
    expect(mockSocket.on).toHaveBeenCalledWith("seat_order_updated", cb)
    expect(mockSocket.on).toHaveBeenCalledWith("error", cb)

    socketClient.offPlayerJoined(cb)
    socketClient.offPlayerConnected(cb)
    socketClient.offGameStart(cb)
    socketClient.offScoreUpdated(cb)
    socketClient.offRiichiDeclared(cb)
    socketClient.offRyukyoku(cb)
    socketClient.offSeatOrderUpdated(cb)
    socketClient.offError(cb)
    expect(mockSocket.off).toHaveBeenCalledWith("player_joined", cb)
    expect(mockSocket.off).toHaveBeenCalledWith("player_connected", cb)
    expect(mockSocket.off).toHaveBeenCalledWith("game_start", cb)
    expect(mockSocket.off).toHaveBeenCalledWith("game_started", cb)
    expect(mockSocket.off).toHaveBeenCalledWith("score_updated", cb)
    expect(mockSocket.off).toHaveBeenCalledWith("riichi_declared", cb)
    expect(mockSocket.off).toHaveBeenCalledWith("ryukyoku", cb)
    expect(mockSocket.off).toHaveBeenCalledWith("seat_order_updated", cb)
    expect(mockSocket.off).toHaveBeenCalledWith("error", cb)
  })
})
