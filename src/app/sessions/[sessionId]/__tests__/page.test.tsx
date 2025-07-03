import { render, screen, fireEvent } from "@testing-library/react"
import SessionDetailPage from "../page"

// Mock react's experimental use to simply return its argument
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  use: (value: any) => value,
}))

const mockPush = jest.fn()

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock("@/components/SessionHistoryTable", () => {
  return function MockTable({ sessionId }: { sessionId: string }) {
    return (
      <div data-testid="history" data-session-id={sessionId}>
        table
      </div>
    )
  }
})

describe("SessionDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders heading and passes sessionId", () => {
    render(<SessionDetailPage params={{ sessionId: "s1" } as any} />)

    expect(screen.getByText("セッション詳細")).toBeInTheDocument()
    const table = screen.getByTestId("history")
    expect(table).toHaveAttribute("data-session-id", "s1")
  })

  it("navigates to sessions list", () => {
    render(<SessionDetailPage params={{ sessionId: "s2" } as any} />)

    fireEvent.click(screen.getByText("セッション一覧"))
    expect(mockPush).toHaveBeenCalledWith("/sessions")
  })

  it("navigates home", () => {
    render(<SessionDetailPage params={{ sessionId: "s3" } as any} />)

    fireEvent.click(screen.getByText("ホーム"))
    expect(mockPush).toHaveBeenCalledWith("/")
  })
})
