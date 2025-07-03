import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SoloRyukyokuForm from "../SoloRyukyokuForm"
import { BaseRyukyokuForm } from "@/components/common"

jest.mock("@/components/common", () => {
  const mockedBase = jest.fn((props: any) => {
    const { onSubmit, onCancel } = props
    return (
      <div data-testid="base-form">
        <button onClick={() => onSubmit(["id"])}>submit</button>
        <button onClick={onCancel}>cancel</button>
      </div>
    )
  })
  return { __esModule: true, BaseRyukyokuForm: mockedBase }
})

const players = [
  { id: "1", name: "P1", position: 0, points: 25000, isReach: false },
  { id: "2", name: "P2", position: 1, points: 25000, isReach: false },
]

describe("SoloRyukyokuForm", () => {
  const mockSubmit = jest.fn()
  const mockCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders BaseRyukyokuForm with correct props", () => {
    render(
      <SoloRyukyokuForm
        players={players}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />
    )

    expect(screen.getByTestId("base-form")).toBeInTheDocument()
    expect(BaseRyukyokuForm as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ players, mode: "solo" }),
      {}
    )
  })

  it("calls onSubmit and onCancel handlers", async () => {
    const user = userEvent.setup()
    render(
      <SoloRyukyokuForm
        players={players}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />
    )

    await user.click(screen.getByText("submit"))
    await user.click(screen.getByText("cancel"))

    expect(mockSubmit).toHaveBeenCalledWith(["id"])
    expect(mockCancel).toHaveBeenCalled()
  })
})
