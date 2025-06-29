import { render, screen } from "@testing-library/react"
import PlayerStatus from "../PlayerStatus"

const mockGameState = {
  gameId: "test-game",
  players: [
    {
      playerId: "player1",
      name: "プレイヤー1",
      position: 0,
      points: 35000,
      isReach: false,
      isConnected: true,
    },
    {
      playerId: "player2",
      name: "プレイヤー2",
      position: 1,
      points: 28000,
      isReach: true,
      isConnected: true,
    },
    {
      playerId: "player3",
      name: "プレイヤー3",
      position: 2,
      points: 22000,
      isReach: false,
      isConnected: false,
    },
    {
      playerId: "player4",
      name: "プレイヤー4",
      position: 3,
      points: 15000,
      isReach: false,
      isConnected: true,
    },
  ],
  currentRound: 5,
  currentOya: 1,
  honba: 2,
  kyotaku: 1,
  gamePhase: "playing" as const,
}

const mockCurrentPlayer = mockGameState.players[0]

describe("PlayerStatus", () => {
  const mockOnReach = jest.fn()
  const mockCanDeclareReach = jest.fn().mockReturnValue(true)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("プレイヤー名が正しく表示される", () => {
    render(
      <PlayerStatus
        gameState={mockGameState}
        currentPlayer={mockCurrentPlayer}
        onReach={mockOnReach}
        canDeclareReach={mockCanDeclareReach}
      />
    )

    // プレイヤー名が表示されていることを確認（レスポンシブで複数回表示される可能性を考慮）
    expect(screen.getAllByText("プレイヤー1").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("プレイヤー2").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("プレイヤー3").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("プレイヤー4").length).toBeGreaterThanOrEqual(1)
  })

  test("点数が正しく表示される", () => {
    render(
      <PlayerStatus
        gameState={mockGameState}
        currentPlayer={mockCurrentPlayer}
        onReach={mockOnReach}
        canDeclareReach={mockCanDeclareReach}
      />
    )

    // 点数がフォーマットされて表示されている（テキストが分割されている可能性を考慮）
    expect(screen.getAllByText(/35,000/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/28,000/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/22,000/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/15,000/).length).toBeGreaterThanOrEqual(1)
  })

  test("風牌が正しく表示される", () => {
    render(
      <PlayerStatus
        gameState={mockGameState}
        currentPlayer={mockCurrentPlayer}
        onReach={mockOnReach}
        canDeclareReach={mockCanDeclareReach}
      />
    )

    // currentOya=1なので、風牌が適切に表示される
    expect(screen.getAllByText("北").length).toBeGreaterThanOrEqual(1) // position 0
    expect(screen.getAllByText("東").length).toBeGreaterThanOrEqual(1) // position 1 (親)
    expect(screen.getAllByText("南").length).toBeGreaterThanOrEqual(1) // position 2
    expect(screen.getAllByText("西").length).toBeGreaterThanOrEqual(1) // position 3
  })

  test("親マークが表示される", () => {
    render(
      <PlayerStatus
        gameState={mockGameState}
        currentPlayer={mockCurrentPlayer}
        onReach={mockOnReach}
        canDeclareReach={mockCanDeclareReach}
      />
    )

    // currentOya=1なので、プレイヤー2が親
    expect(screen.getAllByText("親").length).toBeGreaterThanOrEqual(1)
  })

  test("リーチ状態が表示される", () => {
    render(
      <PlayerStatus
        gameState={mockGameState}
        currentPlayer={mockCurrentPlayer}
        onReach={mockOnReach}
        canDeclareReach={mockCanDeclareReach}
      />
    )

    // プレイヤー2がリーチ状態
    expect(screen.getAllByText("リーチ").length).toBeGreaterThanOrEqual(1)
  })

  test("接続状態インジケーターが表示される", () => {
    render(
      <PlayerStatus
        gameState={mockGameState}
        currentPlayer={mockCurrentPlayer}
        onReach={mockOnReach}
        canDeclareReach={mockCanDeclareReach}
      />
    )

    // 接続状態に関連する要素が表示されている（オンライン状態の緑の丸など）
    // プレイヤー1は接続中なので緑の丸が表示される
    const connectedIndicators = document.querySelectorAll(".bg-green-400")
    expect(connectedIndicators.length).toBeGreaterThan(0)
  })

  test("順位が表示される", () => {
    render(
      <PlayerStatus
        gameState={mockGameState}
        currentPlayer={mockCurrentPlayer}
        onReach={mockOnReach}
        canDeclareReach={mockCanDeclareReach}
      />
    )

    // 順位が表示されている
    expect(screen.getAllByText("1位").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("2位").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("3位").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("4位").length).toBeGreaterThanOrEqual(1)
  })

  test("現在のプレイヤーマークが表示される", () => {
    render(
      <PlayerStatus
        gameState={mockGameState}
        currentPlayer={mockCurrentPlayer}
        onReach={mockOnReach}
        canDeclareReach={mockCanDeclareReach}
      />
    )

    // "あなた"マークが表示されている
    expect(screen.getAllByText("あなた").length).toBeGreaterThanOrEqual(1)
  })

  test("プレイヤーの基本情報が全て表示される", () => {
    render(
      <PlayerStatus
        gameState={mockGameState}
        currentPlayer={mockCurrentPlayer}
        onReach={mockOnReach}
        canDeclareReach={mockCanDeclareReach}
      />
    )

    // ページタイトル
    expect(screen.getByText("プレイヤー状態")).toBeInTheDocument()

    // 各プレイヤーの基本情報が表示されていることを検証
    const playerNames = [
      "プレイヤー1",
      "プレイヤー2",
      "プレイヤー3",
      "プレイヤー4",
    ]
    const points = [/35,000/, /28,000/, /22,000/, /15,000/]

    playerNames.forEach((name) => {
      expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1)
    })

    points.forEach((point) => {
      expect(screen.getAllByText(point).length).toBeGreaterThanOrEqual(1)
    })
  })
})
