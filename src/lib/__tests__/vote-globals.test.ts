import { initializeVoteGlobals, getIO } from "../vote-globals"
import { Server } from "socket.io"

describe("vote-globals", () => {
  beforeEach(() => {
    delete global.gameVotes
    delete global.voteStartTimes
    delete process.__socketio
  })

  test("initializeVoteGlobals sets globals", () => {
    initializeVoteGlobals()
    expect(global.gameVotes).toEqual({})
    expect(global.voteStartTimes).toEqual({})
  })

  test("getIO returns SocketIOServer if set", () => {
    const server = new Server()
    process.__socketio = server as any
    expect(getIO()).toBe(server)
  })

  test("getIO returns null if not set", () => {
    expect(getIO()).toBeNull()
  })
})
