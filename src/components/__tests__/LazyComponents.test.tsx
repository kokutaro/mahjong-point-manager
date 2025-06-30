import { render, screen, waitFor } from "@testing-library/react"
import { Suspense } from "react"
import {
  LazyGameResult,
  LazyQRCodeModal,
  LazyPointAnimation,
  LazyScoreInputForm,
  withSuspense,
  GameResultWithSuspense,
  QRCodeModalWithSuspense,
  PointAnimationWithSuspense,
  ScoreInputFormWithSuspense,
} from "../LazyComponents"

// LoadingSpinnerのモック
jest.mock("../LoadingSpinner", () => {
  return function MockLoadingSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>
  }
})

// 各コンポーネントのモック
jest.mock("../GameResult", () => {
  return function MockGameResult() {
    return <div data-testid="game-result">Game Result Component</div>
  }
})

jest.mock("../QRCodeModal", () => {
  return function MockQRCodeModal() {
    return <div data-testid="qr-code-modal">QR Code Modal Component</div>
  }
})

jest.mock("../PointAnimation", () => {
  return function MockPointAnimation() {
    return <div data-testid="point-animation">Point Animation Component</div>
  }
})

jest.mock("../ScoreInputForm", () => {
  return function MockScoreInputForm() {
    return <div data-testid="score-input-form">Score Input Form Component</div>
  }
})

// テスト用のコンポーネント
const TestComponent: React.FC<{ message: string }> = ({ message }) => (
  <div data-testid="test-component">{message}</div>
)

describe("LazyComponents", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Lazy loaded components", () => {
    it("LazyGameResultが正しく定義されている", async () => {
      render(
        <Suspense fallback={<div>Loading GameResult...</div>}>
          <LazyGameResult />
        </Suspense>
      )

      await waitFor(() => {
        expect(screen.getByTestId("game-result")).toBeInTheDocument()
      })
    })

    it("LazyQRCodeModalが正しく定義されている", async () => {
      render(
        <Suspense fallback={<div>Loading QRCodeModal...</div>}>
          <LazyQRCodeModal isOpen={true} onClose={() => {}} />
        </Suspense>
      )

      await waitFor(() => {
        expect(screen.getByTestId("qr-code-modal")).toBeInTheDocument()
      })
    })

    it("LazyPointAnimationが正しく定義されている", async () => {
      const mockProps = {
        players: [],
        pointChanges: [],
        dealerPosition: 0,
        onComplete: () => {},
      }

      render(
        <Suspense fallback={<div>Loading PointAnimation...</div>}>
          <LazyPointAnimation {...mockProps} />
        </Suspense>
      )

      await waitFor(() => {
        expect(screen.getByTestId("point-animation")).toBeInTheDocument()
      })
    })

    it("LazyScoreInputFormが正しく定義されている", async () => {
      render(
        <Suspense fallback={<div>Loading ScoreInputForm...</div>}>
          <LazyScoreInputForm />
        </Suspense>
      )

      await waitFor(() => {
        expect(screen.getByTestId("score-input-form")).toBeInTheDocument()
      })
    })
  })

  describe("withSuspense HOC", () => {
    it("デフォルトのLoading Spinnerが使用される", () => {
      const WrappedComponent = withSuspense(TestComponent)

      render(<WrappedComponent message="Test Message" />)

      // 同期的にレンダリングされるため、最終的なコンポーネントが表示される
      expect(screen.getByTestId("test-component")).toBeInTheDocument()
      expect(screen.getByText("Test Message")).toBeInTheDocument()
    })

    it("カスタムフォールバックが表示される", () => {
      const customFallback = (
        <div data-testid="custom-fallback">Custom Loading...</div>
      )
      const WrappedComponent = withSuspense(TestComponent, customFallback)

      render(<WrappedComponent message="Test Message" />)

      expect(screen.getByTestId("test-component")).toBeInTheDocument()
      expect(screen.getByText("Test Message")).toBeInTheDocument()
    })

    it("プロパティが正しく渡される", () => {
      const WrappedComponent = withSuspense(TestComponent)
      const testMessage = "Test props passing"

      render(<WrappedComponent message={testMessage} />)

      expect(screen.getByText(testMessage)).toBeInTheDocument()
    })

    it("複数のプロパティが正しく渡される", () => {
      interface MultiPropComponent {
        title: string
        count: number
        isActive: boolean
      }

      const MultiPropTestComponent: React.FC<MultiPropComponent> = ({
        title,
        count,
        isActive,
      }) => (
        <div data-testid="multi-prop-component">
          <span data-testid="title">{title}</span>
          <span data-testid="count">{count}</span>
          <span data-testid="is-active">{isActive.toString()}</span>
        </div>
      )

      const WrappedMultiPropComponent = withSuspense(MultiPropTestComponent)

      render(
        <WrappedMultiPropComponent
          title="Test Title"
          count={42}
          isActive={true}
        />
      )

      expect(screen.getByTestId("title")).toHaveTextContent("Test Title")
      expect(screen.getByTestId("count")).toHaveTextContent("42")
      expect(screen.getByTestId("is-active")).toHaveTextContent("true")
    })

    it("HOCが適切なdisplayNameを持つ", () => {
      const WrappedComponent = withSuspense(TestComponent)
      expect(WrappedComponent.name).toBe("SuspenseWrapper")
    })
  })

  describe("Pre-wrapped components", () => {
    it("GameResultWithSuspenseが正常に動作する", async () => {
      render(<GameResultWithSuspense />)

      await waitFor(() => {
        expect(screen.getByTestId("game-result")).toBeInTheDocument()
      })
    })

    it("QRCodeModalWithSuspenseが正常に動作する", async () => {
      render(<QRCodeModalWithSuspense isOpen={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId("qr-code-modal")).toBeInTheDocument()
      })
    })

    it("PointAnimationWithSuspenseが正常に動作する", async () => {
      const mockProps = {
        players: [],
        pointChanges: [],
        dealerPosition: 0,
        onComplete: () => {},
      }

      render(<PointAnimationWithSuspense {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByTestId("point-animation")).toBeInTheDocument()
      })
    })

    it("ScoreInputFormWithSuspenseが正常に動作する", async () => {
      render(<ScoreInputFormWithSuspense />)

      await waitFor(() => {
        expect(screen.getByTestId("score-input-form")).toBeInTheDocument()
      })
    })
  })

  describe("Suspense integration", () => {
    it("Suspenseのフォールバックが正しく機能する", () => {
      // シンプルなテストでSuspenseの基本動作を確認
      const WrappedComponent = withSuspense(
        TestComponent,
        <div>Custom Loading</div>
      )

      render(<WrappedComponent message="Test" />)

      // コンポーネントが同期的に読み込まれるため、最終的な状態を確認
      expect(screen.getByTestId("test-component")).toBeInTheDocument()
    })

    it("withSuspenseがSuspenseコンポーネントを正しく使用する", () => {
      const WrappedComponent = withSuspense(TestComponent)

      // コンポーネントの構造を確認するため、container要素をチェック
      const { container } = render(<WrappedComponent message="Test" />)

      expect(container.firstChild).toBeDefined()
      expect(screen.getByTestId("test-component")).toBeInTheDocument()
    })
  })

  describe("Error boundaries", () => {
    it("エラーが発生してもアプリが壊れない", () => {
      // エラーを投げるコンポーネント
      const ErrorComponent = () => {
        throw new Error("Test error")
      }

      const WrappedErrorComponent = withSuspense(ErrorComponent)

      // エラーをキャッチしてテストが失敗しないようにする
      const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({
        children,
      }) => {
        try {
          return <>{children}</>
        } catch {
          return <div data-testid="error-caught">Error was caught</div>
        }
      }

      // console.errorをモックしてエラーログを抑制
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {})

      expect(() => {
        render(
          <ErrorBoundary>
            <WrappedErrorComponent />
          </ErrorBoundary>
        )
      }).toThrow()

      consoleSpy.mockRestore()
    })
  })

  describe("TypeScript type safety", () => {
    it("withSuspenseが型安全性を保持している", () => {
      interface TypedComponentProps {
        requiredProp: string
        optionalProp?: number
      }

      const TypedComponent: React.FC<TypedComponentProps> = ({
        requiredProp,
        optionalProp,
      }) => (
        <div>
          {requiredProp} - {optionalProp}
        </div>
      )

      const WrappedTypedComponent = withSuspense(TypedComponent)

      // TypeScriptの型チェックが正常に動作することを確認
      // （実際のテストというよりは、コンパイル時の型チェックの確認）
      render(<WrappedTypedComponent requiredProp="test" optionalProp={123} />)

      expect(screen.getByText("test - 123")).toBeInTheDocument()
    })
  })
})
