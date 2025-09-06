import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import CreateRoomPage from "../page"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}))

const mockPush = jest.fn()
;(useRouter as jest.Mock).mockReturnValue({ push: mockPush, back: jest.fn() })

describe("CreateRoomPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // @ts-expect-error test override
    global.fetch = jest.fn()
  })

  it("shows login required when unauthenticated", () => {
    ;(useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false })
    render(<CreateRoomPage />)
    expect(screen.getByText("ログインが必要です")).toBeInTheDocument()
  })

  it("updates uma preset when button clicked", () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: { name: "Tester" },
      refreshAuth: jest.fn(),
    })

    render(<CreateRoomPage />)
    fireEvent.click(screen.getByText("ゴットー"))
    const inputs = screen.getAllByRole("spinbutton")
    expect(inputs[0]).toHaveValue(10)
    expect(inputs[1]).toHaveValue(5)
    expect(inputs[2]).toHaveValue(-5)
    expect(inputs[3]).toHaveValue(-10)
  })

  it("submits and navigates on success", async () => {
    const refreshAuth = jest.fn()
    ;(useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: { name: "Tester" },
      refreshAuth,
    })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { roomCode: "ABC123" } }),
    })

    render(<CreateRoomPage />)
    fireEvent.click(screen.getByRole("button", { name: "ルーム作成" }))

    await waitFor(() => {
      expect(refreshAuth).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith("/room/ABC123")
    })
  })

  it("shows error when API fails", async () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: { name: "Tester" },
      refreshAuth: jest.fn(),
    })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "ルーム作成に失敗しました" } }),
    })

    render(<CreateRoomPage />)
    fireEvent.click(screen.getByRole("button", { name: "ルーム作成" }))

    await waitFor(() =>
      expect(screen.getByText("ルーム作成に失敗しました")).toBeInTheDocument()
    )
  })
})
