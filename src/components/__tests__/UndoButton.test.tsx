import { render, screen, fireEvent } from "@testing-library/react"
import { MantineProvider } from "@mantine/core"
import UndoButton from "../UndoButton"

// Test wrapper with Mantine provider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>
}

const mockGameState = {
  gameId: "test-game-id",
  players: [
    {
      playerId: "host-player",
      name: "ホストプレイヤー",
      position: 1,
      points: 25000,
      isReach: false,
      isConnected: true,
    },
    {
      playerId: "player2",
      name: "プレイヤー2",
      position: 2,
      points: 25000,
      isReach: false,
      isConnected: true,
    },
    {
      playerId: "player3",
      name: "プレイヤー3",
      position: 3,
      points: 25000,
      isReach: false,
      isConnected: true,
    },
    {
      playerId: "player4",
      name: "プレイヤー4",
      position: 4,
      points: 25000,
      isReach: false,
      isConnected: true,
    },
  ],
  currentRound: 2,
  currentOya: 1,
  honba: 1,
  kyotaku: 0,
  gamePhase: "playing" as const,
}

describe("UndoButton", () => {
  const mockOnUndoClick = jest.fn()

  beforeEach(() => {
    mockOnUndoClick.mockClear()
  })

  it("ホストプレイヤーでゲーム進行中の場合にUndoボタンを表示する", () => {
    render(
      <TestWrapper>
        <UndoButton
          gameState={mockGameState}
          hostPlayerId="host-player"
          currentPlayerId="host-player"
          onUndoClick={mockOnUndoClick}
        />
      </TestWrapper>
    )

    const undoButton = screen.getByRole("button", {
      name: "1つ前の局に戻る",
    })
    expect(undoButton).toBeInTheDocument()
    expect(undoButton).toHaveTextContent("Undo")
  })

  it("ホストでないプレイヤーの場合にUndoボタンを表示しない", () => {
    render(
      <TestWrapper>
        <UndoButton
          gameState={mockGameState}
          hostPlayerId="host-player"
          currentPlayerId="player2"
          onUndoClick={mockOnUndoClick}
        />
      </TestWrapper>
    )

    const undoButton = screen.queryByRole("button", {
      name: "1つ前の局に戻る",
    })
    expect(undoButton).not.toBeInTheDocument()
  })

  it("ゲームが対局中でない場合にUndoボタンを表示しない", () => {
    const waitingGameState = {
      ...mockGameState,
      gamePhase: "waiting" as const,
    }

    render(
      <TestWrapper>
        <UndoButton
          gameState={waitingGameState}
          hostPlayerId="host-player"
          currentPlayerId="host-player"
          onUndoClick={mockOnUndoClick}
        />
      </TestWrapper>
    )

    const undoButton = screen.queryByRole("button", {
      name: "1つ前の局に戻る",
    })
    expect(undoButton).not.toBeInTheDocument()
  })

  it("最初の局（1局0本場）の場合にUndoボタンを無効化する", () => {
    const firstRoundGameState = {
      ...mockGameState,
      currentRound: 1,
      honba: 0,
    }

    render(
      <TestWrapper>
        <UndoButton
          gameState={firstRoundGameState}
          hostPlayerId="host-player"
          currentPlayerId="host-player"
          onUndoClick={mockOnUndoClick}
        />
      </TestWrapper>
    )

    const undoButton = screen.getByRole("button", {
      name: "1つ前の局に戻る",
    })
    expect(undoButton).toBeDisabled()
  })

  it("Undoボタンクリック時にonUndoClickが呼ばれる", () => {
    render(
      <TestWrapper>
        <UndoButton
          gameState={mockGameState}
          hostPlayerId="host-player"
          currentPlayerId="host-player"
          onUndoClick={mockOnUndoClick}
        />
      </TestWrapper>
    )

    const undoButton = screen.getByRole("button", {
      name: "1つ前の局に戻る",
    })
    fireEvent.click(undoButton)

    expect(mockOnUndoClick).toHaveBeenCalledTimes(1)
  })

  it("isLoadingがtrueの場合にボタンが無効化される", () => {
    render(
      <TestWrapper>
        <UndoButton
          gameState={mockGameState}
          hostPlayerId="host-player"
          currentPlayerId="host-player"
          onUndoClick={mockOnUndoClick}
          isLoading={true}
        />
      </TestWrapper>
    )

    const undoButton = screen.getByRole("button", {
      name: "1つ前の局に戻る",
    })
    expect(undoButton).toBeDisabled()
  })
})
