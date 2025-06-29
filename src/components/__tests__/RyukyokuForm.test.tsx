import { render, screen, fireEvent } from "@testing-library/react"
import { MantineProvider } from "@mantine/core"
import RyukyokuForm from "../RyukyokuForm"

const players = [
  {
    playerId: "p1",
    name: "A",
    position: 0,
    points: 25000,
    isReach: false,
    isConnected: true,
  },
  {
    playerId: "p2",
    name: "B",
    position: 1,
    points: 25000,
    isReach: false,
    isConnected: true,
  },
  {
    playerId: "p3",
    name: "C",
    position: 2,
    points: 25000,
    isReach: false,
    isConnected: true,
  },
  {
    playerId: "p4",
    name: "D",
    position: 3,
    points: 25000,
    isReach: false,
    isConnected: true,
  },
]

describe("RyukyokuForm", () => {
  const mockSubmit = jest.fn()
  const mockCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("renders players and submits selected tenpai", () => {
    render(
      <MantineProvider>
        <RyukyokuForm
          players={players}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      </MantineProvider>
    )

    fireEvent.click(screen.getAllByText("ノーテン")[0])
    fireEvent.click(screen.getAllByText("確認")[1])

    expect(screen.getByText(/テンパイ者/)).toBeInTheDocument()

    fireEvent.click(screen.getByText("支払い"))

    expect(mockSubmit).toHaveBeenCalledWith(["p1"])
  })
})
