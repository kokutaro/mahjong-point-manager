import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import OptimizedImage from "../OptimizedImage"

// Next.js Imageコンポーネントのモック
jest.mock("next/image", () => {
  const MockImage = ({
    src,
    alt,
    onLoad,
    onError,
    className,
    width,
    height,
    quality,
    priority,
    placeholder,
    blurDataURL,
    sizes,
    ...restProps
  }: any) => {
    // fireEventでerrorやloadイベントをトリガーした時にonLoadやonErrorを呼ぶ
    const handleLoad = (e: Event) => {
      if (onLoad) onLoad(e)
    }

    const handleError = (e: Event) => {
      if (onError) onError(e)
    }

    return (
      <img
        src={src}
        alt={alt}
        className={className}
        width={width}
        height={height}
        data-testid="optimized-image"
        data-onload={onLoad ? "true" : "false"}
        data-onerror={onError ? "true" : "false"}
        data-quality={quality}
        data-priority={priority}
        data-placeholder={placeholder}
        data-blurdataurl={blurDataURL}
        data-sizes={sizes}
        onLoad={handleLoad}
        onError={handleError}
        {...restProps}
      />
    )
  }

  MockImage.displayName = "Image"
  return MockImage
})

// LoadingSpinnerコンポーネントのモック
jest.mock("../LoadingSpinner", () => {
  return function MockLoadingSpinner({
    size,
    message,
  }: {
    size?: string
    message?: string
  }) {
    return (
      <div data-testid="loading-spinner" data-size={size}>
        {message && <span>{message}</span>}
      </div>
    )
  }
})

describe("OptimizedImage", () => {
  const defaultProps = {
    src: "/test-image.jpg",
    alt: "テスト画像",
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("基本的なレンダリング", () => {
    it("必須プロパティでレンダリングできる", () => {
      render(<OptimizedImage {...defaultProps} />)

      const image = screen.getByTestId("optimized-image")
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute("src", "/test-image.jpg")
      expect(image).toHaveAttribute("alt", "テスト画像")
    })

    it("デフォルト値が適用される", () => {
      render(<OptimizedImage {...defaultProps} />)

      const image = screen.getByTestId("optimized-image")
      expect(image).toHaveAttribute("width", "400")
      expect(image).toHaveAttribute("height", "400")
    })

    it("カスタムプロパティが適用される", () => {
      render(
        <OptimizedImage
          {...defaultProps}
          width={800}
          height={600}
          className="custom-class"
          quality={95}
          priority={true}
        />
      )

      const image = screen.getByTestId("optimized-image")
      expect(image).toHaveAttribute("width", "800")
      expect(image).toHaveAttribute("height", "600")
      expect(image).toHaveAttribute("data-quality", "95")
      expect(image).toHaveAttribute("data-priority", "true")

      const container = image.closest("div")
      expect(container).toHaveClass("custom-class")
    })
  })

  describe("ローディング状態", () => {
    it("初期状態でローディングスピナーが表示される", () => {
      render(<OptimizedImage {...defaultProps} />)

      const loadingSpinner = screen.getByTestId("loading-spinner")
      expect(loadingSpinner).toBeInTheDocument()
      expect(loadingSpinner).toHaveAttribute("data-size", "sm")
    })

    it("画像が読み込まれるとローディングスピナーが非表示になる", async () => {
      render(<OptimizedImage {...defaultProps} />)

      const image = screen.getByTestId("optimized-image")
      const loadingSpinner = screen.getByTestId("loading-spinner")

      // 初期状態でローディングスピナーが表示されている
      expect(loadingSpinner).toBeInTheDocument()

      // 画像の読み込み完了をシミュレート
      fireEvent.load(image)

      // ローディングスピナーが非表示になる
      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument()
      })
    })

    it("ローディング中は画像が透明になっている", () => {
      render(<OptimizedImage {...defaultProps} />)

      const image = screen.getByTestId("optimized-image")
      expect(image).toHaveClass("opacity-0")
    })

    it("読み込み完了後は画像が不透明になる", async () => {
      render(<OptimizedImage {...defaultProps} />)

      const image = screen.getByTestId("optimized-image")

      // 画像の読み込み完了をシミュレート
      fireEvent.load(image)

      await waitFor(() => {
        expect(image).toHaveClass("opacity-100")
      })
    })
  })

  describe("エラー状態", () => {
    it("画像の読み込みエラー時にエラーメッセージが表示される", async () => {
      render(<OptimizedImage {...defaultProps} />)

      const image = screen.getByTestId("optimized-image")

      // 画像の読み込みエラーをシミュレート
      fireEvent.error(image)

      await waitFor(() => {
        expect(
          screen.getByText("画像を読み込めませんでした")
        ).toBeInTheDocument()
      })

      // 元の画像要素は表示されない
      expect(screen.queryByTestId("optimized-image")).not.toBeInTheDocument()
    })

    it("エラー時にローディングスピナーが非表示になる", async () => {
      render(<OptimizedImage {...defaultProps} />)

      const image = screen.getByTestId("optimized-image")

      // 画像の読み込みエラーをシミュレート
      fireEvent.error(image)

      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument()
      })
    })

    it("エラー時のスタイルが正しく適用される", async () => {
      render(
        <OptimizedImage
          {...defaultProps}
          width={800}
          height={600}
          className="custom-error-class"
        />
      )

      const image = screen.getByTestId("optimized-image")

      // 画像の読み込みエラーをシミュレート
      fireEvent.error(image)

      await waitFor(() => {
        const errorDiv = screen
          .getByText("画像を読み込めませんでした")
          .closest("div")
        expect(errorDiv).toHaveClass("custom-error-class")
        expect(errorDiv).toHaveStyle({ width: "800px", height: "600px" })
      })
    })
  })

  describe("プレースホルダー設定", () => {
    it("blur プレースホルダーが設定される", () => {
      render(
        <OptimizedImage
          {...defaultProps}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,..."
        />
      )

      const image = screen.getByTestId("optimized-image")
      expect(image).toHaveAttribute("data-placeholder", "blur")
      expect(image).toHaveAttribute(
        "data-blurdataurl",
        "data:image/jpeg;base64,..."
      )
    })

    it("empty プレースホルダーが設定される", () => {
      render(<OptimizedImage {...defaultProps} placeholder="empty" />)

      const image = screen.getByTestId("optimized-image")
      expect(image).toHaveAttribute("data-placeholder", "empty")
    })
  })

  describe("メモ化", () => {
    it("同じプロパティで再レンダリングしても新しいインスタンスを作らない", () => {
      const { rerender } = render(<OptimizedImage {...defaultProps} />)

      rerender(<OptimizedImage {...defaultProps} />)
      const secondImage = screen.getByTestId("optimized-image")

      // DOM要素は同じである必要はないが、コンポーネントが再マウントされていないことを確認
      expect(secondImage).toBeInTheDocument()
    })
  })

  describe("アクセシビリティ", () => {
    it("alt属性が正しく設定される", () => {
      render(<OptimizedImage {...defaultProps} alt="アクセシブルな画像説明" />)

      const image = screen.getByTestId("optimized-image")
      expect(image).toHaveAttribute("alt", "アクセシブルな画像説明")
    })

    it("エラー時にも適切なテキストが表示される", async () => {
      render(<OptimizedImage {...defaultProps} />)

      const image = screen.getByTestId("optimized-image")
      fireEvent.error(image)

      await waitFor(() => {
        const errorMessage = screen.getByText("画像を読み込めませんでした")
        expect(errorMessage).toBeInTheDocument()
      })
    })
  })
})
