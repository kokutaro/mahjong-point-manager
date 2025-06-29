import { AuthFallback, fetchWithAuth } from "../auth-fallback"

function createSession() {
  return { playerId: "p1", sessionToken: "t1", expiresAt: Date.now() + 10000 }
}

describe("AuthFallback", () => {
  beforeEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  test("setSession and getSession", () => {
    const session = createSession()
    AuthFallback.setSession(session)
    const stored = JSON.parse(localStorage.getItem("mahjong_session")!)
    expect(stored.playerId).toBe("p1")
    const result = AuthFallback.getSession()
    expect(result?.playerId).toBe("p1")
  })

  test("expired session returns null", () => {
    const session = {
      playerId: "p1",
      sessionToken: "t1",
      expiresAt: Date.now() - 1000,
    }
    AuthFallback.setSession(session)
    expect(AuthFallback.getSession()).toBeNull()
  })

  test("clearSession removes data", () => {
    AuthFallback.setSession(createSession())
    AuthFallback.clearSession()
    expect(localStorage.getItem("mahjong_session")).toBeNull()
  })

  test("isSessionValid reflects session existence", () => {
    AuthFallback.setSession(createSession())
    expect(AuthFallback.isSessionValid()).toBe(true)
    AuthFallback.clearSession()
    expect(AuthFallback.isSessionValid()).toBe(false)
  })

  test("getAuthHeaders returns headers when session exists", () => {
    AuthFallback.setSession(createSession())
    expect(AuthFallback.getAuthHeaders()).toEqual({
      "X-Session-Token": "t1",
      "X-Player-Id": "p1",
    })
    AuthFallback.clearSession()
    expect(AuthFallback.getAuthHeaders()).toEqual({})
  })

  test("fetchWithAuth adds auth headers", async () => {
    AuthFallback.setSession(createSession())
    const fetchSpy = jest.fn().mockResolvedValue(new Response("ok"))
    global.fetch = fetchSpy as any
    jest.spyOn(AuthFallback, "getBrowserInfo").mockReturnValue({
      isSafari: true,
      isMobile: false,
      isIOS: false,
      cookieSupported: false,
    })

    await fetchWithAuth("https://example.com/api", {
      method: "GET",
      headers: { Foo: "bar" },
    })

    expect(fetchSpy).toHaveBeenCalled()
    const [, options] = fetchSpy.mock.calls[0]
    expect(options.headers).toEqual({
      Foo: "bar",
      "X-Session-Token": "t1",
      "X-Player-Id": "p1",
    })
    expect(options.credentials).toBe("include")
  })
})
