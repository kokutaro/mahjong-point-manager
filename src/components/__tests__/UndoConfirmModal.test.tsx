import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MantineProvider } from "@mantine/core"
import UndoConfirmModal from "../UndoConfirmModal"

// Test wrapper with Mantine provider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>
}

const mockGameState = {
  gameId: "test-game-id",
  players: [
    {
      playerId: "player1",
      name: "東家プレイヤー",
      position: 1,
      points: 27000,
      isReach: true,
      isConnected: true,
    },
    {
      playerId: "player2",
      name: "南家プレイヤー",
      position: 2,
      points: 23000,
      isReach: false,
      isConnected: true,
    },
    {
      playerId: "player3",
      name: "西家プレイヤー",
      position: 3,
      points: 25000,
      isReach: false,
      isConnected: true,
    },
    {
      playerId: "player4",
      name: "北家プレイヤー",
      position: 4,
      points: 25000,
      isReach: false,
      isConnected: true,
    },
  ],
  currentRound: 5, // 南1局
  currentOya: 2, // 南家が親
  honba: 2,
  kyotaku: 1,
  gamePhase: "playing" as const,
}

describe("UndoConfirmModal", () => {
  const mockOnConfirm = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    mockOnConfirm.mockClear()
    mockOnCancel.mockClear()
  })

  it("モーダルが正しく表示される", () => {
    render(
      <TestWrapper>
        <UndoConfirmModal
          opened={true}
          gameState={mockGameState}
          gameType="HANCHAN"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    )

    expect(screen.getByText("Undo確認")).toBeInTheDocument()
    expect(screen.getByText("重要な操作です")).toBeInTheDocument()
    expect(screen.getByText("1つ前の局に戻り")).toBeInTheDocument()
  })

  it("現在の局情報が正しく表示される", () => {
    render(
      <TestWrapper>
        <UndoConfirmModal
          opened={true}
          gameState={mockGameState}
          gameType="HANCHAN"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    )

    // 現在の状況セクションが表示される
    expect(screen.getByText("現在の状況")).toBeInTheDocument()
    expect(screen.getByText("南一局")).toBeInTheDocument()
    expect(screen.getByText("2本場")).toBeInTheDocument()
    expect(screen.getByText("1本")).toBeInTheDocument()
  })

  it("リーチプレイヤーが表示される", () => {
    render(
      <TestWrapper>
        <UndoConfirmModal
          opened={true}
          gameState={mockGameState}
          gameType="HANCHAN"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    )

    expect(screen.getByText("リーチ宣言中のプレイヤー")).toBeInTheDocument()
    expect(screen.getByText("東家プレイヤー")).toBeInTheDocument()
  })

  it("確認ボタンクリック時にonConfirmが呼ばれる", async () => {
    render(
      <TestWrapper>
        <UndoConfirmModal
          opened={true}
          gameState={mockGameState}
          gameType="HANCHAN"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    )

    const confirmButton = screen.getByRole("button", { name: "Undoを実行" })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    })
  })

  it("キャンセルボタンクリック時にonCancelが呼ばれる", () => {
    render(
      <TestWrapper>
        <UndoConfirmModal
          opened={true}
          gameState={mockGameState}
          gameType="HANCHAN"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    )

    const cancelButton = screen.getByRole("button", { name: "キャンセル" })
    fireEvent.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalledTimes(1)
  })

  it("エラーメッセージが表示される", () => {
    const errorMessage = "Undo操作に失敗しました"

    render(
      <TestWrapper>
        <UndoConfirmModal
          opened={true}
          gameState={mockGameState}
          gameType="HANCHAN"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          error={errorMessage}
        />
      </TestWrapper>
    )

    expect(screen.getByText("エラー")).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it("ローディング中にボタンが無効化される", () => {
    render(
      <TestWrapper>
        <UndoConfirmModal
          opened={true}
          gameState={mockGameState}
          gameType="HANCHAN"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      </TestWrapper>
    )

    const confirmButton = screen.getByRole("button", { name: "Undoを実行" })
    const cancelButton = screen.getByRole("button", { name: "キャンセル" })

    expect(confirmButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
  })

  it("東4局でオーラス表示される", () => {
    const oorasuGameState = {
      ...mockGameState,
      currentRound: 4, // 東4局
      currentOya: 4, // 北家が親
    }

    render(
      <TestWrapper>
        <UndoConfirmModal
          opened={true}
          gameState={oorasuGameState}
          gameType="TONPUU"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    )

    expect(screen.getByText("東四局")).toBeInTheDocument()
    expect(screen.getByText("オーラス")).toBeInTheDocument()
  })

  it("モーダルが閉じている場合は表示されない", () => {
    render(
      <TestWrapper>
        <UndoConfirmModal
          opened={false}
          gameState={mockGameState}
          gameType="HANCHAN"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    )

    expect(screen.queryByText("Undo確認")).not.toBeInTheDocument()
  })
})
