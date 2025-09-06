import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import WebSocketDebug, { useWebSocketDebug } from "@/components/WebSocketDebug"

// AuthFallback をモック
jest.mock("@/lib/auth-fallback", () => ({
  AuthFallback: {
    getBrowserInfo: () => ({
      isSafari: false,
      isMobile: false,
      isIOS: false,
      cookieSupported: true,
    }),
    getSession: () => ({
      playerId: "p1",
      sessionToken: "tok",
      expiresAt: Date.now() + 1000,
    }),
  },
}))

describe("WebSocketDebug component", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch as typeof fetch
  })

  test("show=false の場合は何も表示しない", () => {
    const { container } = render(<WebSocketDebug show={false} />)
    expect(container.firstChild).toBeNull()
  })

  test("show=true で初期フェッチ成功時に情報を表示する", async () => {
    const mockResponse = {
      success: true,
      status: {
        websocketInitialized: true,
        environment: "test",
        timestamp: new Date().toISOString(),
        socketioVersion: "4.x",
        serverInfo: {
          hostname: "localhost",
          port: "3000",
          nextauthUrl: "http://localhost:3000",
        },
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          userAgent: "jest",
          upgrade: "websocket",
          connection: "upgrade",
        },
      },
    }

    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    }) as unknown as typeof fetch

    render(<WebSocketDebug show={true} />)

    // ステータス情報が描画されるまで待機
    expect(await screen.findByText(/Environment:/)).toBeInTheDocument()
    // ボタンの存在（ローディング解除後）
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument()
  })

  test("更新ボタンで再フェッチし、エラー表示も行われる", async () => {
    const successOnce = {
      success: true,
      status: {
        websocketInitialized: false,
        environment: "test",
        timestamp: new Date().toISOString(),
        socketioVersion: "Not Available",
        serverInfo: {
          hostname: "localhost",
          port: "3000",
          nextauthUrl: undefined,
        },
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          userAgent: "jest",
          upgrade: "",
          connection: "",
        },
      },
    }

    const error = new Error("Network error")

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(successOnce) })
      .mockRejectedValueOnce(error)

    global.fetch = fetchMock as unknown as typeof fetch

    render(<WebSocketDebug show={true} />)

    // 初期フェッチが完了してボタンが「更新」に戻るのを待つ
    await screen.findByRole("button", { name: "更新" })
    // 更新をクリックするとローディング→エラー表示
    fireEvent.click(screen.getByRole("button", { name: "更新" }))

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument()
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("useWebSocketDebug hook", () => {
  function HookProbe() {
    const { showDebug } = useWebSocketDebug()
    return <div data-visible={showDebug ? "1" : "0"}>probe</div>
  }

  test("Ctrl+Shift+W でトグルする", async () => {
    render(<HookProbe />)
    const probe = screen.getByText("probe")
    // 初期は非表示
    expect(probe).toHaveAttribute("data-visible", "0")

    // 押下で true
    const evt = new KeyboardEvent("keydown", {
      key: "W",
      ctrlKey: true,
      shiftKey: true,
    })
    window.dispatchEvent(evt)
    await waitFor(() => expect(probe).toHaveAttribute("data-visible", "1"))

    // もう一度で false
    window.dispatchEvent(evt)
    await waitFor(() => expect(probe).toHaveAttribute("data-visible", "0"))
  })
})
