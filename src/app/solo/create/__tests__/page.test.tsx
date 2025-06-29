import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import SoloCreatePage from "@/app/solo/create/page"
import { useRouter } from "next/navigation"

// next/navigation のモック
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

// fetch のモック
global.fetch = jest.fn()

describe("SoloCreatePage", () => {
  const mockPush = jest.fn()
  ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })

  beforeEach(() => {
    ;(fetch as jest.Mock).mockClear()
    mockPush.mockClear()
  })

  it("should render the form correctly", () => {
    render(<SoloCreatePage />)
    expect(screen.getByText("一人プレイゲーム作成")).toBeInTheDocument()
    expect(screen.getByText("ゲームタイプ")).toBeInTheDocument()
    expect(screen.getByLabelText("初期点数")).toBeInTheDocument()
    expect(screen.getByLabelText("返し点（基準点）")).toBeInTheDocument()
    expect(screen.getByText("ウマ設定")).toBeInTheDocument()
  })

  it("should update uma values when a preset is clicked", () => {
    render(<SoloCreatePage />)
    fireEvent.click(screen.getByText("ワンスリー"))

    const umaInputs = screen.getAllByRole("spinbutton")
    expect(umaInputs[0]).toHaveValue(30)
    expect(umaInputs[1]).toHaveValue(10)
    expect(umaInputs[2]).toHaveValue(-10)
    expect(umaInputs[3]).toHaveValue(-30)
  })

  it("should switch to custom preset when uma is changed manually", () => {
    render(<SoloCreatePage />)
    fireEvent.click(screen.getByText("ワンツー")) // 初期プリセット

    const firstUmaInput = screen.getAllByRole("spinbutton")[0]
    fireEvent.change(firstUmaInput, { target: { value: "25" } })

    expect(screen.getByText("カスタム").parentElement).toHaveClass(
      "border-orange-500"
    )
  })

  it("should call create game API and redirect on success", async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { gameId: "test-game-123" } }),
    })

    render(<SoloCreatePage />)
    fireEvent.click(screen.getByText("ゲーム開始"))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/solo/create", expect.any(Object))
    )
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/solo/game/test-game-123")
    )
  })

  it("should show an error message if player names are duplicated", async () => {
    render(<SoloCreatePage />)
    const playerInputs = screen.getAllByPlaceholderText(/家$/)
    fireEvent.change(playerInputs[0], { target: { value: "同じ名前" } })
    fireEvent.change(playerInputs[1], { target: { value: "同じ名前" } })

    fireEvent.click(screen.getByText("ゲーム開始"))

    await waitFor(() => {
      expect(
        screen.getByText("プレイヤー名が重複しています")
      ).toBeInTheDocument()
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
