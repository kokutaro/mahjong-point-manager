import { act } from "@testing-library/react"
import { useAppStore } from "../useAppStore"

afterEach(() => {
  act(() => {
    useAppStore.getState().reset()
  })
})

describe("useAppStore", () => {
  test("session setters and clear", () => {
    act(() => {
      useAppStore.getState().setSession({
        id: "s1",
        sessionCode: "ABC",
        hostPlayerId: "p1",
        totalGames: 0,
        createdAt: "2024-01-01",
        status: "ACTIVE",
        name: "test",
      })
      useAppStore.getState().setSessionMode(true)
    })

    expect(useAppStore.getState().currentSession?.id).toBe("s1")
    expect(useAppStore.getState().sessionMode).toBe(true)

    act(() => {
      useAppStore.getState().clearSession()
    })

    expect(useAppStore.getState().currentSession).toBeNull()
    expect(useAppStore.getState().sessionMode).toBe(false)
  })

  test("loading and error handling with reset", () => {
    act(() => {
      useAppStore.getState().setLoading(true)
      useAppStore.getState().setError("bad")
    })
    expect(useAppStore.getState().isLoading).toBe(true)
    expect(useAppStore.getState().error).toBe("bad")

    act(() => {
      useAppStore.getState().clearError()
      useAppStore.getState().setCurrentGame({
        gameId: "g1",
        roomCode: "R",
        status: "WAITING",
        players: [],
      })
    })
    expect(useAppStore.getState().error).toBeNull()
    expect(useAppStore.getState().currentGame?.gameId).toBe("g1")

    act(() => {
      useAppStore.getState().reset()
    })

    const state = useAppStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.currentSession).toBeNull()
    expect(state.currentGame).toBeNull()
  })
})
