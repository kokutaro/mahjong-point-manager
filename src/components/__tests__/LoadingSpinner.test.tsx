import { render, screen } from "@testing-library/react"
import LoadingSpinner from "../LoadingSpinner"

describe("LoadingSpinner", () => {
  it("renders default size and message", () => {
    render(<LoadingSpinner />)
    expect(screen.getByLabelText("読み込み中")).toBeInTheDocument()
    expect(screen.getByText("読み込み中...")).toBeInTheDocument()
  })

  it("supports custom size and message", () => {
    render(<LoadingSpinner size="lg" message="please wait" />)
    const spinner = screen.getByLabelText("読み込み中")
    expect(spinner.className).toContain("w-12")
    expect(screen.getByText("please wait")).toBeInTheDocument()
  })
})
