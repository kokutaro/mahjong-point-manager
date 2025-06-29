import { render, screen, fireEvent } from "@testing-library/react"
import VotingProgress, { VoteState } from "../VotingProgress"

// モックプレイヤーデータ
const mockPlayers = [
  {
    playerId: "player1",
    name: "テストプレイヤー1",
    finalPoints: 35000,
    rank: 1,
    uma: 3000,
    settlement: 8000,
  },
  {
    playerId: "player2",
    name: "テストプレイヤー2",
    finalPoints: 28000,
    rank: 2,
    uma: 1000,
    settlement: -2000,
  },
  {
    playerId: "player3",
    name: "テストプレイヤー3",
    finalPoints: 22000,
    rank: 3,
    uma: -1000,
    settlement: -3000,
  },
  {
    playerId: "player4",
    name: "テストプレイヤー4",
    finalPoints: 15000,
    rank: 4,
    uma: -3000,
    settlement: -3000,
  },
]

const mockCurrentUser = {
  playerId: "player1",
  name: "テストプレイヤー1",
}

describe("VotingProgress", () => {
  const mockOnCancelVote = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("投票が進行中の状態が正しく表示される", () => {
    const votes: VoteState = {
      player1: "continue",
      player2: "end",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
      />
    )

    expect(screen.getByText("全員の投票を待っています...")).toBeInTheDocument()
    expect(screen.getByText("投票状況: 2/4人")).toBeInTheDocument()
  })

  test("各投票選択肢が正しく表示される", () => {
    const votes: VoteState = {
      player1: "continue",
      player2: "end",
      player3: "pause",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
      />
    )

    // 複数の同じアイコンが存在する可能性があるので getAllByText を使用
    expect(screen.getAllByText("🔄").length).toBeGreaterThan(0)
    expect(screen.getAllByText("継続").length).toBeGreaterThan(0)
    expect(screen.getAllByText("✋").length).toBeGreaterThan(0)
    expect(screen.getAllByText("終了").length).toBeGreaterThan(0)
    expect(screen.getAllByText("⏸️").length).toBeGreaterThan(0)
    expect(screen.getAllByText("保留").length).toBeGreaterThan(0)
    expect(screen.getAllByText("⏳").length).toBeGreaterThan(0)
    expect(screen.getAllByText("投票中").length).toBeGreaterThan(0)
  })

  test("投票集計が正しく表示される", () => {
    const votes: VoteState = {
      player1: "continue",
      player2: "end",
      player3: "end",
      player4: "pause",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
      />
    )

    expect(
      screen.getByText("1票", { selector: ".text-green-600" })
    ).toBeInTheDocument() // 継続
    expect(
      screen.getByText("2票", { selector: ".text-red-600" })
    ).toBeInTheDocument() // 終了
    expect(
      screen.getByText("1票", { selector: ".text-yellow-600" })
    ).toBeInTheDocument() // 保留
  })

  test("現在のユーザーに「あなた」バッジが表示される", () => {
    const votes: VoteState = {
      player1: "continue",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
      />
    )

    expect(screen.getByText("あなた")).toBeInTheDocument()
  })

  test("投票をキャンセルできる", () => {
    const votes: VoteState = {
      player1: "continue",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
      />
    )

    const cancelButton = screen.getByText("投票を取り消す")
    fireEvent.click(cancelButton)

    expect(mockOnCancelVote).toHaveBeenCalledTimes(1)
  })

  test("自分が投票していない場合、キャンセルボタンが表示されない", () => {
    const votes: VoteState = {
      player2: "end",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
      />
    )

    expect(screen.queryByText("投票を取り消す")).not.toBeInTheDocument()
  })

  test("全員終了投票時の判定結果が表示される", () => {
    const votes: VoteState = {
      player1: "end",
      player2: "end",
      player3: "end",
      player4: "end",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
      />
    )

    expect(
      screen.getByText("✅ 全員がセッション終了に合意しました")
    ).toBeInTheDocument()
  })

  test("継続投票がある場合の判定結果が表示される", () => {
    const votes: VoteState = {
      player1: "continue",
      player2: "end",
      player3: "end",
      player4: "end",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
      />
    )

    expect(screen.getByText("🔄 1名が継続を希望しています")).toBeInTheDocument()
  })

  test("全員保留時の判定結果が表示される", () => {
    const votes: VoteState = {
      player1: "pause",
      player2: "pause",
      player3: "pause",
      player4: "pause",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
      />
    )

    expect(screen.getByText("⏸️ 全員が保留を選択しました")).toBeInTheDocument()
  })

  test("残り時間が正しく表示される", () => {
    const votes: VoteState = {
      player1: "continue",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
        timeRemaining={150} // 2分30秒
      />
    )

    expect(screen.getByText("⏰ 残り時間: 2:30")).toBeInTheDocument()
  })

  test("時間切れ時は残り時間が表示されない", () => {
    const votes: VoteState = {
      player1: "continue",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
        timeRemaining={0}
      />
    )

    expect(screen.queryByText(/残り時間/)).not.toBeInTheDocument()
  })

  test("投票説明が表示される", () => {
    const votes: VoteState = {}

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={mockCurrentUser}
        onCancelVote={mockOnCancelVote}
      />
    )

    expect(screen.getByText("投票説明:")).toBeInTheDocument()
    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "• 継続: セッションを続ける"
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "• 終了: セッションを終了する"
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "• 保留: 他の人の判断を待つ"
      })
    ).toBeInTheDocument()
  })

  test("currentUserがnullの場合でも正常に動作する", () => {
    const votes: VoteState = {
      player1: "continue",
    }

    render(
      <VotingProgress
        votes={votes}
        players={mockPlayers}
        currentUser={null}
        onCancelVote={mockOnCancelVote}
      />
    )

    expect(screen.queryByText("あなた")).not.toBeInTheDocument()
    expect(screen.queryByText("投票を取り消す")).not.toBeInTheDocument()
  })
})
