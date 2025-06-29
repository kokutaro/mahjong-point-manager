import { render, screen, fireEvent } from "@testing-library/react"
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
})
