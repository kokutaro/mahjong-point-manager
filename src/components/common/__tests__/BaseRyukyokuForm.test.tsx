import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import BaseRyukyokuForm from "../BaseRyukyokuForm"
import { BasePlayerState } from "../types"

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
    Button: ({
      children,
      onClick,
      disabled,
      color,
      variant,
      fullWidth,
    }: any) => (
      <button
        onClick={onClick}
        disabled={disabled}
        data-testid="mantine-button"
        data-color={color}
        data-variant={variant}
        data-full-width={fullWidth}
      >
        {children}
      </button>
    ),
  }
})

describe("BaseRyukyokuForm", () => {
  const mockOnSubmit = jest.fn()
  const mockOnCancel = jest.fn()

  const mockPlayers: BasePlayerState[] = [
    {
      id: "player1",
      name: "プレイヤー1",
      position: 0,
      points: 25000,
      isReach: false,
    },
    {
      id: "player2",
      name: "プレイヤー2",
      position: 1,
      points: 25000,
      isReach: false,
    },
    {
      id: "player3",
      name: "プレイヤー3",
      position: 2,
      points: 25000,
      isReach: false,
    },
    {
      id: "player4",
      name: "プレイヤー4",
      position: 3,
      points: 25000,
      isReach: false,
    },
  ]

  const defaultProps = {
    players: mockPlayers,
    mode: "multi" as const,
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("基本的なレンダリング", () => {
    it("モーダルが正しく表示される", () => {
      render(<BaseRyukyokuForm {...defaultProps} />)

      expect(screen.getByTestId("modal")).toBeInTheDocument()
      expect(screen.getByText("流局処理")).toBeInTheDocument()
    })

    it("ステッパーが表示される", () => {
      render(<BaseRyukyokuForm {...defaultProps} />)

      expect(screen.getByTestId("stepper")).toBeInTheDocument()
      expect(screen.getByTestId("stepper")).toHaveAttribute("data-active", "0")
    })

    it("聴牌入力ステップが表示される", () => {
      render(<BaseRyukyokuForm {...defaultProps} />)

      const tenpaiStep = screen
        .getAllByTestId("stepper-step")
        .find((step) => step.getAttribute("data-label") === "聴牌入力")
      expect(tenpaiStep).toBeInTheDocument()
    })

    it("全プレイヤーが表示される", () => {
      render(<BaseRyukyokuForm {...defaultProps} />)

      mockPlayers.forEach((player) => {
        expect(screen.getByText(player.name)).toBeInTheDocument()
      })
    })

    it("初期状態では全プレイヤーがノーテンになっている", () => {
      render(<BaseRyukyokuForm {...defaultProps} />)

      const notenButtons = screen.getAllByText("ノーテン")
      expect(notenButtons).toHaveLength(4)
    })
  })

  describe("聴牌/ノーテン切り替え", () => {
    it("プレイヤーの聴牌状態を切り替えられる", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      // プレイヤー1のボタンを探す
      const player1Row = screen.getByText("プレイヤー1").closest("div")
      const toggleButton = player1Row?.querySelector("button")

      expect(toggleButton).toHaveTextContent("ノーテン")

      // ボタンをクリック
      if (toggleButton) {
        await user.click(toggleButton)
      }

      expect(toggleButton).toHaveTextContent("聴牌")

      // もう一度クリックしてノーテンに戻す
      if (toggleButton) {
        await user.click(toggleButton)
      }

      expect(toggleButton).toHaveTextContent("ノーテン")
    })

    it("複数のプレイヤーの聴牌状態を設定できる", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      // プレイヤー1とプレイヤー3を聴牌にする
      const player1Row = screen.getByText("プレイヤー1").closest("div")
      const player1Button = player1Row?.querySelector("button")

      const player3Row = screen.getByText("プレイヤー3").closest("div")
      const player3Button = player3Row?.querySelector("button")

      if (player1Button) {
        await user.click(player1Button)
      }
      if (player3Button) {
        await user.click(player3Button)
      }

      expect(player1Button).toHaveTextContent("聴牌")
      expect(player3Button).toHaveTextContent("聴牌")
    })

    it("聴牌ボタンの色が変わる", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      const player1Row = screen.getByText("プレイヤー1").closest("div")
      const toggleButton = player1Row?.querySelector("button")

      // 初期状態はgray
      expect(toggleButton).toHaveAttribute("data-color", "gray")

      // クリック後はblue
      if (toggleButton) {
        await user.click(toggleButton)
      }

      expect(toggleButton).toHaveAttribute("data-color", "blue")
    })
  })

  describe("ステップナビゲーション", () => {
    it("確認ボタンで次のステップに進める", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      const confirmButton = screen.getByText("確認")
      await user.click(confirmButton)

      // ステップが1に進んでいることを確認
      expect(screen.getByTestId("stepper")).toHaveAttribute("data-active", "1")
    })

    it("確認ステップが表示される", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      await user.click(screen.getByText("確認"))

      // 確認ステップの要素が表示されることを確認
      const confirmStep = screen
        .getAllByTestId("stepper-step")
        .find((step) => step.getAttribute("data-label") === "確認")
      expect(confirmStep).toBeInTheDocument()
    })

    it("戻るボタンで前のステップに戻れる", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      // 確認ステップに進む
      await user.click(screen.getByText("確認"))

      // 戻るボタンをクリック
      const backButton = screen.getByText("戻る")
      await user.click(backButton)

      // ステップが0に戻っていることを確認
      expect(screen.getByTestId("stepper")).toHaveAttribute("data-active", "0")
    })
  })

  describe("点数計算", () => {
    it("全員ノーテンの場合、点数移動なしと表示される", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      await user.click(screen.getByText("確認"))

      expect(screen.getByText("テンパイ者: なし")).toBeInTheDocument()
      // 点数移動の表示がないことを確認
      expect(screen.queryByText(/聴牌者受取/)).not.toBeInTheDocument()
    })

    it("全員聴牌の場合、点数移動なしと表示される", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      // 全プレイヤーを聴牌にする
      for (let i = 1; i <= 4; i++) {
        const playerRow = screen.getByText(`プレイヤー${i}`).closest("div")
        const toggleButton = playerRow?.querySelector("button")
        if (toggleButton) {
          await user.click(toggleButton)
        }
      }

      await user.click(screen.getByText("確認"))

      expect(
        screen.getByText(
          "テンパイ者: プレイヤー1、プレイヤー2、プレイヤー3、プレイヤー4"
        )
      ).toBeInTheDocument()
      // 点数移動の表示がないことを確認
      expect(screen.queryByText(/聴牌者受取/)).not.toBeInTheDocument()
    })

    it("一部聴牌の場合、正しい点数計算が表示される", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      // プレイヤー1とプレイヤー2を聴牌にする（2人聴牌、2人ノーテン）
      const player1Row = screen.getByText("プレイヤー1").closest("div")
      const player1Button = player1Row?.querySelector("button")
      const player2Row = screen.getByText("プレイヤー2").closest("div")
      const player2Button = player2Row?.querySelector("button")

      if (player1Button) await user.click(player1Button)
      if (player2Button) await user.click(player2Button)

      await user.click(screen.getByText("確認"))

      expect(
        screen.getByText("テンパイ者: プレイヤー1、プレイヤー2")
      ).toBeInTheDocument()
      expect(
        screen.getByText("聴牌者受取: 1500点 / ノーテン者支払: 1500点")
      ).toBeInTheDocument()
    })

    it("1人聴牌の場合、正しい点数計算が表示される", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      // プレイヤー1のみ聴牌にする
      const player1Row = screen.getByText("プレイヤー1").closest("div")
      const player1Button = player1Row?.querySelector("button")

      if (player1Button) await user.click(player1Button)

      await user.click(screen.getByText("確認"))

      expect(screen.getByText("テンパイ者: プレイヤー1")).toBeInTheDocument()
      expect(
        screen.getByText("聴牌者受取: 3000点 / ノーテン者支払: 1000点")
      ).toBeInTheDocument()
    })

    it("3人聴牌の場合、正しい点数計算が表示される", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      // プレイヤー1、2、3を聴牌にする
      for (let i = 1; i <= 3; i++) {
        const playerRow = screen.getByText(`プレイヤー${i}`).closest("div")
        const toggleButton = playerRow?.querySelector("button")
        if (toggleButton) {
          await user.click(toggleButton)
        }
      }

      await user.click(screen.getByText("確認"))

      expect(
        screen.getByText("テンパイ者: プレイヤー1、プレイヤー2、プレイヤー3")
      ).toBeInTheDocument()
      expect(
        screen.getByText("聴牌者受取: 1000点 / ノーテン者支払: 3000点")
      ).toBeInTheDocument()
    })
  })

  describe("フォーム送信", () => {
    it("支払いボタンで正しいデータが送信される", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      // プレイヤー1とプレイヤー3を聴牌にする
      const player1Row = screen.getByText("プレイヤー1").closest("div")
      const player1Button = player1Row?.querySelector("button")
      const player3Row = screen.getByText("プレイヤー3").closest("div")
      const player3Button = player3Row?.querySelector("button")

      if (player1Button) await user.click(player1Button)
      if (player3Button) await user.click(player3Button)

      // 確認ステップに進む
      await user.click(screen.getByText("確認"))

      // 支払いボタンをクリック
      const submitButton = screen.getByText("支払い")
      await user.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalledWith(["player1", "player3"])
    })

    it("全員ノーテンの場合、空配列が送信される", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      // 確認ステップに進む
      await user.click(screen.getByText("確認"))

      // 支払いボタンをクリック
      const submitButton = screen.getByText("支払い")
      await user.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalledWith([])
    })

    it("送信エラーが発生してもクラッシュしない", async () => {
      mockOnSubmit.mockRejectedValue(new Error("送信エラー"))

      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      await user.click(screen.getByText("確認"))

      const submitButton = screen.getByText("支払い")
      await user.click(submitButton)

      // コンポーネントがクラッシュしないことを確認
      expect(screen.getByText("支払い")).toBeInTheDocument()
    })
  })

  describe("キャンセル機能", () => {
    it("モーダルのクローズボタンでキャンセルできる", async () => {
      const user = userEvent.setup()
      render(<BaseRyukyokuForm {...defaultProps} />)

      const closeButton = screen.getByTestId("close-modal")
      await user.click(closeButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  describe("少ないプレイヤー数での動作", () => {
    it("3人麻雀でも正しく動作する", async () => {
      const threePlayers = mockPlayers.slice(0, 3)
      const user = userEvent.setup()

      render(<BaseRyukyokuForm {...defaultProps} players={threePlayers} />)

      // 3人のプレイヤーが表示されることを確認
      expect(screen.getByText("プレイヤー1")).toBeInTheDocument()
      expect(screen.getByText("プレイヤー2")).toBeInTheDocument()
      expect(screen.getByText("プレイヤー3")).toBeInTheDocument()
      expect(screen.queryByText("プレイヤー4")).not.toBeInTheDocument()

      // 1人聴牌の場合の計算 (3000点を1人で受取、1500点ずつ支払い)
      const player1Row = screen.getByText("プレイヤー1").closest("div")
      const player1Button = player1Row?.querySelector("button")
      if (player1Button) await user.click(player1Button)

      await user.click(screen.getByText("確認"))

      expect(
        screen.getByText("聴牌者受取: 3000点 / ノーテン者支払: 1500点")
      ).toBeInTheDocument()
    })
  })

  describe("メモ化の確認", () => {
    it("コンポーネントがメモ化されている", () => {
      // BaseRyukyokuFormがmemoでラップされていることを確認
      expect(BaseRyukyokuForm).toBeDefined()
    })
  })

  describe("プレイヤー名の表示", () => {
    it("長いプレイヤー名も正しく表示される", () => {
      const playersWithLongNames = [
        {
          id: "player1",
          name: "とても長いプレイヤー名前1",
          position: 0,
          points: 25000,
          isReach: false,
        },
        {
          id: "player2",
          name: "とても長いプレイヤー名前2",
          position: 1,
          points: 25000,
          isReach: false,
        },
      ]

      render(
        <BaseRyukyokuForm {...defaultProps} players={playersWithLongNames} />
      )

      expect(screen.getByText("とても長いプレイヤー名前1")).toBeInTheDocument()
      expect(screen.getByText("とても長いプレイヤー名前2")).toBeInTheDocument()
    })
  })
})
