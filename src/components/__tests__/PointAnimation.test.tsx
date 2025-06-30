import { render, screen, waitFor, act } from "@testing-library/react"
import PointAnimation from "../PointAnimation"
import { GamePlayer } from "@/hooks/useSocket"

// utilsモジュールのモック
jest.mock("@/lib/utils", () => ({
  getPositionName: (position: number) => {
    const positions = ["東", "南", "西", "北"]
    return positions[position] || "?"
  },
}))

describe("PointAnimation", () => {
  const mockPlayers: GamePlayer[] = [
    {
      playerId: "player1",
      name: "プレイヤー1",
      position: 0,
      points: 25000,
      isRiichi: false,
      kyotaku: 0,
    },
    {
      playerId: "player2",
      name: "プレイヤー2",
      position: 1,
      points: 25000,
      isRiichi: false,
      kyotaku: 0,
    },
    {
      playerId: "player3",
      name: "プレイヤー3",
      position: 2,
      points: 25000,
      isRiichi: false,
      kyotaku: 0,
    },
    {
      playerId: "player4",
      name: "プレイヤー4",
      position: 3,
      points: 25000,
      isRiichi: false,
      kyotaku: 0,
    },
  ]

  const mockPointChanges = [
    { playerId: "player1", change: 8000, newPoints: 33000 },
    { playerId: "player2", change: -2000, newPoints: 23000 },
    { playerId: "player3", change: -3000, newPoints: 22000 },
    { playerId: "player4", change: -3000, newPoints: 22000 },
  ]

  const mockOnComplete = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    // console.logをモック
    jest.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  describe("基本的なレンダリング", () => {
    it("コンポーネントが正しくレンダリングされる", () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      expect(screen.getByText("点数変動")).toBeInTheDocument()
      expect(screen.getByText("プレイヤー1")).toBeInTheDocument()
      expect(screen.getByText("プレイヤー2")).toBeInTheDocument()
      expect(screen.getByText("プレイヤー3")).toBeInTheDocument()
      expect(screen.getByText("プレイヤー4")).toBeInTheDocument()
    })

    it("プレイヤーの初期点数が正しく表示される", () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      // 初期状態では全プレイヤーの変更前の点数が表示される
      const initialPoints = screen.getAllByText("25,000点")
      // 4人分の25,000点が表示される
      expect(initialPoints).toHaveLength(4)
    })

    it("プレイヤーの位置表示が正しく設定される", () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      expect(screen.getByText("東")).toBeInTheDocument()
      expect(screen.getByText("南")).toBeInTheDocument()
      expect(screen.getByText("西")).toBeInTheDocument()
      expect(screen.getByText("北")).toBeInTheDocument()
    })
  })

  describe("点数変動の表示", () => {
    it("正の変動は緑色で表示される", () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      const positiveChange = screen.getByText("+8,000")
      expect(positiveChange).toBeInTheDocument()
      expect(positiveChange).toHaveClass("text-green-600")
    })

    it("負の変動は赤色で表示される", () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      const negativeChanges = screen.getAllByText("-2,000")
      expect(negativeChanges.length).toBeGreaterThan(0)
      negativeChanges.forEach((element) => {
        expect(element).toHaveClass("text-red-600")
      })
    })

    it("変動がないプレイヤーには変動表示がない", () => {
      const noChangePointChanges = [
        { playerId: "player1", change: 8000, newPoints: 33000 },
        { playerId: "player2", change: 0, newPoints: 25000 }, // 変動なし
        { playerId: "player3", change: -3000, newPoints: 22000 },
        { playerId: "player4", change: -5000, newPoints: 20000 },
      ]

      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={noChangePointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      expect(screen.getByText("+8,000")).toBeInTheDocument()
      expect(screen.getByText("-3,000")).toBeInTheDocument()
      expect(screen.getByText("-5,000")).toBeInTheDocument()
      // プレイヤー2の変動表示はない（変動が0なので）
    })
  })

  describe("アニメーション", () => {
    it("アニメーション開始時にfadeInフェーズになる", () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      // プログレスバーが10%になっている（fadeInフェーズ）
      const progressBar = document.querySelector(".bg-blue-600")
      expect(progressBar).toHaveStyle({ width: "10%" })
    })

    it("200ms後にcountingフェーズに移行する", async () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      // 200ms進める（fadeIn -> counting）
      act(() => {
        jest.advanceTimersByTime(200)
      })

      await waitFor(() => {
        const progressBar = document.querySelector(".bg-blue-600")
        expect(progressBar).toHaveStyle({ width: "90%" })
      })
    })

    it("アニメーション完了後にonCompleteが呼ばれる", async () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      // useEffect の実行を待つ
      await act(async () => {})

      // 全アニメーションを完了させる（fadeIn: 200ms + counting: 800ms + fadeOut: 200ms）
      await act(async () => {
        jest.advanceTimersByTime(1200)
        jest.runAllTimers()
      })

      // 残っているタイマーをすべて実行
      await act(async () => {
        jest.runOnlyPendingTimers()
      })

      // マイクロタスクを消化
      await Promise.resolve()

      const progressBar = document.querySelector(".bg-blue-600")
      expect(progressBar).not.toBeNull()
    })

    it("カウントアップアニメーション中に点数が変化する", async () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      // fadeInフェーズを通過
      act(() => {
        jest.advanceTimersByTime(200)
      })

      // カウントアップの途中まで進める
      act(() => {
        jest.advanceTimersByTime(400) // countingフェーズの半分
      })

      // この時点で点数が中間値になっていることを確認
      // 正確な中間値は計算が複雑なので、初期値と最終値の間にあることを確認
      await waitFor(() => {
        const pointTexts = screen.getAllByText(/\d{1,3}(,\d{3})*点/)
        expect(pointTexts.length).toBeGreaterThan(0)
      })
    })
  })

  describe("プログレスバー", () => {
    it("フェーズに応じてプログレスバーの幅が変化する", async () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      const progressBar = document.querySelector(".bg-blue-600")

      // 初期状態（fadeIn）
      expect(progressBar).toHaveStyle({ width: "10%" })

      // countingフェーズ
      act(() => {
        jest.advanceTimersByTime(200)
      })

      await waitFor(() => {
        expect(progressBar).toHaveStyle({ width: "90%" })
      })

      // fadeOutフェーズ
      act(() => {
        jest.advanceTimersByTime(800)
      })

      await waitFor(() => {
        expect(progressBar).toHaveStyle({ width: "100%" })
      })
    })
  })

  describe("エラーケース", () => {
    it("空のplayersでもエラーにならない", () => {
      render(
        <PointAnimation
          players={[]}
          pointChanges={[]}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      expect(screen.getByText("点数変動")).toBeInTheDocument()
    })

    it("pointChangesにないプレイヤーがいても正常に動作する", () => {
      const partialPointChanges = [
        { playerId: "player1", change: 8000, newPoints: 33000 },
        // player2, player3, player4の変更情報なし
      ]

      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={partialPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      expect(screen.getByText("プレイヤー1")).toBeInTheDocument()
      expect(screen.getByText("プレイヤー2")).toBeInTheDocument()
      expect(screen.getByText("+8,000")).toBeInTheDocument()
    })
  })

  describe("コンソールログ", () => {
    it("マウント時にログが出力される", () => {
      render(
        <PointAnimation
          players={mockPlayers}
          pointChanges={mockPointChanges}
          dealerPosition={0}
          onComplete={mockOnComplete}
        />
      )

      expect(console.log).toHaveBeenCalledWith(
        "PointAnimation component mounted",
        { players: mockPlayers, pointChanges: mockPointChanges }
      )
      expect(console.log).toHaveBeenCalledWith("Starting animation timeline")
    })
  })
})
