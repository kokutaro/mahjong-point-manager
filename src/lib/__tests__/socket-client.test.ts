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
})
