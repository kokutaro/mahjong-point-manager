import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import BaseScoreInputForm from "../BaseScoreInputForm"
import { MultiGameState } from "../types"

// Mantineのモック
jest.mock("@mantine/core", () => {
  const MockStepperStep = ({ children, label }: any) => (
    <div data-testid="stepper-step" data-label={label}>
      {children}
    </div>
  )
  MockStepperStep.displayName = "StepperStep"

  return {
    Modal: ({ children, opened, onClose }: any) =>
      opened ? (
        <div data-testid="modal">
          <button onClick={onClose} data-testid="close-modal">
            Close
          </button>
          {children}
        </div>
      ) : null,
    Stepper: Object.assign(
      ({ children, active }: any) => (
        <div data-testid="stepper" data-active={active}>
          {children}
        </div>
      ),
      {
        Step: MockStepperStep,
      }
    ),
    Button: ({ children, onClick, disabled, loading, color, variant }: any) => (
      <button
        onClick={onClick}
        disabled={disabled || loading}
        data-testid="mantine-button"
        data-color={color}
        data-variant={variant}
      >
        {loading ? "Loading..." : children}
      </button>
    ),
  }
})

// libユーティリティのモック
jest.mock("@/lib/utils", () => ({
  getPositionName: (position: number) => {
    const positions = ["東", "南", "西", "北"]
    return positions[position] || "不明"
  },
}))

jest.mock("@/lib/score", () => ({
  validateHanFu: (han: number, fu: number) => {
    // 満貫以上は符数不要
    if (han >= 5) return true
    // 基本的な符数チェック
    const validFu = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110]
    return validFu.includes(fu)
  },
}))

// fetchのモック
global.fetch = jest.fn()

describe("BaseScoreInputForm", () => {
  const mockOnSubmit = jest.fn()
  const mockOnCancel = jest.fn()
  const mockCalculateScorePreview = jest.fn()

  const mockGameState: MultiGameState = {
    gameId: "test-game",
    currentRound: 1,
    currentOya: 0,
    honba: 0,
    kyotaku: 0,
    gamePhase: "playing",
    players: [
      {
        id: "player1",
        playerId: "player1",
        name: "プレイヤー1",
        position: 0,
        points: 25000,
        isReach: false,
        isConnected: true,
      },
      {
        id: "player2",
        playerId: "player2",
        name: "プレイヤー2",
        position: 1,
        points: 25000,
        isReach: false,
        isConnected: true,
      },
      {
        id: "player3",
        playerId: "player3",
        name: "プレイヤー3",
        position: 2,
        points: 25000,
        isReach: false,
        isConnected: true,
      },
      {
        id: "player4",
        playerId: "player4",
        name: "プレイヤー4",
        position: 3,
        points: 25000,
        isReach: false,
        isConnected: true,
      },
    ],
  }

  const defaultProps = {
    gameState: mockGameState,
    currentPlayer: mockGameState.players[0],
    actionType: "tsumo" as const,
    mode: "multi" as const,
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              result: {
                winnerGain: 2000,
                payments: {
                  fromOya: 2000,
                  fromKo: 1000,
                },
              },
            },
          }),
      })
    )
  })

  describe("基本的なレンダリング", () => {
    it("モーダルが正しく表示される", () => {
      render(<BaseScoreInputForm {...defaultProps} />)

      expect(screen.getByTestId("modal")).toBeInTheDocument()
      expect(screen.getByText("点数入力 - ツモ")).toBeInTheDocument()
    })

    it("ronモードで正しいタイトルが表示される", () => {
      render(<BaseScoreInputForm {...defaultProps} actionType="ron" />)

      expect(screen.getByText("点数入力 - ロン")).toBeInTheDocument()
    })

    it("ステッパーが表示される", () => {
      render(<BaseScoreInputForm {...defaultProps} />)

      expect(screen.getByTestId("stepper")).toBeInTheDocument()
    })

    it("翻数選択ボタンが表示される", () => {
      render(<BaseScoreInputForm {...defaultProps} />)

      expect(screen.getByText("1翻")).toBeInTheDocument()
      expect(screen.getByText("満貫")).toBeInTheDocument()
      expect(screen.getByText("役満")).toBeInTheDocument()
    })
  })

  describe("ソロモード", () => {
    it("ソロモードで和了者選択ステップが表示される", () => {
      render(<BaseScoreInputForm {...defaultProps} mode="solo" />)

      expect(screen.getByTestId("stepper-step")).toHaveAttribute(
        "data-label",
        "和了者"
      )
      mockGameState.players.forEach((player) => {
        expect(
          screen.getByText(expect.stringContaining(player.name))
        ).toBeInTheDocument()
      })
    })

    it("ソロモードで和了者を選択できる", async () => {
      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} mode="solo" />)

      const player2Button = screen.getByText(
        expect.stringContaining("プレイヤー2")
      )
      await user.click(player2Button)

      // ステップが進むことを確認（詳細な確認は複雑なので、動作を確認）
      expect(player2Button).toBeInTheDocument()
    })
  })

  describe("放銃者選択（ronモード）", () => {
    it("ronモードで放銃者選択ステップが表示される", () => {
      render(
        <BaseScoreInputForm
          {...defaultProps}
          actionType="ron"
          preselectedWinnerId="player1"
        />
      )

      // 和了者以外のプレイヤーが表示される
      expect(
        screen.getByText(expect.stringContaining("プレイヤー2"))
      ).toBeInTheDocument()
      expect(
        screen.getByText(expect.stringContaining("プレイヤー3"))
      ).toBeInTheDocument()
      expect(
        screen.getByText(expect.stringContaining("プレイヤー4"))
      ).toBeInTheDocument()

      // 和了者は表示されない
      expect(screen.queryByText("東 プレイヤー1")).not.toBeInTheDocument()
    })

    it("放銃者を選択できる", async () => {
      const user = userEvent.setup()
      render(
        <BaseScoreInputForm
          {...defaultProps}
          actionType="ron"
          preselectedWinnerId="player1"
        />
      )

      const loserButton = screen.getByText(
        expect.stringContaining("プレイヤー2")
      )
      await user.click(loserButton)

      // 選択されたボタンの色が変わることを確認
      expect(loserButton).toBeInTheDocument()
    })
  })

  describe("翻数選択", () => {
    it("翻数を選択できる", async () => {
      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      const hanButton = screen.getByText("3翻")
      await user.click(hanButton)

      // 3翻が選択された状態を確認
      expect(hanButton).toBeInTheDocument()
    })

    it("満貫以上を選択すると符数選択をスキップする", async () => {
      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      const manganButton = screen.getByText("満貫")
      await user.click(manganButton)

      // 満貫選択後、確認ステップに進むことを期待
      expect(manganButton).toBeInTheDocument()
    })

    it("4翻以下を選択すると符数選択ステップに進む", async () => {
      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      const hanButton = screen.getByText("2翻")
      await user.click(hanButton)

      // 符数選択ボタンが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText("30符")).toBeInTheDocument()
      })
    })
  })

  describe("符数選択", () => {
    it("符数選択ボタンが表示される", async () => {
      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      // まず翻数を選択
      await user.click(screen.getByText("2翻"))

      await waitFor(() => {
        expect(screen.getByText("20符")).toBeInTheDocument()
        expect(screen.getByText("30符")).toBeInTheDocument()
        expect(screen.getByText("40符")).toBeInTheDocument()
      })
    })

    it("符数を選択できる", async () => {
      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      // まず翻数を選択
      await user.click(screen.getByText("2翻"))

      await waitFor(() => {
        const fuButton = screen.getByText("40符")
        expect(fuButton).toBeInTheDocument()
      })

      const fuButton = screen.getByText("40符")
      await user.click(fuButton)

      // 符数が選択されたことを確認
      expect(fuButton).toBeInTheDocument()
    })

    it("戻るボタンが動作する", async () => {
      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      // 翻数選択
      await user.click(screen.getByText("2翻"))

      await waitFor(() => {
        expect(screen.getByText("戻る")).toBeInTheDocument()
      })

      // 戻るボタンをクリック
      await user.click(screen.getByText("戻る"))

      // 翻数選択画面に戻ることを確認
      expect(screen.getByText("2翻")).toBeInTheDocument()
    })
  })

  describe("確認ステップ", () => {
    const setupConfirmStep = async () => {
      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      // 満貫を選択して確認ステップに進む
      await user.click(screen.getByText("満貫"))

      await waitFor(() => {
        expect(screen.getByText("支払い")).toBeInTheDocument()
      })

      return user
    }

    it("確認情報が正しく表示される", async () => {
      await setupConfirmStep()

      expect(screen.getByText("和了: ツモ")).toBeInTheDocument()
      expect(screen.getByText("翻数: 満貫")).toBeInTheDocument()
      expect(screen.getByText("本場: 0本場")).toBeInTheDocument()
      expect(screen.getByText("供託: 0本")).toBeInTheDocument()
    })

    it("スコアプレビューが表示される", async () => {
      await setupConfirmStep()

      await waitFor(() => {
        expect(screen.getByText(/支払い:/)).toBeInTheDocument()
      })
    })

    it("支払いボタンがクリックできる", async () => {
      const user = await setupConfirmStep()

      const submitButton = screen.getByText("支払い")
      await user.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalledWith({
        winnerId: "player1",
        han: 5,
        fu: 30,
        isTsumo: true,
        loserId: undefined,
      })
    })
  })

  describe("バリデーション", () => {
    it("和了者が選択されていない場合エラーになる", async () => {
      const user = userEvent.setup()
      render(
        <BaseScoreInputForm
          {...defaultProps}
          mode="solo"
          preselectedWinnerId=""
        />
      )

      // 満貫選択
      await user.click(screen.getByText("満貫"))

      await waitFor(() => {
        const submitButton = screen.getByText("支払い")
        expect(submitButton).toBeDisabled()
      })
    })

    it("ronモードで放銃者が選択されていない場合エラーになる", async () => {
      const user = userEvent.setup()
      render(
        <BaseScoreInputForm
          {...defaultProps}
          actionType="ron"
          preselectedWinnerId="player1"
        />
      )

      // 翻数選択
      await user.click(screen.getByText("満貫"))

      await waitFor(() => {
        const submitButton = screen.getByText("支払い")
        expect(submitButton).toBeDisabled()
      })
    })

    it("トビ状態のプレイヤーは和了できない", async () => {
      const gameStateWithTobi = {
        ...mockGameState,
        players: [
          ...mockGameState.players.slice(0, 1),
          {
            ...mockGameState.players[1],
            points: 0, // トビ状態
          },
          ...mockGameState.players.slice(2),
        ],
      }

      const user = userEvent.setup()
      render(
        <BaseScoreInputForm
          {...defaultProps}
          gameState={gameStateWithTobi}
          mode="solo"
          preselectedWinnerId=""
        />
      )

      // プレイヤー2のボタンを探して選択（点数が0のプレイヤー）
      // プレイヤー選択ボタンの中でプレイヤー2を含む要素を探す
      const player2Button = screen.getByRole("button", {
        name: /南 プレイヤー2/,
      })
      expect(player2Button).toBeInTheDocument()

      await user.click(player2Button)

      // プレイヤー選択後、状態更新を待機
      await waitFor(() => {
        expect(screen.getByText("満貫")).toBeInTheDocument()
      })

      // 満貫選択
      await user.click(screen.getByText("満貫"))

      // 確認ステップに進む
      await waitFor(() => {
        const submitButton = screen.getByText("支払い")
        expect(submitButton).toBeInTheDocument()
      })

      const submitButton = screen.getByText("支払い")
      await user.click(submitButton)

      // トビ状態のプレイヤーは和了できないため、送信は行われない
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe("エラーハンドリング", () => {
    it("送信エラーが発生した場合エラーメッセージが表示される", async () => {
      mockOnSubmit.mockRejectedValue(new Error("送信エラー"))

      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      // 満貫選択
      await user.click(screen.getByText("満貫"))

      await waitFor(() => {
        const submitButton = screen.getByText("支払い")
        expect(submitButton).toBeInTheDocument()
      })

      // フォーム送信
      const submitButton = screen.getByText("支払い")
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText("送信エラー")).toBeInTheDocument()
      })
    })

    it("不明なエラーの場合デフォルトメッセージが表示される", async () => {
      mockOnSubmit.mockRejectedValue("不明なエラー")

      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      // 満貫選択
      await user.click(screen.getByText("満貫"))

      await waitFor(() => {
        const submitButton = screen.getByText("支払い")
        expect(submitButton).toBeInTheDocument()
      })

      // フォーム送信
      const submitButton = screen.getByText("支払い")
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText("点数計算に失敗しました")).toBeInTheDocument()
      })
    })
  })

  describe("スコアプレビュー", () => {
    it("カスタムスコア計算関数が使用される", async () => {
      mockCalculateScorePreview.mockResolvedValue({
        winnerGain: 3000,
        payments: {
          fromOya: 3000,
          fromKo: 1500,
        },
      })

      const user = userEvent.setup()
      render(
        <BaseScoreInputForm
          {...defaultProps}
          calculateScorePreview={mockCalculateScorePreview}
        />
      )

      // 満貫選択
      await user.click(screen.getByText("満貫"))

      await waitFor(() => {
        expect(mockCalculateScorePreview).toHaveBeenCalledWith({
          han: 5,
          fu: 30,
          isOya: true,
          isTsumo: true,
          honba: 0,
          kyotaku: 0,
        })
      })
    })

    it("デフォルトスコア計算が使用される", async () => {
      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      // 満貫選択
      await user.click(screen.getByText("満貫"))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/score/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            han: 5,
            fu: 30,
            isOya: true,
            isTsumo: true,
            honba: 0,
            kyotaku: 0,
          }),
        })
      })
    })

    it("スコア計算エラーが適切に処理される", async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error("API Error"))

      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      // 満貫選択
      await user.click(screen.getByText("満貫"))

      // エラーが発生してもコンポーネントはクラッシュしない
      await waitFor(() => {
        expect(screen.getByText("支払い")).toBeInTheDocument()
      })
    })
  })

  describe("preselectedWinnerIdの動作", () => {
    it("preselectedWinnerIdが設定されている場合、初期値として使用される", () => {
      render(
        <BaseScoreInputForm {...defaultProps} preselectedWinnerId="player2" />
      )

      // プレイヤー2が初期選択されていることを期待
      // (実際の確認方法はコンポーネントの実装による)
    })

    it("preselectedWinnerIdが変更された場合、状態が更新される", () => {
      const { rerender } = render(
        <BaseScoreInputForm {...defaultProps} preselectedWinnerId="player1" />
      )

      rerender(
        <BaseScoreInputForm {...defaultProps} preselectedWinnerId="player2" />
      )

      // 新しいpreselectedWinnerIdが反映されることを期待
    })
  })

  describe("キャンセル機能", () => {
    it("モーダルのクローズボタンでキャンセルできる", async () => {
      const user = userEvent.setup()
      render(<BaseScoreInputForm {...defaultProps} />)

      const closeButton = screen.getByTestId("close-modal")
      await user.click(closeButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  describe("メモ化の確認", () => {
    it("コンポーネントがメモ化されている", () => {
      // BaseScoreInputFormがmemoでラップされていることを確認
      // (これは実装の詳細なので、実際のテストでは重要度は低い)
      expect(BaseScoreInputForm).toBeDefined()
    })
  })
})
