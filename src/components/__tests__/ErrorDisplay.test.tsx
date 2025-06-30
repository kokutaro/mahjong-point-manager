import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import ErrorDisplay, { ErrorInfo } from "../ErrorDisplay"

// window.location.reloadのモック

describe("ErrorDisplay", () => {
  const mockOnRetry = jest.fn()
  const mockOnDismiss = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    // 実行中のタイマーがある場合のみクリア
    if (jest.isMockFunction(setTimeout)) {
      jest.runOnlyPendingTimers()
    }
    jest.useRealTimers()
  })

  describe("基本的なレンダリング", () => {
    it("errorがnullの場合は何も表示されない", () => {
      render(<ErrorDisplay error={null} />)
      expect(screen.queryByText("エラー")).not.toBeInTheDocument()
    })

    it("文字列エラーが正しく表示される", () => {
      render(<ErrorDisplay error="テストエラーメッセージ" />)

      expect(screen.getByText("エラー")).toBeInTheDocument()
      expect(screen.getByText("テストエラーメッセージ")).toBeInTheDocument()
    })

    it("ErrorInfoオブジェクトが正しく表示される", () => {
      const errorInfo: ErrorInfo = {
        type: "network",
        message: "ネットワークエラーが発生しました",
        details: "詳細なエラー情報",
      }

      render(<ErrorDisplay error={errorInfo} />)

      expect(screen.getByText("ネットワークエラー")).toBeInTheDocument()
      expect(
        screen.getByText("ネットワークエラーが発生しました")
      ).toBeInTheDocument()
      expect(screen.getByText("詳細なエラー情報")).toBeInTheDocument()
    })
  })

  describe("エラータイプ別の表示", () => {
    it("networkエラーが正しく表示される", () => {
      const errorInfo: ErrorInfo = {
        type: "network",
        message: "ネットワークに接続できません",
      }

      render(<ErrorDisplay error={errorInfo} />)

      expect(screen.getByText("ネットワークエラー")).toBeInTheDocument()
      // ネットワークアイコンが表示されることを確認（SVGの存在確認）
      const icon = document.querySelector("svg")
      expect(icon).toBeInTheDocument()
    })

    it("validationエラーが正しく表示される", () => {
      const errorInfo: ErrorInfo = {
        type: "validation",
        message: "入力内容に誤りがあります",
      }

      render(<ErrorDisplay error={errorInfo} />)

      expect(screen.getByText("入力エラー")).toBeInTheDocument()
      expect(screen.getByText("入力内容に誤りがあります")).toBeInTheDocument()
    })

    it("serverエラーが正しく表示される", () => {
      const errorInfo: ErrorInfo = {
        type: "server",
        message: "サーバーでエラーが発生しました",
      }

      render(<ErrorDisplay error={errorInfo} />)

      expect(screen.getByText("サーバーエラー")).toBeInTheDocument()
      expect(
        screen.getByText("サーバーでエラーが発生しました")
      ).toBeInTheDocument()
    })

    it("websocketエラーが正しく表示される", () => {
      const errorInfo: ErrorInfo = {
        type: "websocket",
        message: "WebSocket接続が切断されました",
      }

      render(<ErrorDisplay error={errorInfo} />)

      expect(screen.getByText("接続エラー")).toBeInTheDocument()
      expect(
        screen.getByText("WebSocket接続が切断されました")
      ).toBeInTheDocument()
    })

    it("generalエラーが正しく表示される", () => {
      const errorInfo: ErrorInfo = {
        type: "general",
        message: "一般的なエラーです",
      }

      render(<ErrorDisplay error={errorInfo} />)

      expect(screen.getByText("エラー")).toBeInTheDocument()
      expect(screen.getByText("一般的なエラーです")).toBeInTheDocument()
    })
  })

  describe("スタイリング", () => {
    it("networkエラーのスタイルが適用される", () => {
      const errorInfo: ErrorInfo = {
        type: "network",
        message: "ネットワーク接続に失敗しました",
      }

      render(<ErrorDisplay error={errorInfo} />)

      const errorContainer = screen
        .getByText("ネットワークエラー")
        .closest(".border")
      expect(errorContainer).toHaveClass(
        "border-orange-200",
        "bg-orange-50",
        "text-orange-800"
      )
    })

    it("validationエラーのスタイルが適用される", () => {
      const errorInfo: ErrorInfo = {
        type: "validation",
        message: "バリデーションに失敗しました",
      }

      render(<ErrorDisplay error={errorInfo} />)

      const errorContainer = screen.getByText("入力エラー").closest(".border")
      expect(errorContainer).toHaveClass(
        "border-yellow-200",
        "bg-yellow-50",
        "text-yellow-800"
      )
    })

    it("serverエラーのスタイルが適用される", () => {
      const errorInfo: ErrorInfo = {
        type: "server",
        message: "サーバーで問題が発生しました",
      }

      render(<ErrorDisplay error={errorInfo} />)

      const errorContainer = screen
        .getByText("サーバーエラー")
        .closest(".border")
      expect(errorContainer).toHaveClass(
        "border-red-200",
        "bg-red-50",
        "text-red-800"
      )
    })
  })

  describe("詳細情報の表示", () => {
    it("詳細情報がある場合に表示される", () => {
      const errorInfo: ErrorInfo = {
        type: "general",
        message: "エラーメッセージ",
        details: "スタックトレースやデバッグ情報",
      }

      render(<ErrorDisplay error={errorInfo} />)

      expect(
        screen.getByText("スタックトレースやデバッグ情報")
      ).toBeInTheDocument()

      const detailsContainer =
        screen.getByText("スタックトレースやデバッグ情報")
      expect(detailsContainer).toHaveClass(
        "font-mono",
        "bg-black",
        "bg-opacity-10"
      )
    })

    it("詳細情報がない場合は表示されない", () => {
      const errorInfo: ErrorInfo = {
        type: "general",
        message: "エラーメッセージ",
      }

      render(<ErrorDisplay error={errorInfo} />)

      const detailsContainer = document.querySelector(".font-mono")
      expect(detailsContainer).not.toBeInTheDocument()
    })
  })

  describe("自動非表示機能", () => {
    it("autoHideがtrueの場合、指定時間後に自動的に非表示になる", async () => {
      const errorInfo: ErrorInfo = {
        type: "general",
        message: "自動非表示テスト",
        autoHide: true,
        duration: 1000,
      }

      render(<ErrorDisplay error={errorInfo} onDismiss={mockOnDismiss} />)

      expect(screen.getByText("自動非表示テスト")).toBeInTheDocument()

      // 1秒後に非表示になることを確認
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledTimes(1)
      })
    })

    it("autoHideがtrueで時間指定がない場合、デフォルト5秒後に非表示になる", async () => {
      const errorInfo: ErrorInfo = {
        type: "general",
        message: "デフォルト時間テスト",
        autoHide: true,
      }

      render(<ErrorDisplay error={errorInfo} onDismiss={mockOnDismiss} />)

      expect(screen.getByText("デフォルト時間テスト")).toBeInTheDocument()

      // 5秒後に非表示になることを確認
      act(() => {
        jest.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledTimes(1)
      })
    })

    it("文字列エラーの場合は自動非表示にならない", async () => {
      render(<ErrorDisplay error="文字列エラー" onDismiss={mockOnDismiss} />)

      expect(screen.getByText("文字列エラー")).toBeInTheDocument()

      // 5秒経過しても非表示にならない
      act(() => {
        jest.advanceTimersByTime(5000)
      })

      expect(mockOnDismiss).not.toHaveBeenCalled()
      expect(screen.getByText("文字列エラー")).toBeInTheDocument()
    })
  })

  describe("手動クローズ機能", () => {
    it("閉じるボタンをクリックするとonDismissが呼ばれる", () => {
      const errorInfo: ErrorInfo = {
        type: "general",
        message: "クローズテスト",
      }

      render(<ErrorDisplay error={errorInfo} onDismiss={mockOnDismiss} />)

      const closeButton = screen.getByRole("button")
      fireEvent.click(closeButton)

      expect(mockOnDismiss).toHaveBeenCalledTimes(1)
    })

    it("onDismissが提供されていない場合、閉じるボタンが表示されない", () => {
      const errorInfo: ErrorInfo = {
        type: "general",
        message: "クローズボタンなしテスト",
      }

      render(<ErrorDisplay error={errorInfo} />)

      // 閉じるボタン（×）が表示されないことを確認
      const closeIcon = document.querySelector('path[d="M6 18L18 6M6 6l12 12"]')
      expect(closeIcon).not.toBeInTheDocument()
    })
  })

  describe("再試行機能", () => {
    it("再試行可能エラーで再試行ボタンが表示される", () => {
      const errorInfo: ErrorInfo = {
        type: "network",
        message: "再試行可能エラー",
        isRetryable: true,
      }

      render(<ErrorDisplay error={errorInfo} onRetry={mockOnRetry} />)

      expect(screen.getByText("再試行")).toBeInTheDocument()
    })

    it("再試行ボタンをクリックするとonRetryが呼ばれる", () => {
      const errorInfo: ErrorInfo = {
        type: "network",
        message: "再試行テスト",
        isRetryable: true,
      }

      render(<ErrorDisplay error={errorInfo} onRetry={mockOnRetry} />)

      const retryButton = screen.getByText("再試行")
      fireEvent.click(retryButton)

      expect(mockOnRetry).toHaveBeenCalledTimes(1)
    })

    it("isRetryableがfalseの場合、再試行ボタンが表示されない", () => {
      const errorInfo: ErrorInfo = {
        type: "network",
        message: "再試行不可エラー",
        isRetryable: false,
      }

      render(<ErrorDisplay error={errorInfo} onRetry={mockOnRetry} />)

      expect(screen.queryByText("再試行")).not.toBeInTheDocument()
    })

    it("onRetryが提供されていない場合、再試行ボタンが表示されない", () => {
      const errorInfo: ErrorInfo = {
        type: "network",
        message: "onRetryなしテスト",
        isRetryable: true,
      }

      render(<ErrorDisplay error={errorInfo} />)

      expect(screen.queryByText("再試行")).not.toBeInTheDocument()
    })
  })

  describe("再接続状態", () => {
    it("再接続中の表示が正しく表示される", () => {
      const errorInfo: ErrorInfo = {
        type: "websocket",
        message: "WebSocket接続が切断されました",
        isRetryable: true,
      }

      render(
        <ErrorDisplay
          error={errorInfo}
          onRetry={mockOnRetry}
          isReconnecting={true}
          reconnectTimeLeft={10}
        />
      )

      // スピナーのあるdiv内の再接続中...テキストを確認
      const reconnectingDiv =
        document.querySelector(".animate-spin")?.parentElement
      expect(reconnectingDiv).toHaveTextContent("再接続中...")
      expect(screen.getByText("(10秒後)")).toBeInTheDocument()
    })

    it("再接続中は再試行ボタンが無効になる", () => {
      const errorInfo: ErrorInfo = {
        type: "network",
        message: "ネットワーク接続が失敗しました",
        isRetryable: true,
      }

      render(
        <ErrorDisplay
          error={errorInfo}
          onRetry={mockOnRetry}
          isReconnecting={true}
        />
      )

      const retryButton = screen.getByRole("button", { name: /再接続中/ })
      expect(retryButton).toBeDisabled()
    })

    it("再接続時間が0の場合、時間表示されない", () => {
      const errorInfo: ErrorInfo = {
        type: "websocket",
        message: "接続エラー",
      }

      render(
        <ErrorDisplay
          error={errorInfo}
          isReconnecting={true}
          reconnectTimeLeft={0}
        />
      )

      expect(screen.getByText("再接続中...")).toBeInTheDocument()
      expect(screen.queryByText(/秒後/)).not.toBeInTheDocument()
    })
  })

  describe("ページリロード機能", () => {
    it("serverエラーの場合、ページリロードボタンが表示される", () => {
      const errorInfo: ErrorInfo = {
        type: "server",
        message: "サーバーエラー",
      }

      render(<ErrorDisplay error={errorInfo} />)

      expect(screen.getByText("ページを再読み込み")).toBeInTheDocument()
    })

    it("ページリロードボタンがクリック可能である", () => {
      const errorInfo: ErrorInfo = {
        type: "server",
        message: "サーバーエラー",
      }

      render(<ErrorDisplay error={errorInfo} />)

      const reloadButton = screen.getByText("ページを再読み込み")

      // ボタンが存在し、クリック可能であることを確認
      expect(reloadButton).toBeInTheDocument()
      expect(reloadButton.tagName).toBe("BUTTON")
      expect(reloadButton).not.toBeDisabled()

      // クリックイベントが発生することを確認（エラーが発生しないことを確認）
      expect(() => fireEvent.click(reloadButton)).not.toThrow()
    })

    it("serverエラー以外の場合、ページリロードボタンが表示されない", () => {
      const errorInfo: ErrorInfo = {
        type: "network",
        message: "ネットワークエラー",
      }

      render(<ErrorDisplay error={errorInfo} />)

      expect(screen.queryByText("ページを再読み込み")).not.toBeInTheDocument()
    })
  })

  describe("エラー状態の変更", () => {
    it("エラーがnullに変更されると非表示になる", () => {
      const errorInfo: ErrorInfo = {
        type: "general",
        message: "テストエラー",
      }

      const { rerender } = render(<ErrorDisplay error={errorInfo} />)

      expect(screen.getByText("テストエラー")).toBeInTheDocument()

      rerender(<ErrorDisplay error={null} />)

      expect(screen.queryByText("テストエラー")).not.toBeInTheDocument()
    })

    it("エラー内容が変更されると新しいエラーが表示される", () => {
      const errorInfo1: ErrorInfo = {
        type: "network",
        message: "最初のエラー",
      }

      const errorInfo2: ErrorInfo = {
        type: "server",
        message: "2番目のエラー",
      }

      const { rerender } = render(<ErrorDisplay error={errorInfo1} />)

      expect(screen.getByText("最初のエラー")).toBeInTheDocument()
      expect(screen.getByText("ネットワークエラー")).toBeInTheDocument()

      rerender(<ErrorDisplay error={errorInfo2} />)

      expect(screen.getByText("2番目のエラー")).toBeInTheDocument()
      expect(screen.getByText("サーバーエラー")).toBeInTheDocument()
      expect(screen.queryByText("最初のエラー")).not.toBeInTheDocument()
    })
  })

  describe("アクセシビリティ", () => {
    it("ボタンが適切なroleを持つ", () => {
      const errorInfo: ErrorInfo = {
        type: "server",
        message: "サーバーエラー",
        isRetryable: true,
      }

      render(
        <ErrorDisplay
          error={errorInfo}
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      )

      const buttons = screen.getAllByRole("button")
      expect(buttons.length).toBeGreaterThan(0)

      buttons.forEach((button) => {
        expect(button.tagName).toBe("BUTTON")
      })
    })

    it("エラータイトルが適切なheadingタグになっている", () => {
      const errorInfo: ErrorInfo = {
        type: "general",
        message: "テストエラー",
      }

      render(<ErrorDisplay error={errorInfo} />)

      const title = screen.getByText("エラー")
      expect(title.tagName).toBe("H3")
    })
  })
})
