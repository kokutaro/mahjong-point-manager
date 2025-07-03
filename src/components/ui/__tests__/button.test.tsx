import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { Button } from "../button"

// MantineButtonをモック化
jest.mock("@mantine/core", () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
    disabled,
    className,
    ...props
  }: any) => (
    <button
      onClick={onClick}
      data-testid="mantine-button"
      data-variant={variant}
      data-size={size}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}))

describe("Button Component", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders correctly with children", () => {
    render(<Button>Click me</Button>)

    const button = screen.getByTestId("mantine-button")
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent("Click me")
  })

  it("passes all props to MantineButton", () => {
    const handleClick = jest.fn()

    render(
      <Button
        onClick={handleClick}
        disabled={true}
        variant="filled"
        size="md"
        data-custom="test-value"
      >
        Test Button
      </Button>
    )

    const button = screen.getByTestId("mantine-button")

    // propsが正しく渡されることを確認
    expect(button).toHaveAttribute("disabled")
    expect(button).toHaveAttribute("data-variant", "filled")
    expect(button).toHaveAttribute("data-size", "md")
    expect(button).toHaveAttribute("data-custom", "test-value")
  })

  it("handles click events correctly", () => {
    const handleClick = jest.fn()

    render(<Button onClick={handleClick}>Clickable Button</Button>)

    const button = screen.getByTestId("mantine-button")
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("renders without onClick handler", () => {
    render(<Button>Static Button</Button>)

    const button = screen.getByTestId("mantine-button")
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent("Static Button")

    // クリックしてもエラーにならないことを確認
    fireEvent.click(button)
  })

  it("supports complex children", () => {
    render(
      <Button>
        <span data-testid="icon">🔥</span>
        <span data-testid="text">Fire Button</span>
      </Button>
    )

    expect(screen.getByTestId("icon")).toBeInTheDocument()
    expect(screen.getByTestId("text")).toBeInTheDocument()
    expect(screen.getByTestId("icon")).toHaveTextContent("🔥")
    expect(screen.getByTestId("text")).toHaveTextContent("Fire Button")
  })

  it("spreads additional props correctly", () => {
    render(
      <Button
        aria-label="Custom button"
        title="Button tooltip"
        className="custom-class"
      >
        Accessible Button
      </Button>
    )

    const button = screen.getByTestId("mantine-button")
    expect(button).toHaveAttribute("aria-label", "Custom button")
    expect(button).toHaveAttribute("title", "Button tooltip")
    expect(button).toHaveClass("custom-class")
  })
})
