import { renderHook, act } from "@testing-library/react"
import { AuthProvider, useAuth } from "../AuthContext"
import { fetchWithAuth, AuthFallback } from "@/lib/auth-fallback"

jest.mock("@/lib/auth-fallback", () => ({
  fetchWithAuth: jest.fn(),
  AuthFallback: {
    getBrowserInfo: jest.fn(() => ({
      cookieSupported: true,
      isSafari: false,
      isMobile: false,
    })),
    getSession: jest.fn(() => null),
    setSession: jest.fn(),
    clearSession: jest.fn(),
  },
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetchWithAuth as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
    global.fetch = jest.fn()
  })

  it("logs in and out", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { playerId: "p1", name: "A", deviceId: "d1", sessionToken: "t" },
      }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login("A", "d1")
    })

    expect(result.current.user?.playerId).toBe("p1")
    expect(result.current.isAuthenticated).toBe(true)
    ;(fetchWithAuth as jest.Mock).mockResolvedValueOnce({ ok: true })

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it("handles refresh failure gracefully", async () => {
    ;(fetchWithAuth as jest.Mock).mockRejectedValueOnce(new Error("bad"))
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.refreshAuth()
    })

    expect(result.current.isLoading).toBe(false)
  })

  it("sets user when existing session is valid", async () => {
    const session = {
      playerId: "p1",
      name: "A",
      deviceId: "d1",
      sessionToken: "t1",
    }

    ;(fetchWithAuth as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: session }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.refreshAuth()
    })

    expect(result.current.user).toMatchObject(session)
    expect(result.current.isAuthenticated).toBe(true)
    expect(AuthFallback.setSession).not.toHaveBeenCalled()
  })

  it("stores fallback session when cookies are unsupported", async () => {
    const session = {
      playerId: "p1",
      name: "A",
      deviceId: "d1",
      sessionToken: "t1",
    }

    const { result } = renderHook(() => useAuth(), { wrapper })

    ;(fetchWithAuth as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: session }),
    })
    ;(AuthFallback.getBrowserInfo as jest.Mock).mockReturnValueOnce({
      cookieSupported: false,
      isSafari: false,
      isMobile: false,
    })

    await act(async () => {
      await result.current.refreshAuth()
    })

    expect(AuthFallback.setSession).toHaveBeenCalledWith({
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      expiresAt: expect.any(Number),
    })
    expect(result.current.user).toMatchObject(session)
  })

  it("clears session on failed response", async () => {
    ;(fetchWithAuth as jest.Mock).mockResolvedValueOnce({ ok: false })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.refreshAuth()
    })

    expect(AuthFallback.clearSession).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })
})
