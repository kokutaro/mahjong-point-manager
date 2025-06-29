import { renderHook, act } from "@testing-library/react"
import { AuthProvider, useAuth } from "../AuthContext"
import { fetchWithAuth } from "@/lib/auth-fallback"

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
})
