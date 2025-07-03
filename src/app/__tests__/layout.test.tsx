import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import RootLayout from "../layout"

// MantineProviderをモック化
jest.mock("@mantine/core", () => ({
  MantineProvider: ({ children, defaultColorScheme }: any) => (
    <div data-testid="mantine-provider" data-color-scheme={defaultColorScheme}>
      {children}
    </div>
  ),
  ColorSchemeScript: () => <script data-testid="color-scheme-script" />,
}))

// AuthProviderをモック化
jest.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: any) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}))

// Next.js フォントをモック化
jest.mock("next/font/google", () => ({
  Inter: () => ({
    className: "inter-font-class",
  }),
}))

describe("RootLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders correctly with proper structure", () => {
    const testChildren = <div data-testid="test-content">Test Content</div>

    render(<RootLayout>{testChildren}</RootLayout>)

    // 子要素が表示されることを確認
    expect(screen.getByTestId("test-content")).toBeInTheDocument()
  })

  it("has correct html attributes", () => {
    const testChildren = <div>Test</div>

    const { container } = render(<RootLayout>{testChildren}</RootLayout>)
    const htmlElement = container.querySelector("html")

    // html要素の属性確認
    expect(htmlElement).toHaveAttribute("lang", "ja")
    expect(htmlElement).toHaveAttribute("data-mantine-color-scheme", "light")
  })

  it("includes ColorSchemeScript in head", () => {
    const testChildren = <div>Test</div>

    render(<RootLayout>{testChildren}</RootLayout>)

    // ColorSchemeScriptが含まれることを確認
    expect(screen.getByTestId("color-scheme-script")).toBeInTheDocument()
  })

  it("applies Inter font class to body", () => {
    const testChildren = <div>Test</div>

    const { container } = render(<RootLayout>{testChildren}</RootLayout>)
    const bodyElement = container.querySelector("body")

    // bodyにフォントクラスが適用されることを確認
    expect(bodyElement).toHaveClass("inter-font-class")
  })

  it("wraps content in MantineProvider with correct props", () => {
    const testChildren = <div data-testid="test-content">Test Content</div>

    render(<RootLayout>{testChildren}</RootLayout>)

    const mantineProvider = screen.getByTestId("mantine-provider")

    // MantineProviderが正しい設定で存在することを確認
    expect(mantineProvider).toBeInTheDocument()
    expect(mantineProvider).toHaveAttribute("data-color-scheme", "light")

    // MantineProvider内に子要素が含まれることを確認
    expect(mantineProvider).toContainElement(screen.getByTestId("test-content"))
  })

  it("wraps content in AuthProvider", () => {
    const testChildren = <div data-testid="test-content">Test Content</div>

    render(<RootLayout>{testChildren}</RootLayout>)

    const authProvider = screen.getByTestId("auth-provider")

    // AuthProviderが存在することを確認
    expect(authProvider).toBeInTheDocument()

    // AuthProvider内に子要素が含まれることを確認
    expect(authProvider).toContainElement(screen.getByTestId("test-content"))
  })

  it("has main element with correct classes", () => {
    const testChildren = <div data-testid="test-content">Test Content</div>

    const { container } = render(<RootLayout>{testChildren}</RootLayout>)
    const mainElement = container.querySelector("main")

    // main要素が存在し、正しいクラスを持つことを確認
    expect(mainElement).toBeInTheDocument()
    expect(mainElement).toHaveClass("min-h-screen")

    // main要素内に子要素が含まれることを確認
    expect(mainElement).toContainElement(screen.getByTestId("test-content"))
  })

  it("renders children correctly within the provider hierarchy", () => {
    const testChildren = (
      <div>
        <h1 data-testid="test-title">Test Title</h1>
        <p data-testid="test-paragraph">Test paragraph content</p>
      </div>
    )

    render(<RootLayout>{testChildren}</RootLayout>)

    // 複数の子要素が正しく表示されることを確認
    expect(screen.getByTestId("test-title")).toBeInTheDocument()
    expect(screen.getByTestId("test-paragraph")).toBeInTheDocument()

    // テキスト内容も確認
    expect(screen.getByTestId("test-title")).toHaveTextContent("Test Title")
    expect(screen.getByTestId("test-paragraph")).toHaveTextContent(
      "Test paragraph content"
    )
  })
})
